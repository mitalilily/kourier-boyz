import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/api/notifications'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuthStore } from '@/store/authStore'
import { formatDistanceToNow } from 'date-fns'
import {
  Bell,
  CheckCircle2,
  Info,
  Package,
  PackageCheck,
  PackageSearch,
  Sparkles,
  Truck,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface NotificationBellProps {
  isLightBg: boolean
  textClass: string
  isScrolled: boolean
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ isLightBg }) => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  // Fetch notifications from API
  const { data: notificationsData } = useNotifications({ page: 1, limit: 10 })
  const { data: unreadCountData } = useUnreadNotificationCount()
  const markReadMutation = useMarkNotificationRead()
  const markAllReadMutation = useMarkAllNotificationsRead()

  const notifications = notificationsData?.data || []
  const unreadCount = unreadCountData?.count || 0

  const handleMarkAsRead = (notificationId: string) => {
    markReadMutation.mutate(notificationId)
  }

  const handleMarkAllAsRead = () => {
    markAllReadMutation.mutate()
  }

  // Get icon based on notification type and title
  const getNotificationIcon = (type: string, title: string) => {
    if (type === 'order') {
      if (title.toLowerCase().includes('confirmed')) {
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      }
      if (title.toLowerCase().includes('ready') || title.toLowerCase().includes('pickup')) {
        return <PackageSearch className="h-4 w-4 text-blue-600" />
      }
      if (title.toLowerCase().includes('shipped')) {
        return <Truck className="h-4 w-4 text-purple-600" />
      }
      if (title.toLowerCase().includes('delivery') || title.toLowerCase().includes('out for')) {
        return <Package className="h-4 w-4 text-orange-600" />
      }
      if (title.toLowerCase().includes('delivered')) {
        return <PackageCheck className="h-4 w-4 text-green-600" />
      }
      if (title.toLowerCase().includes('cancelled')) {
        return <XCircle className="h-4 w-4 text-red-600" />
      }
      return <Package className="h-4 w-4 text-blue-600" />
    }
    if (type === 'promotional') {
      return <Sparkles className="h-4 w-4 text-yellow-600" />
    }
    return <Info className="h-4 w-4 text-gray-600" />
  }

  if (!isAuthenticated) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative group">
          <div
            className={`relative rounded-full p-2.5 cursor-pointer transition-all duration-300 shadow-md group-hover:shadow-lg group-hover:scale-110 ${
              isLightBg
                ? 'bg-linear-to-br text-white from-blue via-blue-light to-blue hover:from-blue-hover hover:via-blue hover:to-blue-dark'
                : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm border border-white/20'
            }`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold px-1 bg-red-500 text-white shadow-md">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0 shadow-xl border-gray-200" align="end">
        <div className="flex flex-col max-h-[500px] bg-white rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 bg-linear-to-r from-gray-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-base text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">{unreadCount} unread</p>
                  )}
                </div>
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllReadMutation.isPending}
                >
                  Mark all read
                </Button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <ScrollArea className="flex-1 max-h-[380px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <div className="p-4 bg-gray-100 rounded-full mb-4">
                  <Bell className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No notifications</p>
                <p className="text-xs text-gray-500 text-center">
                  You're all caught up! New notifications will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => {
                      if (!item.read) {
                        handleMarkAsRead(item._id)
                      }
                      if (item.link) {
                        navigate(item.link)
                      } else if (item.type === 'order') {
                        navigate('/profile/orders')
                      }
                    }}
                    className={`group relative px-5 py-4 cursor-pointer transition-all duration-200 ${
                      item.read
                        ? 'bg-white hover:bg-gray-50'
                        : 'bg-blue-50/50 hover:bg-blue-100/70 border-l-2 border-l-blue-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={`mt-0.5 shrink-0 p-2 rounded-lg ${
                          item.read
                            ? 'bg-gray-100 group-hover:bg-gray-200'
                            : 'bg-blue-100 group-hover:bg-blue-200'
                        } transition-colors`}
                      >
                        {getNotificationIcon(item.type, item.title)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p
                                className={`text-sm leading-snug ${
                                  item.read
                                    ? 'font-medium text-gray-700'
                                    : 'font-semibold text-gray-900'
                                }`}
                              >
                                {item.title}
                              </p>
                              {!item.read && (
                                <span className="shrink-0 w-2 h-2 bg-blue-500 rounded-full"></span>
                              )}
                            </div>
                            {item.message && (
                              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-2">
                                {item.message}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2.5">
                              <p className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                              </p>
                              {item.type === 'order' && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                                  Order
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                onClick={() => navigate('/profile/notifications')}
              >
                View all notifications
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
