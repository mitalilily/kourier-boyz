import api from './axios'

export async function fetchAdminFtlRequests(page = 1, limit = 10, filters = {}) {
  const { data } = await api.get('/admin/ftl/requests', {
    params: { page, limit, ...filters },
  })
  return data
}

export async function updateAdminFtlRequest(id, payload) {
  const { data } = await api.patch(`/admin/ftl/requests/${id}`, payload)
  return data
}
