import crypto from 'crypto'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Phone Number Encryption Utility
 *
 * This utility encrypts phone numbers before storing in the database
 * and decrypts them when needed (e.g., for sending SMS).
 *
 * Uses AES-256-GCM encryption for security.
 */

// Warn if encryption key is not set (will cause decryption failures)
if (!process.env.PHONE_ENCRYPTION_KEY) {
  console.warn('[phoneEncryption] WARNING: PHONE_ENCRYPTION_KEY environment variable is not set!')
  console.warn(
    '[phoneEncryption] Using a random key. This will cause decryption failures for existing encrypted phones after server restart.',
  )
  console.warn(
    '[phoneEncryption] Please set PHONE_ENCRYPTION_KEY in your environment variables (32-byte hex string).',
  )
} else {
  console.log(
    '[phoneEncryption] PHONE_ENCRYPTION_KEY is set. Key length:',
    process.env.PHONE_ENCRYPTION_KEY.length,
  )
}

const ENCRYPTION_KEY = process.env.PHONE_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // For GCM, this is 12, but we'll use 16 for compatibility
const AUTH_TAG_LENGTH = 16

// Ensure encryption key is 32 bytes (256 bits)
const getEncryptionKey = (): Buffer => {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex')
  if (key.length !== 32) {
    // If key is not 32 bytes, derive it using SHA-256
    return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  }
  return key
}

/**
 * Encrypt a phone number
 * @param phone - Plain text phone number
 * @returns Encrypted phone number (base64 encoded)
 */
export const encryptPhone = (phone: string | undefined | null): string | undefined => {
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    return undefined
  }

  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(12) // GCM uses 12-byte IV
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(phone, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    const authTag = cipher.getAuthTag()

    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')])

    return combined.toString('base64')
  } catch (error) {
    console.error('Error encrypting phone number:', error)
    // If encryption fails, return masked version for safety
    return maskPhoneForStorage(phone)
  }
}

/**
 * Decrypt a phone number
 * @param encryptedPhone - Encrypted phone number (base64 encoded) or plain text
 * @returns Decrypted phone number or undefined if decryption fails
 */
export const decryptPhone = (encryptedPhone: string | undefined | null): string | undefined => {
  if (!encryptedPhone || typeof encryptedPhone !== 'string' || encryptedPhone.trim().length === 0) {
    return undefined
  }

  // Check if it looks like a masked phone (contains asterisks or bullets)
  if (encryptedPhone.includes('*') || encryptedPhone.includes('•')) {
    // This is a masked phone, can't decrypt
    return undefined
  }

  // Check if it's already a plain phone (for backward compatibility with existing data)
  // Plain phones are typically 10-15 digits, possibly with +, spaces, or dashes.
  // Guard against encrypted strings that coincidentally contain 10-15 digits.
  const phoneDigits = encryptedPhone.replace(/\D/g, '')
  if (encryptedPhone.length < 50 && phoneDigits.length >= 10 && phoneDigits.length <= 15) {
    // Likely a plain phone number, return as-is
    return encryptedPhone
  }

  // If it's too short to be encrypted, treat as plain text
  // Encrypted phones are base64 encoded and typically 50+ characters
  if (encryptedPhone.length < 50) {
    // Too short to be encrypted, treat as plain text
    return encryptedPhone
  }

  // Check if it looks like base64 (only contains base64 characters)
  // Base64 strings only contain A-Z, a-z, 0-9, +, /, and = for padding
  const base64Pattern = /^[A-Za-z0-9+/]+=*$/
  if (!base64Pattern.test(encryptedPhone)) {
    // Doesn't look like base64, treat as plain text
    return encryptedPhone
  }

  // Try to decrypt (it should be base64 encoded encrypted data)
  try {
    const key = getEncryptionKey()
    let combined: Buffer

    try {
      combined = Buffer.from(encryptedPhone, 'base64')
    } catch (base64Error) {
      // Not valid base64, treat as plain text
      return encryptedPhone
    }

    // Validate buffer length (should be at least 28 bytes: 12 IV + 16 authTag + some data)
    if (combined.length < 28) {
      // Too short to be encrypted, treat as plain text
      return encryptedPhone
    }

    // Extract IV (12 bytes), authTag (16 bytes), and encrypted data
    const iv = combined.slice(0, 12)
    const authTag = combined.slice(12, 28)
    const encrypted = combined.slice(28)

    if (encrypted.length === 0) {
      // No encrypted data, treat as plain text
      return encryptedPhone
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error: any) {
    // CRITICAL: If decryption fails, we're in the try block which means we already determined
    // the phone is encrypted (50+ chars, base64). So we should NEVER return the encrypted phone.
    // Even if it happens to have 10-15 digits, it's still encrypted and decryption failed.

    // Log the specific error for debugging (but reduce verbosity for expected key mismatches)
    const isAuthError =
      error.message?.includes('unable to authenticate') ||
      error.message?.includes('Authentication failed') ||
      error.code === 'ERR_CRYPTO_INVALID_AUTH_TAG'

    if (isAuthError) {
      // This usually means wrong key or corrupted data - expected when keys are rotated
      // Only log occasionally to reduce noise (log ~1% of the time)
      if (Math.random() < 0.01) {
        console.warn(
          `[decryptPhone] Authentication failed - phone encrypted with different key. Phone length: ${encryptedPhone.length}. This is expected when encryption keys are rotated.`,
        )
      }
    } else {
      // Other decryption errors - log all of them
      console.warn(`[decryptPhone] Decryption error:`, error.message || error)
    }

    // Decryption failed - return undefined (NEVER return encrypted phone)
    // We're in the try block, so we know it's encrypted. Decryption failed = return undefined
    return undefined
  }
}

/**
 * Mask phone number for display (last 4 digits visible)
 * @param phone - Phone number to mask
 * @returns Masked phone number (e.g., "***5811")
 */
export const maskPhoneForDisplay = (phone?: string): string | undefined => {
  if (!phone) return undefined
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  const lastFour = digits.slice(-4)
  return `***${lastFour}`
}

/**
 * Mask phone number for storage (fallback if encryption fails)
 * @param phone - Phone number to mask
 * @returns Masked phone number
 */
const maskPhoneForStorage = (phone: string): string => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  const lastFour = digits.slice(-4)
  return `***${lastFour}`
}

/**
 * Check if a phone number is encrypted
 * @param phone - Phone number to check
 * @returns true if encrypted, false otherwise
 */
export const isPhoneEncrypted = (phone?: string): boolean => {
  if (!phone) return false
  // Encrypted phones are base64 and longer than plain phones
  // Plain phones are typically 10-15 digits, encrypted are 50+ characters
  return phone.length > 50 && /^[A-Za-z0-9+/=]+$/.test(phone)
}
