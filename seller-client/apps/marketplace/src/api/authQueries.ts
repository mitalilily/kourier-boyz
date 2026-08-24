import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import {
  forgotPassword,
  googleOAuth,
  login,
  type LoginData,
  register,
  type RegisterData,
  resendVerificationEmail,
  resetPassword,
  submitKYC,
  saveKYCDraft,
  verifyEmail,
} from './auth'
import { getProfile, updateProfile, type UpdateProfileData } from './profile'

// Login mutation
export const useLogin = () => {
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationFn: (data: LoginData) => login(data),
    onSuccess: (response) => {
      setAuth(response.token, response.seller)
    },
  })
}

// Register mutation
export const useRegister = () => {
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationFn: (data: RegisterData) => register(data),
    onSuccess: (response) => {
      // Auto-login after registration
      if (response.token && response.seller) {
        setAuth(response.token, response.seller)
      }
    },
  })
}

// Google OAuth mutation
export const useGoogleOAuth = () => {
  const setAuth = useAuthStore((state) => state.setAuth)

  return useMutation({
    mutationFn: (code: string) => googleOAuth(code),
    onSuccess: (response) => {
      if (response.token && response.seller) {
        setAuth(response.token, response.seller)
      }
    },
    onError: (error: unknown) => {
      // Error is handled in the component, but we log it here for debugging
      const axiosError = error as {
        code?: string
        message?: string
        response?: {
          data?: {
            error?: string
            message?: string
          }
        }
      }
      
      // Log network errors for debugging
      if (axiosError.code === 'ERR_NETWORK' || axiosError.message === 'Network Error') {
        console.error('OAuth network error - backend server may not be running:', error)
      }
    },
  })
}

// Get profile query
export const useProfile = () => {
  const token = useAuthStore((state) => state.token)

  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled: !!token,
  })
}

// Update profile mutation
export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: (data: UpdateProfileData) => updateProfile(data),
  })
}

// Verify email mutation
export const useVerifyEmail = () => {
  return useMutation({
    mutationFn: (token: string) => verifyEmail(token),
  })
}

// Resend verification email mutation
export const useResendVerificationEmail = () => {
  return useMutation({
    mutationFn: (email: string) => resendVerificationEmail(email),
  })
}

// Forgot password mutation
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => forgotPassword(email),
  })
}

// Reset password mutation
export const useResetPassword = () => {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      resetPassword(token, password),
  })
}


// Submit KYC mutation
export const useSubmitKYC = () => {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: (data: FormData) => submitKYC(data),
    onSuccess: (response) => {
      if (response.user) {
        setUser(response.user)
      }
    },
  })
}

// Save KYC draft mutation
export const useSaveKYCDraft = () => {
  const setUser = useAuthStore((state) => state.setUser)

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => saveKYCDraft(data),
    onSuccess: (response) => {
      if (response.user) {
        setUser(response.user)
      }
    },
  })
}

// Bank verification mutation removed for now; will be reintroduced with Setu integration.
