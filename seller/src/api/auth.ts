import API from './axiosInstance'

export type LoginData = {
  email: string
  password: string
}

export type RegisterData = {
  name: string
  email: string
  password: string
  phone: string
  businessName: string
  businessAddress: string
  gstNumber?: string
}

export const login = async (data: LoginData) => {
  const response = await API.post('/auth/login', data)
  return response.data
}

export const register = async (data: RegisterData) => {
  const response = await API.post('/auth/register', data)
  return response.data
}

export const getProfile = async () => {
  const response = await API.get('/auth/profile')
  return response.data
}

export const updateProfile = async (data: Partial<RegisterData>) => {
  const response = await API.put('/auth/profile', data)
  return response.data
}

export const verifyEmail = async (token: string) => {
  const response = await API.get(`/auth/verify-email/${token}`)
  return response.data
}

export const resendVerificationEmail = async (email: string) => {
  const response = await API.post('/auth/resend-verification', { email })
  return response.data
}

export const forgotPassword = async (email: string) => {
  const response = await API.post('/auth/forgot-password', { email })
  return response.data
}

export const resetPassword = async (token: string, password: string) => {
  const response = await API.post(`/auth/reset-password/${token}`, { password })
  return response.data
}


export const googleOAuth = async (code: string) => {
  const response = await API.post('/auth/google-oauth', { code })
  return response.data
}

export type KYCData = FormData

export const submitKYC = async (data: KYCData) => {
  const response = await API.post('/auth/submit-kyc', data, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const saveKYCDraft = async (data: Partial<KYCData> & Record<string, unknown>) => {
  const response = await API.post('/auth/kyc-draft', data)
  return response.data
}

// Bank verification will be handled later via a KYC provider (e.g. Setu).
// For now, there is no separate bank verification API.
