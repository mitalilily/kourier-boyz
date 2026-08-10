import API from './axiosInstance'

export interface UpdateProfileData {
  name: string
  phone?: string
  profilePhoto?: File
}

export interface ChangePasswordData {
  currentPassword?: string
  newPassword: string
}

export const getProfile = async () => {
  const response = await API.get('/auth/profile')
  return response.data
}

export const updateProfile = async (data: UpdateProfileData) => {
  // If profilePhoto is included, send as FormData
  if (data.profilePhoto) {
    const formData = new FormData()
    formData.append('name', data.name)
    if (data.phone) {
      formData.append('phone', data.phone)
    }
    formData.append('profilePhoto', data.profilePhoto)
    
    const response = await API.put('/auth/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }
  
  // Otherwise, send as JSON
  const response = await API.put('/auth/profile', data)
  return response.data
}

export const changePassword = async (data: ChangePasswordData) => {
  const response = await API.put('/auth/change-password', data)
  return response.data
}

export const markOnboardingTourCompleted = async () => {
  const response = await API.put('/auth/onboarding-tour-completed')
  return response.data
}
