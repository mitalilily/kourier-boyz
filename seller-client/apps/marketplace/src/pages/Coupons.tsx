import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  TagOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { isAxiosError } from 'axios'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import { getActiveCategories, type Category } from '../api/categories'
import { useProducts } from '../api/productQueries'
import type { Product } from '../api/products'
import {
  useCreateSellerCoupon,
  useDeleteSellerCoupon,
  usePauseSellerCoupon,
  useResumeSellerCoupon,
  useSellerCoupons,
  useUpdateSellerCoupon,
} from '../api/sellerCouponQueries'
import type { CouponFormData, SellerCoupon } from '../api/sellerCoupons'

const { Title } = Typography
const { RangePicker } = DatePicker

type CouponFormValues = {
  couponCode?: string
  discountType: CouponFormData['discountType']
  discountValue: number
  productIds?: string[]
  categoryIds?: string[]
  dateRange?: [Dayjs, Dayjs]
  maxRedemptions?: number
  maxRedemptionsPerUser?: number
  status?: SellerCoupon['status']
  description?: string
}

type ErrorResponse = {
  error?: string
  message?: string
}

type PopulatedReference<T extends { _id: string }> = string | T

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const normalizeReferenceIds = <T extends { _id: string }>(
  items?: Array<PopulatedReference<T>>,
): string[] =>
  (items ?? []).map((item) => (typeof item === 'string' ? item : item._id)).filter(isNonEmptyString)

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError<ErrorResponse>(error)) {
    return error.response?.data?.error ?? error.response?.data?.message ?? error.message ?? fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

const Coupons = () => {
  const { modal, message } = App.useApp()
  const [form] = Form.useForm<CouponFormValues>()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingCoupon, setEditingCoupon] = useState<SellerCoupon | null>(null)

  const { data, isLoading } = useSellerCoupons({
    status: statusFilter,
    page,
    limit: 10,
  })

  const { data: productsData } = useProducts({ page: 1, limit: 1000 })
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getActiveCategories(true),
  })

  const coupons = data?.coupons || []
  const pagination = data?.pagination || { total: 0, page: 1, limit: 10, pages: 1 }

  const createCoupon = useCreateSellerCoupon()
  const updateCoupon = useUpdateSellerCoupon()
  const deleteCoupon = useDeleteSellerCoupon()
  const pauseCoupon = usePauseSellerCoupon()
  const resumeCoupon = useResumeSellerCoupon()

  const handleOpenDrawer = (coupon?: SellerCoupon) => {
    if (coupon) {
      setEditingCoupon(coupon)
      // Extract IDs from populated objects if needed
      const productIds = normalizeReferenceIds(
        coupon.productIds as Array<PopulatedReference<{ _id: string }>>,
      )
      const categoryIds = normalizeReferenceIds(
        coupon.categoryIds as Array<PopulatedReference<{ _id: string }>>,
      )

      form.setFieldsValue({
        ...coupon,
        productIds: productIds,
        categoryIds: categoryIds,
        dateRange: [dayjs(coupon.startDate), dayjs(coupon.endDate)],
      })
    } else {
      setEditingCoupon(null)
      form.resetFields()
    }
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    setEditingCoupon(null)
    form.resetFields()
  }

  const handleSubmit = async (values: CouponFormValues) => {
    // Normalize productIds and categoryIds - ensure they're arrays of strings
    if (!values.dateRange || values.dateRange.length !== 2) {
      message.error('Please select a valid date range.')
      return
    }

    const productIds = Array.isArray(values.productIds)
      ? values.productIds.filter(isNonEmptyString)
      : []
    const categoryIds = Array.isArray(values.categoryIds)
      ? values.categoryIds.filter(isNonEmptyString)
      : []

    const formData: CouponFormData = {
      couponCode: values.couponCode,
      discountType: values.discountType,
      discountValue: values.discountValue,
      productIds: productIds,
      categoryIds: categoryIds,
      startDate: values.dateRange[0].toISOString(),
      endDate: values.dateRange[1].toISOString(),
      maxRedemptions: values.maxRedemptions,
      maxRedemptionsPerUser: values.maxRedemptionsPerUser,
      status: values.status || 'active',
      description: values.description,
    }

    try {
      if (editingCoupon?._id) {
        await updateCoupon.mutateAsync({ id: editingCoupon._id, data: formData })
        message.success('Coupon updated successfully!')
      } else {
        await createCoupon.mutateAsync(formData)
        message.success('Coupon created successfully!')
      }
      handleCloseDrawer()
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'Failed to save coupon'))
    }
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Delete Coupon',
      content: 'Are you sure you want to delete this coupon?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteCoupon.mutateAsync(id)
          message.success('Coupon deleted!')
        } catch (error: unknown) {
          message.error(getErrorMessage(error, 'Failed to delete coupon'))
        }
      },
    })
  }

  const handlePause = async (id: string) => {
    try {
      await pauseCoupon.mutateAsync(id)
      message.success('Coupon paused!')
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'Failed to pause coupon'))
    }
  }

  const handleResume = async (id: string) => {
    try {
      await resumeCoupon.mutateAsync(id)
      message.success('Coupon resumed!')
    } catch (error: unknown) {
      message.error(getErrorMessage(error, 'Failed to resume coupon'))
    }
  }

  const stats = {
    total: pagination.total,
    active: coupons.filter((c) => c.status === 'active').length,
    paused: coupons.filter((c) => c.status === 'paused').length,
    expired: coupons.filter((c) => c.status === 'expired').length,
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
      title: 'Type',
      dataIndex: 'discountType',
      key: 'discountType',
      width: 100,
      render: (type: string) => (
        <Tag color={type === 'percent' ? 'green' : 'orange'}>{type === 'percent' ? '%' : '₹'}</Tag>
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
          {(record.totalRedemptions ?? record.redeemedCount) || 0} / {record.maxRedemptions || '∞'}
          {record.totalRedemptions && record.totalRedemptions > 0 && (
            <span style={{ fontSize: '11px', color: '#888', marginLeft: '4px' }}>
              ({record.redeemedCount || 0} redeemed)
            </span>
          )}
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
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string, record: SellerCoupon) => {
        const colors: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          expired: 'red',
        }
        return (
          <div className="flex flex-col gap-1">
            <Tag color={colors[status]}>{status.toUpperCase()}</Tag>
            {record.status === 'paused' && record.deactivationReason && (
              <div className="text-xs text-gray-500">
                <div>
                  <strong>Reason:</strong> {record.deactivationReason}
                </div>
                {record.deactivatedBy && typeof record.deactivatedBy === 'object' && (
                  <div>
                    <strong>Changed by:</strong>{' '}
                    {'name' in record.deactivatedBy
                      ? (record.deactivatedBy as { name?: string }).name || 'Admin'
                      : 'Admin'}
                  </div>
                )}
                {record.deactivatedAt && (
                  <div>
                    <strong>On:</strong> {dayjs(record.deactivatedAt).format('MMM DD, YYYY HH:mm')}
                  </div>
                )}
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
      width: 180,
      render: (_: unknown, record: SellerCoupon) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenDrawer(record)}>
            Edit
          </Button>
          {record.status === 'active' ? (
            <Button
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => handlePause(record._id!)}
            >
              Pause
            </Button>
          ) : record.status === 'paused' ? (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleResume(record._id!)}
            >
              Resume
            </Button>
          ) : null}
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id!)}
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
        <Title level={2}>Coupons</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenDrawer()}>
          Create Coupon
        </Button>
      </div>

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
      </div>

      {/* Filters */}
      <Card>
        <div className="flex gap-4 items-center">
          <Select
            placeholder="Filter by status"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 200 }}
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Paused', value: 'paused' },
              { label: 'Expired', value: 'expired' },
            ]}
          />
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
            pageSize: 10,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} coupons`,
            onChange: (newPage) => setPage(newPage),
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
        open={drawerOpen}
        onCancel={handleCloseDrawer}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            discountType: 'percent',
            status: 'active',
          }}
        >
          <Form.Item
            name="couponCode"
            label="Coupon Code (optional - auto-generated if empty)"
            rules={[
              {
                pattern: /^[A-Z0-9]+$/,
                message: 'Only uppercase letters and numbers allowed',
              },
            ]}
          >
            <Input placeholder="Leave empty for auto-generation" />
          </Form.Item>

          <Form.Item name="discountType" label="Discount Type" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="percent">Percentage</Select.Option>
              <Select.Option value="flat">Flat Amount</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="discountValue"
            label="Discount Value"
            rules={[{ required: true }]}
            dependencies={['discountType']}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={form.getFieldValue('discountType') === 'percent' ? 100 : undefined}
              placeholder={
                form.getFieldValue('discountType') === 'percent'
                  ? 'Enter percentage (1-100)'
                  : 'Enter amount in ₹'
              }
            />
          </Form.Item>

          <Form.Item name="productIds" label="Products (optional - leave empty for all products)">
            <Select
              mode="multiple"
              placeholder="Select products"
              showSearch
              optionFilterProp="label"
              options={(productsData?.products ?? []).map((product: Product) => ({
                label: product.name,
                value: product._id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="categoryIds"
            label="Categories (optional - leave empty for all categories)"
          >
            <Select
              mode="multiple"
              placeholder="Select categories"
              showSearch
              optionFilterProp="label"
              options={(categoriesData ?? []).map((category: Category) => ({
                label: category.name,
                value: category._id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="dateRange"
            label="Valid Period"
            rules={[{ required: true, message: 'Please select valid period' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="maxRedemptions" label="Max Redemptions (optional)">
            <InputNumber style={{ width: '100%' }} min={1} placeholder="Unlimited if empty" />
          </Form.Item>

          <Form.Item name="maxRedemptionsPerUser" label="Max Redemptions Per User (optional)">
            <InputNumber style={{ width: '100%' }} min={1} placeholder="Unlimited if empty" />
          </Form.Item>

          <Form.Item name="status" label="Status">
            <Select>
              <Select.Option value="active">Active</Select.Option>
              <Select.Option value="paused">Paused</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={3} placeholder="Coupon description" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={createCoupon.isPending || updateCoupon.isPending}
              >
                {editingCoupon ? 'Update' : 'Create'}
              </Button>
              <Button onClick={handleCloseDrawer}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Coupons
