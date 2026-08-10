import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/typescript-types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import API from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import { guestCartUtils } from '../utils/guestCart'

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  name: string
  email: string
  password: string
  phone?: string
  role?: string
}

export interface AuthResponse {
  token: string
  role: string
  name: string
  email: string
  userId: string
}

export interface TwoFactorStatus {
  enabled: boolean;
  enabledAt?: string;
  backupCodesRemaining: number;
  hasPendingSetup: boolean;
  tempSecretCreatedAt?: string;
  lastVerifiedAt?: string;
}

export interface TwoFactorSetupResponse {
  message: string;
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface TwoFactorActivationResponse {
  message: string;
  backupCodes: string[];
  backupCodesRemaining: number;
}

export interface TwoFactorChallengeResponse {
  twoFactorRequired: true;
  twoFactorToken: string;
  message: string;
  backupCodesRemaining?: number;
  canUseSms: boolean;
  maskedPhone?: string;
}

export interface TwoFactorVerifyLoginResponse extends AuthResponse {
  backupCodesRemaining?: number
  usedRecoveryCode?: boolean
  usedSmsCode?: boolean
  authMethod?: 'totp' | 'recovery' | 'sms'
}

export interface TwoFactorLoginCodeResponse {
  message: string;
  expiresIn: number;
  retryAfter: number;
  maskedPhone?: string;
}

export type PasskeyRegistrationOptions = PublicKeyCredentialCreationOptionsJSON
export type PasskeyAuthenticationOptions = PublicKeyCredentialRequestOptionsJSON

export interface PasskeyLoginOptionsResponse {
  options: PasskeyAuthenticationOptions;
  userId?: string;
  name?: string;
  email?: string;
}

export interface UserProfile {
  _id: string
  name: string
  email: string
  phone?: string
  role: string
  avatar?: string
  profilePicture?: string
  profilePhoto?: string
  dateOfBirth?: string
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say'
  gstNumber?: string
  isEmailVerified?: boolean
  isPhoneVerified?: boolean
  oauthProvider?: 'google'
  googleId?: string
  hasPassword?: boolean
  passkeys?: Array<{
    id: string
    nickname?: string
    createdAt?: string
    lastUsedAt?: string
    transports?: string[]
  }>
}

// Login mutation
export const useLogin = () => {
  const setAuth = useAuthStore((state) => state.setAuth)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<AuthResponse | TwoFactorChallengeResponse> => {
      const response = await API.post('/auth/login', credentials)
      return response.data
    },
    onSuccess: async (data) => {
      if ('twoFactorRequired' in data && data.twoFactorRequired) {
        return
      }

      const authData = data as AuthResponse

      // Set token in axios defaults FIRST (before setAuth) so API calls work
      API.defaults.headers.common['Authorization'] = `Bearer ${authData.token}`

      // Merge guest cart BEFORE setting auth state (so cart query doesn't fetch empty cart)
      const guestCart = guestCartUtils.getCart()
      if (guestCart.length > 0) {
        try {
          console.log('Merging guest cart with', guestCart.length, 'items')
          const promises = guestCart.map((item) => {
            const payload: {
              productId: string
              variantId?: string
              quantity: number
              couponId?: string
            } = {
              productId: item.productId,
              quantity: item.quantity,
            }
            // Only include variantId if it's actually present (not undefined)
            if (item.variantId) {
              payload.variantId = item.variantId
            }
            // Only include couponId if it's actually present
            if (item.couponId) {
              payload.couponId = item.couponId
            }
            return API.post('/cart', payload)
          })
          await Promise.all(promises)
          console.log('Guest cart merge completed successfully')
          guestCartUtils.clearCart()
          window.dispatchEvent(new CustomEvent('guest-cart-updated'))
        } catch (error) {
          console.error('Failed to merge guest cart after login:', error)
          toast.error('Some items could not be added to your cart')
        }
      }

      // NOW set auth state (this will enable cart query)
      setAuth(authData.token, {
        userId: authData.userId,
        name: authData.name,
        email: authData.email,
        role: authData.role,
      })

      // Set flag for feedback trigger after login
      sessionStorage.setItem('just_logged_in', 'true')

      // Check if there's a pending wishlist product
      const pendingProductId = localStorage.getItem('pendingWishlistProduct')
      if (pendingProductId) {
        try {
          await API.post('/wishlist', { productId: pendingProductId })
          localStorage.removeItem('pendingWishlistProduct')
          toast.success('Product Added to wishlist!')
        } catch (error) {
          console.error('Failed to add product to wishlist after login:', error)
        }
      }

      // Invalidate and refetch cart after merge and auth is set
      if (guestCart.length > 0) {
        // Small delay to ensure auth state is set
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['cart'] })
          queryClient.refetchQueries({ queryKey: ['cart'] })
          toast.success('Cart items added to your account')
        }, 100)
      }

      // Note: Redirect is handled by Login page's useEffect when isAuthenticated changes
      // This ensures the redirect URL from query params is properly read
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

export const useVerifyTwoFactorLogin = () => {
  const setAuth = useAuthStore((state) => state.setAuth)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      token: string
      code?: string
      recoveryCode?: string
      smsCode?: string
    }): Promise<TwoFactorVerifyLoginResponse> => {
      const response = await API.post('/auth/2fa/verify-login', data)
      return response.data
    },
    onSuccess: async (data) => {
      setAuth(data.token, {
        userId: data.userId,
        name: data.name,
        email: data.email,
        role: data.role,
      })

      // Set token in axios defaults
      API.defaults.headers.common['Authorization'] = `Bearer ${data.token}`

      // Set flag for feedback trigger after login
      sessionStorage.setItem('just_logged_in', 'true')

      // Check if there's a pending wishlist product
      const pendingProductId = localStorage.getItem('pendingWishlistProduct')
      if (pendingProductId) {
        try {
          await API.post('/wishlist', { productId: pendingProductId })
          localStorage.removeItem('pendingWishlistProduct')
          toast.success('Product Added to wishlist!')
        } catch (error) {
          console.error('Failed to add product to wishlist after login:', error)
        }
      }

      // Merge guest cart with user cart after login
      const guestCart = guestCartUtils.getCart()
      if (guestCart.length > 0) {
        try {
          const promises = guestCart.map((item) => {
            const payload: {
              productId: string
              variantId?: string
              quantity: number
              couponId?: string
            } = {
              productId: item.productId,
              quantity: item.quantity,
            }
            // Only include variantId if it's actually present (not undefined)
            if (item.variantId) {
              payload.variantId = item.variantId
            }
            // Only include couponId if it's actually present
            if (item.couponId) {
              payload.couponId = item.couponId
            }
            return API.post('/cart', payload)
          })
          await Promise.all(promises)
          guestCartUtils.clearCart()
          window.dispatchEvent(new CustomEvent('guest-cart-updated'))
          // Invalidate cart query to refetch updated cart
          queryClient.invalidateQueries({ queryKey: ['cart'] })
          toast.success('Cart items added to your account')
        } catch (error) {
          console.error('Failed to merge guest cart after login:', error)
          toast.error('Some items could not be added to your cart')
        }
      }

      // Note: Redirect is handled by Login page's useEffect when isAuthenticated changes
      // This ensures the redirect URL from query params is properly read
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

export const useSendTwoFactorLoginCode = () => {
  return useMutation({
    mutationFn: async (data: { token: string }): Promise<TwoFactorLoginCodeResponse> => {
      const response = await API.post('/auth/2fa/send-login-code', data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success(data?.message || 'Verification code sent to your phone.')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError?.response?.data?.error || 'Failed to send verification code')
      throw error
    },
  })
}

export const fetchPasskeyRegistrationOptions = async (): Promise<PasskeyRegistrationOptions> => {
  const response = await API.get('/auth/passkeys/register/options')
  return response.data
}

export const verifyPasskeyRegistrationApi = async (data: {
  credential: unknown
  nickname?: string
}): Promise<{ message: string }> => {
  const response = await API.post('/auth/passkeys/register/verify', data)
  return response.data
}

export const fetchPasskeyAuthenticationOptions = async (data: {
  email?: string
  role?: string
}): Promise<PasskeyLoginOptionsResponse> => {
  const response = await API.post('/auth/passkeys/authentication/options', data)
  return response.data
}

export const verifyPasskeyAuthentication = async (data: {
  credential: unknown
  challenge?: string
}): Promise<AuthResponse> => {
  const response = await API.post('/auth/passkeys/authentication/verify', data)
  return response.data
}

export const removePasskeyApi = async (passkeyId: string): Promise<{ message: string }> => {
  const response = await API.delete(`/auth/passkeys/${passkeyId}`)
  return response.data
}

// Register mutation
export const useRegister = () => {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (data: RegisterData): Promise<{ message: string; emailSent: boolean }> => {
      // First register the user
      const userRole = data.role || 'customer'
      const response = await API.post('/auth/register', {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: userRole,
      })
      return response.data
    },
    onSuccess: () => {
      // Navigate to login with a message to check email
      navigate('/login?verify=true')
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Send Login OTP
export const useSendLoginOTP = () => {
  return useMutation({
    mutationFn: async (data: { phone: string; role?: string }): Promise<{ userId: string; message: string }> => {
      const response = await API.post('/auth/send-login-otp', data)
      return response.data
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Verify Login OTP
export const useVerifyLoginOTP = () => {
  const setAuth = useAuthStore((state) => state.setAuth)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { userId: string; otp: string }): Promise<AuthResponse> => {
      const response = await API.post('/auth/verify-login-otp', data)
      return response.data
    },
    onSuccess: async (data) => {
      // Set token in axios defaults FIRST
      API.defaults.headers.common['Authorization'] = `Bearer ${data.token}`

      // Merge guest cart BEFORE setting auth state
      const guestCart = guestCartUtils.getCart()
      if (guestCart.length > 0) {
        try {
          console.log('Merging guest cart with', guestCart.length, 'items (OTP)')
          const promises = guestCart.map((item) => {
            const payload: {
              productId: string
              variantId?: string
              quantity: number
              couponId?: string
            } = {
              productId: item.productId,
              quantity: item.quantity,
            }
            // Only include variantId if it's actually present (not undefined)
            if (item.variantId) {
              payload.variantId = item.variantId
            }
            // Only include couponId if it's actually present
            if (item.couponId) {
              payload.couponId = item.couponId
            }
            return API.post('/cart', payload)
          })
          await Promise.all(promises)
          console.log('Guest cart merge completed successfully (OTP)')
          guestCartUtils.clearCart()
          window.dispatchEvent(new CustomEvent('guest-cart-updated'))
        } catch (error) {
          console.error('Failed to merge guest cart after login:', error)
          toast.error('Some items could not be added to your cart')
        }
      }

      // NOW set auth state
      setAuth(data.token, {
        userId: data.userId,
        name: data.name,
        email: data.email,
        role: data.role,
      })

      // Set flag for feedback trigger after login
      sessionStorage.setItem('just_logged_in', 'true')

      // Check if there's a pending wishlist product
      const pendingProductId = localStorage.getItem('pendingWishlistProduct')
      if (pendingProductId) {
        try {
          await API.post('/wishlist', { productId: pendingProductId })
          localStorage.removeItem('pendingWishlistProduct')
          toast.success('Product Added to wishlist!')
        } catch (error) {
          console.error('Failed to add product to wishlist after login:', error)
        }
      }

      // Invalidate and refetch cart after merge and auth is set
      if (guestCart.length > 0) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['cart'] })
          queryClient.refetchQueries({ queryKey: ['cart'] })
          toast.success('Cart items added to your account')
        }, 100)
      }

      // Note: Redirect is handled by Login page's useEffect when isAuthenticated changes
      // This ensures the redirect URL from query params is properly read
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Forgot Password - Initiate (returns available options)
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (data: { email: string; role?: string }): Promise<{ 
      message: string
      userId?: string
      options?: {
        phoneOtp: boolean
        emailLink: boolean
      }
      maskedPhone?: string
    }> => {
      const response = await API.post('/auth/forgot-password', data)
      return response.data
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Forgot Password - Send OTP via Phone
export const useForgotPasswordViaPhone = () => {
  return useMutation({
    mutationFn: async (data: { userId: string; role?: string }): Promise<{ 
      message: string
      userId: string
      expiresIn: number
    }> => {
      const response = await API.post('/auth/forgot-password/phone', data)
      return response.data
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Forgot Password - Send Link via Email
export const useForgotPasswordViaEmail = () => {
  return useMutation({
    mutationFn: async (data: { userId: string; role?: string }): Promise<{ 
      message: string
      userId: string
    }> => {
      const response = await API.post('/auth/forgot-password/email', data)
      return response.data
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Resend Password Reset OTP via Phone
export const useResendPasswordResetOtp = () => {
  return useMutation({
    mutationFn: async (data: { userId: string; role?: string }): Promise<{ 
      message: string
      userId: string
      expiresIn: number
      retryAfter: number
    }> => {
      const response = await API.post('/auth/forgot-password/phone/resend', data)
      return response.data
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Reset Password (supports both phone OTP code and email token)
export const useResetPassword = () => {
  return useMutation({
    mutationFn: async (data: { 
      userId: string
      code?: string
      token?: string
      password: string 
    }): Promise<{ message: string }> => {
      const response = await API.post('/auth/reset-password', data)
      return response.data
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Verify Phone
export const useVerifyPhone = () => {
  return useMutation({
    mutationFn: async (data: { userId: string; code: string }): Promise<{ message: string }> => {
      const response = await API.post('/auth/verify-phone', data)
      return response.data
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Resend Phone Code
export const useResendPhoneCode = () => {
  return useMutation({
    mutationFn: async (data: { userId: string }): Promise<{ message: string }> => {
      const response = await API.post('/auth/resend-phone-code', data)
      return response.data
    },
    onError: (error: unknown) => {
      throw error
    },
  })
}

// Get verification status
export const useVerificationStatus = (userId: string) => {
  return useQuery({
    queryKey: ['verification-status', userId],
    queryFn: async (): Promise<{
      userId: string
      email: string
      phone?: string
      isEmailVerified: boolean
      isPhoneVerified: boolean
      needsPhoneVerification: boolean
    }> => {
      const response = await API.get(`/auth/verification-status/${userId}`)
      return response.data
    },
    enabled: !!userId,
  })
}

// Get user profile
export const useProfile = () => {
  const token = useAuthStore((state) => state.token)
  const setUser = useAuthStore((state) => state.setUser)

  const query = useQuery({
    queryKey: ['profile'],
    queryFn: async (): Promise<UserProfile> => {
      const response = await API.get('/auth/profile')
      const data = response.data
      // Update user in store when data is fetched
      const user = {
        userId: data._id,
        name: data.name,
        email: data.email,
        role: data.role,
      }
      setUser(user)
      return data
    },
    enabled: !!token,
  })

  return query
}

// Send OTP for profile update
export const useSendUpdateOTP = () => {
  return useMutation({
    mutationFn: async (data: { email?: string; phone?: string }): Promise<{ message: string }> => {
      const response = await API.post('/auth/profile/send-otp', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('OTP sent successfully!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError?.response?.data?.error || 'Failed to send OTPs')
      throw error
    },
  })
}

// Resend phone OTP for profile update
export const useResendProfilePhoneOTP = () => {
  return useMutation({
    mutationFn: async (phone?: string): Promise<{ message: string; retryAfter?: number }> => {
      const response = await API.post('/auth/profile/resend-phone-otp', phone ? { phone } : {})
      return response.data
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string; retryAfter?: number } } }
      // Don't show toast here, let the component handle it
      throw axiosError
    },
  })
}

// Update profile mutation
export const useUpdateProfile = () => {
  const { refetch } = useProfile()

  return useMutation({
    mutationFn: async (data: {
      name?: string
      email?: string
      phone?: string
      emailOTP?: string
      phoneOTP?: string
      dateOfBirth?: string
      gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say'
      gstNumber?: string
    }): Promise<UserProfile> => {
      const response = await API.put('/auth/profile', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('Profile updated successfully!')
      refetch()
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError?.response?.data?.error || 'Failed to update profile')
      throw error
    },
  })
}

// Change password mutation
export const useChangePassword = () => {
  return useMutation({
    mutationFn: async (data: { currentPassword?: string; newPassword: string }): Promise<{ message: string }> => {
      const response = await API.put('/auth/change-password', data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Password set successfully!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError?.response?.data?.error || 'Failed to set password')
      throw error
    },
  })
}

export const useTwoFactorStatus = () => {
  const token = useAuthStore((state) => state.token)

  return useQuery({
    queryKey: ['two-factor-status'],
    queryFn: async (): Promise<TwoFactorStatus> => {
      const response = await API.get('/auth/2fa/status')
      return response.data
    },
    enabled: !!token,
  })
}

export const useInitiateTwoFactorSetup = () => {
  return useMutation({
    mutationFn: async (): Promise<TwoFactorSetupResponse> => {
      const response = await API.post('/auth/2fa/setup')
      return response.data
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError?.response?.data?.error || 'Failed to start 2FA setup')
      throw error
    },
  })
}

export const useActivateTwoFactor = () => {
  return useMutation({
    mutationFn: async (data: { code: string }): Promise<TwoFactorActivationResponse> => {
      const response = await API.post('/auth/2fa/activate', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('Two-factor authentication enabled!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError?.response?.data?.error || 'Failed to enable 2FA')
      throw error
    },
  })
}

export const useRegenerateTwoFactorCodes = () => {
  return useMutation({
    mutationFn: async (data: { code: string }): Promise<TwoFactorActivationResponse> => {
      const response = await API.post('/auth/2fa/backup-codes', data)
      return response.data
    },
    onSuccess: () => {
      toast.success('New backup codes generated!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError?.response?.data?.error || 'Failed to regenerate backup codes')
      throw error
    },
  })
}

export const useDisableTwoFactor = () => {
  return useMutation({
    mutationFn: async (data: { code?: string; recoveryCode?: string }): Promise<{ message: string }> => {
      const response = await API.post('/auth/2fa/disable', data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success(
        data?.message ||
          'Two-factor authentication disabled. Remove the account entry from your authenticator app to avoid accidental use.',
      )
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError?.response?.data?.error || 'Failed to disable 2FA')
      throw error
    },
  })
}

// Buyer Deactivation APIs
export interface BuyerDeactivationStatus {
  status: 'ACTIVE' | 'DEACTIVATION_REQUESTED' | 'DEACTIVATED'
  deactivationRequestedAt?: string
  deactivatedAt?: string
  deactivationReason?: string
}

export const useBuyerDeactivationStatus = () => {
  return useQuery<BuyerDeactivationStatus>({
    queryKey: ['buyerDeactivationStatus'],
    queryFn: async () => {
      const response = await API.get('/auth/buyer/deactivation/status')
      return response.data
    },
  })
}

export const useRequestBuyerDeactivation = () => {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  return useMutation({
    mutationFn: async (data: { password: string; reason?: string }): Promise<{ message: string; deactivated: boolean }> => {
      const response = await API.post('/auth/buyer/deactivation/request', data)
      return response.data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Your account has been deactivated.')
      // Logout and redirect to home with replace to prevent ProtectedRoute from redirecting to login
      logout()
      navigate('/', { replace: true })
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string; message?: string } } }
      toast.error(
        axiosError?.response?.data?.error ||
          axiosError?.response?.data?.message ||
          'Failed to deactivate account'
      )
      throw error
    },
  })
}

export const useReactivateBuyer = () => {
  return useMutation({
    mutationFn: async (): Promise<{ message: string; reactivated: boolean }> => {
      const response = await API.post('/auth/buyer/reactivate')
      return response.data
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Your account has been reactivated.')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string; message?: string } } }
      toast.error(
        axiosError?.response?.data?.error ||
          axiosError?.response?.data?.message ||
          'Failed to reactivate account'
      )
      throw error
    },
  })
}

export interface GoogleOAuthResponse extends AuthResponse {
  requiresPhoneVerification?: boolean
}

// Google OAuth mutation
export const useGoogleOAuth = () => {
  const setAuth = useAuthStore((state) => state.setAuth)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (code: string): Promise<GoogleOAuthResponse> => {
      const response = await API.post('/auth/google', { code })
      return response.data
    },
    onSuccess: async (data) => {
      // Set token in axios defaults FIRST
      API.defaults.headers.common['Authorization'] = `Bearer ${data.token}`

      // Merge guest cart BEFORE setting auth state
      const guestCart = guestCartUtils.getCart()
      if (guestCart.length > 0) {
        try {
          console.log('Merging guest cart with', guestCart.length, 'items (Google OAuth)')
          const promises = guestCart.map((item) => {
            const payload: {
              productId: string
              variantId?: string
              quantity: number
              couponId?: string
            } = {
              productId: item.productId,
              quantity: item.quantity,
            }
            // Only include variantId if it's actually present (not undefined)
            if (item.variantId) {
              payload.variantId = item.variantId
            }
            // Only include couponId if it's actually present
            if (item.couponId) {
              payload.couponId = item.couponId
            }
            return API.post('/cart', payload)
          })
          await Promise.all(promises)
          console.log('Guest cart merge completed successfully (Google OAuth)')
          guestCartUtils.clearCart()
          window.dispatchEvent(new CustomEvent('guest-cart-updated'))
        } catch (error) {
          console.error('Failed to merge guest cart after login:', error)
          toast.error('Some items could not be added to your cart')
        }
      }

      // NOW set auth state
      setAuth(data.token, {
        userId: data.userId,
        name: data.name,
        email: data.email,
        role: data.role,
      })

      // Set flag for feedback trigger after login
      sessionStorage.setItem('just_logged_in', 'true')

      // Check if there's a pending wishlist product
      const pendingProductId = localStorage.getItem('pendingWishlistProduct')
      if (pendingProductId) {
        try {
          await API.post('/wishlist', { productId: pendingProductId })
          localStorage.removeItem('pendingWishlistProduct')
          toast.success('Product Added to wishlist!')
        } catch (error) {
          console.error('Failed to add product to wishlist after login:', error)
        }
      }

      // Invalidate and refetch cart after merge and auth is set
      if (guestCart.length > 0) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['cart'] })
          queryClient.refetchQueries({ queryKey: ['cart'] })
          toast.success('Cart items added to your account')
        }, 100)
      }

      // Note: Redirect and phone verification handling is done in the component
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string; message?: string } } }
      const errorMessage =
        axiosError?.response?.data?.error ||
        axiosError?.response?.data?.message ||
        'Google sign-in failed'

      // Handle specific error cases
      if (axiosError?.response?.data?.error === 'ACCOUNT_EXISTS') {
        toast.error(
          axiosError.response.data.message ||
            'An account with this email already exists. Please sign in with your password.'
        )
      } else if (axiosError?.response?.data?.error === 'ACCOUNT_BLOCKED') {
        toast.error(axiosError.response.data.message || 'Your account has been blocked.')
      } else {
        toast.error(errorMessage)
      }
      throw error
    },
  })
}
