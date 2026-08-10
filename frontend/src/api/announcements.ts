import axios from '../lib/axios'

export interface Announcement {
  _id: string
  title: string
  message?: string
  link?: string
  linkText?: string
  backgroundColor?: string
  textColor?: string
  isActive: boolean
  startDate?: string
  endDate?: string
  dismissible: boolean
  targetAudience?: 'all' | 'authenticated' | 'guest'
  createdAt: string
  updatedAt: string
}

export interface AnnouncementsResponse {
  announcements: Announcement[]
}

export const getActiveAnnouncements = async (isAuthenticated?: boolean) => {
  const targetAudience = isAuthenticated ? 'authenticated' : 'guest'
  const response = await axios.get<AnnouncementsResponse>('/announcements/active', {
    params: { targetAudience },
  })
  return response.data
}

