import API from './axiosInstance'

export interface SubmitFeedbackData {
  rating: number
  comment: string
}

export const submitSellerFeedback = async (data: SubmitFeedbackData) => {
  const response = await API.post('/auth/feedback', data)
  return response.data
}

