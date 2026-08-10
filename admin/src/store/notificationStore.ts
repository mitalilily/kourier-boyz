import { create } from 'zustand'

export type AdminNotification = {
  id: string
  title: string
  description?: string
  createdAt: string
  read?: boolean
  action?: { label: string; href?: string; onClickRoute?: string }
}

type State = {
  notifications: AdminNotification[]
}

type Actions = {
  add: (n: AdminNotification) => void
  markAllRead: () => void
  markRead: (id: string) => void
  clear: () => void
}

export const useNotificationStore = create<State & Actions>((set) => ({
  notifications: [],
  add: (n) => set((s) => ({ notifications: [n, ...s.notifications].slice(0, 100) })),
  markAllRead: () =>
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  clear: () => set({ notifications: [] }),
}))
