import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  TagOutlined,
} from '@ant-design/icons'
import { App, Card, Input, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { toast } from 'sonner'
import { useCoupons, useCreateCoupon, useDeleteCoupon, useUpdateCoupon, type Coupon } from '../api/coupons'
import AddCouponDrawer from '../components/coupons/AddCouponDrawer'
import PermissionButton from '../components/PermissionButton'
import { useModulePermissions } from '../hooks/useModulePermissions'
import dayjs from 'dayjs'

const CouponsPage = () => {
  const { modal } = App.useApp()

  // Permission checks - single hook call for better performance
  const permissions = useModulePermissions('coupons')

  // Only show Actions column if user has at least one action permission
  const showActionsColumn = permissions.canUpdate || permissions.canDelete

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  // Queries
  const { data, isLoading } = useCoupons({
    search: searchTerm,
    status: statusFilter,
    type: typeFilter,
    page,
    limit,
  })
  const coupons = data?.coupons || []
  const pagination = data?.pagination || { total: 0, page: 1, limit: 20, pages: 1 }

  // Mutations
  const createCoupon = useCreateCoupon()
  const updateCoupon = useUpdateCoupon()
  const deleteCoupon = useDeleteCoupon()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)

  // Add or Update coupon
  const handleAddOrUpdate = (data: Partial<Coupon>) => {
    if (editingCoupon) {
      updateCoupon.mutate(
        { id: editingCoupon._id!, data },
        {
          onSuccess: () => {
            toast.success('Coupon updated successfully!')
            setDrawerOpen(false)
            setEditingCoupon(null)
          },
          onError: (error: any) => {
            const message = error?.response?.data?.error || 'Failed to update coupon'
            toast.error(message)
          },
        },
      )
    } else {
      createCoupon.mutate(data, {
        onSuccess: () => {
          toast.success('Coupon created successfully!')
          setDrawerOpen(false)
        },
        onError: (error: any) => {
          const message = error?.response?.data?.error || 'Failed to create coupon'
          toast.error(message)
        },
      })
    }
  }

  // Edit button click
  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon)
    setDrawerOpen(true)
  }

  // Delete coupon
  const handleDelete = (id: string) => {
    if (!id) {
      toast.error('Invalid coupon ID')
      return
    }

    // Check if coupon has linked announcement
    const couponToDelete = coupons.find((c) => c._id === id)
    const hasAnnouncement = couponToDelete?.linkedAnnouncement

    modal.confirm({
      title: 'Delete Coupon',
      content: (
        <div>
          <p>Are you sure you want to delete this coupon?</p>
          {hasAnnouncement && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm font-semibold text-yellow-800 mb-1">
                ⚠️ Linked Announcement Found
              </p>
              <p className="text-xs text-yellow-700">
                This coupon has a linked announcement that will also be deleted automatically.
              </p>
            </div>
          )}
        </div>
      ),
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        deleteCoupon.mutate(id, {
          onSuccess: () => {
            toast.success(
              hasAnnouncement
                ? 'Coupon and linked announcement deleted!'
                : 'Coupon deleted!',
            )
          },
          onError: (error: any) => {
            const message = error?.response?.data?.error || 'Failed to delete coupon'
            toast.error(message)
          },
        })
      },
    })
  }

  // Calculate stats
  const stats = {
    total: pagination.total,
    active: coupons.filter((c) => c.status === 'active').length,
    inactive: coupons.filter((c) => c.status === 'inactive').length,
    expired: coupons.filter((c) => c.status === 'expired').length,
  }

  const columns: ColumnsType<Coupon> = [
    {
      title: 'Code',
      dataIndex: 'code',
      key: 'code',
      width: 120,
      render: (code: string) => (
        <Tag color="blue" className="font-mono font-semibold">
          {code}
        </Tag>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'percentage' ? 'green' : 'orange'}>
          {type === 'percentage' ? '%' : 'Fixed'}
        </Tag>
      ),
    },
    {
      title: 'Value',
      key: 'value',
      width: 120,
      render: (_, record) => (
        <span className="font-semibold">
          {record.type === 'percentage' ? `${record.value}%` : `₹${record.value}`}
        </span>
      ),
    },
    {
      title: 'Min Purchase',
      dataIndex: 'minPurchaseAmount',
      key: 'minPurchaseAmount',
      width: 120,
      render: (amount?: number) => (amount ? `₹${amount}` : '-'),
    },
    {
      title: 'Usage',
      key: 'usage',
      width: 120,
      render: (_, record) => (
        <span>
          {record.usageCount} / {record.usageLimit || '∞'}
        </span>
      ),
    },
    {
      title: 'Valid Period',
      key: 'validPeriod',
      width: 200,
      render: (_, record) => (
        <div className="text-xs">
          <div>From: {dayjs(record.validFrom).format('MMM DD, YYYY')}</div>
          <div>To: {dayjs(record.validTo).format('MMM DD, YYYY')}</div>
        </div>
      ),
    },
    {
      title: 'Applicable To',
      dataIndex: 'applicableTo',
      key: 'applicableTo',
      width: 120,
      render: (applicableTo: string, record) => {
        if (applicableTo === 'categories' && record.applicableCategories?.length) {
          return (
            <Tag color="purple">
              {record.applicableCategories.length} Categor{record.applicableCategories.length > 1 ? 'ies' : 'y'}
            </Tag>
          )
        }
        if (applicableTo === 'products' && record.applicableProducts?.length) {
          return (
            <Tag color="cyan">
              {record.applicableProducts.length} Product{record.applicableProducts.length > 1 ? 's' : ''}
            </Tag>
          )
        }
        return <Tag color="default">All Products</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const colors: Record<string, string> = {
          active: 'green',
          inactive: 'default',
          expired: 'red',
        }
        return <Tag color={colors[status]}>{status.toUpperCase()}</Tag>
      },
    },
    // Only include Actions column if user has at least one action permission
    ...(showActionsColumn
      ? [
          {
            title: 'Actions',
            key: 'actions',
            fixed: 'right' as const,
            width: 120,
            render: (_: unknown, record: Coupon) => (
              <Space>
                <PermissionButton
                  module="coupons"
                  permission="update"
                  size="small"
                  onClick={() => handleEdit(record)}
                >
                  Edit
                </PermissionButton>
                <PermissionButton
                  module="coupons"
                  permission="delete"
                  size="small"
                  danger
                  onClick={() => handleDelete(record._id!)}
                >
                  Delete
                </PermissionButton>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-sm">Total Coupons</div>
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
              <div className="text-gray-500 text-sm">Inactive</div>
              <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            </div>
            <CloseCircleOutlined className="text-3xl text-gray-500" />
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
      </div>

      {/* Actions Bar */}
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
                { label: 'Inactive', value: 'inactive' },
                { label: 'Expired', value: 'expired' },
              ]}
            />
            <Select
              placeholder="Type"
              allowClear
              value={typeFilter || undefined}
              onChange={(value) => setTypeFilter(value || '')}
              className="w-32"
              options={[
                { label: 'Percentage', value: 'percentage' },
                { label: 'Fixed', value: 'fixed' },
              ]}
            />
          </div>
          <PermissionButton
            module="coupons"
            permission="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCoupon(null)
              setDrawerOpen(true)
            }}
          >
            Add Coupon
          </PermissionButton>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={coupons}
          loading={isLoading}
          rowKey="_id"
          scroll={{ x: 1200 }}
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

      {/* Add/Edit Drawer */}
      <AddCouponDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingCoupon(null)
        }}
        onSave={handleAddOrUpdate}
        coupon={editingCoupon}
        loading={createCoupon.isPending || updateCoupon.isPending}
      />
    </div>
  )
}

export default CouponsPage

