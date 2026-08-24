// services/ticketAdminService.js
import api from './axios'

export const adminGetTickets = async ({ page = 1, limit = 10, filters = {} } = {}) => {
  const response = await api.get('/admin/support-tickets', {
    params: {
      page,
      limit,
      status: filters?.status,
      category: filters?.category,
      subcategory: filters?.subCategory,
      awbNumber: filters.awbNumber,
      userId: filters.userId,
      userName: filters?.userName,
      sortBy: filters?.sortBy,
    },
  })

  return response.data
}

// ✅ Fetch ticket by ID
export const adminGetTicketById = async (ticketId) => {
  const response = await api.get(`/admin/tickets/${ticketId}`)
  return response.data
}

// ✅ Update ticket status or due date
export const adminUpdateTicket = async (data) => {
  const response = await api.patch(`/admin/support-tickets/${data?.ticketId}`, {
    ...(data?.data?.status && { status: data?.data?.status }),
    ...(data?.data?.dueBy && { dueDate: data?.data?.dueBy }),
  })
  return response.data
}
