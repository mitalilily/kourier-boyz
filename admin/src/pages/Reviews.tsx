import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  StarOutlined,
} from '@ant-design/icons'
import {
  App,
  Avatar,
  Button,
  Card,
  Image,
  Input,
  Pagination,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  type AdminReview,
  useAllReviews,
  useApproveReview,
  useBulkApproveReviews,
  useBulkRejectReviews,
  useDeleteReview,
  usePendingReviews,
  useRejectReview,
} from '../api/products'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'
import { useModulePermissions } from '../hooks/useModulePermissions'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

export default function Reviews() {
  const navigate = useNavigate()
  const { modal } = App.useApp()
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [search, setSearch] = useState('')
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const reviewsPermissions = useModulePermissions('reviews')

  // Use useAllReviews for all tabs except pending (for backward compatibility)
  const allReviewsData = useAllReviews({
    page,
    limit,
    search: search || undefined,
    status: activeTab === 'all' ? 'all' : activeTab,
  })
  const pendingReviewsData = usePendingReviews({ page, limit, search: search || undefined })

  // Use appropriate data based on active tab
  const data = activeTab === 'pending' ? pendingReviewsData.data : allReviewsData.data
  const isLoading = activeTab === 'pending' ? pendingReviewsData.isLoading : allReviewsData.isLoading

  const approveReview = useApproveReview()
  const rejectReview = useRejectReview()
  const deleteReview = useDeleteReview()
  const bulkApprove = useBulkApproveReviews()
  const bulkReject = useBulkRejectReviews()

  const handleApprove = (review: AdminReview) => {
    modal.confirm({
      title: 'Approve Review',
      content: 'Are you sure you want to approve this review? It will be visible to all users.',
      onOk: async () => {
        try {
          await approveReview.mutateAsync({
            productId: review.productId,
            reviewId: review._id,
          })
          message.success('Review approved successfully')
          setSelectedRowKeys([])
        } catch (error: unknown) {
          const apiMessage =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { data?: { error?: string } } }).response?.data ===
              'object'
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          message.error(apiMessage || 'Failed to approve review')
        }
      },
    })
  }

  const handleReject = (review: AdminReview) => {
    let reason = ''
    modal.confirm({
      title: 'Reject Review',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p style={{ marginBottom: 16 }}>Please provide a reason for rejecting this review:</p>
          <TextArea
            rows={4}
            placeholder="Enter rejection reason..."
            onChange={(e) => (reason = e.target.value)}
          />
        </div>
      ),
      onOk: async () => {
        if (!reason.trim()) {
          message.error('Please provide a rejection reason')
          return Promise.reject()
        }
        try {
          await rejectReview.mutateAsync({
            productId: review.productId,
            reviewId: review._id,
            reason: reason.trim(),
          })
          message.success('Review rejected successfully')
          setSelectedRowKeys([])
        } catch (error: unknown) {
          const apiMessage =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { data?: { error?: string } } }).response?.data ===
              'object'
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          message.error(apiMessage || 'Failed to reject review')
        }
      },
    })
  }

  const handleBulkApprove = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select reviews to approve')
      return
    }

    modal.confirm({
      title: 'Bulk Approve Reviews',
      content: `Are you sure you want to approve ${selectedRowKeys.length} review(s)?`,
      onOk: async () => {
        try {
          const reviewIds = selectedRowKeys
            .map((key) => {
              const review = data?.reviews.find((r) => r._id === key)
              return review ? `${review.productId}:${review._id}` : ''
            })
            .filter(Boolean)

          await bulkApprove.mutateAsync({ reviewIds })
          message.success(`Approved ${selectedRowKeys.length} review(s) successfully`)
          setSelectedRowKeys([])
        } catch (error: unknown) {
          const apiMessage =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { data?: { error?: string } } }).response?.data ===
              'object'
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          message.error(apiMessage || 'Failed to approve reviews')
        }
      },
    })
  }

  const handleBulkReject = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select reviews to reject')
      return
    }

    let reason = ''
    modal.confirm({
      title: 'Bulk Reject Reviews',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p style={{ marginBottom: 16 }}>
            Please provide a reason for rejecting {selectedRowKeys.length} review(s):
          </p>
          <TextArea
            rows={4}
            placeholder="Enter rejection reason..."
            onChange={(e) => (reason = e.target.value)}
          />
        </div>
      ),
      onOk: async () => {
        if (!reason.trim()) {
          message.error('Please provide a rejection reason')
          return Promise.reject()
        }
        try {
          const reviewIds = selectedRowKeys
            .map((key) => {
              const review = data?.reviews.find((r) => r._id === key)
              return review ? `${review.productId}:${review._id}` : ''
            })
            .filter(Boolean)

          await bulkReject.mutateAsync({ reviewIds, reason: reason.trim() })
          message.success(`Rejected ${selectedRowKeys.length} review(s) successfully`)
          setSelectedRowKeys([])
        } catch (error: unknown) {
          const apiMessage =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { data?: { error?: string } } }).response?.data ===
              'object'
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          message.error(apiMessage || 'Failed to reject reviews')
        }
      },
    })
  }

  const handleDelete = (review: AdminReview) => {
    modal.confirm({
      title: 'Delete Review',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to delete this review? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteReview.mutateAsync({
            productId: review.productId,
            reviewId: review._id,
          })
          message.success('Review deleted successfully')
          setSelectedRowKeys([])
        } catch (error: unknown) {
          const apiMessage =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { data?: { error?: string } } }).response?.data ===
              'object'
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          message.error(apiMessage || 'Failed to delete review')
        }
      },
    })
  }

  const columns = [
    {
      title: 'Product',
      key: 'product',
      width: 200,
      render: (_: unknown, record: AdminReview) => (
        <Button
          type="link"
          onClick={() => navigate(`/products/${record.productId}`)}
          style={{ padding: 0 }}
        >
          {record.productName}
        </Button>
      ),
    },
    {
      title: 'Reviewer',
      key: 'reviewer',
      width: 150,
      render: (_: unknown, record: AdminReview) => (
        <Space>
          <Avatar src={record.reviewer.avatarUrl} size="small">
            {record.reviewer.name.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div>{record.reviewer.name}</div>
            {(record.reviewer.city || record.reviewer.state) && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {[record.reviewer.city, record.reviewer.state].filter(Boolean).join(', ')}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Rating',
      key: 'rating',
      width: 100,
      render: (_: unknown, record: AdminReview) => (
        <Space>
          <StarOutlined style={{ color: '#faad14' }} />
          <Text strong>{record.rating}</Text>
        </Space>
      ),
    },
    {
      title: 'Review',
      key: 'review',
      width: 300,
      render: (_: unknown, record: AdminReview) => (
        <div>
          {record.title && (
            <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
              {record.title}
            </Title>
          )}
          <Paragraph
            ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
            style={{ margin: 0, marginBottom: 8 }}
          >
            {record.comment}
          </Paragraph>
          {record.images && record.images.length > 0 && (
            <Space size="small" wrap>
              {record.images.slice(0, 3).map((img, idx) => (
                <Image
                  key={idx}
                  src={img}
                  alt={`Review image ${idx + 1}`}
                  width={60}
                  height={60}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                  preview
                />
              ))}
              {record.images.length > 3 && (
                <Text type="secondary">+{record.images.length - 3} more</Text>
              )}
            </Space>
          )}
          {record.videos && record.videos.length > 0 && (
            <Tag color="blue" style={{ marginTop: 4 }}>
              {record.videos.length} video(s)
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_: unknown, record: AdminReview) => {
        const statusColors: Record<string, string> = {
          pending: 'orange',
          approved: 'green',
          rejected: 'red',
        }
        return (
          <Tag color={statusColors[record.moderationStatus] || 'default'}>
            {record.moderationStatus.toUpperCase()}
          </Tag>
        )
      },
    },
    {
      title: 'Date',
      key: 'date',
      width: 120,
      render: (_: unknown, record: AdminReview) => (
        <Text type="secondary">{new Date(record.createdAt).toLocaleDateString()}</Text>
      ),
    },
    ...(reviewsPermissions.canApprove || reviewsPermissions.canReject || reviewsPermissions.canDelete
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 280,
            fixed: 'right' as const,
            render: (_: unknown, record: AdminReview) => (
              <Space size="small" wrap>
                {record.moderationStatus === 'pending' && (
                  <>
                <PermissionButton
                  module="reviews"
                  permission="approve"
                  type="primary"
                  icon={<CheckOutlined />}
                  size="small"
                  onClick={() => handleApprove(record)}
                  loading={approveReview.isPending}
                >
                  Approve
                </PermissionButton>
                <PermissionButton
                  module="reviews"
                  permission="reject"
                  danger
                  icon={<CloseOutlined />}
                  size="small"
                  onClick={() => handleReject(record)}
                  loading={rejectReview.isPending}
                >
                  Reject
                    </PermissionButton>
                  </>
                )}
                <PermissionButton
                  module="reviews"
                  permission="delete"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  onClick={() => handleDelete(record)}
                  loading={deleteReview.isPending}
                >
                  Delete
                </PermissionButton>
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  size="small"
                  onClick={() => navigate(`/products/${record.productId}`)}
                >
                  View Product
                </Button>
              </Space>
            ),
          },
        ]
      : []),
  ]

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys)
    },
  }

  const tabItems = [
    {
      key: 'all',
      label: `All Reviews`,
    },
    {
      key: 'pending',
      label: `Pending`,
    },
    {
      key: 'approved',
      label: `Approved`,
    },
    {
      key: 'rejected',
      label: `Rejected`,
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Review Moderation
        </Title>
        <Space>
          <PermissionGate
            module="reviews"
            permission={['approve', 'reject']}
            requireAll={false}
          >
            {selectedRowKeys.length > 0 && activeTab === 'pending' && (
              <>
                <PermissionButton
                  module="reviews"
                  permission="approve"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={handleBulkApprove}
                  loading={bulkApprove.isPending}
                >
                  Approve Selected ({selectedRowKeys.length})
                </PermissionButton>
                <PermissionButton
                  module="reviews"
                  permission="reject"
                  danger
                  icon={<CloseOutlined />}
                  onClick={handleBulkReject}
                  loading={bulkReject.isPending}
                >
                  Reject Selected ({selectedRowKeys.length})
                </PermissionButton>
              </>
            )}
          </PermissionGate>
        </Space>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'all' | 'pending' | 'approved' | 'rejected')
            setPage(1)
            setSelectedRowKeys([])
          }}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        <div style={{ marginBottom: 16 }}>
          <Input.Search
            placeholder="Search reviews by product, reviewer, or content..."
            allowClear
            style={{ maxWidth: 400 }}
            onSearch={(value) => {
              setSearch(value)
              setPage(1)
            }}
            onChange={(e) => {
              if (!e.target.value) {
                setSearch('')
                setPage(1)
              }
            }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={data?.reviews || []}
          loading={isLoading}
          rowKey="_id"
          rowSelection={activeTab === 'pending' ? rowSelection : undefined}
          pagination={false}
          scroll={{ x: 1400 }}
          style={{ width: '100%' }}
        />

        {data?.pagination && data.pagination.total > 0 && (
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Pagination
              current={page}
              total={data.pagination.total}
              pageSize={limit}
              showSizeChanger={false}
              showTotal={(total) => `Total ${total} reviews`}
              onChange={(newPage) => {
                setPage(newPage)
                setSelectedRowKeys([])
              }}
            />
          </div>
        )}

        {data?.reviews && data.reviews.length === 0 && !isLoading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Text type="secondary">
              No {activeTab === 'all' ? '' : activeTab} reviews found
            </Text>
          </div>
        )}
      </Card>
    </div>
  )
}
