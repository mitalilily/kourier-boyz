import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  TagOutlined,
} from '@ant-design/icons'
import { App, Button, Card, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd'
const { TextArea } = Input
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  approveSellerCoupon,
  denySellerCoupon,
  deleteSellerCoupon,
  getAllSellerCoupons,
  getCouponAnalytics,
  getSellerCoupon,
  pauseSellerCoupon,
  updateSellerCouponStatus,
  type SellerCoupon,
} from '../api/sellerCoupons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'

const { Title, Text } = Typography

const SellerCouponsPage = () => {
  const { modal } = App.useApp()
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sellerFilter, setSellerFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null)
  const [pauseModalVisible, setPauseModalVisible] = useState(false)
  const [couponToPause, setCouponToPause] = useState<string | null>(null)
  const [pauseReason, setPauseReason] = useState('')
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [couponToUpdate, setCouponToUpdate] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState<'active' | 'paused'>('active')
  const [statusReason, setStatusReason] = useState('')

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['sellerCoupons', { search: searchTerm, status: statusFilter, sellerId: sellerFilter, page, limit }],
    queryFn: () => getAllSellerCoupons({ search: searchTerm, status: statusFilter, sellerId: sellerFilter, page, limit }),
  })

  const { data: couponDetail } = useQuery({
    queryKey: ['sellerCoupon', selectedCoupon],
    queryFn: () => getSellerCoupon(selectedCoupon!),
    enabled: !!selectedCoupon,
  })

  const { data: analytics } = useQuery({
    queryKey: ['couponAnalytics'],
    queryFn: () => getCouponAnalytics(),
  })

  const coupons = data?.coupons || []
  const pagination = data?.pagination || { total: 0, page: 1, limit: 20, pages: 1 }

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: string) => approveSellerCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons'] })
      toast.success('Coupon approved!')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to approve coupon')
    },
  })

  const denyMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => denySellerCoupon(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons'] })
      toast.success('Coupon denied!')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to deny coupon')
    },
  })

  const pauseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => pauseSellerCoupon(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons'] })
      toast.success('Coupon paused!')
      setPauseModalVisible(false)
      setCouponToPause(null)
      setPauseReason('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to pause coupon')
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string
      status: 'active' | 'paused'
      reason?: string
    }) => updateSellerCouponStatus(id, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons'] })
      toast.success(`Coupon ${newStatus === 'active' ? 'activated' : 'paused'}!`)
      setStatusModalVisible(false)
      setCouponToUpdate(null)
      setNewStatus('active')
      setStatusReason('')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to update coupon status')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSellerCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons'] })
      toast.success('Coupon deleted!')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to delete coupon')
    },
  })

  const handleApprove = (id: string) => {
    approveMutation.mutate(id)
  }

  const handleDeny = (id: string) => {
    modal.confirm({
      title: 'Deny Coupon',
      content: 'Are you sure you want to deny this coupon?',
      okText: 'Deny',
      okType: 'danger',
      onOk: () => {
        denyMutation.mutate({ id })
      },
    })
  }

  const handlePause = (id: string) => {
    setCouponToPause(id)
    setPauseModalVisible(true)
  }

  const handlePauseConfirm = () => {
    if (couponToPause) {
      pauseMutation.mutate({ id: couponToPause, reason: pauseReason || undefined })
    }
  }

  const handleStatusChange = (id: string, currentStatus: string) => {
    setCouponToUpdate(id)
    setNewStatus(currentStatus === 'paused' ? 'active' : 'paused')
    setStatusModalVisible(true)
  }

  const handleStatusConfirm = () => {
    if (couponToUpdate) {
      updateStatusMutation.mutate({
        id: couponToUpdate,
        status: newStatus,
        reason: statusReason || undefined,
      })
    }
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Delete Coupon',
      content: 'Are you sure you want to delete this coupon? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        deleteMutation.mutate(id)
      },
    })
  }

  const handleViewDetails = (id: string) => {
    setSelectedCoupon(id)
  }

  const stats = {
    total: pagination.total,
    active: coupons.filter((c) => c.status === 'active').length,
    paused: coupons.filter((c) => c.status === 'paused').length,
    expired: coupons.filter((c) => c.status === 'expired').length,
    pendingApproval: coupons.filter((c) => c.requiresApproval && !c.isApproved).length,
  }

  const columns: ColumnsType<SellerCoupon> = [
    {
      title: 'Code',
      dataIndex: 'couponCode',
      key: 'couponCode',
      width: 120,
      render: (code: string) => (
        <Tag color="blue" className="font-mono font-semibold">
          {code || 'Auto'}
        </Tag>
      ),
    },
    {
      title: 'Seller',
      key: 'seller',
      width: 150,
      render: (_, record) => (
        <div>
          <Text strong>{(record.seller as any)?.businessName || 'N/A'}</Text>
          <br />
          <Text type="secondary" className="text-xs">
            {(record.seller as any)?.email || ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'discountType',
      key: 'discountType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'percent' ? 'green' : 'orange'}>
          {type === 'percent' ? '%' : '₹'}
        </Tag>
      ),
    },
    {
      title: 'Value',
      key: 'value',
      width: 120,
      render: (_, record) => (
        <span className="font-semibold">
          {record.discountType === 'percent'
            ? `${record.discountValue}%`
            : `₹${record.discountValue}`}
        </span>
      ),
    },
    {
      title: 'Scope',
      key: 'scope',
      width: 150,
      render: (_, record) => {
        if (record.productIds && record.productIds.length > 0) {
          return <Tag color="cyan">{record.productIds.length} Product(s)</Tag>
        }
        if (record.categoryIds && record.categoryIds.length > 0) {
          return <Tag color="purple">{record.categoryIds.length} Category(ies)</Tag>
        }
        return <Tag color="default">All Products</Tag>
      },
    },
    {
      title: 'Usage',
      key: 'usage',
      width: 120,
      render: (_, record) => (
        <span>
          {record.redeemedCount || 0} / {record.maxRedemptions || '∞'}
        </span>
      ),
    },
    {
      title: 'Valid Period',
      key: 'validPeriod',
      width: 200,
      render: (_, record) => (
        <div className="text-xs">
          <div>From: {dayjs(record.startDate).format('MMM DD, YYYY')}</div>
          <div>To: {dayjs(record.endDate).format('MMM DD, YYYY')}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, record) => {
        const statusColors: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          expired: 'red',
        }
        return (
          <div className="flex flex-col gap-1">
            <Tag color={statusColors[record.status]}>{record.status.toUpperCase()}</Tag>
            {record.requiresApproval && (
              <Tag color={record.isApproved ? 'green' : 'red'}>
                {record.isApproved ? 'Approved' : 'Pending'}
              </Tag>
            )}
            {record.deactivationReason && record.status === 'paused' && (
              <div className="text-xs text-gray-500 mt-1" title={record.deactivationReason}>
                Reason: {record.deactivationReason.length > 30 
                  ? `${record.deactivationReason.substring(0, 30)}...` 
                  : record.deactivationReason}
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      width: 200,
      render: (_: unknown, record: SellerCoupon) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetails(record._id)}>
            View
          </Button>
          {record.requiresApproval && !record.isApproved && (
            <>
              <Button
                size="small"
                type="primary"
                onClick={() => handleApprove(record._id)}
                loading={approveMutation.isPending}
              >
                Approve
              </Button>
              <Button
                size="small"
                danger
                onClick={() => handleDeny(record._id)}
                loading={denyMutation.isPending}
              >
                Deny
              </Button>
            </>
          )}
          {record.status === 'active' && (
            <Button
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => handlePause(record._id)}
              loading={pauseMutation.isPending}
              danger
              title="Pause this coupon"
            >
              Pause
            </Button>
          )}
          {record.status === 'paused' && (
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStatusChange(record._id, record.status)}
              loading={updateStatusMutation.isPending}
              type="primary"
              title="Activate this coupon"
            >
              Activate
            </Button>
          )}
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Title level={2}>Seller Coupons</Title>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm">Total Coupons</div>
                <div className="text-2xl font-bold">{analytics.totalCoupons}</div>
              </div>
              <TagOutlined className="text-3xl text-blue-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm">Total Redemptions</div>
                <div className="text-2xl font-bold text-green-600">{analytics.totalRedemptions}</div>
              </div>
              <CheckCircleOutlined className="text-3xl text-green-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm">Total Discount Given</div>
                <div className="text-2xl font-bold text-purple-600">
                  ₹{analytics.totalDiscountGiven.toLocaleString()}
                </div>
              </div>
              <TagOutlined className="text-3xl text-purple-500" />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-gray-500 text-sm">Unique Users</div>
                <div className="text-2xl font-bold text-orange-600">{analytics.uniqueUsers}</div>
              </div>
              <CheckCircleOutlined className="text-3xl text-orange-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-sm">Total</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <TagOutlined className="text-3xl text-blue-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-sm">Active</div>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </div>
            <CheckCircleOutlined className="text-3xl text-green-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-sm">Paused</div>
              <div className="text-2xl font-bold text-orange-600">{stats.paused}</div>
            </div>
            <PauseCircleOutlined className="text-3xl text-orange-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-sm">Expired</div>
              <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
            </div>
            <CloseCircleOutlined className="text-3xl text-red-500" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-sm">Pending Approval</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingApproval}</div>
            </div>
            <TagOutlined className="text-3xl text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full">
            <Input.Search
              placeholder="Search coupons..."
              allowClear
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-xs"
            />
            <Select
              placeholder="Status"
              allowClear
              value={statusFilter || undefined}
              onChange={(value) => setStatusFilter(value || '')}
              className="w-32"
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
                { label: 'Expired', value: 'expired' },
              ]}
            />
            <Input
              placeholder="Seller ID"
              value={sellerFilter}
              onChange={(e) => setSellerFilter(e.target.value)}
              className="w-32"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={coupons}
          loading={isLoading}
          rowKey="_id"
          scroll={{ x: 1400 }}
          pagination={{
            current: page,
            pageSize: limit,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} coupons`,
            onChange: (newPage) => setPage(newPage),
          }}
        />
      </Card>

      {/* Coupon Detail Modal */}
      <Modal
        title="Coupon Details"
        open={!!selectedCoupon}
        onCancel={() => setSelectedCoupon(null)}
        footer={
          couponDetail && (
            <Space>
              {couponDetail.coupon.status === 'active' && (
                <Button
                  danger
                  icon={<PauseCircleOutlined />}
                  onClick={() => {
                    setSelectedCoupon(null)
                    handlePause(couponDetail.coupon._id)
                  }}
                  loading={pauseMutation.isPending}
                >
                  Pause Coupon
                </Button>
              )}
              {couponDetail.coupon.status === 'paused' && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    setSelectedCoupon(null)
                    handleStatusChange(couponDetail.coupon._id, couponDetail.coupon.status)
                  }}
                  loading={updateStatusMutation.isPending}
                >
                  Activate Coupon
                </Button>
              )}
              <Button onClick={() => setSelectedCoupon(null)}>Close</Button>
            </Space>
          )
        }
        width={800}
      >
        {couponDetail && (
          <div className="space-y-4">
            <div>
              <Text strong>Coupon Code: </Text>
              <Tag color="blue" className="font-mono">
                {couponDetail.coupon.couponCode || 'Auto'}
              </Tag>
            </div>
            <div>
              <Text strong>Status: </Text>
              <Tag
                color={
                  couponDetail.coupon.status === 'active'
                    ? 'green'
                    : couponDetail.coupon.status === 'paused'
                    ? 'orange'
                    : 'red'
                }
              >
                {couponDetail.coupon.status.toUpperCase()}
              </Tag>
            </div>
            <div>
              <Text strong>Seller: </Text>
              <Text>{(couponDetail.coupon.seller as any)?.businessName || 'N/A'}</Text>
            </div>
            <div>
              <Text strong>Discount: </Text>
              <Text>
                {couponDetail.coupon.discountType === 'percent'
                  ? `${couponDetail.coupon.discountValue}%`
                  : `₹${couponDetail.coupon.discountValue}`}
              </Text>
            </div>
            {couponDetail.stats && (
              <div>
                <Text strong>Stats:</Text>
                <ul className="list-disc list-inside ml-4">
                  <li>Total Redemptions: {couponDetail.stats.totalRedemptions}</li>
                  <li>Clipped: {couponDetail.stats.clippedCount}</li>
                  <li>Applied: {couponDetail.stats.appliedCount}</li>
                  <li>Redeemed: {couponDetail.stats.redeemedCount}</li>
                  <li>Unique Users: {couponDetail.stats.uniqueUsers}</li>
                  <li>Total Discount Given: ₹{couponDetail.stats.totalDiscountGiven.toLocaleString()}</li>
                </ul>
              </div>
            )}
            {couponDetail.coupon.deactivationReason && (
              <div>
                <Text strong>Deactivation Reason: </Text>
                <Text type="secondary">{couponDetail.coupon.deactivationReason}</Text>
                {couponDetail.coupon.deactivatedBy && (
                  <div className="mt-2">
                    <Text strong>Deactivated By: </Text>
                    <Text type="secondary">
                      {(couponDetail.coupon.deactivatedBy as any)?.name || 'N/A'}
                    </Text>
                    {couponDetail.coupon.deactivatedAt && (
                      <>
                        <Text strong className="ml-4">
                          On:{' '}
                        </Text>
                        <Text type="secondary">
                          {dayjs(couponDetail.coupon.deactivatedAt).format('MMM DD, YYYY HH:mm')}
                        </Text>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Pause Coupon Modal */}
      <Modal
        title="Pause Coupon"
        open={pauseModalVisible}
        onOk={handlePauseConfirm}
        onCancel={() => {
          setPauseModalVisible(false)
          setCouponToPause(null)
          setPauseReason('')
        }}
        okText="Pause"
        okType="danger"
        confirmLoading={pauseMutation.isPending}
      >
        <div className="space-y-4">
          <Text>Are you sure you want to pause this coupon?</Text>
          <div>
            <Text strong>Reason (optional):</Text>
            <TextArea
              rows={4}
              placeholder="Enter reason for pausing..."
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        title={newStatus === 'active' ? 'Activate Coupon' : 'Pause Coupon'}
        open={statusModalVisible}
        onOk={handleStatusConfirm}
        onCancel={() => {
          setStatusModalVisible(false)
          setCouponToUpdate(null)
          setNewStatus('active')
          setStatusReason('')
        }}
        okText={newStatus === 'active' ? 'Activate' : 'Pause'}
        okType={newStatus === 'active' ? 'primary' : 'danger'}
        confirmLoading={updateStatusMutation.isPending}
      >
        <div className="space-y-4">
          <Text>
            Are you sure you want to {newStatus === 'active' ? 'activate' : 'pause'} this coupon?
          </Text>
          {newStatus === 'paused' && (
            <div>
              <Text strong>Reason (optional):</Text>
              <TextArea
                rows={4}
                placeholder="Enter reason for pausing..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="mt-2"
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default SellerCouponsPage

