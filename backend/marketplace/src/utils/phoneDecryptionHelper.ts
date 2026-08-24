/**
 * Phone Decryption Helper
 * 
 * Centralized helper for safely decrypting phone numbers before sending SMS.
 * Handles all edge cases including:
 * - Phones encrypted with old keys
 * - Plain text phones
 * - Invalid/masked phones
 * - Decryption errors
 */

import { decryptPhone } from './phoneEncryption'

export interface PhoneDecryptionResult {
  phone: string | undefined
  isDecryptable: boolean
  isPlainText: boolean
  error?: 'key_mismatch' | 'invalid_format' | 'decryption_failed'
  errorMessage?: string
}

/**
 * Safely decrypt a phone number for SMS sending
 * 
 * @param encryptedPhone - Phone from database (may be encrypted or plain text)
 * @param userId - User ID for logging (optional)
 * @param context - Context for logging (e.g., "2FA Login", "Order Confirmation")
 * @returns PhoneDecryptionResult with decrypted phone and metadata
 */
export const safeDecryptPhoneForSms = (
  encryptedPhone: string | undefined | null,
  userId?: string,
  context?: string,
): PhoneDecryptionResult => {
  if (!encryptedPhone || typeof encryptedPhone !== 'string' || encryptedPhone.trim().length === 0) {
    return {
      phone: undefined,
      isDecryptable: false,
      isPlainText: false,
      error: 'invalid_format',
      errorMessage: 'Phone number is empty or invalid',
    }
  }

  const phoneStr = String(encryptedPhone).trim()

  // Check if it's masked (contains asterisks or bullets)
  if (phoneStr.includes('*') || phoneStr.includes('•')) {
    return {
      phone: undefined,
      isDecryptable: false,
      isPlainText: false,
      error: 'invalid_format',
      errorMessage: 'Phone number is masked',
    }
  }

  // Check if it's a plain text phone number (10-15 digits)
  const phoneDigits = phoneStr.replace(/\D/g, '')
  const isPlainTextPhone = phoneDigits.length >= 10 && phoneDigits.length <= 15 && phoneStr.length < 50

  if (isPlainTextPhone) {
    // It's a plain text phone - use it directly
    return {
      phone: phoneStr,
      isDecryptable: true,
      isPlainText: true,
    }
  }

  // Check if it looks like base64 encrypted data (50+ chars, base64 pattern)
  const isBase64Encrypted = phoneStr.length >= 50 && /^[A-Za-z0-9+/]+=*$/.test(phoneStr)

  if (!isBase64Encrypted) {
    // Doesn't look encrypted or like a phone - invalid format
    return {
      phone: undefined,
      isDecryptable: false,
      isPlainText: false,
      error: 'invalid_format',
      errorMessage: 'Phone number format is invalid',
    }
  }

  // Try to decrypt (it's encrypted)
  try {
    const decrypted = decryptPhone(phoneStr)
    
    // CRITICAL: Check if decryptPhone returned the encrypted string (decryption failed)
    // If the returned value is still 50+ chars and base64, decryption failed
    if (decrypted) {
      const decryptedStr = String(decrypted)
      const isStillEncrypted = decryptedStr.length >= 50 && /^[A-Za-z0-9+/=]+$/.test(decryptedStr)
      
      if (isStillEncrypted) {
        // decryptPhone returned encrypted value - decryption failed (key mismatch)
        console.warn(
          `[safeDecryptPhoneForSms] decryptPhone returned encrypted value for user ${userId || 'unknown'}. Decryption failed (key mismatch).`,
        )
        return {
          phone: undefined,
          isDecryptable: false,
          isPlainText: false,
          error: 'key_mismatch',
          errorMessage: 'Phone number was encrypted with a different key',
        }
      }
      
      // Check if decrypted value is a valid phone number
      const decryptedDigits = decryptedStr.replace(/\D/g, '')
      if (decryptedDigits.length >= 10 && decryptedDigits.length <= 15) {
        // Successfully decrypted and looks like a valid phone
        return {
          phone: decrypted,
          isDecryptable: true,
          isPlainText: false,
        }
      } else {
        // Decryption returned something but it's not a valid phone
        return {
          phone: undefined,
          isDecryptable: false,
          isPlainText: false,
          error: 'invalid_format',
          errorMessage: 'Decrypted value is not a valid phone number',
        }
      }
    } else {
      // decryptPhone returned undefined - likely key mismatch
      return {
        phone: undefined,
        isDecryptable: false,
        isPlainText: false,
        error: 'key_mismatch',
        errorMessage: 'Phone number was encrypted with a different key',
      }
    }
  } catch (error: any) {
    // Decryption failed - likely encrypted with old key
    const isAuthError =
      error?.message?.includes('unable to authenticate') ||
      error?.message?.includes('Authentication failed') ||
      error?.code === 'ERR_CRYPTO_INVALID_AUTH_TAG'

    if (isAuthError) {
      // Phone was encrypted with a different key
      const logContext = context ? `[${context}]` : '[Phone Decryption]'
      const userIdStr = userId ? `user ${userId}` : 'user'
      console.warn(
        `${logContext} Phone decryption failed for ${userIdStr} - phone encrypted with different key. Phone length: ${phoneStr.length}`,
      )
      
      return {
        phone: undefined,
        isDecryptable: false,
        isPlainText: false,
        error: 'key_mismatch',
        errorMessage: 'Phone number was encrypted with a different key. Please update your phone number.',
      }
    } else {
      // Other decryption error
      const logContext = context ? `[${context}]` : '[Phone Decryption]'
      const userIdStr = userId ? `user ${userId}` : 'user'
      console.error(`${logContext} Decryption error for ${userIdStr}:`, error)
      
      return {
        phone: undefined,
        isDecryptable: false,
        isPlainText: false,
        error: 'decryption_failed',
        errorMessage: 'Failed to decrypt phone number',
      }
    }
  }
}

/**
 * Get phone from user object (handles both user.phone and user.getDecryptedPhone())
 * 
 * @param user - User object (may have getDecryptedPhone method)
 * @param userId - User ID for logging
 * @param context - Context for logging
 * @returns PhoneDecryptionResult
 */
export const getPhoneFromUser = (
  user: any,
  userId?: string,
  context?: string,
): PhoneDecryptionResult => {
  const phone = user?.phone
  if (!phone) {
    return {
      phone: undefined,
      isDecryptable: false,
      isPlainText: false,
      error: 'invalid_format',
      errorMessage: 'No phone number found',
    }
  }

  const logContext = context ? `[${context}]` : '[getPhoneFromUser]'
  console.log(`${logContext} Attempting to decrypt phone for user ${userId || 'unknown'}. Phone length: ${String(phone).length}`)

  // Try getDecryptedPhone() method first (if available)
  if (typeof user.getDecryptedPhone === 'function') {
    try {
      const decrypted = user.getDecryptedPhone()
      console.log(`${logContext} getDecryptedPhone() method returned:`, decrypted ? `length ${String(decrypted).length}` : 'undefined')
      if (decrypted) {
        const decryptedStr = String(decrypted)
        // CRITICAL: Check if the returned value is still encrypted (base64, 50+ chars)
        const isBase64Encrypted = decryptedStr.length >= 50 && /^[A-Za-z0-9+/=]+$/.test(decryptedStr)
        if (isBase64Encrypted) {
          // getDecryptedPhone() returned encrypted value - decryption failed
          console.warn(`${logContext} getDecryptedPhone() returned encrypted value (decryption failed). Falling back to safeDecryptPhoneForSms.`)
          // Fall through to safeDecryptPhoneForSms
        } else {
          // Method returned a phone - validate it's a valid phone number
          const phoneDigits = decryptedStr.replace(/\D/g, '')
          if (phoneDigits.length >= 10 && phoneDigits.length <= 15) {
            console.log(`${logContext} getDecryptedPhone() returned valid decrypted phone`)
            return {
              phone: decrypted,
              isDecryptable: true,
              isPlainText: decryptedStr.length < 50,
            }
          } else {
            console.warn(`${logContext} getDecryptedPhone() returned invalid phone (digits: ${phoneDigits.length})`)
            // Fall through to safeDecryptPhoneForSms
          }
        }
      }
    } catch (error: any) {
      console.warn(`${logContext} getDecryptedPhone() method failed:`, error.message || error)
      // Method failed - fall through to safeDecryptPhoneForSms
    }
  }

  // Fall back to safeDecryptPhoneForSms
  console.log(`${logContext} Falling back to safeDecryptPhoneForSms`)
  const result = safeDecryptPhoneForSms(phone, userId, context)
  console.log(`${logContext} safeDecryptPhoneForSms result:`, {
    isDecryptable: result.isDecryptable,
    isPlainText: result.isPlainText,
    hasPhone: !!result.phone,
    error: result.error,
  })
  return result
}

