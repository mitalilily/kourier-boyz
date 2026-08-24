import { eq } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { kyc, userProfiles, users } from '../schema/schema'
import { updateKycStatus } from '../models/services/kyc.service'

async function approveKycByEmail() {
  const email = process.argv[2]?.trim().toLowerCase()

  if (!email) {
    throw new Error('Usage: npm run approve:kyc -- user@example.com')
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (!user) {
    throw new Error(`No user found for email: ${email}`)
  }

  const [existingKyc] = await db
    .select({ id: kyc.id, status: kyc.status })
    .from(kyc)
    .where(eq(kyc.userId, user.id))
    .limit(1)

  if (!existingKyc) {
    const [profile] = await db
      .select({
        companyInfo: userProfiles.companyInfo,
        gstDetails: userProfiles.gstDetails,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1)

    const companyInfo = (profile?.companyInfo ?? {}) as Record<string, any>
    const gstDetails = (profile?.gstDetails ?? {}) as Record<string, any>

    await db.insert(kyc).values({
      userId: user.id,
      structure: 'company',
      gstin: gstDetails.gstNumber || companyInfo.gstNumber || companyInfo.companyGst || null,
      panNumber: companyInfo.panNumber || companyInfo.pan || null,
      gstCertificateUrl: gstDetails.documentUrl || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  await updateKycStatus(user.id, 'verified')

  const [verifiedKyc] = await db
    .select({
      status: kyc.status,
      panCardStatus: kyc.panCardStatus,
      aadhaarStatus: kyc.aadhaarStatus,
      cancelledChequeStatus: kyc.cancelledChequeStatus,
      companyAddressProofStatus: kyc.companyAddressProofStatus,
      boardResolutionStatus: kyc.boardResolutionStatus,
      partnershipDeedStatus: kyc.partnershipDeedStatus,
      cinStatus: kyc.cinStatus,
      llpAgreementStatus: kyc.llpAgreementStatus,
      businessPanStatus: kyc.businessPanStatus,
      gstCertificateStatus: kyc.gstCertificateStatus,
      updatedAt: kyc.updatedAt,
    })
    .from(kyc)
    .where(eq(kyc.userId, user.id))
    .limit(1)

  const [profile] = await db
    .select({ domesticKyc: userProfiles.domesticKyc })
    .from(userProfiles)
    .where(eq(userProfiles.userId, user.id))
    .limit(1)

  if (verifiedKyc?.status !== 'verified') {
    throw new Error(`KYC approval did not persist for email: ${email}`)
  }

  const profileKycStatus =
    profile?.domesticKyc && typeof profile.domesticKyc === 'object'
      ? profile.domesticKyc.status
      : null

  if (profileKycStatus !== 'verified') {
    throw new Error(`Profile domesticKyc status did not sync for email: ${email}`)
  }

  console.log('KYC approved successfully', {
    email: user.email,
    userId: user.id,
    previousStatus: existingKyc?.status ?? 'missing_created_from_profile',
    currentStatus: verifiedKyc.status,
    profileKycStatus,
    updatedAt: verifiedKyc.updatedAt,
  })
}

approveKycByEmail()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
