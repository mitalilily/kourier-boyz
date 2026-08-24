import bcrypt from 'bcryptjs'
import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Order from '../models/Order'
import Role from '../models/Role'
import User from '../models/User'
import UserRole from '../models/UserRole'
import { getPhoneFromUser } from '../utils/phoneDecryptionHelper'

const normalizeBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim()
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

const buildPanelUrl = (baseUrl: string | undefined, path: string): string => {
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  if (!baseUrl) {
    return `[ADMIN_PANEL_URL_NOT_CONFIGURED]/${normalizedPath}`
  }
  return new URL(normalizedPath, normalizeBaseUrl(baseUrl)).toString()
}

// Helper to generate slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

// Helper to mask customer name for privacy (e.g., "John Doe" -> "Jo** D**")
const maskName = (name: string): string => {
  if (!name) return ''
  const parts = name.trim().split(/\s+/)
  return parts
    .map((part) => {
      if (part.length <= 2) return part[0] + '*'
      return part.slice(0, 2) + '*'.repeat(Math.min(part.length - 2, 3))
    })
    .join(' ')
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

// Get all users (admin only) with filtering
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const { role, status, search, kycStatus, businessType } = req.query

    // Build filter query
    const filter: any = {}

    // Filter by role
    if (role) {
      filter.role = role
    }

    // Filter by KYC status
    if (kycStatus === 'pending') {
      filter.role = 'seller'
      filter.kycSubmitted = true
      filter.isApproved = false
      filter.rejectionReason = { $exists: false }
    } else if (kycStatus === 'approved') {
      filter.role = 'seller'
      filter.isApproved = true
    } else if (kycStatus === 'rejected') {
      filter.role = 'seller'
      filter.kycSubmitted = true
      filter.isApproved = false
      filter.rejectionReason = { $exists: true, $ne: '' }
    } else if (kycStatus === 'not-submitted') {
      filter.role = 'seller'
      filter.kycSubmitted = false
    }

    // Filter by approval status
    if (status === 'approved') {
      filter.isApproved = true
    } else if (status === 'pending') {
      filter.isApproved = false
    }

    // Filter by business type
    if (businessType) {
      filter.businessType = businessType
    }

    // Search by name, email, business name
    // Note: Phone numbers are encrypted, so they cannot be searched by partial match
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } },
        // Phone search removed - encrypted phones cannot be searched by regex
      ]
    }

    const users = await User.find(filter).select('-password').sort({ createdAt: -1 })

    // Populate roles for each user
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const userRoles = await UserRole.find({ userId: user._id }).populate(
          'roleId',
          'name description',
        )
        const roles = userRoles.map((ur) => ({
          _id: (ur.roleId as any)?._id?.toString(),
          name: (ur.roleId as any)?.name,
          description: (ur.roleId as any)?.description,
        }))
        const userObj = user.toObject() as any
        userObj.roles = roles
        return userObj
      }),
    )

    res.json(usersWithRoles)
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password')
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // If accessed by seller and customer is blocked, don't show it
    const requesterRole = req.user?.role
    if (requesterRole === 'seller' && user.role === 'customer' && user.isBlocked) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Get user roles
    const userRoles = await UserRole.find({ userId: user._id }).populate(
      'roleId',
      'name description',
    )
    const roles = userRoles.map((ur) => ({
      _id: (ur.roleId as any)?._id,
      name: (ur.roleId as any)?.name,
      description: (ur.roleId as any)?.description,
      assignedAt: ur.assignedAt,
    }))

    const userPayload = user.toObject() as any
    // Exclude phone from initial object to prevent encrypted phone from being included
    const { phone: _encryptedPhone, ...userResponse } = userPayload
    userResponse.roles = roles

    // Decrypt phone number for display (users should see their own phone number)
    // Only add phone back if we can decrypt it - never return encrypted string
    if (user.phone) {
      const phoneResult = getPhoneFromUser(user, String(user._id), 'Get User By ID')
      if (phoneResult.isDecryptable && phoneResult.phone) {
        userResponse.phone = phoneResult.phone
      } else if (phoneResult.isPlainText && phoneResult.phone) {
        userResponse.phone = phoneResult.phone
      } else {
        // Can't decrypt - don't show encrypted string
        userResponse.phone = undefined
      }
    } else {
      userResponse.phone = undefined
    }

    res.json(userResponse)
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Create new user (admin only)
export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      businessName,
      businessAddress,
      gstNumber,
      roleIds,
    } = req.body

    // Validate required fields
    if (!role) {
      return res.status(400).json({ error: 'Role is required' })
    }

    // Validate role value
    const validRoles = ['super-admin', 'customer', 'seller', 'user']
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be one of: super-admin, customer, seller, user',
      })
    }

    // Check if user with same email and role already exists
    // The User model has a compound unique index on email+role, allowing same email with different roles
    const existingUser = await User.findOne({ email, role })
    if (existingUser) {
      return res.status(400).json({ error: `User with this email already exists as a ${role}` })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role, // Role is required, no default
      phone,
      businessName,
      businessAddress,
      gstNumber,
      isApproved: role === 'seller' ? false : true, // Sellers need approval
      isEmailVerified: true, // Admin-created users are auto-verified
    })

    await user.save()

    // Assign roles if provided (for admin users)
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      // Verify all roles exist
      const roles = await Role.find({ _id: { $in: roleIds } })
      if (roles.length !== roleIds.length) {
        // User created but roles invalid - log warning but don't fail
        console.warn(
          `User ${user._id} created but some roles were invalid. Expected ${roleIds.length}, found ${roles.length}`,
        )
      } else {
        // Remove existing role assignments (shouldn't be any, but just in case)
        await UserRole.deleteMany({ userId: user._id })

        // Create new role assignments
        const assignedBy = req.user?.userId
        const userRoles = roleIds.map((roleId: string) => ({
          userId: user._id,
          roleId,
          assignedBy,
          assignedAt: new Date(),
        }))

        await UserRole.insertMany(userRoles)
      }
    }

    // Send welcome email for admin users (super-admin or user role)
    if (role === 'super-admin' || role === 'user') {
      try {
        const { emailTemplates, sendEmail } = await import('../utils/email')
        const adminPanelUrl = process.env.ADMIN_PANEL_URL
        const adminLoginUrl = adminPanelUrl ? `${adminPanelUrl}/login` : null
        const emailHtml = emailTemplates.adminUserCreated(name, email, password, adminLoginUrl)
        await sendEmail(email, 'Welcome to Kourier Boyz Admin Panel', emailHtml)
      } catch (emailError) {
        // Log but don't fail user creation if email fails
        console.error('Failed to send welcome email to new admin user:', emailError)
      }
    }

    // Get user roles for response
    const userRoles = await UserRole.find({ userId: user._id }).populate(
      'roleId',
      'name description',
    )
    const rolesData = userRoles.map((ur) => ({
      _id: (ur.roleId as any)?._id,
      name: (ur.roleId as any)?.name,
      description: (ur.roleId as any)?.description,
    }))

    // Remove password from response
    const userResponse = user.toObject() as { password?: string; roles?: any[] }
    delete userResponse.password
    userResponse.roles = rolesData

    res.status(201).json(userResponse)
  } catch (error: any) {
    console.error('Error creating user:', error)
    // Handle duplicate key error (from compound unique index)
    if (error.code === 11000) {
      return res.status(400).json({ error: `User with this email and role already exists` })
    }
    res.status(500).json({ error: 'Server error' })
  }
}

// Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      role,
      phone,
      businessName,
      businessAddress,
      gstNumber,
      isApproved,
      kycStatus,
      rejectionReason,
    } = req.body

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const hasApprovalUpdate =
      user.role === 'seller' &&
      (isApproved !== undefined || kycStatus !== undefined || rejectionReason !== undefined)

    // Track if KYC status is changing to SUSPENDED or REJECTED
    const previousKycStatus = user.kycStatus
    const previousIsApproved = user.isApproved
    let nextKycStatus = user.kycStatus
    if (hasApprovalUpdate) {
      const nextIsApproved = isApproved !== undefined ? isApproved : user.isApproved
      if (kycStatus !== undefined) {
        nextKycStatus = kycStatus
      } else if (nextIsApproved) {
        nextKycStatus = 'APPROVED'
      } else if (user.kycSubmitted) {
        nextKycStatus = rejectionReason ? 'REJECTED' : 'PENDING'
      } else {
        nextKycStatus = 'NOT_SUBMITTED'
      }
    }
    const isKycStatusChanging = hasApprovalUpdate && nextKycStatus !== previousKycStatus
    const isBecomingSuspendedOrRejected =
      isKycStatusChanging && (nextKycStatus === 'SUSPENDED' || nextKycStatus === 'REJECTED')

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' })
      }
      user.email = email
    }

    // Update fields
    if (name) user.name = name
    if (role) user.role = role
    if (phone !== undefined) user.phone = phone
    if (businessName !== undefined) user.businessName = businessName
    if (gstNumber !== undefined) user.gstNumber = gstNumber
    if (hasApprovalUpdate) {
      if (isApproved !== undefined) user.isApproved = isApproved
      user.kycStatus = nextKycStatus
      if (rejectionReason !== undefined && !user.isApproved) {
        user.rejectionReason = rejectionReason
      } else if (user.isApproved) {
        user.rejectionReason = undefined
      }
    }

    await user.save()

    // If KYC status changed to SUSPENDED or REJECTED, disable all active products
    if (isBecomingSuspendedOrRejected && user.role === 'seller') {
      try {
        const Product = mongoose.model('Product')
        await Product.updateMany(
          { seller: user._id, status: { $in: ['active', 'inactive'] } },
          { $set: { status: 'inactive' } },
        )
        console.log(
          `Disabled all products for seller ${user._id} due to KYC status: ${nextKycStatus}`,
        )
      } catch (productError) {
        console.error('Error disabling products on KYC status change:', productError)
        // Don't fail the user update if product update fails
      }
    }

    // Send email notification to seller when approval status changes
    if (hasApprovalUpdate && user.role === 'seller') {
      try {
        const { sendEmail, emailTemplates } = await import('../utils/email')
        const approvalChanged = isApproved !== undefined && isApproved !== previousIsApproved
        const shouldSendApproval = approvalChanged && user.isApproved
        const shouldSendRejection =
          (rejectionReason !== undefined || nextKycStatus === 'REJECTED') && !user.isApproved

        if (shouldSendApproval) {
          console.log(
            `[KYC] Approving seller ${user._id} (${user.email}). Sending approval email.`,
          )
          await sendEmail(
            user.email,
            'KYC Approved - Welcome to Seller Hub!',
            emailTemplates.sellerApproval(user.name),
          )
        } else if (shouldSendRejection) {
          console.log(
            `[KYC] Rejecting seller ${user._id} (${user.email}). Sending rejection email.`,
          )
          await sendEmail(
            user.email,
            'KYC Application Status - Action Required',
            emailTemplates.sellerRejection(user.name, rejectionReason || 'No reason provided'),
          )
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError)
        // Don't fail the request if email fails
      }
    }

    // Remove password from response
    const userResponse = user.toObject() as { password?: string }
    delete userResponse.password

    res.json(userResponse)
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Admin-triggered password reset
export const resetUserPasswordByAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { password } = req.body as { password?: string }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    user.password = await bcrypt.hash(password, 10)
    user.phoneVerificationCode = undefined
    user.phoneVerificationExpires = undefined

    await user.save()

    try {
      const { sendEmail, emailTemplates } = await import('../utils/email')
      const loginUrl =
        user.role === 'seller'
          ? (process.env.SELLER_PANEL_URL ? `${process.env.SELLER_PANEL_URL}/login` : null)
          : user.role === 'customer'
          ? (process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/login` : null)
          : (process.env.ADMIN_PANEL_URL ? `${process.env.ADMIN_PANEL_URL}/login` : null)

      await sendEmail(
        user.email,
        'Your Kourier Boyz password has been reset',
        emailTemplates.adminPasswordReset(user.name, password, loginUrl),
      )
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError)
    }

    res.json({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('Error resetting user password:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    res.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get all sellers (for seller management)
export const getAllSellers = async (req: Request, res: Response) => {
  try {
    const sellers = await User.find({ role: 'seller' }).select('-password').sort({ createdAt: -1 })
    res.json(sellers)
  } catch (error) {
    console.error('Error fetching sellers:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Submit KYC (for sellers)
export const submitKYC = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const {
      businessName,
      businessType,
      businessRegistrationNumber,
      dateOfEstablishment,
      storeDescription,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      // Bank details
      bankAccountNumber,
      accountHolderName,
      bankName,
      ifscCode,
      // Tax & Legal
      panNumber,
      gstNumber,
      aadhaarNumber,
      // Authorized person (for companies)
      authorizedPersonName,
      authorizedPersonDesignation,
    } = req.body

    // Helper to normalise optional string fields coming from multipart/form-data.
    // Treat '', whitespace-only and literal 'undefined' as "not provided".
    const normalizeString = (value: unknown): string | undefined => {
      if (value === undefined || value === null) return undefined
      const str = String(value).trim()
      if (!str || str === 'undefined') return undefined
      return str
    }

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(sellerId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.role !== 'seller') {
      return res.status(400).json({ error: 'Only sellers can submit KYC' })
    }

    // Handle file uploads (URLs will be generated by R2 upload)
    const files = req.files as { [fieldname: string]: Express.Multer.File[] }
    let storeLogoUrl: string | undefined
    let gstCertificateUrl: string | undefined
    let idProofUrl: string | undefined
    let addressProofUrl: string | undefined
    let cancelledChequeUrl: string | undefined
    let certificateOfIncorporationUrl: string | undefined
    let trustDeedUrl: string | undefined

    // Upload files to R2 if present
    if (files) {
      const { uploadToR2 } = await import('../utils/r2Upload')

      if (files.storeLogo && files.storeLogo[0]) {
        const file = files.storeLogo[0]
        storeLogoUrl = await uploadToR2(
          file.buffer,
          `${sellerId}/logo-${Date.now()}.${file.mimetype.split('/')[1]}`,
          file.mimetype,
          'kyc',
        )
      }

      if (files.gstCertificate && files.gstCertificate[0]) {
        const file = files.gstCertificate[0]
        gstCertificateUrl = await uploadToR2(
          file.buffer,
          `${sellerId}/gst-cert-${Date.now()}.${file.mimetype.split('/')[1]}`,
          file.mimetype,
          'kyc',
        )
      }

      if (files.idProof && files.idProof[0]) {
        const file = files.idProof[0]
        idProofUrl = await uploadToR2(
          file.buffer,
          `${sellerId}/id-proof-${Date.now()}.${file.mimetype.split('/')[1]}`,
          file.mimetype,
          'kyc',
        )
      }

      if (files.addressProof && files.addressProof[0]) {
        const file = files.addressProof[0]
        addressProofUrl = await uploadToR2(
          file.buffer,
          `${sellerId}/address-proof-${Date.now()}.${file.mimetype.split('/')[1]}`,
          file.mimetype,
          'kyc',
        )
      }

      if (files.cancelledCheque && files.cancelledCheque[0]) {
        const file = files.cancelledCheque[0]
        cancelledChequeUrl = await uploadToR2(
          file.buffer,
          `${sellerId}/cancelled-cheque-${Date.now()}.${file.mimetype.split('/')[1]}`,
          file.mimetype,
          'kyc',
        )
      }

      if (files.certificateOfIncorporation && files.certificateOfIncorporation[0]) {
        const file = files.certificateOfIncorporation[0]
        certificateOfIncorporationUrl = await uploadToR2(
          file.buffer,
          `${sellerId}/incorporation-cert-${Date.now()}.${file.mimetype.split('/')[1]}`,
          file.mimetype,
          'kyc',
        )
      }

      if (files.trustDeed && files.trustDeed[0]) {
        const file = files.trustDeed[0]
        trustDeedUrl = await uploadToR2(
          file.buffer,
          `${sellerId}/trust-deed-${Date.now()}.${file.mimetype.split('/')[1]}`,
          file.mimetype,
          'kyc',
        )
      }
    }

    // Resolve final values by preferring newly submitted data, but
    // falling back to already-saved KYC data from previous steps.
    const finalBusinessName = normalizeString(businessName) ?? user.businessName
    const finalBusinessType = normalizeString(businessType) ?? user.businessType
    const finalAddressLine1 = normalizeString(addressLine1) ?? user.addressLine1
    const finalCity = normalizeString(city) ?? user.city
    const finalState = normalizeString(state) ?? user.state
    const finalPostalCode = normalizeString(postalCode) ?? user.postalCode
    const finalCountry = normalizeString(country) ?? user.country
    const finalPanNumber = normalizeString(panNumber) ?? user.panNumber

    // Basic server-side safety: ensure critical fields exist
    if (!finalBusinessName || !finalBusinessType) {
      return res
        .status(400)
        .json({ error: 'Please complete Business / Store Information before submitting KYC.' })
    }

    if (!finalAddressLine1 || !finalCity || !finalState || !finalPostalCode || !finalCountry) {
      return res
        .status(400)
        .json({ error: 'Please complete Business Address details before submitting KYC.' })
    }

    if (!finalPanNumber) {
      return res.status(400).json({ error: 'PAN number is required for KYC submission.' })
    }

    // Update user with KYC details using resolved values
    user.businessName = finalBusinessName
    user.businessType = finalBusinessType as any
    user.businessRegistrationNumber = normalizeString(businessRegistrationNumber)
    user.dateOfEstablishment = dateOfEstablishment
      ? new Date(String(dateOfEstablishment))
      : user.dateOfEstablishment
    user.storeDescription = normalizeString(storeDescription) ?? user.storeDescription

    user.addressLine1 = finalAddressLine1
    user.addressLine2 = normalizeString(addressLine2) ?? user.addressLine2
    user.city = finalCity
    user.state = finalState
    user.postalCode = finalPostalCode
    user.country = finalCountry

    // Bank details
    user.bankAccountNumber = normalizeString(bankAccountNumber) ?? user.bankAccountNumber
    user.accountHolderName = normalizeString(accountHolderName) ?? user.accountHolderName
    user.bankName = normalizeString(bankName) ?? user.bankName
    user.ifscCode = normalizeString(ifscCode) ?? user.ifscCode

    // Tax & Legal
    user.panNumber = finalPanNumber
    user.gstNumber = normalizeString(gstNumber) ?? user.gstNumber
    user.aadhaarNumber = normalizeString(aadhaarNumber) ?? user.aadhaarNumber

    // Authorized person (for companies)
    user.authorizedPersonName = normalizeString(authorizedPersonName) ?? user.authorizedPersonName
    user.authorizedPersonDesignation =
      normalizeString(authorizedPersonDesignation) ?? user.authorizedPersonDesignation

    // File URLs
    if (storeLogoUrl) user.storeLogo = storeLogoUrl
    if (gstCertificateUrl) user.gstCertificate = gstCertificateUrl
    if (idProofUrl) user.idProof = idProofUrl
    if (addressProofUrl) user.addressProof = addressProofUrl
    if (cancelledChequeUrl) user.cancelledCheque = cancelledChequeUrl
    if (certificateOfIncorporationUrl)
      user.certificateOfIncorporation = certificateOfIncorporationUrl
    if (trustDeedUrl) user.trustDeed = trustDeedUrl

    user.kycSubmitted = true
    user.isApproved = false // Reset approval status on KYC submission
    user.kycStatus = 'PENDING' // Set status to PENDING when KYC is submitted
    user.rejectionReason = undefined // Clear any previous rejection reason

    // Auto-generate store slug from business name if not already set (use finalBusinessName so we use the value we actually saved)
    if (finalBusinessName && !user.storeSlug) {
      user.storeSlug = await generateUniqueStoreSlug(finalBusinessName, sellerId)
    }

    await user.save()

    const userResponse = user.toObject() as { password?: string }
    delete userResponse.password

    // Notify super-admins about new KYC submission (DB + Socket + optional email)
    try {
      const [NotificationModule, UserModel, ioModule, emailService] = await Promise.all([
        import('../models/Notification'),
        import('../models/User'),
        import('../server'),
        import('../services/email.service'),
      ])

      const Notification = NotificationModule.default
      const UserModelClass = UserModel.default
      const { io } = ioModule as { io: import('socket.io').Server }
      const { sendEmailViaSMTP } = emailService

      // Create notifications for all super-admins
      const superAdmins = await UserModelClass.find({ role: 'super-admin' })
        .select('_id email name')
        .lean()

      if (superAdmins && superAdmins.length > 0) {
        const notificationDocs = superAdmins.map((admin) => ({
          userId: admin._id,
          title: 'New seller KYC submitted',
          message: `${user.name} (${user.email}) has submitted KYC for review.`,
          type: 'system' as const,
          link: `/sellers/${user._id}`,
        }))

        await Notification.insertMany(notificationDocs)

        // Real-time notification via Socket.IO (super-admin room)
        try {
          io.to('super-admin').emit('notification:new', {
            title: 'New seller KYC submitted',
            message: `${user.name} (${user.email}) has submitted KYC for review.`,
            type: 'system',
            link: `/sellers/${user._id}`,
          })
        } catch {
          // Ignore socket errors
        }

        // Email notification to a configured admin address (optional)
        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
        if (adminEmail) {
          const dashboardUrl = process.env.ADMIN_PANEL_URL
          if (!dashboardUrl) {
            console.warn('⚠️ ADMIN_PANEL_URL not configured - KYC email link may be invalid')
          }
          const reviewUrl = buildPanelUrl(dashboardUrl, `/sellers/${user._id}`)
          const phoneResult = user.phone
            ? getPhoneFromUser(user, String(user._id), 'KYC Submission Email')
            : null
          const resolvedPhone =
            (phoneResult?.isDecryptable && phoneResult.phone) ||
            (phoneResult?.isPlainText && phoneResult.phone) ||
            (user.storePhone && user.storePhone.trim().length > 0 ? user.storePhone : undefined)

          const html = `
            <p>A new seller has submitted KYC for review on Kourier Boyz.</p>
            <p>
              <strong>Name:</strong> ${user.name}<br/>
              <strong>Email:</strong> ${user.email}<br/>
              <strong>Phone:</strong> ${resolvedPhone || 'N/A'}
            </p>
            <p>
              You can review this KYC in the admin panel:
              <a href="${reviewUrl}">${reviewUrl}</a>
            </p>
          `

          void sendEmailViaSMTP({
            to: adminEmail,
            subject: 'New seller KYC submitted - Kourier Boyz',
            html,
          })
        }
      }
    } catch (notifyError) {
      console.error('Error sending KYC submission notifications:', notifyError)
    }

    res.json({
      message: 'KYC submitted successfully. Your application is under review.',
      user: userResponse,
    })
  } catch (error) {
    console.error('Error submitting KYC:', error)

    // Surface Mongoose validation errors (e.g. invalid enum values) as 400 responses
    if (error instanceof mongoose.Error.ValidationError) {
      const validationErrors = Object.values(error.errors || {})
      const firstError: any = validationErrors[0]

      const message =
        (firstError && (firstError.message as string)) ||
        error.message ||
        'KYC validation failed. Please check your details and try again.'

      return res.status(400).json({ error: message })
    }

    res.status(500).json({ error: 'Server error' })
  }
}

// Approve/reject seller
export const updateSellerApproval = async (req: Request, res: Response) => {
  try {
    const { isApproved, rejectionReason, kycStatus } = req.body
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({ error: 'Seller not found' })
    }

    if (user.role !== 'seller') {
      return res.status(400).json({ error: 'User is not a seller' })
    }

    // Track if KYC status is changing to SUSPENDED or REJECTED
    const previousKycStatus = user.kycStatus
    const newKycStatus = kycStatus || (isApproved ? 'APPROVED' : user.kycSubmitted ? 'REJECTED' : 'PENDING')
    const isKycStatusChanging = newKycStatus !== previousKycStatus
    const isBecomingSuspendedOrRejected = 
      isKycStatusChanging && (newKycStatus === 'SUSPENDED' || newKycStatus === 'REJECTED')

    user.isApproved = isApproved
    
    // Update kycStatus based on isApproved or explicit kycStatus
    if (kycStatus) {
      user.kycStatus = kycStatus
    } else if (isApproved) {
      user.kycStatus = 'APPROVED'
    } else if (user.kycSubmitted) {
      // If KYC was submitted but not approved, set to REJECTED if rejectionReason exists
      user.kycStatus = rejectionReason ? 'REJECTED' : 'PENDING'
    } else {
      user.kycStatus = 'NOT_SUBMITTED'
    }

    if (!isApproved && rejectionReason) {
      user.rejectionReason = rejectionReason
    } else if (isApproved) {
      user.rejectionReason = undefined // Clear rejection reason on approval
    }

    await user.save()

    // If KYC status changed to SUSPENDED or REJECTED, disable all active products
    if (isBecomingSuspendedOrRejected) {
      try {
        const Product = mongoose.model('Product')
        const result = await Product.updateMany(
          { seller: user._id, status: { $in: ['active', 'inactive'] } },
          { $set: { status: 'inactive' } },
        )
        console.log(`Disabled ${result.modifiedCount} products for seller ${user._id} due to KYC status: ${newKycStatus}`)
      } catch (productError) {
        console.error('Error disabling products on KYC status change:', productError)
        // Don't fail the user update if product update fails
      }
    }

    // Send email notification to seller
    try {
      const { sendEmail, emailTemplates } = await import('../utils/email')

      if (isApproved) {
        console.log(
          `[KYC] Approving seller ${user._id} (${user.email}). Sending approval email.`,
        )
        await sendEmail(
          user.email,
          'KYC Approved - Welcome to Seller Hub!',
          emailTemplates.sellerApproval(user.name),
        )
      } else {
        console.log(
          `[KYC] Rejecting seller ${user._id} (${user.email}). Sending rejection email.`,
        )
        await sendEmail(
          user.email,
          'KYC Application Status - Action Required',
          emailTemplates.sellerRejection(user.name, rejectionReason || 'No reason provided'),
        )
      }
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      // Don't fail the request if email fails
    }

    const userResponse = user.toObject() as { password?: string }
    delete userResponse.password

    res.json(userResponse)
  } catch (error) {
    console.error('Error updating seller approval:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get all customers (for admin)
export const getAllCustomers = async (req: Request, res: Response) => {
  try {
    const { status, search, isBlocked } = req.query

    const filter: any = { role: 'customer' }

    // Filter by blocked status
    if (isBlocked === 'true') {
      filter.isBlocked = true
    } else if (isBlocked === 'false') {
      filter.isBlocked = false
    }

    // Filter by email verification status
    if (status === 'verified') {
      filter.isEmailVerified = true
    } else if (status === 'unverified') {
      filter.isEmailVerified = false
    }

    // Search by name, email, phone
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        // Phone search removed - encrypted phones cannot be searched by regex
      ]
    }

    const customers = await User.find(filter).select('-password').sort({ createdAt: -1 })

    res.json(customers)
  } catch (error) {
    console.error('Error fetching customers:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Block/unblock customer (admin only)
export const updateCustomerStatus = async (req: Request, res: Response) => {
  try {
    const { isBlocked, blockedReason } = req.body
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    if (user.role !== 'customer') {
      return res.status(400).json({ error: 'User is not a customer' })
    }

    user.isBlocked = isBlocked || false

    if (isBlocked) {
      user.blockedAt = new Date()
      user.blockedReason = blockedReason || 'Account blocked by admin'
    } else {
      user.blockedAt = undefined
      user.blockedReason = undefined
    }

    await user.save()

    const userResponse = user.toObject() as { password?: string }
    delete userResponse.password

    res.json(userResponse)
  } catch (error) {
    console.error('Error updating customer status:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Block/unblock admin user (super-admin only)
export const updateAdminUserStatus = async (req: Request, res: Response) => {
  try {
    const { isBlocked, blockedReason } = req.body
    const currentUser = req.user
    const user = await User.findById(req.params.id)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Only allow blocking users with role 'user' (admin users)
    // Super-admin can block admin users, but cannot block other super-admins
    if (user.role === 'super-admin') {
      // Only allow if the current user is also super-admin and is not blocking themselves
      if (currentUser?.role !== 'super-admin') {
        return res.status(403).json({ error: 'Only super-admin can block admin users' })
      }
      const userId = String(user._id)
      if (currentUser?.userId === userId) {
        return res.status(400).json({ error: 'Cannot block yourself' })
      }
    } else if (user.role !== 'user') {
      return res.status(400).json({ error: 'User is not an admin user' })
    }

    // Check if current user is super-admin
    if (currentUser?.role !== 'super-admin') {
      return res.status(403).json({ error: 'Only super-admin can block admin users' })
    }

    user.isBlocked = isBlocked || false

    if (isBlocked) {
      user.blockedAt = new Date()
      user.blockedReason = blockedReason || 'Account blocked by super-admin'
    } else {
      user.blockedAt = undefined
      user.blockedReason = undefined
    }

    await user.save()

    const userResponse = user.toObject() as { password?: string }
    delete userResponse.password

    res.json(userResponse)
  } catch (error) {
    console.error('Error updating admin user status:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get customers for a seller (customers who have purchased from this seller)
// Customers are defined as users who have at least one delivered order from this seller
export const getSellerCustomers = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { search, tab, page = '1', limit = '10' } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId)
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum

    // Step 1: Find all orders with delivered shipments from this seller
    // An order qualifies if it has a sellerShipment with:
    // - seller matching sellerId
    // - status = 'delivered'
    const deliveredOrders = await Order.aggregate([
      {
        $match: {
          'items.seller': sellerObjectId,
          sellerShipments: {
            $elemMatch: {
              seller: sellerObjectId,
              status: 'delivered',
            },
          },
        },
      },
      {
        $unwind: '$sellerShipments',
      },
      {
        $match: {
          'sellerShipments.seller': sellerObjectId,
          'sellerShipments.status': 'delivered',
        },
      },
      {
        $group: {
          _id: '$user',
          orders: {
            $push: {
              orderId: '$_id',
              orderNumber: '$orderNumber',
              deliveredAt: '$sellerShipments.deliveredAt',
              total: '$total',
              createdAt: '$createdAt',
            },
          },
        },
      },
    ])

    // Step 2: Get unique customer IDs and calculate stats
    const customerIds = deliveredOrders.map((item) => item._id)

    if (customerIds.length === 0) {
      return res.json({
        customers: [],
        pagination: {
          total: 0,
          page: pageNum,
          limit: limitNum,
          pages: 0,
        },
      })
    }

    // Step 3: Build customer stats map
    const customerStatsMap = new Map()
    deliveredOrders.forEach((item) => {
      const customerId = item._id.toString()
      const orders = item.orders || []

      const totalOrders = orders.length
      const totalSpent = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
      const deliveredDates = orders
        .map((o: any) => o.deliveredAt)
        .filter(Boolean)
        .map((d: any) => new Date(d))
      const lastOrderDate =
        deliveredDates.length > 0
          ? new Date(Math.max(...deliveredDates.map((d: Date) => d.getTime())))
          : null
      const firstOrderDate =
        deliveredDates.length > 0
          ? new Date(Math.min(...deliveredDates.map((d: Date) => d.getTime())))
          : null

      customerStatsMap.set(customerId, {
        totalOrders,
        totalSpent,
        lastOrderDate,
        firstOrderDate,
      })
    })

    // Step 4: Fetch customer details
    let customerFilter: any = {
      _id: { $in: customerIds },
      role: 'customer',
      isBlocked: { $ne: true },
    }

    // Apply search filter (only search by name for privacy)
    if (search) {
      customerFilter.name = { $regex: search, $options: 'i' }
    }

    let customers = await User.find(customerFilter).select('-password').lean()

    // Step 5: Enrich customers with stats (no address for privacy)
    const enrichedCustomers = customers.map((customer: any) => {
      const stats = customerStatsMap.get(customer._id.toString()) || {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderDate: null,
        firstOrderDate: null,
      }

      return {
        ...customer,
        totalOrders: stats.totalOrders,
        totalSpent: stats.totalSpent,
        lastOrderDate: stats.lastOrderDate,
        firstOrderDate: stats.firstOrderDate,
      }
    })

    // Step 6: Apply tab-based filtering and sorting
    let filteredCustomers = enrichedCustomers

    switch (tab) {
      case 'top':
        filteredCustomers = enrichedCustomers.filter((c: any) => c.totalSpent > 0)
        filteredCustomers.sort((a: any, b: any) => b.totalSpent - a.totalSpent)
        break
      case 'repeat':
        filteredCustomers = enrichedCustomers.filter((c: any) => c.totalOrders > 1)
        filteredCustomers.sort((a: any, b: any) => b.totalOrders - a.totalOrders)
        break
      case 'recent':
        // Recent: customers with lastOrderDate within last 30 days
        const recentThirtyDaysAgo = new Date()
        recentThirtyDaysAgo.setDate(recentThirtyDaysAgo.getDate() - 30)
        filteredCustomers = enrichedCustomers.filter(
          (c: any) => c.lastOrderDate && new Date(c.lastOrderDate) > recentThirtyDaysAgo,
        )
        filteredCustomers.sort((a: any, b: any) => {
          if (!a.lastOrderDate || !b.lastOrderDate) return 0
          return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
        })
        break
      case 'new':
        // New: customers who joined (account created) within last 30 days
        const newThirtyDaysAgo = new Date()
        newThirtyDaysAgo.setDate(newThirtyDaysAgo.getDate() - 30)
        filteredCustomers = enrichedCustomers.filter(
          (c: any) => c.createdAt && new Date(c.createdAt) > newThirtyDaysAgo,
        )
        filteredCustomers.sort((a: any, b: any) => {
          if (!a.createdAt || !b.createdAt) return 0
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        })
        break
      default:
        // 'all' case - sort by last order date (most recent first)
        filteredCustomers.sort((a: any, b: any) => {
          if (!a.lastOrderDate || !b.lastOrderDate) {
            if (!a.lastOrderDate && !b.lastOrderDate) return 0
            return a.lastOrderDate ? -1 : 1
          }
          return new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
        })
        break
    }

    // Step 7: Pagination
    const total = filteredCustomers.length
    const paginatedCustomers = filteredCustomers.slice(skip, skip + limitNum)

    // Format dates for response and mask sensitive data
    const formattedCustomers = paginatedCustomers.map((c: any) => {
      // Exclude sensitive fields and mask name
      const { email, phone, isEmailVerified, isPhoneVerified, ...rest } = c
      return {
        ...rest,
        name: maskName(c.name),
        lastOrderDate: c.lastOrderDate ? new Date(c.lastOrderDate).toISOString() : undefined,
        firstOrderDate: c.firstOrderDate ? new Date(c.firstOrderDate).toISOString() : undefined,
        createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
        updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : undefined,
      }
    })

    res.json({
      customers: formattedCustomers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    })
  } catch (error) {
    console.error('Error fetching seller customers:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get customer stats for seller
export const getSellerCustomerStats = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId)

    // Find all orders with delivered shipments from this seller
    const deliveredOrders = await Order.aggregate([
      {
        $match: {
          'items.seller': sellerObjectId,
          sellerShipments: {
            $elemMatch: {
              seller: sellerObjectId,
              status: 'delivered',
            },
          },
        },
      },
      {
        $unwind: '$sellerShipments',
      },
      {
        $match: {
          'sellerShipments.seller': sellerObjectId,
          'sellerShipments.status': 'delivered',
        },
      },
      {
        $group: {
          _id: '$user',
          orderCount: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          lastOrderDate: { $max: '$sellerShipments.deliveredAt' },
          firstOrderDate: { $min: '$sellerShipments.deliveredAt' },
        },
      },
    ])

    if (deliveredOrders.length === 0) {
      return res.json({
        totalCustomers: 0,
        repeatCustomers: 0,
        newThisMonth: 0,
        totalSpent: 0,
        avgOrderValue: 0,
        topCustomersCount: 0,
        recentOrdersCount: 0,
        repeatCustomerPercentage: 0,
      })
    }

    const customerIds = deliveredOrders.map((item) => item._id)

    // Verify customers are not blocked
    // Get valid customers with their createdAt dates
    const validCustomers = await User.find({
      _id: { $in: customerIds },
      role: 'customer',
      isBlocked: { $ne: true },
    })
      .select('_id createdAt')
      .lean()

    const validCustomerMap = new Map(validCustomers.map((c) => [c._id.toString(), c.createdAt]))
    const validOrders = deliveredOrders.filter((item) => validCustomerMap.has(item._id.toString()))

    // Calculate stats
    const totalCustomers = validOrders.length
    const repeatCustomers = validOrders.filter((item) => item.orderCount > 1).length

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // New this month: customers who joined (account created) within last 30 days
    const newThisMonth = validOrders.filter((item) => {
      const createdAt = validCustomerMap.get(item._id.toString())
      return createdAt && new Date(createdAt) > thirtyDaysAgo
    }).length

    const totalSpent = validOrders.reduce((sum, item) => sum + (item.totalSpent || 0), 0)
    const totalOrders = validOrders.reduce((sum, item) => sum + (item.orderCount || 0), 0)
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0

    // Additional stats
    // Top customers: customers with spending > 0 (sorted by spending in the main query, this is a count)
    // For the "Top" tab, we show all customers sorted by spending, so this equals total
    const topCustomersCount = validOrders.filter((item) => (item.totalSpent || 0) > 0).length

    // Recent orders: customers with lastOrderDate within last 30 days
    const recentOrdersCount = validOrders.filter((item) => {
      if (!item.lastOrderDate) return false
      return new Date(item.lastOrderDate) > thirtyDaysAgo
    }).length

    // Get top cities and states from delivered orders
    const locationAggregation = await Order.aggregate([
      {
        $match: {
          'items.seller': sellerObjectId,
          sellerShipments: {
            $elemMatch: {
              seller: sellerObjectId,
              status: 'delivered',
            },
          },
        },
      },
      {
        $group: {
          _id: {
            city: '$shippingAddress.city',
            state: '$shippingAddress.state',
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ])

    // Extract top cities and states
    const cityMap = new Map<string, number>()
    const stateMap = new Map<string, number>()

    locationAggregation.forEach((item) => {
      if (item._id.city) {
        cityMap.set(item._id.city, (cityMap.get(item._id.city) || 0) + item.count)
      }
      if (item._id.state) {
        stateMap.set(item._id.state, (stateMap.get(item._id.state) || 0) + item.count)
      }
    })

    const topCities = Array.from(cityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    const topStates = Array.from(stateMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    res.json({
      totalCustomers,
      repeatCustomers,
      newThisMonth,
      totalSpent,
      avgOrderValue,
      topCustomersCount,
      recentOrdersCount,
      repeatCustomerPercentage:
        totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0,
      topCities,
      topStates,
    })
  } catch (error) {
    console.error('Error fetching seller customer stats:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get a specific customer detail with order history for seller
export const getSellerCustomerDetail = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const { page = '1', limit = '10' } = req.query

    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId)
    const customerObjectId = new mongoose.Types.ObjectId(id)
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum

    // Verify customer exists and is not blocked
    const customer = await User.findOne({
      _id: customerObjectId,
      role: 'customer',
      isBlocked: { $ne: true },
    }).select('-password')

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Check if customer has any delivered orders from this seller
    const hasDeliveredOrders = await Order.findOne({
      user: customerObjectId,
      'items.seller': sellerObjectId,
      sellerShipments: {
        $elemMatch: {
          seller: sellerObjectId,
          status: 'delivered',
        },
      },
    })

    if (!hasDeliveredOrders) {
      return res.status(404).json({ error: 'Customer not found' })
    }

    // Get all delivered orders from this seller for this customer
    const deliveredOrders = await Order.find({
      user: customerObjectId,
      'items.seller': sellerObjectId,
      sellerShipments: {
        $elemMatch: {
          seller: sellerObjectId,
          status: 'delivered',
        },
      },
    })
      .populate('items.product', 'name slug mainImage')
      .populate('items.variant', 'name sku mainImage')
      .sort({ createdAt: -1 })
      .lean()

    // Calculate customer stats
    let totalOrders = 0
    let totalSpent = 0
    let lastOrderDate: Date | null = null
    let firstOrderDate: Date | null = null

    for (const order of deliveredOrders) {
      // Find the seller's shipment in this order
      const sellerShipment = (order as any).sellerShipments?.find(
        (shipment: any) =>
          shipment.seller?.toString() === sellerId && shipment.status === 'delivered',
      )

      if (sellerShipment && sellerShipment.deliveredAt) {
        totalOrders++
        totalSpent += (order as any).total || 0

        const deliveredAt = new Date(sellerShipment.deliveredAt)
        if (lastOrderDate === null || deliveredAt > lastOrderDate) {
          lastOrderDate = deliveredAt
        }
        if (firstOrderDate === null || deliveredAt < firstOrderDate) {
          firstOrderDate = deliveredAt
        }
      }
    }

    // Convert dates to ISO strings for response
    const lastOrderDateISO: string | null =
      lastOrderDate !== null && lastOrderDate instanceof Date ? lastOrderDate.toISOString() : null
    const firstOrderDateISO: string | null =
      firstOrderDate !== null && firstOrderDate instanceof Date
        ? firstOrderDate.toISOString()
        : null

    // Format order history (only show seller's items)
    const orderHistory = deliveredOrders.map((order: any) => {
      const sellerShipment = order.sellerShipments?.find(
        (shipment: any) =>
          shipment.seller?.toString() === sellerId && shipment.status === 'delivered',
      )

      // Filter items to only show seller's items
      const sellerItems =
        order.items?.filter((item: any) => item.seller?.toString() === sellerId) || []

      // Calculate seller's total from items
      const sellerTotal = sellerItems.reduce(
        (sum: number, item: any) =>
          sum + (item.effectivePrice || item.price || 0) * (item.quantity || 0),
        0,
      )

      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: sellerShipment?.status || 'delivered',
        total: sellerTotal,
        deliveredAt: sellerShipment?.deliveredAt,
        createdAt: order.createdAt,
        items: sellerItems.map((item: any) => ({
          _id: item._id,
          product: item.product,
          variant: item.variant,
          quantity: item.quantity,
          price: item.effectivePrice || item.price,
          subtotal: (item.effectivePrice || item.price) * (item.quantity || 0),
        })),
      }
    })

    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0

    // Apply pagination to order history
    const totalOrderHistory = orderHistory.length
    const paginatedOrderHistory = orderHistory.slice(skip, skip + limitNum)

    // Extract customer data and exclude sensitive fields
    const customerData = customer.toObject() as any
    const {
      email: _email,
      phone: _phone,
      isEmailVerified: _isEmailVerified,
      isPhoneVerified: _isPhoneVerified,
      password: _password,
      ...safeCustomerData
    } = customerData

    const customerResponse: any = {
      ...safeCustomerData,
      name: maskName(customerData.name),
      totalOrders,
      totalSpent,
      avgOrderValue,
      lastOrderDate: lastOrderDateISO,
      firstOrderDate: firstOrderDateISO,
      orderHistory: paginatedOrderHistory,
      orderHistoryPagination: {
        total: totalOrderHistory,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalOrderHistory / limitNum),
      },
    }

    res.json(customerResponse)
  } catch (error) {
    console.error('Error fetching seller customer detail:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Assign roles to user
export const assignRolesToUser = async (req: Request, res: Response) => {
  try {
    const { roleIds } = req.body
    const userId = req.params.id
    const assignedBy = req.user?.userId

    if (!Array.isArray(roleIds)) {
      return res.status(400).json({ error: 'roleIds must be an array' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Verify all roles exist
    const roles = await Role.find({ _id: { $in: roleIds } })
    if (roles.length !== roleIds.length) {
      return res.status(400).json({ error: 'One or more roles not found' })
    }

    // Remove existing role assignments
    await UserRole.deleteMany({ userId })

    // Create new role assignments
    const userRoles = roleIds.map((roleId: string) => ({
      userId,
      roleId,
      assignedBy,
      assignedAt: new Date(),
    }))

    await UserRole.insertMany(userRoles)

    // Get updated roles
    const updatedUserRoles = await UserRole.find({ userId }).populate('roleId', 'name description')
    const rolesData = updatedUserRoles.map((ur) => ({
      _id: (ur.roleId as any)?._id,
      name: (ur.roleId as any)?.name,
      description: (ur.roleId as any)?.description,
      assignedAt: ur.assignedAt,
    }))

    res.json({
      message: 'Roles assigned successfully',
      roles: rolesData,
    })
  } catch (error) {
    console.error('Error assigning roles:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get user roles
export const getUserRoles = async (req: Request, res: Response) => {
  try {
    const userId = req.params.id
    const userRoles = await UserRole.find({ userId }).populate('roleId')
    const roles = userRoles.map((ur) => ur.roleId)
    res.json(roles)
  } catch (error) {
    console.error('Error fetching user roles:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get current user's permissions
export const getCurrentUserPermissions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { getUserPermissions } = await import('../utils/permissions')
    const permissions = await getUserPermissions(userId)
    res.json(permissions)
  } catch (error) {
    console.error('Error fetching user permissions:', error)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get users with specific module permission
export const getUsersWithModulePermission = async (req: Request, res: Response) => {
  try {
    const { module, permission } = req.query as {
      module?: string
      permission?: string
    }

    if (!module || !permission) {
      return res.status(400).json({
        error: 'Module and permission query parameters are required',
      })
    }

    const { getUsersWithPermission } = await import('../utils/permissions')
    const users = await getUsersWithPermission(module as any, permission as any)

    res.json(users)
  } catch (error) {
    console.error('Error fetching users with permission:', error)
    res.status(500).json({ error: 'Server error' })
  }
}
