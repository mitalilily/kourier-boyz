import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Order from '../models/Order'
import SupportChat, { ChatMessage } from '../models/SupportChat'
import { io } from '../server'

// Auto-close inactive chats (chats without activity for 24 hours)
export const autoCloseInactiveChats = async () => {
  try {
    const INACTIVE_HOURS = 24 // Close chats inactive for 24 hours
    const inactiveThreshold = new Date(Date.now() - INACTIVE_HOURS * 60 * 60 * 1000)

    // Find inactive chats that are not already closed
    const inactiveChats = await SupportChat.find({
      status: { $in: ['open', 'active', 'waiting'] },
      $or: [
        // Chats with last message older than threshold
        { lastMessageAt: { $lt: inactiveThreshold } },
        // Chats without any messages (never got a response) older than threshold
        {
          lastMessageAt: { $exists: false },
          createdAt: { $lt: inactiveThreshold },
        },
      ],
    }).select('_id customerId')

    if (inactiveChats.length === 0) {
      return 0
    }

    // Update all inactive chats to closed status
    const chatIds = inactiveChats.map((chat) => chat._id)
    const result = await SupportChat.updateMany(
      {
        _id: { $in: chatIds },
        status: { $in: ['open', 'active', 'waiting'] }, // Double-check status hasn't changed
      },
      {
        $set: {
          status: 'closed',
          resolvedAt: new Date(),
        },
      },
    )

    if (result.modifiedCount > 0) {
      console.log(
        `Auto-closed ${result.modifiedCount} inactive chats (inactive for ${INACTIVE_HOURS} hours)`,
      )

      // Notify customers about closed chats via Socket.IO
      for (const chat of inactiveChats) {
        try {
          io.to(`user:${chat.customerId.toString()}`).emit('supportChat:statusUpdate', {
            chatId: chat._id,
            status: 'closed',
            reason: 'inactive',
          })
        } catch (err) {
          // Ignore socket errors
        }
      }
    }

    return result.modifiedCount
  } catch (err) {
    console.error('Error auto-closing inactive chats:', err)
    return 0
  }
}

// Customer: Create a new chat
export const createChat = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { subject, issueType, orderId } = req.body as {
      subject?: string
      issueType?: string
      orderId?: string
    }

    const chat = await SupportChat.create({
      customerId: userId,
      subject,
      issueType: issueType as
        | 'order'
        | 'refund'
        | 'product'
        | 'account'
        | 'shipping'
        | 'payment'
        | 'other'
        | undefined,
      orderId: orderId || undefined,
      status: 'open',
    })

    // If this chat is linked to an order or has a subject, create an initial
    // context message so support can immediately see what it's about.
    try {
      let initialMessage = ''
      let attachments: string[] | undefined

      if (orderId) {
        const orderDoc: any = await Order.findById(orderId)
          .select('orderNumber status items')
          .populate('items.product', 'name mainImage slug')

        if (orderDoc) {
          const mainItem = orderDoc.items?.[0]
          const mainProduct = mainItem?.product as any
          const orderLabel = orderDoc.orderNumber || orderDoc._id?.toString?.() || ''
          const orderLine = `Order: #${orderLabel}`
          const statusLine = `Status: ${orderDoc.status || 'N/A'}`
          const productLine = mainProduct?.name ? `Product: ${mainProduct.name}` : undefined
          // Internal admin order details path so support can quickly open it
          const orderUrlLine = `Admin order page: /orders/${orderDoc._id}`

          initialMessage = [orderLine, statusLine, productLine, orderUrlLine]
            .filter(Boolean)
            .join('\n')

          if (mainProduct?.mainImage) {
            // Attach main product image so admin UI can render a thumbnail
            attachments = [mainProduct.mainImage]
          }
        }
      }

      if (subject) {
        initialMessage = initialMessage
          ? `${initialMessage}\n\nCustomer note: ${subject}`
          : `Customer note: ${subject}`
      }

      if (initialMessage) {
        const msg = await ChatMessage.create({
          chatId: chat._id,
          senderId: userId,
          senderRole: 'customer',
          message: initialMessage,
          attachments,
          read: false,
        })

        chat.messages.push(msg._id as mongoose.Types.ObjectId)
        chat.lastMessageAt = msg.createdAt
        await chat.save()
      }
    } catch (initialErr) {
      // Don't block chat creation if initial context message fails; just log.
      console.error('Error creating initial support chat context message:', initialErr)
    }

    const populatedChat = await SupportChat.findById(chat._id)
      .populate('customerId', 'name email')
      .populate('orderId')

    // Notify admins
    io.to('super-admin').emit('supportChat:new', {
      id: chat._id,
      customerId: userId,
      subject: chat.subject,
      issueType: chat.issueType,
    })

    res.status(201).json(populatedChat)
  } catch (err) {
    console.error('Error creating chat:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get user's chats
export const getMyChats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    // Auto-close inactive chats before fetching
    await autoCloseInactiveChats()

    const { status } = req.query as { status?: string }
    const query: any = { customerId: userId }
    if (status) query.status = status

    const chats = await SupportChat.find(query)
      .populate('assignedTo', 'name email')
      .populate('orderId')
      .sort({ lastMessageAt: -1, createdAt: -1 })

    res.json(chats)
  } catch (err) {
    console.error('Error getting my chats:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single chat with messages
export const getChat = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params

    // First check access without populating (faster and cleaner for access check)
    const chatForAccess = await SupportChat.findById(id).select('customerId assignedTo')
    if (!chatForAccess) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    // Check access:
    // - Customer can only see their own chats
    // - Super-admin can see all chats
    // - Other admin users can only see chats assigned to them
    const customerIdStr = chatForAccess.customerId.toString()
    const assignedToStr = chatForAccess.assignedTo?.toString()

    if (userRole !== 'super-admin') {
      // For non-super-admin users, check if they're the customer or assigned to the chat
      if (customerIdStr !== userId && assignedToStr !== userId) {
        console.log('Access denied:', {
          customerIdStr,
          userId,
          userRole,
          assignedToStr,
          chatId: id,
        })
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    // Now fetch full chat data with population
    const chat = await SupportChat.findById(id)
      .populate('customerId', 'name email')
      .populate('assignedTo', 'name email')
      .populate('orderId')

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    // Get messages
    const messages = await ChatMessage.find({ chatId: id })
      .populate('senderId', 'name email')
      .sort({ createdAt: 1 })

    res.json({ chat, messages })
  } catch (err) {
    console.error('Error getting chat:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Send a message in a chat
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { message, attachments } = req.body as { message: string; attachments?: string[] }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const chat = await SupportChat.findById(id)
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    if (chat.status === 'closed') {
      return res
        .status(400)
        .json({ error: 'Chat is closed. Please reopen before sending messages.' })
    }

    // Check access:
    // - Customer can only send messages in their own chats
    // - Super-admin can send messages in any chat
    // - Other admin users can only send messages in chats assigned to them
    const customerIdStr = chat.customerId.toString()
    const assignedToStr = chat.assignedTo?.toString()

    if (userRole !== 'super-admin') {
      if (customerIdStr !== userId && assignedToStr !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    // Determine sender role
    const senderRole =
      userRole === 'super-admin' || assignedToStr === userId ? 'super-admin' : 'customer'

    // Create message
    const chatMessage = await ChatMessage.create({
      chatId: id,
      senderId: userId,
      senderRole,
      message: message.trim(),
      attachments: attachments || [],
      read: false,
    })

    // Update chat
    chat.messages.push(chatMessage._id as mongoose.Types.ObjectId)
    chat.lastMessageAt = new Date()
    if (chat.status === 'open') {
      chat.status = 'active'
    }
    await chat.save()

    const populatedMessage = await ChatMessage.findById(chatMessage._id).populate(
      'senderId',
      'name email',
    )

    if (!populatedMessage) {
      return res.status(500).json({ error: 'Failed to create message' })
    }

    // Notify other party (customer or admin)
    if (userRole === 'super-admin' || assignedToStr === userId) {
      // Admin/support user sent message - notify customer
      io.to(`user:${chat.customerId.toString()}`).emit('supportChat:message', {
        chatId: id,
        message: populatedMessage,
      })

      // Also notify assigned user if different from sender
      if (chat.assignedTo && assignedToStr !== userId) {
        io.to(`user:${assignedToStr}`).emit('supportChat:message', {
          chatId: id,
          message: populatedMessage,
        })
      }
    } else {
      // Customer sent message - notify admins and assigned user
      io.to('super-admin').emit('supportChat:message', {
        chatId: id,
        message: populatedMessage,
      })

      // Notify assigned user if chat is assigned
      if (chat.assignedTo) {
        io.to(`user:${chat.assignedTo.toString()}`).emit('supportChat:message', {
          chatId: id,
          message: populatedMessage,
        })
      }
    }

    res.status(201).json(populatedMessage)
  } catch (err) {
    console.error('Error sending message:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Get all chats
export const getAllChats = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    // Auto-close inactive chats before fetching
    await autoCloseInactiveChats()

    const { status, assignedTo, issueType } = req.query as {
      status?: string
      assignedTo?: string
      issueType?: string
    }
    const query: any = {}

    // If user is not super-admin, only show chats assigned to them
    if (userRole !== 'super-admin') {
      query.assignedTo = userId
    } else {
      // Super-admin can filter by assignedTo if provided
      if (assignedTo) query.assignedTo = assignedTo
    }

    if (status) query.status = status
    if (issueType) query.issueType = issueType

    const chats = await SupportChat.find(query)
      .populate('customerId', 'name email')
      .populate('assignedTo', 'name email')
      .populate('orderId')
      .sort({ lastMessageAt: -1, createdAt: -1 })

    res.json(chats)
  } catch (err) {
    console.error('Error getting all chats:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Assign chat to admin
export const assignChat = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { assignedTo } = req.body as { assignedTo: string }

    const chat = await SupportChat.findById(id)
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    if (chat.status === 'closed') {
      return res.status(400).json({ error: 'Cannot assign a closed chat. Reopen it first.' })
    }

    // Get admin details before assignment
    const User = (await import('../models/User')).default
    const assignedAdmin = await User.findById(assignedTo).select('name email')

    const previousAssignedTo = chat.assignedTo

    chat.assignedTo = assignedTo as unknown as mongoose.Types.ObjectId
    chat.status = 'active'
    await chat.save()

    const populatedChat = await SupportChat.findById(chat._id)
      .populate('customerId', 'name email')
      .populate('assignedTo', 'name email')

    if (!populatedChat) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    // Send system message to customer when admin is assigned (only if newly assigned)
    if (!previousAssignedTo || previousAssignedTo.toString() !== assignedTo) {
      const helperName = assignedAdmin?.name || 'Our support team'
      const systemMessage = await ChatMessage.create({
        chatId: id,
        senderId: assignedTo, // Admin's ID
        senderRole: 'super-admin',
        message: `Hi! ${helperName} has been assigned to help you. Please describe your issue and we'll assist you right away.`,
        read: false,
      })

      // Update chat with system message
      chat.messages.push(systemMessage._id as mongoose.Types.ObjectId)
      chat.lastMessageAt = new Date()
      await chat.save()

      const populatedMessage = await ChatMessage.findById(systemMessage._id).populate(
        'senderId',
        'name email',
      )

      if (populatedMessage) {
        // Notify customer about new message
        io.to(`user:${chat.customerId.toString()}`).emit('supportChat:message', {
          chatId: id,
          message: populatedMessage,
        })
      }
    }

    // Notify customer
    io.to(`user:${chat.customerId.toString()}`).emit('supportChat:assigned', {
      chatId: id,
      assignedTo: populatedChat.assignedTo,
    })

    // Notify assigned user about the assignment
    if (assignedTo && (!previousAssignedTo || previousAssignedTo.toString() !== assignedTo)) {
      io.to(`user:${assignedTo}`).emit('supportChat:assignedToYou', {
        chatId: id,
        chat: {
          _id: populatedChat._id,
          customerId: populatedChat.customerId,
          subject: populatedChat.subject,
          issueType: populatedChat.issueType,
          status: populatedChat.status,
        },
        assignedBy: req.user?.userId,
      })
    }

    res.json(populatedChat)
  } catch (err) {
    console.error('Error assigning chat:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin/Customer: Update chat status
export const updateChatStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { status } = req.body as { status: string }

    const chat = await SupportChat.findById(id)
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    // Check access:
    // - Customer can only close their own chats
    // - Super-admin can change any chat status
    // - Other admin users can change status of chats assigned to them
    const customerIdStr = chat.customerId.toString()
    const assignedToStr = chat.assignedTo?.toString()

    if (userRole !== 'super-admin') {
      // For customers, they can only close their own chats
      if (customerIdStr === userId) {
        if (status !== 'closed') {
          return res.status(403).json({ error: 'You can only close chats' })
        }
      } else if (assignedToStr !== userId) {
        // Not the customer and not assigned - deny access
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    const previousStatus = chat.status
    chat.status = status as 'open' | 'active' | 'waiting' | 'closed'
    if (status === 'closed') {
      chat.resolvedAt = new Date()
    }
    await chat.save()

    const populatedChat = await SupportChat.findById(chat._id)
      .populate('customerId', 'name email')
      .populate('assignedTo', 'name email')

    // Send system message when chat is closed by admin
    if (status === 'closed' && previousStatus !== 'closed' && userRole === 'admin') {
      const assignedToPopulated = populatedChat?.assignedTo as { name?: string } | undefined
      const closedBy = assignedToPopulated?.name || 'Support Team'
      const systemMessage = await ChatMessage.create({
        chatId: id,
        senderId: userId, // Admin's ID
        senderRole: 'super-admin',
        message: `This chat has been closed by ${closedBy}. If you need further assistance, please start a new chat.`,
        read: false,
      })

      chat.messages.push(systemMessage._id as mongoose.Types.ObjectId)
      chat.lastMessageAt = new Date()
      await chat.save()

      const populatedMessage = await ChatMessage.findById(systemMessage._id).populate(
        'senderId',
        'name email',
      )

      if (populatedMessage) {
        io.to(`user:${chat.customerId.toString()}`).emit('supportChat:message', {
          chatId: id,
          message: populatedMessage,
        })
      }
    }

    // Notify about status change
    if (status === 'closed') {
      io.to(`user:${chat.customerId.toString()}`).emit('supportChat:statusUpdate', {
        chatId: id,
        status: 'closed',
        reason: userRole === 'super-admin' ? 'super-admin' : 'customer',
      })
    }

    res.json(populatedChat)
  } catch (err) {
    console.error('Error updating chat status:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Mark messages as read
export const markMessagesAsRead = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const chat = await SupportChat.findById(id)
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    // Check access:
    // - Customer can mark messages as read in their own chats
    // - Super-admin can mark messages as read in any chat
    // - Other admin users can mark messages as read in chats assigned to them
    const customerIdStr = chat.customerId.toString()
    const assignedToStr = chat.assignedTo?.toString()

    if (userRole !== 'super-admin') {
      if (customerIdStr !== userId && assignedToStr !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    // Mark unread messages as read (messages not sent by current user)
    await ChatMessage.updateMany(
      {
        chatId: id,
        senderId: { $ne: userId },
        read: false,
      },
      {
        $set: { read: true, readAt: new Date() },
      },
    )

    res.json({ message: 'Messages marked as read' })
  } catch (err) {
    console.error('Error marking messages as read:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Customer: Rate chat and provide feedback
export const rateChat = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { satisfaction, feedback } = req.body as {
      satisfaction: number
      feedback?: string
    }

    if (!satisfaction || satisfaction < 1 || satisfaction > 5) {
      return res.status(400).json({ error: 'Satisfaction rating must be between 1 and 5' })
    }

    const chat = await SupportChat.findById(id)
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' })
    }

    if (chat.customerId.toString() !== userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    chat.customerSatisfaction = satisfaction
    if (feedback) chat.customerFeedback = feedback
    await chat.save()

    res.json({ message: 'Rating recorded', chat })
  } catch (err) {
    console.error('Error rating chat:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
