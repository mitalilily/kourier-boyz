import axiosInstance from './axiosInstance'

export async function fetchInternationalRateCards() {
  const { data } = await axiosInstance.get('/international/rate-cards')
  return data.data || []
}

export async function calculateInternationalRate(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.post('/international/rate-calculator', payload)
  return data.data || []
}

export async function createInternationalShipment(payload: Record<string, unknown>) {
  const { data } = await axiosInstance.post('/international/shipments', payload)
  return data
}

export async function fetchMyInternationalShipments(params: Record<string, unknown> = {}) {
  const { data } = await axiosInstance.get('/international/shipments', { params })
  return data
}
