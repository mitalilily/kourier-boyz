import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  FilePdfOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Image,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useSellerApproveReturn,
  useSellerConfirmReturnApproval,
  useSellerRejectReturn,
  useSellerReturnQuote,
  useSellerReturns,
} from '../api/returns'
import { useCreateSellerTicket } from '../api/tickets'

const { Title, Text } = Typography

const statusColors: Record<string, string> = {
  REQUESTED: 'default',
  APPROVED_BY_SELLER: 'blue',
  APPROVED_BY_ADMIN: 'geekblue',
  REJECTED: 'red',
  REVERSE_PICKUP_CREATED: 'purple',
  REVERSE_PICKUP_IN_TRANSIT: 'purple',
  REVERSE_PICKUP_COMPLETED: 'green',
  RETURN_RECEIVED_BY_SELLER: 'green',
  REFUND_INITIATED: 'orange',
  REFUND_COMPLETED: 'success',
}

const mapReturnStatusForSeller = (status: string): string => {
  switch (status) {
    case 'REQUESTED':
      return 'Return request received'
    case 'APPROVED_BY_SELLER':
      return 'You approved this return'
    case 'APPROVED_BY_ADMIN':
      return 'Support team approved'
    case 'REJECTED':
      return 'Return request rejected'
    case 'REVERSE_PICKUP_CREATED':
      return 'Courier pickup booked'
    case 'REVERSE_PICKUP_IN_TRANSIT':
      return 'Return package in transit'
    case 'REVERSE_PICKUP_COMPLETED':
      return 'Return package delivered to you'
    case 'RETURN_RECEIVED_BY_SELLER':
      return 'Return received and inspected'
    case 'REFUND_INITIATED':
      return 'Refund initiated by admin'
    case 'REFUND_COMPLETED':
      return 'Refund completed for customer'
    default:
      return status.replace(/_/g, ' ')
  }
}

const ReturnsPage = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const createTicketMutation = useCreateSellerTicket()
  const [statusFilter] = useState<string | undefined>()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [quoteReturnId, setQuoteReturnId] = useState<string | null>(null)
  const [raiseQueryReturn, setRaiseQueryReturn] = useState<string | null>(null)

  const { data, isLoading } = useSellerReturns({
    status: statusFilter,
    page,
    limit,
  })

  const approveMutation = useSellerApproveReturn()
  const rejectMutation = useSellerRejectReturn()
  const confirmMutation = useSellerConfirmReturnApproval()
  const { data: quoteData, isLoading: isLoadingQuote } = useSellerReturnQuote(quoteReturnId)

  // Serviceability API returns couriers sorted by fastest and economical (best courier first)
  const selectedCourier =
    quoteData?.success && quoteData.data?.couriers && quoteData.data.couriers.length > 0
      ? quoteData.data.couriers[0]
      : null

  const returns =
    data?.data?.filter((r) => {
      if (!search.trim()) return true
      const term = search.toLowerCase()
      return (
        r.order?.orderNumber?.toLowerCase().includes(term) ||
        r.customer?.name?.toLowerCase().includes(term) ||
        r.reason.toLowerCase().includes(term)
      )
    }) || []

  const columns: ColumnsType<(typeof returns)[number]> = [
    {
      title: 'Return ID',
      dataIndex: '_id',
      width: 100,
      responsive: ['md'],
      render: (value) => <Text code>{String(value).slice(-8)}</Text>,
    },
    {
      title: 'Order',
      dataIndex: 'order',
      width: 140,
      render: (order: (typeof returns)[number]['order']) => (
        <div>
          <div className="font-medium">{order?.orderNumber || order?._id}</div>
          <div className="text-xs text-gray-500">{order?.status}</div>
        </div>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'customer',
      width: 160,
      responsive: ['md'],
      render: (customer: (typeof returns)[number]['customer']) => (
        <div>
          <div className="font-medium">{customer?.name}</div>
          <div className="text-xs text-gray-500">{customer?.email}</div>
        </div>
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      ellipsis: true,
      width: 150,
      responsive: ['lg'],
    },
    {
      title: 'Refund',
      dataIndex: 'refundAmount',
      width: 100,
      render: (v: number) => `₹${(v || 0).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (value: string) => (
        <Tag color={statusColors[value] || 'default'}>{mapReturnStatusForSeller(value)}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      width: 150,
      responsive: ['lg'],
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap w-max">
          <Tooltip title="View">
            <Button
              size="small"
              type="default"
              shape="circle"
              icon={<EyeOutlined />}
              onClick={() => setActiveReturnId(record._id)}
            />
          </Tooltip>
          <Tooltip title="Raise Query">
            <Button
              size="small"
              type="default"
              icon={<QuestionCircleOutlined />}
              className="hidden sm:inline-flex"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setRaiseQueryReturn(record._id)
              }}
            >
              <span className="hidden md:inline">Raise Query</span>
            </Button>
          </Tooltip>
          {record.status === 'REQUESTED' && (
            <>
              <Tooltip title="Approve">
                <Button
                  size="small"
                  type="primary"
                  shape="circle"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setQuoteReturnId(record._id)
                  }}
                  loading={approveMutation.isPending && approveMutation.variables === record._id}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  size="small"
                  danger
                  shape="circle"
                  type="default"
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setRejectingId(record._id)
                    setRejectReason('')
                  }}
                />
              </Tooltip>
            </>
          )}
          {record.status === 'APPROVED_BY_ADMIN' &&
            !record.courierReverseAwb &&
            !record.courierReverseId && (
              <Tooltip title="Create Reverse Pickup">
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  onClick={() => {
                    setQuoteReturnId(record._id)
                  }}
                  loading={confirmMutation.isPending && quoteReturnId === record._id}
                >
                  <span className="hidden md:inline">Create Pickup</span>
                </Button>
              </Tooltip>
            )}
        </div>
      ),
    },
  ]

  const activeReturn = returns.find((r) => r._id === activeReturnId)

  return (
    <Card>
      <Space direction="vertical" size="large" className="w-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <Title level={4} className="mb-0">
              Returns
            </Title>
            <Text type="secondary">Manage customer return requests</Text>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder="Search by order, customer or reason"
            allowClear
            className="w-full sm:w-auto sm:min-w-[260px]"
            onSearch={(value) => {
              setSearch(value)
              setPage(1)
            }}
          />
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table
            rowKey={(record) => record._id}
            loading={isLoading}
            columns={columns}
            dataSource={returns}
            scroll={{ x: 'max-content' }}
            pagination={{
              current: page,
              pageSize: limit,
              total: data?.pagination.total ?? 0,
              showSizeChanger: true,
              showQuickJumper: false,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
              onChange: (p, pageSize) => {
                setPage(p)
                setLimit(pageSize)
              },
              responsive: true,
            }}
            locale={{ emptyText: <Empty description="No returns found" /> }}
          />
        </div>

        <Modal
          open={!!activeReturn}
          title="Return Detail"
          footer={null}
          onCancel={() => setActiveReturnId(null)}
          width={720}
        >
          {!activeReturn ? (
            <Empty description="No return selected" />
          ) : (
            <Space direction="vertical" size="large" className="w-full">
              <div>
                <Text type="secondary">Return ID</Text>
                <div className="font-mono text-sm">{activeReturn._id}</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text type="secondary">Order</Text>
                  <div className="text-sm font-medium">
                    {activeReturn.order?.orderNumber || activeReturn.order?._id}
                  </div>
                  <div className="text-xs text-gray-500">
                    Status: {activeReturn.order?.status || '—'}
                  </div>
                </div>
                <div>
                  <Text type="secondary">Customer</Text>
                  <div className="text-sm font-medium">
                    {activeReturn.customer?.name || activeReturn.customer?._id}
                  </div>
                  <div className="text-xs text-gray-500">{activeReturn.customer?.email}</div>
                </div>
              </div>

              <div>
                <Text type="secondary">Return Type</Text>
                <div className="text-sm font-medium">
                  <Tag color={activeReturn.returnType === 'replacement' ? 'blue' : 'default'}>
                    {activeReturn.returnType === 'replacement' ? 'Replacement' : 'Return & Refund'}
                  </Tag>
                </div>
              </div>

              <div>
                <Text type="secondary">Reason</Text>
                <div className="text-sm font-medium">{activeReturn.reason}</div>
                {activeReturn.description && (
                  <div className="mt-1 text-xs text-gray-600 whitespace-pre-wrap">
                    {activeReturn.description}
                  </div>
                )}
              </div>

              {/* Replacement Item Details */}
              {activeReturn.returnType === 'replacement' && activeReturn.exchangeVariantId && (
                <Card size="small" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                  <div className="space-y-3">
                    <div>
                      <Text strong className="text-sm">
                        Replacement Item
                      </Text>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Text type="secondary" className="text-xs">
                          Variant Name
                        </Text>
                        <div className="text-sm font-medium">
                          {activeReturn.exchangeVariantId.name || '—'}
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" className="text-xs">
                          SKU
                        </Text>
                        <div className="text-sm font-mono">
                          {activeReturn.exchangeVariantId.sku}
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" className="text-xs">
                          Price
                        </Text>
                        <div className="text-sm font-medium">
                          ₹
                          {activeReturn.exchangeVariantId.effectivePrice ||
                            activeReturn.exchangeVariantId.price ||
                            0}
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" className="text-xs">
                          Stock Available
                        </Text>
                        <div className="text-sm font-medium">
                          <Tag
                            color={
                              activeReturn.exchangeVariantId.stock &&
                              activeReturn.exchangeVariantId.stock > 0
                                ? 'green'
                                : 'red'
                            }
                          >
                            {activeReturn.exchangeVariantId.stock || 0} units
                          </Tag>
                        </div>
                      </div>
                      {activeReturn.exchangeVariantId.attributes &&
                        Object.keys(activeReturn.exchangeVariantId.attributes).length > 0 && (
                          <div className="md:col-span-2">
                            <Text type="secondary" className="text-xs">
                              Attributes
                            </Text>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {Object.entries(activeReturn.exchangeVariantId.attributes).map(
                                ([key, value]) => (
                                  <Tag key={key}>
                                    {key}: {value}
                                  </Tag>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      {activeReturn.exchangeVariantId.mainImage && (
                        <div className="md:col-span-2">
                          <img
                            src={activeReturn.exchangeVariantId.mainImage}
                            alt="Replacement variant"
                            className="w-20 h-20 rounded object-cover border"
                          />
                        </div>
                      )}
                    </div>
                    {activeReturn.exchangeOrderId && (
                      <div className="pt-2 border-t border-blue-200">
                        <Text type="secondary" className="text-xs">
                          Replacement Order
                        </Text>
                        <div className="text-sm font-medium">
                          {activeReturn.exchangeOrderId.orderNumber ||
                            activeReturn.exchangeOrderId._id}
                        </div>
                        <div className="text-xs text-gray-500">
                          Status: {activeReturn.exchangeOrderId.status || '—'}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Financial Details */}
              <Card size="small" style={{ background: '#fefce8', borderColor: '#fde047' }}>
                <div className="space-y-2">
                  <Text strong className="text-sm">
                    Financial Details
                  </Text>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Text type="secondary" className="text-xs">
                        Refund Amount
                      </Text>
                      <div className="text-lg font-semibold text-green-600">
                        ₹{activeReturn.refundAmount.toFixed(2)}
                      </div>
                    </div>
                    {activeReturn.reverseCharges !== undefined &&
                      activeReturn.reverseCharges > 0 && (
                        <div>
                          <Text type="secondary" className="text-xs">
                            Collectable Amount (Reverse Charges)
                          </Text>
                          <div className="text-lg font-semibold text-orange-600">
                            ₹{activeReturn.reverseCharges.toFixed(2)}
                          </div>
                        </div>
                      )}
                    {activeReturn.settlementAdjustment !== undefined && (
                      <div>
                        <Text type="secondary" className="text-xs">
                          Settlement Adjustment
                        </Text>
                        <div
                          className={`text-sm font-medium ${
                            activeReturn.settlementAdjustment >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          ₹{activeReturn.settlementAdjustment.toFixed(2)}
                        </div>
                      </div>
                    )}
                    {activeReturn.creditNote?.credit_note_url && (
                      <div className="md:col-span-2">
                        <Text type="secondary" className="text-xs">
                          Credit Note
                        </Text>
                        <div className="flex items-center gap-2 mt-1">
                          <Text code className="text-sm">
                            {activeReturn.creditNote.credit_note_number}
                          </Text>
                          <Button
                            size="small"
                            type="link"
                            icon={<FilePdfOutlined />}
                            onClick={() => {
                              window.open(activeReturn.creditNote!.credit_note_url, '_blank')
                            }}
                          >
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {activeReturn.images &&
                activeReturn.images.length > 0 &&
                (() => {
                  // Separate images and videos based on file extension
                  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']
                  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi']

                  // Helper function to check if URL has a specific extension
                  const hasExtension = (url: string, extensions: string[]): boolean => {
                    try {
                      const urlObj = new URL(url)
                      const pathname = urlObj.pathname.toLowerCase()
                      // Remove query string and check if pathname ends with any extension
                      return extensions.some((ext) => pathname.endsWith(ext.toLowerCase()))
                    } catch {
                      // If URL parsing fails, check if the string ends with extension
                      const lowerUrl = url.toLowerCase()
                      return extensions.some((ext) => {
                        const extLower = ext.toLowerCase()
                        // Check if URL ends with extension (before query params if any)
                        const withoutQuery = lowerUrl.split('?')[0]
                        return withoutQuery.endsWith(extLower)
                      })
                    }
                  }

                  const images = activeReturn.images.filter((url: string) => {
                    return hasExtension(url, imageExtensions)
                  })

                  const videos = activeReturn.images.filter((url: string) => {
                    return hasExtension(url, videoExtensions)
                  })

                  return images.length > 0 || videos.length > 0 ? (
                    <div>
                      <Text type="secondary">Return Photos & Videos</Text>
                      <div className="mt-2">
                        <Space size="middle" wrap>
                          {/* Images */}
                          {images.length > 0 && (
                            <Image.PreviewGroup>
                              {images.map((img, idx) => (
                                <Image
                                  key={`img-${idx}`}
                                  src={img}
                                  alt={`Return image ${idx + 1}`}
                                  width={80}
                                  height={80}
                                  style={{ borderRadius: 8, objectFit: 'cover' }}
                                />
                              ))}
                            </Image.PreviewGroup>
                          )}
                          {/* Videos */}
                          {videos.length > 0 &&
                            videos.map((video, idx) => (
                              <video
                                key={`video-${idx}`}
                                src={video}
                                width={80}
                                height={80}
                                style={{
                                  borderRadius: 8,
                                  objectFit: 'cover',
                                  cursor: 'pointer',
                                }}
                                controls
                                muted
                                playsInline
                                preload="metadata"
                              >
                                Your browser does not support the video tag.
                              </video>
                            ))}
                        </Space>
                      </div>
                    </div>
                  ) : null
                })()}

              {/* Reverse shipment details (AWB, courier, charges) */}
              {(activeReturn.courierReverseAwb ||
                activeReturn.courierReverseId ||
                activeReturn.courierPartner ||
                activeReturn.reverseCharges) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Text type="secondary">Reverse Shipment</Text>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs space-y-1">
                      {activeReturn.courierReverseAwb && (
                        <div>
                          <span className="text-gray-500">AWB:&nbsp;</span>
                          <span className="font-mono text-gray-900">
                            {activeReturn.courierReverseAwb}
                          </span>
                        </div>
                      )}
                      {activeReturn.courierReverseId && (
                        <div>
                          <span className="text-gray-500">Courier Order ID:&nbsp;</span>
                          <span className="font-mono text-gray-900">
                            {activeReturn.courierReverseId}
                          </span>
                        </div>
                      )}
                      {activeReturn.courierPartner && (
                        <div>
                          <span className="text-gray-500">Courier:&nbsp;</span>
                          <span className="text-gray-900">{activeReturn.courierPartner}</span>
                        </div>
                      )}
                      {typeof activeReturn.reverseCharges === 'number' && (
                        <div>
                          <span className="text-gray-500">Reverse Charges:&nbsp;</span>
                          <span className="text-gray-900">
                            ₹{(activeReturn.reverseCharges || 0).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Text type="secondary">Timeline</Text>
                {activeReturn.timeline && activeReturn.timeline.length > 0 ? (
                  <Timeline
                    style={{ marginTop: 12 }}
                    items={activeReturn.timeline.map((t) => ({
                      color: statusColors[t.status] || 'blue',
                      children: (
                        <div>
                          <div className="text-xs font-medium">
                            {mapReturnStatusForSeller(t.status)}
                          </div>
                          <div className="text-[11px] text-gray-500">
                            {dayjs(t.timestamp).format('DD MMM YYYY, HH:mm')}
                          </div>
                          {t.message && (
                            <div className="text-[11px] text-gray-600 mt-1">{t.message}</div>
                          )}
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No timeline events" />
                )}
              </div>
            </Space>
          )}
        </Modal>

        <Modal
          open={!!rejectingId}
          title="Reject Return"
          okText="Reject"
          okButtonProps={{ danger: true, loading: rejectMutation.isPending }}
          onOk={async () => {
            if (!rejectingId) return
            try {
              await rejectMutation.mutateAsync({
                id: rejectingId,
                reason: rejectReason,
              })
              message.success('Return rejected')
              setRejectingId(null)
              setRejectReason('')
            } catch (err: unknown) {
              message.error((err as Error)?.message || 'Failed to reject return')
            }
          }}
          onCancel={() => {
            setRejectingId(null)
            setRejectReason('')
          }}
        >
          <p className="text-sm text-gray-700 mb-2">
            Optionally provide a reason for rejecting this return request. This may be shared with
            the customer via support.
          </p>
          <Input.TextArea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
          />
        </Modal>

        <Modal
          open={!!quoteReturnId}
          title="Return Serviceability & Confirmation"
          width={700}
          footer={null}
          onCancel={() => {
            setQuoteReturnId(null)
          }}
        >
          {isLoadingQuote ? (
            <div className="flex justify-center items-center py-8">
              <Spin size="large" />
            </div>
          ) : quoteData?.success && quoteData.data ? (
            <Space direction="vertical" size="large" className="w-full">
              {/* Return Rate Information */}
              {selectedCourier ? (
                <div>
                  <Text type="secondary" className="text-sm">
                    Return Rate
                  </Text>
                  <Card className="mt-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-base">{selectedCourier.courier_name}</div>
                        {(selectedCourier.rate !== undefined && selectedCourier.rate !== null) && (
                          <div className="mt-2">
                            <span className="text-sm text-gray-600">Rate: </span>
                            <span className="text-lg font-semibold text-gray-900">
                              ₹
                              {typeof selectedCourier.rate === 'number'
                                ? selectedCourier.rate.toFixed(2)
                                : selectedCourier.rate}
                            </span>
                          </div>
                        )}
                        {selectedCourier.zone && <Tag className="mt-2">{selectedCourier.zone}</Tag>}
                      </div>
                      {selectedCourier.serviceable === false && (
                        <Tag color="red">Not Serviceable</Tag>
                      )}
                    </div>
                  </Card>
                </div>
              ) : (
                <Alert
                  message="No couriers available"
                  description="No serviceable couriers are available for this return. Please contact support."
                  type="warning"
                  showIcon
                />
              )}
              <div>
                <Text type="secondary" className="text-sm">
                  Package Details
                </Text>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <Text type="secondary">Package Weight</Text>
                    <Text>{quoteData.data.weightGrams}g</Text>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <Text type="secondary">Package Dimensions</Text>
                    <Text>
                      {quoteData.data.packageDimensions.length ?? 0} ×{' '}
                      {quoteData.data.packageDimensions.breadth ??
                        (quoteData.data.packageDimensions as { width?: number }).width ??
                        0}{' '}
                      × {quoteData.data.packageDimensions.height ?? 0} cm
                    </Text>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text type="secondary" className="text-sm">
                    Pickup Address
                  </Text>
                  <div className="mt-2 p-4 bg-white rounded-lg border border-gray-200">
                    {quoteData.data.pickupAddress ? (
                      <>
                        <div className="font-medium text-gray-900">
                          {quoteData.data.pickupAddress.warehouseName || 'Pickup Location'}
                        </div>
                        <div className="text-sm text-gray-700 mt-1">
                          {quoteData.data.pickupAddress.addressLine1}
                          {quoteData.data.pickupAddress.addressLine2
                            ? `, ${quoteData.data.pickupAddress.addressLine2}`
                            : ''}
                        </div>
                        <div className="text-sm text-gray-700">
                          {quoteData.data.pickupAddress.city}, {quoteData.data.pickupAddress.state}{' '}
                          {quoteData.data.pickupAddress.postalCode}
                        </div>
                        {quoteData.data.pickupAddress.country && (
                          <div className="text-sm text-gray-700">
                            {quoteData.data.pickupAddress.country}
                          </div>
                        )}
                        {(quoteData.data.pickupAddress.contactName ||
                          quoteData.data.pickupAddress.contactPhone) && (
                          <div className="text-sm text-gray-700 mt-2">
                            {quoteData.data.pickupAddress.contactName &&
                              `Contact: ${quoteData.data.pickupAddress.contactName}`}
                            {quoteData.data.pickupAddress.contactPhone &&
                              ` (${quoteData.data.pickupAddress.contactPhone})`}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Pickup address will be used from seller settings.
                      </div>
                    )}
                  </div>
                  <div className="mt-4">
                    <Text type="secondary" className="text-sm">
                      RTO Address
                    </Text>
                    <div className="mt-2 p-4 bg-white rounded-lg border border-gray-200">
                      {quoteData.data.rtoAddress ? (
                        <>
                          <div className="text-sm text-gray-700">
                            {quoteData.data.rtoAddress.addressLine1}
                            {quoteData.data.rtoAddress.addressLine2
                              ? `, ${quoteData.data.rtoAddress.addressLine2}`
                              : ''}
                          </div>
                          <div className="text-sm text-gray-700">
                            {quoteData.data.rtoAddress.city}, {quoteData.data.rtoAddress.state}{' '}
                            {quoteData.data.rtoAddress.postalCode}
                          </div>
                          {quoteData.data.rtoAddress.country && (
                            <div className="text-sm text-gray-700">
                              {quoteData.data.rtoAddress.country}
                            </div>
                          )}
                          {(quoteData.data.rtoAddress.contactName ||
                            quoteData.data.rtoAddress.contactPhone) && (
                            <div className="text-sm text-gray-700 mt-2">
                              {quoteData.data.rtoAddress.contactName &&
                                `Contact: ${quoteData.data.rtoAddress.contactName}`}
                              {quoteData.data.rtoAddress.contactPhone &&
                                ` (${quoteData.data.rtoAddress.contactPhone})`}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-500">
                          RTO address will default to the pickup address.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <Text type="secondary" className="text-sm">
                    By confirming, you approve this return and a reverse pickup will be created with
                    the courier.
                  </Text>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setQuoteReturnId(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  loading={confirmMutation.isPending}
                  disabled={!selectedCourier}
                  onClick={async () => {
                    if (!quoteReturnId || !selectedCourier) return
                    try {
                      await confirmMutation.mutateAsync({
                        id: quoteReturnId,
                        weightGrams: quoteData.data.weightGrams,
                        packageDimensions: {
                          length: quoteData.data.packageDimensions.length ?? 10,
                          breadth:
                            quoteData.data.packageDimensions.breadth ??
                            (quoteData.data.packageDimensions as { width?: number }).width ??
                            10,
                          height: quoteData.data.packageDimensions.height ?? 10,
                        },
                        courier_id: selectedCourier.courier_id,
                      })
                      message.success('Return approved and reverse shipment created')
                      setQuoteReturnId(null)
                    } catch {
                      message.error('Failed to confirm return approval')
                    }
                  }}
                >
                  Confirm & Approve
                </Button>
              </div>
            </Space>
          ) : (
            <div className="py-4">
              <Text type="danger">
                Failed to load return quote. Please try again or contact support.
              </Text>
              <div className="flex justify-end mt-4">
                <Button onClick={() => setQuoteReturnId(null)}>Close</Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Raise Query Modal */}
        <Modal
          open={!!raiseQueryReturn}
          title="Raise Query for Return"
          okText="Create Ticket"
          cancelText="Cancel"
          okButtonProps={{ loading: createTicketMutation.isPending }}
          onOk={async () => {
            if (!raiseQueryReturn) return
            const returnData = returns.find((r) => r._id === raiseQueryReturn)
            if (!returnData) return
            try {
              const orderInfo = returnData.order
                ? returnData.order.orderNumber || returnData.order._id || 'N/A'
                : 'N/A'
              const customerInfo = returnData.customer?.name || 'N/A'

              await createTicketMutation.mutateAsync({
                subject: `Query regarding Return${
                  orderInfo !== 'N/A' ? ` - Order ${orderInfo}` : ''
                }`,
                category: 'refund',
                description: `I have a question regarding this return:\n\nReturn ID: ${
                  returnData._id
                }\nOrder: ${orderInfo}\nCustomer: ${customerInfo}\nReason: ${
                  returnData.reason
                }\nRefund Amount: ₹${returnData.refundAmount.toFixed(2)}\nStatus: ${
                  returnData.status
                }\n\nPlease provide clarification.`,
                priority: 'medium',
                refundRequestId: returnData._id,
                orderId: returnData.order?._id,
              })
              message.success('Ticket created successfully')
              setRaiseQueryReturn(null)
              navigate('/tickets')
            } catch {
              message.error('Failed to create ticket. Please try again.')
            }
          }}
          onCancel={() => setRaiseQueryReturn(null)}
        >
          {raiseQueryReturn && (
            <div>
              <p>
                Create a support ticket for this return to get assistance from our support team.
              </p>
              <Alert
                message="Ticket will include return details"
                description="The ticket will automatically include all relevant information about this return for faster resolution."
                type="info"
                showIcon
                style={{ marginTop: 16 }}
              />
            </div>
          )}
        </Modal>
      </Space>
    </Card>
  )
}

export default ReturnsPage
