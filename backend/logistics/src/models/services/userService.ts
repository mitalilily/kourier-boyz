import { db } from '../client'
import { platforms } from '../schema/platform'
import { users } from '../schema/users'
// utils/verifyGoogleToken.ts
import * as bcrypt from 'bcryptjs'
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { OAuth2Client } from 'google-auth-library'

import * as schema from '../../schema/schema'
import { CompanyInfo } from '../../types/profileBlocks.types'
import { IUser } from '../../types/users.types'
import { OTP_EXPIRY } from '../../utils/constants'
import { sendTempPasswordEmail, sendVerificationEmail } from '../../utils/emailSender'
import { generate8DigitsVerificationToken } from '../../utils/functions'
import { stores } from '../schema/stores'
import { ensurePlanSplitSetup, listUserPlanAssignments } from './plan.service'

import * as dotenv from 'dotenv'
import path from 'path'

// Load correct .env based on NODE_ENV
const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

// Define User and NewUser types for convenience
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// Typed User rows
// A connection can be either the global DB or a scoped PgTransaction
export type Tx = NodePgDatabase<typeof schema> // global pool client

type UserUpdate = Partial<Omit<User, 'id'>> // We typically don't allow changing id or phone

const EMPTY_COMPANY: CompanyInfo = {
  businessName: '',
  brandName: '',
  city: '',
  companyContactNumber: '',
  pincode: '',
  state: '',
  profilePicture: '',
  POCEmailVerified: false,
  POCPhoneVerified: false,
  companyAddress: '',
  contactPerson: '',
  contactNumber: '',
  contactEmail: '',
  companyEmail: '',
  companyLogoUrl: '',
  website: '',
}

const DEFAULT_PROFILE: Omit<typeof schema.userProfiles.$inferInsert, 'userId' | 'id'> = {
  onboardingStep: 0,
  monthlyOrderCount: '0-100',
  companyInfo: EMPTY_COMPANY,
  domesticKyc: { status: 'pending', updatedAt: null },
  bankDetails: null,
  gstDetails: null,
  businessType: [], // b2b / b2c / d2c chosen later
  approved: false,
  onboardingComplete: false,
  salesChannels: {},
  profileComplete: false,
}
// ✅ Get user by phone

export const findUserByPhone = async (phone: string) => {
  try {
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.phone, phone),
    })

    return user
  } catch (error) {
    console.error('Database query error:', error)
    return null
  }
}
export const findUserById = async (id: string) => {
  const result = await db
    .select({
      user: users,
      profile: schema.userProfiles,
    })
    .from(users)
    .leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, users.id))
    .where(eq(users.id, id))
    .limit(1)

  if (!result[0]) return null

  const planAssignments = await listUserPlanAssignments(id)
  const currentB2CPlan = planAssignments.find((assignment) => assignment.business_type === 'b2c')
  const currentB2BPlan = planAssignments.find((assignment) => assignment.business_type === 'b2b')

  // Merge `users`, `userProfile`, and current plan
  return {
    ...result[0].profile,
    // Both rows have an `id`; authentication must always use the users.id value.
    ...result[0].user,
    currentPlanId: currentB2CPlan?.plan_id || null,
    currentPlanName: currentB2CPlan?.planName || null,
    currentB2CPlanId: currentB2CPlan?.plan_id || null,
    currentB2CPlanName: currentB2CPlan?.planName || null,
    currentB2BPlanId: currentB2BPlan?.plan_id || null,
    currentB2BPlanName: currentB2BPlan?.planName || null,
  }
}

export const findUserByEmail = async (email: string, tx: Tx = db) => {
  return await tx.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, email),
  })
}

export const createUser = async (data: NewUser, tx: Tx = db) => {
  const [user] = await tx.insert(users).values(data).returning()
  return user
}

export const updateUserByEmail = async (email: string, updateData: Partial<User>, tx: Tx = db) => {
  const [updatedUser] = await tx
    .update(users)
    .set(updateData)
    .where(eq(users.email, email))
    .returning()
  return updatedUser
}

export const updateUserVerificationToken = async (
  email: string,
  token: string | null,
  expiresAt: Date | null,
  tx: Tx = db,
) => {
  const [updatedUser] = await tx
    .update(users)
    .set({
      emailVerificationToken: token,
      emailVerificationTokenExpiresAt: expiresAt,
    })
    .where(eq(users.email, email))
    .returning()
  return updatedUser
}
// ✅ Update user by phone
export const updateUser = async (userId: string, data: UserUpdate) => {
  const [user] = await db.update(users).set(data).where(eq(users.id, userId)).returning()

  return user
}

// updateUserOtp.ts
export const updateUserOtp = async (phone: string, otp: string, otpExpiresAt: Date) => {
  return await db.update(users).set({ otp, otpExpiresAt }).where(eq(users.phone, phone))
}

// updateUserOtpByEmail.ts - for email-based OTP
export const updateUserOtpByEmail = async (email: string, otp: string, otpExpiresAt: Date) => {
  const normalized = email.trim().toLowerCase()
  return await db.update(users).set({ otp, otpExpiresAt }).where(eq(users.email, normalized))
}

/**
 * Mark a user's e‑mail as verified in both `users` and `user_profiles`.
 */
export const markEmailVerified = async (email: string, tx: any = db) => {
  const normalized = email.trim().toLowerCase()

  return tx.transaction(async (tx: any) => {
    /* 1️⃣  Update `users.emailVerified` and grab the userId */
    const [updatedUser] = await tx
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.email, normalized))
      .returning({ id: users.id })

    if (!updatedUser) {
      console.log('No user found for email:', normalized)
      return { usersUpdated: 0, profilesUpdated: 0 }
    }

    /* 2️⃣  Set POCEmailVerified = true inside companyInfo JSONB */
    const result = await tx
      .update(schema.userProfiles)
      .set({
        companyInfo: sql`
          jsonb_set(
            "companyInfo",
            '{POCEmailVerified}',
            'true',
            true
          )
        `,
      })
      .where(eq(schema.userProfiles.userId, updatedUser.id))

    return { usersUpdated: 1, profilesUpdated: result.rowCount }
  })
}

export const markPhoneVerified = async (phone: string) => {
  // strip non‑digits so we always compare the raw 10‑digit number
  const sanitized = phone.replace(/\D/g, '')

  return db.transaction(async (tx) => {
    /* 1️⃣  Update `users.phoneVerified` and grab the userId */
    const [updatedUser] = await tx
      .update(users)
      .set({ phoneVerified: true })
      .where(eq(users.phone, sanitized))
      .returning({ id: users.id })

    if (!updatedUser) {
      console.log('No user found for phone:', sanitized)
      return { usersUpdated: 0, profilesUpdated: 0 }
    }

    /* 2️⃣  Update nested JSONB key in `user_profiles` */
    const result = await tx
      .update(schema.userProfiles)
      .set({
        companyInfo: sql`
          jsonb_set(
            "companyInfo",
            '{POCPhoneVerified}',
            'true',
            true
          )
        `,
      })
      .where(eq(schema.userProfiles.userId, updatedUser.id))

    return { usersUpdated: 1, profilesUpdated: result.rowCount }
  })
}
// clearUserOtp.ts
export const clearUserOtp = async (phone: string) => {
  return await db.update(users).set({ otp: null, otpExpiresAt: null }).where(eq(users.phone, phone))
}

// clearUserOtpByEmail.ts - for email-based OTP
export const clearUserOtpByEmail = async (email: string) => {
  const normalized = email.trim().toLowerCase()
  return await db
    .update(users)
    .set({ otp: null, otpExpiresAt: null })
    .where(eq(users.email, normalized))
}

export const clearUserEmailToken = async (email: string) => {
  await db
    .update(users)
    .set({
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
    })
    .where(eq(users.email, email))
}

export const updateUserChannelIntegration = async (
  userId: string,
  platformId: number,
  tx: any = db,
) => {
  /* 1️⃣  Look up the platform slug */
  const [platform] = await tx
    .select({ slug: platforms.slug })
    .from(platforms)
    .where(eq(platforms.id, platformId))

  if (!platform?.slug) {
    throw new Error('Invalid platformId: slug not found')
  }

  /* 2️⃣  Add slug → true inside salesChannels JSONB */
  return tx
    .update(schema.userProfiles)
    .set({
      salesChannels: sql`
        jsonb_set(
          coalesce(${schema.userProfiles.salesChannels}, '{}'::jsonb),
          '{${sql.raw(platform.slug)}}',
          'true'::jsonb,
          true
        )
      `,
    })
    .where(eq(schema.userProfiles.userId, userId)) // 🔑 correct column
    .returning()
}

export const ensurePlatformRegistration = async (
  platform: { id: number; name: string; slug: string },
  tx: any = db,
) => {
  await tx.execute(sql`
    INSERT INTO platforms (id, name, slug)
    VALUES (${platform.id}, ${platform.name}, ${platform.slug})
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        slug = EXCLUDED.slug
  `)
}

export const setUserChannelIntegration = async (
  userId: string,
  platformId: number,
  enabled: boolean,
  tx: any = db,
) => {
  const [platform] = await tx
    .select({ slug: platforms.slug })
    .from(platforms)
    .where(eq(platforms.id, platformId))

  if (!platform?.slug) {
    throw new Error('Invalid platformId: slug not found')
  }

  const jsonPath = `{${platform.slug}}`
  const jsonValue = enabled ? 'true' : 'false'

  return tx
    .update(schema.userProfiles)
    .set({
      salesChannels: sql`
        jsonb_set(
          coalesce(${schema.userProfiles.salesChannels}, '{}'::jsonb),
          ${jsonPath}::text[],
          ${jsonValue}::jsonb,
          true
        )
      `,
    })
    .where(eq(schema.userProfiles.userId, userId))
    .returning()
}

export async function upsertStore(shopData: any, platformId: number, userId: string, tx: any = db) {
  const { id, name, domain, timezone, country, currency, email, phone, zip, ...rest } = shopData

  const metadata = {
    email,
    phone,
    zip,
    ...rest,
  }

  const existing = await tx.select().from(stores).where(eq(stores.id, id)).limit(1)

  if (existing.length > 0) {
    await tx
      .update(stores)
      .set({
        name,
        domain,
        timezone,
        country,
        currency,
        apiKey: shopData.apiKey,
        adminApiAccessToken: shopData.adminApiAccessToken,
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(stores.id, id))
  } else {
    await tx.insert(stores).values({
      id,
      name,
      userId,
      domain,
      platformId,
      apiKey: shopData.apiKey,
      adminApiAccessToken: shopData.adminApiAccessToken,
      timezone,
      country,
      currency,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
}

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export const verifyGoogleToken = async (idToken: string) => {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()
  if (!payload || !payload.email) {
    throw new Error('Invalid Google token')
  }

  return {
    email: payload.email,
    googleId: payload.sub,
    name: payload.name,
    picture: payload.picture,
  }
}

/**
 * Unified entry‑point for both sign‑up and sign‑in.
 *
 * Behaviour matrix – all the corner‑cases in one place:
 * ┌─────────────────────────┬──────────────┬──────────┬───────────────┐
 * │ Email in DB?            │ Verified?    │ googleId │ Result        │
 * ├─────────────────────────┼──────────────┼──────────┼───────────────┤
 * │ no                      │ n/a          │ yes      │ create account│
 * │ no                      │ n/a          │ no       │ create + email│
 * │ yes                     │ NO           │ yes      │ mark verified │
 * │ yes                     │ NO           │ no       │ refresh token │
 * │ yes                     │ YES          │ yes      │ login / link  │
 * │ yes                     │ YES          │ no       │ login / set-pw│
 * └─────────────────────────┴──────────────┴──────────┴───────────────┘
 */

export const handleEmailVerificationRequest = async (
  email: string,
  password: string | null,
  googleId: string | null,
): Promise<{ status: number; data: any }> => {
  return await db.transaction(async (tx) => {
    const normalizedEmail = email.trim().toLowerCase()
    const token = generate8DigitsVerificationToken()
    const expiresAt = new Date(Date.now() + OTP_EXPIRY)
    let shouldSendEmail = false

    const user = await findUserByEmail(normalizedEmail, tx)

    if (user) {
      if (user.emailVerified) {
        if (googleId) {
          if (user.googleId && user.googleId !== googleId) {
            return {
              status: 400,
              data: {
                error: 'A different Google account is linked to this email.',
              },
            }
          }
          if (!user.googleId) {
            await updateUserByEmail(normalizedEmail, { googleId }, tx)
          }
          return {
            status: 200,
            data: { message: 'Authenticated with Google', user },
          }
        }

        if (!password) {
          return { status: 400, data: { error: 'Password is required.' } }
        }

        if (!user.passwordHash) {
          const hashed = await bcrypt.hash(password, 10)
          await updateUserByEmail(normalizedEmail, { passwordHash: hashed }, tx)
          return {
            status: 200,
            data: {
              message: 'Password set successfully. You can now log in.',
              user,
            },
          }
        }

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) {
          return { status: 400, data: { error: 'Incorrect password.' } }
        }

        return {
          status: 200,
          data: { message: '', user },
        }
      }

      // Email exists but NOT verified
      if (googleId) {
        await updateUserByEmail(
          normalizedEmail,
          {
            googleId,
            emailVerified: true,
            emailVerificationToken: null,
            emailVerificationTokenExpiresAt: null,
          },
          tx,
        )
        return {
          status: 200,
          data: { message: 'Email verified via Google Sign‑In', user },
        }
      }

      if (!password) {
        return { status: 400, data: { error: 'Password is required.' } }
      }

      if (!user.passwordHash) {
        const hashed = await bcrypt.hash(password, 10)
        await updateUserByEmail(normalizedEmail, { passwordHash: hashed }, tx)
      } else {
        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) {
          return { status: 400, data: { error: 'Incorrect password.' } }
        }
      }

      await updateUserVerificationToken(normalizedEmail, token, expiresAt, tx)
      shouldSendEmail = true

      if (shouldSendEmail) {
        sendVerificationEmail(normalizedEmail, token).catch(console.error)
      }

      return { status: 200, data: { message: 'Verification email sent' } }
    }

    // BRAND NEW USER

    if (googleId) {
      await createUserWithWallet({
        email: normalizedEmail,
        phone: '',
        passwordHash: password ? await bcrypt.hash(password, 10) : null,
        googleId,
        emailVerified: true,
        onboardingStep: 0,
      })
      return { status: 201, data: { message: 'Account created via Google' } }
    }

    if (!password) {
      return { status: 400, data: { error: 'Password is required.' } }
    }

    await createUserWithWallet({
      email: normalizedEmail,
      phone: '',
      passwordHash: await bcrypt.hash(password, 10),
      googleId: null,
      emailVerificationToken: token,
      emailVerificationTokenExpiresAt: expiresAt,
      emailVerified: false,
      onboardingStep: 0,
    })

    shouldSendEmail = true

    if (shouldSendEmail) {
      sendVerificationEmail(normalizedEmail, token).catch(console.error)
    }

    return { status: 201, data: { message: 'Verification email sent' } }
  })
}

const getRefreshTokenReuseGraceMs = () => {
  const parsed = Number(process.env.REFRESH_TOKEN_REUSE_GRACE_MS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2 * 60 * 1000
}

export const saveRefreshToken = async (
  userId: string,
  token: string | null,
  ttlMs: number,
  previousToken: string | null = null,
  previousTtlMs = getRefreshTokenReuseGraceMs(),
) => {
  const isClearing = token === null
  const expiresAt = isClearing ? sql`NULL` : new Date(Date.now() + ttlMs)
  const previousExpiresAt = previousToken ? new Date(Date.now() + previousTtlMs) : sql`NULL`

  return db
    .update(users)
    .set({
      refreshToken: isClearing ? sql`NULL` : token,
      refreshTokenExpiresAt: expiresAt,
      previousRefreshToken: isClearing ? sql`NULL` : previousToken,
      previousRefreshTokenExpiresAt: previousToken ? previousExpiresAt : sql`NULL`,
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id })
}

export const clampPreviousRefreshTokenExpiry = async (
  userId: string,
  ttlMs = getRefreshTokenReuseGraceMs(),
) => {
  return db
    .update(users)
    .set({
      previousRefreshTokenExpiresAt: new Date(Date.now() + ttlMs),
    })
    .where(eq(users.id, userId))
    .returning({ id: users.id })
}

export async function createUserWithWallet(data: Partial<IUser>, txn: any = db) {
  return txn?.transaction(async (tx: any) => {
    await ensurePlanSplitSetup()

    // 1) insert user
    const [user] = await tx
      .insert(users)
      .values(data as IUser)
      .returning()

    // 2) insert wallet
    await tx.insert(schema.wallets).values({
      userId: user.id,
      balance: sql`0`, // numeric requires string or SQL literal
    })

    // 3) assign default plan (Basic)
    const basicPlans = await tx.select().from(schema.plans).where(eq(schema.plans.name, 'Basic'))
    const basicPlan = basicPlans.find((plan: any) => plan.business_type === 'b2c')
    const basicB2BPlan = basicPlans.find((plan: any) => plan.business_type === 'b2b')

    if (basicPlan) {
      await tx.insert(schema.userPlans).values({
        userId: user.id,
        plan_id: basicPlan.id,
        business_type: 'b2c',
        is_active: true,
      })
    } else {
      console.warn(`⚠️ Basic plan not found for user ${user.id}. Plan assignment skipped.`)
    }

    if (basicB2BPlan) {
      await tx.insert(schema.userPlans).values({
        userId: user.id,
        plan_id: basicB2BPlan.id,
        business_type: 'b2b',
        is_active: true,
      })
    } else {
      console.warn(`Basic B2B plan not found for user ${user.id}.`)
    }

    // 4) create default billing preferences
    await tx.insert(schema.billingPreferences).values({
      userId: user.id,
      frequency: 'monthly',
      autoGenerate: true,
      customFrequencyDays: null,
    })

    // 5) create default label preferences
    await tx.insert(schema.labelPreferences).values({
      user_id: user.id,
      printer_type: 'thermal',
      char_limit: 30,
      max_items: 4,
      powered_by: 'Kourier Boyz',
      order_info: {
        alternatePhone: false,
        billingGstin: false,
        ewayBillNumber: false,
      },
      shipper_info: {
        brandLogo: true,
        shipperName: true,
        shipperAddress: true,
        shipperPhone: true,
        gstin: true,
        returnPhone: true,
      },
      product_info: {
        productCost: true,
      },
      brand_logo: null,
    })

    // 6) create default invoice preferences
    await tx.insert(schema.invoicePreferences).values({
      userId: user.id,
      prefix: 'INV',
      suffix: '',
      template: 'classic',
      includeLogo: true,
      includeSignature: true,
      logoFile: null,
      signatureFile: null,
    })

    const companyInfo = {
      ...DEFAULT_PROFILE.companyInfo, // keeps required fields
      contactEmail: data.email ?? '',
      contactNumber: data.phone ?? '',
      profilePicture: data?.profilePicture,
    }

    await tx.insert(schema.userProfiles).values({
      ...DEFAULT_PROFILE, // << first spread defaults
      userId: user.id,
      companyInfo, // << then override / extend
    })

    return user
  })
}

/**
 * Idempotently create the records every merchant account needs after authentication.
 * Older OTP-created accounts may contain only a users row, so this also acts as a
 * safe lazy repair when those merchants sign in again.
 */
export async function ensureUserBootstrapResources(userId: string) {
  await ensurePlanSplitSetup()

  return db.transaction(async (tx: any) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1)
    if (!user) throw new Error('User not found while provisioning account resources')

    const [wallet] = await tx
      .select({ id: schema.wallets.id })
      .from(schema.wallets)
      .where(eq(schema.wallets.userId, userId))
      .limit(1)
    if (!wallet) {
      await tx.insert(schema.wallets).values({ userId, balance: sql`0` })
    }

    const basicPlans = await tx.select().from(schema.plans).where(eq(schema.plans.name, 'Basic'))
    for (const businessType of ['b2c', 'b2b'] as const) {
      const plan = basicPlans.find((candidate: any) => candidate.business_type === businessType)
      if (plan) {
        await tx
          .insert(schema.userPlans)
          .values({
            userId,
            plan_id: plan.id,
            business_type: businessType,
            is_active: true,
          })
          .onConflictDoNothing()
      }
    }

    const [billingPreference] = await tx
      .select({ id: schema.billingPreferences.id })
      .from(schema.billingPreferences)
      .where(eq(schema.billingPreferences.userId, userId))
      .limit(1)
    if (!billingPreference) {
      await tx.insert(schema.billingPreferences).values({
        userId,
        frequency: 'monthly',
        autoGenerate: true,
        customFrequencyDays: null,
      })
    }

    const [labelPreference] = await tx
      .select({ id: schema.labelPreferences.id })
      .from(schema.labelPreferences)
      .where(eq(schema.labelPreferences.user_id, userId))
      .limit(1)
    if (!labelPreference) {
      await tx.insert(schema.labelPreferences).values({
        user_id: userId,
        printer_type: 'thermal',
        char_limit: 30,
        max_items: 4,
        powered_by: 'Kourier Boyz',
        order_info: {
          alternatePhone: false,
          billingGstin: false,
          ewayBillNumber: false,
        },
        shipper_info: {
          brandLogo: true,
          shipperName: true,
          shipperAddress: true,
          shipperPhone: true,
          gstin: true,
          returnPhone: true,
        },
        product_info: { productCost: true },
        brand_logo: null,
      })
    }

    const [invoicePreference] = await tx
      .select({ id: schema.invoicePreferences.id })
      .from(schema.invoicePreferences)
      .where(eq(schema.invoicePreferences.userId, userId))
      .limit(1)
    if (!invoicePreference) {
      await tx.insert(schema.invoicePreferences).values({
        userId,
        prefix: 'INV',
        suffix: '',
        template: 'classic',
        includeLogo: true,
        includeSignature: true,
        logoFile: null,
        signatureFile: null,
      })
    }

    const [profile] = await tx
      .select({ id: schema.userProfiles.id })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, userId))
      .limit(1)
    if (!profile) {
      await tx.insert(schema.userProfiles).values({
        ...DEFAULT_PROFILE,
        userId,
        companyInfo: {
          ...DEFAULT_PROFILE.companyInfo,
          contactEmail: user.email ?? '',
          contactNumber: user.phone ?? '',
          profilePicture: user.profilePicture,
        },
      })
    }

    return user
  })
}

type GetUsersParams = {
  page: number
  perPage: number
  search?: string
  sortBy?: 'createdAt' | 'email' | 'role' | 'companyName' | 'contactPerson'
  sortOrder?: 'asc' | 'desc'
  businessTypes?: string[]
  approved?: boolean | string
  onboardingComplete?: boolean | string
  kycStatus?: string | string[]
}

const normalizeOptionalBoolean = (value: boolean | string | undefined) => {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'true') return true
    if (value === 'false') return false
  }
  return undefined
}

export async function getAllUsersWithRoleUser({
  page,
  perPage,
  search = '',
  sortBy = 'createdAt',
  sortOrder = 'desc',
  businessTypes = [],
  onboardingComplete,
  approved,
  kycStatus,
}: GetUsersParams) {
  const offset = (page - 1) * perPage
  const filters: any[] = [eq(users.role, 'customer')]
  const normalizedOnboardingComplete = normalizeOptionalBoolean(onboardingComplete)
  const normalizedApproved = normalizeOptionalBoolean(approved)
  const kycStatusExpr = sql<string>`coalesce(${schema.kyc.status}::text, ${schema.userProfiles.domesticKyc} ->> 'status', 'pending')`
  const kycStatuses = Array.isArray(kycStatus)
    ? kycStatus.filter(Boolean)
    : kycStatus
      ? [kycStatus]
      : []

  // Search filter across multiple fields (null-safe with coalesce)
  if (search.trim()) {
    const pattern = `%${search.trim()}%`
    filters.push(
      or(
        ilike(sql`coalesce(${schema.userProfiles.companyInfo} ->> 'brandName', '')`, pattern), // Brand name
        ilike(sql`coalesce(${schema.userProfiles.companyInfo} ->> 'contactPerson', '')`, pattern),
        ilike(sql`coalesce(${schema.userProfiles.companyInfo} ->> 'contactEmail', '')`, pattern),
        ilike(sql`coalesce(${schema.userProfiles.companyInfo} ->> 'contactNumber', '')`, pattern),
        ilike(sql`coalesce(${schema.userProfiles.companyInfo} ->> 'businessName', '')`, pattern),
      ),
    )
  }

  // Business type filter
  if (businessTypes.length > 0) {
    filters.push(
      sql`EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(${schema.userProfiles.businessType}) AS bt
      WHERE bt = ANY(ARRAY[${sql.join(
        businessTypes.map((b) => sql`${b}`),
        sql`,`,
      )}]::text[])
    )`,
    )
  }

  // Onboarding complete filter (example: step 4 is complete)
  if (normalizedOnboardingComplete !== undefined) {
    filters.push(eq(schema.userProfiles.onboardingComplete, normalizedOnboardingComplete))
  }

  if (normalizedApproved !== undefined) {
    filters.push(eq(schema.userProfiles.approved, normalizedApproved))
  }

  if (kycStatuses.length > 0) {
    filters.push(
      sql`${kycStatusExpr} = ANY(ARRAY[${sql.join(
        kycStatuses.map((status) => sql`${status}`),
        sql`,`,
      )}]::text[])`,
    )
  }

  // Sort mapping
  const sortColumns: Record<string, any> = {
    createdAt: users.createdAt,
    email: users.email,
    role: users.role,
    companyName: sql`coalesce(${schema.userProfiles.companyInfo} ->> 'businessName', ${schema.userProfiles.companyInfo} ->> 'brandName', '')`,
    contactPerson: sql`${schema.userProfiles.companyInfo} ->> 'contactPerson'`,
  }
  const sortColumn = sortColumns[sortBy] ?? users.createdAt

  // Query data
  const data = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      companyName: sql<string>`coalesce(${schema.userProfiles.companyInfo} ->> 'businessName', ${schema.userProfiles.companyInfo} ->> 'brandName', '')`,
      businessType: schema.userProfiles.businessType,
      approved: schema.userProfiles.approved,
      onboardingComplete: schema.userProfiles.onboardingComplete,
      onboardingStep: schema.userProfiles.onboardingStep,
      contactPerson: sql<string>`${schema.userProfiles.companyInfo} ->> 'contactPerson'`,
      contactNumber: sql<string>`${schema.userProfiles.companyInfo} ->> 'contactNumber'`,
      profilePicture: sql<string>`${schema.userProfiles.companyInfo} ->> 'profilePicture'`,
      domesticKyc: schema.userProfiles.domesticKyc,
      kycStatus: kycStatusExpr,
      kycUpdatedAt: schema.kyc.updatedAt,
      kycStructure: schema.kyc.structure,
      kycCompanyType: schema.kyc.companyType,
      panNumber: schema.kyc.panNumber,
      gstin: schema.kyc.gstin,
      cin: schema.kyc.cin,
      panCardUrl: schema.kyc.panCardUrl,
      aadhaarUrl: schema.kyc.aadhaarUrl,
      cancelledChequeUrl: schema.kyc.cancelledChequeUrl,
      partnershipDeedUrl: schema.kyc.partnershipDeedUrl,
      boardResolutionUrl: schema.kyc.boardResolutionUrl,
      llpAgreementUrl: schema.kyc.llpAgreementUrl,
      businessPanUrl: schema.kyc.businessPanUrl,
      companyAddressProofUrl: schema.kyc.companyAddressProofUrl,
      gstCertificateUrl: schema.kyc.gstCertificateUrl,
    })
    .from(users)
    .leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, users.id))
    .leftJoin(schema.kyc, eq(schema.kyc.userId, users.id))
    .where(and(...filters))
    .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
    .limit(perPage)
    .offset(offset)

  // Count total
  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .leftJoin(schema.userProfiles, eq(schema.userProfiles.userId, users.id))
    .leftJoin(schema.kyc, eq(schema.kyc.userId, users.id))
    .where(and(...filters))

  return {
    data,
    totalCount: Number(totalCountResult[0]?.count || 0),
  }
}

export const updateUserApprovalStatus = async (userId: string, approved: boolean) => {
  const [updated] = await db
    .update(schema.userProfiles)
    .set({ approved })
    .where(eq(schema.userProfiles.userId, userId))
    .returning()

  return updated
}

function generateTempPassword(length = 12) {
  // Simpler, more user‑friendly temporary password:
  // - Alphanumeric only (no symbols)
  // - Avoid visually confusing characters (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export const resetUserPassword = async (userId: string) => {
  const tempPassword = generateTempPassword()
  const hashedPassword = await bcrypt.hash(tempPassword, 10)

  await db.update(users).set({ passwordHash: hashedPassword }).where(eq(users.id, userId))

  const [user] = await db.select().from(users).where(eq(users.id, userId))

  if (user?.email) {
    await sendTempPasswordEmail(user.email, tempPassword)
  }

  return tempPassword
}

export const deleteUser = async (userId: string) => {
  // Delete user and all related data in a transaction
  await db.transaction(async (tx) => {
    // Delete related data first (to avoid foreign key constraints)

    // Delete user profile
    await tx.delete(schema.userProfiles).where(eq(schema.userProfiles.userId, userId))

    // Delete user wallet
    await tx.delete(schema.wallets).where(eq(schema.wallets.userId, userId))

    // Delete pickup addresses (if any)
    const userAddresses = await tx
      .select({ id: schema.addresses.id })
      .from(schema.addresses)
      .where(eq(schema.addresses.userId, userId))

    for (const address of userAddresses) {
      await tx
        .delete(schema.pickupAddresses)
        .where(eq(schema.pickupAddresses.addressId, address.id))
    }

    // Delete addresses
    await tx.delete(schema.addresses).where(eq(schema.addresses.userId, userId))

    // Delete bank accounts
    await tx.delete(schema.bankAccounts).where(eq(schema.bankAccounts.userId, userId))

    // Delete KYC data
    await tx.delete(schema.kyc).where(eq(schema.kyc.userId, userId))

    // Finally, delete the user
    await tx.delete(users).where(eq(users.id, userId))
  })

  console.log(`✅ User ${userId} and all related data deleted successfully`)
}
