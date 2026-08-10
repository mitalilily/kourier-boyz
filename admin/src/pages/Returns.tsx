import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Image,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import {
  useAdminApproveReturn,
  useAdminCancelReturn,
  useAdminCreateReversePickup,
  useAdminMarkRefundCompleted,
  useAdminMarkRefundInitiated,
  useAdminMarkReturnReceived,
  useAdminRejectReturn,
  useAdminReturnServiceability,
  useAdminReturns,
} from '../api/returns'
import { useAdminOrder } from '../api/orderQueries'
import CreateReturnModal from '../components/orders/CreateReturnModal'

const { RangePicker } = DatePicker
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

const ReturnsPage = () => {
  const { message } = App.useApp()
  const [filters, setFilters] = useState({
    search: '',
    status: undefined as string | undefined,
    dateRange: [null, null] as [dayjs.Dayjs | null, dayjs.Dayjs | null],
    page: 1,
    limit: 20,
  })
  const [activeReturnId, setActiveReturnId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCreateReturnModalOpen, setIsCreateReturnModalOpen] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(undefined)
  const [orderSearchInput, setOrderSearchInput] = useState('')
  const [reversePickupReturnId, setReversePickupReturnId] = useState<string | null>(null)

  const { data, isLoading } = useAdminReturns({
    status: filters.status,
    page: filters.page,
    limit: filters.limit,
  })

  const approveMutation = useAdminApproveReturn()
  const rejectMutation = useAdminRejectReturn()
  const cancelMutation = useAdminCancelReturn()
  const reversePickupMutation = useAdminCreateReversePickup()
  const markReceivedMutation = useAdminMarkReturnReceived()
  const refundInitMutation = useAdminMarkRefundInitiated()
  const refundCompleteMutation = useAdminMarkRefundCompleted()
  const { data: serviceabilityData, isLoading: isLoadingServiceability } =
    useAdminReturnServiceability(reversePickupReturnId)

  // Serviceability API returns couriers sorted by fastest and economical (best courier first)
  const selectedCourier =
    serviceabilityData?.success && serviceabilityData.data?.couriers && serviceabilityData.data.couriers.length > 0
      ? serviceabilityData.data.couriers[0]
      : null

  // Fetch order for creating return
  const { data: orderData } = useAdminOrder(selectedOrderId)
  const selectedOrder = orderData?.data

  const returns =
    data?.data?.filter((r) => {
      if (!filters.search.trim()) return true
      const term = filters.search.toLowerCase()
      return (
        r.order?.orderNumber?.toLowerCase().includes(term) ||
        r.customer?.name?.toLowerCase().includes(term) ||
        r.seller?.businessName?.toLowerCase().includes(term) ||
        r.reason.toLowerCase().includes(term)
      )
    }) || []

  const columns: ColumnsType<(typeof returns)[number]> = [
    {
      title: 'Return',
      dataIndex: '_id',
      render: (value) => <Text code>{String(value).slice(-8)}</Text>,
    },
    {
      title: 'Order',
      dataIndex: 'order',
      render: (order) => (
        <div>
          <div className="font-medium">{order?.orderNumber || order?._id}</div>
          <div className="text-xs text-gray-500">{order?.status}</div>
        </div>
      ),
    },
    {
      title: 'Seller',
      dataIndex: 'seller',
      render: (seller) => (
        <div>
          <div className="font-medium">{seller?.businessName || seller?.name}</div>
          <div className="text-xs text-gray-500">{seller?._id}</div>
        </div>
      ),
    },
    {
      title: 'Customer',
      dataIndex: 'customer',
      render: (customer) => (
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
    },
    {
      title: 'Refund',
      dataIndex: 'refundAmount',
      render: (v: number) => `₹${(v || 0).toFixed(2)}`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (value: string) => (
        <Tag color={statusColors[value] || 'default'}>{value.replace(/_/g, ' ')}</Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" type="link" onClick={() => setActiveReturnId(record._id)}>
            View
          </Button>
          {record.status === 'REQUESTED' && (
            <>
              <Button
                size="small"
                type="link"
                onClick={async () => {
                  try {
                    await approveMutation.mutateAsync(record._id)
                    message.success('Return approved (admin)')
                  } catch (err: any) {
                    message.error(err?.message || 'Failed to approve return')
                  }
                }}
              >
                Approve
              </Button>
              <Button
                size="small"
                type="link"
                danger
                onClick={() => {
                  setRejectingId(record._id)
                  setRejectReason('')
                }}
              >
                Reject
              </Button>
              <Button
                size="small"
                type="link"
                danger
                onClick={() => {
                  setCancellingId(record._id)
                  setCancelReason('')
                }}
              >
                Cancel
              </Button>
            </>
          )}
          {(record.status === 'APPROVED_BY_SELLER' || record.status === 'APPROVED_BY_ADMIN') &&
            !record.courierReverseAwb && (
              <>
                {record.status === 'APPROVED_BY_ADMIN' && (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      setReversePickupReturnId(record._id)
                    }}
                  >
                    Create Reverse Pickup
                  </Button>
                )}
                <Button
                  size="small"
                  type="link"
                  danger
                  onClick={() => {
                    setCancellingId(record._id)
                    setCancelReason('')
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
          {record.status === 'REVERSE_PICKUP_COMPLETED' && (
            <Button
              size="small"
              type="link"
              onClick={async () => {
                try {
                  await markReceivedMutation.mutateAsync(record._id)
                  message.success('Marked as received by seller')
                } catch (err: any) {
                  message.error(err?.message || 'Failed to mark as received')
                }
              }}
              loading={markReceivedMutation.isPending}
            >
              Mark Received
            </Button>
          )}
          {record.status === 'RETURN_RECEIVED_BY_SELLER' && (
            <Button
              size="small"
              type="link"
              onClick={async () => {
                try {
                  await refundInitMutation.mutateAsync(record._id)
                  message.success('Refund marked as initiated')
                } catch (err: any) {
                  message.error(err?.message || 'Failed to mark refund initiated')
                }
              }}
              loading={refundInitMutation.isPending}
            >
              Mark Refund Initiated
            </Button>
          )}
          {record.status === 'REFUND_INITIATED' && (
            <Button
              size="small"
              type="link"
              onClick={async () => {
                try {
                  await refundCompleteMutation.mutateAsync(record._id)
                  message.success('Refund completed')
                } catch (err: any) {
                  message.error(err?.message || 'Failed to complete refund')
                }
              }}
              loading={refundCompleteMutation.isPending}
            >
              Complete Refund
            </Button>
          )}
        </Space>
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
            <Text type="secondary">Monitor and manage marketplace returns</Text>
          </div>
          <Button
            type="primary"
            onClick={() => {
              setOrderSearchInput('')
              setSelectedOrderId(undefined)
              setIsCreateReturnModalOpen(true)
            }}
          >
            Create Return/Replacement
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Input.Search
            placeholder="Search by order, seller, customer or reason"
            allowClear
            style={{ width: 260 }}
            onSearch={(value) =>
              setFilters((prev) => ({
                ...prev,
                search: value,
                page: 1,
              }))
            }
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 220 }}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status: value,
                page: 1,
              }))
            }
            options={Object.keys(statusColors).map((s) => ({
              value: s,
              label: s.replace(/_/g, ' '),
            }))}
          />
          <RangePicker
            onChange={(values) =>
              setFilters((prev) => ({
                ...prev,
                dateRange: values || [null, null],
                page: 1,
              }))
            }
          />
        </div>

        <Table
          rowKey={(record) => record._id}
          loading={isLoading}
          columns={columns}
          dataSource={returns}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: data?.pagination.total ?? 0,
            showSizeChanger: true,
            onChange: (page, pageSize) =>
              setFilters((prev) => ({
                ...prev,
                page,
                limit: pageSize,
              })),
          }}
          locale={{ emptyText: <Empty description="No returns found" /> }}
        />

        <Modal
          open={!!activeReturn}
          title="Return Detail"
          footer={null}
          onCancel={() => setActiveReturnId(null)}
          width={800}
        >
          {!activeReturn ? (
            <Empty description="No return selected" />
          ) : (
            <Space direction="vertical" size="large" className="w-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Text type="secondary">Return ID</Text>
                  <div className="font-mono text-sm">{activeReturn._id}</div>
                </div>
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
                  <Text type="secondary">Seller</Text>
                  <div className="text-sm font-medium">
                    {activeReturn.seller?.businessName || activeReturn.seller?.name}
                  </div>
                  <div className="text-xs text-gray-500">{activeReturn.seller?._id}</div>
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
                        <div className="text-sm font-mono">{activeReturn.exchangeVariantId.sku}</div>
                      </div>
                      <div>
                        <Text type="secondary" className="text-xs">
                          Price
                        </Text>
                        <div className="text-sm font-medium">
                          ₹{activeReturn.exchangeVariantId.effectivePrice || activeReturn.exchangeVariantId.price || 0}
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" className="text-xs">
                          Stock Available
                        </Text>
                        <div className="text-sm font-medium">
                          <Tag color={activeReturn.exchangeVariantId.stock && activeReturn.exchangeVariantId.stock > 0 ? 'green' : 'red'}>
                            {activeReturn.exchangeVariantId.stock || 0} units
                          </Tag>
                        </div>
                      </div>
                      {activeReturn.exchangeVariantId.attributes && Object.keys(activeReturn.exchangeVariantId.attributes).length > 0 && (
                        <div className="md:col-span-2">
                          <Text type="secondary" className="text-xs">
                            Attributes
                          </Text>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(activeReturn.exchangeVariantId.attributes).map(([key, value]) => (
                              <Tag key={key}>
                                {key}: {value}
                              </Tag>
                            ))}
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
                          {activeReturn.exchangeOrderId.orderNumber || activeReturn.exchangeOrderId._id}
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
                    {activeReturn.reverseCharges !== undefined && activeReturn.reverseCharges > 0 && (
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
                        <div className={`text-sm font-medium ${activeReturn.settlementAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
                            onClick={() => {
                              if (activeReturn.creditNote?.credit_note_url) {
                                window.open(activeReturn.creditNote.credit_note_url, '_blank')
                              }
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

              {/* Courier Details */}
              {activeReturn.courierReverseAwb && (
                <Card size="small" style={{ background: '#f5f5f5' }}>
                  <div className="space-y-2">
                    <Text strong className="text-sm">
                      Reverse Pickup Details
                    </Text>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Text type="secondary" className="text-xs">
                          AWB Number
                        </Text>
                        <div className="text-sm font-mono">{activeReturn.courierReverseAwb}</div>
                      </div>
                      {activeReturn.courierPartner && (
                        <div>
                          <Text type="secondary" className="text-xs">
                            Courier Partner
                          </Text>
                          <div className="text-sm">{activeReturn.courierPartner}</div>
                        </div>
                      )}
                      {activeReturn.courierReverseId && (
                        <div>
                          <Text type="secondary" className="text-xs">
                            Courier Order ID
                          </Text>
                          <div className="text-sm font-mono">{activeReturn.courierReverseId}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {activeReturn.images && activeReturn.images.length > 0 && (() => {
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
                
                return (images.length > 0 || videos.length > 0) ? (
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
                                style={{ borderRadius: 8, objectFit: "cover" }}
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
                                objectFit: "cover",
                                cursor: "pointer",
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

              <div>
                <Text type="secondary">Timeline</Text>
                {activeReturn.timeline && activeReturn.timeline.length > 0 ? (
                  <Timeline
                    style={{ marginTop: 12 }}
                    items={activeReturn.timeline.map((t) => ({
                      color: statusColors[t.status] || 'blue',
                      children: (
                        <div>
                          <div className="text-xs font-medium">{t.status.replace(/_/g, ' ')}</div>
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
              await rejectMutation.mutateAsync({ id: rejectingId, reason: rejectReason })
              message.success('Return rejected')
              setRejectingId(null)
              setRejectReason('')
            } catch (err: any) {
              message.error(err?.message || 'Failed to reject return')
            }
          }}
          onCancel={() => {
            setRejectingId(null)
            setRejectReason('')
          }}
        >
          <p className="text-sm text-gray-700 mb-2">
            Optionally provide a reason for rejecting this return request. This may be shared with
            the seller and customer via support.
          </p>
          <Input.TextArea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
          />
        </Modal>

        <Modal
          open={!!cancellingId}
          title="Cancel Return Request"
          okText="Cancel Return"
          okButtonProps={{ danger: true, loading: cancelMutation.isPending }}
          onOk={async () => {
            if (!cancellingId) return
            try {
              await cancelMutation.mutateAsync({ id: cancellingId, reason: cancelReason })
              message.success('Return request cancelled')
              setCancellingId(null)
              setCancelReason('')
            } catch (err: any) {
              message.error(err?.message || 'Failed to cancel return')
            }
          }}
          onCancel={() => {
            setCancellingId(null)
            setCancelReason('')
          }}
        >
          <Alert
            message="Cancel Return Request"
            description="This will cancel the return request. This action can only be performed before reverse pickup is created. Once cancelled, the return cannot be resumed."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <p className="text-sm text-gray-700 mb-2">
            Optionally provide a reason for cancelling this return request. This may be shared with
            the customer via email.
          </p>
          <Input.TextArea
            rows={3}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)"
          />
        </Modal>

        {/* Order Selection Modal for Creating Return */}
        <Modal
          open={isCreateReturnModalOpen && (!selectedOrder || (selectedOrder && selectedOrder.status !== 'delivered'))}
          title="Select Order for Return/Replacement"
          onCancel={() => {
            setIsCreateReturnModalOpen(false)
            setOrderSearchInput('')
            setSelectedOrderId(undefined)
          }}
          footer={null}
        >
          <Space direction="vertical" className="w-full" size="middle">
            <div>
              <Text strong>Enter Order Number or Order ID</Text>
              <Input.Search
                placeholder="Search by order number or ID"
                value={orderSearchInput}
                onChange={(e) => setOrderSearchInput(e.target.value)}
                onSearch={(value) => {
                  if (value.trim()) {
                    setSelectedOrderId(value.trim())
                  }
                }}
                enterButton="Load Order"
                style={{ marginTop: 8 }}
              />
            </div>
            {selectedOrderId && !orderData && (
              <div className="text-center py-4">
                <Text type="secondary">Loading order...</Text>
              </div>
            )}
            {selectedOrderId && orderData && !selectedOrder && (
              <div className="text-center py-4">
                <Text type="danger">Order not found. Please check the order number/ID.</Text>
              </div>
            )}
            {selectedOrderId && orderData && selectedOrder && (
              <Card size="small">
                <Space direction="vertical" className="w-full" size="small">
                  <div>
                    <Text type="secondary" className="text-xs">Order Number</Text>
                    <div className="font-medium">{selectedOrder.orderNumber || selectedOrder._id}</div>
                  </div>
                  <div>
                    <Text type="secondary" className="text-xs">Order Status</Text>
                    <div>
                      <Tag color={selectedOrder.status === 'delivered' ? 'green' : 'orange'}>
                        {selectedOrder.status}
                      </Tag>
                    </div>
                  </div>
                  {selectedOrder.status !== 'delivered' && (
                    <Alert
                      message="Order Not Delivered"
                      description={`This order has status "${selectedOrder.status}". Only delivered orders can be returned or replaced. Please wait until the order is delivered.`}
                      type="error"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                  {selectedOrder.status === 'delivered' && (
                    <Alert
                      message="Order is Delivered"
                      description="This order is eligible for return/replacement. The return creation form will open automatically."
                      type="success"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Space>
              </Card>
            )}
          </Space>
        </Modal>

        {/* Create Return Modal */}
        {selectedOrder && selectedOrder.status === 'delivered' && (
          <CreateReturnModal
            open={isCreateReturnModalOpen && !!selectedOrder && selectedOrder.status === 'delivered'}
            onClose={() => {
              setIsCreateReturnModalOpen(false)
              setOrderSearchInput('')
              setSelectedOrderId(undefined)
              // Reset selected order to allow selecting a new one
              setTimeout(() => {
                setSelectedOrderId(undefined)
              }, 100)
            }}
            order={selectedOrder}
          />
        )}

        {/* Reverse Pickup Modal with Courier Selection */}
        <Modal
          open={!!reversePickupReturnId}
          title="Create Reverse Pickup"
          width={700}
          footer={null}
          onCancel={() => {
            setReversePickupReturnId(null)
          }}
        >
          {isLoadingServiceability ? (
            <div className="flex justify-center items-center py-8">
              <Spin size="large" />
            </div>
          ) : serviceabilityData?.success && serviceabilityData.data ? (
            <Space direction="vertical" size="large" className="w-full">
              {/* Pickup charges (forward shipment: customer → seller) */}
              {selectedCourier ? (
                <div>
                  <Text type="secondary" className="text-sm">
                    Pickup Charges (deducted from seller)
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
                    <Text>{serviceabilityData.data.weightGrams}g</Text>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <Text type="secondary">Package Dimensions</Text>
                    <Text>
                      {serviceabilityData.data.packageDimensions.length ?? 0} ×{' '}
                      {serviceabilityData.data.packageDimensions.breadth ??
                        (serviceabilityData.data.packageDimensions as { width?: number }).width ??
                        0}{' '}
                      × {serviceabilityData.data.packageDimensions.height ?? 0} cm
                    </Text>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setReversePickupReturnId(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  loading={reversePickupMutation.isPending}
                  disabled={!selectedCourier}
                  onClick={async () => {
                    if (!reversePickupReturnId || !selectedCourier) return
                    try {
                      await reversePickupMutation.mutateAsync({
                        id: reversePickupReturnId,
                        payload: {
                          weightGrams: serviceabilityData.data.weightGrams,
                          packageDimensions: serviceabilityData.data.packageDimensions,
                          courier_id: selectedCourier.courier_id,
                        },
                      })
                      message.success('Reverse pickup created')
                      setReversePickupReturnId(null)
                    } catch (err: any) {
                      message.error(err?.message || 'Failed to create reverse pickup')
                    }
                  }}
                >
                  Create Reverse Pickup
                </Button>
              </div>
            </Space>
          ) : (
            <div className="py-4">
              <Text type="danger">
                Failed to load serviceability. Please try again or contact support.
              </Text>
              <div className="flex justify-end mt-4">
                <Button onClick={() => {
                  setReversePickupReturnId(null)
                }}>Close</Button>
              </div>
            </div>
          )}
        </Modal>
      </Space>
    </Card>
  )
}

export default ReturnsPage


