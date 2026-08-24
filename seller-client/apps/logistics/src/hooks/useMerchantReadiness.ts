import { useMemo } from 'react'
import { usePickupAddresses } from './Pickup/usePickupAddresses'
import { useWalletBalance } from './useWalletBalance'
import { usePaymentOptions } from './usePaymentOptions'
import { useAuth } from '../context/auth/AuthContext'

type CompanyInfoLike = {
  businessName?: string
  companyAddress?: string
  companyEmail?: string
  companyContactNumber?: string
  contactNumber?: string
  contactEmail?: string
  state?: string
  city?: string
  pincode?: string
}

const requiredCompanyFields = [
  'businessName',
  'companyAddress',
  'companyEmail',
  'companyContactNumber',
  'contactNumber',
  'contactEmail',
  'state',
  'city',
  'pincode',
] as const

const hasRequiredCompanyInfo = (companyInfo: CompanyInfoLike | null | undefined) => {
  if (!companyInfo) return false

  return requiredCompanyFields.every((field) => {
    const value = companyInfo[field]
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
  })
}

export const useMerchantReadiness = () => {
  const { user, loading: authLoading } = useAuth()
  const { data: pickupData, isLoading: pickupLoading } = usePickupAddresses({ page: 1, limit: 1 })
  const { data: walletData, isLoading: walletLoading } = useWalletBalance()
  const { data: paymentOptions, isLoading: paymentOptionsLoading } = usePaymentOptions()

  const walletBalance = Number(walletData?.data?.balance || 0)
  const requiredWalletBalance = Math.max(Number(paymentOptions?.minAccountWalletBalance || 0), 0)
  const hasPickupAddress =
    Number(pickupData?.totalCount || 0) > 0 || (pickupData?.pickupAddresses?.length || 0) > 0
  const hasCompanyInfo = hasRequiredCompanyInfo(user?.companyInfo)
  const assignedPlanName = user?.currentPlanName?.trim() || null
  const assignedPlanId = user?.currentPlanId || null

  const checklist = useMemo(
    () => [
      {
        key: 'onboarding',
        title: 'Onboarding Complete',
        description: 'Finish onboarding questions and activate the merchant workspace.',
        done: Boolean(user?.onboardingComplete),
        path: '/onboarding-questions',
        actionLabel: 'Complete Onboarding',
      },
      {
        key: 'company',
        title: 'Company Info Added',
        description: 'Add business identity, address, and primary company contacts.',
        done: hasCompanyInfo,
        path: '/profile/company',
        actionLabel: 'Add Company Info',
      },
      {
        key: 'approval',
        title: 'Account Approved',
        description: 'Wait for internal review to approve your merchant account.',
        done: Boolean(user?.approved),
        path: '/support/tickets',
        actionLabel: 'Contact Support',
      },
      {
        key: 'kyc',
        title: 'KYC Verified',
        description: 'KYC must be verified before order creation is enabled.',
        done: user?.domesticKyc?.status === 'verified',
        path: '/profile/kyc_details',
        actionLabel: 'Complete KYC',
      },
      {
        key: 'pickup',
        title: 'Pickup Address Added',
        description: 'Add at least one pickup location for shipment origin.',
        done: hasPickupAddress,
        path: '/settings/manage_pickups',
        actionLabel: 'Add Pickup Address',
      },
      {
        key: 'wallet',
        title: 'Wallet Ready',
        description:
          requiredWalletBalance > 0
            ? `Keep at least Rs ${requiredWalletBalance.toLocaleString('en-IN')} available to continue placing orders.`
            : 'Wallet readiness is controlled by each order charge at booking time.',
        done: requiredWalletBalance <= 0 || walletBalance >= requiredWalletBalance,
        path: '/billing/wallet_transactions',
        actionLabel: 'Add Wallet Balance',
      },
    ],
    [hasCompanyInfo, hasPickupAddress, requiredWalletBalance, user, walletBalance],
  )

  const completedCount = checklist.filter((item) => item.done).length
  const totalCount = checklist.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isReady = completedCount === totalCount
  const firstIncompleteStep = checklist.find((item) => !item.done) || null

  return {
    checklist,
    completedCount,
    totalCount,
    progress,
    isReady,
    firstIncompleteStep,
    walletBalance,
    requiredWalletBalance,
    assignedPlanName,
    assignedPlanId,
    isLoading: authLoading || pickupLoading || walletLoading || paymentOptionsLoading,
  }
}
