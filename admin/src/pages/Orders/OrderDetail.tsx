import { ArrowLeftOutlined, CopyOutlined, FilePdfOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAdminOrder,
  useCancelOrder,
  useCreateManualRefund,
  useDownloadInvoice,
  useDownloadLabel,
  useOrderRefunds,
  useRegenerateLabel,
  useUpdateAdminOrderStatus,
  useUpdateAdminPaymentStatus,
  useUpdateAdminSellerShipmentStatus,
} from '../../api/orderQueries'
import type {
  AdminOrder,
  AdminRefund,
  AdminSellerShipment,
  OrderStatus,
  SellerShipmentStatus,
} from '../../api/orders'
import type { AdminReturn } from '../../api/returns'
import { useAdminCancelReturn, useOrderReturns } from '../../api/returns'
import CreateReturnModal from '../../components/orders/CreateReturnModal'
import RequestPickupModal from '../../components/orders/RequestPickupModal'
import TrackingModal from '../../components/orders/TrackingModal'

const { Title, Text } = Typography

const orderStatusOptions: { label: string; value: OrderStatus }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready_to_ship', label: 'Ready to Ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
]

const paymentStatusOptions: { label: string; value: 'pending' | 'paid' | 'failed' | 'refunded' }[] =
  [
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
  ]

const sellerStatusOptions: { label: string; value: SellerShipmentStatus }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready_to_ship', label: 'Ready to Ship' },
  { value: 'pickup_requested', label: 'Pickup Requested' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const statusColorMap: Record<string, string> = {
  pending: 'default',
  processing: 'blue',
  ready_to_ship: 'gold',
  pickup_requested: 'cyan',
  shipped: 'blue',
  in_transit: 'purple',
  out_for_delivery: 'orange',
  delivered: 'green',
  cancelled: 'red',
  refunded: 'purple',
}

const AdminOrderDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const { data, isLoading } = useAdminOrder(id)
  const order: AdminOrder | undefined = data?.data
  const { data: refundsData, isLoading: refundsLoading } = useOrderRefunds(order?._id)
  const refunds: AdminRefund[] = refundsData?.data || []
  const { data: returnsData, isLoading: returnsLoading } = useOrderReturns(order?._id)
  const orderReturns = useMemo(
    () => (returnsData?.data || []) as AdminReturn[],
    [returnsData?.data],
  )
  const cancelReturnMutation = useAdminCancelReturn()

  // Check if there's an active return for any order item
  // Active means not REJECTED (rejected returns allow creating new ones)
  // We hide the button if there's any return that's not REJECTED
  const hasActiveReturn = useMemo(() => {
    if (!order || !orderReturns.length) return false
    // Check if any return is active (not rejected)
    // REJECTED returns allow creating a new return request
    // All other statuses mean there's an active return in progress
    return orderReturns.some((ret) => ret.status !== 'REJECTED')
  }, [order, orderReturns])

  // Get active return status for display (must be called before any early returns)
  const activeReturnStatus = useMemo(() => {
    if (!hasActiveReturn || !orderReturns.length) return null
    const activeReturn = orderReturns.find((ret) => ret.status !== 'REJECTED')
    return activeReturn?.status || null
  }, [hasActiveReturn, orderReturns])

  const updateOrderStatus = useUpdateAdminOrderStatus()
  const updatePaymentStatus = useUpdateAdminPaymentStatus()
  const updateSellerStatus = useUpdateAdminSellerShipmentStatus()
  const regenerateLabel = useRegenerateLabel()
  const createManualRefund = useCreateManualRefund()
  const cancelOrder = useCancelOrder()
  const downloadInvoice = useDownloadInvoice()
  const downloadLabel = useDownloadLabel()

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [pickupModalOpen, setPickupModalOpen] = useState(false)
  const [activeShipment, setActiveShipment] = useState<AdminSellerShipment | null>(null)
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState<number | undefined>(undefined)
  const [refundReason, setRefundReason] = useState('')
  const [refundSource, setRefundSource] = useState<'PLATFORM' | 'SELLER'>('PLATFORM')
  const [refundMethod, setRefundMethod] = useState<'MANUAL_UPI' | 'MANUAL_BANK'>('MANUAL_UPI')
  const [refundReference, setRefundReference] = useState('')
  const [refundAdminNote, setRefundAdminNote] = useState('')
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [selectedOrderItemId, setSelectedOrderItemId] = useState<string | undefined>(undefined)
  const [trackingModalOpen, setTrackingModalOpen] = useState(false)
  const [selectedShipment, setSelectedShipment] = useState<AdminSellerShipment | null>(null)

  const groupedItems = useMemo(() => {
    if (!order) return []
    return order.sellerShipments.map((shipment) => ({
      shipment,
      items:
        order.items?.filter((item) => {
          const sellerRef =
            (item as { seller?: { _id?: string } }).seller?._id ||
            (item as { seller?: string }).seller
          if (!sellerRef) return false
          return sellerRef.toString() === shipment.seller?._id?.toString()
        }) || [],
    }))
  }, [order])

  const handleOrderStatusChange = async (status: OrderStatus) => {
    if (!order) return
    try {
      await updateOrderStatus.mutateAsync({ orderId: order._id, status })
      message.success('Order status updated')
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to update order status')
    }
  }

  const handlePaymentStatusChange = async (
    paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded',
  ) => {
    if (!order) return
    try {
      await updatePaymentStatus.mutateAsync({ orderId: order._id, paymentStatus })
      message.success('Payment status updated')
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to update payment status')
    }
  }

  const handleSellerStatusChange = async (
    shipment: AdminSellerShipment,
    status: SellerShipmentStatus,
  ) => {
    if (!order) return
    try {
      await updateSellerStatus.mutateAsync({
        orderId: order._id,
        shipmentId: shipment._id,
        status,
      })
      message.success('Shipment status updated')
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to update shipment status')
    }
  }

  const handleRegenerateLabel = async (shipment: AdminSellerShipment) => {
    if (!order) return
    try {
      const response = await regenerateLabel.mutateAsync({
        orderId: order._id,
        shipmentId: shipment._id,
      })
      const labelUrl = (response.data as { label_url?: string })?.label_url
      if (labelUrl) {
        window.open(labelUrl, '_blank', 'noopener')
      } else {
        message.info('Label not available')
      }
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to regenerate label')
    }
  }

  const openRefundModal = () => {
    if (!order) return
    const totalRefunded = refunds.reduce((sum, refund) => sum + refund.refundAmount, 0)
    const maxRefundable = Math.max(0, order.total - totalRefunded)
    setRefundAmount(maxRefundable)
    setRefundReason('')
    setRefundSource('PLATFORM')
    setRefundMethod('MANUAL_UPI')
    setRefundReference('')
    setRefundAdminNote('')
    setIsRefundModalOpen(true)
  }

  const handleConfirmRefund = async () => {
    if (!order) return
    const amount = Number(refundAmount || 0)
    const totalRefunded = refunds.reduce((sum, refund) => sum + refund.refundAmount, 0)
    const maxRefundable = Math.max(0, order.total - totalRefunded)

    if (!amount || amount <= 0) {
      message.error('Refund amount must be greater than ₹0.00')
      return
    }
    if (amount > maxRefundable + 0.01) {
      message.error(
        `Refund amount (₹${amount.toFixed(
          2,
        )}) exceeds remaining refundable amount (₹${maxRefundable.toFixed(2)})`,
      )
      return
    }
    if (!refundReason.trim()) {
      message.error('Refund reason is required. Please explain why this refund is being issued.')
      return
    }
    if (!refundReference.trim()) {
      message.error(
        'Reference number (UTR / bank reference) is required. This is needed for audit and reconciliation.',
      )
      return
    }

    try {
      await createManualRefund.mutateAsync({
        orderId: order._id,
        payload: {
          refundAmount: amount,
          refundReason: refundReason.trim(),
          refundSource: refundSource,
          refundMethod: refundMethod,
          referenceNumber: refundReference.trim(),
          adminNote: refundAdminNote.trim() || undefined,
        },
      })
      message.success('Manual refund recorded')
      setIsRefundModalOpen(false)
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to record refund')
    }
  }

  const handleCancel = useCallback(() => {
    setIsCancelModalOpen(true)
  }, [])

  const handleConfirmCancel = useCallback(async () => {
    if (!order) return
    try {
      await cancelOrder.mutateAsync(order._id)
      message.success('Order cancelled')
      setIsCancelModalOpen(false)
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to cancel order')
    }
  }, [order, cancelOrder, message])

  const handleRequestPickup = (shipment: AdminSellerShipment) => {
    setActiveShipment(shipment)
    setPickupModalOpen(true)
  }

  const handleDownloadInvoice = async (shipment: AdminSellerShipment) => {
    if (!order) return
    try {
      const response = await downloadInvoice.mutateAsync({
        orderId: order._id,
        shipmentId: shipment._id,
      })
      if (response.data?.invoice_url) {
        window.open(response.data.invoice_url, '_blank', 'noopener')
      } else {
        message.info('Invoice URL not available')
      }
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to download invoice')
    }
  }

  const handleDownloadLabel = async (shipment: AdminSellerShipment) => {
    if (!order) return
    try {
      const response = await downloadLabel.mutateAsync({
        orderId: order._id,
        shipmentId: shipment._id,
      })
      if (response.data?.label_url) {
        window.open(response.data.label_url, '_blank', 'noopener')
      } else {
        message.info('Label URL not available')
      }
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to download label')
    }
  }

  const canRequestPickup = (shipment: AdminSellerShipment) => {
    return ['pending', 'processing'].includes(shipment.status)
  }

  const hasShippingDetails = (shipment: AdminSellerShipment) => {
    return !!(shipment.shippingMeta?.awb || shipment.kourierBoyzLogistics?.awb_number)
  }

  const canCancelOrder = useCallback((order: AdminOrder): boolean => {
    // Already cancelled
    if (order.status === 'cancelled') {
      return false
    }

    // If a return flow has already started on this order (any non-REJECTED status),
    // do not allow cancellation
    const orderWithReturn = order as AdminOrder & { returnStatus?: string }
    if (orderWithReturn.returnStatus && orderWithReturn.returnStatus !== 'REJECTED') {
      return false
    }

    // If any seller shipment already has an AWB (either in shippingMeta or kourierBoyzLogistics),
    // treat the order as non‑cancellable
    if (order.sellerShipments && order.sellerShipments.length > 0) {
      const hasAwb = order.sellerShipments.some((shipment) => {
        const awbFromMeta = shipment?.shippingMeta?.awb
        const awbFromKourierBoyzLogistics = shipment?.kourierBoyzLogistics?.awb_number
        return Boolean(awbFromMeta || awbFromKourierBoyzLogistics)
      })

      if (hasAwb) {
        return false
      }
    }

    // Check order-level status as a safety net
    const nonCancellableOrderStatuses: OrderStatus[] = [
      'shipped',
      'in_transit',
      'out_for_delivery',
      'delivered',
    ]

    if (nonCancellableOrderStatuses.includes(order.status)) {
      return false
    }

    // Check seller shipment statuses
    const nonCancellableShipmentStatuses: SellerShipmentStatus[] = [
      'shipped',
      'in_transit',
      'out_for_delivery',
      'delivered',
    ]

    if (order.sellerShipments && order.sellerShipments.length > 0) {
      const hasShippedShipment = order.sellerShipments.some((shipment) =>
        nonCancellableShipmentStatuses.includes(shipment.status),
      )

      if (hasShippedShipment) {
        return false
      }
    }

    return true
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (!order) {
    return <Empty description="Order not found" />
  }

  const totalRefunded = refunds.reduce((sum, refund) => sum + refund.refundAmount, 0)
  const maxRefundable = Math.max(0, order.total - totalRefunded)
  const isFullyRefunded = totalRefunded >= order.total - 0.01 // Allow 0.01 tolerance for rounding
  const canRefundOrder =
    order.paymentStatus === 'paid' && order.status !== 'refunded' && !isFullyRefunded
  const canCancel = canCancelOrder(order)

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
        Back
      </Button>
      {hasActiveReturn && (
        <Alert
          message={
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>ORDER UNDER RETURN ACTION</div>
          }
          description={
            <div style={{ fontSize: '14px', marginTop: '8px' }}>
              This order has an active return/replacement request. Status:{' '}
              <strong>{activeReturnStatus?.replace(/_/g, ' ') || 'Active'}</strong>
            </div>
          }
          type="warning"
          showIcon
          style={{
            border: '2px solid #faad14',
            backgroundColor: '#fffbe6',
            padding: '16px 20px',
            marginBottom: '8px',
          }}
        />
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <Title level={4} className="mb-0">
              Order #{order.orderNumber || order._id}
            </Title>
            {hasActiveReturn && (
              <Tag
                color="orange"
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  margin: 0,
                }}
              >
                ⚠️ RETURN IN PROGRESS
              </Tag>
            )}
          </div>
          <Text type="secondary">
            Placed on {dayjs(order.orderedAt).format('DD MMM YYYY, HH:mm')}
          </Text>
        </div>
        <Space>
          {order.status === 'delivered' && !hasActiveReturn && (
            <Button type="default" onClick={() => setIsReturnModalOpen(true)}>
              Create Return/Replacement
            </Button>
          )}
          {canRefundOrder && <Button onClick={openRefundModal}>Refund</Button>}
          {canCancel && (
            <Button danger onClick={handleCancel} loading={cancelOrder.isPending}>
              Cancel Order
            </Button>
          )}
        </Space>
      </div>
      <Card>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Space direction="vertical" size="small" className="w-full">
              <Text strong>Status</Text>
              <Select
                value={order.status}
                style={{ width: 220 }}
                onChange={(value) => handleOrderStatusChange(value as OrderStatus)}
                options={orderStatusOptions}
                loading={updateOrderStatus.isPending}
              />
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space direction="vertical" size="small" className="w-full">
              <Text strong>Payment Status</Text>
              <Select
                value={order.paymentStatus}
                style={{ width: 220 }}
                onChange={(value) =>
                  handlePaymentStatusChange(value as 'pending' | 'paid' | 'failed' | 'refunded')
                }
                options={paymentStatusOptions}
                loading={updatePaymentStatus.isPending}
              />
            </Space>
          </Col>
        </Row>
      </Card>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="Order Summary">
            <Descriptions column={1} labelStyle={{ fontWeight: 500 }}>
              <Descriptions.Item label="Subtotal">₹{order.subtotal.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Shipping">₹{order.shipping.toFixed(2)}</Descriptions.Item>
              {order.discount > 0 && (
                <Descriptions.Item label="Discount">
                  ₹{order.discount.toFixed(2)}
                  {order.couponCode && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: '12px' }}>
                      ({order.couponCode})
                    </Text>
                  )}
                  {order.discountType && (
                    <Tag style={{ marginLeft: 4, fontSize: '12px' }}>{order.discountType}</Tag>
                  )}
                </Descriptions.Item>
              )}
              {order.paymentMethod === 'cod' && order.codCharges && order.codCharges > 0 && (
                <Descriptions.Item label="COD Charges">
                  ₹{order.codCharges.toFixed(2)}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Tax (GST)">₹{order.tax.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="Total">
                <Text strong>₹{order.total.toFixed(2)}</Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Buyer & Shipping">
            <Descriptions column={1} labelStyle={{ fontWeight: 500 }}>
              <Descriptions.Item label="Customer ID">
                <Text code>
                  {order.user
                    ? typeof order.user === 'object' && order.user._id
                      ? order.user._id
                      : typeof order.user === 'string'
                      ? order.user
                      : 'N/A'
                    : 'N/A'}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Buyer">
                {order.buyer?.name} ({order.buyer?.email})
              </Descriptions.Item>
              <Descriptions.Item label="Phone">{order.shippingAddress.phone}</Descriptions.Item>
              <Descriptions.Item label="Address">
                {order.shippingAddress.addressLine1}
                {order.shippingAddress.addressLine2 &&
                  `, ${order.shippingAddress.addressLine2}`}, {order.shippingAddress.city},{' '}
                {order.shippingAddress.state} – {order.shippingAddress.postalCode}
              </Descriptions.Item>
              {order.deliveryInstructions && (
                <Descriptions.Item label="Delivery Instructions">
                  {order.deliveryInstructions}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="Payment & Invoice">
            <Descriptions column={1} labelStyle={{ fontWeight: 500 }}>
              <Descriptions.Item label="Payment Method">
                <Tag color={order.paymentMethod === 'cod' ? 'orange' : 'green'}>
                  {order.paymentMethod?.toUpperCase() || 'N/A'}
                </Tag>
              </Descriptions.Item>
              {order.invoice?.invoice_number && (
                <Descriptions.Item label="Invoice Number">
                  <Text code>{order.invoice.invoice_number}</Text>
                  {order.invoice.invoice_url && (
                    <Button
                      size="small"
                      type="link"
                      icon={<FilePdfOutlined />}
                      onClick={() => window.open(order.invoice!.invoice_url, '_blank')}
                      style={{ marginLeft: 8 }}
                    >
                      View Invoice
                    </Button>
                  )}
                </Descriptions.Item>
              )}

              {order.estimatedDeliveryDate && (
                <Descriptions.Item label="Estimated Delivery">
                  {dayjs(order.estimatedDeliveryDate).format('DD MMM YYYY')}
                </Descriptions.Item>
              )}
              {order.orderSource && (
                <Descriptions.Item label="Order Source">
                  <Tag>{order.orderSource}</Tag>
                </Descriptions.Item>
              )}
              {order.settlementStatus && (
                <Descriptions.Item label="Settlement Status">
                  <Tag color={order.settlementStatus === 'SETTLED' ? 'green' : 'default'}>
                    {order.settlementStatus.replace(/_/g, ' ')}
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Tax Breakdown (GST/HSN)">
            {order.invoice?.hsnSummary && order.invoice.hsnSummary.length > 0 ? (
              <Table
                size="small"
                pagination={false}
                dataSource={order.invoice.hsnSummary}
                columns={[
                  {
                    title: 'HSN/SAC',
                    dataIndex: 'hsnSacCode',
                    render: (value: string) => <Text code>{value}</Text>,
                  },
                  {
                    title: 'GST Rate',
                    dataIndex: 'gstRatePercent',
                    render: (value: number) => `${value}%`,
                  },
                  {
                    title: 'Taxable Value',
                    dataIndex: 'taxableValueTotal',
                    render: (value: number) => `₹${value.toFixed(2)}`,
                  },
                  {
                    title: 'IGST',
                    dataIndex: 'igstAmountTotal',
                    render: (value: number) => (value > 0 ? `₹${value.toFixed(2)}` : '—'),
                  },
                  {
                    title: 'CGST',
                    dataIndex: 'cgstAmountTotal',
                    render: (value: number) => (value > 0 ? `₹${value.toFixed(2)}` : '—'),
                  },
                  {
                    title: 'SGST',
                    dataIndex: 'sgstAmountTotal',
                    render: (value: number) => (value > 0 ? `₹${value.toFixed(2)}` : '—'),
                  },
                ]}
              />
            ) : (
              <Text type="secondary">No tax breakdown available</Text>
            )}
          </Card>
        </Col>
      </Row>
      {order.notes && (
        <Card title="Order Notes">
          <Text>{order.notes}</Text>
        </Card>
      )}
      {order.timeline && order.timeline.length > 0 && (
        <Card title="Order Timeline">
          <Timeline
            items={order.timeline.map((event) => ({
              label: dayjs(event.timestamp).format('DD MMM YYYY, HH:mm'),
              children: (
                <div>
                  <div className="font-medium">{event.status}</div>
                  {event.message && <div className="text-xs text-gray-500">{event.message}</div>}
                </div>
              ),
            }))}
          />
        </Card>
      )}
      <Card title="Items">
        <Table
          rowKey={(record, index) => record._id || record.product?._id || String(index)}
          dataSource={order.items}
          pagination={false}
          columns={[
            {
              title: 'Product',
              dataIndex: 'product',
              width: 300,
              render: (
                product: AdminOrder['items'][0]['product'],
                record: AdminOrder['items'][0],
              ) => {
                const imageUrl =
                  record.variant?.mainImage ||
                  record.variant?.images?.[0] ||
                  product?.mainImage ||
                  product?.images?.[0]
                const sellerName =
                  typeof record.seller === 'object'
                    ? record.seller?.businessName || record.seller?.name
                    : 'N/A'

                return (
                  <div className="flex items-start gap-3">
                    {imageUrl && (
                      <img
                        src={imageUrl}
                        alt={product?.name}
                        style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{product?.name}</div>
                      {record.variant?.name && (
                        <div className="text-sm text-gray-600">
                          Variant: {record.variant.name}
                          {record.variant.attributes &&
                            Object.keys(record.variant.attributes).length > 0 && (
                              <div className="mt-1">
                                {Object.entries(record.variant.attributes).map(([key, value]) => (
                                  <Tag key={key} style={{ marginRight: 4, fontSize: '12px' }}>
                                    {key}: {value as string}
                                  </Tag>
                                ))}
                              </div>
                            )}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        SKU: {record.variantSku || record.variant?.sku || product?.sku}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">Seller: {sellerName}</div>
                      {record.hsnSacCode && (
                        <div className="text-xs text-gray-500 mt-1">
                          HSN: <Text code>{record.hsnSacCode}</Text>
                        </div>
                      )}
                    </div>
                  </div>
                )
              },
            },
            {
              title: 'Qty',
              dataIndex: 'quantity',
              width: 80,
            },
            {
              title: 'Price',
              dataIndex: 'price',
              width: 120,
              render: (value: number, record: AdminOrder['items'][0]) => {
                const displayPrice = record.effectivePrice ?? value
                return (
                  <div>
                    <div>₹{displayPrice.toFixed(2)}</div>
                    {record.effectivePrice != null && record.effectivePrice !== value && (
                      <div className="text-xs text-gray-500">
                        Base: ₹{value.toFixed(2)}
                      </div>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'GST',
              key: 'gst',
              width: 150,
              render: (_: unknown, record: AdminOrder['items'][0]) => {
                if (!record.gstRatePercent) return '—'
                return (
                  <div>
                    <div>{record.gstRatePercent}%</div>
                    {record.gstTaxType === 'IGST' && record.igst && (
                      <div className="text-xs text-gray-500">
                        IGST: ₹{(record.igst * record.quantity).toFixed(2)}
                      </div>
                    )}
                    {record.gstTaxType === 'CGST_SGST' && (
                      <div className="text-xs text-gray-500">
                        {record.cgst && `CGST: ₹${(record.cgst * record.quantity).toFixed(2)}`}
                        {record.sgst && ` SGST: ₹${(record.sgst * record.quantity).toFixed(2)}`}
                      </div>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'Discount',
              key: 'discount',
              width: 120,
              render: (_: unknown, record: AdminOrder['items'][0]) => {
                if (!record.discountAmount || record.discountAmount === 0) return '—'
                return (
                  <div>
                    <div>₹{record.discountAmount.toFixed(2)}</div>
                    {record.couponCode && (
                      <div className="text-xs text-gray-500">{record.couponCode}</div>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'Subtotal',
              dataIndex: 'subtotal',
              width: 120,
              render: (value: number) => `₹${value.toFixed(2)}`,
            },
          ]}
        />
      </Card>
      {}{' '}
      {(refundsLoading || refunds.length > 0) && (
        <Card title="Refunds">
          {refundsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Spin />
            </div>
          ) : (
            <Table
              rowKey={(record) => record._id}
              dataSource={refunds}
              pagination={false}
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'refundDate',
                  render: (value: string, record: AdminRefund) =>
                    dayjs(value || record.createdAt).format('DD MMM YYYY, HH:mm'),
                },
                {
                  title: 'Amount',
                  dataIndex: 'refundAmount',
                  render: (value: number) => `₹${value.toFixed(2)}`,
                },
                {
                  title: 'Source',
                  dataIndex: 'refundSource',
                  render: (value: AdminRefund['refundSource']) => (
                    <Tag color={value === 'PLATFORM' ? 'blue' : 'green'}>
                      {value === 'PLATFORM' ? 'Platform' : 'Seller'}
                    </Tag>
                  ),
                },
                {
                  title: 'Method',
                  dataIndex: 'refundMethod',
                  render: (value: AdminRefund['refundMethod']) =>
                    value === 'MANUAL_UPI' ? 'Manual UPI' : 'Manual Bank Transfer',
                },
                {
                  title: 'Reference',
                  dataIndex: 'referenceNumber',
                },
                {
                  title: 'Initiated By',
                  dataIndex: 'initiatedByAdmin',
                  render: (value: AdminRefund['initiatedByAdmin']) => {
                    if (!value) return '—'
                    if (typeof value === 'string') return value
                    return value.name || value.email || value._id
                  },
                },
                {
                  title: 'Reason',
                  dataIndex: 'refundReason',
                },
                {
                  title: 'Admin Note',
                  dataIndex: 'adminNote',
                  render: (value?: string) => value || '—',
                },
                {
                  title: 'Credit Note',
                  key: 'creditNote',
                  render: (_: unknown, record: AdminRefund) => {
                    if (record.creditNote?.credit_note_url) {
                      return (
                        <Space>
                          <Text code style={{ fontSize: 12 }}>
                            {record.creditNote.credit_note_number}
                          </Text>
                          <Button
                            size="small"
                            type="link"
                            icon={<FilePdfOutlined />}
                            onClick={() => {
                              window.open(record.creditNote!.credit_note_url, '_blank')
                            }}
                          >
                            Download
                          </Button>
                        </Space>
                      )
                    }
                    return <Text type="secondary">—</Text>
                  },
                },
              ]}
            />
          )}
        </Card>
      )}
      <Card title="Return/Replacement Requests">
        {returnsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Spin />
          </div>
        ) : orderReturns.length === 0 ? (
          <Empty
            description="No return requests for this order"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            rowKey={(record) => record._id}
            dataSource={orderReturns}
            pagination={false}
            columns={[
              {
                title: 'Return ID',
                dataIndex: '_id',
                render: (value: string) => <Text code>{String(value).slice(-8)}</Text>,
              },
              {
                title: 'Type',
                dataIndex: 'returnType',
                render: (value: string) => (
                  <Tag color={value === 'replacement' ? 'blue' : 'default'}>
                    {value === 'replacement' ? 'Replacement' : 'Return & Refund'}
                  </Tag>
                ),
              },
              {
                title: 'Reason',
                dataIndex: 'reason',
                ellipsis: true,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (value: string) => {
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
                  return (
                    <Tag color={statusColors[value] || 'default'}>{value.replace(/_/g, ' ')}</Tag>
                  )
                },
              },
              {
                title: 'Refund Amount',
                dataIndex: 'refundAmount',
                render: (value: number) => `₹${(value || 0).toFixed(2)}`,
              },
              {
                title: 'Created',
                dataIndex: 'createdAt',
                render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
              },
              {
                title: 'Actions',
                key: 'actions',
                render: (_: unknown, record: AdminReturn) => {
                  const canCancel =
                    (record.status === 'REQUESTED' ||
                      record.status === 'APPROVED_BY_SELLER' ||
                      record.status === 'APPROVED_BY_ADMIN') &&
                    !record.courierReverseAwb

                  return (
                    <Space size="small">
                      <Button
                        size="small"
                        type="link"
                        onClick={() => {
                          navigate(`/returns`)
                        }}
                      >
                        View in Returns
                      </Button>
                      {canCancel && (
                        <Button
                          size="small"
                          type="link"
                          danger
                          onClick={async () => {
                            try {
                              await cancelReturnMutation.mutateAsync({ id: record._id })
                              message.success('Return request cancelled')
                            } catch (err) {
                              message.error(
                                err instanceof Error ? err.message : 'Failed to cancel return',
                              )
                            }
                          }}
                          loading={cancelReturnMutation.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </Space>
                  )
                },
              },
            ]}
          />
        )}
      </Card>
      <Space direction="vertical" size="large" className="w-full">
        {groupedItems.map(({ shipment, items }) => (
          <Card
            key={shipment._id}
            title={
              <div className="flex items-center gap-2">
                <span>{shipment.seller?.businessName || shipment.seller?.name || 'Seller'}</span>
                <Tag color={statusColorMap[shipment.status]}>
                  {shipment.status.replace(/_/g, ' ')}
                </Tag>
              </div>
            }
            extra={
              <Space wrap>
                <Select
                  size="small"
                  style={{ width: 180 }}
                  value={shipment.status}
                  onChange={(value) =>
                    handleSellerStatusChange(shipment, value as SellerShipmentStatus)
                  }
                  options={sellerStatusOptions}
                  loading={updateSellerStatus.isPending}
                />
              </Space>
            }
          >
            {/* Action Buttons Row */}
            <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
              {canRequestPickup(shipment) && (
                <Button type="primary" size="small" onClick={() => handleRequestPickup(shipment)}>
                  Request Pickup
                </Button>
              )}
              {hasShippingDetails(shipment) && (
                <>
                  {shipment.label?.label_url ? (
                    <Button
                      size="small"
                      icon={<FilePdfOutlined />}
                      onClick={() => window.open(shipment.label!.label_url!, '_blank', 'noopener')}
                    >
                      Shipment Label
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      icon={<FilePdfOutlined />}
                      onClick={() => handleDownloadLabel(shipment)}
                      loading={downloadLabel.isPending}
                    >
                      Download Label
                    </Button>
                  )}
                  {shipment.invoice?.invoice_url ? (
                    <Button
                      size="small"
                      icon={<FilePdfOutlined />}
                      onClick={() =>
                        window.open(shipment.invoice!.invoice_url!, '_blank', 'noopener')
                      }
                    >
                      Shipment Invoice
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      icon={<FilePdfOutlined />}
                      onClick={() => handleDownloadInvoice(shipment)}
                      loading={downloadInvoice.isPending}
                    >
                      Download Invoice
                    </Button>
                  )}
                  <Button
                    size="small"
                    onClick={() => handleRegenerateLabel(shipment)}
                    loading={regenerateLabel.isPending}
                  >
                    Re-generate Label
                  </Button>
                </>
              )}
            </div>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Status">
                    <Tag color={statusColorMap[shipment.status]}>
                      {shipment.status.replace(/_/g, ' ')}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="AWB">
                    {shipment.shippingMeta?.awb || shipment.kourierBoyzLogistics?.awb_number || 'NA'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Courier">
                    {shipment.shippingMeta?.courier || 'NA'}
                  </Descriptions.Item>
                  {shipment.kourierBoyzLogistics?.rate && (
                    <Descriptions.Item label="Shipping Charge">
                      ₹{shipment.kourierBoyzLogistics.rate.toFixed(2)}
                    </Descriptions.Item>
                  )}
                  {(shipment.shippingMeta?.tracking_link ||
                    shipment.kourierBoyzLogistics?.tracking_link ||
                    shipment.shippingMeta?.awb ||
                    shipment.kourierBoyzLogistics?.awb_number ||
                    shipment.shareableTrackingLink) && (
                    <Descriptions.Item label="Tracking">
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Button
                          type="link"
                          onClick={() => {
                            setSelectedShipment(shipment)
                            setTrackingModalOpen(true)
                          }}
                          style={{ padding: 0, height: 'auto' }}
                        >
                          🔗 Track Shipment
                        </Button>
                        {shipment.shareableTrackingLink && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ marginBottom: 4, fontSize: '12px', color: '#6b7280' }}>
                              Shareable Tracking Link:
                            </div>
                            <Space.Compact style={{ width: '100%' }}>
                              <Input
                                value={shipment.shareableTrackingLink}
                                readOnly
                                style={{ fontSize: '12px' }}
                              />
                              <Button
                                type="primary"
                                onClick={() => {
                                  navigator.clipboard.writeText(shipment.shareableTrackingLink!)
                                  message.success('Tracking link copied to clipboard!')
                                }}
                                icon={<CopyOutlined />}
                              >
                                Copy
                              </Button>
                            </Space.Compact>
                          </div>
                        )}
                        {(shipment.shippingMeta?.tracking_link ||
                          shipment.kourierBoyzLogistics?.tracking_link) && (
                          <a
                            href={
                              shipment.shippingMeta?.tracking_link ||
                              shipment.kourierBoyzLogistics?.tracking_link
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            style={{ fontSize: '12px' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Open tracking link
                          </a>
                        )}
                      </Space>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Col>
              <Col xs={24} md={12}>
                <Text strong className="block mb-2">
                  Tracking Timeline
                </Text>
                {shipment.trackingEvents && shipment.trackingEvents.length > 0 ? (
                  <Timeline
                    style={{ maxHeight: 200, overflowY: 'auto' }}
                    items={shipment.trackingEvents.map((event) => ({
                      label: dayjs(event.timestamp).format('DD MMM HH:mm'),
                      children: (
                        <div>
                          <div className="font-medium">{event.status}</div>
                          {event.location && (
                            <div className="text-xs text-gray-500">{event.location}</div>
                          )}
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No tracking events yet"
                    imageStyle={{ height: 40 }}
                  />
                )}
              </Col>
            </Row>
            <Divider />
            <Table
              size="small"
              pagination={false}
              rowKey={(record) => record.product?._id}
              columns={[
                { title: 'Product', dataIndex: ['product', 'name'] },
                { title: 'Qty', dataIndex: 'quantity', width: 80 },
                {
                  title: 'Subtotal',
                  dataIndex: 'subtotal',
                  render: (value: number) => `₹${value.toFixed(2)}`,
                },
              ]}
              dataSource={items}
            />
          </Card>
        ))}
      </Space>
      <Modal
        title="Cancel order?"
        open={isCancelModalOpen}
        onOk={handleConfirmCancel}
        onCancel={() => setIsCancelModalOpen(false)}
        okText="Cancel Order"
        okButtonProps={{ danger: true }}
        confirmLoading={cancelOrder.isPending}
      >
        <p>This will cancel the entire order and notify sellers.</p>
      </Modal>
      {/* Request Pickup Modal */}
      <RequestPickupModal
        open={pickupModalOpen}
        onClose={() => {
          setPickupModalOpen(false)
          setActiveShipment(null)
        }}
        order={order}
        shipment={activeShipment || undefined}
        onSuccess={() => {
          setPickupModalOpen(false)
          setActiveShipment(null)
        }}
      />
      <CreateReturnModal
        open={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false)
          setSelectedOrderItemId(undefined)
        }}
        order={order}
        orderItemId={selectedOrderItemId}
      />
      {selectedShipment && order && (
        <TrackingModal
          open={trackingModalOpen}
          onClose={() => {
            setTrackingModalOpen(false)
            setSelectedShipment(null)
          }}
          orderId={order._id}
          shipment={selectedShipment}
        />
      )}
      <Modal
        title="Issue Manual Refund"
        open={isRefundModalOpen}
        onOk={handleConfirmRefund}
        onCancel={() => setIsRefundModalOpen(false)}
        okText="Confirm refund (money already sent)"
        okButtonProps={{ danger: true }}
        confirmLoading={createManualRefund.isPending}
      >
        {!order ? null : (
          <Space direction="vertical" className="w-full" size="middle">
            <Alert
              message="Important: Manual Refund Process"
              description="Only confirm this refund AFTER you have already sent the money to the customer via UPI or bank transfer. This action records the refund in the system and adjusts seller ledger entries."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            {/* Refund Summary Card */}
            <Card size="small" style={{ backgroundColor: '#f9fafb' }}>
              <Space direction="vertical" className="w-full" size="small">
                <Text strong style={{ fontSize: 14 }}>
                  Refund Summary
                </Text>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Order Total
                    </Text>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>
                      ₹{order.total.toFixed(2)}
                    </div>
                  </Col>
                  {totalRefunded > 0 && (
                    <Col span={12}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Already Refunded
                      </Text>
                      <div style={{ fontSize: 16, fontWeight: 600, color: '#dc2626' }}>
                        ₹{totalRefunded.toFixed(2)}
                      </div>
                    </Col>
                  )}
                </Row>
                <Divider style={{ margin: '12px 0' }} />
                <Row>
                  <Col span={24}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Remaining Refundable
                    </Text>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>
                      ₹{maxRefundable.toFixed(2)}
                    </div>
                  </Col>
                </Row>
                {totalRefunded > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      This order has been partially refunded {refunds.length} time
                      {refunds.length > 1 ? 's' : ''}. You can refund up to ₹
                      {maxRefundable.toFixed(2)} more.
                    </Text>
                  </div>
                )}
              </Space>
            </Card>

            {/* Refund Amount Input */}
            <Space direction="vertical" className="w-full" size="small">
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text strong>Refund Amount</Text>
                {refundAmount && refundAmount > maxRefundable && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    Exceeds remaining refundable amount
                  </Text>
                )}
              </div>
              <Input
                type="number"
                min={0}
                max={maxRefundable}
                step={0.01}
                value={refundAmount}
                onChange={(e) => {
                  const val = Number(e.target.value || 0)
                  setRefundAmount(val)
                }}
                status={refundAmount && refundAmount > maxRefundable ? 'error' : undefined}
                suffix={
                  refundAmount && refundAmount > 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Max: ₹{maxRefundable.toFixed(2)}
                    </Text>
                  ) : null
                }
              />
              {refundAmount && refundAmount > 0 && refundAmount <= maxRefundable && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  After this refund, remaining refundable will be ₹
                  {(maxRefundable - refundAmount).toFixed(2)}
                </Text>
              )}
            </Space>
            <Space direction="vertical" className="w-full" size="small">
              <Text strong>Refund reason</Text>
              <Input.TextArea
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </Space>
            <Space direction="vertical" className="w-full" size="small">
              <div>
                <Text strong>Refund Source</Text>
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  Who is funding this refund?
                </Text>
              </div>
              <Select
                value={refundSource}
                style={{ width: '100%' }}
                options={[
                  {
                    value: 'PLATFORM',
                    label: 'Platform Funded',
                    title:
                      'Platform pays the refund. Seller ledger is not debited. Use for platform errors, promotions, etc.',
                  },
                  {
                    value: 'SELLER',
                    label: 'Seller Funded',
                    title:
                      'Seller pays the refund. Seller ledger will be debited. Use when seller is responsible for the refund.',
                  },
                ]}
                onChange={(value) => setRefundSource(value as 'PLATFORM' | 'SELLER')}
              />
              {refundSource === 'PLATFORM' && (
                <Alert
                  message="Platform Funded"
                  description="This refund will be recorded as a platform expense. The seller's settlement will NOT be affected."
                  type="info"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              )}
              {refundSource === 'SELLER' && (
                <Alert
                  message="Seller Funded"
                  description="This refund will be debited from the seller's ledger. The seller's next settlement will be reduced by this amount."
                  type="warning"
                  showIcon
                  style={{ fontSize: 12 }}
                />
              )}
            </Space>
            <Space direction="vertical" className="w-full" size="small">
              <Text strong>Refund method</Text>
              <Select
                value={refundMethod}
                style={{ width: '100%' }}
                options={[
                  { value: 'MANUAL_UPI', label: 'Manual UPI' },
                  { value: 'MANUAL_BANK', label: 'Manual Bank Transfer' },
                ]}
                onChange={(value) => setRefundMethod(value as 'MANUAL_UPI' | 'MANUAL_BANK')}
              />
            </Space>
            <Space direction="vertical" className="w-full" size="small">
              <Text strong>Reference number (UTR / bank ref)</Text>
              <Input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} />
            </Space>
            <Space direction="vertical" className="w-full" size="small">
              <Text strong>Admin note (optional)</Text>
              <Input.TextArea
                rows={2}
                value={refundAdminNote}
                onChange={(e) => setRefundAdminNote(e.target.value)}
              />
            </Space>
          </Space>
        )}
      </Modal>
    </Space>
  )
}

export default AdminOrderDetail
