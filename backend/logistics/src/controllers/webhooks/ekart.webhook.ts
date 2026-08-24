import { Request, Response } from 'express'
import { and, eq, gte, isNull } from 'drizzle-orm'
import { db } from '../../models/client'
import { processEkartWebhook } from '../../models/services/webhookProcessor'
import { courier_credentials } from '../../models/schema/courierCredentials'
import { pending_webhooks } from '../../schema/schema'
import crypto from 'crypto'

const EKART_WEBHOOK_SECRET_HEADERS = [
  'x-ekart-webhook-secret',
  'x-ekart-webhook-signature',
  'x-ekart-signature',
  'x-ekart-hmac-sha256',
  'x-hmac-sha256',
  'x-webhook-signature',
  'x-signature',
  'x-hub-signature-256',
]

const EKART_PROVIDER = 'ekart'

const findSecretHeader = (headers: Request['headers']) => {
  const normalized = headers as Record<string, string | string[] | undefined>
  for (const header of EKART_WEBHOOK_SECRET_HEADERS) {
    const value = normalized[header] || normalized[header.toLowerCase()]
    if (!value) continue
    if (Array.isArray(value) && value.length) return String(value[0]).trim()
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

const timingSafeStringEqual = (left: string, right: string) => {
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  return leftBuf.length === rightBuf.length && crypto.timingSafeEqual(leftBuf, rightBuf)
}

const isValidEkartSignature = (receivedSecret: string, configuredSecret: string, rawBody: string) => {
  if (timingSafeStringEqual(receivedSecret, configuredSecret)) return true

  const hmacHex = crypto.createHmac('sha256', configuredSecret).update(rawBody).digest('hex')
  const hmacBase64 = crypto.createHmac('sha256', configuredSecret).update(rawBody).digest('base64')
  const candidates = [hmacHex, `sha256=${hmacHex}`, hmacBase64, `sha256=${hmacBase64}`]

  return candidates.some((candidate) => timingSafeStringEqual(receivedSecret, candidate))
}

const sanitizeHeadersForLog = (headers: Request['headers']) => {
  const sensitiveHeaders = new Set(EKART_WEBHOOK_SECRET_HEADERS)
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      sensitiveHeaders.has(key.toLowerCase()) ? '[redacted]' : value,
    ]),
  )
}

const fetchEkartWebhookSecret = async () => {
  try {
    const [row] = await db
      .select({
        webhookSecret: courier_credentials.webhookSecret,
      })
      .from(courier_credentials)
      .where(eq(courier_credentials.provider, EKART_PROVIDER))
      .limit(1)
    return (row?.webhookSecret || '').trim()
  } catch (err: any) {
    console.error('Failed to load Ekart webhook secret:', err?.message || err)
    return ''
  }
}

export const ekartWebhookHandler = async (req: Request, res: Response) => {
  const payload = req.body
  const configuredSecret = await fetchEkartWebhookSecret()
  const receivedSecret = findSecretHeader(req.headers)
  const rawBody = (req as any).rawBody || (req.body ? JSON.stringify(req.body) : '')

  if (configuredSecret) {
    if (!receivedSecret) {
      console.warn('Ekart webhook rejected: missing signature header')
      return res.status(401).json({ success: false, message: 'missing signature' })
    } else if (!isValidEkartSignature(receivedSecret, configuredSecret, rawBody)) {
      console.warn('Ekart webhook rejected: invalid signature')
      return res.status(401).json({ success: false, message: 'invalid signature' })
    }
  } else if (receivedSecret) {
    console.info(
      'Ekart webhook header received but no secret configured locally; payload will be accepted.',
    )
  }

  const awb =
    payload?.tracking_id ||
    payload?.trackingId ||
    payload?.awb ||
    payload?.waybill ||
    payload?.wbn ||
    payload?.id ||
    payload?.track?.id ||
    payload?.track?.wbn ||
    payload?.track_updated?.id ||
    payload?.track_updated?.wbn ||
    payload?.barcodes?.wbn ||
    'unknown'

  console.log('='.repeat(80))
  console.log(`[Ekart] Webhook received - AWB: ${awb}`)
  console.log('Headers:', JSON.stringify(sanitizeHeadersForLog(req.headers), null, 2))
  console.log('Payload:', JSON.stringify(payload, null, 2))
  console.log('='.repeat(80))

  try {
    const result = await processEkartWebhook(payload)

    if (!result.success && result.reason === 'order_not_found') {
      const dedupeWindowStart = new Date(Date.now() - 10 * 60 * 1000)
      const status = String(
        payload?.status ||
          payload?.current_status ||
          payload?.event ||
          payload?.track_updated?.status ||
          payload?.track?.status ||
          'unknown',
      )
      const [existingPending] = await db
        .select({ id: pending_webhooks.id })
        .from(pending_webhooks)
        .where(
          and(
            eq(pending_webhooks.awb_number, String(awb || 'unknown')),
            eq(pending_webhooks.status, `ekart:${status}`),
            isNull(pending_webhooks.processed_at),
            gte(pending_webhooks.created_at, dedupeWindowStart),
          ),
        )
        .limit(1)

      if (!existingPending) {
        await db.insert(pending_webhooks).values({
          awb_number: awb || null,
          status: `ekart:${status}`,
          payload: {
            __provider: 'ekart',
            body: payload,
          },
        })
        console.warn(`Stored Ekart webhook for AWB ${awb || 'N/A'} (order not yet created).`)
      } else {
        console.warn(
          `Duplicate pending Ekart webhook skipped for AWB ${awb || 'N/A'} (within dedupe window).`,
        )
      }

      return res.status(202).json({ success: true, queued: true })
    }

    if (!result.success) {
      return res.status(202).json({ success: false, reason: result.reason })
    }

    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('Ekart webhook processing failed:', err?.message || err)
    return res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}
