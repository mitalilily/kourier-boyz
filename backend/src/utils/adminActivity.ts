import { Request } from 'express'
import mongoose from 'mongoose'
import AdminActivityLog, { AdminActivityStatus } from '../models/AdminActivityLog'

interface ActivityPayload {
  userId?: string
  email?: string
  action: string
  status: AdminActivityStatus
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
}

export const extractClientIp = (req: Request): string | undefined => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim()
  }

  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]
  }

  return req.ip
}

export const recordAdminActivity = async ({
  userId,
  email,
  action,
  status,
  ipAddress,
  userAgent,
  metadata,
}: ActivityPayload) => {
  try {
    await AdminActivityLog.create({
      user: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      email,
      action,
      status,
      ipAddress,
      userAgent,
      metadata,
    })
  } catch (err) {
    console.error('Failed to record admin activity:', err)
  }
}

