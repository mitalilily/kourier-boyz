import bcrypt from 'bcryptjs'
import { Request, Response, type CookieOptions } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import Agreement from '../models/Agreement'
import User from '../models/User'
import { shippingProviderService } from '../services/shippingProvider.service'
import { emailTemplates, generateToken, sendEmail } from '../utils/email'
import { generatePDFFromHTML } from '../utils/pdfGenerator'
import { getPhoneFromUser } from '../utils/phoneDecryptionHelper'
import { uploadToR2 } from '../utils/r2Upload'

const isProduction = process.env.NODE_ENV === 'production'
const PICKUP_SYNC_ERROR = 'SHIPPING_PROVIDER_SYNC_FAILED'
const PICKUP_INVALID_PAYLOAD_ERROR = 'INVALID_PICKUP_ADDRESSES_PAYLOAD'
const PICKUP_WAREHOUSE_REQUIRED_ERROR = 'PICKUP_WAREHOUSE_REQUIRED'
const PICKUP_WAREHOUSE_DUPLICATE_ERROR = 'PICKUP_WAREHOUSE_DUPLICATE'
const PICKUP_RTO_REQUIRED_ERROR = 'PICKUP_RTO_REQUIRED'
const PICKUP_PHONE_INVALID_ERROR = 'PICKUP_PHONE_INVALID'

const normalizeBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim()
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

const buildPanelUrl = (baseUrl: string | undefined, path: string): string => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  if (!baseUrl) {
    return `[SELLER_PANEL_URL_NOT_CONFIGURED]/${normalizedPath}`
  }
  return new URL(normalizedPath, normalizeBaseUrl(baseUrl)).toString()
}

const buildSellerRefreshCookieOptions = (overrides?: Partial<CookieOptions>): CookieOptions => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  ...overrides,
})

// Helper to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

// Helper to generate unique store slug
const generateUniqueStoreSlug = async (
  businessName: string,
  sellerId?: string,
): Promise<string> => {
  const baseSlug = generateSlug(businessName)
  let slug = baseSlug
  let suffix = 1

  while (true) {
    const query: any = { storeSlug: slug, role: 'seller' }
    if (sellerId) {
      query._id = { $ne: sellerId }
    }

    const existingSeller = await User.findOne(query)
    if (!existingSeller) {
      break
    }
    slug = `${baseSlug}-${suffix++}`
  }

  return slug
}

// Register Seller
export const registerSeller = async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body

    // Check if email exists for seller role
    let user = await User.findOne({ email, role: 'seller' })
    
    if (user) {
      // Check if this is an OAuth-only account (no password set)
      if (!user.password && user.oauthProvider === 'google') {
        // Link password to existing OAuth account
        const hashedPassword = await bcrypt.hash(password, 10)
        user.password = hashedPassword
        // Update name and phone if provided and not already set
        if (name && (!user.name || user.name === email.split('@')[0])) {
          user.name = name
        }
        if (phone && !user.phone) {
          user.phone = phone
        }
        await user.save()
        
        // Generate token and return success (same as new registration)
        const sessionVersion = user.sessionVersion ?? 0
        const token = jwt.sign(
          { userId: user._id, role: user.role, sessionVersion },
          process.env.JWT_SECRET!,
          {
            expiresIn: '7d',
          },
        )

        const sellerData = {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isApproved: user.isApproved,
          kycSubmitted: user.kycSubmitted,
          isEmailVerified: user.isEmailVerified,
        }

        return res.status(200).json({
          message: 'Password linked successfully! You can now sign in with either email/password or Google.',
          token,
          seller: sellerData,
        })
      }
      
      // Account already exists with password - suggest login
      return res.status(400).json({
        error:
          'This email is already registered as a seller. Please use a different email or login instead.',
      })
    }

    // New seller registration
    const hashedPassword = await bcrypt.hash(password, 10)
    const emailVerificationToken = generateToken()
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    user = new User({
      name,
      email,
      password: hashedPassword,
      role: 'seller',
      phone,
      isApproved: false,
      kycSubmitted: false, // KYC not submitted yet - will be done after login
      isEmailVerified: false,
      emailVerificationToken,
      emailVerificationExpires,
      // Default store settings
      storeStatus: 'active',
      defaultShippingRate: 0,
      lowStockNotification: true,
      newOrderNotification: true,
    })

    await user.save()

    // Send verification email (non-blocking - registration succeeds even if email fails)
    const sellerPanelUrl = process.env.SELLER_PANEL_URL
    if (!sellerPanelUrl) {
      console.warn('⚠️ SELLER_PANEL_URL not configured - verification email link will not work')
    }
    const verificationUrl = buildPanelUrl(
      sellerPanelUrl,
      `/verify-email/${emailVerificationToken}`,
    )
    const emailResult = await sendEmail(
      email,
      'Verify Your Email - Seller Hub',
      emailTemplates.verifyEmail(name, verificationUrl),
    )

    // Log email result but don't fail registration
    if (!emailResult.success) {
      console.warn(
        `⚠️ Email sending failed for seller registration (${email}), but registration will proceed.`,
        emailResult.error || emailResult.reason,
      )
    }

    // Generate JWT token and auto-login the user
    const sessionVersion = user.sessionVersion ?? 0
    const token = jwt.sign(
      { userId: user._id, role: user.role, sessionVersion },
      process.env.JWT_SECRET!,
      {
        expiresIn: '7d',
      },
    )

    // Return user data without password
    const sellerData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isApproved: user.isApproved,
      kycSubmitted: user.kycSubmitted,
      isEmailVerified: user.isEmailVerified,
    }

    return res.status(201).json({
      message: 'Registration successful! Please complete your KYC verification.',
      emailSent: emailResult.success,
      token,
      seller: sellerData,
    })
  } catch (err: unknown) {
    console.error('Error registering seller:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Verify Email
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

    // Idempotent: mark email as verified but keep token until expiry so
    // multiple clicks (or dev double-renders) don't break the flow.
    user.isEmailVerified = true
    await user.save()

    res.json({
      message: 'Email verified successfully! You can now login and complete your KYC.',
    })
  } catch (err: unknown) {
    console.error('Error verifying email:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Resend Verification Email
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email, role: 'seller' })
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

    const sellerPanelUrl = process.env.SELLER_PANEL_URL
    if (!sellerPanelUrl) {
      console.warn('⚠️ SELLER_PANEL_URL not configured - verification email link will not work')
    }
    const verificationUrl = buildPanelUrl(
      sellerPanelUrl,
      `/verify-email/${emailVerificationToken}`,
    )
    const emailResult = await sendEmail(
      email,
      'Verify Your Email - Seller Hub',
      emailTemplates.verifyEmail(user.name, verificationUrl),
    )

    if (!emailResult.success) {
      console.warn(
        `⚠️ Email sending failed for resend verification (${email}):`,
        emailResult.error || emailResult.reason,
      )
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

// Login Seller
export const loginSeller = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const seller = await User.findOne({ email, role: 'seller' })
    if (!seller) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    // Check if account is deactivated - block login
    if (seller.sellerLifecycleStatus === 'DEACTIVATED') {
      return res.status(403).json({
        error: 'ACCOUNT_DEACTIVATED',
        message:
          'Your seller account has been deactivated. Please contact support for more information.',
        code: 'ACCOUNT_DEACTIVATED',
      })
    }

    // Check if seller has a password set
    if (!seller.password) {
      // Seller registered with OAuth only - suggest using Google login
      if (seller.oauthProvider === 'google') {
        return res.status(400).json({
          error: 'OAUTH_ONLY_ACCOUNT',
          message: 'This account was created with Google. Please sign in with Google instead.',
        })
      }
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, seller.password)
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' })
    }

    // Allow login regardless of email verification or approval status
    // The frontend will handle redirecting based on kycSubmitted and isApproved

    const sessionVersion = seller.sessionVersion ?? 0
    const payload = { userId: seller._id, role: seller.role, sessionVersion }
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '15m',
    })
    const refreshToken = jwt.sign(
      payload,
      process.env.REFRESH_SECRET || 'your-seller-refresh-secret',
      { expiresIn: '7d' },
    )

    res.cookie('seller_refresh', refreshToken, buildSellerRefreshCookieOptions())

    res.json({
      token: accessToken,
      seller: {
        id: seller._id,
        name: seller.name,
        email: seller.email,
        phone: seller.phone,
        role: seller.role,
        businessName: seller.businessName,
        isApproved: seller.isApproved,
        kycSubmitted: seller.kycSubmitted,
        isEmailVerified: seller.isEmailVerified,
        sellerLifecycleStatus: seller.sellerLifecycleStatus,
      },
    })
  } catch (err: unknown) {
    console.error('Error logging in seller:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Forgot Password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email, role: 'seller' })
    if (!user) {
      // Don't reveal that user doesn't exist
      return res.json({ message: 'If an account exists, a password reset email has been sent.' })
    }

    const resetPasswordToken = generateToken()
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    user.resetPasswordToken = resetPasswordToken
    user.resetPasswordExpires = resetPasswordExpires
    await user.save()

    const sellerPanelUrl = process.env.SELLER_PANEL_URL
    if (!sellerPanelUrl) {
      console.warn('⚠️ SELLER_PANEL_URL not configured - reset password email link will not work')
    }
    const resetUrl = buildPanelUrl(sellerPanelUrl, `/reset-password/${resetPasswordToken}`)
    await sendEmail(
      email,
      'Reset Your Password - Seller Hub',
      emailTemplates.resetPassword(user.name, resetUrl),
    )

    res.json({ message: 'If an account exists, a password reset email has been sent.' })
  } catch (err: unknown) {
    console.error('Error in forgot password:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Reset Password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const { password } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    })

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    user.password = hashedPassword
    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined
    await user.save()

    res.json({ message: 'Password reset successfully! You can now login with your new password.' })
  } catch (err: unknown) {
    console.error('Error resetting password:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Google OAuth Authentication for Sellers
export const googleOAuthSeller = async (req: Request, res: Response) => {
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
      return res.status(400).json({
        error: 'Invalid authorization code',
        details: error?.message || 'Failed to exchange authorization code',
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

    // Check if user exists with this email and seller role
    const existingSeller = await User.findOne({ email, role: 'seller' })

    if (existingSeller) {
      // Check if seller account is deactivated
      if (existingSeller.sellerLifecycleStatus === 'DEACTIVATED') {
        return res.status(403).json({
          error: 'ACCOUNT_DEACTIVATED',
          message:
            'Your seller account has been deactivated. Please contact support for more information.',
          code: 'ACCOUNT_DEACTIVATED',
        })
      }

      // Link Google account if seller registered with email/password
      // This allows sellers to sign in with either method
      if (existingSeller.password && !existingSeller.oauthProvider) {
        // Link Google account to existing account
        existingSeller.googleId = googleId
        existingSeller.oauthProvider = 'google'
        // Mark email as verified since Google verified it
        existingSeller.isEmailVerified = true
        // Update profile picture if available
        if (picture && !existingSeller.profilePhoto) {
          existingSeller.profilePhoto = picture
        }
        // Update name if Google provides one and existing name is just email prefix
        if (name && existingSeller.name === email.split('@')[0]) {
          existingSeller.name = name
        }
        await existingSeller.save()
      } else {
        // Seller exists with Google OAuth - login
        // Update Google ID if not set
        if (!existingSeller.googleId) {
          existingSeller.googleId = googleId
          existingSeller.oauthProvider = 'google'
        }

        // Update profile picture if available
        if (picture && !existingSeller.profilePhoto) {
          existingSeller.profilePhoto = picture
        }

        await existingSeller.save()
      }

      const sessionVersion = existingSeller.sessionVersion ?? 0
      const tokenPayload = { userId: existingSeller._id, role: existingSeller.role, sessionVersion }
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'your-secret-key', {
        expiresIn: '15m',
      })
      const refreshToken = jwt.sign(
        tokenPayload,
        process.env.REFRESH_SECRET || 'your-seller-refresh-secret',
        {
          expiresIn: '7d',
        },
      )

      res.cookie('seller_refresh', refreshToken, buildSellerRefreshCookieOptions())

      return res.json({
        token,
        seller: {
          id: existingSeller._id,
          name: existingSeller.name,
          email: existingSeller.email,
          phone: existingSeller.phone,
          role: existingSeller.role,
          businessName: existingSeller.businessName,
          isApproved: existingSeller.isApproved,
          kycSubmitted: existingSeller.kycSubmitted,
          isEmailVerified: existingSeller.isEmailVerified,
          sellerLifecycleStatus: existingSeller.sellerLifecycleStatus,
        },
      })
    }

    // New seller - create account
    const newSeller = new User({
      name: name || email.split('@')[0],
      email,
      googleId,
      oauthProvider: 'google',
      role: 'seller',
      isEmailVerified: true, // Google already verified the email
      isApproved: false,
      kycSubmitted: false,
      profilePhoto: picture,
      // Default store settings
      storeStatus: 'active',
      defaultShippingRate: 0,
      lowStockNotification: true,
      newOrderNotification: true,
      // No password for OAuth users
    })

    await newSeller.save()

    const sessionVersion = newSeller.sessionVersion ?? 0
    const tokenPayload = { userId: newSeller._id, role: newSeller.role, sessionVersion }
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'your-secret-key', {
      expiresIn: '15m',
    })
    const refreshToken = jwt.sign(
      tokenPayload,
      process.env.REFRESH_SECRET || 'your-seller-refresh-secret',
      {
        expiresIn: '7d',
      },
    )

    res.cookie('seller_refresh', refreshToken, buildSellerRefreshCookieOptions())

    res.json({
      token,
      seller: {
        id: newSeller._id,
        name: newSeller.name,
        email: newSeller.email,
        phone: newSeller.phone,
        role: newSeller.role,
        businessName: newSeller.businessName,
        isApproved: newSeller.isApproved,
        kycSubmitted: newSeller.kycSubmitted,
        isEmailVerified: newSeller.isEmailVerified,
        sellerLifecycleStatus: newSeller.sellerLifecycleStatus,
      },
    })
  } catch (err: unknown) {
    console.error('Google OAuth seller error:', err)
    res.status(500).json({ error: 'Server error' })
  }
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

export const refreshSeller = async (req: Request, res: Response) => {
  try {
    const token = getCookie(req, 'seller_refresh')
    if (!token) return res.status(401).json({ error: 'No refresh token' })
    const decoded = jwt.verify(
      token,
      process.env.REFRESH_SECRET || 'your-seller-refresh-secret',
    ) as { userId: string; role: string; sessionVersion?: number }

    const user = await User.findById(decoded.userId).select('role sessionVersion')
    if (!user) {
      res.clearCookie('seller_refresh', buildSellerRefreshCookieOptions({ maxAge: 0 }))
      return res.status(401).json({ error: 'Invalid refresh token' })
    }

    const currentSessionVersion = user.sessionVersion ?? 0
    if ((decoded.sessionVersion ?? 0) !== currentSessionVersion) {
      res.clearCookie('seller_refresh', buildSellerRefreshCookieOptions({ maxAge: 0 }))
      return res.status(401).json({ error: 'Session expired. Please log in again.' })
    }

    const newAccess = jwt.sign(
      { userId: user._id, role: user.role, sessionVersion: currentSessionVersion },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '15m' },
    )
    return res.json({ token: newAccess })
  } catch (e) {
    res.clearCookie('seller_refresh', buildSellerRefreshCookieOptions({ maxAge: 0 }))
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
}

export const logoutSeller = async (_req: Request, res: Response) => {
  res.clearCookie(
    'seller_refresh',
    buildSellerRefreshCookieOptions({
      maxAge: 0,
    }),
  )
  return res.status(200).json({ success: true })
}

// Change Password (for logged in users)
export const changePassword = async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body
    const userId = req.user?.userId

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

// Get Seller Profile
export const getSellerProfile = async (req: Request, res: Response) => {
  try {
    const seller = await User.findById(req.user?.userId)
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Auto-generate slug from business name if not set
    if (seller.businessName && !seller.storeSlug) {
      seller.storeSlug = await generateUniqueStoreSlug(seller.businessName, String(seller._id))
      await seller.save()
    }

    // Check if user has a password
    const hasPassword = !!(seller.password && seller.password.trim().length > 0)

    const payload = seller.toObject()
    // Remove password and phone from response before sending using destructuring
    // IMPORTANT: Exclude phone here to prevent encrypted phone from being included
    const { password, phone: _encryptedPhone, ...sellerData } = payload as any

    // Decrypt phone number for display (sellers should see their own phone number)
    // Only add phone back if we can decrypt it - never return encrypted string
    if (seller.phone) {
      const phoneResult = getPhoneFromUser(seller, String(seller._id), 'Get Seller Profile')
      if (phoneResult.isDecryptable && phoneResult.phone) {
        sellerData.phone = phoneResult.phone
      } else if (phoneResult.isPlainText && phoneResult.phone) {
        sellerData.phone = phoneResult.phone
      } else {
        // Can't decrypt - don't show encrypted string
        sellerData.phone = undefined
      }
    } else {
      sellerData.phone = undefined
    }

    const response = {
      ...sellerData,
      hasPassword,
    }
    res.json(response)
  } catch (err: unknown) {
    console.error('Error fetching seller profile:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Update Seller Profile
export const updateSellerProfile = async (req: Request, res: Response) => {
  try {
    const { name, phone } = req.body
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const seller = await User.findById(userId)
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Only allow updating basic profile info
    // Business details should be updated through KYC submission
    if (name) seller.name = name
    if (phone) seller.phone = phone

    // Handle profile photo upload
    const file = req.file as Express.Multer.File | undefined
    if (file) {
      const photoUrl = await uploadToR2(
        file.buffer,
        `${userId}/profile-photo-${Date.now()}.${file.mimetype.split('/')[1]}`,
        file.mimetype,
        'profile-photos',
      )
      seller.profilePhoto = photoUrl
    }

    await seller.save()

    const updatedSeller = await User.findById(userId).select('-password')
    if (!updatedSeller) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    const sellerPayload = updatedSeller.toObject() as any
    // Exclude phone from initial object to prevent encrypted phone from being included
    const { phone: _encryptedPhone, ...sellerResponse } = sellerPayload

    // Decrypt phone number for display (sellers should see their own phone number)
    // Only add phone back if we can decrypt it - never return encrypted string
    if (updatedSeller.phone) {
      const phoneResult = getPhoneFromUser(updatedSeller, String(userId), 'Update Seller Profile')
      if (phoneResult.isDecryptable && phoneResult.phone) {
        sellerResponse.phone = phoneResult.phone
      } else if (phoneResult.isPlainText && phoneResult.phone) {
        sellerResponse.phone = phoneResult.phone
      } else {
        // Can't decrypt - don't show encrypted string
        sellerResponse.phone = undefined
      }
    } else {
      sellerResponse.phone = undefined
    }

    res.json({ message: 'Profile updated successfully', user: sellerResponse })
  } catch (err: unknown) {
    console.error('Error updating seller profile:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Mark onboarding (platform) tour as completed/skipped
export const markOnboardingTourCompleted = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const seller = await User.findById(userId)
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    seller.onboardingTourCompletedAt = new Date()
    await seller.save()

    res.json({ message: 'Tour completed', onboardingTourCompletedAt: seller.onboardingTourCompletedAt })
  } catch (err: unknown) {
    console.error('Error marking onboarding tour completed:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Update Store Info (non-critical fields - no re-approval needed)
export const updateStoreInfo = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const seller = await User.findById(userId)
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ error: 'Seller not found' })
    }

    // Only approved sellers can update store info
    if (!seller.isApproved) {
      return res
        .status(403)
        .json({ error: 'Your account must be approved before you can update store information' })
    }

    // Handle file uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined

    // Handle store logo upload
    if (files?.storeLogo?.[0]) {
      const file = files.storeLogo[0]
      const logoUrl = await uploadToR2(
        file.buffer,
        `${userId}/logo-${Date.now()}.${file.mimetype.split('/')[1]}`,
        file.mimetype,
        'store-logos',
      )
      seller.storeLogo = logoUrl
    }

    // Handle store banner upload (single banner for header - General tab)
    if (files?.storeBanner?.[0]) {
      const file = files.storeBanner[0]
      const bannerUrl = await uploadToR2(
        file.buffer,
        `${userId}/store-banner-${Date.now()}.${file.mimetype.split('/')[1]}`,
        file.mimetype,
        'store-banners',
      )
      seller.storeBanner = bannerUrl
    }

    // Handle storefront banners upload (multiple banners for home page - Storefront tab)
    if (files?.storefrontBanners && files.storefrontBanners.length > 0) {
      // Upload all banner files
      const bannerUrls = await Promise.all(
        files.storefrontBanners.map(async (file) => {
          const bannerUrl = await uploadToR2(
            file.buffer,
            `${userId}/storefront-banner-${Date.now()}-${Math.random().toString(36).substring(7)}.${
              file.mimetype.split('/')[1]
            }`,
            file.mimetype,
            'store-banners',
          )
          return bannerUrl
        }),
      )

      // Parse storefrontBanners from request body (JSON array with order, gridSpan, category)
      // Note: req.body.storefrontBanners might be a JSON string or array, and might appear multiple times
      // (once as files, once as metadata JSON). We need to find the JSON metadata.
      let storefrontBannersData: Array<{
        imageUrl?: string
        category?: string
        order: number
        gridSpan: number
        tempId?: string
      }> = []
      try {
        // Check if storefrontBanners is provided as a JSON string or array
        const storefrontBannersValue = req.body.storefrontBanners
        if (storefrontBannersValue) {
          // If it's an array, check if first item is an object (metadata)
          if (Array.isArray(storefrontBannersValue) && storefrontBannersValue.length > 0) {
            const firstItem = storefrontBannersValue[0]
            if (typeof firstItem === 'object' && !(firstItem instanceof File)) {
              // It's metadata array (could have imageUrl or not)
              storefrontBannersData = storefrontBannersValue
            }
          } else if (typeof storefrontBannersValue === 'string') {
            // Try to parse as JSON
            try {
              const parsed = JSON.parse(storefrontBannersValue)
              if (Array.isArray(parsed)) {
                storefrontBannersData = parsed
              }
            } catch {
              // Not JSON, ignore
            }
          }
        }
      } catch (err) {
        console.error('Error parsing storefrontBanners:', err)
      }

      // Match uploaded files with metadata
      // If metadata has imageUrl and no tempId, it's an existing banner (no new file)
      // If metadata doesn't have imageUrl or has tempId, it's a new banner (has file)
      let fileIndex = 0
      const mergedBanners = storefrontBannersData
        .map((metadata, index) => {
          // Check if this banner has a new file (no imageUrl or has tempId)
          const hasNewFile = !metadata.imageUrl || metadata.tempId

          if (hasNewFile && fileIndex < bannerUrls.length) {
            // This banner has a new file - use the uploaded URL
            const newUrl = bannerUrls[fileIndex]
            fileIndex++
            return {
              imageUrl: newUrl,
              category: metadata.category || undefined,
              order: metadata.order !== undefined ? metadata.order : index,
              gridSpan:
                metadata.gridSpan !== undefined ? Math.min(12, Math.max(1, metadata.gridSpan)) : 1,
            }
          } else if (metadata.imageUrl) {
            // This banner keeps its existing imageUrl (no new file)
            return {
              imageUrl: metadata.imageUrl,
              category: metadata.category || undefined,
              order: metadata.order !== undefined ? metadata.order : index,
              gridSpan:
                metadata.gridSpan !== undefined ? Math.min(12, Math.max(1, metadata.gridSpan)) : 1,
            }
          } else {
            // This banner has no imageUrl and no file - skip it
            return null
          }
        })
        .filter((b): b is NonNullable<typeof b> => b !== null) // Filter out nulls

      // If we have uploaded files but no metadata, create banners from files
      if (storefrontBannersData.length === 0 && bannerUrls.length > 0) {
        seller.storefrontBanners = bannerUrls.map((url, index) => ({
          imageUrl: url,
          category: undefined,
          order: index,
          gridSpan: 1,
        }))
      } else if (mergedBanners.length > 0) {
        // Use merged banners (with metadata) - save ALL banners
        seller.storefrontBanners = mergedBanners
      }
    }

    // Handle video file upload (mutually exclusive with video URL)
    if (files?.storeVideo?.[0]) {
      const file = files.storeVideo[0]
      const videoUrl = await uploadToR2(
        file.buffer,
        `${userId}/video-${Date.now()}.${file.mimetype.split('/')[1]}`,
        file.mimetype,
        'store-videos',
      )
      seller.storeVideoFile = videoUrl
      // Clear storeVideo URL if video file is uploaded (mutually exclusive)
      seller.storeVideo = undefined
    }

    // Handle signature upload (can be File or base64 string)
    if (files?.sellerAgreementSignature?.[0]) {
      const file = files.sellerAgreementSignature[0]
      const signatureUrl = await uploadToR2(
        file.buffer,
        `${userId}/signature-${Date.now()}.${file.mimetype.split('/')[1]}`,
        file.mimetype,
        'signatures',
      )
      seller.sellerAgreementSignature = signatureUrl
      if (!seller.sellerAgreementSignedAt) {
        seller.sellerAgreementSignedAt = new Date()
      }
    }

    // Handle single file (for backward compatibility)
    if (req.file) {
      const file = req.file
      const logoUrl = await uploadToR2(
        file.buffer,
        `${userId}/logo-${Date.now()}.${file.mimetype.split('/')[1]}`,
        file.mimetype,
        'store-logos',
      )
      seller.storeLogo = logoUrl
    }

    // Parse JSON fields from req.body
    const {
      storeDescription,
      storeStatus,
      storeSlug,
      storeTheme,
      shippingPolicy,
      returnPolicy,
      refundPolicy,
      cancellationPolicy,
      warrantyPolicy,
      replacementPolicy,
      defaultShippingRate,
      shippingZones,
      website,
      facebook,
      instagram,
      twitter,
      youtube,
      linkedin,
      storeMetaTitle,
      storeMetaDescription,
      storeKeywords,
      lowStockNotification,
      newOrderNotification,
      storeEmail,
      storePhone,
      supportEmail,
      // New fields
      brandNames,
      storefrontBanners, // JSON array of storefront banner metadata (Storefront tab)
      storeVideo, // Video URL (YouTube, Vimeo, etc.) - mutually exclusive with storeVideoFile
      pickupAddresses,
      preferredCouriers,
      packagingStandards,
      marketplaceTermsAccepted,
      sellerAgreementSigned,
      sellerAgreementSignature, // Can be base64 string (if not uploaded as file)
      returnRefundPolicyAccepted,
      prohibitedItemsDeclared,
      prohibitedItemsDeclaration,
      dataPrivacyConsent,
    } = req.body

    // Update store information fields
    if (storeDescription !== undefined) seller.storeDescription = storeDescription
    if (storeStatus !== undefined) {
      seller.storeStatus = storeStatus
    } else {
      // Default to active if not provided
      seller.storeStatus = 'active'
    }
    // Auto-generate slug from business name if not provided and business name exists
    if (!storeSlug && seller.businessName && !seller.storeSlug) {
      seller.storeSlug = await generateUniqueStoreSlug(seller.businessName, userId)
    } else if (storeSlug !== undefined && storeSlug !== '') {
      // Validate slug format
      const slugRegex = /^[a-z0-9-]+$/
      if (!slugRegex.test(storeSlug)) {
        return res
          .status(400)
          .json({ error: 'Store slug can only contain lowercase letters, numbers, and hyphens' })
      }
      if (storeSlug.length < 3 || storeSlug.length > 50) {
        return res.status(400).json({ error: 'Store slug must be between 3 and 50 characters' })
      }
      // Check if slug is already taken by another seller
      const existingSeller = await User.findOne({
        storeSlug: storeSlug.toLowerCase().trim(),
        role: 'seller',
        _id: { $ne: userId },
      })
      if (existingSeller) {
        return res
          .status(400)
          .json({ error: 'This store slug is already taken. Please choose another one.' })
      }
      seller.storeSlug = storeSlug.toLowerCase().trim()
    }
    if (storeTheme !== undefined) {
      seller.storeTheme = storeTheme
    }

    // Handle storefrontBanners array update (if provided as JSON, no file uploads)
    // Only update metadata if no new files are being uploaded
    if (
      storefrontBanners !== undefined &&
      (!files?.storefrontBanners || files.storefrontBanners.length === 0)
    ) {
      try {
        // Check if it's a JSON string or already an array
        let bannersData: any = storefrontBanners
        if (typeof storefrontBanners === 'string') {
          try {
            bannersData = JSON.parse(storefrontBanners)
          } catch {
            // Not valid JSON, skip
            bannersData = null
          }
        }

        if (Array.isArray(bannersData) && bannersData.length > 0) {
          // Check if it's metadata (objects with imageUrl) or files
          const firstItem = bannersData[0]
          if (
            typeof firstItem === 'object' &&
            !(firstItem instanceof File) &&
            'imageUrl' in firstItem
          ) {
            // It's metadata array - update all banners (including existing ones that don't need file uploads)
            seller.storefrontBanners = bannersData.map((banner: any) => ({
              imageUrl: banner.imageUrl, // Can be existing URL or new URL
              category: banner.category || undefined,
              order: banner.order !== undefined ? banner.order : 0,
              gridSpan:
                banner.gridSpan !== undefined ? Math.min(12, Math.max(1, banner.gridSpan)) : 1,
            }))
          }
        }
      } catch (err) {
        console.error('Error parsing storefrontBanners:', err)
      }
    }

    // Handle video URL (if provided and no video file uploaded - mutually exclusive)
    if (storeVideo !== undefined && !files?.storeVideo?.[0]) {
      seller.storeVideo = storeVideo
      // Clear video file if URL is provided (mutually exclusive)
      seller.storeVideoFile = undefined
    }

    // Update policies
    if (shippingPolicy !== undefined) seller.shippingPolicy = shippingPolicy
    if (returnPolicy !== undefined) seller.returnPolicy = returnPolicy
    if (refundPolicy !== undefined) seller.refundPolicy = refundPolicy
    if (cancellationPolicy !== undefined) seller.cancellationPolicy = cancellationPolicy
    if (warrantyPolicy !== undefined) seller.warrantyPolicy = warrantyPolicy

    // Update shipping settings
    if (defaultShippingRate !== undefined) seller.defaultShippingRate = Number(defaultShippingRate)
    if (shippingZones !== undefined) {
      try {
        seller.shippingZones =
          typeof shippingZones === 'string' ? JSON.parse(shippingZones) : shippingZones
      } catch {
        // If parsing fails, skip
      }
    }

    // Update social media links
    if (website !== undefined) seller.website = website
    if (facebook !== undefined) seller.facebook = facebook
    if (instagram !== undefined) seller.instagram = instagram
    if (twitter !== undefined) seller.twitter = twitter
    if (youtube !== undefined) seller.youtube = youtube
    if (linkedin !== undefined) seller.linkedin = linkedin

    // Update SEO settings
    if (storeMetaTitle !== undefined) seller.storeMetaTitle = storeMetaTitle
    if (storeMetaDescription !== undefined) seller.storeMetaDescription = storeMetaDescription
    if (storeKeywords !== undefined) {
      try {
        seller.storeKeywords =
          typeof storeKeywords === 'string' ? JSON.parse(storeKeywords) : storeKeywords
      } catch {
        // If parsing fails, skip
      }
    }

    // Update preferences

    if (lowStockNotification !== undefined)
      seller.lowStockNotification = lowStockNotification === 'true' || lowStockNotification === true
    if (newOrderNotification !== undefined)
      seller.newOrderNotification = newOrderNotification === 'true' || newOrderNotification === true

    // Update contact information
    if (storeEmail !== undefined) seller.storeEmail = storeEmail
    if (storePhone !== undefined) seller.storePhone = storePhone
    if (supportEmail !== undefined) seller.supportEmail = supportEmail

    // Update Storefront & Catalog
    if (brandNames !== undefined) {
      try {
        seller.brandNames = typeof brandNames === 'string' ? JSON.parse(brandNames) : brandNames
      } catch {
        // If parsing fails, skip
      }
    }

    // Update Shipping & Logistics
    if (pickupAddresses !== undefined) {
      let parsedAddresses: any
      try {
        parsedAddresses =
          typeof pickupAddresses === 'string' ? JSON.parse(pickupAddresses) : pickupAddresses
      } catch (error) {
        console.error('Invalid pickupAddresses payload:', error)
        throw new Error(PICKUP_INVALID_PAYLOAD_ERROR)
      }

      if (Array.isArray(parsedAddresses) && parsedAddresses.length > 0) {
        const warehouseNames = new Set<string>()
        const normalizedAddresses = parsedAddresses.map((address: any, index: number) => {
          const normalizePhone = (input: unknown) => {
            const digits =
              typeof input === 'string'
                ? input.replace(/\D/g, '')
                : typeof input === 'number'
                ? String(input).replace(/\D/g, '')
                : ''
            if (digits.length !== 10) {
              throw new Error(PICKUP_PHONE_INVALID_ERROR)
            }
            return digits
          }

          const warehouseName =
            typeof address.warehouseName === 'string' ? address.warehouseName.trim() : ''
          if (!warehouseName) {
            throw new Error(PICKUP_WAREHOUSE_REQUIRED_ERROR)
          }
          const normalizedKey = warehouseName.toLowerCase()
          if (warehouseNames.has(normalizedKey)) {
            throw new Error(PICKUP_WAREHOUSE_DUPLICATE_ERROR)
          }
          warehouseNames.add(normalizedKey)

          const contactPhone = normalizePhone(address.contactPhone)

          const rtoSameAsPickup = address.rtoSameAsPickup === false ? false : true
          let normalizedRtoAddress: any = undefined

          if (!rtoSameAsPickup) {
            const rto = address.rtoAddress || {}
            const requiredFields = [
              'contactName',
              'contactPhone',
              'addressLine1',
              'city',
              'state',
              'postalCode',
            ]
            const missingField = requiredFields.find((field) => {
              const value = rto[field]
              if (typeof value === 'string') {
                return value.trim().length === 0
              }
              return !value
            })
            if (missingField) {
              throw new Error(PICKUP_RTO_REQUIRED_ERROR)
            }

            normalizedRtoAddress = {
              contactName: rto.contactName.trim(),
              contactPhone: normalizePhone(rto.contactPhone),
              contactEmail: rto.contactEmail?.trim() || undefined,
              addressLine1: rto.addressLine1.trim(),
              addressLine2: rto.addressLine2?.trim() || undefined,
              city: rto.city.trim(),
              state: rto.state.trim(),
              postalCode: rto.postalCode.trim(),
              country: (rto.country || 'India').trim(),
            }
          }

          return {
            ...address,
            warehouseName,
            country: address.country || 'India',
            contactPhone,
            rtoSameAsPickup,
            rtoAddress: normalizedRtoAddress,
          }
        })

        try {
          const syncedAddresses = await Promise.all(
            normalizedAddresses.map(async (address: any) => {
              try {
                const payloadAddress = {
                  addressLine1: address.addressLine1,
                  addressLine2: address.addressLine2,
                  city: address.city,
                  state: address.state,
                  postalCode: address.postalCode,
                  country: address.country || 'India',
                  contactName: address.contactName,
                  contactPhone: address.contactPhone,
                }

                const payloadOptions = {
                  sellerEmail: seller.email,
                  gstNumber: seller.gstNumber,
                  isPrimary: address.isDefault || false,
                  isPickupEnabled: true,
                  warehouseName: address.warehouseName,
                  rtoAddress: address.rtoSameAsPickup ? undefined : address.rtoAddress,
                }

                let shippingProviderResponse
                if (address.kourierBoyzLogisticsPickupAddressId) {
                  shippingProviderResponse = await shippingProviderService.createOrUpdatePickupAddress(
                    payloadAddress,
                    payloadOptions,
                    address.kourierBoyzLogisticsPickupAddressId,
                  )
                } else {
                  shippingProviderResponse = await shippingProviderService.createOrUpdatePickupAddress(
                    payloadAddress,
                    payloadOptions,
                  )
                }

                if (shippingProviderResponse.data?.id) {
                  return {
                    ...address,
                    kourierBoyzLogisticsPickupAddressId: shippingProviderResponse.data.id,
                  }
                }

                throw new Error(PICKUP_SYNC_ERROR)
              } catch (error: any) {
                console.error(
                  `Failed to sync pickup address with Shipmozo for seller ${seller.email}:`,
                  error.response?.data || error.message || error,
                )
                throw new Error(PICKUP_SYNC_ERROR)
              }
            }),
          )

          seller.pickupAddresses = syncedAddresses
        } catch (error) {
          console.error('Error syncing pickup addresses with Shipmozo:', error)
          throw new Error(PICKUP_SYNC_ERROR)
        }
      } else if (Array.isArray(parsedAddresses)) {
        // Update pickup addresses
        // Note: Frontend should only send pickupAddresses when on the shipping tab
        // to prevent accidental deletion when submitting from other tabs
        seller.pickupAddresses = parsedAddresses
      }
    }
    if (preferredCouriers !== undefined) {
      try {
        seller.preferredCouriers =
          typeof preferredCouriers === 'string' ? JSON.parse(preferredCouriers) : preferredCouriers
      } catch {
        // If parsing fails, skip
      }
    }
    if (packagingStandards !== undefined) {
      try {
        seller.packagingStandards =
          typeof packagingStandards === 'string'
            ? JSON.parse(packagingStandards)
            : packagingStandards
      } catch {
        // If parsing fails, skip
      }
    }

    // Update Return & Replacement
    if (replacementPolicy !== undefined) seller.replacementPolicy = replacementPolicy

    // Update Compliance & Agreements
    // Only update if explicitly provided - preserve existing values if not provided
    if (marketplaceTermsAccepted !== undefined) {
      const newValue = marketplaceTermsAccepted === 'true' || marketplaceTermsAccepted === true
      // Only update if value is actually changing to avoid resetting timestamp
      if (seller.marketplaceTermsAccepted !== newValue) {
        seller.marketplaceTermsAccepted = newValue
        if (seller.marketplaceTermsAccepted && !seller.marketplaceTermsAcceptedAt) {
          seller.marketplaceTermsAcceptedAt = new Date()
        }
      }
    }
    if (sellerAgreementSigned !== undefined) {
      seller.sellerAgreementSigned =
        sellerAgreementSigned === 'true' || sellerAgreementSigned === true
      if (seller.sellerAgreementSigned && !seller.sellerAgreementSignedAt) {
        seller.sellerAgreementSignedAt = new Date()
      }
    }
    // Handle signature as base64 string (if not uploaded as file)
    if (sellerAgreementSignature !== undefined && !files?.sellerAgreementSignature?.[0]) {
      if (
        typeof sellerAgreementSignature === 'string' &&
        sellerAgreementSignature.startsWith('data:image')
      ) {
        // It's a base64 string - upload to R2
        try {
          // Convert base64 to buffer
          const base64Data = sellerAgreementSignature.replace(/^data:image\/\w+;base64,/, '')
          const buffer = Buffer.from(base64Data, 'base64')
          // Determine mime type from base64 string
          const mimeMatch = sellerAgreementSignature.match(/data:image\/(\w+);base64/)
          const mimeType = mimeMatch ? `image/${mimeMatch[1]}` : 'image/png'

          const signatureUrl = await uploadToR2(
            buffer,
            `${userId}/signature-${Date.now()}.${mimeType.split('/')[1]}`,
            mimeType,
            'signatures',
          )
          seller.sellerAgreementSignature = signatureUrl
          if (!seller.sellerAgreementSignedAt) {
            seller.sellerAgreementSignedAt = new Date()
          }
        } catch (err) {
          console.error('Error uploading signature from base64:', err)
          // If upload fails, store base64 string directly (fallback)
          seller.sellerAgreementSignature = sellerAgreementSignature
        }
      } else if (typeof sellerAgreementSignature === 'string') {
        // Already a URL string
        seller.sellerAgreementSignature = sellerAgreementSignature
      }
    }
    if (returnRefundPolicyAccepted !== undefined) {
      seller.returnRefundPolicyAccepted =
        returnRefundPolicyAccepted === 'true' || returnRefundPolicyAccepted === true
      if (seller.returnRefundPolicyAccepted && !seller.returnRefundPolicyAcceptedAt) {
        seller.returnRefundPolicyAcceptedAt = new Date()
      }
    }
    if (prohibitedItemsDeclared !== undefined) {
      seller.prohibitedItemsDeclared =
        prohibitedItemsDeclared === 'true' || prohibitedItemsDeclared === true
    }
    if (prohibitedItemsDeclaration !== undefined) {
      seller.prohibitedItemsDeclaration = prohibitedItemsDeclaration
    }
    if (dataPrivacyConsent !== undefined) {
      seller.dataPrivacyConsent = dataPrivacyConsent === 'true' || dataPrivacyConsent === true
      if (seller.dataPrivacyConsent && !seller.dataPrivacyConsentAt) {
        seller.dataPrivacyConsentAt = new Date()
      }
    }

    await seller.save()

    // Generate PDFs for accepted agreements (only if they're newly accepted and PDF doesn't exist)
    const pdfGenerationPromises: Promise<void>[] = []

    // Generate PDF for Marketplace Terms
    if (seller.marketplaceTermsAccepted && !seller.marketplaceTermsPdfUrl) {
      const marketplaceTermsAgreement = await Agreement.findOne({
        type: 'marketplace-terms',
        isActive: true,
      })
      if (marketplaceTermsAgreement) {
        pdfGenerationPromises.push(
          (async () => {
            try {
              const pdfUrl = await generatePDFFromHTML(
                marketplaceTermsAgreement.content,
                marketplaceTermsAgreement.title,
                'marketplace-terms',
                marketplaceTermsAgreement.version,
                {
                  name: seller.name,
                  email: seller.email,
                  businessName: seller.businessName,
                  acceptedAt: seller.marketplaceTermsAcceptedAt || new Date(),
                },
              )
              await User.updateOne({ _id: userId }, { marketplaceTermsPdfUrl: pdfUrl })
              console.log(`Generated marketplace terms PDF for seller ${seller.email}: ${pdfUrl}`)
            } catch (err) {
              console.error('Error generating marketplace terms PDF:', err)
            }
          })(),
        )
      }
    }

    // Generate PDF for Seller Agreement (with signature)
    if (
      seller.sellerAgreementSigned &&
      !seller.sellerAgreementPdfUrl &&
      seller.sellerAgreementSignature
    ) {
      const sellerAgreement = await Agreement.findOne({
        type: 'seller-agreement',
        isActive: true,
      })
      if (sellerAgreement) {
        pdfGenerationPromises.push(
          (async () => {
            try {
              const pdfUrl = await generatePDFFromHTML(
                sellerAgreement.content,
                sellerAgreement.title,
                'seller-agreement',
                sellerAgreement.version,
                {
                  name: seller.name,
                  email: seller.email,
                  businessName: seller.businessName,
                  acceptedAt: seller.sellerAgreementSignedAt || new Date(),
                  signatureUrl: seller.sellerAgreementSignature,
                },
              )
              await User.updateOne({ _id: userId }, { sellerAgreementPdfUrl: pdfUrl })
              console.log(`Generated seller agreement PDF for seller ${seller.email}: ${pdfUrl}`)
            } catch (err) {
              console.error('Error generating seller agreement PDF:', err)
            }
          })(),
        )
      }
    }

    // Generate PDF for Return & Refund Policy
    if (seller.returnRefundPolicyAccepted && !seller.returnRefundPolicyPdfUrl) {
      const returnRefundPolicyAgreement = await Agreement.findOne({
        type: 'return-refund-policy',
        isActive: true,
      })
      if (returnRefundPolicyAgreement) {
        pdfGenerationPromises.push(
          (async () => {
            try {
              const pdfUrl = await generatePDFFromHTML(
                returnRefundPolicyAgreement.content,
                returnRefundPolicyAgreement.title,
                'return-refund-policy',
                returnRefundPolicyAgreement.version,
                {
                  name: seller.name,
                  email: seller.email,
                  businessName: seller.businessName,
                  acceptedAt: seller.returnRefundPolicyAcceptedAt || new Date(),
                },
              )
              await User.updateOne({ _id: userId }, { returnRefundPolicyPdfUrl: pdfUrl })
              console.log(
                `Generated return refund policy PDF for seller ${seller.email}: ${pdfUrl}`,
              )
            } catch (err) {
              console.error('Error generating return refund policy PDF:', err)
            }
          })(),
        )
      }
    }

    // Generate PDF for Prohibited Items Declaration
    if (seller.prohibitedItemsDeclared && !seller.prohibitedItemsPdfUrl) {
      const prohibitedItemsAgreement = await Agreement.findOne({
        type: 'prohibited-items',
        isActive: true,
      })
      if (prohibitedItemsAgreement) {
        pdfGenerationPromises.push(
          (async () => {
            try {
              const pdfUrl = await generatePDFFromHTML(
                prohibitedItemsAgreement.content,
                prohibitedItemsAgreement.title,
                'prohibited-items',
                prohibitedItemsAgreement.version,
                {
                  name: seller.name,
                  email: seller.email,
                  businessName: seller.businessName,
                  acceptedAt: new Date(),
                  declarationText: seller.prohibitedItemsDeclaration || '',
                },
              )
              await User.updateOne({ _id: userId }, { prohibitedItemsPdfUrl: pdfUrl })
              console.log(`Generated prohibited items PDF for seller ${seller.email}: ${pdfUrl}`)
            } catch (err) {
              console.error('Error generating prohibited items PDF:', err)
            }
          })(),
        )
      }
    }

    // Generate PDF for Data Privacy Consent
    if (seller.dataPrivacyConsent && !seller.dataPrivacyPdfUrl) {
      const privacyPolicyAgreement = await Agreement.findOne({
        type: 'privacy-policy',
        isActive: true,
      })
      if (privacyPolicyAgreement) {
        pdfGenerationPromises.push(
          (async () => {
            try {
              const pdfUrl = await generatePDFFromHTML(
                privacyPolicyAgreement.content,
                privacyPolicyAgreement.title,
                'privacy-policy',
                privacyPolicyAgreement.version,
                {
                  name: seller.name,
                  email: seller.email,
                  businessName: seller.businessName,
                  acceptedAt: seller.dataPrivacyConsentAt || new Date(),
                },
              )
              await User.updateOne({ _id: userId }, { dataPrivacyPdfUrl: pdfUrl })
              console.log(`Generated privacy policy PDF for seller ${seller.email}: ${pdfUrl}`)
            } catch (err) {
              console.error('Error generating privacy policy PDF:', err)
            }
          })(),
        )
      }
    }

    // Wait for all PDFs to be generated (don't block response)
    if (pdfGenerationPromises.length > 0) {
      Promise.all(pdfGenerationPromises).catch((err) => {
        console.error('Error generating some PDFs:', err)
      })
    }

    const updatedSeller = await User.findById(userId).select('-password')
    res.json({ message: 'Store settings updated successfully', user: updatedSeller })
  } catch (err: unknown) {
    console.error('Error updating store info:', err)

    if (err instanceof Error) {
      switch (err.message) {
        case PICKUP_INVALID_PAYLOAD_ERROR:
          return res.status(400).json({ error: 'Invalid pickup address payload.' })
        case PICKUP_WAREHOUSE_REQUIRED_ERROR:
          return res
            .status(400)
            .json({ error: 'Please provide a warehouse name for each pickup address.' })
        case PICKUP_WAREHOUSE_DUPLICATE_ERROR:
          return res
            .status(400)
            .json({ error: 'Each pickup address must have a unique warehouse name.' })
        case PICKUP_RTO_REQUIRED_ERROR:
          return res
            .status(400)
            .json({ error: 'Provide complete RTO address details or mark it as same as pickup.' })
        case PICKUP_PHONE_INVALID_ERROR:
          return res.status(400).json({ error: 'Phone numbers must contain exactly 10 digits.' })
        case PICKUP_SYNC_ERROR:
          return res
            .status(503)
            .json({ error: 'Unable to sync pickup addresses right now. Please try again later.' })
        default:
          break
      }
    }

    res.status(500).json({ error: 'Server error' })
  }
}
