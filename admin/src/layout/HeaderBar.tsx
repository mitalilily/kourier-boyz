import { BellOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import {
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Dropdown,
  Empty,
  Layout,
  List,
  Popover,
  Tag,
  notification,
} from 'antd'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { io as ioc } from 'socket.io-client'
import { useNotifications, useUnreadNotificationCount } from '../api/notificationQueries'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import AdminWorkspaceSwitch from '../components/AdminWorkspaceSwitch'

const { Header } = Layout

// Map routes to display names
const ROUTE_NAMES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/categories': 'Categories',
  '/sellers': 'Seller Management',
  '/sellers/:id': 'Seller Details',
  '/sellers/create': 'Create Seller',
  '/orders': 'Orders',
  '/orders/:id': 'Order Details',
  '/products': 'Products',
  '/products/:id': 'Product Details',
  '/settings': 'Settings',
  '/calculations': 'Calculations & Formulas',
  '/reports/sales': 'Sales Report',
  '/reports/settlement-due': 'Settlement Due Report',
  '/reports/courier-charges': 'Courier Charges Report',
}

const HeaderBar = () => {
  const name = useAuthStore((state) => state.name)
  const role = useAuthStore((state) => state.role)
  const logout = useAuthStore((state) => state.logout)
  const location = useLocation()
  const navigate = useNavigate()

  // Determine page name (supports nested and dynamic params like :id)
  const pathSegments = location.pathname.split('/').filter(Boolean)
  // const basePath = '/' + (pathSegments[0] || '')
  // const nestedPath = '/' + pathSegments.join('/')

  const getRouteName = (path: string) => {
    // Exact match first
    if (ROUTE_NAMES[path]) return ROUTE_NAMES[path]
    // Try dynamic pattern match (e.g., /sellers/:id)
    for (const pattern in ROUTE_NAMES) {
      if (!Object.prototype.hasOwnProperty.call(ROUTE_NAMES, pattern)) continue
      if (!pattern.includes(':')) continue
      const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$')
      if (regex.test(path)) return ROUTE_NAMES[pattern]
    }
    return undefined
  }

  // Page name (kept for potential future use)
  // const pageName = getRouteName(nestedPath) || ROUTE_NAMES[basePath] || 'Admin'

  // Build breadcrumb items from path
  const breadcrumbItems = (() => {
    const items: { title: React.ReactNode; href?: string }[] = []
    let accumPath = ''
    for (let i = 0; i < pathSegments.length; i++) {
      accumPath += '/' + pathSegments[i]
      const isLast = i === pathSegments.length - 1
      // Try exact
      let label = getRouteName(accumPath)
      if (!label && pathSegments[i].match(/^[a-f0-9]{24}$/i)) {
        // dynamic id segment → try parent pattern /:id
        const parent = '/' + pathSegments.slice(0, i).join('/')
        label = getRouteName(parent + '/:id') || 'Details'
      }
      if (!label) {
        // Fallback: prettify segment
        const seg = pathSegments[i]
        label = seg.charAt(0).toUpperCase() + seg.slice(1)
      }
      items.push({
        title: label,
        href: isLast ? undefined : accumPath,
      })
    }
    return items
  })()

  const menuItems = [
    {
      key: 'profile',
      label: 'Profile',
      icon: <UserOutlined />,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      danger: true,
    },
  ]

  const handleMenuClick = (e: { key: string }) => {
    if (e.key === 'logout') {
      logout()
      window.location.href = '/login'
    } else if (e.key === 'settings') {
      navigate('/settings')
    } else if (e.key === 'profile') {
      navigate('/profile')
    }
  }

  type Notif = {
    id: string
    title: string
    description?: string
    createdAt: string
    read?: boolean
    type?: string
    link?: string
    action?: { label: string; href?: string; onClickRoute?: string }
  }

  // Fetch notifications from API
  const { data: apiNotificationsData } = useNotifications({ limit: 50 })
  const { data: unreadCountData } = useUnreadNotificationCount()

  const store = useNotificationStore()
  const [notifications, setNotifications] = useState<Notif[]>([])

  // Combine API notifications with store notifications
  const apiNotifications = apiNotificationsData?.data || []
  const allNotifications: Notif[] = [
    ...apiNotifications.map((n) => ({
      id: n._id,
      title: n.title,
      description: n.message,
      createdAt: n.createdAt,
      read: n.read,
      type: n.type,
      link: n.link,
      action: n.link
        ? {
            label: 'View Details',
            onClickRoute: n.link,
          }
        : undefined,
    })),
    ...store.notifications,
    ...notifications,
  ]
    .filter(
      (n, index, self) => index === self.findIndex((t) => t.id === n.id), // Remove duplicates
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Use API unread count if available, otherwise calculate from combined notifications
  const unreadCount = unreadCountData?.count ?? allNotifications.filter((n) => !n.read).length

  // Use combined notifications for display
  const displayNotifications = allNotifications.slice(0, 10)

  useEffect(() => {
    const userId = useAuthStore.getState().userId
    const userRole = useAuthStore.getState().role

    if (!userId && userRole !== 'super-admin') return

    const base = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5004'
    const socket = ioc(base, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    // Wait for connection before registering
    socket.on('connect', () => {
      console.log('[Socket] Admin connected, registering:', { userId, role: userRole })
      socket.emit('register', {
        role: userRole === 'super-admin' ? 'super-admin' : undefined,
        userId: userId || undefined,
      })
    })

    socket.on('connect_error', (error) => {
      console.error('[Socket] Admin connection error:', error)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Admin disconnected:', reason)
    })
    socket.on('categoryRequest:submitted', (payload: { id: string; name: string }) => {
      const item: Notif = {
        id: payload.id,
        title: 'New Category Request',
        description: payload.name,
        createdAt: new Date().toISOString(),
        read: false,
      }
      setNotifications((list) => [item, ...list].slice(0, 100))
      store.add(item)
      notification.info({ message: item.title, description: item.description })
    })
    // Generic system notifications (including new seller KYC)
    socket.on(
      'notification:new',
      (payload: {
        id?: string
        title: string
        message: string
        type?: string
        link?: string
        createdAt?: string
        read?: boolean
      }) => {
        const item: Notif = {
          id: payload.id || `notification:new:${Date.now()}`,
          title: payload.title,
          description: payload.message,
          createdAt: payload.createdAt || new Date().toISOString(),
          read: payload.read || false,
          type: payload.type,
          link: payload.link,
          action: payload.link
            ? {
                label: 'View Details',
                onClickRoute: payload.link,
              }
            : undefined,
        }
        setNotifications((list) => [item, ...list].slice(0, 100))
        store.add(item)
        notification.info({
          message: payload.title,
          description: payload.message,
          onClick: () => {
            if (payload.link?.startsWith('/')) {
              navigate(payload.link)
            }
          },
        })
      },
    )
    // Product moderation notices
    socket.on('notice:new', (payload: { productId: string; reason: string; createdAt: string }) => {
      const item: Notif = {
        id: `notice:new:${payload.productId}:${payload.createdAt}`,
        title: 'New Product Notice',
        description: payload.reason,
        createdAt: payload.createdAt || new Date().toISOString(),
        read: false,
      }
      setNotifications((list) => [item, ...list].slice(0, 100))
      store.add(item)
    })
    socket.on('notice:addressed', (payload: { productId: string; addressedAt: string }) => {
      const item: Notif = {
        id: `notice:addressed:${payload.productId}:${payload.addressedAt}`,
        title: 'Seller addressed notice',
        description: 'Seller marked the notice as addressed',
        createdAt: payload.addressedAt || new Date().toISOString(),
        read: false,
      }
      setNotifications((list) => [item, ...list].slice(0, 100))
      store.add(item)
    })
    socket.on('notice:resolved', (payload: { productId: string; resolvedAt: string }) => {
      const item: Notif = {
        id: `notice:resolved:${payload.productId}:${payload.resolvedAt}`,
        title: 'Notice resolved',
        description: 'You resolved a product notice',
        createdAt: payload.resolvedAt || new Date().toISOString(),
        read: false,
      }
      setNotifications((list) => [item, ...list].slice(0, 100))
      store.add(item)
    })

    // Support chat assignment notification
    socket.on(
      'supportChat:assignedToYou',
      (payload: {
        chatId: string
        chat: {
          _id: string
          customerId: { name: string; email: string }
          subject?: string
          issueType?: string
          status: string
        }
      }) => {
        const customerName = payload.chat.customerId?.name || 'Customer'
        const subject = payload.chat.subject || 'Support Chat'
        const item: Notif = {
          id: `chat:assigned:${payload.chatId}:${Date.now()}`,
          title: 'Chat Assigned to You',
          description: `${customerName} - ${subject}`,
          createdAt: new Date().toISOString(),
          read: false,
        }
        setNotifications((list) => [item, ...list].slice(0, 100))
        store.add(item)
        notification.info({
          message: 'New Chat Assigned',
          description: `You have been assigned a chat: ${subject}`,
          onClick: () => {
            navigate('/support-chats')
          },
        })
      },
    )

    return () => {
      console.log('[Socket] Admin cleaning up socket connection')
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
      socket.off('categoryRequest:submitted')
      socket.off('notification:new')
      socket.off('notice:new')
      socket.off('notice:addressed')
      socket.off('notice:resolved')
      socket.off('supportChat:assignedToYou')
      socket.close()
    }
  }, [store, navigate])

  return (
    <Header className="kb-admin-header sticky top-0 z-20">
      {/* Left: Breadcrumb + Page Title */}
      <div className="kb-admin-header-context">
        <div className="flex flex-col">
          <Breadcrumb
            separator={<span className="kb-admin-breadcrumb-separator">/</span>}
            items={breadcrumbItems.map((b) => ({
              title: b.href ? (
                <a
                  className="kb-admin-breadcrumb-link"
                  href={b.href}
                >
                  {b.title}
                </a>
              ) : (
                <span className="kb-admin-breadcrumb-current">{b.title}</span>
              ),
            }))}
          />
        </div>
      </div>

      <AdminWorkspaceSwitch active="marketplace" />

      {/* Right: Actions */}
      <div className="kb-admin-header-actions">
        {/* Notifications */}
        <Popover
          placement="bottomRight"
          trigger={['click']}
          content={
            <div style={{ width: 320, maxHeight: 500, overflowY: 'auto' }}>
              {displayNotifications.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No new notifications" />
              ) : (
                <List
                  dataSource={displayNotifications}
                  renderItem={(item) => (
                    <List.Item
                      onClick={async () => {
                        setNotifications((list) =>
                          list.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
                        )
                        store.markRead(item.id)

                        // Mark in API if it's an API notification
                        if (apiNotifications.some((n) => n._id === item.id)) {
                          try {
                            const { markNotificationRead } = await import('../api/notifications')
                            await markNotificationRead(item.id)
                          } catch (err) {
                            console.error('Failed to mark notification as read:', err)
                          }
                        }

                        // Navigate based on notification type or action
                        if (item.action?.onClickRoute) {
                          navigate(item.action.onClickRoute)
                        } else if (item.action?.href) {
                          window.location.href = item.action.href
                        } else if (item.link) {
                          navigate(item.link)
                        } else if (item.title.includes('Category Request')) {
                          navigate('/categories?tab=requests')
                        } else if (item.title.includes('Chat')) {
                          navigate('/support-chats')
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        background: item.read ? undefined : '#f6ffed',
                        padding: '12px 16px',
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = item.read ? '#fafafa' : '#f0f9ff'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = item.read ? '' : '#f6ffed'
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                fontWeight: item.read ? 400 : 600,
                                fontSize: 14,
                                color: item.read ? '#666' : '#000',
                              }}
                            >
                              {item.title}
                            </span>
                            {!item.read && <Badge dot style={{ backgroundColor: '#ef4444' }} />}
                          </div>
                        }
                        description={
                          <div
                            style={{
                              marginTop: 4,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            {item.description && (
                              <span
                                style={{
                                  fontSize: 12,
                                  color: '#666',
                                  lineHeight: 1.5,
                                }}
                              >
                                {item.description}
                              </span>
                            )}
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <span
                                style={{
                                  color: '#999',
                                  fontSize: 11,
                                }}
                              >
                                {new Date(item.createdAt).toLocaleString()}
                              </span>
                              {item.action && (
                                <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                                  {item.action.label}
                                </Tag>
                              )}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, gap: 8 }}
              >
                <Button
                  size="small"
                  onClick={async () => {
                    try {
                      const { markAllNotificationsRead } = await import('../api/notifications')
                      await markAllNotificationsRead()
                    } catch (err) {
                      console.error('Failed to mark all as read:', err)
                    }
                    setNotifications((list) => list.map((n) => ({ ...n, read: true })))
                    store.markAllRead()
                  }}
                >
                  Mark all as read
                </Button>
                <Button size="small" type="link" onClick={() => navigate('/notifications')}>
                  View all
                </Button>
              </div>
            </div>
          }
        >
          <Button
            type="text"
            shape="circle"
            icon={
              <Badge count={unreadCount} showZero size="small" offset={[-2, 2]}>
                <BellOutlined
                  style={{ color: '#424744', fontSize: 20 }}
                  color="#424744"
                  size={20}
                  className="text-lg"
                />
              </Badge>
            }
            className="kb-admin-icon-button flex items-center justify-center"
          />
        </Popover>

        {/* User Profile Dropdown */}
        <Dropdown
          menu={{ items: menuItems, onClick: handleMenuClick }}
          placement="bottomRight"
          trigger={['click']}
        >
          <div className="kb-admin-profile flex items-center gap-3 cursor-pointer px-3 py-2 transition-colors">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-[#292d2b]">{name || 'Admin'}</p>
              <p className="text-xs text-[#727875] capitalize">{role || 'Administrator'}</p>
            </div>
            <Avatar size={40} className="kb-admin-avatar" icon={<UserOutlined />} />
          </div>
        </Dropdown>
      </div>
    </Header>
  )
}

export default HeaderBar
