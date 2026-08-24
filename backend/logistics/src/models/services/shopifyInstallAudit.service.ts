import { appendFile, mkdir, rename, rm, stat } from 'fs/promises'
import path from 'path'

export type ShopifyInstallAuditEntry = {
  event: string
  status: 'started' | 'passed' | 'failed' | 'info'
  requestId?: string
  shop?: string
  source?: 'frontend' | 'backend' | 'webhook'
  durationMs?: number
  httpStatus?: number
  detail?: string
  existingConnection?: boolean
}

const MAX_LOG_BYTES = 10 * 1024 * 1024
let writeQueue: Promise<void> = Promise.resolve()

const sanitizeText = (value?: string) =>
  String(value || '')
    .replace(/shp[a-z]{2}_[a-zA-Z0-9_-]+/g, '[redacted-shopify-token]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [redacted]')
    .replace(/[a-f0-9]{32,}/gi, '[redacted-secret]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 300)

const getLogPath = () =>
  String(process.env.SHOPIFY_INSTALL_AUDIT_LOG_PATH || '').trim() ||
  path.resolve(process.cwd(), 'logs', 'shopify-install-audit.jsonl')

const rotateIfNeeded = async (logPath: string) => {
  try {
    const current = await stat(logPath)
    if (current.size < MAX_LOG_BYTES) return
    const rotatedPath = `${logPath}.1`
    await rm(rotatedPath, { force: true })
    await rename(logPath, rotatedPath)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error
  }
}

export const logShopifyInstallEvent = (entry: ShopifyInstallAuditEntry) => {
  writeQueue = writeQueue
    .then(async () => {
      const logPath = getLogPath()
      await mkdir(path.dirname(logPath), { recursive: true })
      await rotateIfNeeded(logPath)
      const payload = {
        timestamp: new Date().toISOString(),
        event: sanitizeText(entry.event),
        status: entry.status,
        requestId: sanitizeText(entry.requestId) || undefined,
        shop: sanitizeText(entry.shop) || undefined,
        source: entry.source || 'backend',
        durationMs: Number.isFinite(entry.durationMs) ? Math.max(0, Number(entry.durationMs)) : undefined,
        httpStatus: Number.isFinite(entry.httpStatus) ? Number(entry.httpStatus) : undefined,
        detail: sanitizeText(entry.detail) || undefined,
        existingConnection:
          typeof entry.existingConnection === 'boolean' ? entry.existingConnection : undefined,
      }
      await appendFile(logPath, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o640 })
    })
    .catch((error) => {
      console.warn('Shopify install audit write failed:', error?.message || error)
    })

  return writeQueue
}
