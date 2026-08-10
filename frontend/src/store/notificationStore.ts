import { create } from 'zustand'

export type CustomerNotification = {
  id: string
  title: string
  description?: string
  createdAt: string
  read?: boolean
  link?: { label: string; href?: string; route?: string }
}

type State = {
  notifications: CustomerNotification[]
}

type Actions = {
  add: (notification: CustomerNotification) => void
  markRead: (id: string) => void
  markAllRead: () => void
  clear: () => void
}

export const useNotificationStore = create<State & Actions>((set) => ({
  notifications: [],
  add: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 100),
    })),
  markRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    })),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((notification) => ({
        ...notification,
        read: true,
      })),
    })),
  clear: () => set({ notifications: [] }),
}))






















