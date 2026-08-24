import { presignDownload } from '../models/services/upload.service'
import {
  getMerchantSafeOperationalError,
  isInternalProviderBalanceIssue,
} from './merchantErrorMessages'
import { getOrderLabelReference, isExternalLabelReference } from './orderLabels'

/**
 * Generates an accessible download URL for stored asset keys.
 * Falls back gracefully if the file cannot be presigned.
 */
const ensureDownloadUrl = async (value?: string | null) => {
  if (!value || typeof value !== 'string' || !value.trim()) {
    return null
  }

  if (isExternalLabelReference(value)) {
    return value
  }

  // If it's already a full URL from external source (not our R2), return as-is
  // But R2 URLs should be re-presigned since they expire
  const isExternalUrl = /^https?:\/\//i.test(value) &&
    !value.includes(process.env.R2_ENDPOINT || '') &&
    !value.includes('.r2.cloudflarestorage.com')

  if (isExternalUrl) {
    return value
  }

  try {
    const url = await presignDownload(value, { checkExists: true })
    const finalUrl = Array.isArray(url) ? url[0] ?? null : url

    if (!finalUrl) {
      console.warn(`⚠️ presignDownload returned null for key: ${value} - file may not exist in S3/R2`)
    }

    return finalUrl
  } catch (error: any) {
    // presignDownload now handles NoSuchKey gracefully, but catch any other errors
    console.error('❌ Failed to presign download URL:', {
      key: value,
      error: error?.message || error,
      stack: error?.stack,
    })
    return null
  }
}

const isHttpUrl = (value?: string | null) => typeof value === 'string' && /^https?:\/\//i.test(value)

const isLikelyStoredDocumentReference = (value?: string | null) => {
  const reference = String(value || '').trim()
  if (!reference) return false
  if (isHttpUrl(reference)) return true

  const normalizedReference = reference.toLowerCase()
  return (
    normalizedReference.includes('/') ||
    normalizedReference.includes('label') ||
    normalizedReference.includes('manifest') ||
    normalizedReference.includes('invoice') ||
    normalizedReference.endsWith('.pdf')
  )
}

/**
 * Sanitizes order data for customer-facing APIs.
 * Removes internal platform fields and enriches orders with presigned document URLs.
 */
export const sanitizeOrderForCustomer = async (order: any): Promise<any> => {
  if (!order) return order

  const sanitized = { ...order }
  const labelReference = getOrderLabelReference(order)
  const manifestRetryCount = Number(order?.manifest_retry_count ?? 0)
  const manifestRetriesRemaining = Math.max(0, 3 - manifestRetryCount)
  const provider = String(order?.integration_type || '').trim().toLowerCase()
  const orderStatus = String(order?.order_status || '').trim().toLowerCase()
  const pickupStatus = String(order?.pickup_status || '').trim().toLowerCase()
  const rawPickupError = String(order?.pickup_error || '').trim()
  const merchantSafeManifestError = getMerchantSafeOperationalError(order?.manifest_error, null)
  const merchantSafePickupError = rawPickupError
    ? getMerchantSafeOperationalError(rawPickupError)
    : null
  const canRetryManifestFailure =
    (orderStatus === 'manifest_failed' && provider === 'delhivery') ||
    (String(order?.manifest || '').trim().length > 0 &&
      ['shadowfax', 'xpressbees', 'ekart'].includes(provider) &&
      String(order?.manifest_error || '').trim().length > 0)
  const canRetryPickupFailure =
    provider === 'delhivery' &&
    rawPickupError.length > 0 &&
    String(order?.awb_number || '').trim().length > 0 &&
    (pickupStatus === 'failed' || orderStatus === 'shipment_created')

  delete sanitized.courier_cost

  sanitized.manifest_retry_count = manifestRetryCount
  sanitized.manifest_retries_remaining = manifestRetriesRemaining
  sanitized.manifest_error = merchantSafeManifestError
  sanitized.pickup_error = merchantSafePickupError
  sanitized.can_retry_manifest =
    (canRetryManifestFailure || canRetryPickupFailure) &&
    manifestRetriesRemaining > 0 &&
    (!canRetryManifestFailure || !isInternalProviderBalanceIssue(order?.manifest_error))

  // Always expose stored document keys so clients can reliably use the same regenerated keys
  if (labelReference) sanitized.label_key = labelReference
  const manifestReference = String(order.manifest || '').trim()
  const isMovinOrder =
    provider === 'movin' ||
    String(order?.courier_partner || '').trim().toLowerCase().includes('movin')
  const manifestLooksLikeDocument = isLikelyStoredDocumentReference(manifestReference)

  if (manifestReference && manifestLooksLikeDocument) {
    sanitized.manifest_key = manifestReference
  } else if (manifestReference && isMovinOrder) {
    sanitized.manifest_provider_reference = manifestReference
    sanitized.manifest = null
  }
  if (order.invoice_link) sanitized.invoice_key = order.invoice_link

  try {
    const [labelUrl, manifestUrl, invoiceUrl] = await Promise.all([
      ensureDownloadUrl(labelReference),
      ensureDownloadUrl(manifestLooksLikeDocument ? manifestReference : null),
      ensureDownloadUrl(order.invoice_link),
    ])

    if (labelUrl) {
      sanitized.label_url = labelUrl
      sanitized.label = labelUrl
    }

    if (manifestUrl) {
      sanitized.manifest_url = manifestUrl
      sanitized.manifest = manifestUrl
    }

    if (invoiceUrl) {
      sanitized.invoice_url = invoiceUrl
      sanitized.invoice_link = invoiceUrl
    } else if (order.invoice_link) {
      console.warn(`⚠️ Failed to presign invoice URL for order ${order.id}:`, {
        invoice_key: order.invoice_link,
        error: 'presignDownload returned null or failed',
      })
    }
  } catch (error) {
    console.error('⚠️ Failed to attach document URLs for order:', order?.id, error)
  }

  return sanitized
}

export const sanitizeOrdersForCustomer = async (orders: any[]): Promise<any[]> => {
  return Promise.all(orders.map(sanitizeOrderForCustomer))
}
