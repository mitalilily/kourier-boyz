import {
  AppstoreAddOutlined,
  ClockCircleOutlined,
  RightOutlined,
  RollbackOutlined,
  ShoppingOutlined,
  StarOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Badge, Button, Card, Empty, List, Space, Spin, Tooltip } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useNavigate } from 'react-router-dom'
import type { PendingActionItem, PendingActionsData } from '../../api/dashboard'

dayjs.extend(relativeTime)

interface QuickActionsProps {
  data?: PendingActionsData
  loading?: boolean
}

interface ActionCardProps {
  title: string
  count: number
  icon: React.ReactNode
  color: string
  bgColor: string
  items: PendingActionItem[]
  onViewAll: () => void
  renderItem: (item: PendingActionItem) => React.ReactNode
}

const ActionCard = ({
  title,
  count,
  icon,
  color,
  bgColor,
  items,
  onViewAll,
  renderItem,
}: ActionCardProps) => (
  <Card
    size="small"
    className="h-full"
    title={
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: bgColor }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="font-medium">{title}</span>
        <Badge
          count={count}
          style={{
            backgroundColor: count > 0 ? color : '#d9d9d9',
          }}
        />
      </div>
    }
    extra={
      count > 0 && (
        <Button type="link" size="small" onClick={onViewAll}>
          View All <RightOutlined />
        </Button>
      )
    }
  >
    {items.length === 0 ? (
      <div className="py-4 text-center text-gray-400">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pending items" />
      </div>
    ) : (
      <List
        size="small"
        dataSource={items.slice(0, 3)}
        renderItem={(item) => (
          <List.Item className="px-0 py-2 border-b border-gray-50 last:border-b-0">
            {renderItem(item)}
          </List.Item>
        )}
      />
    )}
  </Card>
)

const QuickActions = ({ data, loading }: QuickActionsProps) => {
  const navigate = useNavigate()

  if (loading) {
    return (
      <Card title={<span className="text-lg font-semibold">Quick Actions</span>}>
        <div className="h-64 flex items-center justify-center">
          <Spin size="large" />
        </div>
      </Card>
    )
  }

  if (!data) return null

  const actionCards = [
    {
      key: 'sellers',
      title: 'Seller Approvals',
      count: data.sellerApprovals.count,
      icon: <UserOutlined />,
      color: '#6366f1',
      bgColor: '#eef2ff',
      items: data.sellerApprovals.items,
      onViewAll: () => navigate('/sellers?kycStatus=kyc_pending'),
      renderItem: (item: PendingActionItem) => (
        <div className="flex items-center gap-3 w-full">
          <Avatar size="small" icon={<UserOutlined />} className="bg-indigo-100 text-indigo-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {item.businessName || item.name}
            </p>
            <p className="text-xs text-gray-400 truncate">{item.email}</p>
          </div>
          <Tooltip title={dayjs(item.createdAt).format('MMM DD, YYYY HH:mm')}>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <ClockCircleOutlined />
              {dayjs(item.createdAt).fromNow()}
            </span>
          </Tooltip>
        </div>
      ),
    },
    {
      key: 'products',
      title: 'Product Approvals',
      count: data.productApprovals.count,
      icon: <ShoppingOutlined />,
      color: '#10b981',
      bgColor: '#ecfdf5',
      items: data.productApprovals.items,
      onViewAll: () => navigate('/products?status=pending_approval'),
      renderItem: (item: PendingActionItem) => (
        <div className="flex items-center gap-3 w-full">
          <Avatar
            size="small"
            src={item.mainImage}
            icon={<ShoppingOutlined />}
            className="bg-emerald-100 text-emerald-600"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
            <p className="text-xs text-gray-400 truncate">
              by {item.seller?.businessName || item.seller?.name}
            </p>
          </div>
          <Tooltip title={dayjs(item.createdAt).format('MMM DD, YYYY HH:mm')}>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <ClockCircleOutlined />
              {dayjs(item.createdAt).fromNow()}
            </span>
          </Tooltip>
        </div>
      ),
    },
    {
      key: 'returns',
      title: 'Return Requests',
      count: data.returnRequests.count,
      icon: <RollbackOutlined />,
      color: '#f59e0b',
      bgColor: '#fffbeb',
      items: data.returnRequests.items,
      onViewAll: () => navigate('/returns?status=REQUESTED'),
      renderItem: (item: PendingActionItem) => (
        <div className="flex items-center gap-3 w-full">
          <Avatar
            size="small"
            icon={<RollbackOutlined />}
            className="bg-amber-100 text-amber-600"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {item.order?.orderNumber || 'Order'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              ₹{item.refundAmount?.toLocaleString('en-IN')} • {item.reason?.slice(0, 30)}
            </p>
          </div>
          <Tooltip title={dayjs(item.createdAt).format('MMM DD, YYYY HH:mm')}>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <ClockCircleOutlined />
              {dayjs(item.createdAt).fromNow()}
            </span>
          </Tooltip>
        </div>
      ),
    },
    // {
    //   key: 'certificates',
    //   title: 'Certificate Approvals',
    //   count: data.certificateApprovals.count,
    //   icon: <SafetyCertificateOutlined />,
    //   color: '#8b5cf6',
    //   bgColor: '#f5f3ff',
    //   items: data.certificateApprovals.items,
    //   onViewAll: () => navigate('/requests?tab=certificates'),
    //   renderItem: (item: PendingActionItem) => (
    //     <div className="flex items-center gap-3 w-full">
    //       <Avatar
    //         size="small"
    //         icon={<SafetyCertificateOutlined />}
    //         className="bg-violet-100 text-violet-600"
    //       />
    //       <div className="flex-1 min-w-0">
    //         <p className="text-sm font-medium text-gray-800 truncate">
    //           {item.certificateType?.replace(/_/g, ' ')}
    //         </p>
    //         <p className="text-xs text-gray-400 truncate">
    //           by {item.seller?.businessName || item.seller?.name}
    //         </p>
    //       </div>
    //       <Tooltip title={dayjs(item.createdAt).format('MMM DD, YYYY HH:mm')}>
    //         <span className="text-xs text-gray-400 flex items-center gap-1">
    //           <ClockCircleOutlined />
    //           {dayjs(item.createdAt).fromNow()}
    //         </span>
    //       </Tooltip>
    //     </div>
    //   ),
    // },
    {
      key: 'categories',
      title: 'Category Requests',
      count: data.categoryRequests.count,
      icon: <AppstoreAddOutlined />,
      color: '#06b6d4',
      bgColor: '#ecfeff',
      items: data.categoryRequests.items,
      onViewAll: () => navigate('/requests?tab=categories'),
      renderItem: (item: PendingActionItem) => (
        <div className="flex items-center gap-3 w-full">
          <Avatar
            size="small"
            icon={<AppstoreAddOutlined />}
            className="bg-cyan-100 text-cyan-600"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
            <p className="text-xs text-gray-400 truncate">
              by {item.seller?.businessName || item.seller?.name}
            </p>
          </div>
          <Tooltip title={dayjs(item.createdAt).format('MMM DD, YYYY HH:mm')}>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <ClockCircleOutlined />
              {dayjs(item.createdAt).fromNow()}
            </span>
          </Tooltip>
        </div>
      ),
    },
    {
      key: 'lowStock',
      title: 'Low Stock / OOS',
      count: data.lowStockProducts.count,
      icon: <ShoppingOutlined />,
      color: '#ef4444',
      bgColor: '#fee2e2',
      items: data.lowStockProducts.items,
      onViewAll: () => navigate('/products?lowStock=true'),
      renderItem: (item: PendingActionItem) => (
        <div className="flex items-center gap-3 w-full">
          <Avatar
            size="small"
            src={item.mainImage}
            icon={<ShoppingOutlined />}
            className="bg-red-100 text-red-600"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
            <p className="text-xs text-gray-400 truncate">
              {item.seller?.businessName || item.seller?.name} • Stock:{' '}
              {(() => {
                const extended = item as PendingActionItem & {
                  stock?: number
                  totalStock?: number
                  hasVariants?: boolean
                  lowStockVariants?: number
                }
                const stockValue =
                  typeof extended.totalStock === 'number' ? extended.totalStock : extended.stock
                return typeof stockValue === 'number' ? stockValue : '-'
              })()}
            </p>
          </div>
          {/* No createdAt field guaranteed here, so we skip the time badge */}
        </div>
      ),
    },
  ]

  // Calculate total pending actions
  const totalPending =
    data.sellerApprovals.count +
    data.productApprovals.count +
    data.returnRequests.count +
    data.certificateApprovals.count +
    data.categoryRequests.count +
    data.reviewModeration.count +
    data.lowStockProducts.count

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <Card size="small">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Pending Actions</h3>
            <p className="text-sm text-gray-500">
              {totalPending > 0
                ? `${totalPending} items require your attention`
                : 'All caught up! No pending actions.'}
            </p>
          </div>
          <Space wrap>
            {data.reviewModeration.count > 0 && (
              <Button
                type="primary"
                danger
                icon={<StarOutlined />}
                onClick={() => navigate('/reviews')}
              >
                Review Moderation ({data.reviewModeration.count})
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* Action cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {actionCards.map((card) => (
          <ActionCard
            key={card.key}
            title={card.title}
            count={card.count}
            icon={card.icon}
            color={card.color}
            bgColor={card.bgColor}
            items={card.items}
            onViewAll={card.onViewAll}
            renderItem={card.renderItem}
          />
        ))}
      </div>
    </div>
  )
}

export default QuickActions
