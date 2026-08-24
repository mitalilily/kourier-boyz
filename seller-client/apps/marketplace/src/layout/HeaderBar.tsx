import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CompassOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  App,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Dropdown,
  Empty,
  Layout,
  List,
  Popover,
  Space,
  Tag,
  Tooltip,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { io as ioc } from 'socket.io-client'
import { useResendVerificationEmail } from '../api/authQueries'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../api/notificationQueries'
import FeedbackModal from '../components/FeedbackModal'
import { useAuthStore } from '../store/authStore'
import { type SellerNotification, useSellerNotificationStore } from '../store/notificationStore'
import { useSellerTourStore } from '../store/sellerTourStore'

const { Header } = Layout

interface HeaderBarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

const HeaderBar = ({ collapsed, setCollapsed }: HeaderBarProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const setRunTour = useSellerTourStore((state) => state.setRunTour)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const resendVerificationMutation = useResendVerificationEmail()

  // Fetch notifications from API
  const { data: apiNotificationsData } = useNotifications({ limit: 50 })
  const { data: unreadCountData } = useUnreadNotificationCount()
  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()

  // Get in-memory notifications from store (for real-time socket notifications)
  const storeNotifications = useSellerNotificationStore((state) => state.notifications)
  const addNotification = useSellerNotificationStore((state) => state.add)
  const markNotificationReadStore = useSellerNotificationStore((state) => state.markRead)
  const markAllNotificationsReadStore = useSellerNotificationStore((state) => state.markAllRead)
  const clearNotifications = useSellerNotificationStore((state) => state.clear)

  // Combine API notifications with store notifications
  const apiNotifications = apiNotificationsData?.data || []
  const allNotifications = [
    ...apiNotifications.map((n) => ({
      id: n._id,
      title: n.title,
      description: n.message,
      createdAt: n.createdAt,
      read: n.read,
      link: n.link
        ? {
            label: 'View Details',
            route: n.link,
          }
        : undefined,
    })),
    ...storeNotifications.filter((sn) => !apiNotifications.some((an) => an._id === sn.id)),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Use API unread count if available, otherwise calculate from combined notifications
  const unreadCount = unreadCountData?.count ?? allNotifications.filter((n) => !n.read).length

  // Use combined notifications for display (allNotifications is already defined above)

  // Handler to mark notification as read
  const handleMarkRead = async (id: string) => {
    // Mark in API if it's an API notification
    if (apiNotifications.some((n) => n._id === id)) {
      try {
        await markReadMutation.mutateAsync(id)
      } catch (err) {
        console.error('Failed to mark notification as read in API:', err)
      }
    }
    // Always mark in store for immediate UI update
    markNotificationReadStore(id)
  }

  // Handler to mark all as read
  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync()
    } catch (err) {
      console.error('Failed to mark all as read in API:', err)
    }
    // Also mark in store
    markAllNotificationsReadStore()
  }

  const pushNotification = useCallback(
    (notification: Partial<SellerNotification> & { title: string }) => {
      addNotification({
        id: notification.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: notification.title,
        description: notification.description,
        createdAt: notification.createdAt ?? new Date().toISOString(),
        read: notification.read ?? false,
        link: notification.link,
      })
    },
    [addNotification],
  )

  const formatCertificateLabel = (certificateType?: string) =>
    (certificateType || '')
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!user?.id) return

    const base = import.meta.env.VITE_API_ROOT_URL || 'http://localhost:5004'
    const socket = ioc(base, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })

    // Wait for connection before registering
    socket.on('connect', () => {
      console.log('[Socket] Connected, registering seller:', user.id)
      socket.emit('register', { userId: user.id, role: 'seller' })
    })

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error)
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason)
    })

    // Subscribe to personal updates after login if user exists
    if (user?.id) {
      socket.on('categoryRequest:update', (payload: { status: string; adminNote?: string }) => {
        pushNotification({
          title: 'Category Request Update',
          description: `${payload.status.toUpperCase()}${
            payload.adminNote ? ' - ' + payload.adminNote : ''
          }`,
          createdAt: new Date().toISOString(),
        })
      })
      socket.on(
        'notice:new',
        (payload: { productId: string; reason: string; createdAt: string }) => {
          pushNotification({
            id: `notice-new-${payload.productId}-${Date.now()}`,
            title: 'Admin Notice on Product',
            description: payload.reason,
            createdAt: payload.createdAt || new Date().toISOString(),
          })
        },
      )
      socket.on('notice:resolved', (payload: { productId: string; resolvedAt: string }) => {
        pushNotification({
          id: `notice-resolved-${payload.productId}-${payload.resolvedAt ?? Date.now()}`,
          title: 'Notice Resolved',
          description: 'Admin resolved a notice on your product',
          createdAt: payload.resolvedAt || new Date().toISOString(),
        })
      })
      socket.on(
        'inventory:low',
        (payload: { productId: string; stock: number; threshold: number }) => {
          pushNotification({
            id: `inventory-low-${payload.productId}-${Date.now()}`,
            title: 'Low Stock Alert',
            description: `Stock ${payload.stock} is at/below threshold ${payload.threshold}`,
            createdAt: new Date().toISOString(),
          })
        },
      )
      socket.on('notice:addressed', (payload: { productId: string; addressedAt: string }) => {
        pushNotification({
          id: `notice-addressed-${payload.productId}-${payload.addressedAt ?? Date.now()}`,
          title: 'Notice Addressed',
          description: 'You marked an admin notice as addressed',
          createdAt: payload.addressedAt || new Date().toISOString(),
        })
      })
      // Listen for system notifications (ledger, settlements, etc.)
      socket.on(
        'notification:new',
        (payload: {
          id: string
          title: string
          message: string
          type?: string
          link?: string
          createdAt: string
          read?: boolean
        }) => {
          pushNotification({
            id: payload.id,
            title: payload.title,
            description: payload.message,
            createdAt: payload.createdAt || new Date().toISOString(),
            read: payload.read || false,
            link: payload.link
              ? {
                  label: 'View Details',
                  route: payload.link,
                }
              : undefined,
          })
        },
      )
      socket.on(
        'certificate:update',
        (payload: {
          certificateId?: string
          certificateType?: string
          status?: string
          message?: string
          triggeredAt?: string
        }) => {
          const label = formatCertificateLabel(payload.certificateType)
          const statusLabel = (payload.status || '')
            .toLowerCase()
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
          pushNotification({
            id: `certificate-update-${payload.certificateId || Date.now()}-${
              payload.status || 'update'
            }`,
            title: 'Certificate Update',
            description:
              payload.message ||
              `${label ? `${label} ` : ''}${statusLabel ? `status: ${statusLabel}` : 'updated'}`,
            createdAt: payload.triggeredAt || new Date().toISOString(),
          })
        },
      )
      socket.on(
        'certificate:reminder',
        (payload: {
          certificateId?: string
          certificateType?: string
          reminderType?: string
          daysRemaining?: number
          message?: string
          triggeredAt?: string
        }) => {
          const label = formatCertificateLabel(payload.certificateType)
          pushNotification({
            id: `certificate-reminder-${payload.certificateId || Date.now()}-${
              payload.reminderType || 'reminder'
            }`,
            title: 'Certificate Reminder',
            description:
              payload.message ||
              `${label ? `${label} ` : 'A certificate '}expires in ${
                payload.daysRemaining ?? 'soon'
              } day${payload.daysRemaining === 1 ? '' : 's'}.`,
            createdAt: payload.triggeredAt || new Date().toISOString(),
          })
        },
      )

      // Order & shipment notifications
      socket.on(
        'order:new',
        (payload: {
          orderId: string
          orderNumber?: string
          buyerName?: string
          total?: number
          paymentMethod?: string
          paymentStatus?: string
          createdAt?: string
        }) => {
          console.log('[Socket] Received order:new event:', payload)
          pushNotification({
            id: `order-new-${payload.orderId}-${Date.now()}`,
            title: 'New Order Received',
            description: `Order ${payload.orderNumber || payload.orderId || ''}${
              payload.buyerName ? ` from ${payload.buyerName}` : ''
            }${payload.total ? ` - ₹${payload.total}` : ''}`,
            createdAt: payload.createdAt || new Date().toISOString(),
            link: {
              label: 'View Orders',
              route: '/orders',
            },
          })
        },
      )

      socket.on(
        'order:awb_generated',
        (payload: { orderId: string; orderNumber?: string; awb?: string; shipmentId?: string }) => {
          pushNotification({
            id: `order-awb-${payload.orderId}-${payload.shipmentId ?? 'default'}`,
            title: 'Shipping Label Ready',
            description: `AWB ${payload.awb || ''} generated for order ${
              payload.orderNumber || ''
            }`,
            createdAt: new Date().toISOString(),
            link: {
              label: 'View Shipment',
              route: '/orders',
            },
          })
        },
      )

      socket.on('order:pickup_done', (payload: { orderId: string; orderNumber?: string }) => {
        pushNotification({
          id: `order-pickup-${payload.orderId}-${Date.now()}`,
          title: 'Courier Pickup Confirmed',
          description: `Pickup confirmed for order ${payload.orderNumber || ''}`,
          createdAt: new Date().toISOString(),
        })
      })

      socket.on('order:out_for_delivery', (payload: { orderId: string; orderNumber?: string }) => {
        pushNotification({
          id: `order-ofd-${payload.orderId}-${Date.now()}`,
          title: 'Order Out for Delivery',
          description: `Order ${payload.orderNumber || ''} is out for delivery`,
          createdAt: new Date().toISOString(),
        })
      })

      socket.on('order:delivered', (payload: { orderId: string; orderNumber?: string }) => {
        pushNotification({
          id: `order-delivered-${payload.orderId}-${Date.now()}`,
          title: 'Order Delivered',
          description: `Order ${payload.orderNumber || ''} has been delivered`,
          createdAt: new Date().toISOString(),
        })
      })

      socket.on(
        'order:exception',
        (payload: { orderId: string; orderNumber?: string; reason?: string }) => {
          pushNotification({
            id: `order-exception-${payload.orderId}-${Date.now()}`,
            title: 'Delivery Exception / RTO',
            description: `Issue reported for order ${payload.orderNumber || ''}${
              payload.reason ? ` (${payload.reason})` : ''
            }`,
            createdAt: new Date().toISOString(),
            link: {
              label: 'Review Order',
              route: '/orders',
            },
          })
        },
      )
    }
    return () => {
      console.log('[Socket] Cleaning up socket connection')
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
      socket.off('order:new')
      socket.off('order:awb_generated')
      socket.off('order:pickup_done')
      socket.off('order:out_for_delivery')
      socket.off('order:delivered')
      socket.off('order:exception')
      socket.off('categoryRequest:update')
      socket.off('notice:new')
      socket.off('notice:resolved')
      socket.off('notice:addressed')
      socket.off('inventory:low')
      socket.off('certificate:update')
      socket.off('certificate:reminder')
      socket.off('notification:new')
      socket.close()
    }
  }, [user?.id, pushNotification])

  const userMenuItems = [
    {
      key: 'profile',
      label: 'My Profile',
      icon: <UserOutlined />,
      onClick: () => navigate('/profile'),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <SettingOutlined />,
      disabled: true,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'feedback',
      label: 'Send Feedback',
      icon: <MessageOutlined />,
      onClick: () => setShowFeedbackModal(true),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
      danger: true,
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  // Generate breadcrumbs from pathname
  const pathSnippets = location.pathname.split('/').filter((i) => i)
  const breadcrumbItems = [
    {
      title: 'Home',
      href: '/dashboard',
    },
    ...pathSnippets.map((snippet, index) => {
      const url = `/${pathSnippets.slice(0, index + 1).join('/')}`
      const isLast = index === pathSnippets.length - 1

      // Format the snippet for better display
      const formattedTitle = snippet
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      return {
        title: formattedTitle,
        href: !isLast ? url : undefined,
      }
    }),
  ]

  return (
    <Header
      data-tour="seller-header"
      style={{
        background: '#fff',
        padding: isMobile ? '0 8px' : '0 16px',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        position: 'sticky',
        top: 0,
        zIndex: 99,
        boxShadow: 'none',
      }}
    >
      {/* Left side - Mobile Menu Button & Breadcrumb */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          paddingRight: isMobile ? 8 : 16,
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? 8 : 12,
          overflow: 'hidden',
        }}
      >
        {/* Mobile Hamburger Menu */}
        <Button
          type="text"
          icon={<MenuOutlined style={{ fontSize: 20 }} />}
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: isMobile ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 40,
            height: 40,
            fontSize: 20,
            color: '#000',
            flexShrink: 0,
          }}
        />
        {/* Breadcrumb - Hide on mobile, show only last item */}
        {!isMobile && (
          <Breadcrumb
            items={breadcrumbItems}
            style={{ lineHeight: '64px', flex: 1, overflow: 'hidden' }}
          />
        )}
        {isMobile && breadcrumbItems.length > 0 && (
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: '#000',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {breadcrumbItems[breadcrumbItems.length - 1]?.title || 'Home'}
          </span>
        )}
      </div>

      {/* Right side - Actions */}
      <Space
        size={isMobile ? 'small' : 'middle'}
        wrap={false}
        align="center"
        style={{ flexShrink: 0 }}
      >
        {/* Email verification reminder for sellers */}
        {user?.role === 'seller' && !user.isEmailVerified && (
          <Space size="small">
            {!isMobile && <Tag color="warning">Email not verified</Tag>}
            <Button
              size={isMobile ? 'small' : 'middle'}
              type="default"
              loading={resendVerificationMutation.isPending}
              onClick={async () => {
                if (!user.email) {
                  message.error('No email found for this account.')
                  return
                }
                try {
                  await resendVerificationMutation.mutateAsync(user.email)
                  message.success('Verification email sent. Please check your inbox.')
                } catch (e: unknown) {
                  const apiError =
                    (e as { response?: { data?: { error?: string; message?: string } } })?.response
                      ?.data?.error ||
                    (e as { response?: { data?: { error?: string; message?: string } } })?.response
                      ?.data?.message ||
                    (e as { message?: string })?.message ||
                    'Failed to send verification email.'
                  message.error(apiError)
                }
              }}
            >
              Verify Email
            </Button>
          </Space>
        )}
        {/* Platform tour - See tour again (approved sellers only) */}
        {user?.isApproved && (
          <Tooltip title="See platform tour">
            <Button
              type="text"
              icon={<CompassOutlined />}
              onClick={() => {
                navigate('/dashboard')
                setRunTour(true)
              }}
              style={{ color: '#595959' }}
              size={isMobile ? 'small' : 'middle'}
            >
              {!isMobile && 'Tour'}
            </Button>
          </Tooltip>
        )}
        {/* Quick Actions - Only show when approved, hide on mobile */}
        {user?.isApproved && !isMobile && (
          <Tooltip title="Quick Actions">
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'add-product',
                    label: 'Add New Product',
                    icon: <PlusOutlined />,
                    onClick: () => navigate('/products/new'),
                  },
                  {
                    key: 'manage-products',
                    label: 'Manage Products',
                    icon: <AppstoreOutlined />,
                    onClick: () => navigate('/products'),
                  },
                  {
                    type: 'divider',
                  },
                  {
                    key: 'orders',
                    label: 'View Orders',
                    icon: <ShoppingOutlined />,
                    onClick: () => {
                      message.info('Orders page coming soon')
                    },
                  },
                  {
                    key: 'analytics',
                    label: 'Analytics',
                    icon: <BarChartOutlined />,
                    onClick: () => {
                      message.info('Analytics page coming soon')
                    },
                  },
                  {
                    key: 'reports',
                    label: 'Reports',
                    icon: <FileTextOutlined />,
                    onClick: () => {
                      message.info('Reports page coming soon')
                    },
                  },
                ],
              }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                shape="circle"
                size="large"
                className="hide-mobile"
                style={{
                  background: '#DFB743',
                  border: 'none',
                }}
              />
            </Dropdown>
          </Tooltip>
        )}

        {/* Approval Status Badge - Hide on mobile */}
        {!isMobile && (
          <div>
            {user?.isApproved ? (
              <Tag
                color="success"
                style={{
                  margin: 0,
                  borderRadius: 10,
                  padding: '4px 12px',
                  background: '#f6ffed',
                  borderColor: '#b7eb8f',
                  color: '#52c41a',
                }}
              >
                ✓ Verified Seller
              </Tag>
            ) : (
              <Tag
                color="warning"
                style={{
                  margin: 0,
                  borderRadius: 10,
                  padding: '4px 12px',
                  background: '#fffce6',
                  borderColor: '#ffeeb3',
                  color: '#DFB743',
                }}
              >
                ⏳ Pending Approval
              </Tag>
            )}
          </div>
        )}

        {/* Help Button - Hide on mobile */}
        {!isMobile && (
          <Tooltip title="Help & Support">
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              shape="circle"
              size="large"
              style={{
                color: '#DFB743',
              }}
            />
          </Tooltip>
        )}

        {/* Notifications */}
        <Popover
          placement="bottomRight"
          trigger={['click']}
          content={
            <div
              style={{
                width: isMobile ? 280 : 320,
                maxHeight: 400,
                overflowY: 'auto',
              }}
            >
              {allNotifications.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No new notifications" />
              ) : (
                <List
                  dataSource={allNotifications.slice(0, 10)}
                  renderItem={(item) => (
                    <List.Item
                      onClick={async () => {
                        if (item.id) {
                          await handleMarkRead(item.id)
                        }
                        if (item.link?.route) {
                          navigate(item.link.route)
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        background: item.read ? undefined : '#f6ffed',
                        padding: '12px 16px',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <span
                            style={{
                              fontWeight: item.read ? 400 : 600,
                              fontSize: 14,
                              color: item.read ? '#666' : '#000',
                            }}
                          >
                            {item.title}
                          </span>
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
                            <span
                              style={{
                                color: '#999',
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                }}
              >
                <Button
                  size="small"
                  onClick={handleMarkAllRead}
                  loading={markAllReadMutation.isPending}
                >
                  Mark all as read
                </Button>
                <Button size="small" danger onClick={() => clearNotifications()}>
                  Clear
                </Button>
              </div>
            </div>
          }
        >
          <Badge count={unreadCount} showZero size={isMobile ? 'small' : 'default'}>
            <Button
              type="text"
              icon={<BellOutlined />}
              shape="circle"
              size={isMobile ? 'middle' : 'large'}
              style={{
                minWidth: isMobile ? 32 : 40,
                height: isMobile ? 32 : 40,
              }}
            />
          </Badge>
        </Popover>

        {/* Send Feedback Button */}
        <Button
          type="text"
          icon={<MessageOutlined />}
          onClick={() => setShowFeedbackModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            height: isMobile ? 32 : 40,
            padding: isMobile ? '4px 8px' : '6px 12px',
            color: '#faad14',
          }}
        >
          {!isMobile && <span style={{ color: '#DFB743' }}>Feedback</span>}
        </Button>

        {/* User Dropdown */}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 6 : 10,
              cursor: 'pointer',
              padding: isMobile ? '4px 8px' : '6px 12px',
              borderRadius: 8,
              transition: 'background 0.2s',
              border: '1px solid #f0f0f0',
              maxWidth: isMobile ? 120 : 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f5f5'
              e.currentTarget.style.borderColor = '#d9d9d9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = '#f0f0f0'
            }}
          >
            <Avatar
              size={isMobile ? 28 : 36}
              icon={<UserOutlined />}
              style={{
                background: '#4F5552',
                flexShrink: 0,
              }}
            />
            {!isMobile && (
              <div style={{ textAlign: 'left' }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#000',
                    lineHeight: '18px',
                  }}
                >
                  {user?.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#999',
                    lineHeight: '16px',
                    maxWidth: 150,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.email}
                </div>
              </div>
            )}
          </div>
        </Dropdown>
      </Space>
      <FeedbackModal open={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
    </Header>
  )
}

export default HeaderBar
