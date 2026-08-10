import mongoose from 'mongoose'
import Notification from '../models/Notification'
import User from '../models/User'
import { io } from '../server'

export interface AdminNotificationData {
  title: string
  message: string
  link?: string
  type?: 'order' | 'promotional' | 'newsletter' | 'system' | 'other'
}

/**
 * Create notifications for all super-admin users and emit via socket
 */
export const createAdminNotification = async (data: AdminNotificationData): Promise<void> => {
  try {
    // Find all super-admin users
    const superAdmins = await User.find({ role: 'super-admin' })
      .select('_id')
      .lean()

    if (superAdmins.length === 0) {
      console.warn('[ADMIN NOTIFICATION] No super-admin users found')
      return
    }

    // Create notifications for all super-admins
    const notificationDocs = await Promise.all(
      superAdmins.map((admin) =>
        Notification.create({
          userId: admin._id,
          title: data.title,
          message: data.message,
          type: data.type || 'system',
          link: data.link,
          read: false,
        }),
      ),
    )

    // Emit real-time notification via socket to super-admin room
    const socketPayload = {
      id: notificationDocs[0]?._id?.toString() || 'unknown',
      title: data.title,
      message: data.message,
      type: data.type || 'system',
      link: data.link || undefined,
      createdAt: new Date().toISOString(),
      read: false,
    }

    io.to('super-admin').emit('notification:new', socketPayload)

    console.log(`[ADMIN NOTIFICATION] Created ${notificationDocs.length} admin notification(s)`)
  } catch (error) {
    // Log but don't fail the operation
    console.error('Error creating admin notification:', error)
  }
}

/**
 * Notify admins about products requiring approval due to certificate expiry
 */
export const notifyAdminCertificateExpiry = async (
  sellerId: string | mongoose.Types.ObjectId,
  sellerName: string,
  certificateType: string,
  affectedProductCount: number,
): Promise<void> => {
  const sellerIdStr = String(sellerId)
  const certificateLabel = certificateType
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ')

  await createAdminNotification({
    title: 'Certificate Expired - Products Require Approval',
    message: `${sellerName}'s ${certificateLabel} certificate has expired. ${affectedProductCount} product(s) have been moved to pending approval.`,
    link: `/admin/products?status=pending_approval&seller=${sellerIdStr}`,
    type: 'system',
  })
}

