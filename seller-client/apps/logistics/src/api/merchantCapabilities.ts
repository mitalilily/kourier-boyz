import axiosInstance from './axiosInstance'

export type MerchantWorkspace = 'shipping' | 'marketplace'

export type MerchantCapabilities = {
  userId: string
  shippingStatus: 'onboarding' | 'kyc_required' | 'under_review' | 'active' | 'rejected'
  marketplaceStatus: 'not_requested' | 'awaiting_shipping_kyc' | 'setup_required' | 'active' | 'suspended'
  preferredWorkspace?: MerchantWorkspace | null
  firstChoiceCompleted: boolean
  onboardingComplete: boolean
  approved: boolean
  kycStatus: 'pending' | 'verification_in_progress' | 'verified' | 'rejected'
  kycUpdatedAt?: string | null
}

export const fetchMerchantCapabilities = async () => {
  const { data } = await axiosInstance.get<MerchantCapabilities>('/merchant/capabilities')
  return data
}

export const selectMerchantWorkspace = async (workspace: MerchantWorkspace) => {
  const { data } = await axiosInstance.post<MerchantCapabilities>('/merchant/workspace', {
    workspace,
  })
  return data
}
