import {
  ArrowLeftOutlined,
  CheckCircleTwoTone,
  CheckOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  StarOutlined,
} from '@ant-design/icons'
import {
  App,
  Avatar,
  Button,
  Card,
  Descriptions,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import API from '../api/axiosInstance'
import {
  type AdminReview,
  useAdminProduct,
  useApproveReview,
  useDeleteProduct,
  useProductReviews,
  useRaiseObjection,
  useRejectReview,
  useResolveLatestNotice,
  useToggleFeatured,
  useToggleStatusLock,
  useUpdateProductStatus,
} from '../api/products'
import ProductCertificateApprovalModal from '../components/products/ProductCertificateApprovalModal'
import CertificateApprovalFlowInfo from '../components/products/CertificateApprovalFlowInfo'
import { useNotificationStore } from '../store/notificationStore'

const { Title, Text, Paragraph } = Typography

type VariantRow = {
  attributes?: Record<string, string>
  stock?: number
  lowStockThreshold?: number
  price?: number
  comparePrice?: number
  costPrice?: number
  discountPercent?: number
  effectivePrice?: number
  profit?: number
  sku?: string
  name?: string
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const { data, isLoading } = useAdminProduct(id)
  const updateStatus = useUpdateProductStatus()
  const toggleFeatured = useToggleFeatured()
  const toggleLock = useToggleStatusLock()
  const del = useDeleteProduct()
  const raise = useRaiseObjection()
  const resolveNotice = useResolveLatestNotice()
  const notifStore = useNotificationStore()

  const [reason, setReason] = useState('')
  const [certificateModalOpen, setCertificateModalOpen] = useState(false)
  const [remindLoading, setRemindLoading] = useState(false)

  const modalProductInfo = useMemo(
    () =>
      data
        ? {
            _id: data._id,
            name: data.name,
            seller: data.seller,
            category:
              typeof data.category === 'string' ? { name: data.category } : data.category ?? null,
          }
        : undefined,
    [data],
  )

  const handleApproveProduct = async () => {
    if (!id) return
    try {
      await updateStatus.mutateAsync({ id, status: 'active' })
      message.success('Product approved successfully')
      setCertificateModalOpen(false)
    } catch (err: unknown) {
      const apiMessage =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { message?: string; error?: string } } }).response
          ?.data === 'object'
          ? (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
              ?.message ||
            (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
              ?.error
          : undefined
      message.error(apiMessage || 'Failed to approve product')
    }
  }

  const handleRemindCertificates = async (missingCertificates: string[]) => {
    if (!id) return
    try {
      setRemindLoading(true)
      await API.post(`/admin/products/${id}/remind-missing-certificates`, {
        missingCertificates,
      })
      message.success('Reminder sent to seller')
    } catch (err: unknown) {
      const apiMessage =
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        typeof (err as { response?: { data?: { error?: string } } }).response?.data === 'object'
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      message.error(apiMessage ?? 'Failed to send reminder')
    } finally {
      setRemindLoading(false)
    }
  }

  const formatCurrency = (v?: number) =>
    typeof v === 'number'
      ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v)
      : '-'
  const formatNumber = (v?: number) =>
    typeof v === 'number' ? new Intl.NumberFormat('en-IN').format(v) : '-'
  const formatDateTime = (v?: string) => (v ? new Date(v).toLocaleString() : '-')

  if (!id) return null

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
        Back
      </Button>
      <Card loading={isLoading}>
        <Space align="start" size="large">
          <Image
            src={data?.mainImage}
            width={160}
            height={160}
            style={{ objectFit: 'cover' }}
            fallback=""
          />
          <Space direction="vertical">
            <Title level={3} style={{ margin: 0 }}>
              {data?.name}
            </Title>
            <Text type="secondary">SKU: {data?.sku}</Text>
            <Text type="secondary">
              Seller: {data?.seller?.name} ({data?.seller?.email})
            </Text>
            <Text type="secondary">
              Category:{' '}
              {data?.category
                ? (() => {
                    const category = data.category
                    const categoryName =
                      typeof category === 'string' ? category : category.name || ''
                    const parent =
                      typeof category === 'object' && category.parent
                        ? typeof category.parent === 'string'
                          ? null
                          : category.parent
                        : null
                    const parentName = parent?.name || null
                    return parentName ? `${parentName} > ${categoryName}` : categoryName
                  })()
                : 'N/A'}
            </Text>
            <Space wrap>
              {data?.hasVariants ? <Tag color="blue">Has Variants</Tag> : <Tag>Simple</Tag>}
              <Tag color={(data?.totalStock ?? data?.stock ?? 0) > 0 ? 'green' : 'red'}>
                Total Stock: {data?.totalStock ?? data?.stock ?? 0}
              </Tag>
              {typeof data?.lowStockVariants === 'number' && (
                <Tag color={data.lowStockVariants > 0 ? 'orange' : 'default'}>
                  Low-stock variants: {data.lowStockVariants}
                </Tag>
              )}
              {data?.statusLockedByAdmin && <Tag color="red">Status Locked by Admin</Tag>}
              {data?.status === 'pending_approval' ? (
                <>
                  <Tag color="orange">Pending Approval</Tag>
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => setCertificateModalOpen(true)}
                  >
                    Approve
                  </Button>
                  <Button
                    danger
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => {
                      let rejectionReason = ''
                      modal.confirm({
                        title: 'Reject Product',
                        icon: <ExclamationCircleOutlined />,
                        content: (
                          <div>
                            <p style={{ marginBottom: 16 }}>
                              Are you sure you want to reject "{data?.name}"? The product will be
                              moved to draft status.
                            </p>
                            <Input.TextArea
                              rows={3}
                              placeholder="Optional: Add rejection reason (will be saved as objection)..."
                              onChange={(e) => (rejectionReason = e.target.value)}
                            />
                          </div>
                        ),
                        okText: 'Reject',
                        okType: 'danger',
                        onOk: () => {
                          const promises: Promise<Array<unknown>>[] = [
                            updateStatus.mutateAsync({ id: id!, status: 'draft' }),
                          ]
                          if (rejectionReason?.trim()) {
                            promises.push(
                              raise.mutateAsync({ id: id!, reason: rejectionReason.trim() }),
                            )
                          }
                          return Promise.all(promises)
                            .then(() => {
                              message.success(
                                rejectionReason?.trim()
                                  ? 'Product rejected and notice sent to seller'
                                  : 'Product rejected',
                              )
                            })
                            .catch((err) => {
                              message.error(err.response?.data?.error || 'Failed to reject product')
                            })
                        },
                      })
                    }}
                  >
                    Reject
                  </Button>
                </>
              ) : (
                <>
                  <Select
                    size="small"
                    value={data?.status}
                    onChange={(v) =>
                      modal.confirm({
                        title: 'Change product status?',
                        icon: <ExclamationCircleOutlined />,
                        content:
                          'Changing status will switch the product to Manual status mode. To resume automatic updates later, switch mode to Auto.',
                        okText: 'Change Status',
                        onOk: () => updateStatus.mutate({ id, status: v }),
                      })
                    }
                    options={[
                      { value: 'draft', label: 'Draft' },
                      { value: 'active', label: 'Active' },
                      { value: 'inactive', label: 'Inactive' },
                      { value: 'out_of_stock', label: 'Out of stock' },
                      { value: 'pending_approval', label: 'Pending Approval' },
                    ]}
                  />
                  {data?.status && (
                    <Tag
                      color={
                        data.status === 'active'
                          ? 'green'
                          : data.status === 'inactive'
                          ? 'default'
                          : data.status === 'out_of_stock'
                          ? 'red'
                          : data.status === 'draft'
                          ? 'blue'
                          : 'orange'
                      }
                    >
                      {data.status}
                    </Tag>
                  )}
                </>
              )}
              <Space size={4}>
                <Text type="secondary">Status mode:</Text>
                <Tag color={data?.statusLockedByAdmin ? 'red' : 'green'}>
                  {data?.statusLockedByAdmin ? 'Manual' : 'Auto'}
                </Tag>
                <Button
                  size="small"
                  onClick={() =>
                    toggleLock.mutate({
                      id,
                      locked: !data?.statusLockedByAdmin,
                      recompute: !!data && !data.statusLockedByAdmin,
                    })
                  }
                >
                  {data?.statusLockedByAdmin ? 'Switch to Auto' : 'Switch to Manual'}
                </Button>
              </Space>
              <Button
                size="small"
                onClick={() => toggleFeatured.mutate({ id, isFeatured: !data?.isFeatured })}
              >
                {data?.isFeatured ? 'Unfeature' : 'Feature'}
              </Button>
              <Button
                size="small"
                danger
                onClick={() =>
                  modal.confirm({
                    title: 'Delete product?',
                    icon: <ExclamationCircleOutlined />,
                    okText: 'Delete',
                    okType: 'danger',
                    onOk: () =>
                      del.mutate(id, {
                        onSuccess: () => {
                          message.success('Deleted')
                          navigate('/products')
                        },
                      }),
                  })
                }
              >
                Delete
              </Button>
            </Space>
          </Space>
        </Space>
      </Card>

      {/* Certificate Approval Flow Info - Show when product is pending approval */}
      {data?.status === 'pending_approval' && (
        <CertificateApprovalFlowInfo />
      )}

      {/* Variants at top */}
      {Array.isArray(data?.variants) && data!.variants.length > 0 && (
        <Card title="Variants">
          <Table
            rowKey="_id"
            size="small"
            dataSource={data!.variants}
            pagination={false}
            columns={[
              {
                title: 'Image',
                dataIndex: 'mainImage',
                render: (url: string) => (
                  <Image
                    src={url}
                    width={40}
                    height={40}
                    style={{ objectFit: 'cover' }}
                    fallback=""
                  />
                ),
              },
              { title: 'Name', dataIndex: 'name' },
              { title: 'SKU', dataIndex: 'sku' },
              {
                title: 'Attributes',
                render: (_: unknown, r: VariantRow) =>
                  r.attributes && typeof r.attributes === 'object'
                    ? Object.entries(r.attributes)
                        .map(([k, val]) => `${k}: ${val}`)
                        .join(', ')
                    : '',
              },
              { title: 'Price (₹)', dataIndex: 'price', render: (v?: number) => formatCurrency(v) },
              {
                title: 'Compare Price (₹)',
                dataIndex: 'comparePrice',
                render: (v?: number) => formatCurrency(v),
              },
              {
                title: 'Cost Price (₹)',
                dataIndex: 'costPrice',
                render: (v?: number) => formatCurrency(v),
              },
              {
                title: 'Discount (%)',
                dataIndex: 'discountPercent',
                render: (v?: number) => (v ? `${formatNumber(v)}%` : '-'),
              },
              {
                title: 'Effective Price (₹)',
                dataIndex: 'effectivePrice',
                render: (v?: number) => (
                  <Text strong style={{ color: '#1890ff' }}>
                    {formatCurrency(v)}
                  </Text>
                ),
              },
              {
                title: 'Profit (₹)',
                dataIndex: 'profit',
                render: (v?: number) => (
                  <Text strong style={{ color: v !== undefined && v >= 0 ? '#52c41a' : '#ff4d4f' }}>
                    {formatCurrency(v)}
                  </Text>
                ),
              },
              {
                title: 'Stock',
                render: (_: unknown, r: VariantRow) => (
                  <Tag
                    color={
                      r.stock !== undefined &&
                      r.lowStockThreshold !== undefined &&
                      r.stock <= r.lowStockThreshold
                        ? 'orange'
                        : 'default'
                    }
                  >
                    {r.stock ?? 0}
                  </Tag>
                ),
              },
              { title: 'Low Thr.', dataIndex: 'lowStockThreshold' },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (v: 'active' | 'inactive' | 'out_of_stock') => (
                  <Tag color={v === 'active' ? 'green' : v === 'inactive' ? 'default' : 'red'}>
                    {v}
                  </Tag>
                ),
              },
              {
                title: 'Default',
                dataIndex: 'isDefault',
                render: (v: boolean) => (
                  <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>
                ),
              },
            ]}
          />
        </Card>
      )}

      <Card loading={isLoading} title="Description">
        {data?.shortDescription && (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {data.shortDescription}
          </Typography.Paragraph>
        )}
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
          {data?.description}
        </Typography.Paragraph>
        {Array.isArray(data?.images) && data!.images.length > 0 && (
          <Image.PreviewGroup>
            <Space wrap style={{ marginTop: 12 }}>
              {data!.images.map((url: string) => (
                <Image key={url} src={url} width={96} height={96} style={{ objectFit: 'cover' }} />
              ))}
            </Space>
          </Image.PreviewGroup>
        )}
      </Card>

      {!(data?.hasVariants || (Array.isArray(data?.variants) && data!.variants.length > 0)) && (
        <Card loading={isLoading} title="Pricing">
          <Descriptions column={3} size="small">
            <Descriptions.Item label="Price (Effective)">
              {formatCurrency(data?.effectivePrice ?? data?.price)}
            </Descriptions.Item>
            <Descriptions.Item label="Compare Price">
              {formatCurrency(data?.comparePrice)}
            </Descriptions.Item>
            <Descriptions.Item label="Cost Price">
              {formatCurrency(data?.costPrice)}
            </Descriptions.Item>
            <Descriptions.Item label="Discount %">
              {formatNumber(data?.discountPercent)}
            </Descriptions.Item>
            <Descriptions.Item label="Effective Price">
              <Text strong style={{ color: '#1890ff' }}>
                {(() => {
                  const price = data?.price || 0
                  const comparePrice = data?.comparePrice || 0
                  const discountPercent = data?.discountPercent || 0
                  let effectivePrice: number
                  if (comparePrice > 0) {
                    // If compare price exists, effective price is the selling price (price)
                    effectivePrice = price
                  } else if (discountPercent > 0) {
                    effectivePrice = Math.max(0, price - (price * discountPercent) / 100)
                  } else {
                    effectivePrice = price
                  }
                  return formatCurrency(effectivePrice)
                })()}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Profit">
              {(() => {
                const price = data?.price || 0
                const comparePrice = data?.comparePrice || 0
                const discountPercent = data?.discountPercent || 0
                const costPrice = data?.costPrice || 0
                let effectivePrice: number
                let profit: number
                if (comparePrice > 0) {
                  // If compare price exists, effective price is the selling price (price)
                  effectivePrice = price
                  profit = price - costPrice
                } else if (discountPercent > 0) {
                  effectivePrice = Math.max(0, price - (price * discountPercent) / 100)
                  profit = effectivePrice - costPrice
                } else {
                  effectivePrice = price
                  profit = price - costPrice
                }
                return (
                  <Text strong style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
                    {formatCurrency(profit)}
                  </Text>
                )
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="Effective Price (Stored)">
              {data?.effectivePrice !== undefined ? (
                <Text strong style={{ color: '#1890ff' }}>
                  {formatCurrency(data.effectivePrice)}
                </Text>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Exclusive Price (Without GST)">
              {data?.exclusivePrice !== undefined ? formatCurrency(data.exclusivePrice) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Exclusive Tax Amount (GST)">
              {data?.exclusiveTaxAmount !== undefined
                ? formatCurrency(data.exclusiveTaxAmount)
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Profit (Stored)">
              {data?.profit !== undefined ? (
                <Text strong style={{ color: (data.profit || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  {formatCurrency(data.profit)}
                </Text>
              ) : (
                '-'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Discount Start">
              {formatDateTime(data?.discountStart)}
            </Descriptions.Item>
            <Descriptions.Item label="Discount End">
              {formatDateTime(data?.discountEnd)}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card loading={isLoading} title="Inventory">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Track Inventory">
            <Tag color={data?.trackInventory ? 'green' : 'default'}>
              {data?.trackInventory ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Low Stock Threshold">
            {formatNumber(data?.lowStockThreshold)}
          </Descriptions.Item>
          <Descriptions.Item label="Min Order Qty">
            {formatNumber(data?.minOrderQuantity)}
          </Descriptions.Item>
          <Descriptions.Item label="Max Order Qty">
            {formatNumber(data?.maxOrderQuantity)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={isLoading} title="Shipping">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Requires Shipping">
            <Tag color={data?.requiresShipping ? 'green' : 'default'}>
              {data?.requiresShipping ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Free Shipping">
            <Tag color={data?.freeShipping ? 'green' : 'default'}>
              {data?.freeShipping ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Shipping Charge">
            {data?.shippingCharge !== undefined ? formatCurrency(data.shippingCharge) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Fulfillment Type">
            {data?.fulfillmentType ? (
              <Tag color={data.fulfillmentType === 'marketplace-fulfilled' ? 'blue' : 'default'}>
                {data.fulfillmentType === 'marketplace-fulfilled'
                  ? 'Marketplace Fulfilled'
                  : 'Self Ship'}
              </Tag>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Shipping Weight (kg)">
            {data?.shippingWeight ? `${formatNumber(data.shippingWeight)} kg` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Shipping Dimensions (L×W×H)">
            {data?.shippingDimensions
              ? `${formatNumber(data.shippingDimensions.length)} × ${formatNumber(
                  data.shippingDimensions.width,
                )} × ${formatNumber(data.shippingDimensions.height)} cm`
              : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={isLoading} title="Product Physical Attributes">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Brand">{data?.brand || '-'}</Descriptions.Item>
          <Descriptions.Item label="Weight (kg)">
            {data?.weight ? `${formatNumber(data.weight)} kg` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Dimensions (L×W×H)">
            {data?.dimensions
              ? `${formatNumber(data.dimensions.length)} × ${formatNumber(
                  data.dimensions.width,
                )} × ${formatNumber(data.dimensions.height)} cm`
              : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={isLoading} title="Product Policies">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Pay on Delivery">
            <Tag color={data?.payOnDelivery ? 'green' : 'default'}>
              {data?.payOnDelivery ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Returnable">
            <Tag color={data?.returnable ? 'green' : 'default'}>
              {data?.returnable ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Return Days">
            {typeof data?.returnDays === 'number' ? `${data.returnDays} days` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Warranty">
            <Tag color={data?.warranty ? 'green' : 'default'}>{data?.warranty ? 'Yes' : 'No'}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Warranty Days">
            {typeof data?.warrantyDays === 'number' ? `${data.warrantyDays} days` : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {Array.isArray(data?.warehouseInventory) && data!.warehouseInventory.length > 0 && (
        <Card loading={isLoading} title="Warehouse Inventory">
          <Table
            rowKey={(record, index) => `${record.warehouseId}-${index}`}
            size="small"
            dataSource={data!.warehouseInventory}
            pagination={false}
            columns={[
              { title: 'Warehouse ID', dataIndex: 'warehouseId' },
              { title: 'Warehouse Name', dataIndex: 'warehouseName' },
              {
                title: 'Quantity',
                dataIndex: 'quantity',
                render: (v: number) => formatNumber(v),
              },
              {
                title: 'Low Stock Threshold',
                dataIndex: 'lowStockThreshold',
                render: (v?: number) => (v !== undefined ? formatNumber(v) : '-'),
              },
            ]}
          />
        </Card>
      )}

      {Array.isArray(data?.imageMeta) && data!.imageMeta.length > 0 && (
        <Card loading={isLoading} title="Image Metadata">
          <Table
            rowKey={(record, index) => `${record.url}-${index}`}
            size="small"
            dataSource={data!.imageMeta}
            pagination={false}
            columns={[
              {
                title: 'Image',
                dataIndex: 'url',
                render: (url: string) => (
                  <Image src={url} width={60} height={60} style={{ objectFit: 'cover' }} />
                ),
              },
              { title: 'Alt Text', dataIndex: 'alt' },
              {
                title: 'Is Cover',
                dataIndex: 'isCover',
                render: (v: boolean) => (
                  <Tag color={v ? 'green' : 'default'}>{v ? 'Yes' : 'No'}</Tag>
                ),
              },
              {
                title: 'Sort Order',
                dataIndex: 'sort',
                render: (v?: number) => (v !== undefined ? formatNumber(v) : '-'),
              },
            ]}
          />
        </Card>
      )}

      <Card loading={isLoading} title="Analytics & Performance">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Rating">
            {typeof data?.rating === 'number' ? (
              <Space>
                <StarOutlined style={{ color: '#faad14' }} />
                <Text strong>{data.rating.toFixed(1)}</Text>
              </Space>
            ) : (
              '-'
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Review Count">
            {typeof data?.reviewCount === 'number' ? formatNumber(data.reviewCount) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Sold Count">
            {typeof data?.soldCount === 'number' ? formatNumber(data.soldCount) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="View Count">
            {typeof data?.viewCount === 'number' ? formatNumber(data.viewCount) : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={isLoading} title="Tax">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Tax Class">{data?.taxClass ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Tax Rate">
            {typeof data?.taxRate === 'number' ? `${formatNumber(data.taxRate)}%` : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={isLoading} title="GST/HSN Information">
        <Descriptions column={3} size="small">
          <Descriptions.Item label="GST Applicable">
            <Tag color={data?.isGstApplicable ? 'green' : 'default'}>
              {data?.isGstApplicable ? 'Yes' : 'No'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="HSN/SAC Code">{data?.hsnSacCode ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="CGST Rate">
            {typeof data?.cgstRatePercent === 'number'
              ? `${formatNumber(data.cgstRatePercent)}%`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="SGST Rate">
            {typeof data?.sgstRatePercent === 'number'
              ? `${formatNumber(data.sgstRatePercent)}%`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="IGST Rate">
            {typeof data?.igstRatePercent === 'number'
              ? `${formatNumber(data.igstRatePercent)}%`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="GST Rate (Legacy)">
            {typeof data?.gstRatePercent === 'number'
              ? `${formatNumber(data.gstRatePercent)}%`
              : '-'}
          </Descriptions.Item>
          {data?.hasVariants && (
            <>
              <Descriptions.Item label="Default HSN/SAC Code">
                {data?.defaultHsnSacCode ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Default CGST Rate">
                {typeof data?.defaultCgstRatePercent === 'number'
                  ? `${formatNumber(data.defaultCgstRatePercent)}%`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Default SGST Rate">
                {typeof data?.defaultSgstRatePercent === 'number'
                  ? `${formatNumber(data.defaultSgstRatePercent)}%`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Default IGST Rate">
                {typeof data?.defaultIgstRatePercent === 'number'
                  ? `${formatNumber(data.defaultIgstRatePercent)}%`
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Default GST Rate (Legacy)">
                {typeof data?.defaultGstRatePercent === 'number'
                  ? `${formatNumber(data.defaultGstRatePercent)}%`
                  : '-'}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      <Card loading={isLoading} title="SEO">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Meta Title">{data?.metaTitle || '-'}</Descriptions.Item>
          <Descriptions.Item label="Meta Description">
            {data?.metaDescription || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Keywords">
            <Space wrap>
              {Array.isArray(data?.seoKeywords) && data!.seoKeywords.length > 0
                ? data!.seoKeywords.map((k) => <Tag key={k}>{k}</Tag>)
                : '-'}
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card loading={isLoading} title="Specifications">
        {Array.isArray(data?.specifications) && data!.specifications.length > 0 ? (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
            {data!.specifications.map((s, idx) => (
              <div
                key={`${s.key}-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr',
                  gap: 12,
                  padding: '10px 12px',
                  background: idx % 2 === 0 ? '#fafafa' : '#fff',
                }}
              >
                <div style={{ fontWeight: 600, color: '#555' }}>{s.key}</div>
                <div style={{ color: '#333' }}>{s.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <Text type="secondary">No specifications</Text>
        )}
      </Card>

      {(data?.manufacturerName ||
        data?.manufacturerAddress ||
        data?.countryOfOrigin ||
        data?.importerName ||
        data?.importerAddress) && (
        <Card loading={isLoading} title="Manufacturer & Importer Information">
          <Descriptions column={1} size="small" bordered>
            {data.manufacturerName && (
              <Descriptions.Item label="Manufacturer Name">
                <Text>{data.manufacturerName}</Text>
              </Descriptions.Item>
            )}
            {data.manufacturerAddress && (
              <Descriptions.Item label="Manufacturer Address">
                <Text>{data.manufacturerAddress}</Text>
              </Descriptions.Item>
            )}
            {data.countryOfOrigin && (
              <Descriptions.Item label="Country of Origin">
                <Text strong>{data.countryOfOrigin}</Text>
              </Descriptions.Item>
            )}
            {data.importerName && (
              <Descriptions.Item label="Importer Name">
                <Text>{data.importerName}</Text>
              </Descriptions.Item>
            )}
            {data.importerAddress && (
              <Descriptions.Item label="Importer Address">
                <Text>{data.importerAddress}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      <Card loading={isLoading} title="Features & Tags">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Features:</Text>
            <div style={{ marginTop: 8 }}>
              {Array.isArray(data?.features) && data!.features.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {data!.features.map((f) => (
                    <li
                      key={f}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
                    >
                      <CheckCircleTwoTone twoToneColor="#52c41a" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Text type="secondary">-</Text>
              )}
            </div>
          </div>
          <div>
            <Text strong>Tags:</Text>
            <Space wrap style={{ marginTop: 8 }}>
              {Array.isArray(data?.tags) && data!.tags.length > 0 ? (
                data!.tags.map((t) => (
                  <Tag key={t} color="blue">
                    {t}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">-</Text>
              )}
            </Space>
          </div>
        </Space>
      </Card>

      <Card loading={isLoading} title="Variant Attributes">
        {Array.isArray(data?.variantAttributes) && data!.variantAttributes.length > 0 ? (
          <Space wrap>
            {data!.variantAttributes.map((a) => (
              <Tag key={a} color="blue">
                {a}
              </Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        )}
      </Card>

      <Card loading={isLoading} title="Timestamps">
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Created">
            {data?.createdAt ? new Date(data.createdAt).toLocaleString() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Updated">
            {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <ProductReviewsSection productId={id} />

      <Card title="Raise Objection">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input.TextArea
            placeholder="Write reason to send to seller"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button
            type="primary"
            disabled={!reason.trim()}
            onClick={() =>
              raise.mutate(
                { id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    setReason('')
                    message.success('Notice sent')
                    notifStore.add({
                      id: `notice:new:${id}:${Date.now()}`,
                      title: 'New Product Notice',
                      description: reason.trim(),
                      createdAt: new Date().toISOString(),
                      read: false,
                    })
                  },
                },
              )
            }
          >
            Send Notice
          </Button>
          {Array.isArray(data?.objections) && data!.objections.length > 0 && (
            <Descriptions size="small" column={1} title="Admin Notices">
              {data!.objections.map(
                (
                  o: {
                    reason: string
                    createdAt: string
                    addressedBySeller?: boolean
                    addressedAt?: string
                    resolved?: boolean
                    resolvedAt?: string
                    resolutionNote?: string
                  },
                  idx: number,
                ) => (
                  <Descriptions.Item key={idx} label={new Date(o.createdAt).toLocaleString()}>
                    <Space direction="vertical" style={{ width: '100%' }} size={2}>
                      <span>{o.reason}</span>
                      <Space size={6} wrap>
                        {o.addressedBySeller && <Tag color="blue">Addressed by seller</Tag>}
                        {o.resolved && <Tag color="green">Resolved</Tag>}
                        {!o.addressedBySeller && !o.resolved && <Tag color="orange">Open</Tag>}
                      </Space>
                      {o.resolutionNote && (
                        <Typography.Text type="secondary">Note: {o.resolutionNote}</Typography.Text>
                      )}
                    </Space>
                  </Descriptions.Item>
                ),
              )}
              <Descriptions.Item>
                <ResolveLatestNotice
                  onResolve={(note) =>
                    resolveNotice.mutate(
                      { id: id!, resolutionNote: note },
                      {
                        onSuccess: () =>
                          notifStore.add({
                            id: `notice:resolved:${id}:${Date.now()}`,
                            title: 'Notice resolved',
                            description: 'You resolved a product notice',
                            createdAt: new Date().toISOString(),
                            read: false,
                          }),
                      },
                    )
                  }
                />
              </Descriptions.Item>
            </Descriptions>
          )}
        </Space>
      </Card>
      <ProductCertificateApprovalModal
        open={certificateModalOpen}
        product={modalProductInfo}
        onCancel={() => setCertificateModalOpen(false)}
        onApprove={handleApproveProduct}
        onRemind={handleRemindCertificates}
        remindLoading={remindLoading}
        approveLoading={updateStatus.isPending}
      />
    </Space>
  )
}

function ResolveLatestNotice({ onResolve }: { onResolve: (note?: string) => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        Resolve Latest
      </Button>
      <Modal
        title="Resolve latest notice"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => {
          onResolve(note || undefined)
          setOpen(false)
          setNote('')
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            Add an optional note explaining the resolution.
          </Typography.Text>
          <Input.TextArea
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Resolution note (optional)"
          />
        </Space>
      </Modal>
    </>
  )
}

function ProductReviewsSection({ productId }: { productId?: string }) {
  const { message: messageApi, modal } = App.useApp()
  const [statusFilter, setStatusFilter] = useState<
    'pending' | 'approved' | 'rejected' | undefined
  >()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useProductReviews(productId, {
    status: statusFilter,
    page,
    limit: 10,
  })
  const approveReview = useApproveReview()
  const rejectReview = useRejectReview()

  const handleApprove = (review: AdminReview) => {
    modal.confirm({
      title: 'Approve Review',
      content: 'Are you sure you want to approve this review?',
      onOk: async () => {
        try {
          await approveReview.mutateAsync({
            productId: review.productId,
            reviewId: review._id,
          })
          messageApi.success('Review approved successfully')
        } catch (error: unknown) {
          const apiMessage =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { data?: { error?: string } } }).response?.data ===
              'object'
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          messageApi.error(apiMessage || 'Failed to approve review')
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
          <Input.TextArea
            rows={4}
            placeholder="Enter rejection reason..."
            onChange={(e) => (reason = e.target.value)}
          />
        </div>
      ),
      onOk: async () => {
        if (!reason.trim()) {
          messageApi.error('Please provide a rejection reason')
          return Promise.reject()
        }
        try {
          await rejectReview.mutateAsync({
            productId: review.productId,
            reviewId: review._id,
            reason: reason.trim(),
          })
          messageApi.success('Review rejected successfully')
        } catch (error: unknown) {
          const apiMessage =
            typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            typeof (error as { response?: { data?: { error?: string } } }).response?.data ===
              'object'
              ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
              : undefined
          messageApi.error(apiMessage || 'Failed to reject review')
        }
      },
    })
  }

  if (!productId) return null

  return (
    <Card
      title={
        <Space>
          <span>Product Reviews</span>
          <Select
            value={statusFilter}
            placeholder="Filter by status"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => {
              setStatusFilter(value)
              setPage(1)
            }}
          >
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
        </Space>
      }
    >
      <Table
        dataSource={data?.reviews || []}
        loading={isLoading}
        rowKey="_id"
        pagination={{
          current: page,
          total: data?.pagination.total || 0,
          pageSize: 10,
          onChange: setPage,
        }}
        columns={[
          {
            title: 'Reviewer',
            key: 'reviewer',
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
            render: (_: unknown, record: AdminReview) => (
              <div>
                {record.title && (
                  <Title level={5} style={{ margin: 0, marginBottom: 4, fontSize: 14 }}>
                    {record.title}
                  </Title>
                )}
                <Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ margin: 0 }}>
                  {record.comment}
                </Paragraph>
              </div>
            ),
          },
          {
            title: 'Status',
            key: 'status',
            render: (_: unknown, record: AdminReview) => {
              const statusColors = {
                pending: 'orange',
                approved: 'green',
                rejected: 'red',
              }
              return (
                <Tag color={statusColors[record.moderationStatus]}>
                  {record.moderationStatus.toUpperCase()}
                </Tag>
              )
            },
          },
          {
            title: 'Date',
            key: 'date',
            render: (_: unknown, record: AdminReview) => (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(record.createdAt).toLocaleDateString()}
              </Text>
            ),
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_: unknown, record: AdminReview) => (
              <Space>
                {record.moderationStatus === 'pending' && (
                  <>
                    <Button
                      type="primary"
                      size="small"
                      icon={<CheckOutlined />}
                      onClick={() => handleApprove(record)}
                      loading={approveReview.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      danger
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => handleReject(record)}
                      loading={rejectReview.isPending}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {record.moderationStatus === 'rejected' && record.moderationReason && (
                  <Tooltip title={record.moderationReason}>
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  </Tooltip>
                )}
              </Space>
            ),
          },
        ]}
      />
    </Card>
  )
}
