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
import { useSellerNotificationStore } from '../store/notificationStore'
import type { SellerNotification } from '../store/notificationStore'

dayjs.extend(relativeTime)

const { Title, Text } = Typography

type FilterType = 'all' | 'unread' | 'read'
type NotificationItem = SellerNotification & { type?: string }

const getNotificationIcon = (type?: string) => {
  switch (type) {
    case 'order':
      return <ShoppingOutlined style={{ fontSize: 20, color: '#1353A4' }} />
    case 'system':
      return <InfoCircleOutlined style={{ fontSize: 20, color: '#10b981' }} />
    case 'promotional':
      return <TagOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
    default:
      return <BellOutlined style={{ fontSize: 20, color: '#6b7280' }} />
  }
}

const getNotificationColor = (type?: string) => {
  switch (type) {
    case 'order':
      return '#dbeafe'
    case 'system':
      return '#d1fae5'
    case 'promotional':
      return '#fef3c7'
    default:
      return '#f3f4f6'
  }
}

const SellerNotifications = () => {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [filter, setFilter] = useState<FilterType>('all')
  const { data: notificationsData, isLoading } = useNotifications({ limit: 100 })
  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()

  // Also get in-memory notifications from store (for real-time socket notifications)
  const storeNotifications = useSellerNotificationStore((state) => state.notifications)
  const markReadStore = useSellerNotificationStore((state) => state.markRead)
  const markAllReadStore = useSellerNotificationStore((state) => state.markAllRead)

  // Combine API notifications with store notifications
  const apiNotifications = notificationsData?.data || []
  const allNotifications: NotificationItem[] = [
    ...apiNotifications.map((n) => ({
      id: n._id,
      title: n.title,
      description: n.message,
      createdAt: n.createdAt,
      read: n.read,
      type: n.type,
      link: n.link
        ? {
            label: 'View Details',
            route: n.link,
          }
        : undefined,
    })),
    ...storeNotifications.filter(
      (sn) => !apiNotifications.some((an) => an._id === sn.id),
    ),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Filter notifications
  const filteredNotifications =
    filter === 'all'
      ? allNotifications
      : filter === 'unread'
        ? allNotifications.filter((n) => !n.read)
        : allNotifications.filter((n) => n.read)

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce(
    (acc, notification) => {
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
    },
    {} as Record<string, NotificationItem[]>,
  )

  const handleMarkRead = async (id: string) => {
    // Mark in API if it's an API notification
    if (apiNotifications.some((n) => n._id === id)) {
      try {
        await markReadMutation.mutateAsync(id)
        message.success('Notification marked as read')
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

  const handleNotificationClick = async (notification: SellerNotification) => {
    if (!notification.read && notification.id) {
      await handleMarkRead(notification.id)
    }
    if (notification.link?.route) {
      navigate(notification.link.route)
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
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
              <BellOutlined style={{ fontSize: 28, color: '#1353A4' }} />
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
            <Text type="secondary" style={{ fontSize: 14 }}>
              Stay updated with your account activity, orders, and settlements
            </Text>
          </div>
          {unreadCount > 0 && (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleMarkAllRead}
              loading={markAllReadMutation.isPending}
            >
              Mark all as read
            </Button>
          )}
        </div>

        {/* Filter Tabs */}
        <Card
          bodyStyle={{ padding: '12px 16px' }}
          style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
        >
          <Radio.Group
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            buttonStyle="solid"
            style={{ width: '100%' }}
          >
            <Radio.Button value="all" style={{ flex: 1, textAlign: 'center' }}>
              All ({allNotifications.length})
            </Radio.Button>
            <Radio.Button value="unread" style={{ flex: 1, textAlign: 'center' }}>
              Unread ({unreadCount})
            </Radio.Button>
            <Radio.Button value="read" style={{ flex: 1, textAlign: 'center' }}>
              Read ({allNotifications.length - unreadCount})
            </Radio.Button>
          </Radio.Group>
        </Card>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              textAlign: 'center',
              padding: '60px 20px',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary" style={{ fontSize: 16 }}>
                    {filter === 'unread'
                      ? 'No unread notifications'
                      : filter === 'read'
                        ? 'No read notifications'
                        : 'No notifications yet'}
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 14 }}>
                      {filter === 'unread'
                        ? 'You\'re all caught up! 🎉'
                        : 'You\'ll see notifications here when there\'s activity on your account'}
                    </Text>
                  </div>
                </div>
              }
            />
          </Card>
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {Object.entries(groupedNotifications).map(([groupKey, notifications]) => (
              <div key={groupKey}>
                <Text
                  strong
                  style={{
                    fontSize: 14,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 12,
                    display: 'block',
                  }}
                >
                  {groupKey}
                </Text>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {notifications.map((notification) => (
                    <Card
                      key={notification.id}
                      hoverable={!!notification.link}
                      onClick={() => handleNotificationClick(notification)}
                      style={{
                        borderRadius: 12,
                        boxShadow: notification.read
                          ? '0 2px 8px rgba(0,0,0,0.06)'
                          : '0 4px 12px rgba(19, 83, 164, 0.15)',
                        border: notification.read ? '1px solid #e5e7eb' : '1px solid #1353A4',
                        cursor: notification.link ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                        backgroundColor: notification.read
                          ? '#ffffff'
                          : getNotificationColor(notification.type),
                      }}
                      bodyStyle={{ padding: '20px' }}
                    >
                      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                        {/* Icon */}
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            backgroundColor: notification.read ? '#f3f4f6' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            boxShadow: notification.read ? 'none' : '0 2px 4px rgba(0,0,0,0.1)',
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
                              marginBottom: 8,
                              gap: 12,
                            }}
                          >
                            <Title
                              level={5}
                              style={{
                                margin: 0,
                                fontWeight: notification.read ? 500 : 600,
                                color: notification.read ? '#6b7280' : '#111827',
                                fontSize: 16,
                              }}
                            >
                              {notification.title}
                            </Title>
                            {!notification.read && (
                              <Badge
                                dot
                                style={{
                                  backgroundColor: '#ef4444',
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </div>

                          <Text
                            style={{
                              fontSize: 14,
                              color: '#4b5563',
                              lineHeight: 1.6,
                              display: 'block',
                              marginBottom: 12,
                            }}
                          >
                            {notification.description}
                          </Text>

                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {dayjs(notification.createdAt).format('DD MMM YYYY, hh:mm A')}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                • {dayjs(notification.createdAt).fromNow()}
                              </Text>
                              {notification.link && (
                                <Tag
                                  color="blue"
                                  icon={<FileTextOutlined />}
                                  style={{ margin: 0, cursor: 'pointer' }}
                                >
                                  {notification.link.label || 'View Details'}
                                </Tag>
                              )}
                            </div>
                            {notification.read && (
                              <Tag
                                color="default"
                                icon={<CheckCircleOutlined />}
                                style={{ margin: 0, fontSize: 11 }}
                              >
                                Read
                              </Tag>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </Space>
              </div>
            ))}
          </Space>
        )}
      </Space>
    </div>
  )
}

export default SellerNotifications
