import bcrypt from 'bcryptjs'
import mongoose, { Document, Schema } from 'mongoose'
import { decryptPhone, encryptPhone, isPhoneEncrypted } from '../utils/phoneEncryption'

export type UserRole = 'super-admin' | 'customer' | 'seller' | 'user'

export interface ITwoFactorBackupCode {
  codeHash: string
  used: boolean
  usedAt?: Date
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId
  name: string
  email: string
  password: string
  role: UserRole
  recentSearches?: Array<{ query: string; searchedAt: Date }>
  phone?: string
  profilePhoto?: string // Profile photo URL
  dateOfBirth?: Date
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say'

  // Notification Preferences
  notificationPreferences?: {
    orderUpdates: boolean
    promotionalEmails: boolean
    newsletter: boolean
  }

  // Two-factor authentication
  twoFactorEnabled?: boolean
  twoFactorSecret?: string
  twoFactorEnabledAt?: Date
  twoFactorTempSecret?: string
  twoFactorTempSecretCreatedAt?: Date
  twoFactorLastVerifiedAt?: Date
  twoFactorBackupCodes?: ITwoFactorBackupCode[]
  twoFactorPhoneCode?: string
  twoFactorPhoneExpires?: Date
  twoFactorPhoneLastSentAt?: Date

  passkeys?: Array<{
    credentialID: Buffer
    credentialPublicKey: Buffer
    counter: number
    transports?: string[]
    nickname?: string
    createdAt: Date
    lastUsedAt?: Date
  }>
  passkeyRegistrationChallenge?: string
  passkeyAuthenticationChallenge?: string

  // Business / Store Information (KYC)
  businessName?: string
  storeLogo?: string
  storeSlug?: string // Unique URL-friendly identifier for seller microsite (e.g., "my-store")
  businessType?: 'Individual' | 'Proprietorship' | 'Partnership' | 'Pvt Ltd' | 'LLP' | 'Trust'
  businessRegistrationNumber?: string
  dateOfEstablishment?: Date
  storeDescription?: string

  // Business Address (KYC)
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string

  // Bank Account Details (KYC)
  bankAccountNumber?: string
  accountHolderName?: string
  bankName?: string
  ifscCode?: string
  cancelledCheque?: string // File URL
  bankVerified?: boolean
  bankVerificationStatus?: 'pending' | 'success' | 'failed'
  bankVerificationName?: string
  bankVerificationReference?: string

  // Tax & Legal Information (KYC)
  panNumber?: string
  gstNumber?: string
  aadhaarNumber?: string
  idProof?: string // File URL
  addressProof?: string // File URL
  gstCertificate?: string // File URL
  certificateOfIncorporation?: string // File URL (for companies)
  trustDeed?: string // File URL (for trusts)

  // Authorized Person (for companies)
  authorizedPersonName?: string
  authorizedPersonDesignation?: string

  // Approval Status
  isApproved?: boolean
  kycSubmitted?: boolean
  kycStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  rejectionReason?: string

  // Seller onboarding (platform tour completed/skipped)
  onboardingTourCompletedAt?: Date

  // Account Status (for customers)
  isBlocked?: boolean
  blockedAt?: Date
  blockedReason?: string

  // Seller Lifecycle Status (for deactivation)
  sellerLifecycleStatus?: 'ACTIVE' | 'DEACTIVATION_REQUESTED' | 'DEACTIVATED'
  deactivationRequestedAt?: Date
  deactivatedAt?: Date
  deactivationReason?: string
  deactivationReviewedBy?: mongoose.Types.ObjectId

  // Buyer Lifecycle Status (for customer deactivation)
  buyerLifecycleStatus?: 'ACTIVE' | 'DEACTIVATION_REQUESTED' | 'DEACTIVATED'
  buyerDeactivationRequestedAt?: Date
  buyerDeactivatedAt?: Date
  buyerDeactivationReason?: string
  originalEmail?: string // Store original email before masking
  originalName?: string // Store original name before masking
  originalPhone?: string // Store original phone before masking
  emailHash?: string // Hash of original email for reference

  // Customers list (for sellers) - tracks customers who have successfully received orders
  customers?: mongoose.Types.ObjectId[]

  // OAuth Authentication
  googleId?: string
  oauthProvider?: 'google'
  requiresPhoneVerification?: boolean

  // Email Verification
  isEmailVerified?: boolean
  emailVerificationToken?: string
  emailVerificationExpires?: Date

  // Phone Verification
  isPhoneVerified?: boolean
  phoneVerificationCode?: string
  phoneVerificationExpires?: Date
  phoneVerificationOtpLastSentAt?: Date // Track last time phone OTP was sent for profile updates

  // Password Reset
  resetPasswordToken?: string
  resetPasswordExpires?: Date
  passwordResetOtpLastSentAt?: Date

  // Temporary OTP for profile updates
  tempEmailOTP?: string
  tempEmailOTPExpires?: Date

  // Store Settings (marketplace settings)
  storeBanner?: string // Store banner image URL (shown in header)
  storefrontBanners?: Array<{
    imageUrl: string // Banner image URL
    category?: string // Category ID to navigate to when banner is clicked
    order: number // Display order (lower numbers appear first)
    gridSpan: number // Grid columns this banner takes (1-12, typically 1-4)
  }> // Multiple banners shown below categories on home page
  storeVideo?: string // Store introduction video URL (YouTube, Vimeo, etc.) - either this OR storeVideoFile
  storeVideoFile?: string // Uploaded video file URL - either this OR storeVideo (not both)
  storeStatus?: 'active' | 'inactive' // Store availability
  storeTheme?: string // Theme identifier for seller microsite (e.g., 'modern', 'classic', 'minimal')
  // Store Policies
  shippingPolicy?: string
  returnPolicy?: string
  refundPolicy?: string
  cancellationPolicy?: string
  warrantyPolicy?: string
  // Shipping Settings
  defaultShippingRate?: number // Default shipping cost
  shippingZones?: Array<{
    zone: string
    rate: number
  }>
  // Social Media & Links
  website?: string
  facebook?: string
  instagram?: string
  twitter?: string
  youtube?: string
  linkedin?: string
  // SEO Settings
  storeMetaTitle?: string
  storeMetaDescription?: string
  storeKeywords?: string[]
  // Store Preferences
  lowStockNotification?: boolean // Notify when stock is low
  newOrderNotification?: boolean // Notify on new orders
  // Contact Information
  storeEmail?: string
  storePhone?: string
  supportEmail?: string

  // Storefront & Catalog
  brandNames?: string[] // Multiple brand names
  // Product Categories are handled separately via category selection

  // Shipping & Logistics
  pickupAddresses?: Array<{
    // Multiple pickup addresses
    warehouseName: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    postalCode: string
    country: string
    contactName: string
    contactPhone: string
    isDefault?: boolean
    rtoSameAsPickup?: boolean
    rtoAddress?: {
      contactName?: string
      contactPhone?: string
      contactEmail?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    }
    kourierBoyzLogisticsPickupAddressId?: string // KourierBoyzLogistics pickup address ID for syncing
  }>
  preferredCouriers?: string[] // Preferred courier partners
  packagingStandards?: Array<{
    // Packaging requirements
    type: 'fragile' | 'perishable' | 'hazardous' | 'standard' | 'custom'
    description?: string
  }>

  // Return & Replacement
  replacementPolicy?: string // Separate from return policy

  // Compliance & Agreements
  marketplaceTermsAccepted?: boolean
  marketplaceTermsAcceptedAt?: Date
  marketplaceTermsPdfUrl?: string // PDF URL for this seller's acceptance
  sellerAgreementSigned?: boolean
  sellerAgreementSignedAt?: Date
  sellerAgreementSignature?: string // Base64 string or R2 URL
  sellerAgreementPdfUrl?: string // PDF URL for this seller's signed agreement
  returnRefundPolicyAccepted?: boolean
  returnRefundPolicyAcceptedAt?: Date
  returnRefundPolicyPdfUrl?: string // PDF URL for this seller's acceptance
  prohibitedItemsDeclared?: boolean
  prohibitedItemsDeclaration?: string // Text declaration
  prohibitedItemsPdfUrl?: string // PDF URL for this seller's declaration
  dataPrivacyConsent?: boolean
  dataPrivacyConsentAt?: Date
  dataPrivacyPdfUrl?: string // PDF URL for this seller's consent
  sessionVersion?: number

  // Device Verification (for super-admin password changes)
  trustedDevices?: Array<{
    deviceFingerprint: string
    lastUsedAt: Date
    userAgent?: string
    ipAddress?: string
  }>
  pendingPasswordChange?: {
    newPasswordHash: string
    verificationToken: string
    expiresAt: Date
    deviceFingerprint: string
    ipAddress?: string
    userAgent?: string
  }

  createdAt: Date
  updatedAt: Date
  comparePassword: (candidatePassword: string) => Promise<boolean>
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: false }, // Optional for OAuth users
    role: {
      type: String,
      enum: ['super-admin', 'customer', 'seller', 'user'],
      default: 'customer',
    },
    phone: { type: String },
    profilePhoto: { type: String }, // Profile photo URL
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    },
    recentSearches: {
      type: [
        {
          query: { type: String, required: true },
          searchedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // Notification Preferences
    notificationPreferences: {
      orderUpdates: { type: Boolean, default: true },
      promotionalEmails: { type: Boolean, default: true },
      newsletter: { type: Boolean, default: false },
    },

    // Two-factor authentication
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String },
    twoFactorEnabledAt: { type: Date },
    twoFactorTempSecret: { type: String },
    twoFactorTempSecretCreatedAt: { type: Date },
    twoFactorLastVerifiedAt: { type: Date },
    twoFactorBackupCodes: {
      type: [
        {
          codeHash: { type: String, required: true },
          used: { type: Boolean, default: false },
          usedAt: { type: Date },
        },
      ],
      default: [],
    },
    twoFactorPhoneCode: { type: String },
    twoFactorPhoneExpires: { type: Date },
    twoFactorPhoneLastSentAt: { type: Date },
    passkeys: [
      {
        credentialID: { type: Buffer, required: true },
        credentialPublicKey: { type: Buffer, required: true },
        counter: { type: Number, default: 0 },
        transports: [{ type: String }],
        nickname: { type: String },
        createdAt: { type: Date, default: Date.now },
        lastUsedAt: { type: Date },
      },
    ],
    passkeyRegistrationChallenge: { type: String },
    passkeyAuthenticationChallenge: { type: String },

    // Business / Store Information (KYC)
    businessName: { type: String },
    storeLogo: { type: String },
    storeSlug: { type: String, unique: true, sparse: true, lowercase: true }, // Unique slug for seller microsite
    businessType: {
      type: String,
      enum: ['Individual', 'Proprietorship', 'Partnership', 'Pvt Ltd', 'LLP', 'Trust'],
    },
    businessRegistrationNumber: { type: String },
    dateOfEstablishment: { type: Date },
    storeDescription: { type: String },

    // Business Address (KYC)
    addressLine1: { type: String },
    addressLine2: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },

    // Bank Account Details (KYC)
    bankAccountNumber: { type: String },
    accountHolderName: { type: String },
    bankName: { type: String },
    ifscCode: { type: String },
    cancelledCheque: { type: String },
    bankVerified: { type: Boolean, default: false },
    bankVerificationStatus: {
      type: String,
      enum: ['pending', 'success', 'failed'],
    },
    bankVerificationName: { type: String },
    bankVerificationReference: { type: String },

    // Tax & Legal Information (KYC)
    panNumber: { type: String },
    gstNumber: { type: String },
    aadhaarNumber: { type: String },
    idProof: { type: String },
    addressProof: { type: String },
    gstCertificate: { type: String },
    certificateOfIncorporation: { type: String },
    trustDeed: { type: String },

    // Authorized Person (for companies)
    authorizedPersonName: { type: String },
    authorizedPersonDesignation: { type: String },

    // Approval Status
    isApproved: { type: Boolean, default: false },
    kycSubmitted: { type: Boolean, default: false },
    kycStatus: {
      type: String,
      enum: ['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'],
      default: 'NOT_SUBMITTED',
    },
    rejectionReason: { type: String },
    onboardingTourCompletedAt: { type: Date },

    // Account Status (for customers)
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    blockedReason: { type: String },

    // Seller Lifecycle Status (for deactivation)
    sellerLifecycleStatus: {
      type: String,
      enum: ['ACTIVE', 'DEACTIVATION_REQUESTED', 'DEACTIVATED'],
      default: 'ACTIVE',
    },
    deactivationRequestedAt: { type: Date },
    deactivatedAt: { type: Date },
    deactivationReason: { type: String },
    deactivationReviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    // Buyer Lifecycle Status (for customer deactivation)
    buyerLifecycleStatus: {
      type: String,
      enum: ['ACTIVE', 'DEACTIVATION_REQUESTED', 'DEACTIVATED'],
      default: 'ACTIVE',
    },
    buyerDeactivationRequestedAt: { type: Date },
    buyerDeactivatedAt: { type: Date },
    buyerDeactivationReason: { type: String },
    originalEmail: { type: String }, // Store original email before masking
    originalName: { type: String }, // Store original name before masking
    originalPhone: { type: String }, // Store original phone before masking
    emailHash: { type: String }, // Hash of original email for reference

    // Customers list (for sellers) - tracks customers who have successfully received orders
    customers: [{ type: Schema.Types.ObjectId, ref: 'User' }],

    // OAuth Authentication
    googleId: { type: String },
    oauthProvider: { type: String, enum: ['google'] },
    requiresPhoneVerification: { type: Boolean, default: false },

    // Email Verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpires: { type: Date },

    // Phone Verification
    isPhoneVerified: { type: Boolean, default: false },
    phoneVerificationCode: { type: String },
    phoneVerificationExpires: { type: Date },
    phoneVerificationOtpLastSentAt: { type: Date }, // Track last time phone OTP was sent for profile updates

    // Password Reset
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    passwordResetOtpLastSentAt: { type: Date },

    // Temporary OTP for profile updates
    tempEmailOTP: { type: String },
    tempEmailOTPExpires: { type: Date },

    // Store Settings (marketplace settings)
    storeBanner: { type: String }, // Single banner image URL (shown in header)
    storefrontBanners: [
      {
        imageUrl: { type: String, required: true },
        category: { type: String }, // Category ID to navigate to when banner is clicked
        order: { type: Number, default: 0 }, // Display order (lower numbers appear first)
        gridSpan: { type: Number, default: 1, min: 1, max: 12 }, // Grid columns (1-12)
      },
    ], // Multiple banners shown below categories on home page
    storeVideo: { type: String }, // Store introduction video URL (YouTube, Vimeo, etc.) - either this OR storeVideoFile
    storeVideoFile: { type: String }, // Uploaded video file URL - either this OR storeVideo (not both)
    storeStatus: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    storeTheme: { type: String, default: 'modern' }, // Theme for seller microsite
    // Store Policies
    shippingPolicy: {
      type: String,
      default:
        'Standard shipping available. Orders are processed within 1-2 business days. Shipping times may vary based on location.',
    },
    returnPolicy: {
      type: String,
      default:
        'Items can be returned within 7 days of delivery. Products must be unused, unopened, and in original packaging with tags attached.',
    },
    refundPolicy: {
      type: String,
      default:
        'Refunds will be processed within 5-7 business days after we receive and inspect the returned item. Refund amount will be credited to your original payment method.',
    },
    cancellationPolicy: {
      type: String,
      default:
        'Orders can be cancelled within 24 hours of placement at no charge. After 24 hours, please contact support for cancellation requests.',
    },
    warrantyPolicy: {
      type: String,
      default:
        'All products come with manufacturer warranty as specified. Warranty terms and duration vary by product. Please check product details for specific warranty information.',
    },
    // Shipping Settings
    defaultShippingRate: { type: Number, default: 0 },
    shippingZones: [
      {
        zone: { type: String },
        rate: { type: Number },
      },
    ],
    // Social Media & Links
    website: { type: String },
    facebook: { type: String },
    instagram: { type: String },
    twitter: { type: String },
    youtube: { type: String },
    linkedin: { type: String },
    // SEO Settings
    storeMetaTitle: { type: String },
    storeMetaDescription: { type: String },
    storeKeywords: [{ type: String }],
    // Store Preferences
    lowStockNotification: { type: Boolean, default: true },
    newOrderNotification: { type: Boolean, default: true },
    // Contact Information
    storeEmail: { type: String },
    storePhone: { type: String },
    supportEmail: { type: String },

    // Storefront & Catalog
    brandNames: [{ type: String }],
    // Product Categories are handled separately

    // Shipping & Logistics
    pickupAddresses: [
      {
        warehouseName: { type: String, required: true },
        addressLine1: { type: String, required: true },
        addressLine2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
        contactName: { type: String, required: true },
        contactPhone: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        rtoSameAsPickup: { type: Boolean, default: true },
        rtoAddress: {
          contactName: { type: String },
          contactPhone: { type: String },
          contactEmail: { type: String },
          addressLine1: { type: String },
          addressLine2: { type: String },
          city: { type: String },
          state: { type: String },
          postalCode: { type: String },
          country: { type: String },
        },
        kourierBoyzLogisticsPickupAddressId: { type: String }, // KourierBoyzLogistics pickup address ID for syncing
      },
    ],
    preferredCouriers: [{ type: String }],
    packagingStandards: [
      {
        type: {
          type: String,
          enum: ['fragile', 'perishable', 'hazardous', 'standard', 'custom'],
        },
        description: { type: String },
      },
    ],

    // Return & Replacement
    replacementPolicy: {
      type: String,
      default:
        'Product replacement is available for manufacturing defects within 30 days of purchase. Replacement subject to inspection and availability. Contact support for replacement requests.',
    },

    // Compliance & Agreements
    marketplaceTermsAccepted: { type: Boolean, default: false },
    marketplaceTermsAcceptedAt: { type: Date },
    marketplaceTermsPdfUrl: { type: String }, // PDF URL for this seller's acceptance
    sellerAgreementSigned: { type: Boolean, default: false },
    sellerAgreementSignedAt: { type: Date },
    sellerAgreementSignature: { type: String }, // Base64 string or R2 URL
    sellerAgreementPdfUrl: { type: String }, // PDF URL for this seller's signed agreement
    returnRefundPolicyAccepted: { type: Boolean, default: false },
    returnRefundPolicyAcceptedAt: { type: Date },
    returnRefundPolicyPdfUrl: { type: String }, // PDF URL for this seller's acceptance
    prohibitedItemsDeclared: { type: Boolean, default: false },
    prohibitedItemsDeclaration: { type: String },
    prohibitedItemsPdfUrl: { type: String }, // PDF URL for this seller's declaration
    dataPrivacyConsent: { type: Boolean, default: false },
    dataPrivacyConsentAt: { type: Date },
    dataPrivacyPdfUrl: { type: String }, // PDF URL for this seller's consent
    sessionVersion: { type: Number, default: 0 },
    // Device Verification (for super-admin password changes)
    trustedDevices: [
      {
        deviceFingerprint: { type: String, required: true },
        lastUsedAt: { type: Date, default: Date.now },
        userAgent: { type: String },
        ipAddress: { type: String },
      },
    ],
    pendingPasswordChange: {
      newPasswordHash: { type: String },
      verificationToken: { type: String },
      expiresAt: { type: Date },
      deviceFingerprint: { type: String },
      ipAddress: { type: String },
      userAgent: { type: String },
    },
  },
  { timestamps: true },
)

// Pre-save hook to sync kycStatus with isApproved for sellers
UserSchema.pre('save', function (next) {
  // Only process sellers
  if (this.role === 'seller') {
    // If kycStatus is not explicitly set, sync it with isApproved and kycSubmitted
    if (!this.isModified('kycStatus') || this.kycStatus === undefined) {
      if (this.isApproved && this.kycSubmitted) {
        this.kycStatus = 'APPROVED'
      } else if (this.kycSubmitted && this.rejectionReason) {
        this.kycStatus = 'REJECTED'
      } else if (this.kycSubmitted) {
        this.kycStatus = 'PENDING'
      } else {
        this.kycStatus = 'NOT_SUBMITTED'
      }
    }
    
    // If kycStatus is explicitly set to SUSPENDED or REJECTED, ensure isApproved is false
    if (this.kycStatus === 'SUSPENDED' || this.kycStatus === 'REJECTED') {
      this.isApproved = false
    }
    
    // If kycStatus is APPROVED, ensure isApproved is true
    if (this.kycStatus === 'APPROVED') {
      this.isApproved = true
      this.rejectionReason = undefined
    }
  }
  next()
})

UserSchema.methods.comparePassword = async function (candidatePassword: string) {
  if (!this.password) {
    return false // OAuth users don't have passwords
  }
  return bcrypt.compare(candidatePassword, this.password)
}

/**
 * Get decrypted phone number
 * This method should be used when you need the actual phone number (e.g., for SMS)
 */
UserSchema.methods.getDecryptedPhone = function (): string | undefined {
  const phone = (this as any).phone
  if (!phone) return undefined

  try {
    const decrypted = decryptPhone(phone)

    // CRITICAL: If decryptPhone returns undefined, it means decryption failed (key mismatch)
    // Don't return the encrypted phone - return undefined instead
    if (!decrypted) {
      // Check if the original phone is encrypted (base64, 50+ chars)
      const phoneStr = String(phone)
      const isBase64Encrypted = phoneStr.length >= 50 && /^[A-Za-z0-9+/=]+$/.test(phoneStr)
      if (isBase64Encrypted) {
        // It's encrypted but can't be decrypted - return undefined (don't return encrypted string)
        return undefined
      }
      // Not encrypted, might be plain text - check if it's a valid phone
      const phoneDigits = phoneStr.replace(/\D/g, '')
      if (phoneDigits.length >= 10 && phoneDigits.length <= 15) {
        // It's a plain phone number, return as-is
        return phoneStr
      }
      // Not a valid phone format, return undefined
      return undefined
    }

    // Successfully decrypted - validate it's a real phone number
    const decryptedStr = String(decrypted)
    const phoneDigits = decryptedStr.replace(/\D/g, '')
    if (phoneDigits.length >= 10 && phoneDigits.length <= 15) {
      return decrypted
    }

    // Decrypted but not a valid phone - return undefined
    return undefined
  } catch (error) {
    // If decryption throws an error, check if it's a plain phone number
    const phoneStr = String(phone)
    const isBase64Encrypted = phoneStr.length >= 50 && /^[A-Za-z0-9+/=]+$/.test(phoneStr)
    if (isBase64Encrypted) {
      // It's encrypted but decryption threw an error - return undefined
      return undefined
    }
    const phoneDigits = phoneStr.replace(/\D/g, '')
    if (phoneDigits.length >= 10 && phoneDigits.length <= 15) {
      // It's a plain phone number, return as-is
      return phoneStr
    }
    // Not a valid phone format, return undefined
    return undefined
  }
}

/**
 * Set phone number (automatically encrypts before saving)
 */
UserSchema.methods.setPhone = function (phone: string | undefined) {
  if (!phone) {
    ;(this as any).phone = undefined
    return
  }
  // Only encrypt if not already encrypted
  if (isPhoneEncrypted(phone)) {
    ;(this as any).phone = phone
  } else {
    ;(this as any).phone = encryptPhone(phone)
  }
}

// Pre-save hook: Encrypt phone number before saving
UserSchema.pre('save', function (next) {
  // Only encrypt if phone is set and not already encrypted
  const phone = (this as any).phone
  if (phone && !isPhoneEncrypted(phone)) {
    const encrypted = encryptPhone(phone)
    if (encrypted) {
      ;(this as any).phone = encrypted
      console.log(
        `[User.pre-save] Encrypted phone for user ${(this as any)._id}. Phone length: ${
          encrypted.length
        }`,
      )
    } else {
      console.warn(`[User.pre-save] Failed to encrypt phone for user ${(this as any)._id}`)
    }
  } else if (phone && isPhoneEncrypted(phone)) {
    // Phone is already encrypted - but might be with old key
    // Try to decrypt it to verify it's decryptable with current key
    try {
      const decrypted = decryptPhone(phone)
      if (!decrypted) {
        // Can't decrypt - it's encrypted with old key
        // We should re-encrypt, but we don't have the plain text
        // This case should be handled in updateProfile where we have plain text
        console.warn(
          `[User.pre-save] Phone for user ${
            (this as any)._id
          } is encrypted but cannot be decrypted with current key.`,
        )
      }
    } catch (error) {
      // Decryption failed - phone encrypted with old key
      // But we can't re-encrypt here without plain text
      console.warn(
        `[User.pre-save] Phone for user ${(this as any)._id} appears encrypted with old key.`,
      )
    }
  }
  next()
})

// Post-find hook: Decrypt phone numbers after retrieval (for internal use)
// Note: We'll decrypt on-demand using getDecryptedPhone() method
// This keeps the database secure while allowing decryption when needed

// Create compound unique index on email + role to allow same email for different roles
UserSchema.index({ email: 1, role: 1 }, { unique: true })

// Index for storeSlug lookup (only for sellers)
UserSchema.index({ storeSlug: 1 }, { unique: true, sparse: true })

export default mongoose.model<IUser>('User', UserSchema)
