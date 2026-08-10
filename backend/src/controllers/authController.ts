import base64url from 'base64url'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Request, Response, type CookieOptions } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import qrcode from 'qrcode'
import speakeasy from 'speakeasy'
import User, { type ITwoFactorBackupCode, type IUser } from '../models/User'
import { extractClientIp, recordAdminActivity } from '../utils/adminActivity'
import { emailTemplates, generateToken, sendEmail } from '../utils/email'
import { getPhoneFromUser, safeDecryptPhoneForSms } from '../utils/phoneDecryptionHelper'
import { decryptPhone, encryptPhone, maskPhoneForDisplay } from '../utils/phoneEncryption'
import { sendSms } from '../utils/sms'
import { getSmsTemplate, SmsTemplateType } from '../utils/smsTemplates'
import {
  createAuthenticationOptions,
  createDiscoverableAuthenticationOptions,
  createRegistrationOptions,
  updateAuthenticatorCounter,
  verifyAuthentication,
  verifyRegistration,
} from '../utils/webauthn'

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey'
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'superrefreshsecret'
const isProduction = process.env.NODE_ENV === 'production'
const TWO_FACTOR_ISSUER = process.env.TWO_FACTOR_ISSUER || 'Kourier Boyz'
const TWO_FACTOR_TOKEN_TTL = '5m'
const TWO_FACTOR_BACKUP_CODE_COUNT = 8
const TWO_FACTOR_SETUP_SECRET_TTL_MS = 30 * 60 * 1000 // 30 minutes
const TWO_FACTOR_SMS_CODE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const TWO_FACTOR_SMS_RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds
const PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds
const PROFILE_PHONE_OTP_RESEND_COOLDOWN_MS = 60 * 1000 // 60 seconds
const BACKUP_CODE_BCRYPT_ROUNDS = 10
const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000
const DEFAULT_WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173'
const DEFAULT_WEBAUTHN_RP_ID =
  process.env.WEBAUTHN_RP_ID ||
  (() => {
    try {
      return new URL(DEFAULT_WEBAUTHN_ORIGIN).hostname
    } catch {
      return 'localhost'
    }
  })()

const anonymousPasskeyChallenges = new Map<string, number>()

const buildRefreshCookieOptions = (overrides?: Partial<CookieOptions>): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  ...overrides,
})

const resolveWebAuthnConfig = (req: Request) => {
  const originHeader = req.get('origin')
  const refererHeader = req.get('referer')
  const forwardedProto = req.get('x-forwarded-proto')
  const hostHeader = req.get('host')

  let origin = DEFAULT_WEBAUTHN_ORIGIN

  const candidates = [
    originHeader,
    refererHeader,
    forwardedProto && hostHeader ? `${forwardedProto}://${hostHeader}` : null,
    hostHeader ? `${req.protocol}://${hostHeader}` : null,
  ].filter((value): value is string => Boolean(value) && value !== 'null')

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate)
      origin = `${parsed.protocol}//${parsed.host}`
      break
    } catch {
      // Ignore invalid candidate
    }
  }

  let rpID = DEFAULT_WEBAUTHN_RP_ID
  try {
    rpID = new URL(origin).hostname
  } catch {
    rpID = req.hostname || DEFAULT_WEBAUTHN_RP_ID
  }

  return { origin, rpID }
}

function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) return undefined
  const cookies = cookieHeader.split(';').map((c) => c.trim())
  for (const c of cookies) {
    const [k, ...rest] = c.split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

const getBackupCodesRemaining = (codes?: ITwoFactorBackupCode[] | null): number => {
  if (!codes || codes.length === 0) return 0
  return codes.reduce((acc, code) => (code.used ? acc : acc + 1), 0)
}

const normalizeRecoveryCodeInput = (code: string): string => {
  const alphanumeric = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (alphanumeric.length >= 10) {
    return `${alphanumeric.slice(0, 5)}-${alphanumeric.slice(5, 10)}${
      alphanumeric.length > 10 ? alphanumeric.slice(10) : ''
    }`
  }
  if (alphanumeric.length === 0) return code.trim().toUpperCase()
  return alphanumeric
}

const createReadableBackupCode = (): string => {
  const random = crypto.randomBytes(5).toString('hex').toUpperCase()
  return `${random.slice(0, 5)}-${random.slice(5, 10)}`
}

const generateBackupCodes = async (): Promise<{
  plainCodes: string[]
  hashedCodes: ITwoFactorBackupCode[]
}> => {
  const plainCodes = Array.from({ length: TWO_FACTOR_BACKUP_CODE_COUNT }, () =>
    createReadableBackupCode(),
  )
  const hashedCodes = await Promise.all(
    plainCodes.map(async (code) => ({
      codeHash: await bcrypt.hash(code, BACKUP_CODE_BCRYPT_ROUNDS),
      used: false,
    })),
  )

  return { plainCodes, hashedCodes }
}

const verifyTotpToken = (secret: string, token: string): boolean => {
  const sanitized = token.replace(/\s+/g, '')
  if (sanitized.length < 6 || sanitized.length > 8) {
    return false
  }

  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: sanitized,
    window: 2,
  })
}

const findRecoveryCodeIndex = async (
  code: string,
  codes: ITwoFactorBackupCode[],
): Promise<number> => {
  const normalized = normalizeRecoveryCodeInput(code)

  for (let i = 0; i < codes.length; i += 1) {
    const entry = codes[i]
    if (entry.used) continue
    const matches = await bcrypt.compare(normalized, entry.codeHash)
    if (matches) {
      return i
    }
  }
  return -1
}

type VerifyTwoFactorOptions = {
  token?: string
  recoveryCode?: string
  allowRecovery?: boolean
  consumeRecoveryCode?: boolean
}

type VerifyTwoFactorResult =
  | { success: true; method: 'token' | 'recovery'; recoveryIndex?: number }
  | { success: false }

const verifyUserTwoFactor = async (
  user: IUser,
  { token, recoveryCode, allowRecovery = true, consumeRecoveryCode = true }: VerifyTwoFactorOptions,
): Promise<VerifyTwoFactorResult> => {
  if (!user.twoFactorSecret) {
    return { success: false }
  }

  if (token) {
    const cleanedToken = token.trim()
    if (cleanedToken && verifyTotpToken(user.twoFactorSecret, cleanedToken)) {
      user.twoFactorLastVerifiedAt = new Date()
      return { success: true, method: 'token' }
    }
  }

  if (allowRecovery && recoveryCode) {
    const codes = user.twoFactorBackupCodes || []
    if (codes.length > 0) {
      const recoveryIndex = await findRecoveryCodeIndex(recoveryCode, codes)
      if (recoveryIndex >= 0) {
        if (consumeRecoveryCode) {
          codes[recoveryIndex].used = true
          codes[recoveryIndex].usedAt = new Date()
        }
        user.twoFactorLastVerifiedAt = new Date()
        return { success: true, method: 'recovery', recoveryIndex }
      }
    }
  }

  return { success: false }
}

// Use the centralized maskPhoneForDisplay function
const maskPhoneNumber = maskPhoneForDisplay

const generateSmsCode = (): string => Math.floor(100000 + Math.random() * 900000).toString()

// Register Customer
// Account registration is email-only. Phone verification is handled by later flows.
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, role } = req.body

    // Use 'customer' as default role
    const userRole = role || 'customer'

    // Check if email exists for the same role
    const existingUser = await User.findOne({ email, role: userRole })
    if (existingUser) {
      return res.status(400).json({
        error: `This email is already registered as a ${userRole}. Please use a different email or login instead.`,
      })
    }

    // Check if phone exists for the same role
    // Note: Phone will be encrypted in pre-save hook, so we need to encrypt the search term too
    if (phone) {
      // Encrypt phone for search (to match encrypted stored phones)
      const encryptedPhone = encryptPhone(phone)
      const existingPhone = await User.findOne({ phone: encryptedPhone, role: userRole })
      if (existingPhone) {
        return res.status(400).json({
          error: `This phone number is already registered as a ${userRole}. Please use a different phone or login instead.`,
        })
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Generate email verification token
    const emailVerificationToken = generateToken()
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user - phone will be encrypted automatically by pre-save hook
    // IMPORTANT: Set phone as plain text - pre-save hook will encrypt it with current key
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone, // Plain text - will be encrypted by pre-save hook
      role: userRole,
      isEmailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
      isPhoneVerified: false,
    })
    await user.save() // Pre-save hook encrypts phone here

    try {
      // Send verification email
      const verificationUrl = `${
        process.env.FRONTEND_URL || 'http://localhost:5173'
      }/verify-email/${emailVerificationToken}`
      const emailResult = await sendEmail(
        email,
        'Verify Your Email - Kourier Boyz',
        emailTemplates.verifyEmail(name, verificationUrl, 'customer'),
      )

      if (!emailResult.success) {
        throw (
          emailResult.error || new Error(emailResult.reason || 'Failed to send verification email')
        )
      }

      return res.status(201).json({
        message: 'Registration successful! Please verify your email to activate your account.',
        emailSent: true,
        phoneSent: false,
        userId: user._id,
      })
    } catch (notifyErr) {
      console.error('Registration notification error, rolling back user:', notifyErr)
      try {
        await User.findByIdAndDelete(user._id)
      } catch {
        // ignore rollback failures
      }
      return res.status(500).json({
        error: 'Could not send verification email. Please try again in a few minutes.',
      })
    }
  } catch (err: any) {
    // Handle duplicate key error (email + role combination)
    if (err.code === 11000) {
      const userRole = req.body.role || 'customer'
      return res.status(400).json({
        error: `This email is already registered as a ${userRole}. Please use a different email or login instead.`,
      })
    }
    // Log the actual error for debugging
    console.error('Registration error:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

// Admin login - allows both 'super-admin' and 'user' roles
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body
    const clientIp = extractClientIp(req)
    const userAgent = req.headers['user-agent'] || 'unknown'

    // For admin login, allow both 'super-admin' and 'user' roles
    // Find user with email and either super-admin or user role
    const user = await User.findOne({
      email,
      role: { $in: ['super-admin', 'user'] },
    })

    if (!user) {
      // Check if email exists with different role
      const userWithEmail = await User.findOne({ email })
      if (userWithEmail) {
        void recordAdminActivity({
          email,
          action: 'admin_login',
          status: 'failure',
          ipAddress: clientIp,
          userAgent,
          metadata: {
            reason: 'non_admin_login_attempt',
            roleAttempted: role,
            existingRole: userWithEmail.role,
          },
        })
        return res.status(400).json({
          error: `This email is registered as a ${userWithEmail.role}, not as an admin user. Please use the correct login portal.`,
        })
      }
      void recordAdminActivity({
        email,
        action: 'admin_login',
        status: 'failure',
        ipAddress: clientIp,
        userAgent,
        metadata: { reason: 'email_not_found', roleAttempted: role },
      })
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      void recordAdminActivity({
        userId: user._id.toString(),
        email: user.email,
        action: 'admin_login',
        status: 'failure',
        ipAddress: clientIp,
        userAgent,
        metadata: { reason: 'invalid_password' },
      })
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      user.twoFactorPhoneCode = undefined
      user.twoFactorPhoneExpires = undefined
      user.twoFactorPhoneLastSentAt = undefined
      await user.save()

      const twoFactorToken = jwt.sign(
        { userId: user._id, role: user.role, twoFactorPending: true },
        JWT_SECRET,
        { expiresIn: TWO_FACTOR_TOKEN_TTL },
      )

      const responsePayload = {
        twoFactorRequired: true,
        twoFactorToken,
        message: 'Two-factor authentication required',
        backupCodesRemaining: getBackupCodesRemaining(user.twoFactorBackupCodes),
        canUseSms: !!(user.phone && user.isPhoneVerified),
        maskedPhone: user.phone
          ? maskPhoneForDisplay((user as any).getDecryptedPhone?.() || decryptPhone(user.phone))
          : undefined,
      }

      void recordAdminActivity({
        userId: user._id.toString(),
        email: user.email,
        action: 'admin_login',
        status: 'success',
        ipAddress: clientIp,
        userAgent,
        metadata: { twoFactorRequired: true },
      })

      return res.json(responsePayload)
    }

    const sessionVersion = user.sessionVersion ?? 0
    const tokenPayload = { userId: user._id, role: user.role, sessionVersion }
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' })
    const refreshToken = jwt.sign(tokenPayload, REFRESH_SECRET, {
      expiresIn: '7d',
    })

    res.cookie('refreshToken', refreshToken, buildRefreshCookieOptions())

    void recordAdminActivity({
      userId: user._id.toString(),
      email: user.email,
      action: 'admin_login',
      status: 'success',
      ipAddress: clientIp,
      userAgent,
      metadata: { role: user.role },
    })

    res.json({ token, role: user.role, name: user.name, email: user.email, userId: user._id })
  } catch (err: any) {
    console.error('Admin login error:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body

    // Default role to 'customer' for frontend login (if not provided)
    // This prevents ambiguity when same email exists for multiple roles
    const userRole = role || 'customer'

    // Find user with specific email + role combination
    const user = await User.findOne({ email, role: userRole })

    if (!user) {
      // Check if email exists with different role
      const userWithEmail = await User.findOne({ email })
      if (userWithEmail && role) {
        return res.status(400).json({
          error: `This email is registered as a ${userWithEmail.role}, not as a ${role}. Please select the correct role or use a different email.`,
        })
      }
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' })

    // Check if customer is blocked
    if (user.role === 'customer' && user.isBlocked) {
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message:
          user.blockedReason ||
          'Your account has been blocked. Please contact support for more information.',
        blockedReason: user.blockedReason,
      })
    }

    // Check if email is verified for customers
    if (user.role === 'customer' && !user.isEmailVerified) {
      return res.status(400).json({
        error: 'EMAIL_NOT_VERIFIED',
        message:
          'Please verify your email before signing in. Check your inbox for the verification link.',
      })
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      user.twoFactorPhoneCode = undefined
      user.twoFactorPhoneExpires = undefined
      user.twoFactorPhoneLastSentAt = undefined
      await user.save()

      const twoFactorToken = jwt.sign(
        { userId: user._id, role: user.role, twoFactorPending: true },
        JWT_SECRET,
        { expiresIn: TWO_FACTOR_TOKEN_TTL },
      )

      return res.json({
        twoFactorRequired: true,
        twoFactorToken,
        message: 'Two-factor authentication required',
        backupCodesRemaining: getBackupCodesRemaining(user.twoFactorBackupCodes),
        canUseSms: !!(user.phone && user.isPhoneVerified),
        maskedPhone: user.phone
          ? maskPhoneForDisplay((user as any).getDecryptedPhone?.() || decryptPhone(user.phone))
          : undefined,
      })
    }

    const sessionVersion = user.sessionVersion ?? 0
    const tokenPayload = { userId: user._id, role: user.role, sessionVersion }
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' })
    const refreshToken = jwt.sign(tokenPayload, REFRESH_SECRET, {
      expiresIn: '7d',
    })

    res.cookie('refreshToken', refreshToken, buildRefreshCookieOptions())

    res.json({ token, role: user.role, name: user.name, email: user.email, userId: user._id })
  } catch (err: any) {
    console.error('Login error:', err)
    res.status(500).json({ error: err.message || 'Server error' })
  }
}

// Verify Email
// Helper function to send welcome SMS when account is fully verified
const sendWelcomeSmsIfFullyVerified = async (user: IUser) => {
  // Only send welcome SMS for customers when both email and phone are verified
  if (user.role === 'customer' && user.isEmailVerified && user.isPhoneVerified && user.phone) {
    try {
      // Decrypt phone number for SMS
      const decryptedPhone = (user as any).getDecryptedPhone?.() || decryptPhone(user.phone)
      if (!decryptedPhone) {
        console.error('Cannot send welcome SMS: phone number decryption failed')
        return
      }

      const smsTemplate = getSmsTemplate(SmsTemplateType.ACCOUNT_WELCOME, {
        name: user.name,
      })
      void sendSms(decryptedPhone, smsTemplate.message, {
        templateId: smsTemplate.templateId || undefined,
      })
    } catch (smsError) {
      // Don't fail verification if SMS fails
      console.error('Error sending welcome SMS:', smsError)
    }
  }
}

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    })

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' })
    }

    const wasPhoneVerified = user.isPhoneVerified

    // Idempotent: mark email as verified but keep token valid until expiry,
    // so multiple clicks on the same link (or React dev double-renders) don't break UX.
    user.isEmailVerified = true
    await user.save()

    // Send welcome SMS if both email and phone are now verified
    if (wasPhoneVerified) {
      await sendWelcomeSmsIfFullyVerified(user)
    }

    res.json({
      message: 'Email verified successfully!',
      userId: user._id.toString(),
      phoneNumber: user.phone
        ? maskPhoneForDisplay((user as any).getDecryptedPhone?.() || decryptPhone(user.phone))
        : undefined,
      needsPhoneVerification: false,
    })
  } catch (err: unknown) {
    console.error('Error verifying email:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Verify Phone
export const verifyPhone = async (req: Request, res: Response) => {
  try {
    const { userId, code } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.isPhoneVerified) {
      return res.status(400).json({ error: 'Phone is already verified' })
    }

    if (user.phoneVerificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' })
    }

    if (user.phoneVerificationExpires && new Date() > user.phoneVerificationExpires) {
      return res.status(400).json({ error: 'Verification code has expired' })
    }

    const wasEmailVerified = user.isEmailVerified
    user.isPhoneVerified = true
    user.phoneVerificationCode = undefined
    user.phoneVerificationExpires = undefined
    await user.save()

    // Send welcome SMS if both email and phone are now verified
    if (wasEmailVerified) {
      await sendWelcomeSmsIfFullyVerified(user)
    }

    res.json({ message: 'Phone verified successfully!' })
  } catch (err: unknown) {
    console.error('Error verifying phone:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Resend Phone Verification Code
export const resendPhoneCode = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.isPhoneVerified) {
      return res.status(400).json({ error: 'Phone is already verified' })
    }

    const phoneVerificationCode = Math.floor(100000 + Math.random() * 900000).toString()
    const phoneVerificationExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    user.phoneVerificationCode = phoneVerificationCode
    user.phoneVerificationExpires = phoneVerificationExpires
    await user.save()

    // Send SMS (phone verification code)
    // Using ACCOUNT_CREATION_OTP template (1707176646657465999) for initial account verification
    // This is only sent for registered users, NOT for guest checkout
    if (user.phone) {
      try {
        // Decrypt phone number for SMS using centralized helper
        const phoneResult = getPhoneFromUser(user, userId, 'Resend Phone Code')

        if (!phoneResult.isDecryptable || !phoneResult.phone) {
          if (phoneResult.error === 'key_mismatch') {
            return res.status(400).json({
              error:
                'Unable to send SMS. Your phone number was encrypted with a different key. Please update your phone number in profile settings.',
            })
          }
          return res.status(500).json({
            error: 'Failed to process phone number. Please contact support.',
          })
        }

        const decryptedPhone = phoneResult.phone

        const smsTemplate = getSmsTemplate(SmsTemplateType.ACCOUNT_CREATION_OTP, {
          name: user.name,
          otp: phoneVerificationCode,
        })
        const smsResult = await sendSms(decryptedPhone, smsTemplate.message, {
          templateId: smsTemplate.templateId || undefined, // Template ID: 1707176646657465999
        })
        if (smsResult.success) {
          console.log(
            `[Resend Phone Code] SMS sent to ${maskPhoneForDisplay(
              decryptedPhone,
            )} for user ${userId}`,
          )
        } else if (!smsResult.skipped) {
          console.error(
            `[Resend Phone Code] Failed to send SMS to ${maskPhoneForDisplay(decryptedPhone)}:`,
            smsResult.error,
          )
        }
      } catch (smsError) {
        // Don't fail the request if SMS fails, but log the error
        console.error(`[Resend Phone Code] Error sending SMS:`, smsError)
        return res.status(500).json({
          error: 'Failed to send SMS. Please try again or contact support.',
        })
      }
    } else {
      console.warn(`[Resend Phone Code] User ${userId} has no phone number. SMS not sent.`)
      return res.status(400).json({ error: 'No phone number found for this user' })
    }

    res.json({ message: 'Verification code sent successfully!' })
  } catch (err: unknown) {
    console.error('Error resending phone verification code:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Resend Verification Email
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body

    const userRole = role || 'customer'
    const user = await User.findOne({ email, role: userRole })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email is already verified' })
    }

    const emailVerificationToken = generateToken()
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

    user.emailVerificationToken = emailVerificationToken
    user.emailVerificationExpires = emailVerificationExpires
    await user.save()

    const verificationUrl = `${
      process.env.FRONTEND_URL || 'http://localhost:5173'
    }/verify-email/${emailVerificationToken}`
    const emailResult = await sendEmail(
      email,
      'Verify Your Email - Kourier Boyz',
      emailTemplates.verifyEmail(user.name, verificationUrl, userRole),
    )

    if (!emailResult.success) {
      return res.status(500).json({
        error: 'Could not send verification email. Please try again in a few minutes.',
      })
    }

    res.json({ message: 'Verification email sent successfully!' })
  } catch (err: unknown) {
    console.error('Error resending verification email:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get verification status by userId (public endpoint)
export const getVerificationStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params

    const user = await User.findById(userId).select(
      '_id email isEmailVerified isPhoneVerified phone',
    )

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      needsPhoneVerification: false,
    })
  } catch (err: unknown) {
    console.error('Error getting verification status:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Example protected route
export const getProfile = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId
  const user = await User.findById(userId)
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  const passkeys = (user.passkeys || []).map((passkey) => ({
    id: base64url.encode(passkey.credentialID),
    nickname: passkey.nickname,
    createdAt: passkey.createdAt,
    lastUsedAt: passkey.lastUsedAt,
    transports: passkey.transports,
  }))

  // Check if user has a password
  const hasPassword = !!(user.password && user.password.trim().length > 0)

  const payload = user.toObject() as any

  // Build response object explicitly, excluding password and phone initially
  // This ensures encrypted phone is NEVER included in the response
  const userData: any = {}

  // Copy all fields except password and phone
  for (const key in payload) {
    if (key !== 'password' && key !== 'phone') {
      userData[key] = payload[key]
    }
  }

  // Decrypt phone number for display using centralized helper
  // Users should always see their own phone number (decrypted, not hashed/masked)
  // IMPORTANT: Only add phone back if we can decrypt it - never return encrypted string
  let decryptedPhone: string | undefined = undefined

  if (user.phone || user.isPhoneVerified) {
    console.log(
      `[getProfile] Attempting to decrypt phone for user ${userId}. Original phone length: ${
        user.phone?.length || 0
      }`,
    )
    const phoneResult = getPhoneFromUser(user, userId, 'Get Profile')
    console.log(`[getProfile] Phone decryption result:`, {
      isDecryptable: phoneResult.isDecryptable,
      isPlainText: phoneResult.isPlainText,
      hasPhone: !!phoneResult.phone,
      error: phoneResult.error,
      phoneLength: phoneResult.phone?.length || 0,
    })

    if (phoneResult.isDecryptable && phoneResult.phone) {
      // Successfully decrypted - show full phone number to user (it's their own data)
      decryptedPhone = phoneResult.phone
      console.log(`[getProfile] Successfully decrypted phone for user ${userId}`)
    } else if (phoneResult.isPlainText && phoneResult.phone) {
      // Plain text phone - show it
      decryptedPhone = phoneResult.phone
      console.log(`[getProfile] Phone is plain text for user ${userId}`)
    } else {
      // Can't decrypt - phone was encrypted with old key
      console.warn(
        `[getProfile] Cannot decrypt phone for user ${userId}. Error: ${
          phoneResult.error || 'unknown'
        }, ErrorMessage: ${phoneResult.errorMessage || 'none'}`,
      )
      // NEVER show encrypted string - leave decryptedPhone as undefined
      decryptedPhone = undefined
    }
  }

  // Only add phone to response if we have a valid decrypted phone
  // NEVER include encrypted phone in response
  if (decryptedPhone) {
    // Final validation: ensure it's not encrypted
    const phoneStr = String(decryptedPhone)
    const isBase64Encrypted = phoneStr.length >= 50 && /^[A-Za-z0-9+/=]+$/.test(phoneStr)
    if (!isBase64Encrypted) {
      userData.phone = decryptedPhone
      console.log(`[getProfile] Adding decrypted phone to response for user ${userId}`)
    } else {
      console.error(
        `[getProfile] CRITICAL: Decrypted phone still looks encrypted for user ${userId}. Not including in response.`,
      )
    }
  } else {
    console.log(
      `[getProfile] No decrypted phone available for user ${userId}. Phone field will not be included in response.`,
    )
  }
  // If decryptedPhone is undefined, phone field is simply not included in response

  // Final safety check: Ensure phone is NOT in userData before building response
  if (userData.phone) {
    const phoneStr = String(userData.phone)
    const isBase64Encrypted = phoneStr.length >= 50 && /^[A-Za-z0-9+/=]+$/.test(phoneStr)
    if (isBase64Encrypted) {
      console.error(
        `[getProfile] CRITICAL: Encrypted phone found in userData before response for user ${userId}. Removing it immediately.`,
      )
      delete userData.phone
    }
  }

  const response = {
    ...userData,
    hasPassword,
    passkeys,
    passkeyRegistrationChallenge: undefined,
    passkeyAuthenticationChallenge: undefined,
  }

  // Final final check: Remove phone from response if it's still encrypted
  if (response.phone) {
    const phoneStr = String(response.phone)
    const isBase64Encrypted = phoneStr.length >= 50 && /^[A-Za-z0-9+/=]+$/.test(phoneStr)
    if (isBase64Encrypted) {
      console.error(
        `[getProfile] CRITICAL: Encrypted phone in final response object for user ${userId}. Removing it.`,
      )
      delete (response as any).phone
    }
  }

  console.log(
    `[getProfile] Final response for user ${userId} - phone field:`,
    response.phone ? `present (length: ${String(response.phone).length})` : 'NOT PRESENT',
  )
  res.json(response)
}

// Send OTP for email/phone update
export const sendUpdateOTP = async (req: Request, res: Response) => {
  try {
    const { email, phone } = req.body
    const userId = (req as any).user.userId

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const emailChanged = email && email !== user.email
    const emailNeedsVerification = email && (!user.isEmailVerified || emailChanged)

    const phoneChanged = phone && phone !== user.phone
    const phoneNeedsVerification =
      phone && (!user.isPhoneVerified || phoneChanged) && phone.trim().length > 0

    // Check if email already exists (only if changing)
    if (emailChanged) {
      const existingEmailUser = await User.findOne({ email, role: user.role })
      if (existingEmailUser) {
        return res.status(400).json({ error: 'Email already in use' })
      }
    }

    // Check if phone already exists (only if changing)
    if (phoneChanged) {
      const existingPhoneUser = await User.findOne({ phone, role: user.role })
      if (existingPhoneUser) {
        return res.status(400).json({ error: 'Phone number already in use' })
      }
    }

    const otpExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    // Only send OTP for fields that are actually being changed
    if (emailNeedsVerification) {
      // Generate and store email OTP
      const emailOTP = Math.floor(100000 + Math.random() * 900000).toString()
      ;(user as any).tempEmailOTP = emailOTP
      ;(user as any).tempEmailOTPExpires = otpExpires

      // Send email OTP (via real email + still logged in sendEmail for debugging)
      const toEmail = email || user.email
      if (toEmail) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
            <div style="background-color: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <h1 style="color: #2563eb; margin-bottom: 16px;">Kourier Boyz Email Verification Code</h1>
              <p style="font-size: 15px; color: #374151; margin-bottom: 12px;">
                Hi ${user.name || 'there'},
              </p>
              <p style="font-size: 14px; color: #4b5563; margin-bottom: 12px;">
                Use the following one-time code to verify your email address change for your Kourier Boyz account:
              </p>
              <div style="background-color: #f3f4f6; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 24px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #111827; font-family: 'Courier New', monospace;">
                ${emailOTP}
              </div>
              <p style="font-size: 13px; color: #6b7280; margin-bottom: 8px;">
                This code will expire in 10 minutes. If you did not request this change on Kourier Boyz, you can safely ignore this email.
              </p>
            </div>
          </div>
        `
        void sendEmail(toEmail, 'Your Kourier Boyz email verification code', html)
      }
    }

    if (phoneNeedsVerification) {
      // Check cooldown for phone OTP resend
      const now = Date.now()
      if (
        (user as any).phoneVerificationOtpLastSentAt &&
        now - (user as any).phoneVerificationOtpLastSentAt.getTime() <
          PROFILE_PHONE_OTP_RESEND_COOLDOWN_MS
      ) {
        const retryAfter = Math.ceil(
          (PROFILE_PHONE_OTP_RESEND_COOLDOWN_MS -
            (now - (user as any).phoneVerificationOtpLastSentAt.getTime())) /
            1000,
        )
        return res.status(429).json({
          error: 'Please wait before requesting another OTP',
          retryAfter,
        })
      }

      // Generate and store phone OTP
      const phoneOTP = Math.floor(100000 + Math.random() * 900000).toString()
      user.phoneVerificationCode = phoneOTP
      user.phoneVerificationExpires = otpExpires
      ;(user as any).phoneVerificationOtpLastSentAt = new Date(now)

      // Send phone OTP via SMS
      // Using ACCOUNT_CREATION_OTP template (1507163272041260154) for phone verification
      // When a new phone is provided, it's plain text from user input - always use it for OTP
      let phoneToUse: string | undefined

      if (phone) {
        // New phone provided - should be plain text from frontend input
        // Extract digits only and validate format
        const digitsOnly = phone.replace(/\D/g, '')
        if (/^[6-9]\d{9}$/.test(digitsOnly)) {
          // Valid Indian mobile number format - use it directly for sending OTP
          phoneToUse = digitsOnly
        } else {
          // Invalid phone format - try to get from helper (in case it's encrypted)
          const phoneResult = safeDecryptPhoneForSms(phone, userId, 'Send Update OTP')
          if (phoneResult.isDecryptable && phoneResult.phone) {
            phoneToUse = phoneResult.phone
          } else if (phoneResult.isPlainText && phoneResult.phone) {
            phoneToUse = phoneResult.phone
          } else {
            // If new phone is invalid, fall back to existing phone
            const existingPhoneResult = getPhoneFromUser(user, userId, 'Send Update OTP')
            if (existingPhoneResult.isDecryptable && existingPhoneResult.phone) {
              phoneToUse = existingPhoneResult.phone
            } else if (existingPhoneResult.isPlainText && existingPhoneResult.phone) {
              phoneToUse = existingPhoneResult.phone
            }
          }
        }
      } else {
        // No new phone provided, decrypt existing phone
        const phoneResult = getPhoneFromUser(user, userId, 'Send Update OTP')
        if (phoneResult.isDecryptable && phoneResult.phone) {
          phoneToUse = phoneResult.phone
        } else if (phoneResult.isPlainText && phoneResult.phone) {
          phoneToUse = phoneResult.phone
        }
      }

      if (!phoneToUse) {
        return res.status(400).json({
          error:
            'Unable to send SMS. Please provide a valid phone number or update your phone number in profile settings.',
        })
      }

      const smsTemplate = getSmsTemplate(SmsTemplateType.ACCOUNT_CREATION_OTP, {
        name: user.name,
        otp: phoneOTP,
      })
      try {
        const smsResult = await sendSms(phoneToUse, smsTemplate.message, {
          templateId: smsTemplate.templateId || undefined, // Template ID: 1707176646657465999
        })
        if (smsResult.success) {
          console.log(
            `[Send Update OTP] Phone OTP SMS sent to ${maskPhoneForDisplay(
              phoneToUse,
            )} for user ${userId}`,
          )
        } else if (!smsResult.skipped) {
          console.error(
            `[Send Update OTP] Failed to send phone OTP SMS to ${maskPhoneForDisplay(phoneToUse)}:`,
            smsResult.error,
          )
        }
      } catch (smsError) {
        console.error(
          `[Send Update OTP] Error sending SMS to ${maskPhoneForDisplay(phoneToUse)}:`,
          smsError,
        )
      }
    }

    await user.save()

    res.json({ message: 'OTP sent successfully' })
  } catch (err: unknown) {
    console.error('Error sending update OTP:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Resend Phone OTP for Profile Update
export const resendProfilePhoneOTP = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId
    const { phone } = req.body // Optional: new phone number if user is changing it

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check cooldown
    const now = Date.now()
    if (
      (user as any).phoneVerificationOtpLastSentAt &&
      now - (user as any).phoneVerificationOtpLastSentAt.getTime() <
        PROFILE_PHONE_OTP_RESEND_COOLDOWN_MS
    ) {
      const retryAfter = Math.ceil(
        (PROFILE_PHONE_OTP_RESEND_COOLDOWN_MS -
          (now - (user as any).phoneVerificationOtpLastSentAt.getTime())) /
          1000,
      )
      return res.status(429).json({
        error: 'Please wait before requesting another OTP',
        retryAfter,
      })
    }

    // Generate new 6-digit OTP
    const phoneOTP = Math.floor(100000 + Math.random() * 900000).toString()
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    user.phoneVerificationCode = phoneOTP
    user.phoneVerificationExpires = otpExpires
    ;(user as any).phoneVerificationOtpLastSentAt = new Date(now)
    await user.save()

    // Determine which phone number to use for sending OTP
    let phoneToUse: string | undefined

    if (phone) {
      // New phone provided - should be plain text from frontend input
      // Extract digits only and validate format
      const digitsOnly = phone.replace(/\D/g, '')
      if (/^[6-9]\d{9}$/.test(digitsOnly)) {
        // Valid Indian mobile number format - use it directly for sending OTP
        phoneToUse = digitsOnly
      } else {
        // Invalid phone format - try to get from helper (in case it's encrypted)
        const phoneResult = safeDecryptPhoneForSms(phone, userId, 'Resend Profile Phone OTP')
        if (phoneResult.isDecryptable && phoneResult.phone) {
          phoneToUse = phoneResult.phone
        } else if (phoneResult.isPlainText && phoneResult.phone) {
          phoneToUse = phoneResult.phone
        }
      }
    }

    // If no new phone provided or new phone is invalid, use existing phone
    if (!phoneToUse) {
      if (!user.phone) {
        return res.status(400).json({ error: 'No phone number found' })
      }

      // Decrypt existing phone number for SMS using centralized helper
      const phoneResult = getPhoneFromUser(user, userId, 'Resend Profile Phone OTP')

      if (!phoneResult.isDecryptable || !phoneResult.phone) {
        if (phoneResult.error === 'key_mismatch') {
          return res.status(400).json({
            error:
              'Unable to send SMS. Your phone number was encrypted with a different key. Please update your phone number in profile settings.',
          })
        }
        return res.status(500).json({ error: 'Failed to process phone number' })
      }

      phoneToUse = phoneResult.phone
    }

    // Send SMS to the determined phone number
    const smsTemplate = getSmsTemplate(SmsTemplateType.ACCOUNT_CREATION_OTP, {
      name: user.name,
      otp: phoneOTP,
    })
    const smsResult = await sendSms(phoneToUse, smsTemplate.message, {
      templateId: smsTemplate.templateId || undefined, // Template ID: 1507163272041260154
    })

    console.log('\n📱 ============ PROFILE PHONE OTP (RESEND) ============')
    console.log(`To: ${maskPhoneForDisplay(phoneToUse)}`)
    console.log(`Code: ${phoneOTP}`)
    console.log('This code will expire in 10 minutes')
    console.log('================================================\n')

    if (smsResult.success) {
      console.log(`✅ Profile phone OTP SMS sent successfully`)
    } else if (!smsResult.skipped) {
      console.error(`❌ Failed to send profile phone OTP SMS:`, smsResult.error)
    }

    res.json({
      message: 'OTP resent successfully',
      retryAfter: Math.floor(PROFILE_PHONE_OTP_RESEND_COOLDOWN_MS / 1000),
    })
  } catch (err: unknown) {
    console.error('Error resending profile phone OTP:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Verify OTP and update profile
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const { name, email, phone, emailOTP, phoneOTP, dateOfBirth, gender, gstNumber } = req.body
    const userId = (req as any).user.userId

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if email is being changed and validate OTP
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, role: user.role })
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' })
      }

      // Verify email OTP
      if (!emailOTP || (user as any).tempEmailOTP !== emailOTP) {
        return res.status(400).json({ error: 'Invalid email OTP' })
      }

      if ((user as any).tempEmailOTPExpires && new Date() > (user as any).tempEmailOTPExpires) {
        return res.status(400).json({ error: 'Email OTP has expired' })
      }

      user.email = email
      ;(user as any).tempEmailOTP = undefined
      ;(user as any).tempEmailOTPExpires = undefined
      user.isEmailVerified = true
    } else if (email && email === user.email && !user.isEmailVerified) {
      if (!emailOTP || (user as any).tempEmailOTP !== emailOTP) {
        return res.status(400).json({ error: 'Invalid email OTP' })
      }

      if ((user as any).tempEmailOTPExpires && new Date() > (user as any).tempEmailOTPExpires) {
        return res.status(400).json({ error: 'Email OTP has expired' })
      }

      user.isEmailVerified = true
      ;(user as any).tempEmailOTP = undefined
      ;(user as any).tempEmailOTPExpires = undefined
    }

    // Check if phone is being changed and validate OTP
    // Decrypt current phone for comparison
    let currentDecryptedPhone: string | undefined
    try {
      currentDecryptedPhone = (user as any).getDecryptedPhone?.() || decryptPhone(user.phone)
    } catch (decryptError) {
      // If decryption fails, the phone was encrypted with a different key
      // We'll treat it as a new phone number that needs to be set
      console.log(
        `[updateProfile] Cannot decrypt existing phone for user ${userId}. Will re-encrypt with new phone.`,
      )
      currentDecryptedPhone = undefined
    }

    if (phone && phone !== currentDecryptedPhone) {
      // Verify phone OTP
      if (!phoneOTP || user.phoneVerificationCode !== phoneOTP) {
        return res.status(400).json({ error: 'Invalid phone OTP' })
      }

      if (user.phoneVerificationExpires && new Date() > user.phoneVerificationExpires) {
        return res.status(400).json({ error: 'Phone OTP has expired' })
      }

      // IMPORTANT: Set phone as plain text - pre-save hook will encrypt it with CURRENT key
      // This ensures phones encrypted with old keys get re-encrypted with the new key
      console.log(
        `[updateProfile] Setting new phone for user ${userId}. Will be encrypted with current key.`,
      )
      ;(user as any).phone = phone // Set as plain text - pre-save hook will encrypt
      user.phoneVerificationCode = undefined
      user.phoneVerificationExpires = undefined
      user.isPhoneVerified = true
    } else if (phone && phone === currentDecryptedPhone && !user.isPhoneVerified) {
      // Phone number matches, just verifying (not changing)
      if (!phoneOTP || user.phoneVerificationCode !== phoneOTP) {
        return res.status(400).json({ error: 'Invalid phone OTP' })
      }

      if (user.phoneVerificationExpires && new Date() > user.phoneVerificationExpires) {
        return res.status(400).json({ error: 'Phone OTP has expired' })
      }

      // If phone was encrypted with old key, re-encrypt it with current key
      if (currentDecryptedPhone && currentDecryptedPhone === phone) {
        console.log(
          `[updateProfile] Re-encrypting existing phone for user ${userId} with current key.`,
        )
        ;(user as any).phone = phone // Set as plain text - pre-save hook will encrypt
      }

      user.isPhoneVerified = true
      user.phoneVerificationCode = undefined
      user.phoneVerificationExpires = undefined
    }

    // Update name if provided
    if (name) user.name = name

    // Update dateOfBirth if provided
    if (dateOfBirth !== undefined && dateOfBirth !== null) {
      if (typeof dateOfBirth === 'string' && dateOfBirth.trim() !== '') {
        const date = new Date(dateOfBirth)
        if (!isNaN(date.getTime())) {
          user.dateOfBirth = date
        }
      } else if (dateOfBirth === '') {
        // Allow clearing the date of birth
        user.dateOfBirth = undefined
      }
    }

    // Update gender if provided
    if (gender !== undefined) {
      user.gender = gender
    }

    // Update GST number if provided
    if (gstNumber !== undefined) {
      // Allow clearing GST (empty string)
      if (gstNumber === '' || gstNumber === null) {
        user.gstNumber = undefined
      } else {
        // Validate GST format: 15 characters - 2 digits + 5 letters + 4 digits + 1 letter + 1 letter/digit + Z + 1 letter/digit
        const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
        const trimmedGst = gstNumber.trim().toUpperCase()

        if (!gstPattern.test(trimmedGst)) {
          return res.status(400).json({
            error:
              'Invalid GST number format. Please enter a valid GST number (e.g., 22AAAAA0000A1Z5)',
          })
        }

        user.gstNumber = trimmedGst
      }
    }

    await user.save()

    // Remove password from response
    const userResponse = user.toObject() as { password?: string }
    delete userResponse.password

    res.json(userResponse)
  } catch (err: unknown) {
    console.error('Error updating profile:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Change Password (for customers)
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = (req as any).user.userId

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if user has a password (not an OAuth-only user)
    const hasPassword = user.password && user.password.trim().length > 0

    // If user has a password, require currentPassword to change it
    if (hasPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' })
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password)
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' })
      }
    }
    // If user doesn't have a password (OAuth user), allow setting password without currentPassword

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashedPassword
    // Clear OAuth provider when password is set (user can now login with email/password)
    // Note: We keep oauthProvider so user can still use Google login if they want
    await user.save()

    res.json({
      message: hasPassword
        ? 'Password changed successfully!'
        : 'Password set successfully! You can now log in with your email and password.',
    })
  } catch (err: unknown) {
    console.error('Error changing password:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const getTwoFactorStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(userId).select(
      'twoFactorEnabled twoFactorEnabledAt twoFactorBackupCodes twoFactorTempSecret twoFactorTempSecretCreatedAt twoFactorLastVerifiedAt email',
    )

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      enabled: !!user.twoFactorEnabled,
      enabledAt: user.twoFactorEnabledAt,
      backupCodesRemaining: getBackupCodesRemaining(user.twoFactorBackupCodes),
      hasPendingSetup: !!user.twoFactorTempSecret,
      tempSecretCreatedAt: user.twoFactorTempSecretCreatedAt,
      lastVerifiedAt: user.twoFactorLastVerifiedAt,
    })
  } catch (err) {
    console.error('Error fetching 2FA status:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const initiateTwoFactorSetup = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: 'Two-factor authentication is already enabled' })
    }

    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${TWO_FACTOR_ISSUER} (${user.email})`,
      issuer: TWO_FACTOR_ISSUER,
    })

    if (!secret.otpauth_url) {
      return res.status(500).json({ error: 'Failed to generate authenticator secret' })
    }

    user.twoFactorTempSecret = secret.base32
    user.twoFactorTempSecretCreatedAt = new Date()
    await user.save()

    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url)

    res.json({
      message: 'Two-factor setup initiated',
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeDataUrl,
    })
  } catch (err) {
    console.error('Error initiating 2FA setup:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const activateTwoFactor = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { code } = req.body as { code?: string }

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authentication code is required' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!user.twoFactorTempSecret || !user.twoFactorTempSecretCreatedAt) {
      return res.status(400).json({ error: 'No pending setup found. Please start again.' })
    }

    const isExpired =
      Date.now() - user.twoFactorTempSecretCreatedAt.getTime() > TWO_FACTOR_SETUP_SECRET_TTL_MS
    if (isExpired) {
      user.twoFactorTempSecret = undefined
      user.twoFactorTempSecretCreatedAt = undefined
      await user.save()
      return res.status(400).json({ error: 'Setup session expired. Please restart setup.' })
    }

    const isValid = verifyTotpToken(user.twoFactorTempSecret, code)
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid authentication code' })
    }

    const { plainCodes, hashedCodes } = await generateBackupCodes()

    user.twoFactorSecret = user.twoFactorTempSecret
    user.twoFactorEnabled = true
    user.twoFactorEnabledAt = new Date()
    user.twoFactorTempSecret = undefined
    user.twoFactorTempSecretCreatedAt = undefined
    user.twoFactorBackupCodes = hashedCodes
    user.twoFactorLastVerifiedAt = new Date()
    user.twoFactorPhoneCode = undefined
    user.twoFactorPhoneExpires = undefined
    user.twoFactorPhoneLastSentAt = undefined
    await user.save()

    res.json({
      message: 'Two-factor authentication enabled successfully',
      backupCodes: plainCodes,
      backupCodesRemaining: plainCodes.length,
    })
  } catch (err) {
    console.error('Error activating 2FA:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const regenerateTwoFactorBackupCodes = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { code } = req.body as { code?: string }

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Authentication code is required' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled' })
    }

    const verifyResult = await verifyUserTwoFactor(user, {
      token: code,
      allowRecovery: false,
      consumeRecoveryCode: false,
    })

    if (!verifyResult.success) {
      return res.status(400).json({ error: 'Invalid authentication code' })
    }

    const { plainCodes, hashedCodes } = await generateBackupCodes()

    user.twoFactorBackupCodes = hashedCodes
    user.twoFactorLastVerifiedAt = new Date()
    user.twoFactorPhoneCode = undefined
    user.twoFactorPhoneExpires = undefined
    user.twoFactorPhoneLastSentAt = undefined
    await user.save()

    res.json({
      message: 'Backup codes regenerated successfully',
      backupCodes: plainCodes,
      backupCodesRemaining: plainCodes.length,
    })
  } catch (err) {
    console.error('Error regenerating 2FA codes:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const disableTwoFactor = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    const { code, recoveryCode } = req.body as { code?: string; recoveryCode?: string }

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    if (
      (!code || typeof code !== 'string') &&
      (!recoveryCode || typeof recoveryCode !== 'string')
    ) {
      return res.status(400).json({ error: 'Provide an authentication or recovery code' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Two-factor authentication is not enabled' })
    }

    const verifyResult = await verifyUserTwoFactor(user, {
      token: code,
      recoveryCode,
      allowRecovery: true,
      consumeRecoveryCode: true,
    })

    if (!verifyResult.success) {
      return res.status(400).json({ error: 'Invalid authentication or recovery code' })
    }

    user.twoFactorEnabled = false
    user.twoFactorSecret = undefined
    user.twoFactorBackupCodes = []
    user.twoFactorEnabledAt = undefined
    user.twoFactorLastVerifiedAt = undefined
    user.twoFactorTempSecret = undefined
    user.twoFactorTempSecretCreatedAt = undefined
    user.twoFactorPhoneCode = undefined
    user.twoFactorPhoneExpires = undefined
    user.twoFactorPhoneLastSentAt = undefined
    await user.save()

    res.json({
      message:
        'Two-factor authentication disabled successfully. Remove this account entry from your authenticator app to avoid confusion later.',
    })
  } catch (err) {
    console.error('Error disabling 2FA:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const sendTwoFactorLoginCode = async (req: Request, res: Response) => {
  try {
    const { token } = req.body as { token?: string }

    if (!token) {
      return res.status(400).json({ error: 'Two-factor token is required' })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      role: string
      twoFactorPending?: boolean
    }

    if (!decoded.twoFactorPending) {
      return res.status(400).json({ error: 'Invalid two-factor token' })
    }

    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!user.phone) {
      return res.status(400).json({
        error:
          'No phone number is associated with this account. Use your authenticator app instead.',
      })
    }

    if (!user.isPhoneVerified) {
      return res.status(400).json({
        error: 'Your phone number is not verified. Use your authenticator app or a recovery code.',
      })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res
        .status(400)
        .json({ error: 'Two-factor authentication is not enabled for this account' })
    }

    const now = Date.now()
    if (
      user.twoFactorPhoneLastSentAt &&
      now - user.twoFactorPhoneLastSentAt.getTime() < TWO_FACTOR_SMS_RESEND_COOLDOWN_MS
    ) {
      const retryAfter = Math.ceil(
        (TWO_FACTOR_SMS_RESEND_COOLDOWN_MS - (now - user.twoFactorPhoneLastSentAt.getTime())) /
          1000,
      )
      return res
        .status(429)
        .json({ error: 'Please wait before requesting another code', retryAfter })
    }

    const smsCode = generateSmsCode()
    user.twoFactorPhoneCode = smsCode
    user.twoFactorPhoneExpires = new Date(now + TWO_FACTOR_SMS_CODE_TTL_MS)
    user.twoFactorPhoneLastSentAt = new Date(now)
    await user.save()

    // Send 2FA SMS code
    // Using LOGIN_OTP template (1707176646654514096) for phone-based 2FA login
    let decryptedPhone: string | undefined
    try {
      // Decrypt phone number for SMS using centralized helper
      const phoneResult = getPhoneFromUser(user, String(user._id), '2FA Login')

      if (!phoneResult.isDecryptable || !phoneResult.phone) {
        if (phoneResult.error === 'key_mismatch') {
          // Phone was encrypted with old key - suggest using authenticator app
          return res.status(400).json({
            error:
              'Unable to send SMS to your phone number. Your phone number was encrypted with a different key. Please use your authenticator app or update your phone number in profile settings.',
            useAuthenticator: true, // Hint to frontend to show authenticator option
          })
        } else {
          return res.status(500).json({
            error:
              'Unable to send SMS. Please update your phone number in profile settings and try again.',
          })
        }
      }

      decryptedPhone = phoneResult.phone

      const smsTemplate = getSmsTemplate(SmsTemplateType.LOGIN_OTP, {
        name: user.name,
        otp: smsCode,
      })
      const smsResult = await sendSms(decryptedPhone, smsTemplate.message, {
        templateId: smsTemplate.templateId || undefined, // Template ID: 1707176646654514096
      })
      if (smsResult.success) {
        console.log(
          `[2FA Login] SMS code sent to ${maskPhoneForDisplay(decryptedPhone)} for user ${
            user._id
          }`,
        )
      } else if (!smsResult.skipped) {
        console.error(
          `[2FA Login] Failed to send SMS code to ${maskPhoneForDisplay(decryptedPhone)}:`,
          smsResult.error,
        )
      }
      // Also log to console for debugging
      console.log('\n📱 ============ 2FA LOGIN SMS CODE ============')
      console.log(`To: ${maskPhoneForDisplay(decryptedPhone)}`)
      console.log(`Code: ${smsCode}`)
      console.log('This code will expire in 5 minutes')
      console.log('=============================================\n')
    } catch (smsError) {
      // Don't fail the request if SMS fails, but log the error
      console.error(`[2FA Login] Error sending SMS code:`, smsError)
      // Still log the code for debugging
      console.log('\n📱 ============ 2FA LOGIN SMS CODE (SMS FAILED) ============')
      console.log(`Code: ${smsCode}`)
      console.log('This code will expire in 5 minutes')
      console.log('=============================================\n')
      // Return error to user
      return res.status(500).json({
        error: 'Failed to send SMS. Please try again or contact support.',
      })
    }

    res.json({
      message: 'Verification code sent to your phone number.',
      expiresIn: Math.floor(TWO_FACTOR_SMS_CODE_TTL_MS / 1000),
      retryAfter: Math.floor(TWO_FACTOR_SMS_RESEND_COOLDOWN_MS / 1000),
      maskedPhone: decryptedPhone ? maskPhoneNumber(decryptedPhone) : undefined,
    })
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Two-factor token expired. Please login again.' })
    }
    console.error('Error sending two-factor login code:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const verifyTwoFactorLogin = async (req: Request, res: Response) => {
  try {
    const { token, code, recoveryCode, smsCode } = req.body as {
      token?: string
      code?: string
      recoveryCode?: string
      smsCode?: string
    }

    if (!token) {
      return res.status(400).json({ error: 'Two-factor token is required' })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string
      role: string
      twoFactorPending?: boolean
    }

    if (!decoded.twoFactorPending) {
      return res.status(400).json({ error: 'Invalid two-factor token' })
    }

    const user = await User.findById(decoded.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if customer is blocked
    if (user.role === 'customer' && user.isBlocked) {
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message:
          user.blockedReason ||
          'Your account has been blocked. Please contact support for more information.',
        blockedReason: user.blockedReason,
      })
    }

    // Check if buyer account is deactivated
    if (user.role === 'customer' && user.buyerLifecycleStatus === 'DEACTIVATED') {
      return res.status(403).json({
        error: 'ACCOUNT_DEACTIVATED',
        message:
          'Your account has been deactivated. You cannot log in to a deactivated account. Please contact support if you need to reactivate your account.',
      })
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res
        .status(400)
        .json({ error: 'Two-factor authentication is not enabled for this account' })
    }

    const hasAuthenticatorCode = !!(code && typeof code === 'string')
    const hasRecoveryCode = !!(recoveryCode && typeof recoveryCode === 'string')
    const hasSmsCode = !!(smsCode && typeof smsCode === 'string')

    if (!hasAuthenticatorCode && !hasRecoveryCode && !hasSmsCode) {
      return res
        .status(400)
        .json({ error: 'Provide an authenticator code, recovery code, or SMS verification code.' })
    }

    let authMethod: 'totp' | 'recovery' | 'sms' = 'totp'
    let usedRecoveryCode = false
    let usedSmsCode = false

    if (hasSmsCode) {
      if (!user.phone || !user.isPhoneVerified) {
        return res.status(400).json({
          error:
            'SMS verification is not available for this account. Use your authenticator code instead.',
        })
      }

      if (!user.twoFactorPhoneCode || !user.twoFactorPhoneExpires) {
        return res
          .status(400)
          .json({ error: 'No SMS verification code was requested. Send a new code first.' })
      }

      if (new Date() > user.twoFactorPhoneExpires) {
        return res
          .status(400)
          .json({ error: 'SMS verification code has expired. Request a new code.' })
      }

      const sanitizedSmsCode = smsCode.trim()
      if (user.twoFactorPhoneCode !== sanitizedSmsCode) {
        return res.status(400).json({ error: 'Invalid SMS verification code' })
      }

      authMethod = 'sms'
      usedSmsCode = true
    } else {
      const verifyResult = await verifyUserTwoFactor(user, {
        token: code,
        recoveryCode,
        allowRecovery: true,
        consumeRecoveryCode: true,
      })

      if (!verifyResult.success) {
        return res.status(400).json({ error: 'Invalid authentication or recovery code' })
      }

      if (verifyResult.method === 'recovery') {
        authMethod = 'recovery'
        usedRecoveryCode = true
      } else {
        authMethod = 'totp'
      }
    }

    user.twoFactorPhoneCode = undefined
    user.twoFactorPhoneExpires = undefined
    user.twoFactorPhoneLastSentAt = undefined
    await user.save()

    const sessionVersion = user.sessionVersion ?? 0
    const tokenPayload = { userId: user._id, role: user.role, sessionVersion }
    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: '15m',
    })
    const refreshToken = jwt.sign(tokenPayload, REFRESH_SECRET, {
      expiresIn: '7d',
    })

    res.cookie('refreshToken', refreshToken, buildRefreshCookieOptions())

    res.json({
      token: accessToken,
      role: user.role,
      name: user.name,
      email: user.email,
      userId: user._id,
      backupCodesRemaining: getBackupCodesRemaining(user.twoFactorBackupCodes),
      usedRecoveryCode,
      usedSmsCode,
      authMethod,
    })
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Two-factor token expired. Please login again.' })
    }
    console.error('Error verifying two-factor login:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const getPasskeyRegistrationOptions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Passkey registration works for all authenticated users regardless of:
    // - How they created their account (OAuth, email/password, etc.)
    // - Whether they have a password set
    // - Whether they have phone numbers (passkeys don't use phone)
    const { rpID } = resolveWebAuthnConfig(req)
    const options = await createRegistrationOptions(user, { rpID })
    user.passkeyRegistrationChallenge = options.challenge
    await user.save()

    res.json(options)
  } catch (err) {
    console.error('Error generating passkey registration options:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const verifyPasskeyRegistration = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { credential, nickname } = req.body as {
      credential: Parameters<typeof verifyRegistration>[2]
      nickname?: string
    }

    if (!credential) {
      return res.status(400).json({ error: 'Missing credential response' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Passkey registration works for all authenticated users (OAuth, password, etc.)
    // No password requirement - only requires user to be logged in
    if (!user.passkeyRegistrationChallenge) {
      return res.status(400).json({ error: 'No registration in progress' })
    }

    const { origin, rpID } = resolveWebAuthnConfig(req)
    const verification = await verifyRegistration(
      user,
      user.passkeyRegistrationChallenge,
      credential,
      { origin, rpID },
    )
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey registration failed' })
    }

    const { credentialPublicKey, credentialID, counter } = verification.registrationInfo

    const transports =
      credential.response.transports && Array.isArray(credential.response.transports)
        ? credential.response.transports
        : undefined

    user.passkeys = user.passkeys || []
    user.passkeys.push({
      credentialID: Buffer.from(credentialID),
      credentialPublicKey: Buffer.from(credentialPublicKey),
      counter,
      transports,
      nickname: nickname?.slice(0, 50),
      createdAt: new Date(),
      lastUsedAt: new Date(),
    })
    user.passkeyRegistrationChallenge = undefined
    await user.save()

    res.json({ message: 'Passkey registered successfully' })
  } catch (err) {
    console.error('Error verifying passkey registration:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const getPasskeyAuthenticationOptions = async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body as { email?: string; role?: string }
    const userRole = role || 'customer'
    const { rpID } = resolveWebAuthnConfig(req)

    if (email) {
      // Find user by email and role - no phone access needed
      const user = await User.findOne({ email, role: userRole })
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Check if customer is blocked
      if (user.role === 'customer' && user.isBlocked) {
        return res.status(403).json({
          error: 'ACCOUNT_BLOCKED',
          message:
            user.blockedReason ||
            'Your account has been blocked. Please contact support for more information.',
          blockedReason: user.blockedReason,
        })
      }

      if (!user.passkeys || user.passkeys.length === 0) {
        return res.status(400).json({ error: 'No passkeys registered for this account' })
      }

      const options = await createAuthenticationOptions(user, { rpID })
      user.passkeyAuthenticationChallenge = options.challenge
      await user.save()

      // Return user data without phone - encrypted phone numbers won't cause issues
      res.json({
        options,
        userId: user._id,
        name: user.name,
        email: user.email,
      })
      return
    }

    const options = await createDiscoverableAuthenticationOptions({ rpID })
    anonymousPasskeyChallenges.set(options.challenge, Date.now())
    res.json({ options })
  } catch (err) {
    console.error('Error generating passkey authentication options:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const verifyPasskeyLogin = async (req: Request, res: Response) => {
  try {
    const { credential, challenge } = req.body as {
      credential: Parameters<typeof verifyAuthentication>[2]
      challenge?: string
    }

    if (!credential) {
      return res.status(400).json({ error: 'Missing credential response' })
    }

    const credentialIDBuffer = base64url.toBuffer(credential.rawId)
    const credentialIDBase64 = base64url.encode(credentialIDBuffer)
    
    // Find user by passkey credential ID
    // MongoDB Buffer comparison in queries can be unreliable, so we use a more robust approach
    // Get all users with passkeys and manually compare Buffer values
    const usersWithPasskeys = await User.find({ 
      passkeys: { $exists: true, $ne: [] } 
    })
    
    let user: IUser | null = null
    for (const candidateUser of usersWithPasskeys) {
      if (candidateUser.passkeys && candidateUser.passkeys.length > 0) {
        for (const passkey of candidateUser.passkeys) {
          if (passkey.credentialID) {
            // Use Buffer.equals() for reliable comparison
            try {
              if (passkey.credentialID.equals(credentialIDBuffer)) {
                user = candidateUser
                break
              }
            } catch (error) {
              // If equals() fails, try comparing base64 encoded values as fallback
              try {
                const storedCredentialIDBase64 = base64url.encode(passkey.credentialID)
                if (storedCredentialIDBase64 === credentialIDBase64) {
                  user = candidateUser
                  break
                }
              } catch (fallbackError) {
                console.warn('Error comparing credential IDs:', fallbackError)
              }
            }
          }
        }
        if (user) break
      }
    }
    
    if (!user) {
      console.error('Passkey login failed: No user found with credential ID:', credentialIDBase64)
      console.error('Total users with passkeys checked:', usersWithPasskeys.length)
      return res.status(404).json({ error: 'No account associated with this passkey' })
    }

    // Check if customer is blocked (same check as regular login)
    if (user.role === 'customer' && user.isBlocked) {
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message:
          user.blockedReason ||
          'Your account has been blocked. Please contact support for more information.',
        blockedReason: user.blockedReason,
      })
    }

    let expectedChallenge: string | undefined
    if (user.passkeyAuthenticationChallenge) {
      expectedChallenge = user.passkeyAuthenticationChallenge
      if (challenge && challenge !== expectedChallenge) {
        return res.status(400).json({ error: 'Authentication session mismatch' })
      }
      user.passkeyAuthenticationChallenge = undefined
    } else if (challenge && anonymousPasskeyChallenges.has(challenge)) {
      expectedChallenge = challenge
      anonymousPasskeyChallenges.delete(challenge)
    } else {
      return res.status(400).json({ error: 'No authentication in progress' })
    }

    // Clean up expired anonymous challenges
    const now = Date.now()
    for (const [storedChallenge, timestamp] of anonymousPasskeyChallenges.entries()) {
      if (now - timestamp > PASSKEY_CHALLENGE_TTL_MS) {
        anonymousPasskeyChallenges.delete(storedChallenge)
      }
    }

    const { origin, rpID } = resolveWebAuthnConfig(req)
    const verification = await verifyAuthentication(user, expectedChallenge, credential, {
      origin,
      rpID,
    })

    if (!verification.verified || !verification.authenticationInfo) {
      return res.status(400).json({ error: 'Passkey authentication failed' })
    }

    const { newCounter } = verification.authenticationInfo
    updateAuthenticatorCounter(user, credential.rawId, newCounter)
    user.passkeyAuthenticationChallenge = undefined
    await user.save()

    const sessionVersion = user.sessionVersion ?? 0
    const tokenPayload = { userId: user._id, role: user.role, sessionVersion }
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' })
    const refreshToken = jwt.sign(tokenPayload, REFRESH_SECRET, {
      expiresIn: '7d',
    })

    res.cookie('refreshToken', refreshToken, buildRefreshCookieOptions())

    // Return user data without phone - passkey authentication doesn't need phone access
    // Encrypted phone numbers won't cause issues since we never access them
    res.json({
      token,
      role: user.role,
      name: user.name,
      email: user.email,
      userId: user._id,
    })
  } catch (err) {
    console.error('Error verifying passkey login:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const removePasskey = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId
    if (!userId) return res.status(401).json({ error: 'Not authenticated' })

    const { passkeyId } = req.params as { passkeyId?: string }
    if (!passkeyId) {
      return res.status(400).json({ error: 'Passkey ID is required' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const credentialID = base64url.toBuffer(passkeyId)
    const passkeys = user.passkeys || []
    const index = passkeys.findIndex((passkey) => passkey.credentialID.equals(credentialID))

    if (index === -1) {
      return res.status(404).json({ error: 'Passkey not found' })
    }

    passkeys.splice(index, 1)
    user.passkeys = passkeys
    await user.save()

    res.json({ message: 'Passkey removed successfully' })
  } catch (err) {
    console.error('Error removing passkey:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

export const refreshAdmin = async (req: Request, res: Response) => {
  try {
    // Try to get refresh token from cookie first, then from request body as fallback
    let token = getCookie(req, 'refreshToken')
    if (!token && req.body?.refreshToken) {
      token = req.body.refreshToken
    }
    if (!token) {
      console.error('[refreshAdmin] No refresh token found in cookie or body')
      return res.status(401).json({ error: 'No refresh token', message: 'Please log in again' })
    }
    const decoded = jwt.verify(token, REFRESH_SECRET) as {
      userId: string
      role: string
      sessionVersion?: number
    }

    const user = await User.findById(decoded.userId).select(
      'role isBlocked blockedReason sessionVersion',
    )
    if (!user) {
      res.clearCookie('refreshToken', buildRefreshCookieOptions({ maxAge: 0 }))
      return res.status(401).json({ error: 'Invalid refresh token' })
    }

    // Check if customer is blocked (if refreshing customer token)
    if (user.role === 'customer' && user.isBlocked) {
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message:
          user.blockedReason ||
          'Your account has been blocked. Please contact support for more information.',
        blockedReason: user.blockedReason,
      })
    }

    const currentSessionVersion = user.sessionVersion ?? 0
    if ((decoded.sessionVersion ?? 0) !== currentSessionVersion) {
      res.clearCookie('refreshToken', buildRefreshCookieOptions({ maxAge: 0 }))
      return res.status(401).json({ error: 'Session expired. Please log in again.' })
    }

    const tokenPayload = {
      userId: user._id,
      role: user.role,
      sessionVersion: currentSessionVersion,
    }
    const newAccess = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: '15m',
    })
    return res.json({ token: newAccess })
  } catch (e) {
    res.clearCookie('refreshToken', buildRefreshCookieOptions({ maxAge: 0 }))
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
}

// Refresh token for customers (general refresh)
export const refresh = async (req: Request, res: Response) => {
  try {
    const token = getCookie(req, 'refreshToken')
    if (!token) return res.status(401).json({ error: 'No refresh token' })
    const decoded = jwt.verify(token, REFRESH_SECRET) as {
      userId: string
      role: string
      sessionVersion?: number
    }

    const user = await User.findById(decoded.userId).select(
      'role isBlocked blockedReason sessionVersion',
    )
    if (!user) {
      res.clearCookie('refreshToken', buildRefreshCookieOptions({ maxAge: 0 }))
      return res.status(401).json({ error: 'Invalid refresh token' })
    }

    // Check if customer is blocked
    if (user.role === 'customer' && user.isBlocked) {
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message:
          user.blockedReason ||
          'Your account has been blocked. Please contact support for more information.',
        blockedReason: user.blockedReason,
      })
    }

    const currentSessionVersion = user.sessionVersion ?? 0
    if ((decoded.sessionVersion ?? 0) !== currentSessionVersion) {
      res.clearCookie('refreshToken', buildRefreshCookieOptions({ maxAge: 0 }))
      return res.status(401).json({ error: 'Session expired. Please log in again.' })
    }

    // Generate new access token
    const newAccess = jwt.sign(
      { userId: user._id, role: user.role, sessionVersion: currentSessionVersion },
      JWT_SECRET,
      {
        expiresIn: '15m',
      },
    )
    return res.json({ token: newAccess })
  } catch (e) {
    res.clearCookie('refreshToken', buildRefreshCookieOptions({ maxAge: 0 }))
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
}

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie(
    'refreshToken',
    buildRefreshCookieOptions({
      maxAge: 0,
    }),
  )
  return res.status(200).json({ success: true })
}

// Send Login OTP
export const sendLoginOTP = async (req: Request, res: Response) => {
  try {
    const { phone, role } = req.body

    const userRole = role || 'customer'
    // Encrypt phone for search (to match encrypted stored phones)
    const encryptedPhone = encryptPhone(phone)
    const user = await User.findOne({ phone: encryptedPhone, role: userRole })

    if (!user) {
      return res.status(404).json({ error: 'Phone number not found' })
    }

    // Check if customer is blocked
    if (user.role === 'customer' && user.isBlocked) {
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message:
          user.blockedReason ||
          'Your account has been blocked. Please contact support for more information.',
        blockedReason: user.blockedReason,
      })
    }

    // Generate 6-digit OTP
    const loginOTP = Math.floor(100000 + Math.random() * 900000).toString()
    const loginOTPExpires = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    user.phoneVerificationCode = loginOTP
    user.phoneVerificationExpires = loginOTPExpires
    await user.save()

    // Decrypt phone number for SMS
    const decryptedPhone = (user as any).getDecryptedPhone?.() || decryptPhone(user.phone)
    if (!decryptedPhone) {
      return res.status(500).json({ error: 'Failed to process phone number' })
    }

    // Send SMS
    const smsTemplate = getSmsTemplate(SmsTemplateType.ACCOUNT_CREATION_OTP, {
      name: user.name,
      otp: loginOTP,
    })
    const smsResult = await sendSms(decryptedPhone, smsTemplate.message, {
      templateId: smsTemplate.templateId || undefined, // Template ID: 1507163272041260154
    })

    console.log('\n📱 ============ LOGIN OTP ============')
    console.log(`To: ${maskPhoneForDisplay(decryptedPhone)}`)
    console.log(`OTP: ${loginOTP}`)
    console.log('This code will expire in 5 minutes')
    console.log('=====================================\n')

    if (smsResult.success) {
      console.log(`✅ Login OTP SMS sent successfully`)
    } else if (!smsResult.skipped) {
      console.error(`❌ Failed to send login OTP SMS:`, smsResult.error)
    }

    res.json({ message: 'Login OTP sent successfully!', userId: user._id })
  } catch (err: unknown) {
    console.error('Error sending login OTP:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Verify Login OTP
export const verifyLoginOTP = async (req: Request, res: Response) => {
  try {
    const { userId, otp } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Check if customer is blocked
    if (user.role === 'customer' && user.isBlocked) {
      return res.status(403).json({
        error: 'ACCOUNT_BLOCKED',
        message:
          user.blockedReason ||
          'Your account has been blocked. Please contact support for more information.',
        blockedReason: user.blockedReason,
      })
    }

    if (user.phoneVerificationCode !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' })
    }

    if (user.phoneVerificationExpires && new Date() > user.phoneVerificationExpires) {
      return res.status(400).json({ error: 'OTP has expired' })
    }

    // Clear OTP fields
    user.phoneVerificationCode = undefined
    user.phoneVerificationExpires = undefined
    await user.save()

    const sessionVersion = user.sessionVersion ?? 0
    const tokenPayload = { userId: user._id, role: user.role, sessionVersion }
    // Generate JWT tokens
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' })
    const refreshToken = jwt.sign(tokenPayload, REFRESH_SECRET, {
      expiresIn: '7d',
    })

    res.cookie('refreshToken', refreshToken, buildRefreshCookieOptions())

    res.json({ token, role: user.role, name: user.name, email: user.email, userId: user._id })
  } catch (err: unknown) {
    console.error('Error verifying login OTP:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Forgot Password - Initiate (Check email and return available options)
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email, role } = req.body

    const userRole = role || 'customer'
    const user = await User.findOne({ email, role: userRole })

    if (!user) {
      // Don't reveal if email exists for security
      return res.status(200).json({
        message: 'If an account exists with this email, password reset options will be available.',
        options: {
          phoneOtp: false,
          emailLink: false,
        },
      })
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(400).json({
        error: 'Please verify your email first before resetting password.',
      })
    }

    // Check if phone is verified - if yes, offer both options
    const phoneVerified = !!(user.phone && user.isPhoneVerified)

    res.json({
      message: 'Password reset options available',
      userId: user._id,
      options: {
        phoneOtp: phoneVerified,
        emailLink: true, // Always available if email is verified
      },
      maskedPhone: phoneVerified ? maskPhoneNumber(user.phone) : undefined,
    })
  } catch (err: unknown) {
    console.error('Error in forgot password:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Forgot Password - Send OTP via Phone
export const forgotPasswordViaPhone = async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body

    const userRole = role || 'customer'
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify role matches
    if (user.role !== userRole) {
      return res.status(400).json({ error: 'Invalid user role' })
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(400).json({
        error: 'Please verify your email first before resetting password.',
      })
    }

    // Check if phone is verified
    if (!user.phone || !user.isPhoneVerified) {
      return res.status(400).json({
        error: 'Phone number is not verified. Please use email reset option instead.',
      })
    }

    // Decrypt phone number for SMS
    // Decrypt phone number for SMS using centralized helper
    // Check for originalPhone first (for deactivated accounts)
    const phoneToCheck = (user as any).originalPhone || user.phone
    const phoneResult = safeDecryptPhoneForSms(phoneToCheck, userId, 'Password Reset')

    if (!phoneResult.isDecryptable || !phoneResult.phone) {
      if (phoneResult.error === 'key_mismatch') {
        return res.status(400).json({
          error:
            'Unable to send SMS. Your phone number was encrypted with a different key. Please update your phone number in profile settings.',
        })
      }
      return res.status(500).json({
        error: 'Failed to process phone number. Please contact support.',
      })
    }

    const phoneToUse = phoneResult.phone

    // Check cooldown if OTP was recently sent
    const now = Date.now()
    if (
      (user as any).passwordResetOtpLastSentAt &&
      now - (user as any).passwordResetOtpLastSentAt.getTime() <
        PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS
    ) {
      const retryAfter = Math.ceil(
        (PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS -
          (now - (user as any).passwordResetOtpLastSentAt.getTime())) /
          1000,
      )
      return res.status(429).json({
        error: 'Please wait before requesting another OTP',
        retryAfter,
      })
    }

    // Generate 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString()
    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    user.phoneVerificationCode = resetCode
    user.phoneVerificationExpires = resetCodeExpires
    ;(user as any).passwordResetOtpLastSentAt = new Date(now)
    await user.save()

    // Send SMS with password reset OTP
    // Using PASSWORD_RESET_OTP template (1707176646651301634) for password reset
    const smsTemplate = getSmsTemplate(SmsTemplateType.PASSWORD_RESET_OTP, {
      name: user.name,
      otp: resetCode,
    })

    console.log('\n📱 ============ PASSWORD RESET OTP ============')
    console.log(`To: ${phoneToUse}`)
    console.log(`Code: ${resetCode}`)
    console.log(`Template ID: ${smsTemplate.templateId || 'N/A'}`)
    console.log(`Message: ${smsTemplate.message}`)
    console.log('This code will expire in 10 minutes')
    console.log('================================================\n')

    const smsResult = await sendSms(phoneToUse, smsTemplate.message, {
      templateId: smsTemplate.templateId || undefined, // Template ID: 1707176646651301634
    })

    if (smsResult.success) {
      console.log(`✅ Password reset OTP SMS sent successfully to ${phoneToUse}`)
    } else if (smsResult.skipped) {
      console.warn(`⚠️ Password reset OTP SMS skipped: ${smsResult.reason || 'Unknown reason'}`)
    } else {
      console.error(`❌ Failed to send password reset OTP SMS to ${phoneToUse}:`, smsResult.error)
      // Still return success to user (don't reveal SMS failure for security)
      // But log the error for monitoring
    }

    res.json({
      message: 'Password reset OTP has been sent to your verified phone number.',
      userId: user._id,
      expiresIn: 600, // 10 minutes in seconds
      retryAfter: Math.floor(PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS / 1000), // Cooldown in seconds
    })
  } catch (err: unknown) {
    console.error('Error sending password reset OTP:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Resend Password Reset OTP via Phone
export const resendPasswordResetOtp = async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body

    const userRole = role || 'customer'
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify role matches
    if (user.role !== userRole) {
      return res.status(400).json({ error: 'Invalid user role' })
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(400).json({
        error: 'Please verify your email first before resetting password.',
      })
    }

    // Check if phone is verified
    if (!user.phone || !user.isPhoneVerified) {
      return res.status(400).json({
        error: 'Phone number is not verified. Please use email reset option instead.',
      })
    }

    // Decrypt phone number for SMS
    const phoneToUse = (user as any).getDecryptedPhone?.() || decryptPhone(user.phone)

    // Validate phone number format
    if (!phoneToUse) {
      console.error(`❌ No valid phone number found for user ${userId}`)
      return res.status(500).json({
        error: 'No phone number found. Please contact support.',
      })
    }

    const phoneDigits = phoneToUse.replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      console.error(
        `❌ Invalid phone number format for user ${userId}: "${phoneToUse}". Phone number is too short.`,
      )
      return res.status(500).json({
        error: 'Invalid phone number format. Please contact support.',
      })
    }

    // Check cooldown
    const now = Date.now()
    if (
      (user as any).passwordResetOtpLastSentAt &&
      now - (user as any).passwordResetOtpLastSentAt.getTime() <
        PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS
    ) {
      const retryAfter = Math.ceil(
        (PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS -
          (now - (user as any).passwordResetOtpLastSentAt.getTime())) /
          1000,
      )
      return res.status(429).json({
        error: 'Please wait before requesting another OTP',
        retryAfter,
      })
    }

    // Generate new 6-digit reset code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString()
    const resetCodeExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    user.phoneVerificationCode = resetCode
    user.phoneVerificationExpires = resetCodeExpires
    ;(user as any).passwordResetOtpLastSentAt = new Date(now)
    await user.save()

    // Send SMS with password reset OTP
    const smsTemplate = getSmsTemplate(SmsTemplateType.PASSWORD_RESET_OTP, {
      name: user.name,
      otp: resetCode,
    })

    console.log('\n📱 ============ PASSWORD RESET OTP (RESEND) ============')
    console.log(`To: ${maskPhoneForDisplay(phoneToUse)}`)
    console.log(`Code: ${resetCode}`)
    console.log(`Template ID: ${smsTemplate.templateId || 'N/A'}`)
    console.log(`Message: ${smsTemplate.message}`)
    console.log('This code will expire in 10 minutes')
    console.log('================================================\n')

    const smsResult = await sendSms(phoneToUse, smsTemplate.message, {
      templateId: smsTemplate.templateId || undefined,
    })

    if (smsResult.success) {
      console.log(
        `✅ Password reset OTP SMS (RESEND) sent successfully to ${maskPhoneForDisplay(
          phoneToUse,
        )}`,
      )
    } else if (smsResult.skipped) {
      console.warn(
        `⚠️ Password reset OTP SMS (RESEND) skipped: ${smsResult.reason || 'Unknown reason'}`,
      )
    } else {
      console.error(
        `❌ Failed to send password reset OTP SMS (RESEND) to ${phoneToUse}:`,
        smsResult.error,
      )
      // Still return success to user (don't reveal SMS failure for security)
      // But log the error for monitoring
    }

    res.json({
      message: 'Password reset OTP has been resent to your verified phone number.',
      userId: user._id,
      expiresIn: 600, // 10 minutes in seconds
      retryAfter: Math.floor(PASSWORD_RESET_OTP_RESEND_COOLDOWN_MS / 1000), // Cooldown in seconds
    })
  } catch (err: unknown) {
    console.error('Error resending password reset OTP:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Forgot Password - Send Reset Link via Email
export const forgotPasswordViaEmail = async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body

    const userRole = role || 'customer'
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify role matches
    if (user.role !== userRole) {
      return res.status(400).json({ error: 'Invalid user role' })
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(400).json({
        error: 'Please verify your email first before resetting password.',
      })
    }

    // Generate reset token
    const resetToken = generateToken()
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    user.resetPasswordToken = resetToken
    user.resetPasswordExpires = resetTokenExpires
    await user.save()

    // Send email with reset link
    const resetUrl = `${
      process.env.FRONTEND_URL || 'http://localhost:5173'
    }/reset-password?token=${resetToken}&userId=${user._id}`
    await sendEmail(
      user.email,
      'Reset Your Password - Kourier Boyz',
      emailTemplates.resetPassword(user.name, resetUrl),
    )

    res.json({
      message: 'Password reset link has been sent to your email address.',
      userId: user._id,
    })
  } catch (err: unknown) {
    console.error('Error sending password reset email:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Reset Password (supports both phone OTP and email token methods)
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { userId, code, token, password } = req.body

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // Method 1: Phone OTP verification
    if (code) {
      if (user.phoneVerificationCode !== code) {
        return res.status(400).json({ error: 'Invalid reset code' })
      }

      if (user.phoneVerificationExpires && new Date() > user.phoneVerificationExpires) {
        return res.status(400).json({ error: 'Reset code has expired' })
      }

      // Update password
      const hashedPassword = await bcrypt.hash(password, 10)
      user.password = hashedPassword
      user.phoneVerificationCode = undefined
      user.phoneVerificationExpires = undefined
      await user.save()

      return res.json({ message: 'Password reset successfully!' })
    }

    // Method 2: Email token verification
    if (token) {
      if (user.resetPasswordToken !== token) {
        return res.status(400).json({ error: 'Invalid reset token' })
      }

      if (!user.resetPasswordExpires || new Date() > user.resetPasswordExpires) {
        return res.status(400).json({ error: 'Reset token has expired' })
      }

      // Update password
      const hashedPassword = await bcrypt.hash(password, 10)
      user.password = hashedPassword
      user.resetPasswordToken = undefined
      user.resetPasswordExpires = undefined
      await user.save()

      return res.json({ message: 'Password reset successfully!' })
    }

    return res
      .status(400)
      .json({ error: 'Either code (phone OTP) or token (email link) is required' })
  } catch (err: unknown) {
    console.error('Error resetting password:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Google OAuth Authentication
export const googleOAuth = async (req: Request, res: Response) => {
  try {
    const { code } = req.body

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' })
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
    // Use "postmessage" for OAuth redirect URI (required for @react-oauth/google auth-code flow)
    const GOOGLE_REDIRECT_URI = 'postmessage'

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error('Google OAuth credentials not configured')
      return res.status(500).json({ error: 'OAuth configuration error' })
    }

    // Create OAuth2 client
    const oauth2Client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI,
    )

    // Exchange authorization code for tokens
    let tokens
    try {
      const { tokens: tokenData } = await oauth2Client.getToken(code)
      tokens = tokenData
      oauth2Client.setCredentials(tokens)
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', error)
      console.error('Redirect URI configured:', GOOGLE_REDIRECT_URI)
      console.error('Client ID:', GOOGLE_CLIENT_ID ? 'Set' : 'Missing')
      console.error('Client Secret:', GOOGLE_CLIENT_SECRET ? 'Set' : 'Missing')

      // Provide more specific error message
      const errorMessage = error?.message || 'Invalid authorization code'
      return res.status(400).json({
        error: 'Invalid authorization code',
        details: errorMessage,
        hint: 'Check that GOOGLE_REDIRECT_URI matches the redirect URI in Google Cloud Console',
      })
    }

    // Get user info from Google
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return res.status(400).json({ error: 'Failed to get user information from Google' })
    }

    const { sub: googleId, email, name, picture } = payload

    if (!email) {
      return res.status(400).json({ error: 'Email not provided by Google' })
    }

    // Default role to 'customer' for OAuth
    const userRole = 'customer'

    // Check if user exists with this email and role
    const existingUser = await User.findOne({ email, role: userRole })

    if (existingUser) {
      // Check if customer is blocked
      if (existingUser.isBlocked) {
        return res.status(403).json({
          error: 'ACCOUNT_BLOCKED',
          message:
            existingUser.blockedReason ||
            'Your account has been blocked. Please contact support for more information.',
          blockedReason: existingUser.blockedReason,
        })
      }

      // Link Google account if user registered with email/password
      // This allows users to sign in with either method
      if (existingUser.password && !existingUser.oauthProvider) {
        // Link Google account to existing account
        existingUser.googleId = googleId
        existingUser.oauthProvider = 'google'
        // Mark email as verified since Google verified it
        existingUser.isEmailVerified = true
        // Update profile picture if available
        if (picture && !existingUser.profilePhoto) {
          existingUser.profilePhoto = picture
        }
        // Update name if Google provides one and existing name is just email prefix
        if (name && existingUser.name === email.split('@')[0]) {
          existingUser.name = name
        }
        await existingUser.save()
      } else {
        // User exists with Google OAuth - login
        // Update Google ID if not set
        if (!existingUser.googleId) {
          existingUser.googleId = googleId
          existingUser.oauthProvider = 'google'
        }

        // Update profile picture if available
        if (picture && !existingUser.profilePhoto) {
          existingUser.profilePhoto = picture
        }

        await existingUser.save()
      }

      const sessionVersion = existingUser.sessionVersion ?? 0
      const tokenPayload = { userId: existingUser._id, role: existingUser.role, sessionVersion }
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' })
      const refreshToken = jwt.sign(tokenPayload, REFRESH_SECRET, {
        expiresIn: '7d',
      })

      res.cookie('refreshToken', refreshToken, buildRefreshCookieOptions())

      return res.json({
        token,
        role: existingUser.role,
        name: existingUser.name,
        email: existingUser.email,
        userId: existingUser._id,
        requiresPhoneVerification: existingUser.requiresPhoneVerification || false,
      })
    }

    // New user - create account
    const newUser = new User({
      name: name || email.split('@')[0],
      email,
      googleId,
      oauthProvider: 'google',
      role: userRole,
      isEmailVerified: true, // Google already verified the email
      requiresPhoneVerification: true, // Require phone verification for OAuth signups
      profilePhoto: picture,
      // No password for OAuth users
    })

    await newUser.save()

    const sessionVersion = newUser.sessionVersion ?? 0
    const tokenPayload = { userId: newUser._id, role: newUser.role, sessionVersion }
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '15m' })
    const refreshToken = jwt.sign(tokenPayload, REFRESH_SECRET, {
      expiresIn: '7d',
    })

    res.cookie('refreshToken', refreshToken, buildRefreshCookieOptions())

    res.json({
      token,
      role: newUser.role,
      name: newUser.name,
      email: newUser.email,
      userId: newUser._id,
      requiresPhoneVerification: true,
    })
  } catch (err: unknown) {
    console.error('Google OAuth error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
