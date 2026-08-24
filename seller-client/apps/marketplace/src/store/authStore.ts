import axios from 'axios'
import { create } from 'zustand'

interface User {
  id: string
  name: string
  email: string
  phone?: string
  profilePhoto?: string
  role: string

  // Business / Store Information
  businessName?: string
  storeLogo?: string
  businessType?: string
  businessRegistrationNumber?: string
  dateOfEstablishment?: string
  storeDescription?: string

  // Business Address
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string

  // Bank Details
  bankAccountNumber?: string
  bankName?: string
  bankBranch?: string
  ifscCode?: string
  accountHolderName?: string
  bankVerified?: boolean
  bankVerificationStatus?: 'pending' | 'success' | 'failed'
  bankVerificationName?: string

  // Tax & Legal
  panNumber?: string
  gstNumber?: string
  aadhaarNumber?: string
  businessCertificate?: string
  gstCertificate?: string
  idProof?: string
  addressProof?: string
  cancelledCheque?: string
  certificateOfIncorporation?: string
  trustDeed?: string
  partnershipDeed?: string

  // Authorized Person (for companies)
  authorizedPersonName?: string
  authorizedPersonDesignation?: string
  authorizedPersonEmail?: string
  authorizedPersonPhone?: string

  // Approval Status
  isApproved: boolean
  kycSubmitted?: boolean
  kycStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  rejectionReason?: string
  isEmailVerified: boolean
  isPhoneVerified: boolean

  // Seller Lifecycle Status (for deactivation)
  sellerLifecycleStatus?: 'ACTIVE' | 'DEACTIVATION_REQUESTED' | 'DEACTIVATED'
  deactivationRequestedAt?: string
  deactivatedAt?: string
  deactivationReason?: string
  storeStatus?: 'active' | 'inactive'

  // Onboarding (platform tour completed/skipped - from backend)
  onboardingTourCompletedAt?: string

  // Store Settings (from profile)
  defaultShippingRate?: number
  pickupAddresses?: Array<{
    _id?: string
    warehouseName?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    contactName?: string
    contactPhone?: string
    isDefault?: boolean
  }>
}

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
}

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('seller_token')
}

// Helper function to safely parse stored user data
const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null
  try {
    const storedData = localStorage.getItem('seller_data')
    if (!storedData || storedData === 'undefined' || storedData === 'null') {
      return null
    }
    return JSON.parse(storedData)
  } catch (error) {
    console.error('Error parsing stored user data:', error)
    localStorage.removeItem('seller_data')
    return null
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5004/api/seller'

const sendLogoutRequest = async (): Promise<void> => {
  if (typeof window === 'undefined') return
  try {
    const token = localStorage.getItem('seller_token')
    await axios.post(
      `${API_BASE_URL}/auth/logout`,
      {},
      {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    )
  } catch {
    // Ignore network errors during logout
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  setAuth: (token, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seller_token', token)
      localStorage.setItem('seller_data', JSON.stringify(user))
    }
    set({ token, user })
  },
  setUser: (user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('seller_data', JSON.stringify(user))
    }
    set({ user })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      void sendLogoutRequest()
      localStorage.removeItem('seller_token')
      localStorage.removeItem('seller_data')
    }
    set({ token: null, user: null })
  },
}))
