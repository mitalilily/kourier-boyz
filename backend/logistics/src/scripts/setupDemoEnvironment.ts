import * as dotenv from 'dotenv'
import path from 'path'
import bcryptjs from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { db } from '../models/client'
import { billingInvoices } from '../models/schema/billingInvoices'
import { invoiceSequences } from '../models/schema/invoiceSequences'
import { plans } from '../models/schema/plans'
import { userProfiles } from '../models/schema/userProfile'
import { users } from '../models/schema/users'
import { createUserWithWallet, findUserByEmail } from '../models/services/userService'
import { ensurePlanSplitSetup } from '../models/services/plan.service'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

const ADMIN_EMAIL = 'admin@kourier-boyz.local'
const LEGACY_ADMIN_EMAIL = 'admin@kourier-boyz.local'
const ADMIN_PASSWORD = 'KourierBoyz2026!'
const MERCHANT_EMAIL = 'merchant@kourier-boyz.local'
const MERCHANT_PHONE = '+919876543210'

type UserProfileInsert = typeof userProfiles.$inferInsert

const ensureBasicPlan = async (businessType: 'b2b' | 'b2c', description: string) => {
  const [existing] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.name, 'Basic'), eq(plans.business_type, businessType)))
    .limit(1)

  if (existing) return existing

  const [created] = await db
    .insert(plans)
    .values({
      name: 'Basic',
      description,
      business_type: businessType,
      is_active: true,
    })
    .returning()

  return created
}

const ensureAdminUser = async () => {
  const passwordHash = await bcryptjs.hash(ADMIN_PASSWORD, 10)
  const existing = (await findUserByEmail(ADMIN_EMAIL)) || (await findUserByEmail(LEGACY_ADMIN_EMAIL))

  const adminProfile: UserProfileInsert = {
    userId: '',
    onboardingStep: 0,
    monthlyOrderCount: '0-100',
    salesChannels: {},
    companyInfo: {
      businessName: 'Kourier Boyz Admin',
      brandName: 'Kourier Boyz',
      city: 'New Delhi',
      companyContactNumber: '+919876543210',
      pincode: '110001',
      state: 'Delhi',
      profilePicture: '',
      POCEmailVerified: true,
      POCPhoneVerified: true,
      companyAddress: 'Admin Demo Address',
      contactPerson: 'Kourier Boyz Admin',
      contactNumber: '+919876543210',
      contactEmail: ADMIN_EMAIL,
      companyEmail: ADMIN_EMAIL,
      companyLogoUrl: '',
      website: 'https://admin.local',
    },
    domesticKyc: { status: 'verified', updatedAt: new Date() },
    bankDetails: null,
    gstDetails: null,
    businessType: ['b2c'],
    approved: true,
    onboardingComplete: true,
    profileComplete: true,
    approvedAt: new Date(),
  }

  if (existing) {
    await db
      .update(users)
      .set({
        email: ADMIN_EMAIL,
        passwordHash,
        role: 'admin',
        emailVerified: true,
        phoneVerified: true,
        accountVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))

    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, existing.id),
    })

    if (!existingProfile) {
      await db.insert(userProfiles).values({
        ...adminProfile,
        userId: existing.id,
      })
    }

    return existing.id
  }

  const [created] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      emailVerified: true,
      phoneVerified: true,
      accountVerified: true,
    })
    .returning()

  await db.insert(userProfiles).values({
    ...adminProfile,
    userId: created.id,
  })

  return created.id
}

const ensureMerchantUser = async () => {
  const existing = await findUserByEmail(MERCHANT_EMAIL)
  const merchantProfilePatch = {
    onboardingStep: 0,
    companyInfo: {
      businessName: 'Demo Merchant Store',
      brandName: 'Demo Merchant',
      city: 'Mumbai',
      companyContactNumber: MERCHANT_PHONE,
      pincode: '400001',
      state: 'Maharashtra',
      profilePicture: '',
      POCEmailVerified: true,
      POCPhoneVerified: true,
      companyAddress: 'Merchant Demo Address',
      contactPerson: 'Demo Merchant',
      contactNumber: MERCHANT_PHONE,
      contactEmail: MERCHANT_EMAIL,
      companyEmail: MERCHANT_EMAIL,
      companyLogoUrl: '',
      website: 'https://merchant.local',
    },
    businessType: ['b2c', 'b2b'] as ('b2c' | 'b2b')[],
    approved: true,
    onboardingComplete: true,
    profileComplete: true,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }

  if (existing) {
    await db
      .update(users)
      .set({
        phone: MERCHANT_PHONE,
        role: 'customer',
        emailVerified: true,
        phoneVerified: true,
        accountVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))

    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, existing.id),
    })

    if (existingProfile) {
      await db.update(userProfiles).set(merchantProfilePatch).where(eq(userProfiles.userId, existing.id))
    } else {
      await db.insert(userProfiles).values({
        userId: existing.id,
        monthlyOrderCount: '0-100',
        salesChannels: {},
        domesticKyc: null,
        bankDetails: null,
        gstDetails: null,
        ...merchantProfilePatch,
      })
    }

    return existing.id
  }

  const created = await createUserWithWallet({
    email: MERCHANT_EMAIL,
    phone: MERCHANT_PHONE,
    role: 'customer',
    emailVerified: true,
    phoneVerified: true,
    accountVerified: true,
  })

  await db
    .update(userProfiles)
    .set(merchantProfilePatch)
    .where(eq(userProfiles.userId, created.id))

  return created.id
}

const ensureDemoInvoice = async (sellerId: string) => {
  const [sequence] = await db
    .insert(invoiceSequences)
    .values({
      userId: sellerId,
      lastSequence: 1,
    })
    .onConflictDoUpdate({
      target: invoiceSequences.userId,
      set: {
        updatedAt: new Date(),
      },
    })
    .returning()

  const now = new Date()
  const billingStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const billingEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const invoiceNo = `INV-${yyyy}${mm}-${String(sequence?.lastSequence || 1).padStart(4, '0')}`

  const [existingInvoice] = await db
    .select()
    .from(billingInvoices)
    .where(eq(billingInvoices.invoiceNo, invoiceNo))
    .limit(1)

  if (existingInvoice) return existingInvoice.id

  const [invoice] = await db
    .insert(billingInvoices)
    .values({
      invoiceNo,
      sellerId,
      billingStart: billingStart.toISOString().slice(0, 10),
      billingEnd: billingEnd.toISOString().slice(0, 10),
      taxableValue: '1000',
      cgst: '90',
      sgst: '90',
      igst: '0',
      totalAmount: '1180',
      gstRate: 18,
      status: 'pending',
      type: 'manual',
      pdfUrl: 'https://example.com/demo-invoice.pdf',
      csvUrl: 'https://example.com/demo-invoice.csv',
      orderNumbers: ['DEMO-ORDER-001'],
      isDisputed: false,
      remarks: 'Demo invoice created by setup script.',
    })
    .returning()

  return invoice.id
}

async function main() {
  console.log('Setting up demo auth and invoice data...')
  await ensureBasicPlan('b2c', 'Default B2C plan assigned to demo users')
  await ensureBasicPlan('b2b', 'Default B2B plan assigned to demo users')
  await ensurePlanSplitSetup()

  const adminId = await ensureAdminUser()
  const merchantId = await ensureMerchantUser()
  const invoiceId = await ensureDemoInvoice(merchantId)

  console.log('Demo setup complete.')
  console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log(`Merchant OTP login: ${MERCHANT_EMAIL}`)
  console.log(`Merchant invoice id: ${invoiceId}`)
  console.log(`Admin user id: ${adminId}`)
  console.log(`Merchant user id: ${merchantId}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Demo setup failed:', error)
    process.exit(1)
  })
