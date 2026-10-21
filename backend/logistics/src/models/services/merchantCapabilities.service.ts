import { eq } from 'drizzle-orm'
import { db } from '../client'
import { merchantCapabilities } from '../schema/merchantCapabilities'
import { getProfileByUserId } from './userProfile.service'

export type MerchantWorkspace = 'shipping' | 'marketplace'

const shippingStatusForProfile = (profile: Awaited<ReturnType<typeof getProfileByUserId>>) => {
  if (profile?.approved || profile?.domesticKyc?.status === 'verified') return 'active'
  if (profile?.domesticKyc?.status === 'rejected') return 'rejected'
  if (profile?.domesticKyc?.status === 'verification_in_progress') return 'under_review'
  return profile?.onboardingComplete ? 'kyc_required' : 'onboarding'
}

const marketplaceStatusFor = (current: string, shippingStatus: string) => {
  if (current === 'not_requested') return current
  if (current === 'suspended') return current
  if (shippingStatus !== 'active') return 'awaiting_shipping_kyc'
  return current === 'active' ? 'active' : 'setup_required'
}

export const getMerchantCapabilities = async (userId: string) => {
  const profile = await getProfileByUserId(userId)
  if (!profile) return null

  const [existing] = await db
    .select()
    .from(merchantCapabilities)
    .where(eq(merchantCapabilities.userId, userId))
    .limit(1)

  const shippingStatus = shippingStatusForProfile(profile)
  const marketplaceStatus = marketplaceStatusFor(
    existing?.marketplaceStatus || 'not_requested',
    shippingStatus,
  )

  const [capabilities] = await db
    .insert(merchantCapabilities)
    .values({
      userId,
      shippingStatus,
      marketplaceStatus,
      preferredWorkspace: existing?.preferredWorkspace || null,
      firstChoiceCompleted: existing?.firstChoiceCompleted || false,
    })
    .onConflictDoUpdate({
      target: merchantCapabilities.userId,
      set: { shippingStatus, marketplaceStatus, updatedAt: new Date() },
    })
    .returning()

  return {
    ...capabilities,
    onboardingComplete: Boolean(profile.onboardingComplete),
    approved: shippingStatus === 'active',
    kycStatus: profile.domesticKyc?.status || 'pending',
    kycUpdatedAt: profile.domesticKyc?.updatedAt || null,
  }
}

export const chooseMerchantWorkspace = async (userId: string, workspace: MerchantWorkspace) => {
  const current = await getMerchantCapabilities(userId)
  if (!current) return null

  const marketplaceStatus =
    workspace === 'marketplace'
      ? current.shippingStatus === 'active'
        ? current.marketplaceStatus === 'active'
          ? 'active'
          : 'setup_required'
        : 'awaiting_shipping_kyc'
      : current.marketplaceStatus

  await db
    .update(merchantCapabilities)
    .set({
      preferredWorkspace: workspace,
      firstChoiceCompleted: true,
      marketplaceStatus,
      updatedAt: new Date(),
    })
    .where(eq(merchantCapabilities.userId, userId))

  return getMerchantCapabilities(userId)
}
