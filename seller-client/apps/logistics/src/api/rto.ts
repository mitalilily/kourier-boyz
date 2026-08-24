import axiosInstance from './axiosInstance'

export async function fetchMyRto(params: { orderId?: string; page?: number; limit?: number; search?: string; fromDate?: string; toDate?: string } = {}) {
  const res = await axiosInstance.get(`/rto`, { params })
  return res.data
}

export async function fetchAdminRto(params: { orderId?: string; page?: number; limit?: number; search?: string; fromDate?: string; toDate?: string } = {}) {
  const res = await axiosInstance.get(`/admin/rto`, { params })
  return res.data
}
