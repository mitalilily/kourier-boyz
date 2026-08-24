import api from './axios'

export async function fetchAdminInternationalShipments(page = 1, limit = 10, filters = {}) {
  const { data } = await api.get('/admin/international/shipments', {
    params: { page, limit, ...filters },
  })
  return data
}

export async function updateAdminInternationalShipment(id, payload) {
  const { data } = await api.patch(`/admin/international/shipments/${id}`, payload)
  return data
}
