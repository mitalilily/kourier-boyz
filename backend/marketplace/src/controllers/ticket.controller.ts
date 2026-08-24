import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Ticket, { TicketMessage } from '../models/Ticket'
import User from '../models/User'
import { io } from '../server'
import { emailTemplates, sendEmail } from '../utils/email'
import { uploadToR2 } from '../utils/r2Upload'
import { getSlaHours } from '../constants/slaRules'

// Customer: Create a new ticket
export const createTicket = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { subject, category, description, priority, orderId, attachments } = req.body as {
      subject: string
      category: string
      description: string
      priority?: string
      orderId?: string
      attachments?: string[]
    }

    if (!subject || !category || !description) {
      return res.status(400).json({ error: 'Subject, category, and description are required' })
    }

    const ticketPriority = (priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium'
    const ticketCategory = category as
      | 'order'
      | 'refund'
      | 'product'
      | 'account'
      | 'shipping'
      | 'payment'
      | 'technical'
      | 'other'

    const ticket = await Ticket.create({
      customerId: userId,
      subject,
      category: ticketCategory,
      description,
      priority: ticketPriority,
      orderId: orderId || undefined,
      status: 'open',
      slaHours: getSlaHours(ticketCategory, ticketPriority),
    })

    // Create initial message with description
    const initialMessage = await TicketMessage.create({
      ticketId: ticket._id,
      senderId: userId,
      senderRole: 'customer',
      message: description,
      attachments: attachments || [],
      read: false,
    })

    ticket.messages.push(initialMessage._id as mongoose.Types.ObjectId)
    ticket.lastMessageAt = new Date()
    ticket.lastActivityAt = new Date()
    await ticket.save()

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('customerId', 'name email')
      .populate('orderId')
      .populate('createdBy', 'name email')

    // Notify admins
    io.to('super-admin').emit('ticket:new', {
      id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      customerId: userId,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
    })

    res.status(201).json(populatedTicket)
  } catch (err) {
    console.error('Error creating ticket:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Create a ticket on behalf of a customer
export const createTicketAsAdmin = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    if (userRole !== 'super-admin' && userRole !== 'support') {
      return res.status(403).json({
        error: 'Only admins can create tickets on behalf of customers or sellers',
      })
    }

    const {
      customerId,
      sellerId,
      subject,
      category,
      description,
      priority,
      orderId,
      ledgerEntryId,
      settlementBatchId,
      refundRequestId,
      attachments,
    } = req.body as {
      customerId?: string
      sellerId?: string
      subject: string
      category: string
      description: string
      priority?: string
      orderId?: string
      ledgerEntryId?: string
      settlementBatchId?: string
      refundRequestId?: string
      attachments?: string[]
    }

    if (!subject || !category || !description) {
      return res.status(400).json({
        error: 'Subject, category, and description are required',
      })
    }

    if (!customerId && !sellerId) {
      return res.status(400).json({
        error: 'Either customerId or sellerId is required',
      })
    }

    if (customerId && sellerId) {
      return res.status(400).json({
        error: 'Cannot specify both customerId and sellerId',
      })
    }

    const ticketType = sellerId ? 'seller' : 'customer'
    const ticketPriority = (priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium'
    const ticketCategory = category as
      | 'order'
      | 'refund'
      | 'product'
      | 'account'
      | 'shipping'
      | 'payment'
      | 'technical'
      | 'settlement'
      | 'ledger'
      | 'payout'
      | 'other'

    const ticketData: any = {
      ticketType,
      createdBy: userId,
      subject,
      category: ticketCategory,
      description,
      priority: ticketPriority,
      status: 'open',
      slaHours: getSlaHours(ticketCategory, ticketPriority),
    }

    if (customerId) {
      ticketData.customerId = customerId
      if (orderId) ticketData.orderId = orderId
    }

    if (sellerId) {
      ticketData.sellerId = sellerId
      if (orderId) ticketData.orderId = orderId
      if (ledgerEntryId) ticketData.ledgerEntryId = ledgerEntryId
      if (settlementBatchId) ticketData.settlementBatchId = settlementBatchId
      if (refundRequestId) ticketData.refundRequestId = refundRequestId
    }

    const ticket = await Ticket.create(ticketData)

    // Create initial message with description
    const initialMessage = await TicketMessage.create({
      ticketId: ticket._id,
      senderId: userId,
      senderRole: 'super-admin',
      message: description,
      attachments: attachments || [],
      read: false,
    })

    ticket.messages.push(initialMessage._id as mongoose.Types.ObjectId)
    ticket.lastMessageAt = new Date()
    ticket.lastActivityAt = new Date()
    await ticket.save()

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('customerId', 'name email')
      .populate('sellerId', 'name email businessName')
      .populate('orderId')
      .populate('ledgerEntryId')
      .populate('settlementBatchId')
      .populate('refundRequestId')
      .populate('createdBy', 'name email')

    // Notify user (customer or seller)
    const notifyUserId = sellerId || customerId
    if (notifyUserId) {
      io.to(`user:${notifyUserId}`).emit('ticket:new', {
      id: ticket._id,
      ticketNumber: ticket.ticketNumber,
        ticketType,
      subject: ticket.subject,
      })
    }

    // Notify admins
    io.to('super-admin').emit('ticket:new', {
      id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      ticketType,
      [ticketType === 'seller' ? 'sellerId' : 'customerId']: notifyUserId,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
    })

    res.status(201).json(populatedTicket)
  } catch (err) {
    console.error('Error creating ticket as admin:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get user's tickets (customer or seller)
export const getMyTickets = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { status } = req.query as { status?: string }
    const query: any = {}

    // Determine ticket type based on user role
    if (userRole === 'seller') {
      query.sellerId = userId
      query.ticketType = 'seller'
    } else {
      query.customerId = userId
      query.ticketType = 'customer'
    }

    if (status) query.status = status

    const tickets = await Ticket.find(query)
      .populate('assignedTo', 'name email')
      .populate('orderId')
      .populate('ledgerEntryId')
      .populate('settlementBatchId')
      .populate('refundRequestId')
      .populate('createdBy', 'name email')
      .sort({ lastActivityAt: -1, createdAt: -1 })

    res.json(tickets)
  } catch (err) {
    console.error('Error getting my tickets:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Seller: Create a new ticket
export const createSellerTicket = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    if (userRole !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can create seller tickets' })
    }

    const {
      subject,
      category,
      description,
      priority,
      orderId,
      ledgerEntryId,
      settlementBatchId,
      refundRequestId,
      attachments,
    } = req.body as {
      subject: string
      category: string
      description: string
      priority?: string
      orderId?: string
      ledgerEntryId?: string
      settlementBatchId?: string
      refundRequestId?: string
      attachments?: string[]
    }

    if (!subject || !category || !description) {
      return res.status(400).json({ error: 'Subject, category, and description are required' })
    }

    const ticketPriority = (priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium'
    const ticketCategory = category as
      | 'order'
      | 'refund'
      | 'product'
      | 'account'
      | 'shipping'
      | 'payment'
      | 'technical'
      | 'settlement'
      | 'ledger'
      | 'payout'
      | 'other'

    const ticket = await Ticket.create({
      ticketType: 'seller',
      sellerId: userId,
      subject,
      category: ticketCategory,
      description,
      priority: ticketPriority,
      orderId: orderId || undefined,
      ledgerEntryId: ledgerEntryId || undefined,
      settlementBatchId: settlementBatchId || undefined,
      refundRequestId: refundRequestId || undefined,
      status: 'open',
      slaHours: getSlaHours(ticketCategory, ticketPriority),
    })

    // Create initial message with description
    const initialMessage = await TicketMessage.create({
      ticketId: ticket._id,
      senderId: userId,
      senderRole: 'seller',
      message: description,
      attachments: attachments || [],
      read: false,
    })

    ticket.messages.push(initialMessage._id as mongoose.Types.ObjectId)
    ticket.lastMessageAt = new Date()
    ticket.lastActivityAt = new Date()
    await ticket.save()

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('sellerId', 'name email businessName')
      .populate('orderId')
      .populate('ledgerEntryId')
      .populate('settlementBatchId')
      .populate('refundRequestId')
      .populate('createdBy', 'name email')

    // Notify admins
    io.to('super-admin').emit('ticket:new', {
      id: ticket._id,
      ticketNumber: ticket.ticketNumber,
      ticketType: 'seller',
      sellerId: userId,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
    })

    res.status(201).json(populatedTicket)
  } catch (err) {
    console.error('Error creating seller ticket:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get single ticket with messages
export const getTicket = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params

    // First check access without populating (faster and cleaner for access check)
    const ticketForAccess = await Ticket.findById(id).select(
      'customerId sellerId assignedTo createdBy ticketType',
    )
    if (!ticketForAccess) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    // Check access:
    // - Customer can only see their own customer tickets
    // - Seller can only see their own seller tickets
    // - Super-admin can see all tickets
    // - Other admin users can only see tickets assigned to them or created by them
    const customerIdStr = ticketForAccess.customerId?.toString()
    const sellerIdStr = ticketForAccess.sellerId?.toString()
    const assignedToStr = ticketForAccess.assignedTo?.toString()
    const createdByStr = ticketForAccess.createdBy?.toString()

    if (userRole !== 'super-admin') {
      // For non-super-admin users, check if they own, are assigned to, or created the ticket
      const isOwner =
        (ticketForAccess.ticketType === 'customer' && customerIdStr === userId) ||
        (ticketForAccess.ticketType === 'seller' && sellerIdStr === userId)

      if (!isOwner && assignedToStr !== userId && createdByStr !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    // Now fetch full ticket data with population
    const ticket = await Ticket.findById(id)
      .populate('customerId', 'name email')
      .populate('sellerId', 'name email businessName')
      .populate('assignedTo', 'name email')
      .populate('orderId')
      .populate('ledgerEntryId')
      .populate('settlementBatchId')
      .populate('refundRequestId')
      .populate('createdBy', 'name email')

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    // Get messages
    const messages = await TicketMessage.find({ ticketId: id })
      .populate('senderId', 'name email')
      .sort({ createdAt: 1 })

    res.json({ ticket, messages })
  } catch (err) {
    console.error('Error getting ticket:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Send a message in a ticket
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { message, attachments } = req.body as {
      message: string
      attachments?: string[]
    }

    // Allow empty message if attachments are provided
    const hasAttachments = attachments && attachments.length > 0
    const hasMessage = message && message.trim().length > 0
    
    if (!hasMessage && !hasAttachments) {
      return res.status(400).json({ error: 'Message or attachments are required' })
    }

    const ticket = await Ticket.findById(id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({
        error: 'Ticket is closed. Please reopen before sending messages.',
      })
    }

    // Check access:
    // - Customer can only send messages in their own customer tickets
    // - Seller can only send messages in their own seller tickets
    // - Super-admin can send messages in any ticket
    // - Other admin users can only send messages in tickets assigned to them or created by them
    const customerIdStr = ticket.customerId?.toString()
    const sellerIdStr = ticket.sellerId?.toString()
    const assignedToStr = ticket.assignedTo?.toString()
    const createdByStr = ticket.createdBy?.toString()

    if (userRole !== 'super-admin') {
      const isOwner =
        (ticket.ticketType === 'customer' && customerIdStr === userId) ||
        (ticket.ticketType === 'seller' && sellerIdStr === userId)

      if (!isOwner && assignedToStr !== userId && createdByStr !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    // Determine sender role
    let senderRole: 'customer' | 'seller' | 'super-admin' | 'support'
    if (userRole === 'super-admin' || assignedToStr === userId || createdByStr === userId) {
      senderRole = 'super-admin'
    } else if (userRole === 'seller' && ticket.ticketType === 'seller') {
      senderRole = 'seller'
    } else {
      senderRole = 'customer'
    }

    // Create message
    const ticketMessage = await TicketMessage.create({
      ticketId: id,
      senderId: userId,
      senderRole,
      message: message?.trim() || '',
      attachments: attachments || [],
      read: false,
    })

    // Update ticket
    ticket.messages.push(ticketMessage._id as mongoose.Types.ObjectId)
    ticket.lastMessageAt = new Date()
    ticket.lastActivityAt = new Date()

    // Update status if it's open and message is not a system message
    // System messages don't automatically change ticket status
    const previousStatus = ticket.status
    if (ticket.status === 'open' && senderRole !== 'seller' && userRole !== 'super-admin') {
      ticket.status = 'in-progress'
    }

    await ticket.save()

    const populatedMessage = await TicketMessage.findById(ticketMessage._id).populate(
      'senderId',
      'name email',
    )

    if (!populatedMessage) {
      return res.status(500).json({ error: 'Failed to create message' })
    }

    // Notify other party (customer/seller or admin)
    if (userRole === 'super-admin' || assignedToStr === userId || createdByStr === userId) {
      // Admin/support user sent message - notify ticket owner
      if (ticket.ticketType === 'customer' && ticket.customerId) {
        io.to(`user:${ticket.customerId.toString()}`).emit('ticket:message', {
        ticketId: id,
        message: populatedMessage,
        })

        // Send email notification to customer
        try {
          const customer = await User.findById(ticket.customerId).select('name email')
          if (customer?.email) {
            const frontendUrl = process.env.FRONTEND_URL
            const ticketUrl = frontendUrl ? `${frontendUrl}/help/tickets/${id}` : null
            const senderInfo = populatedMessage.senderId as
              | { name?: string; email?: string }
              | mongoose.Types.ObjectId
            const senderName =
              typeof senderInfo === 'object' && senderInfo !== null && 'name' in senderInfo
                ? senderInfo.name || 'Support Team'
                : 'Support Team'
            await sendEmail(
              customer.email,
              `New message on ticket #${ticket.ticketNumber}`,
              emailTemplates.ticketMessageNotification(
                customer.name || 'Customer',
                ticket.ticketNumber || '',
                ticket.subject,
                senderName,
                populatedMessage.message,
                ticketUrl,
                'customer',
              ),
            )
          }
        } catch (emailError) {
          console.error('Error sending ticket message email to customer:', emailError)
        }
      } else if (ticket.ticketType === 'seller' && ticket.sellerId) {
        io.to(`user:${ticket.sellerId.toString()}`).emit('ticket:message', {
          ticketId: id,
          message: populatedMessage,
        })

        // Send email notification to seller
        try {
          const seller = await User.findById(ticket.sellerId).select('name email businessName')
          if (seller?.email) {
            const sellerPanelUrl = process.env.SELLER_PANEL_URL
            const ticketUrl = sellerPanelUrl ? `${sellerPanelUrl}/tickets` : null
            const senderInfo = populatedMessage.senderId as
              | { name?: string; email?: string }
              | mongoose.Types.ObjectId
            const senderName =
              typeof senderInfo === 'object' && senderInfo !== null && 'name' in senderInfo
                ? senderInfo.name || 'Support Team'
                : 'Support Team'
            await sendEmail(
              seller.email,
              `New message on ticket #${ticket.ticketNumber}`,
              emailTemplates.ticketMessageNotification(
                seller.businessName || seller.name || 'Seller',
                ticket.ticketNumber || '',
                ticket.subject,
                senderName,
                populatedMessage.message,
                ticketUrl,
                'seller',
              ),
            )
          }
        } catch (emailError) {
          console.error('Error sending ticket message email to seller:', emailError)
        }
      }

      // Also notify assigned user if different from sender
      if (ticket.assignedTo && assignedToStr !== userId) {
        io.to(`user:${assignedToStr}`).emit('ticket:message', {
          ticketId: id,
          message: populatedMessage,
        })
      }
    } else {
      // Customer/Seller sent message - notify admins and assigned user
      io.to('super-admin').emit('ticket:message', {
        ticketId: id,
        message: populatedMessage,
      })

      // Notify assigned user if ticket is assigned
      if (ticket.assignedTo) {
        io.to(`user:${ticket.assignedTo.toString()}`).emit('ticket:message', {
          ticketId: id,
          message: populatedMessage,
        })

        // Send email notification to assigned admin
        try {
          const assignedAdmin = await User.findById(ticket.assignedTo).select('name email')
          if (assignedAdmin?.email) {
            const adminPanelUrl = process.env.ADMIN_PANEL_URL
            const ticketUrl = adminPanelUrl ? `${adminPanelUrl}/tickets` : null
            const senderInfo = populatedMessage.senderId as
              | { name?: string; email?: string }
              | mongoose.Types.ObjectId
            const senderName =
              typeof senderInfo === 'object' && senderInfo !== null && 'name' in senderInfo
                ? senderInfo.name || 'User'
                : 'User'
            await sendEmail(
              assignedAdmin.email,
              `New message on ticket #${ticket.ticketNumber}`,
              emailTemplates.ticketMessageNotification(
                assignedAdmin.name || 'Admin',
                ticket.ticketNumber || '',
                ticket.subject,
                senderName,
                populatedMessage.message,
                ticketUrl,
                ticket.ticketType || 'seller',
              ),
            )
          }
        } catch (emailError) {
          console.error('Error sending ticket message email to admin:', emailError)
        }
      }
    }

    res.status(201).json(populatedMessage)
  } catch (err) {
    console.error('Error sending message:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Get all tickets
export const getAllTickets = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { status, assignedTo, category, priority, ticketType } = req.query as {
      status?: string
      assignedTo?: string
      category?: string
      priority?: string
      ticketType?: string
    }
    const query: any = {}

    // If user is not super-admin, only show tickets assigned to them or created by them
    if (userRole !== 'super-admin') {
      query.$or = [{ assignedTo: userId }, { createdBy: userId }]
    } else {
      // Super-admin can filter by assignedTo if provided
      if (assignedTo) query.assignedTo = assignedTo
    }

    if (status) query.status = status
    if (category) query.category = category
    if (priority) query.priority = priority
    if (ticketType) query.ticketType = ticketType

    const tickets = await Ticket.find(query)
      .populate('customerId', 'name email')
      .populate('sellerId', 'name email businessName')
      .populate('assignedTo', 'name email')
      .populate('orderId')
      .populate('ledgerEntryId')
      .populate('settlementBatchId')
      .populate('refundRequestId')
      .populate('createdBy', 'name email')
      .sort({ lastActivityAt: -1, createdAt: -1 })

    res.json(tickets)
  } catch (err) {
    console.error('Error getting all tickets:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Assign ticket to admin
export const assignTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { assignedTo } = req.body as { assignedTo: string }

    const ticket = await Ticket.findById(id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ error: 'Cannot assign a closed ticket. Reopen it first.' })
    }

    // Get admin details before assignment
    const User = (await import('../models/User')).default
    const assignedAdmin = await User.findById(assignedTo).select('name email')

    const previousAssignedTo = ticket.assignedTo

    ticket.assignedTo = assignedTo as unknown as mongoose.Types.ObjectId
    ticket.status = 'in-progress'
    ticket.lastActivityAt = new Date()
    await ticket.save()

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('customerId', 'name email')
      .populate('sellerId', 'name email businessName')
      .populate('assignedTo', 'name email')
      .populate('orderId')
      .populate('ledgerEntryId')
      .populate('settlementBatchId')
      .populate('refundRequestId')
      .populate('createdBy', 'name email')

    if (!populatedTicket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    // Send system message to customer when admin is assigned (only if newly assigned)
    if (!previousAssignedTo || previousAssignedTo.toString() !== assignedTo) {
      const helperName = assignedAdmin?.name || 'Our support team'
      const systemMessage = await TicketMessage.create({
        ticketId: id,
        senderId: assignedTo, // Admin's ID
        senderRole: 'super-admin',
        message: `Hi! ${helperName} has been assigned to help you with this ticket. We'll assist you right away.`,
        isSystemMessage: true,
        read: false,
      })

      // Update ticket with system message
      ticket.messages.push(systemMessage._id as mongoose.Types.ObjectId)
      ticket.lastMessageAt = new Date()
      ticket.lastActivityAt = new Date()
      await ticket.save()

      const populatedMessage = await TicketMessage.findById(systemMessage._id).populate(
        'senderId',
        'name email',
      )

      if (populatedMessage) {
        // Notify ticket owner about new message
        const ownerId =
          ticket.ticketType === 'customer'
            ? ticket.customerId?.toString()
            : ticket.sellerId?.toString()
        if (ownerId) {
          io.to(`user:${ownerId}`).emit('ticket:message', {
          ticketId: id,
          message: populatedMessage,
          })
        }
      }
    }

    // Notify ticket owner
    const ownerId =
      ticket.ticketType === 'customer' ? ticket.customerId?.toString() : ticket.sellerId?.toString()
    if (ownerId) {
      io.to(`user:${ownerId}`).emit('ticket:assigned', {
      ticketId: id,
      assignedTo: populatedTicket.assignedTo,
      })
    }

    // Notify assigned user about the assignment
    if (assignedTo && (!previousAssignedTo || previousAssignedTo.toString() !== assignedTo)) {
      io.to(`user:${assignedTo}`).emit('ticket:assignedToYou', {
        ticketId: id,
        ticket: {
          _id: populatedTicket._id,
          ticketNumber: populatedTicket.ticketNumber,
          ticketType: populatedTicket.ticketType,
          customerId: populatedTicket.customerId,
          sellerId: populatedTicket.sellerId,
          subject: populatedTicket.subject,
          category: populatedTicket.category,
          priority: populatedTicket.priority,
          status: populatedTicket.status,
        },
        assignedBy: req.user?.userId,
      })
    }

    res.json(populatedTicket)
  } catch (err) {
    console.error('Error assigning ticket:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin/Customer: Update ticket status
export const updateTicketStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { status } = req.body as { status: string }

    const ticket = await Ticket.findById(id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    // Check access:
    // - Customer/Seller can only close their own tickets
    // - Super-admin can change any ticket status
    // - Other admin users can change status of tickets assigned to them or created by them
    const customerIdStr = ticket.customerId?.toString()
    const sellerIdStr = ticket.sellerId?.toString()
    const assignedToStr = ticket.assignedTo?.toString()
    const createdByStr = ticket.createdBy?.toString()

    if (userRole !== 'super-admin' && userRole !== 'support') {
      // For customers/sellers, they can only close their own tickets
      const isOwner =
        (ticket.ticketType === 'customer' && customerIdStr === userId) ||
        (ticket.ticketType === 'seller' && sellerIdStr === userId)

      if (isOwner) {
        if (status !== 'closed') {
          return res.status(403).json({ error: 'You can only close tickets' })
        }
      } else if (assignedToStr !== userId && createdByStr !== userId) {
        // Not the owner and not assigned/created - deny access
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    const previousStatus = ticket.status
    ticket.status = status as 'open' | 'in-progress' | 'resolved' | 'closed'
    ticket.lastActivityAt = new Date()

    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = new Date()
    }
    if (status === 'closed') {
      ticket.closedAt = new Date()
    }

    // Automatically create system message for status changes (except from closed)
    if (previousStatus !== status && previousStatus !== 'closed') {
      try {
        const { createAutomatedSystemMessage } = await import('../utils/ticketSystemMessages')
        const statusMessages: Record<string, string> = {
          'in-progress':
            'Ticket status updated to In Progress. Our team is actively working on your request.',
          resolved:
            'Ticket status updated to Resolved. If you have any further questions, please feel free to respond.',
          closed:
            'Ticket has been closed. If you need further assistance, please create a new ticket.',
        }
        if (statusMessages[status]) {
          await createAutomatedSystemMessage({
            ticketId: id,
            message: statusMessages[status],
          })
        }
      } catch (error) {
        console.error('Error creating automated system message for status change:', error)
        // Don't fail the status update if system message fails
      }
    }

    await ticket.save()

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('customerId', 'name email')
      .populate('sellerId', 'name email businessName')
      .populate('assignedTo', 'name email')
      .populate('orderId')
      .populate('ledgerEntryId')
      .populate('settlementBatchId')
      .populate('refundRequestId')
      .populate('createdBy', 'name email')

    // Send system message when ticket is closed by admin
    if (
      status === 'closed' &&
      previousStatus !== 'closed' &&
      (userRole === 'super-admin' || userRole === 'support')
    ) {
      const assignedToPopulated = populatedTicket?.assignedTo as { name?: string } | undefined
      const closedBy = assignedToPopulated?.name || 'Support Team'
      const systemMessage = await TicketMessage.create({
        ticketId: id,
        senderId: userId, // Admin's ID
        senderRole: 'super-admin',
        message: `This ticket has been closed by ${closedBy}. If you need further assistance, please create a new ticket.`,
        isSystemMessage: true,
        read: false,
      })

      ticket.messages.push(systemMessage._id as mongoose.Types.ObjectId)
      ticket.lastMessageAt = new Date()
      ticket.lastActivityAt = new Date()
      await ticket.save()

      const populatedMessage = await TicketMessage.findById(systemMessage._id).populate(
        'senderId',
        'name email',
      )

      if (populatedMessage) {
        const ownerId =
          ticket.ticketType === 'customer'
            ? ticket.customerId?.toString()
            : ticket.sellerId?.toString()
        if (ownerId) {
          io.to(`user:${ownerId}`).emit('ticket:message', {
            ticketId: id,
            message: populatedMessage,
          })
        }

        // Send email notification for ticket closure
        try {
          if (ticket.ticketType === 'customer' && ticket.customerId) {
            const customer = await User.findById(ticket.customerId).select('name email')
            if (customer?.email) {
              const frontendUrl = process.env.FRONTEND_URL
            const ticketUrl = frontendUrl ? `${frontendUrl}/help/tickets/${id}` : null
              await sendEmail(
                customer.email,
                `Ticket #${ticket.ticketNumber} has been closed`,
                emailTemplates.ticketMessageNotification(
                  customer.name || 'Customer',
                  ticket.ticketNumber || '',
                  ticket.subject,
                  closedBy,
                  populatedMessage.message,
                  ticketUrl,
                  'customer',
                ),
              )
            }
          } else if (ticket.ticketType === 'seller' && ticket.sellerId) {
            const seller = await User.findById(ticket.sellerId).select('name email businessName')
            if (seller?.email) {
              const sellerPanelUrl = process.env.SELLER_PANEL_URL
            const ticketUrl = sellerPanelUrl ? `${sellerPanelUrl}/tickets` : null
              await sendEmail(
                seller.email,
                `Ticket #${ticket.ticketNumber} has been closed`,
                emailTemplates.ticketMessageNotification(
                  seller.businessName || seller.name || 'Seller',
                  ticket.ticketNumber || '',
                  ticket.subject,
                  closedBy,
                  populatedMessage.message,
                  ticketUrl,
                  'seller',
                ),
              )
            }
          }
        } catch (emailError) {
          console.error('Error sending ticket closure email:', emailError)
        }
      }
    }

    // Send email notification for other status changes (not closed)
    if (previousStatus !== status && status !== 'closed' && populatedTicket) {
      try {
        if (ticket.ticketType === 'customer' && ticket.customerId) {
          const customer = populatedTicket.customerId as { name?: string; email?: string } | undefined
          if (customer?.email) {
            const frontendUrl = process.env.FRONTEND_URL
            const ticketUrl = frontendUrl ? `${frontendUrl}/help/tickets/${id}` : null
            const statusLabels: Record<string, string> = {
              'in-progress': 'In Progress',
              resolved: 'Resolved',
              open: 'Open',
            }
            await sendEmail(
              customer.email,
              `Ticket #${ticket.ticketNumber} status updated`,
              emailTemplates.ticketMessageNotification(
                customer.name || 'Customer',
                ticket.ticketNumber || '',
                ticket.subject,
                'Support Team',
                `Your ticket status has been updated to ${statusLabels[status] || status}.`,
                ticketUrl,
                'customer',
              ),
            )
          }
        }
      } catch (emailError) {
        console.error('Error sending status update email to customer:', emailError)
      }
    }

    // Notify about status change
    if (status === 'closed') {
      const ownerId =
        ticket.ticketType === 'customer'
          ? ticket.customerId?.toString()
          : ticket.sellerId?.toString()
      if (ownerId) {
        io.to(`user:${ownerId}`).emit('ticket:statusUpdate', {
          ticketId: id,
          status: 'closed',
          reason:
            userRole === 'super-admin' || userRole === 'support'
              ? 'admin'
              : ticket.ticketType === 'seller'
              ? 'seller'
              : 'customer',
        })
      }
    }

    res.json(populatedTicket)
  } catch (err) {
    console.error('Error updating ticket status:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Update ticket priority
export const updateTicketPriority = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { id } = req.params
    const { priority } = req.body as { priority: string }

    const ticket = await Ticket.findById(id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    // Only admins can update priority
    if (userRole !== 'super-admin') {
      const assignedToStr = ticket.assignedTo?.toString()
      const createdByStr = ticket.createdBy?.toString()
      if (assignedToStr !== userId && createdByStr !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    ticket.priority = priority as 'low' | 'medium' | 'high' | 'urgent'
    ticket.lastActivityAt = new Date()
    await ticket.save()

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('customerId', 'name email')
      .populate('sellerId', 'name email businessName')
      .populate('assignedTo', 'name email')
      .populate('orderId')
      .populate('ledgerEntryId')
      .populate('settlementBatchId')
      .populate('refundRequestId')
      .populate('createdBy', 'name email')

    res.json(populatedTicket)
  } catch (err) {
    console.error('Error updating ticket priority:', err)
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
    const ticket = await Ticket.findById(id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    // Check access:
    // - Customer can mark messages as read in their own tickets
    // - Super-admin can mark messages as read in any ticket
    // - Other admin users can mark messages as read in tickets assigned to them or created by them
    const customerIdStr = ticket.customerId?.toString()
    const sellerIdStr = ticket.sellerId?.toString()
    const assignedToStr = ticket.assignedTo?.toString()
    const createdByStr = ticket.createdBy?.toString()

    if (userRole !== 'super-admin' && userRole !== 'support') {
      const isOwner =
        (ticket.ticketType === 'customer' && customerIdStr === userId) ||
        (ticket.ticketType === 'seller' && sellerIdStr === userId)

      if (!isOwner && assignedToStr !== userId && createdByStr !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    // Mark unread messages as read (messages not sent by current user)
    await TicketMessage.updateMany(
      {
        ticketId: id,
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

// Customer: Rate ticket and provide feedback
export const rateTicket = async (req: Request, res: Response) => {
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

    const ticket = await Ticket.findById(id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    const isOwner =
      (ticket.ticketType === 'customer' && ticket.customerId?.toString() === userId) ||
      (ticket.ticketType === 'seller' && ticket.sellerId?.toString() === userId)

    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' })
    }

    ticket.customerSatisfaction = satisfaction
    if (feedback) ticket.customerFeedback = feedback
    ticket.lastActivityAt = new Date()
    await ticket.save()

    res.json({ message: 'Rating recorded', ticket })
  } catch (err) {
    console.error('Error rating ticket:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin: Send system message (one-way, no reply expected)
export const sendSystemMessage = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    const userRole = req.user?.role
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    // Only admins and support staff can send system messages
    if (userRole !== 'super-admin' && userRole !== 'support') {
      return res.status(403).json({
        error: 'Only admins and support staff can send system messages',
      })
    }

    const { id } = req.params
    const { message } = req.body as {
      message: string
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const ticket = await Ticket.findById(id)
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' })
    }

    // Create system message (one-way, informational only - seller/customer cannot reply directly to system messages)
    // System messages are for notifications, updates, and informational announcements
    const systemMessage = await TicketMessage.create({
      ticketId: id,
      senderId: userId,
      senderRole: userRole === 'super-admin' ? 'super-admin' : 'support',
      message: message.trim(),
      isSystemMessage: true,
      read: false,
    })

    ticket.messages.push(systemMessage._id as mongoose.Types.ObjectId)
    ticket.lastMessageAt = new Date()
    ticket.lastActivityAt = new Date()
    await ticket.save()

    const populatedMessage = await TicketMessage.findById(systemMessage._id).populate(
      'senderId',
      'name email',
    )

    if (!populatedMessage) {
      return res.status(500).json({ error: 'Failed to create system message' })
    }

    // Notify ticket owner
    if (ticket.ticketType === 'customer' && ticket.customerId) {
      io.to(`user:${ticket.customerId.toString()}`).emit('ticket:message', {
        ticketId: id,
        message: populatedMessage,
      })
    } else if (ticket.ticketType === 'seller' && ticket.sellerId) {
      io.to(`user:${ticket.sellerId.toString()}`).emit('ticket:message', {
        ticketId: id,
        message: populatedMessage,
      })
    }

    res.status(201).json(populatedMessage)
  } catch (err) {
    console.error('Error sending system message:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Upload ticket attachments
export const uploadTicketAttachments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const files = req.files as Express.Multer.File[]
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' })
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      const fileName = `tickets/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const url = await uploadToR2(file.buffer, fileName, file.mimetype, 'tickets')
      uploadedUrls.push(url)
    }

    res.json({ urls: uploadedUrls })
  } catch (err) {
    console.error('Error uploading ticket attachments:', err)
    res.status(500).json({ error: 'Failed to upload attachments' })
  }
}
