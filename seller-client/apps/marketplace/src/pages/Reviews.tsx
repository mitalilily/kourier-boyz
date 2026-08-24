import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  SearchOutlined,
  StarFilled,
  TrophyOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Card,
  Col,
  Empty,
  Image,
  Input,
  Rate,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useState } from 'react'
import { useSellerFeedback, useSellerReviewStats, useSellerReviews } from '../api/reviewQueries'
import type { FeedbackType, ProductReview, SellerFeedbackItem } from '../api/reviews'

dayjs.extend(relativeTime)

const { Title, Text } = Typography

const Reviews = () => {
  const [filters, setFilters] = useState<{
    rating?: number
    status?: 'pending' | 'approved' | 'rejected'
    search?: string
  }>({})
  const [page, setPage] = useState(1)
  const limit = 10

  // Feedback table state
  const [feedbackPage, setFeedbackPage] = useState(1)
  const feedbackLimit = 10
  const [feedbackType, setFeedbackType] = useState<FeedbackType | undefined>(undefined)

  // Get review stats
  const { data: stats, isLoading: isLoadingStats } = useSellerReviewStats()

  // Get reviews with filters
  const { data: reviewsData, isLoading: isLoadingReviews } = useSellerReviews({
    ...filters,
    page,
    limit,
  })

  // Get explicit feedback (delivery / support / product) for this seller
  const { data: feedbackData, isLoading: isLoadingFeedback } = useSellerFeedback({
    page: feedbackPage,
    limit: feedbackLimit,
    type: feedbackType,
  })

  const reviews = reviewsData?.reviews || []
  const total = reviewsData?.total || 0
  const currentPage = reviewsData?.page || 1

  const feedback = feedbackData?.feedback || []
  const feedbackTotal = feedbackData?.total || 0
  const feedbackCurrentPage = feedbackData?.page || 1

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const handleFeedbackTypeChange = (value: FeedbackType | undefined) => {
    setFeedbackType(value)
    setFeedbackPage(1)
  }

  const columns: ColumnsType<ProductReview> = [
    {
      title: 'Product',
      key: 'product',
      width: 200,
      render: (_: unknown, record: ProductReview) => (
        <Space>
          {record.product?.mainImage ? (
            <Image
              src={record.product.mainImage}
              alt={record.product.name}
              width={50}
              height={50}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={false}
            />
          ) : (
            <div
              style={{
                width: 50,
                height: 50,
                backgroundColor: '#f0f0f0',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageOutlined style={{ fontSize: 20, color: '#999' }} />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {record.product?.name || 'Unknown Product'}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.product?.slug || ''}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Reviewer',
      key: 'reviewer',
      width: 180,
      render: (_: unknown, record: ProductReview) => (
        <Space>
          <Avatar
            src={record.reviewer?.avatarUrl}
            style={{ backgroundColor: '#B78115' }}
            icon={<MessageOutlined />}
          >
            {record.reviewer?.name?.[0]?.toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 500 }}>{record.reviewer?.name || 'Anonymous'}</div>
            {record.reviewer?.city && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.reviewer.city}
                {record.reviewer.state && `, ${record.reviewer.state}`}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Rating',
      key: 'rating',
      width: 150,
      render: (_: unknown, record: ProductReview) => (
        <Space direction="vertical" size="small">
          <Rate disabled value={record.rating} style={{ fontSize: 14 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.rating} out of 5
          </Text>
        </Space>
      ),
      sorter: (a, b) => a.rating - b.rating,
    },
    {
      title: 'Review',
      key: 'comment',
      width: 300,
      render: (_: unknown, record: ProductReview) => (
        <div>
          {record.title && (
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14 }}>{record.title}</div>
          )}
          <Text style={{ fontSize: 13 }}>{record.comment}</Text>
          {record.images && record.images.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Space size="small">
                {record.images.slice(0, 3).map((img, idx) => (
                  <Image
                    key={idx}
                    src={img}
                    width={40}
                    height={40}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                    preview={{
                      src: img,
                    }}
                  />
                ))}
                {record.images.length > 3 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    +{record.images.length - 3} more
                  </Text>
                )}
              </Space>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: unknown, record: ProductReview) => {
        const statusConfig = {
          approved: { color: 'success', icon: <CheckCircleOutlined />, text: 'Approved' },
          pending: { color: 'warning', icon: <ClockCircleOutlined />, text: 'Pending' },
          rejected: { color: 'error', icon: <CloseCircleOutlined />, text: 'Rejected' },
        }
        const config = statusConfig[record.moderationStatus]
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        )
      },
      filters: [
        { text: 'Approved', value: 'approved' },
        { text: 'Pending', value: 'pending' },
        { text: 'Rejected', value: 'rejected' },
      ],
      onFilter: (value, record) => record.moderationStatus === value,
    },
    {
      title: 'Verified',
      key: 'verified',
      width: 100,
      render: (_: unknown, record: ProductReview) =>
        record.isVerifiedPurchase ? (
          <Tag color="blue" icon={<CheckCircleOutlined />}>
            Verified
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: 'Engagement',
      key: 'engagement',
      width: 120,
      render: (_: unknown, record: ProductReview) => (
        <Space direction="vertical" size="small">
          {record.likes !== undefined && record.likes > 0 && (
            <Text style={{ fontSize: 12 }}>
              👍 {record.likes} {record.likes === 1 ? 'like' : 'likes'}
            </Text>
          )}
          {record.dislikes !== undefined && record.dislikes > 0 && (
            <Text style={{ fontSize: 12 }}>
              👎 {record.dislikes} {record.dislikes === 1 ? 'dislike' : 'dislikes'}
            </Text>
          )}
          {(!record.likes || record.likes === 0) && (!record.dislikes || record.dislikes === 0) && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              No engagement
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Date',
      key: 'createdAt',
      width: 150,
      render: (_: unknown, record: ProductReview) => (
        <Space direction="vertical" size={0}>
          <span>{dayjs(record.createdAt).format('YYYY-MM-DD')}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(record.createdAt).fromNow()}
          </Text>
        </Space>
      ),
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      defaultSortOrder: 'descend',
    },
  ]

  const feedbackColumns: ColumnsType<SellerFeedbackItem> = [
    {
      title: 'Product',
      key: 'product',
      width: 220,
      render: (_: unknown, record: SellerFeedbackItem) => (
        <Space>
          {record.product?.mainImage ? (
            <Image
              src={record.product.mainImage}
              alt={record.product.name}
              width={50}
              height={50}
              style={{ objectFit: 'cover', borderRadius: 4 }}
              preview={false}
            />
          ) : (
            <div
              style={{
                width: 50,
                height: 50,
                backgroundColor: '#f0f0f0',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageOutlined style={{ fontSize: 20, color: '#999' }} />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>
              {record.product?.name || 'Unknown Product'}
            </div>
            {record.metadata?.orderId && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Order: {String(record.metadata.orderId).slice(-8)}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (value: SellerFeedbackItem['type']) => (
        <Tag color={value === 'delivery' ? 'blue' : value === 'support' ? 'purple' : 'green'}>
          {value === 'delivery'
            ? 'Delivery Feedback'
            : value === 'support'
            ? 'Seller Feedback'
            : 'Product Review'}
        </Tag>
      ),
    },
    {
      title: 'Rating',
      key: 'rating',
      width: 150,
      render: (_: unknown, record: SellerFeedbackItem) => (
        <Space direction="vertical" size="small">
          <Rate disabled value={record.rating} style={{ fontSize: 14 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.rating} out of 5
          </Text>
        </Space>
      ),
    },
    {
      title: 'Feedback',
      key: 'comment',
      render: (_: unknown, record: SellerFeedbackItem) => (
        <Text style={{ fontSize: 13 }}>{record.comment || '—'}</Text>
      ),
    },
    {
      title: 'Date',
      key: 'createdAt',
      width: 160,
      render: (_: unknown, record: SellerFeedbackItem) => (
        <Space direction="vertical" size={0}>
          <span>{dayjs(record.createdAt).format('YYYY-MM-DD')}</span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(record.createdAt).fromNow()}
          </Text>
        </Space>
      ),
      sorter: (a, b) => dayjs(a.createdAt).valueOf() - dayjs(b.createdAt).valueOf(),
      defaultSortOrder: 'descend',
    },
  ]

  const ratingDistribution = stats?.ratingDistribution || {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  }

  const totalReviews = stats?.totalReviews || 0
  const overallRating = stats?.overallRating || 0
  const explicitFeedbackCount = stats?.explicitFeedbackCount || 0

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        Reviews & Ratings
      </Title>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Statistic
              title={
                <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 14, fontWeight: 500 }}>
                  Overall Rating
                </span>
              }
              value={overallRating}
              precision={1}
              prefix={<StarFilled style={{ color: '#ffd700' }} />}
              suffix={
                <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>/ 5.0</span>
              }
              valueStyle={{ color: '#fff', fontSize: 32, fontWeight: 600 }}
              loading={isLoadingStats}
            />
            <Space direction="vertical" size={4} style={{ marginTop: 12 }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 13 }}>
                Based on {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </Text>
              <Text
                style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: 11, fontStyle: 'italic' }}
              >
                <InfoCircleOutlined style={{ marginRight: 4 }} />
                Reflects as your seller rating on the marketplace
              </Text>
              {explicitFeedbackCount > 0 && (
                <Text
                  style={{
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  + {explicitFeedbackCount} direct delivery / service feedback response
                  {explicitFeedbackCount > 1 ? 's' : ''} from customers
                </Text>
              )}
              <Tooltip
                placement="right"
                title="We combine all approved product reviews and explicit delivery / seller / product feedback (1-5★) linked to your products to calculate this rating."
              >
                <Text
                  style={{
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: 11,
                    marginTop: 4,
                    textDecoration: 'underline',
                    textDecorationStyle: 'dotted',
                    cursor: 'pointer',
                  }}
                >
                  <InfoCircleOutlined style={{ marginRight: 4 }} />
                  See how we calculate this rating
                </Text>
              </Tooltip>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable style={{ height: '100%' }}>
            <Statistic
              title="Total Reviews"
              value={totalReviews}
              prefix={<MessageOutlined style={{ color: '#B78115' }} />}
              valueStyle={{ color: '#B78115', fontSize: 28, fontWeight: 600 }}
              loading={isLoadingStats}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              All approved reviews across products
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card hoverable style={{ height: '100%' }}>
            <Statistic
              title="Average Rating"
              value={stats?.averageRating || 0}
              precision={1}
              prefix={<TrophyOutlined style={{ color: '#faad14' }} />}
              suffix="/ 5.0"
              valueStyle={{ color: '#faad14', fontSize: 28, fontWeight: 600 }}
              loading={isLoadingStats}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
              Average of all product ratings
            </Text>
          </Card>
        </Col>
      </Row>

      {/* Rating Distribution */}
      <Card title="Rating Distribution" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = ratingDistribution[rating as keyof typeof ratingDistribution] || 0
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0
            return (
              <Col xs={24} sm={12} md={8} lg={4.8} key={rating}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Rate disabled value={rating} style={{ fontSize: 14 }} />
                    <Text strong>{rating}</Text>
                  </Space>
                  <div
                    style={{
                      width: '100%',
                      backgroundColor: '#f0f0f0',
                      borderRadius: 4,
                      height: 8,
                    }}
                  >
                    <div
                      style={{
                        width: `${percentage}%`,
                        backgroundColor:
                          rating >= 4 ? '#52c41a' : rating >= 3 ? '#faad14' : '#ff4d4f',
                        height: '100%',
                        borderRadius: 4,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {count} {count === 1 ? 'review' : 'reviews'} ({percentage.toFixed(1)}%)
                  </Text>
                </Space>
              </Col>
            )
          })}
        </Row>
      </Card>

      {/* Top Rated Products */}
      {stats?.topRatedProducts && stats.topRatedProducts.length > 0 && (
        <Card title="Your Top Rated Products" style={{ marginBottom: 24 }}>
          <div
            style={{
              overflowX: 'auto',
              overflowY: 'hidden',
              paddingBottom: 8,
              margin: '-8px',
              padding: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '16px',
                minWidth: 'min-content',
              }}
            >
              {stats.topRatedProducts.map((product) => (
                <Card
                  key={product._id}
                  hoverable
                  style={{
                    minWidth: 180,
                    maxWidth: 180,
                    flexShrink: 0,
                  }}
                  cover={
                    product.mainImage ? (
                      <Image
                        src={product.mainImage}
                        alt={product.name}
                        height={140}
                        width={180}
                        style={{ objectFit: 'cover' }}
                        preview={false}
                      />
                    ) : (
                      <div
                        style={{
                          height: 140,
                          width: 180,
                          backgroundColor: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MessageOutlined style={{ fontSize: 32, color: '#999' }} />
                      </div>
                    )
                  }
                >
                  <Card.Meta
                    title={
                      <Text ellipsis style={{ fontSize: 13, fontWeight: 500 }}>
                        {product.name}
                      </Text>
                    }
                    description={
                      <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
                        <Space>
                          <Rate disabled value={product.rating} style={{ fontSize: 12 }} />
                          <Text strong style={{ fontSize: 12 }}>
                            {product.rating}
                          </Text>
                        </Space>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'}
                        </Text>
                      </Space>
                    }
                  />
                </Card>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Reviews & Feedback Tabs */}
      <Tabs
        defaultActiveKey="reviews"
        items={[
          {
            key: 'reviews',
            label: 'All Reviews',
            children: (
              <Card
                title="All Reviews"
                extra={
                  <Space>
                    <Input
                      placeholder="Search reviews..."
                      prefix={<SearchOutlined />}
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      style={{ width: 200 }}
                      allowClear
                    />
                    <Select
                      placeholder="Filter by rating"
                      value={filters.rating}
                      onChange={(value) => handleFilterChange('rating', value)}
                      allowClear
                      style={{ width: 150 }}
                    >
                      <Select.Option value={5}>5 Stars</Select.Option>
                      <Select.Option value={4}>4 Stars</Select.Option>
                      <Select.Option value={3}>3 Stars</Select.Option>
                      <Select.Option value={2}>2 Stars</Select.Option>
                      <Select.Option value={1}>1 Star</Select.Option>
                    </Select>
                    <Select
                      placeholder="Filter by status"
                      value={filters.status}
                      onChange={(value) => handleFilterChange('status', value)}
                      allowClear
                      style={{ width: 150 }}
                    >
                      <Select.Option value="approved">Approved</Select.Option>
                      <Select.Option value="pending">Pending</Select.Option>
                      <Select.Option value="rejected">Rejected</Select.Option>
                    </Select>
                  </Space>
                }
              >
                <Table
                  columns={columns}
                  dataSource={reviews}
                  rowKey="_id"
                  loading={isLoadingReviews}
                  pagination={{
                    current: currentPage,
                    pageSize: limit,
                    total: total,
                    showSizeChanger: false,
                    showTotal: (total) => `Total ${total} reviews`,
                    onChange: (newPage) => setPage(newPage),
                  }}
                  locale={{
                    emptyText: (
                      <Empty description="No reviews found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ),
                  }}
                />
              </Card>
            ),
          },
          {
            key: 'feedback',
            label: 'Customer Feedback',
            children: (
              <Card
                title="Customer Feedback (delivery & service)"
                extra={
                  <Space>
                    <Select
                      placeholder="Filter by type"
                      value={feedbackType}
                      onChange={(value) =>
                        handleFeedbackTypeChange(value as FeedbackType | undefined)
                      }
                      allowClear
                      style={{ width: 200 }}
                    >
                      <Select.Option value="delivery">Delivery Feedback</Select.Option>
                      <Select.Option value="support">Seller Feedback</Select.Option>
                      <Select.Option value="product">Product Review</Select.Option>
                    </Select>
                  </Space>
                }
              >
                <Table
                  columns={feedbackColumns}
                  dataSource={feedback}
                  rowKey="_id"
                  loading={isLoadingFeedback}
                  pagination={{
                    current: feedbackCurrentPage,
                    pageSize: feedbackLimit,
                    total: feedbackTotal,
                    showSizeChanger: false,
                    showTotal: (total) => `Total ${total} feedback entries`,
                    onChange: (newPage) => setFeedbackPage(newPage),
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        description="No feedback received yet"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    ),
                  }}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}

export default Reviews
