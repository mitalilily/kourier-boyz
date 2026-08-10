import mongoose from 'mongoose'
import Notification from '../models/Notification'
import User from '../models/User'
import { io } from '../server'
import { emailTemplates, sendEmail } from './email'

export interface SellerNotificationData {
  sellerId: string | mongoose.Types.ObjectId
  title: string
  message: string
  link?: string
  type?: 'order' | 'promotional' | 'newsletter' | 'system' | 'other'
}

/**
 * Create a seller notification and emit via socket
 * Notifications are informational and calm, avoiding internal codes or admin identity
 */
export const createSellerNotification = async (data: SellerNotificationData): Promise<void> => {
  try {
    const sellerObjectId =
      typeof data.sellerId === 'string' ? new mongoose.Types.ObjectId(data.sellerId) : data.sellerId

    const notification = await Notification.create({
      userId: sellerObjectId,
      title: data.title,
      message: data.message,
      type: data.type || 'system',
      link: data.link,
      read: false,
    })

    // Emit real-time notification via socket
    // Convert ObjectId to string for socket room (must match how seller registers)
    const sellerIdStr = String(sellerObjectId)
    const socketRoom = `user:${sellerIdStr}`
    
    console.log(`[NOTIFICATION] Emitting to socket room: ${socketRoom} for notification ${notification._id}`)
    
    const socketPayload = {
      id: String(notification._id),
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link || undefined,
      createdAt: notification.createdAt.toISOString(),
      read: notification.read,
    }
    
    // Emit to the specific user's room
    io.to(socketRoom).emit('notification:new', socketPayload)
    
    console.log(`[NOTIFICATION] Socket event emitted successfully to ${socketRoom}`)
  } catch (error) {
    // Log but don't fail the operation
    console.error('Error creating seller notification:', error)
  }
}

/**
 * Notify seller about refund
 */
export const notifySellerRefund = async (
  sellerId: string | mongoose.Types.ObjectId,
  orderNumber: string,
  refundAmount: number,
  orderId: string,
): Promise<void> => {
  await createSellerNotification({
    sellerId,
    title: 'Refund Processed',
    message: `A refund of ₹${refundAmount.toFixed(
      2,
    )} has been processed for order ${orderNumber}. This will be reflected in your ledger.`,
    link: `/orders/${orderId}`,
    type: 'system',
  })
}

/**
 * Notify seller about return
 */
export const notifySellerReturn = async (
  sellerId: string | mongoose.Types.ObjectId,
  orderNumber: string,
  returnId: string,
): Promise<void> => {
  await createSellerNotification({
    sellerId,
    title: 'Return Received',
    message: `A return has been received for order ${orderNumber}. The adjustments will be reflected in your ledger.`,
    link: `/returns/${returnId}`,
    type: 'system',
  })
}

/**
 * Notify seller about manual adjustment
 */
export const notifySellerAdjustment = async (
  sellerId: string | mongoose.Types.ObjectId,
  adjustmentType: 'credit' | 'debit',
  amount: number,
  description?: string,
): Promise<void> => {
  try {
    const typeLabel = adjustmentType === 'credit' ? 'Credit' : 'Debit'
    const action = adjustmentType === 'credit' ? 'added to' : 'deducted from'

    console.log(`[NOTIFICATION] Creating adjustment notification for seller ${sellerId}, amount: ₹${amount}`)

    await createSellerNotification({
      sellerId,
      title: 'Account Adjustment',
      message: `A ${typeLabel.toLowerCase()} adjustment of ₹${amount.toFixed(
        2,
      )} has been ${action} your account.${
        description ? ` ${description}` : ''
      } This will be reflected in your ledger.`,
      link: '/ledger',
      type: 'system',
    })

    console.log(`[NOTIFICATION] Adjustment notification created successfully for seller ${sellerId}`)
  } catch (error) {
    console.error(`[NOTIFICATION] Failed to create adjustment notification for seller ${sellerId}:`, error)
    throw error // Re-throw so caller knows it failed
  }
}

/**
 * Notify seller about negative balance
 */
export const notifySellerNegativeBalance = async (
  sellerId: string | mongoose.Types.ObjectId,
  balance: number,
): Promise<void> => {
  await createSellerNotification({
    sellerId,
    title: 'Account Balance Update',
    message: `Your account balance is now ₹${Math.abs(balance).toFixed(
      2,
    )}. This amount will be adjusted in your next settlement payout.`,
    link: '/ledger',
    type: 'system',
  })
}

/**
 * Notify seller about settlement generation (MUST HAVE - sends email + in-app notification)
 */
export const notifySellerSettlementGenerated = async (
  sellerId: string | mongoose.Types.ObjectId,
  batchId: string,
  fromDate: Date,
  toDate: Date,
  netPayout: number,
): Promise<void> => {
  const period = `${fromDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })} - ${toDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // In-app notification
  if (netPayout > 0) {
    await createSellerNotification({
      sellerId,
      title: 'Settlement Ready',
      message: `Your settlement for ${period} is ready. Net payout: ₹${netPayout.toFixed(2)}.`,
      link: `/settlements/${batchId}`,
      type: 'system',
    })
  } else if (netPayout < 0) {
    await createSellerNotification({
      sellerId,
      title: 'Settlement Generated',
      message: `Your settlement for ${period} has been generated. The balance of ₹${Math.abs(
        netPayout,
      ).toFixed(2)} will be adjusted in your next settlement.`,
      link: `/settlements/${batchId}`,
      type: 'system',
    })
  } else {
    await createSellerNotification({
      sellerId,
      title: 'Settlement Generated',
      message: `Your settlement for ${period} has been generated with zero balance.`,
      link: `/settlements/${batchId}`,
      type: 'system',
    })
  }

  // EMAIL: Settlement Generated (MUST HAVE)
  try {
    const seller = await User.findById(sellerId)
      .select('name businessName email supportEmail')
      .lean()
    if (!seller) return

    const sellerEmail = (seller as any).supportEmail || (seller as any).email
    const sellerName = (seller as any).businessName || (seller as any).name || 'Seller'
    const settlementUrl = `${
      process.env.SELLER_PANEL_URL || 'http://localhost:5175'
    }/settlements/${batchId}`

    if (sellerEmail) {
      const subject = `Your settlement for ${period} is ready`
      const html = emailTemplates.sellerSettlementGenerated(sellerName, {
        period,
        netPayout,
        settlementUrl,
      })
      await sendEmail(sellerEmail, subject, html)
    }
  } catch (emailError) {
    // Log but don't fail the operation
    console.error('Failed to send settlement generated email:', emailError)
  }
}

/**
 * Notify seller about settlement payout (CRITICAL - sends email + in-app notification)
 */
export const notifySellerSettlementPaid = async (
  sellerId: string | mongoose.Types.ObjectId,
  batchId: string,
  payoutAmount: number,
  payoutDate: string,
  period?: string,
  payoutReference?: string,
): Promise<void> => {
  // In-app notification
  await createSellerNotification({
    sellerId,
    title: 'Payment Processed',
    message: `Your settlement payment of ₹${payoutAmount.toFixed(
      2,
    )} has been processed on ${new Date(payoutDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}.`,
    link: `/settlements/${batchId}`,
    type: 'system',
  })

  // EMAIL: Settlement Paid / Payout Completed (CRITICAL)
  try {
    const seller = await User.findById(sellerId)
      .select('name businessName email supportEmail')
      .lean()
    if (!seller) return

    const sellerEmail = (seller as any).supportEmail || (seller as any).email
    const sellerName = (seller as any).businessName || (seller as any).name || 'Seller'
    const settlementUrl = `${
      process.env.SELLER_PANEL_URL || 'http://localhost:5175'
    }/settlements/${batchId}`

    if (sellerEmail) {
      const subject = `₹${payoutAmount.toFixed(2)} transferred to your bank account`
      const html = emailTemplates.sellerSettlementPaid(sellerName, {
        payoutAmount,
        period: period || 'Recent period',
        payoutDate,
        payoutReference,
        settlementUrl,
      })
      await sendEmail(sellerEmail, subject, html)
    }
  } catch (emailError) {
    // Log but don't fail the operation
    console.error('Failed to send settlement paid email:', emailError)
  }
}

/**
 * Notify seller about settlement skipped due to negative balance (IMPORTANT - sends email + in-app notification)
 */
export const notifySellerSettlementSkipped = async (
  sellerId: string | mongoose.Types.ObjectId,
  balance: number,
): Promise<void> => {
  // In-app notification
  await createSellerNotification({
    sellerId,
    title: 'Settlement Update',
    message: `Your settlement cycle was skipped due to a negative balance of ₹${Math.abs(
      balance,
    ).toFixed(2)}. This amount will be adjusted in your next settlement.`,
    link: '/ledger',
    type: 'system',
  })

  // EMAIL: Settlement Skipped (IMPORTANT)
  try {
    const seller = await User.findById(sellerId)
      .select('name businessName email supportEmail')
      .lean()
    if (!seller) return

    const sellerEmail = (seller as any).supportEmail || (seller as any).email
    const sellerName = (seller as any).businessName || (seller as any).name || 'Seller'
    const ledgerUrl = `${process.env.SELLER_PANEL_URL || 'http://localhost:5175'}/ledger`

    if (sellerEmail) {
      const subject = 'No payout for your latest settlement'
      const html = emailTemplates.sellerSettlementSkipped(sellerName, {
        balance,
        ledgerUrl,
      })
      await sendEmail(sellerEmail, subject, html)
    }
  } catch (emailError) {
    // Log but don't fail the operation
    console.error('Failed to send settlement skipped email:', emailError)
  }
}

/**
 * Notify seller about large adjustment/refund (OPTIONAL BUT RECOMMENDED - sends email if threshold exceeded)
 */
export const notifySellerLargeAdjustment = async (
  sellerId: string | mongoose.Types.ObjectId,
  amount: number,
  adjustmentType: 'credit' | 'debit' | 'refund',
  description?: string,
  threshold: number = 5000,
): Promise<void> => {
  // Only send email if amount exceeds threshold
  if (Math.abs(amount) < threshold) {
    console.log(
      `[NOTIFICATION] Large adjustment email skipped: amount ₹${Math.abs(amount)} < threshold ₹${threshold}`,
    )
    return
  }

  try {
    console.log(
      `[NOTIFICATION] Sending large adjustment email for seller ${sellerId}, amount: ₹${Math.abs(amount)}`,
    )

    const seller = await User.findById(sellerId)
      .select('name businessName email supportEmail')
      .lean()
    if (!seller) {
      console.error(`[NOTIFICATION] Seller not found: ${sellerId}`)
      return
    }

    const sellerEmail = (seller as any).supportEmail || (seller as any).email
    const sellerName = (seller as any).businessName || (seller as any).name || 'Seller'
    const ledgerUrl = `${process.env.SELLER_PANEL_URL || 'http://localhost:5175'}/ledger`

    if (!sellerEmail) {
      console.error(`[NOTIFICATION] No email found for seller ${sellerId}`)
      return
    }

    console.log(`[NOTIFICATION] Sending email to ${sellerEmail} for seller ${sellerId}`)

    const subject = 'A large adjustment has been applied to your account'
    const html = emailTemplates.sellerLargeAdjustment(sellerName, {
      amount: Math.abs(amount),
      adjustmentType,
      description,
      ledgerUrl,
    })
    const emailResult = await sendEmail(sellerEmail, subject, html)

    if (emailResult.success) {
      console.log(`[NOTIFICATION] Large adjustment email sent successfully to ${sellerEmail}`)
    } else {
      console.error(`[NOTIFICATION] Failed to send large adjustment email:`, emailResult)
    }
  } catch (emailError) {
    // Log but don't fail the operation
    console.error(`[NOTIFICATION] Error sending large adjustment email for seller ${sellerId}:`, emailError)
  }
}
