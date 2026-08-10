import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationPreferences,
  useNotifications,
  useUnreadNotificationCount,
  useUpdateNotificationPreferences,
} from '@/api/notifications'
import { Bell, Settings } from 'lucide-react'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

const Notifications = () => {
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all')

  const { data: notificationsData, isLoading: notificationsLoading } = useNotifications({
    page: 1,
    limit: 100,
  })

  const { data: unreadCountData } = useUnreadNotificationCount()
  const unreadCount = unreadCountData?.count || 0

  const { data: preferencesData } = useNotificationPreferences()
  const preferences = preferencesData?.data || {
    orderUpdates: true,
    promotionalEmails: true,
    newsletter: false,
  }

  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()
  const updatePreferencesMutation = useUpdateNotificationPreferences()

  const notifications = notificationsData?.data || []
  const unreadNotifications = notifications.filter((n) => !n.read)
  const readNotifications = notifications.filter((n) => n.read)

  const handleMarkAsRead = (notificationId: string) => {
    markReadMutation.mutate(notificationId)
  }

  const handleMarkAllAsRead = () => {
    markAllReadMutation.mutate()
  }

  const handlePreferenceChange = (key: keyof typeof preferences, value: boolean) => {
    updatePreferencesMutation.mutate({
      [key]: value,
    })
  }

  const getDisplayNotifications = () => {
    switch (activeTab) {
      case 'unread':
        return unreadNotifications
      case 'read':
        return readNotifications
      default:
        return notifications
    }
  }

  const displayNotifications = getDisplayNotifications()

  return (
    <div className="space-y-6">
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
                {unreadCount > 0 && (
                  <Badge variant="default" className="ml-2">
                    {unreadCount} unread
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Manage your notifications and preferences</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreferencesOpen(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Preferences
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="all">
                  All
                  {notifications.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {notifications.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="unread">
                  Unread
                  {unreadNotifications.length > 0 && (
                    <Badge variant="default" className="ml-2">
                      {unreadNotifications.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="read">
                  Read
                  {readNotifications.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {readNotifications.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              {unreadNotifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllReadMutation.isPending}
                >
                  Mark all as read
                </Button>
              )}
            </div>

            <TabsContent value="all" className="mt-4">
              <NotificationList
                notifications={displayNotifications}
                isLoading={notificationsLoading}
                onMarkAsRead={handleMarkAsRead}
              />
            </TabsContent>

            <TabsContent value="unread" className="mt-4">
              <NotificationList
                notifications={displayNotifications}
                isLoading={notificationsLoading}
                onMarkAsRead={handleMarkAsRead}
              />
            </TabsContent>

            <TabsContent value="read" className="mt-4">
              <NotificationList
                notifications={displayNotifications}
                isLoading={notificationsLoading}
                onMarkAsRead={handleMarkAsRead}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Notification Preferences Modal */}
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notification Preferences</DialogTitle>
            <DialogDescription>
              Choose what notifications you want to receive
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Order Updates on email</p>
                <p className="text-sm text-gray-600">
                  Get notified about your order status and shipping updates
                </p>
              </div>
              <Checkbox
                checked={preferences.orderUpdates}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('orderUpdates', checked === true)
                }
                disabled={updatePreferencesMutation.isPending}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Promotional Emails</p>
                <p className="text-sm text-gray-600">
                  Receive special offers, discounts, and new product announcements
                </p>
              </div>
              <Checkbox
                checked={preferences.promotionalEmails}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('promotionalEmails', checked === true)
                }
                disabled={updatePreferencesMutation.isPending}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Newsletter</p>
                <p className="text-sm text-gray-600">Stay updated with our latest news and tips</p>
              </div>
              <Checkbox
                checked={preferences.newsletter}
                onCheckedChange={(checked) =>
                  handlePreferenceChange('newsletter', checked === true)
                }
                disabled={updatePreferencesMutation.isPending}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface NotificationListProps {
  notifications: Array<{
    _id: string
    title: string
    message: string
    type: string
    read: boolean
    createdAt: string
    link?: string
  }>
  isLoading: boolean
  onMarkAsRead: (id: string) => void
}

const NotificationList = ({ notifications, isLoading, onMarkAsRead }: NotificationListProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 border rounded-lg animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No notifications found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification._id}
          className={`p-4 border rounded-lg transition-colors cursor-pointer hover:bg-gray-50 ${
            !notification.read ? 'bg-blue-50 border-blue-200' : ''
          }`}
          onClick={() => {
            if (!notification.read) {
              onMarkAsRead(notification._id)
            }
            if (notification.link) {
              window.location.href = notification.link
            }
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className={`font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}
                >
                  {notification.title}
                </h3>
                {!notification.read && (
                  <Badge variant="default" className="h-2 w-2 p-0 rounded-full"></Badge>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
              <p className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default Notifications
