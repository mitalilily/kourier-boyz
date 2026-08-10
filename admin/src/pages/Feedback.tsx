import {
  ClockCircleOutlined,
  DownloadOutlined,
  MessageOutlined,
  SearchOutlined,
  StarFilled,
  UserOutlined,
} from '@ant-design/icons'
import {
  App,
  Badge,
  Button,
  Card,
  Input,
  Progress,
  Select,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedback, useMarkFeedbackRead, type FeedbackItem } from '../api/feedback'

const { Text } = Typography

const Feedback = () => {
  const { modal } = App.useApp()
  const [page, setPage] = useState(1)
  const [ratingFilter, setRatingFilter] = useState<number | undefined>()
  const [typeFilter, setTypeFilter] = useState<string | undefined>()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')

  const { data, isLoading } = useFeedback({
    page,
    limit: 20,
    rating: ratingFilter,
    type: typeFilter,
    isRead: activeTab === 'unread' ? false : undefined,
  })

  const markReadMutation = useMarkFeedbackRead()
  const markedAsReadRef = useRef<Set<string>>(new Set())

  const feedback = useMemo(() => data?.feedback || [], [data?.feedback])

  // Mark feedback as read when it's visible in the table
  useEffect(() => {
    if (!feedback.length || markReadMutation.isPending) return

    feedback.forEach((item) => {
      if (!item.isRead && !markedAsReadRef.current.has(item._id)) {
        markedAsReadRef.current.add(item._id)
        markReadMutation.mutate(item._id, {
          onError: () => {
            // Remove from set if marking failed so we can retry
            markedAsReadRef.current.delete(item._id)
          },
        })
      }
    })
  }, [feedback, markReadMutation])
  const pagination = data?.pagination
  const stats = data?.stats

  // Calculate additional stats from feedback data
  const detailedStats = useMemo(() => {
    const unreadCount = feedback.filter((f) => !f.isRead).length
    const sellerCount = feedback.filter((f) => f.user?.role === 'seller').length
    const customerCount = feedback.filter((f) => f.user?.role !== 'seller').length
    const positiveCount = feedback.filter((f) => f.rating >= 4).length
    const negativeCount = feedback.filter((f) => f.rating <= 2).length

    return {
      unreadCount,
      sellerCount,
      customerCount,
      positiveCount,
      negativeCount,
      satisfactionRate: feedback.length > 0 ? (positiveCount / feedback.length) * 100 : 0,
    }
  }, [feedback])

  // Filter feedback by search term
  const filteredFeedback = useMemo(() => {
    if (!searchTerm) return feedback
    const search = searchTerm.toLowerCase()
    return feedback.filter(
      (f) =>
        f.user?.name?.toLowerCase().includes(search) ||
        f.user?.email?.toLowerCase().includes(search) ||
        f.comment?.toLowerCase().includes(search) ||
        f.user?.businessName?.toLowerCase().includes(search),
    )
  }, [feedback, searchTerm])

  // Breakdown by type
  const typeBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    feedback.forEach((f) => {
      breakdown[f.type] = (breakdown[f.type] || 0) + 1
    })
    return breakdown
  }, [feedback])

  // Breakdown by source
  const sourceBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    feedback.forEach((f) => {
      breakdown[f.source] = (breakdown[f.source] || 0) + 1
    })
    return breakdown
  }, [feedback])

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarFilled
            key={star}
            style={{
              color: star <= rating ? '#fadb14' : '#e8e8e8',
              fontSize: 14,
            }}
          />
        ))}
        <span className="ml-1 text-gray-600 text-sm">({rating})</span>
      </div>
    )
  }

  const columns: ColumnsType<FeedbackItem> = [
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      width: 220,
      render: (user: FeedbackItem['user']) => (
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium">{user?.name || 'Anonymous'}</div>
            {user?.role === 'seller' && <Tag color="purple">Seller</Tag>}
          </div>
          <div className="text-xs text-gray-500">{user?.email}</div>
          {user?.businessName && (
            <div className="text-xs text-gray-400 mt-0.5">Store: {user.businessName}</div>
          )}
          {user?._id && (
            <Link
              to={user?.role === 'seller' ? `/sellers/${user._id}` : `/customers/${user._id}`}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
            >
              <UserOutlined />
              {user?.role === 'seller' ? 'View Seller' : 'View Customer'}
            </Link>
          )}
        </div>
      ),
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: 140,
      render: (rating: number) => renderStars(rating),
      sorter: (a, b) => a.rating - b.rating,
    },
    {
      title: 'Comment',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
      render: (comment: string) => (
        <Tooltip title={comment}>
          <Text className="text-gray-600">
            {comment || <span className="text-gray-400 italic">No comment</span>}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color="blue" className="capitalize">
          {type}
        </Tag>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source: string) => (
        <Tag color="cyan" className="capitalize">
          {source}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date: string) => (
        <div>
          <div>{new Date(date).toLocaleDateString()}</div>
          <div className="text-xs text-gray-500">{new Date(date).toLocaleTimeString()}</div>
        </div>
      ),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: FeedbackItem) => (
        <Badge dot={!record.isRead} offset={[-5, 5]}>
          <a
            onClick={async () => {
              // Automatically mark as read when viewing
              if (!record.isRead) {
                try {
                  await markReadMutation.mutateAsync(record._id)
                } catch (error) {
                  console.error('Failed to mark feedback as read:', error)
                }
              }

              modal.info({
                title: 'Feedback Details',
                width: 600,
                content: (
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="text-sm text-gray-500">User</div>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{record.user?.name || 'Anonymous'}</div>
                          {record.user?.role === 'seller' && <Tag color="purple">Seller</Tag>}
                        </div>
                        <div className="text-sm text-gray-500">{record.user?.email}</div>
                        {record.user?.businessName && (
                          <div className="text-sm text-gray-400 mt-1">
                            Store: {record.user.businessName}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Rating</div>
                        {renderStars(record.rating)}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500 mb-1">Comment</div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        {record.comment || (
                          <span className="text-gray-400 italic">No comment provided</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-500">Type</div>
                        <Tag color="blue" className="capitalize mt-1">
                          {record.type}
                        </Tag>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Source</div>
                        <Tag color="cyan" className="capitalize mt-1">
                          {record.source}
                        </Tag>
                      </div>
                    </div>

                    {record.metadata && (
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Metadata</div>
                        <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                          {record.metadata.page && (
                            <div>
                              <strong>Page:</strong> {record.metadata.page}
                            </div>
                          )}
                          {record.metadata.device && (
                            <div>
                              <strong>Device:</strong> {record.metadata.device}
                            </div>
                          )}
                          {record.metadata.storeId && (
                            <div>
                              <strong>Store ID:</strong> {record.metadata.storeId}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-sm text-gray-500">Submitted</div>
                      <div>{new Date(record.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ),
              })
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            View
          </a>
        </Badge>
      ),
    },
  ]

  // Calculate rating distribution percentages
  const totalRatings = stats?.totalCount || 1
  const ratingPercentages = stats?.ratingDistribution
    ? {
        5: ((stats.ratingDistribution[5] || 0) / totalRatings) * 100,
        4: ((stats.ratingDistribution[4] || 0) / totalRatings) * 100,
        3: ((stats.ratingDistribution[3] || 0) / totalRatings) * 100,
        2: ((stats.ratingDistribution[2] || 0) / totalRatings) * 100,
        1: ((stats.ratingDistribution[1] || 0) / totalRatings) * 100,
      }
    : { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Platform Feedback</h1>
          <p className="text-gray-500 text-sm mt-1">
            Comprehensive analytics and insights from customers and sellers
          </p>
        </div>
        <Button icon={<DownloadOutlined />} onClick={() => window.print()}>
          Export
        </Button>
      </div>

      {/* Detailed Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <Statistic
            title="Total Feedback"
            value={stats?.totalCount || 0}
            prefix={<MessageOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
        <Card>
          <Statistic
            title="Average Rating"
            value={stats?.averageRating || '0.0'}
            prefix={<StarFilled />}
            suffix="/ 5.0"
            valueStyle={{ color: '#f59e0b' }}
          />
        </Card>
        <Card>
          <Statistic
            title="Unread"
            value={detailedStats.unreadCount}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#faad14' }}
          />
        </Card>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="space-y-2">
            <div className="text-sm text-gray-500">Satisfaction Rate</div>
            <Progress
              percent={Math.round(detailedStats.satisfactionRate)}
              status="active"
              strokeColor="#52c41a"
            />
            <div className="text-xs text-gray-400">
              {detailedStats.positiveCount} positive ratings (4+ stars)
            </div>
          </div>
        </Card>
        <Card>
          <Statistic
            title="From Sellers"
            value={detailedStats.sellerCount}
            valueStyle={{ color: '#722ed1' }}
          />
          <div className="text-xs text-gray-400 mt-1">
            {feedback.length > 0
              ? Math.round((detailedStats.sellerCount / feedback.length) * 100)
              : 0}
            % of total
          </div>
        </Card>
        <Card>
          <Statistic
            title="From Customers"
            value={detailedStats.customerCount}
            valueStyle={{ color: '#13c2c2' }}
          />
          <div className="text-xs text-gray-400 mt-1">
            {feedback.length > 0
              ? Math.round((detailedStats.customerCount / feedback.length) * 100)
              : 0}
            % of total
          </div>
        </Card>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Card title="Breakdown by Type" className="h-full">
          <div className="space-y-3">
            {Object.entries(typeBreakdown).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag color="blue" className="capitalize">
                    {type}
                  </Tag>
                </div>
                <div className="flex items-center gap-3">
                  <Progress
                    percent={feedback.length > 0 ? (count / feedback.length) * 100 : 0}
                    showInfo={false}
                    strokeColor="#1890ff"
                    style={{ width: 100 }}
                  />
                  <span className="text-sm font-medium w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Breakdown by Source" className="h-full">
          <div className="space-y-3">
            {Object.entries(sourceBreakdown).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag color="cyan" className="capitalize">
                    {source}
                  </Tag>
                </div>
                <div className="flex items-center gap-3">
                  <Progress
                    percent={feedback.length > 0 ? (count / feedback.length) * 100 : 0}
                    showInfo={false}
                    strokeColor="#13c2c2"
                    style={{ width: 100 }}
                  />
                  <span className="text-sm font-medium w-12 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Rating Distribution */}
      <Card className="mb-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Rating Distribution</h3>
          <p className="text-sm text-gray-500">Visual breakdown of all ratings received</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = stats?.ratingDistribution?.[rating as 1 | 2 | 3 | 4 | 5] || 0
            const percent = ratingPercentages[rating as keyof typeof ratingPercentages]
            const barColor = rating >= 4 ? '#10b981' : rating === 3 ? '#f59e0b' : '#ef4444'

            return (
              <div key={rating} className="md:col-span-2">
                <Card className="h-full" bodyStyle={{ padding: 16 }}>
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <StarFilled
                          key={star}
                          style={{
                            color: star <= rating ? barColor : '#e5e7eb',
                            fontSize: 16,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-2xl font-bold" style={{ color: barColor }}>
                      {count}
                    </div>
                    <div className="text-xs text-gray-500">{percent.toFixed(1)}%</div>
                    <Progress
                      percent={percent}
                      showInfo={false}
                      strokeColor={barColor}
                      size="small"
                    />
                  </div>
                </Card>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Filters and Table */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: (
                <span>
                  All Feedback
                  <Badge count={feedback.length} style={{ marginLeft: 8 }} />
                </span>
              ),
            },
            {
              key: 'unread',
              label: (
                <span>
                  Unread
                  <Badge count={detailedStats.unreadCount} style={{ marginLeft: 8 }} />
                </span>
              ),
            },
          ]}
          className="mb-4"
        />

        <div className="mb-4 flex flex-wrap gap-4">
          <Input
            placeholder="Search by name, email, or comment..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Select
            placeholder="Filter by Rating"
            style={{ width: 160 }}
            allowClear
            value={ratingFilter}
            onChange={setRatingFilter}
          >
            <Select.Option value={5}>5 Stars</Select.Option>
            <Select.Option value={4}>4 Stars</Select.Option>
            <Select.Option value={3}>3 Stars</Select.Option>
            <Select.Option value={2}>2 Stars</Select.Option>
            <Select.Option value={1}>1 Star</Select.Option>
          </Select>

          <Select
            placeholder="Filter by Type"
            style={{ width: 160 }}
            allowClear
            value={typeFilter}
            onChange={setTypeFilter}
          >
            <Select.Option value="general">General</Select.Option>
            <Select.Option value="product">Product</Select.Option>
            <Select.Option value="delivery">Delivery</Select.Option>
            <Select.Option value="support">Support</Select.Option>
            <Select.Option value="app">App</Select.Option>
            <Select.Option value="other">Other</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={filteredFeedback}
          loading={isLoading}
          rowKey="_id"
          pagination={{
            current: page,
            pageSize: 20,
            total: filteredFeedback.length || pagination?.total || 0,
            showTotal: (total) => `Showing ${total} feedback entries`,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>
    </div>
  )
}

export default Feedback
