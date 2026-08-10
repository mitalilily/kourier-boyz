import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Order from '../models/Order'
import User from '../models/User'
import { extractClientIp } from '../utils/adminActivity'
import { sendEmail, emailTemplates } from '../utils/email'
import { encryptPhone } from '../utils/phoneEncryption'

// Data masking utilities
const maskEmail = (email: string): string => {
  const [localPart, domain] = email.split('@')
  if (!domain) return email
  const maskedLocal = localPart.slice(0, 2) + '***' + localPart.slice(-1)
  return `${maskedLocal}@${domain}`
}

const maskPhone = (phone?: string): string | undefined => {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  const lastFour = digits.slice(-4)
  return `***${lastFour}`
}

const hashEmail = (email: string): string => {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 16)
}

// Mask buyer personal data
const maskBuyerData = (user: any) => {
  if (user.buyerLifecycleStatus !== 'DEACTIVATED') {
    return user
  }

  const masked = user.toObject ? user.toObject() : { ...user }
  
  // Mask personal information
  masked.name = 'Deactivated User'
  masked.email = masked.originalEmail ? maskEmail(masked.originalEmail) : maskEmail(masked.email)
  masked.phone = maskPhone(masked.phone)
  
  // Store original email hash for reference (if not already stored)
  if (!masked.emailHash && masked.originalEmail) {
    masked.emailHash = hashEmail(masked.originalEmail)
  }

  return masked
}

// Request deactivation (step 1: buyer initiates)
export const requestBuyerDeactivation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    const { password, otp } = req.body

    const user = await User.findById(userId)
    if (!user || user.role !== 'customer') {
      return res.status(404).json({ error: 'Buyer account not found' })
    }

    if (user.buyerLifecycleStatus === 'DEACTIVATED') {
      return res.status(400).json({
        error: 'ACCOUNT_ALREADY_DEACTIVATED',
        message: 'Your account is already deactivated.',
      })
    }

    // Verify password or OTP
    if (password) {
      const isMatch = await user.comparePassword(password)
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid password' })
      }
    } else if (otp) {
      // If OTP verification is needed, check it here
      // For now, we'll use password confirmation
      return res.status(400).json({ error: 'Password confirmation required' })
    } else {
      return res.status(400).json({ error: 'Password or OTP is required' })
    }

    // Store original email, name, and phone before masking (if not already stored)
    if (!user.originalEmail) {
      user.originalEmail = user.email
    }
    if (!user.originalName) {
      user.originalName = user.name
    }
    if (!(user as any).originalPhone && user.phone) {
      ;(user as any).originalPhone = user.phone
    }
    if (!user.emailHash) {
      user.emailHash = hashEmail(user.email)
    }

    // Deactivate the account immediately (password already verified)
    user.buyerLifecycleStatus = 'DEACTIVATED'
    user.buyerDeactivatedAt = new Date()
    user.buyerDeactivationRequestedAt = new Date()

    // Mask personal data
    user.name = 'Deactivated User'
    user.email = maskEmail(user.originalEmail)
    if (user.phone) {
      // Phone is already encrypted in database, no need to mask
      // Encryption provides security, and decryption is handled by getDecryptedPhone()
    }

    // Increment session version to invalidate all existing sessions
    user.sessionVersion = (user.sessionVersion || 0) + 1

    await user.save()

    // Send confirmation email to original email (before masking)
    try {
      await sendEmail(
        user.originalEmail,
        'Account Deactivated - Kourier Boyz',
        emailTemplates.buyerDeactivationConfirmed(user.originalEmail),
      )
    } catch (emailErr) {
      console.error('Error sending deactivation confirmation email:', emailErr)
    }

    res.json({
      message:
        'Your account has been deactivated. You will not be able to log in. Your order history and invoices remain accessible for record-keeping purposes.',
      deactivated: true,
    })
  } catch (err: any) {
    console.error('Error requesting buyer deactivation:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

// Confirm deactivation (step 2: final confirmation)
export const confirmBuyerDeactivation = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    const { reason } = req.body

    const user = await User.findById(userId)
    if (!user || user.role !== 'customer') {
      return res.status(404).json({ error: 'Buyer account not found' })
    }

    if (user.buyerLifecycleStatus !== 'DEACTIVATION_REQUESTED') {
      return res.status(400).json({
        error: 'No pending deactivation request',
        message: 'Please request deactivation first.',
      })
    }

    // Store original email, name, and phone before masking (if not already stored)
    if (!user.originalEmail) {
      user.originalEmail = user.email
    }
    if (!user.originalName) {
      user.originalName = user.name
    }
    if (!(user as any).originalPhone && user.phone) {
      ;(user as any).originalPhone = user.phone
    }
    if (!user.emailHash) {
      user.emailHash = hashEmail(user.email)
    }

    // Deactivate the account
    user.buyerLifecycleStatus = 'DEACTIVATED'
    user.buyerDeactivatedAt = new Date()
    if (reason) {
      user.buyerDeactivationReason = reason
    }

    // Mask personal data
    user.name = 'Deactivated User'
    user.email = maskEmail(user.originalEmail)
    if (user.phone) {
      // Phone is already encrypted in database, no need to mask
      // Encryption provides security, and decryption is handled by getDecryptedPhone()
    }

    // Increment session version to invalidate all existing sessions
    user.sessionVersion = (user.sessionVersion || 0) + 1

    await user.save()

    // Send confirmation email to original email (before masking)
    try {
      await sendEmail(
        user.originalEmail,
        'Account Deactivated - Kourier Boyz',
        emailTemplates.buyerDeactivationConfirmed(user.originalEmail),
      )
    } catch (emailErr) {
      console.error('Error sending deactivation confirmation email:', emailErr)
    }

    res.json({
      message:
        'Your account has been deactivated. You will not be able to log in. Your order history and invoices remain accessible for record-keeping purposes.',
      deactivated: true,
    })
  } catch (err: any) {
    console.error('Error deactivating buyer account:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

// Admin: Deactivate buyer (admin can deactivate any buyer)
export const adminDeactivateBuyer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const adminUserId = (req as any).user.userId
    const { reason } = req.body

    // Only admins can deactivate buyers
    if ((req as any).user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only administrators can perform this action' })
    }

    const user = await User.findById(id)
    if (!user || user.role !== 'customer') {
      return res.status(404).json({ error: 'Buyer account not found' })
    }

    if (user.buyerLifecycleStatus === 'DEACTIVATED') {
      return res.status(400).json({
        error: 'Account already deactivated',
        message: 'This buyer account is already deactivated.',
      })
    }

    // Store original email, name, and phone before masking (if not already stored)
    if (!user.originalEmail) {
      user.originalEmail = user.email
    }
    if (!user.originalName) {
      user.originalName = user.name
    }
    if (!(user as any).originalPhone && user.phone) {
      ;(user as any).originalPhone = user.phone
    }
    if (!user.emailHash) {
      user.emailHash = hashEmail(user.email)
    }

    // Deactivate the account
    user.buyerLifecycleStatus = 'DEACTIVATED'
    user.buyerDeactivatedAt = new Date()
    if (reason) {
      user.buyerDeactivationReason = reason
    }

    // Mask personal data
    user.name = 'Deactivated User'
    user.email = maskEmail(user.originalEmail)
    if (user.phone) {
      // Phone is already encrypted in database, no need to mask
      // Encryption provides security, and decryption is handled by getDecryptedPhone()
    }

    // Increment session version to invalidate all existing sessions
    user.sessionVersion = (user.sessionVersion || 0) + 1

    await user.save()

    // Log admin activity
    const { recordAdminActivity } = await import('../utils/adminActivity')
    await recordAdminActivity({
      userId: adminUserId.toString(),
      email: (req as any).user.email,
      action: 'buyer_deactivate',
      status: 'success',
      ipAddress: extractClientIp(req),
      userAgent: req.headers['user-agent'],
      metadata: {
        deactivatedBuyerId: id,
        deactivatedBuyerEmail: user.originalEmail,
        reason,
      },
    })

    res.json({
      message: 'Buyer account has been deactivated successfully.',
      deactivated: true,
    })
  } catch (err: any) {
    console.error('Error deactivating buyer account (admin):', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

// Admin: Reactivate buyer
export const adminReactivateBuyer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const adminUserId = (req as any).user.userId

    // Only admins can reactivate buyers
    if ((req as any).user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only administrators can perform this action' })
    }

    const user = await User.findById(id)
    if (!user || user.role !== 'customer') {
      return res.status(404).json({ error: 'Buyer account not found' })
    }

    if (user.buyerLifecycleStatus !== 'DEACTIVATED') {
      return res.status(400).json({
        error: 'Account is not deactivated',
        message: 'This account is not currently deactivated.',
      })
    }

    // Restore original email and name if available
    if (user.originalEmail) {
      user.email = user.originalEmail
      user.originalEmail = undefined
    }
    if (user.originalName) {
      user.name = user.originalName
      user.originalName = undefined
    }
    user.emailHash = undefined

    // Reactivate
    user.buyerLifecycleStatus = 'ACTIVE'
    user.buyerDeactivatedAt = undefined
    user.buyerDeactivationRequestedAt = undefined
    user.buyerDeactivationReason = undefined

    // Increment session version
    user.sessionVersion = (user.sessionVersion || 0) + 1

    await user.save()

    // Log admin activity
    const { recordAdminActivity } = await import('../utils/adminActivity')
    await recordAdminActivity({
      userId: adminUserId.toString(),
      email: (req as any).user.email,
      action: 'buyer_reactivate',
      status: 'success',
      ipAddress: extractClientIp(req),
      userAgent: req.headers['user-agent'],
      metadata: {
        reactivatedBuyerId: id,
        reactivatedBuyerEmail: user.email,
      },
    })

    res.json({
      message: 'Buyer account has been reactivated successfully.',
      reactivated: true,
    })
  } catch (err: any) {
    console.error('Error reactivating buyer account (admin):', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

// Reactivate buyer account
export const reactivateBuyer = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId || req.params.id
    const isAdmin = (req as any).user?.role === 'super-admin'

    // Only allow self-reactivation if not deactivated, or admin can reactivate any
    if (!isAdmin && !(req as any).user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const user = await User.findById(userId)
    if (!user || user.role !== 'customer') {
      return res.status(404).json({ error: 'Buyer account not found' })
    }

    if (user.buyerLifecycleStatus !== 'DEACTIVATED') {
      return res.status(400).json({
        error: 'Account is not deactivated',
        message: 'This account is not currently deactivated.',
      })
    }

    // Restore original email and name if available
    if (user.originalEmail) {
      user.email = user.originalEmail
      user.originalEmail = undefined
    }
    if (user.originalName) {
      user.name = user.originalName
      user.originalName = undefined
    }
    user.emailHash = undefined

    // Reactivate
    user.buyerLifecycleStatus = 'ACTIVE'
    user.buyerDeactivatedAt = undefined
    user.buyerDeactivationRequestedAt = undefined
    user.buyerDeactivationReason = undefined

    // Increment session version
    user.sessionVersion = (user.sessionVersion || 0) + 1

    await user.save()

    // Log admin activity if admin performed reactivation
    if (isAdmin) {
      const { recordAdminActivity } = await import('../utils/adminActivity')
      await recordAdminActivity({
        userId: (req as any).user.userId.toString(),
        email: (req as any).user.email,
        action: 'buyer_reactivate',
        status: 'success',
        ipAddress: extractClientIp(req),
        userAgent: req.headers['user-agent'],
        metadata: {
          reactivatedBuyerId: userId,
          reactivatedBuyerEmail: user.email,
        },
      })
    }

    res.json({
      message: 'Buyer account has been reactivated successfully.',
      reactivated: true,
    })
  } catch (err: any) {
    console.error('Error reactivating buyer:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

// Hard delete buyer (only if no orders/payments/invoices)
export const hardDeleteBuyer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const adminUserId = (req as any).user.userId

    // Only admins can hard delete
    if ((req as any).user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only administrators can perform this action' })
    }

    const user = await User.findById(id)
    if (!user || user.role !== 'customer') {
      return res.status(404).json({ error: 'Buyer account not found' })
    }

    // Check for orders
    const orderCount = await Order.countDocuments({ user: user._id })
    if (orderCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete buyer with orders',
        message: `This buyer has ${orderCount} order(s). Hard deletion is only allowed for buyers with no orders, payments, or invoices.`,
        orderCount,
      })
    }

    // Check for payments (if you have a Payment model)
    // const paymentCount = await Payment.countDocuments({ user: user._id })
    // if (paymentCount > 0) {
    //   return res.status(400).json({
    //     error: 'Cannot delete buyer with payments',
    //     message: `This buyer has ${paymentCount} payment record(s). Hard deletion is not allowed.`,
    //   })
    // }

    // Check for invoices (orders contain invoices, so if orderCount is 0, invoice count should be 0 too)
    // But if you have separate Invoice model, check it here

    // Log before deletion
    const { recordAdminActivity } = await import('../utils/adminActivity')
    await recordAdminActivity({
      userId: adminUserId.toString(),
      email: (req as any).user.email,
      action: 'buyer_hard_delete',
      status: 'success',
      ipAddress: extractClientIp(req),
      userAgent: req.headers['user-agent'],
      metadata: {
        deletedBuyerId: id,
        deletedBuyerEmail: user.email || user.originalEmail,
      },
    })

    // Delete the user
    await User.findByIdAndDelete(id)

    res.json({
      message: 'Buyer account has been permanently deleted.',
      deleted: true,
    })
  } catch (err: any) {
    console.error('Error hard deleting buyer:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

// Get buyer deactivation status (for buyer)
export const getBuyerDeactivationStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId

    const user = await User.findById(userId).select(
      'buyerLifecycleStatus buyerDeactivationRequestedAt buyerDeactivatedAt buyerDeactivationReason role',
    )

    if (!user || user.role !== 'customer') {
      return res.status(404).json({ error: 'Buyer account not found' })
    }

    res.json({
      status: user.buyerLifecycleStatus || 'ACTIVE',
      deactivationRequestedAt: user.buyerDeactivationRequestedAt,
      deactivatedAt: user.buyerDeactivatedAt,
      deactivationReason: user.buyerDeactivationReason,
    })
  } catch (err: any) {
    console.error('Error getting buyer deactivation status:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

