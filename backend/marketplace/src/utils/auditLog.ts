import { Request } from 'express'
import mongoose from 'mongoose'
import AuditLog, { AuditActionType, IAuditLog } from '../models/AuditLog'
import User from '../models/User'

export interface CreateAuditLogParams {
  action: AuditActionType
  performedBy: string | mongoose.Types.ObjectId // User ID
  req?: Request // Optional for cases where we have direct params
  entityType: 'REFUND' | 'SETTLEMENT_BATCH' | 'MANUAL_ADJUSTMENT' | 'ORDER' | 'SELLER'
  entityId: string | mongoose.Types.ObjectId
  metadata: Record<string, unknown>
  // Optional overrides for when we already have the info
  performedByEmail?: string
  performedByName?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Creates an audit log entry with user info, IP address, and timestamp
 * This is NON-NEGOTIABLE for financial operations
 */
export const createAuditLog = async (params: CreateAuditLogParams): Promise<IAuditLog> => {
  const {
    action,
    performedBy,
    req,
    entityType,
    entityId,
    metadata,
    performedByEmail: providedEmail,
    performedByName: providedName,
    ipAddress: providedIp,
    userAgent: providedUserAgent,
  } = params

  // Get user info for denormalization (if not provided)
  let performedByEmail = providedEmail
  let performedByName = providedName
  if (!performedByEmail || !performedByName) {
    const userId = typeof performedBy === 'string' ? performedBy : performedBy.toString()
    const user = await User.findById(userId).select('name email').lean()
    performedByEmail = performedByEmail || user?.email || undefined
    performedByName = performedByName || user?.name || undefined
  }

  // Get IP address (handle proxies) - prefer provided, then from req, then fallback
  const ipAddress =
    providedIp ||
    (req
      ? (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        (req.headers['x-real-ip'] as string) ||
        req.ip ||
        req.socket.remoteAddress ||
        'unknown'
      : 'unknown')

  // Get user agent - prefer provided, then from req
  const userAgent = providedUserAgent || (req ? req.headers['user-agent'] : undefined)

  const performedById = typeof performedBy === 'string' ? performedBy : performedBy
  const entityIdValue = typeof entityId === 'string' ? entityId : entityId

  const auditLog = await AuditLog.create({
    action,
    performedBy: performedById,
    performedByEmail,
    performedByName,
    ipAddress,
    userAgent,
    entityType,
    entityId: entityIdValue,
    metadata,
    createdAt: new Date(),
  })

  return auditLog
}

