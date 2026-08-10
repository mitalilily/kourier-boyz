import {
  BellOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ShoppingOutlined,
  TagOutlined,
} from '@ant-design/icons'
import { App, Badge, Button, Card, Empty, Radio, Space, Spin, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../api/notificationQueries'
import { useNotificationStore } from '../store/notificationStore'

dayjs.extend(relativeTime)

const { Title, Text } = Typography

type FilterType = 'all' | 'unread' | 'read'

interface AdminNotification {
  id: string
  title: string
  description?: string
  createdAt: string
  read?: boolean
  type?: string
  link?: string
  action?: {
    label: string
    onClickRoute?: string
    href?: string
  }
}

const getNotificationIcon = (type?: string) => {
  switch (type) {
    case 'order':
      return <ShoppingOutlined style={{ fontSize: 22, color: '#2563eb' }} />
    case 'system':
      return <InfoCircleOutlined style={{ fontSize: 22, color: '#10b981' }} />
    case 'promotional':
      return <TagOutlined style={{ fontSize: 22, color: '#f59e0b' }} />
    default:
      return <BellOutlined style={{ fontSize: 22, color: '#6b7280' }} />
  }
}

const getNotificationColor = (type?: string) => {
  switch (type) {
    case 'order':
      return { bg: '#eff6ff', border: '#3b82f6', iconBg: '#dbeafe' }
    case 'system':
      return { bg: '#f0fdf4', border: '#10b981', iconBg: '#d1fae5' }
    case 'promotional':
      return { bg: '#fffbeb', border: '#f59e0b', iconBg: '#fef3c7' }
    default:
      return { bg: '#f9fafb', border: '#9ca3af', iconBg: '#f3f4f6' }
  }
}

const NotificationsPage = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [filter, setFilter] = useState<FilterType>('all')
  const { data: notificationsData, isLoading } = useNotifications({ limit: 100 })
  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()

  // Also get in-memory notifications from store (for real-time socket notifications)
  const storeNotifications = useNotificationStore((state) => state.notifications)
  const markReadStore = useNotificationStore((state) => state.markRead)
  const markAllReadStore = useNotificationStore((state) => state.markAllRead)

  // Combine API notifications with store notifications
  const apiNotifications = notificationsData?.data || []
  const allNotifications: AdminNotification[] = [
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
    ...storeNotifications.map((sn) => ({
      id: sn.id,
      title: sn.title,
      description: sn.description,
      createdAt: sn.createdAt,
      read: sn.read,
      action: sn.action,
    })),
  ]
    .filter(
      (n, index, self) => index === self.findIndex((t) => t.id === n.id), // Remove duplicates
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Filter notifications
  const filteredNotifications =
    filter === 'all'
      ? allNotifications
      : filter === 'unread'
      ? allNotifications.filter((n) => !n.read)
      : allNotifications.filter((n) => n.read)

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((acc, notification) => {
    const date = dayjs(notification.createdAt)
    const today = dayjs().startOf('day')
    const yesterday = today.subtract(1, 'day')

    let groupKey: string
    if (date.isSame(today, 'day')) {
      groupKey = 'Today'
    } else if (date.isSame(yesterday, 'day')) {
      groupKey = 'Yesterday'
    } else if (date.isAfter(today.subtract(7, 'day'))) {
      groupKey = 'This Week'
    } else if (date.isAfter(today.subtract(30, 'day'))) {
      groupKey = 'This Month'
    } else {
      groupKey = date.format('MMMM YYYY')
    }

    if (!acc[groupKey]) {
      acc[groupKey] = []
    }
    acc[groupKey].push(notification)
    return acc
  }, {} as Record<string, AdminNotification[]>)

  const handleMarkRead = async (id: string) => {
    // Mark in API if it's an API notification
    if (apiNotifications.some((n) => n._id === id)) {
      try {
        await markReadMutation.mutateAsync(id)
      } catch (err) {
        console.error('Failed to mark notification as read:', err)
      }
    } else {
      // Mark in store
      markReadStore(id)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync()
      markAllReadStore()
      message.success('All notifications marked as read')
    } catch (err) {
      console.error('Failed to mark all as read:', err)
      message.error('Failed to mark all as read')
    }
  }

  const handleNotificationClick = async (notification: AdminNotification) => {
    if (!notification.read && notification.id) {
      await handleMarkRead(notification.id)
    }

    // Navigate based on notification type or action
    if (notification.action?.onClickRoute) {
      navigate(notification.action.onClickRoute)
    } else if (notification.action?.href) {
      window.location.href = notification.action.href
    } else if (notification.link) {
      navigate(notification.link)
    } else if (notification.id.startsWith('notice:') && notification.id.includes('productId')) {
      const productId = notification.id.split(':')[2]
      if (productId) {
        navigate(`/products/${productId}`)
      }
    } else if (notification.title === 'New Category Request') {
      navigate('/categories?tab=requests')
    }
  }

  const unreadCount = allNotifications.filter((n) => !n.read).length

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#6b7280' }}>Loading notifications...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1400, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header Section */}
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          }}
          bodyStyle={{ padding: '32px' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div style={{ color: 'white' }}>
              <Title
                level={2}
                style={{
                  margin: 0,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <BellOutlined style={{ fontSize: 32 }} />
                Notifications
                {unreadCount > 0 && (
                  <Badge
                    count={unreadCount}
                    style={{
                      backgroundColor: '#ef4444',
                      marginLeft: 8,
                    }}
                  />
                )}
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
                Stay updated with system alerts, orders, and important updates
              </Text>
            </div>
            {unreadCount > 0 && (
              <Button
                type="primary"
                size="large"
                icon={<CheckCircleOutlined />}
                onClick={handleMarkAllRead}
                loading={markAllReadMutation.isPending}
                style={{
                  backgroundColor: 'white',
                  color: '#667eea',
                  border: 'none',
                  fontWeight: 600,
                  height: 48,
                }}
              >
                Mark all as read
              </Button>
            )}
          </div>
        </Card>

        {/* Filter Tabs */}
        <Card
          bodyStyle={{ padding: '16px 24px' }}
          style={{
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            border: '1px solid #e5e7eb',
          }}
        >
          <Radio.Group
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            buttonStyle="solid"
            size="large"
            style={{ width: '100%', display: 'flex' }}
          >
            <Radio.Button
              value="all"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              All ({allNotifications.length})
            </Radio.Button>
            <Radio.Button
              value="unread"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Unread ({unreadCount})
            </Radio.Button>
            <Radio.Button
              value="read"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Read ({allNotifications.length - unreadCount})
            </Radio.Button>
          </Radio.Group>
        </Card>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Card
            style={{
              borderRadius: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              textAlign: 'center',
              padding: '80px 20px',
              border: '1px solid #e5e7eb',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: 18, fontWeight: 500 }}>
                    {filter === 'unread'
                      ? 'No unread notifications'
                      : filter === 'read'
                      ? 'No read notifications'
                      : 'No notifications yet'}
                  </Text>
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      {filter === 'unread'
                        ? "You're all caught up! 🎉"
                        : "You'll see notifications here when there's activity"}
                    </Text>
                  </div>
                </div>
              }
            />
          </Card>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {Object.entries(groupedNotifications).map(([groupKey, notifications]) => (
              <div key={groupKey}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                    marginTop: groupKey !== Object.keys(groupedNotifications)[0] ? 24 : 0,
                  }}
                >
                  <div
                    style={{
                      height: 2,
                      flex: 1,
                      backgroundColor: '#e5e7eb',
                      borderRadius: 1,
                    }}
                  />
                  <Text
                    strong
                    style={{
                      fontSize: 13,
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      fontWeight: 600,
                      padding: '0 16px',
                    }}
                  >
                    {groupKey}
                  </Text>
                  <div
                    style={{
                      height: 2,
                      flex: 1,
                      backgroundColor: '#e5e7eb',
                      borderRadius: 1,
                    }}
                  />
                </div>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {notifications.map((notification) => {
                    const colors = getNotificationColor(notification.type)
                    return (
                      <Card
                        key={notification.id}
                        hoverable={!!(notification.link || notification.action)}
                        onClick={() => handleNotificationClick(notification)}
                        style={{
                          borderRadius: 16,
                          boxShadow: notification.read
                            ? '0 2px 8px rgba(0,0,0,0.06)'
                            : '0 4px 16px rgba(0,0,0,0.1)',
                          border: notification.read
                            ? `1px solid #e5e7eb`
                            : `2px solid ${colors.border}`,
                          cursor: notification.link || notification.action ? 'pointer' : 'default',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          backgroundColor: notification.read ? '#ffffff' : colors.bg,
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                        bodyStyle={{ padding: '24px' }}
                        onMouseEnter={(e) => {
                          if (notification.link || notification.action) {
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (notification.link || notification.action) {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = notification.read
                              ? '0 2px 8px rgba(0,0,0,0.06)'
                              : '0 4px 16px rgba(0,0,0,0.1)'
                          }
                        }}
                      >
                        {!notification.read && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 4,
                              backgroundColor: colors.border,
                            }}
                          />
                        )}
                        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                          {/* Icon */}
                          <div
                            style={{
                              width: 56,
                              height: 56,
                              borderRadius: 14,
                              backgroundColor: notification.read ? '#f3f4f6' : colors.iconBg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              boxShadow: notification.read ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                              transition: 'all 0.2s',
                            }}
                          >
                            {getNotificationIcon(notification.type)}
                          </div>

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: 10,
                                gap: 12,
                              }}
                            >
                              <Title
                                level={5}
                                style={{
                                  margin: 0,
                                  fontWeight: notification.read ? 500 : 700,
                                  color: notification.read ? '#6b7280' : '#111827',
                                  fontSize: 17,
                                  lineHeight: 1.4,
                                }}
                              >
                                {notification.title}
                              </Title>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                {!notification.read && (
                                  <Badge
                                    dot
                                    style={{
                                      backgroundColor: '#ef4444',
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                                {notification.read && (
                                  <CheckCircleOutlined
                                    style={{
                                      color: '#10b981',
                                      fontSize: 18,
                                    }}
                                  />
                                )}
                              </div>
                            </div>

                            {notification.description && (
                              <Text
                                style={{
                                  fontSize: 15,
                                  color: '#4b5563',
                                  lineHeight: 1.6,
                                  display: 'block',
                                  marginBottom: 16,
                                }}
                              >
                                {notification.description}
                              </Text>
                            )}

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  gap: 12,
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                }}
                              >
                                <Text type="secondary" style={{ fontSize: 13 }}>
                                  {dayjs(notification.createdAt).format('DD MMM YYYY, hh:mm A')}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 13 }}>
                                  • {dayjs(notification.createdAt).fromNow()}
                                </Text>
                                {notification.action && (
                                  <Tag
                                    color="blue"
                                    icon={<FileTextOutlined />}
                                    style={{
                                      margin: 0,
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      padding: '4px 12px',
                                      borderRadius: 6,
                                    }}
                                  >
                                    {notification.action.label}
                                  </Tag>
                                )}
                                {notification.link && !notification.action && (
                                  <Tag
                                    color="blue"
                                    icon={<FileTextOutlined />}
                                    style={{
                                      margin: 0,
                                      cursor: 'pointer',
                                      fontSize: 12,
                                      padding: '4px 12px',
                                      borderRadius: 6,
                                    }}
                                  >
                                    View Details
                                  </Tag>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </Space>
              </div>
            ))}
          </Space>
        )}
      </Space>
    </div>
  )
}

export default NotificationsPage
