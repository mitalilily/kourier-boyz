import bcrypt from 'bcryptjs'
import { Request, Response } from 'express'
import AdminActivityLog from '../models/AdminActivityLog'
import User from '../models/User'
import { extractClientIp, recordAdminActivity } from '../utils/adminActivity'
import {
  addTrustedDevice,
  generateDeviceFingerprint,
  isDeviceTrusted,
} from '../utils/deviceFingerprint'
import { emailTemplates, generateToken, sendEmail } from '../utils/email'

export const getAdminActivityLogs = async (req: Request, res: Response) => {
  try {
    const { userId, action, status } = req.query as {
      userId?: string
      action?: string
      status?: 'success' | 'failure'
    }
    const limitParam = Number(req.query.limit)
    const limit = Number.isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 200)

    const filter: Record<string, unknown> = {}
    if (userId) filter.user = userId
    if (action) filter.action = action
    if (status) filter.status = status

    const logs = await AdminActivityLog.find(filter)
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(limit)

    res.json(logs)
  } catch (err) {
    console.error('Error fetching admin activity logs:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const changeSuperAdminPassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string
      newPassword?: string
    }
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(userId)
    if (!user || user.role !== 'super-admin') {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Invalid password payload' })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect' })
    }

    // Check if there's already a pending password change
    if (user.pendingPasswordChange && user.pendingPasswordChange.expiresAt > new Date()) {
      return res.status(400).json({
        error:
          'A password change request is already pending. Please check your email to verify it, or wait for it to expire.',
      })
    }

    // Extract device information
    const ipAddress = extractClientIp(req)
    const userAgent = req.headers['user-agent'] || 'unknown'
    const deviceFingerprint = generateDeviceFingerprint(ipAddress, userAgent)

    // Check if device is trusted
    const deviceIsTrusted = isDeviceTrusted(deviceFingerprint, user.trustedDevices)

    if (!deviceIsTrusted) {
      // Device is not trusted - require email verification
      const verificationToken = generateToken()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Store pending password change
      const newPasswordHash = await bcrypt.hash(newPassword, 10)
      user.pendingPasswordChange = {
        newPasswordHash,
        verificationToken,
        expiresAt,
        deviceFingerprint,
        ipAddress,
        userAgent,
      }
      await user.save()

      // Send verification email
      const adminPanelUrl = process.env.ADMIN_PANEL_URL
      if (!adminPanelUrl) {
        console.warn('⚠️ ADMIN_PANEL_URL not configured - device verification email link will not work')
      }
      const verificationUrl = adminPanelUrl
        ? `${adminPanelUrl}/verify-device-password-change/${verificationToken}`
        : `[ADMIN_PANEL_URL_NOT_CONFIGURED]/verify-device-password-change/${verificationToken}`

      await sendEmail(
        user.email,
        'Verify Device for Password Change - Admin Panel',
        emailTemplates.deviceVerificationPasswordChange(
          user.name,
          verificationUrl,
          ipAddress,
          userAgent,
        ),
      )

      // Record activity
      const actorIdStr = String(user._id)
      void recordAdminActivity({
        userId: actorIdStr,
        email: user.email,
        action: 'super_admin_password_change_verification_required',
        status: 'success',
        ipAddress,
        userAgent,
        metadata: {
          deviceFingerprint,
          reason: 'unrecognized_device',
        },
      })

      return res.status(200).json({
        requiresVerification: true,
        message:
          'A password change request was initiated from an unrecognized device. Verify via email.',
      })
    }

    // Device is trusted - proceed with password change
    user.password = await bcrypt.hash(newPassword, 10)
    user.sessionVersion = (user.sessionVersion ?? 0) + 1

    // Update trusted device last used timestamp
    if (user.trustedDevices) {
      const deviceIndex = user.trustedDevices.findIndex(
        (d) => d.deviceFingerprint === deviceFingerprint,
      )
      if (deviceIndex !== -1) {
        user.trustedDevices[deviceIndex].lastUsedAt = new Date()
      }
    }

    // Clear any pending password change
    user.pendingPasswordChange = undefined
    await user.save()

    const actorIdStr = String(user._id)
    void recordAdminActivity({
      userId: actorIdStr,
      email: user.email,
      action: 'super_admin_password_change',
      status: 'success',
      ipAddress,
      userAgent,
    })

    res.json({ message: 'Password updated successfully' })
  } catch (err) {
    console.error('Error updating super admin password:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const verifyDeviceAndChangePassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params as { token?: string }

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' })
    }

    console.log('Verification request received for token:', token.substring(0, 10) + '...')

    // Find user with matching verification token
    const user = await User.findOne({
      role: 'super-admin',
      'pendingPasswordChange.verificationToken': token,
      'pendingPasswordChange.expiresAt': { $gt: new Date() },
    })

    if (!user) {
      console.log('No user found with token')
      return res.status(400).json({ error: 'Invalid or expired verification token' })
    }

    if (!user.pendingPasswordChange) {
      console.log('User found but no pending password change')
      return res.status(400).json({ error: 'Invalid or expired verification token' })
    }

    const { newPasswordHash } = user.pendingPasswordChange

    // Extract device information from the request that clicked the verification link
    const verificationIpAddress = extractClientIp(req)
    const verificationUserAgent = req.headers['user-agent'] || 'unknown'
    const verificationDeviceFingerprint = generateDeviceFingerprint(
      verificationIpAddress,
      verificationUserAgent,
    )

    // Store original device info before clearing
    const originalDevice = { ...user.pendingPasswordChange }

    // Complete password change
    user.password = newPasswordHash
    user.sessionVersion = (user.sessionVersion ?? 0) + 1

    // Add the device that clicked the verification link to trusted devices
    // Also add the original device that initiated the password change
    let trustedDevices = user.trustedDevices || []

    // Add original device (the one that initiated password change)
    trustedDevices = addTrustedDevice(
      originalDevice.deviceFingerprint,
      originalDevice.userAgent,
      originalDevice.ipAddress,
      trustedDevices,
    )

    // Add verification device (the one that clicked the link) if different
    if (verificationDeviceFingerprint !== originalDevice.deviceFingerprint) {
      trustedDevices = addTrustedDevice(
        verificationDeviceFingerprint,
        verificationUserAgent,
        verificationIpAddress,
        trustedDevices,
      )
    }

    user.trustedDevices = trustedDevices

    // Clear pending password change
    user.pendingPasswordChange = undefined
    await user.save()

    console.log('Password changed successfully for user:', user.email)

    // Record activity (fire and forget - don't block response)
    const actorIdStr = String(user._id)
    recordAdminActivity({
      userId: actorIdStr,
      email: user.email,
      action: 'super_admin_password_change',
      status: 'success',
      ipAddress: verificationIpAddress,
      userAgent: verificationUserAgent,
      metadata: {
        originalDeviceFingerprint: originalDevice.deviceFingerprint,
        verificationDeviceFingerprint,
        verified: true,
      },
    }).catch((err) => {
      console.error('Failed to record admin activity:', err)
      // Don't fail the request if activity logging fails
    })

    res.json({
      message:
        'Device verified and password changed successfully. You can now log in with your new password.',
      success: true,
    })
  } catch (err) {
    console.error('Error verifying device and changing password:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    const errorStack = err instanceof Error ? err.stack : undefined
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
    })
    res.status(500).json({
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    })
  }
}

export const forceLogoutUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const actingAdminId = req.user?.userId

    if (!actingAdminId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const targetUser = await User.findById(id)
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' })
    }

    targetUser.sessionVersion = (targetUser.sessionVersion ?? 0) + 1
    await targetUser.save()

    const targetUserId = String(targetUser._id)
    void recordAdminActivity({
      userId: actingAdminId,
      action: 'force_logout',
      status: 'success',
      ipAddress: extractClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      metadata: {
        targetUserId,
        targetEmail: targetUser.email,
        targetRole: targetUser.role,
      },
    })

    res.json({ message: 'User has been logged out from all sessions' })
  } catch (err) {
    console.error('Error forcing logout:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
