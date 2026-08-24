import mongoose from 'mongoose'
import Ticket, { TicketMessage } from '../models/Ticket'
import User from '../models/User'
import { io } from '../server'
import { emailTemplates, sendEmail } from './email'

interface SystemMessageOptions {
  ticketId: string
  message: string
  senderRole?: 'super-admin' | 'support'
  senderId?: mongoose.Types.ObjectId | string
}

/**
 * Automatically create a system message in a ticket
 * Used for automated notifications when events occur (settlements paid, refunds processed, etc.)
 */
export const createAutomatedSystemMessage = async ({
  ticketId,
  message,
  senderRole = 'support',
  senderId,
}: SystemMessageOptions): Promise<void> => {
  try {
    const ticket = await Ticket.findById(ticketId)
    if (!ticket) {
      console.warn(`Ticket ${ticketId} not found for automated system message`)
      return
    }

    // Use system user ID if not provided (for automated messages)
    let systemUserId = senderId
    if (!systemUserId) {
      const systemUser = await User.findOne({ role: 'super-admin' }).select('_id').lean()
      systemUserId = systemUser?._id
    }

    if (!systemUserId) {
      console.warn('No system user found for automated system message')
      return
    }

    // Create system message
    const systemMessage = await TicketMessage.create({
      ticketId,
      senderId: systemUserId,
      senderRole,
      message: message.trim(),
      isSystemMessage: true,
      read: false,
    })

    // Update ticket
    ticket.messages.push(systemMessage._id as mongoose.Types.ObjectId)
    ticket.lastMessageAt = new Date()
    ticket.lastActivityAt = new Date()
    await ticket.save()

    // Notify ticket owner via socket and email
    const populatedMessage = await TicketMessage.findById(systemMessage._id).populate(
      'senderId',
      'name email',
    )

    if (ticket.ticketType === 'customer' && ticket.customerId) {
      if (populatedMessage) {
        io.to(`user:${ticket.customerId.toString()}`).emit('ticket:message', {
          ticketId,
          message: populatedMessage,
        })
      }

      // Send email notification
      try {
        const customer = await User.findById(ticket.customerId).select('name email')
        if (customer?.email && populatedMessage) {
          const ticketUrl = `${
            process.env.FRONTEND_URL || 'http://localhost:5173'
          }/help/tickets/${ticketId}`
          await sendEmail(
            customer.email,
            `System update on ticket #${ticket.ticketNumber || ''}`,
            emailTemplates.ticketMessageNotification(
              customer.name || 'Customer',
              ticket.ticketNumber || '',
              ticket.subject,
              'System',
              message,
              ticketUrl,
              'customer',
            ),
          )
        }
      } catch (emailError) {
        console.error('Error sending system message email to customer:', emailError)
      }
    } else if (ticket.ticketType === 'seller' && ticket.sellerId) {
      if (populatedMessage) {
        io.to(`user:${ticket.sellerId.toString()}`).emit('ticket:message', {
          ticketId,
          message: populatedMessage,
        })
      }

      // Send email notification
      try {
        const seller = await User.findById(ticket.sellerId).select('name email businessName')
        if (seller?.email && populatedMessage) {
          const ticketUrl = `${process.env.SELLER_PANEL_URL || 'http://localhost:5175'}/tickets`
          await sendEmail(
            seller.email,
            `System update on ticket #${ticket.ticketNumber || ''}`,
            emailTemplates.ticketMessageNotification(
              seller.businessName || seller.name || 'Seller',
              ticket.ticketNumber || '',
              ticket.subject,
              'System',
              message,
              ticketUrl,
              'seller',
            ),
          )
        }
      } catch (emailError) {
        console.error('Error sending system message email to seller:', emailError)
      }
    }
  } catch (error) {
    console.error('Error creating automated system message:', error)
    // Don't throw - automated messages shouldn't break the main flow
  }
}

/**
 * Find tickets linked to an entity and send automated system messages
 */
export const notifyLinkedTickets = async (
  entityType: 'order' | 'settlement' | 'refund' | 'ledger',
  entityId: mongoose.Types.ObjectId | string,
  message: string,
): Promise<void> => {
  try {
    const query: any = {}
    switch (entityType) {
      case 'order':
        query.orderId = entityId
        break
      case 'settlement':
        query.settlementBatchId = entityId
        break
      case 'refund':
        query.refundRequestId = entityId
        break
      case 'ledger':
        query.ledgerEntryId = entityId
        break
    }

    const linkedTickets = await Ticket.find(query).select('_id').lean()

    for (const ticket of linkedTickets) {
      if (ticket._id) {
        await createAutomatedSystemMessage({
          ticketId: ticket._id.toString(),
          message,
        })
      }
    }
  } catch (error) {
    console.error(`Error notifying linked tickets for ${entityType}:`, error)
  }
}
