import { timingSafeEqual } from 'crypto'
import type { NextFunction, Request, Response } from 'express'

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export const requireInternalService = (req: Request, res: Response, next: NextFunction) => {
  const expected = String(
    process.env.KOURIER_BOYZ_INTERNAL_SERVICE_KEY ||
      process.env.KOURIER_BOYZ_LOGISTICS_API_KEY ||
      '',
  ).trim()
  const provided = String(
    req.headers['x-kourier-boyz-internal-key'] || req.headers['x-api-key'] || '',
  ).trim()

  if (!expected) return res.status(503).json({ success: false, message: 'Internal service is not configured' })
  if (!provided || !safeEqual(provided, expected)) {
    return res.status(401).json({ success: false, message: 'Internal service authentication failed' })
  }
  return next()
}
