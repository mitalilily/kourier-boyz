import API from './axiosInstance'

export interface DeactivationEligibility {
  eligible: boolean
  blockingReasons: string[]
}

export interface DeactivationRequest {
  deactivationReason?: string
}

export interface DeactivationRequestResponse {
  success: boolean
  message: string
  status: string
}

/**
 * Check deactivation eligibility
 */
export const checkDeactivationEligibility = async (): Promise<DeactivationEligibility> => {
  const response = await API.get('/deactivation/check-eligibility')
  return response.data
}

/**
 * Request account deactivation
 */
export const requestDeactivation = async (
  data: DeactivationRequest,
): Promise<DeactivationRequestResponse> => {
  const response = await API.post('/deactivation/request', data)
  return response.data
}



















