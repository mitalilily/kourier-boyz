import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

// TrustSignal / Sigmo SMS configuration
// Example base URL: https://api.trustsignal.io/v1/sms
const SMS_API_URL = process.env.SIGMO_SMS_API_URL || 'https://api.trustsignal.io/v1/sms'
const SMS_API_KEY = process.env.SIGMO_SMS_API_KEY

export interface SmsResult {
  success: boolean
  skipped?: boolean
  reason?: string
  error?: unknown
}

// Normalise phone number into provider-friendly numeric format.
// TrustSignal/Sigmo expects phone numbers in international format (e.g., 911234567890 for India)
const normalizePhone = (raw: string): string => {
  // Strip everything except digits
  const digits = raw.replace(/\D/g, '')
  // If it's a plain 10-digit Indian mobile, provider example shows 10 digits.
  return digits
}

/**
 * Send an SMS via Sigmo / TrustSignal (HTTP JSON API).
 *
 * Environment variables:
 * - SIGMO_SMS_API_URL: Base endpoint URL (e.g. https://api.trustsignal.io/v1/sms)
 * - SIGMO_SMS_API_KEY: API key provided by Sigmo / TrustSignal
 * - SMS_SENDER_ID: default sender ID (e.g. KOURIER_BOYZS)
 * - SMS_ROUTE: route name (e.g. transactional)
 * - SMS_TEMPLATE_ID: optional default template ID
 */
export const sendSms = async (
  to: string,
  message: string,
  options?: { templateId?: string; templateMessage?: string; variables?: string[] },
): Promise<SmsResult> => {
  // Basic logging for observability
  console.log('\n📱 ============ SMS NOTIFICATION ============')
  console.log(`To: ${to}`)
  console.log(`Message: ${message}`)
  console.log('=============================================\n')

  if (!SMS_API_URL || !SMS_API_KEY) {
    console.warn(
      '⚠️ SIGMO_SMS_API_URL or SIGMO_SMS_API_KEY not configured. Skipping actual SMS send.',
    )
    return { success: false, skipped: true, reason: 'SMS not configured' }
  }

  try {
    const urlWithKey = `${SMS_API_URL}?api_key=${encodeURIComponent(SMS_API_KEY)}`
    console.log('urlWithKey', urlWithKey)

    // Normalize and validate phone number
    let normalizedTo: string
    try {
      normalizedTo = normalizePhone(to)
    } catch (phoneError: any) {
      console.error(`[SMS] Phone number validation failed for "${to}":`, phoneError.message)
      return { success: false, error: phoneError.message, reason: 'Invalid phone number' }
    }

    // Convert to number (TrustSignal API expects array of numbers)
    const msisdn = Number(normalizedTo)
    if (isNaN(msisdn)) {
      console.error(`[SMS] Invalid normalized phone number: ${normalizedTo}`)
      return { success: false, error: 'Invalid phone number format', reason: 'Invalid msisdn' }
    }

    console.log(`[SMS] Original: ${to}, Normalized: ${normalizedTo}, MSISDN: ${msisdn}`)

    const payload: Record<string, any> = {
      sender_id: process.env.SMS_SENDER_ID || 'KOURIER_BOYZS',
      to: [msisdn],
      route: process.env.SMS_ROUTE || 'transactional',
      message,
    }

    // Only add entity_id if it's configured (might not be required)
    if (process.env.SMS_ENTITY_ID) {
      payload.entity_id = process.env.SMS_ENTITY_ID
    }

    const effectiveTemplateId = options?.templateId || process.env.SMS_TEMPLATE_ID
    if (effectiveTemplateId) {
      payload.template_id = effectiveTemplateId
    }

    // Log the exact payload being sent for debugging
    console.log('[SMS] Payload being sent:', JSON.stringify(payload, null, 2))
    console.log('[SMS] Phone number details:', {
      original: to,
      normalized: normalizedTo,
      msisdn,
      length: normalizedTo.length,
    })

    const response = await axios.post(urlWithKey, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 7000,
    })

    // Optionally log provider response for debugging
    if (response.data && response.data.success === false) {
      console.error('❌ SMS provider reported failure:', response.data)
      return { success: false, error: response.data }
    }

    return { success: true }
  } catch (error: any) {
    // Log provider error details (if any) to help debugging
    const status = error?.response?.status
    const data = error?.response?.data
    const requestData = error?.config?.data
    console.error('❌ Failed to send SMS via Sigmo / TrustSignal:')
    console.error('Status:', status)
    console.error('Response data:', data)
    if (requestData) {
      try {
        console.error('Request payload (raw):', requestData)
        const parsed = typeof requestData === 'string' ? JSON.parse(requestData) : requestData
        console.error('Request payload (parsed):', JSON.stringify(parsed, null, 2))
      } catch (e) {
        console.error('Could not parse request data:', e)
      }
    }
    if (data) {
      try {
        console.error('Response data (JSON):', JSON.stringify(data, null, 2))
      } catch {
        // ignore JSON stringify issues
      }
    }
    return { success: false, error }
  }
}
