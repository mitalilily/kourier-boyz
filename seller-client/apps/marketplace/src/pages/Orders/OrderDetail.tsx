import { CopyOutlined, FilePdfOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Modal,
  Row,
  Space,
  Spin,
  Steps,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useBulkUpdateSellerOrderStatus,
  useCancelSellerOrder,
  useDownloadSellerInvoice,
  useDownloadSellerLabel,
  useSellerBatchShipments,
  useSellerOrder,
  useSellerOrderBatch,
  useShipmentLabel,
  useTrackShipment,
  useUpdateSellerOrderStatus,
} from '../../api/orderQueries'
import type {
  SellerOrder,
  SellerOrderBatch,
  SellerOrderItem,
  SellerShipment,
  SellerShipmentStatus,
} from '../../api/orders'
import RequestPickupModal from '../../components/orders/RequestPickupModal'
import ShipOrderModal from '../../components/orders/ShipOrderModal'
import TrackingModal from '../../components/orders/TrackingModal'
import { useAuthStore } from '../../store/authStore'

const { Title, Text } = Typography

const statusSteps: SellerShipmentStatus[] = [
  'pending',
  'processing',
  'pickup_requested',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
]

const statusColors: Record<SellerShipmentStatus, string> = {
  pending: 'default',
  processing: 'blue',
  ready_to_ship: 'gold', // Keep for backward compatibility
  pickup_requested: 'cyan',
  shipped: 'blue',
  in_transit: 'purple',
  out_for_delivery: 'orange',
  delivered: 'green',
  cancelled: 'red',
}

const formatStatusLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// Items table with a more modern product cell (uses merged `item` from backend)
const itemsColumns: ColumnsType<SellerOrderItem> = [
  {
    title: 'Product',
    dataIndex: 'item',
    render: (_: unknown, record: SellerOrderItem) => {
      const item = (record.item || {}) as {
        name?: string
        baseName?: string
        sku?: string
        baseSku?: string
        mainImage?: string
      }
      const displayName = item.name || item.baseName || 'Unnamed Product'
      const sku = item.sku || item.baseSku
      const thumbnail = item.mainImage || '/image-placeholder.svg'

      return (
        <div className="flex items-center gap-3">
          <img
            src={thumbnail}
            alt={displayName || 'Product'}
            className="w-12 h-12 rounded-md object-cover border border-slate-200"
          />
          <div className="flex flex-col">
            <span className="font-medium text-sm text-slate-900">{displayName}</span>
            {sku && <span className="text-[11px] text-slate-500">SKU: {sku}</span>}
          </div>
        </div>
      )
    },
  },
  {
    title: 'Quantity',
    dataIndex: 'quantity',
    align: 'center',
  },
  {
    title: 'Instructions',
    dataIndex: 'instructions',
    render: (value: string | undefined) =>
      value ? (
        <span className="text-xs text-slate-600 whitespace-pre-wrap break-words">{value}</span>
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
  },
  {
    title: 'Price',
    dataIndex: 'price',
    align: 'right',
    render: (_: number, record: SellerOrderItem) => {
      const unitPrice = record.price
      const discount =
        typeof record.couponDiscountAmount === 'number' ? record.couponDiscountAmount : 0
      const hasItemDiscount = discount > 0
      if (!hasItemDiscount) {
        return `₹${unitPrice.toFixed(2)}`
      }
      const originalPerUnit =
        record.quantity > 0 ? (record.subtotal + discount) / record.quantity : unitPrice
      return (
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-500 line-through">₹{originalPerUnit.toFixed(2)}</span>
          <span className="text-sm font-semibold text-slate-900">₹{unitPrice.toFixed(2)}</span>
        </div>
      )
    },
  },
  {
    title: 'Subtotal',
    dataIndex: 'subtotal',
    align: 'right',
    render: (_: number, record: SellerOrderItem) => {
      const rawDiscount =
        typeof record.couponDiscountAmount === 'number' ? record.couponDiscountAmount : 0
      const hasItemDiscount = rawDiscount > 0
      const discountAmount = hasItemDiscount ? rawDiscount : 0
      const originalTotal = record.subtotal + discountAmount
      if (!hasItemDiscount) {
        return `₹${record.subtotal.toFixed(2)}`
      }
      return (
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-500 line-through">₹{originalTotal.toFixed(2)}</span>
          <span className="text-sm font-semibold text-slate-900">
            ₹{record.subtotal.toFixed(2)}
          </span>
          {record.couponCode && hasItemDiscount && (
            <span className="text-[10px] text-emerald-600">
              Coupon {record.couponCode} applied (−₹{discountAmount.toFixed(2)})
            </span>
          )}
        </div>
      )
    },
  },
]

const OrderDetail = () => {
  const { id, batchId } = useParams<{ id?: string; batchId?: string }>()
  const { message } = App.useApp()
  const [shipModalOpen, setShipModalOpen] = useState(false)
  const [pickupModalOpen, setPickupModalOpen] = useState(false)
  const [activeOrderForModal, setActiveOrderForModal] = useState<SellerOrder | undefined>()
  const [activeShipmentForModal, setActiveShipmentForModal] = useState<SellerShipment | undefined>()
  const [batchBulkMode, setBatchBulkMode] = useState<'pickup' | 'ship' | null>(null)
  const [batchBulkQueue, setBatchBulkQueue] = useState<SellerOrder[]>([])
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const [notesOrder, setNotesOrder] = useState<SellerOrder | undefined>()
  const [trackingModalOpen, setTrackingModalOpen] = useState(false)
  const [selectedShipmentForTracking, setSelectedShipmentForTracking] = useState<
    SellerShipment | undefined
  >()
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState<SellerOrder | undefined>()

  const pickupAddresses = useAuthStore((state) => state.user?.pickupAddresses || [])

  const isBatchView = !!batchId
  const { data: singleOrderData, isLoading: isSingleLoading } = useSellerOrder(
    !isBatchView ? id : undefined,
  )
  const { data: batchData, isLoading: isBatchLoading } = useSellerOrderBatch(
    isBatchView ? batchId : undefined,
  )
  const { data: batchShipmentsData } = useSellerBatchShipments(isBatchView ? batchId : undefined)

  const batch: SellerOrderBatch | undefined = batchData?.data
  const order: SellerOrder | undefined = isBatchView ? batch?.orders[0] : singleOrderData?.data
  const [selectedBatchOrderIds, setSelectedBatchOrderIds] = useState<React.Key[]>([])

  const items: SellerOrderItem[] = useMemo(() => {
    if (isBatchView && batch) {
      return batch.orders.flatMap((o) => o.items)
    }
    return order?.items || []
  }, [isBatchView, batch, order])

  const selectedBatchOrders: SellerOrder[] = useMemo(() => {
    if (!isBatchView || !batch) return []
    return batch.orders.filter((o) => selectedBatchOrderIds.includes(o._id))
  }, [isBatchView, batch, selectedBatchOrderIds])

  // When viewing a batch, shipment details should be shown per-order (per shipment).
  // Use the first selected order in the grid, or fall back to the first order in the batch.
  const shipmentOrder: SellerOrder | undefined = useMemo(() => {
    if (!isBatchView) return order
    if (selectedBatchOrders.length > 0) return selectedBatchOrders[0]
    return batch?.orders[0]
  }, [isBatchView, order, selectedBatchOrders, batch])

  const shipment: SellerShipment | undefined = shipmentOrder?.sellerShipment

  // For batch view, derive distinct shipment groups (each representing one actual shipment)
  const batchShipmentGroups = useMemo(() => {
    if (!isBatchView || !batch) return []

    type ShipmentGroup = {
      key: string
      shipment: SellerShipment
      orders: SellerOrder[]
    }

    const apiGroups = batchShipmentsData?.data || []
    if (apiGroups.length === 0) return []

    const groups: ShipmentGroup[] = []

    apiGroups.forEach((sg, idx) => {
      const ordersForGroup = batch.orders.filter((o) => sg.orderIds.includes(o._id))
      const representativeOrder = ordersForGroup[0] || batch.orders[0]
      const representativeShipment = representativeOrder?.sellerShipment

      if (!representativeShipment) return

      groups.push({
        key: sg.kourierBoyzLogisticsOrderId || sg.awb || sg.shipmentId || `shipment-${idx}`,
        shipment: {
          ...representativeShipment,
          shippingMeta: sg.shippingMeta || representativeShipment.shippingMeta,
          invoice: sg.invoice || representativeShipment.invoice,
          triplicateInvoice: sg.triplicateInvoice || representativeShipment.triplicateInvoice,
          label: sg.label || representativeShipment.label,
        },
        orders: ordersForGroup,
      })
    })

    return groups
  }, [isBatchView, batch, batchShipmentsData])

  const hasSelectedPending = useMemo(
    () => selectedBatchOrders.some((o) => o.sellerShipment?.status === 'pending'),
    [selectedBatchOrders],
  )

  const hasSelectedProcessing = useMemo(
    () => selectedBatchOrders.some((o) => o.sellerShipment?.status === 'processing'),
    [selectedBatchOrders],
  )

  const updateStatusMutation = useUpdateSellerOrderStatus()
  const bulkStatusMutation = useBulkUpdateSellerOrderStatus()
  const trackShipmentMutation = useTrackShipment()
  const labelMutation = useShipmentLabel()
  const downloadInvoiceMutation = useDownloadSellerInvoice()
  const downloadLabelMutation = useDownloadSellerLabel()
  const cancelOrderMutation = useCancelSellerOrder()

  const currentStepIndex = useMemo(() => {
    if (!shipment) return 0
    const idx = statusSteps.indexOf(shipment.status)
    return idx === -1 ? 0 : idx
  }, [shipment])

  // Shipments to display in the "Shipment Details" section
  const shipmentsForDetails = useMemo(() => {
    // For batch view, use backend-provided shipment groups when available,
    // but only show shipments that have progressed to pickup_requested or beyond.
    if (isBatchView) {
      return batchShipmentGroups
        .map((g) => g.shipment)
        .filter((s) =>
          ['pickup_requested', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(
            s.status,
          ),
        )
    }

    if (!shipment) return []

    return ['pickup_requested', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(
      shipment.status,
    )
      ? [shipment]
      : []
  }, [isBatchView, batchShipmentGroups, shipment])

  // Show documents only once pickup has been requested or later based on the
  // active seller shipment status (not just the order shell status).
  // For batch view, check if ANY order has the right status
  // const canShowDocuments = useMemo(() => {
  //   if (isBatchView && batch) {
  //     return batch.orders.some(
  //       (o) =>
  //         o.sellerShipment &&
  //         ['pickup_requested', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(
  //           o.sellerShipment.status,
  //         ),
  //     )
  //   }
  //   return (
  //     !!shipmentOrder?.sellerShipment &&
  //     ['pickup_requested', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(
  //       shipmentOrder.sellerShipment.status,
  //     )
  //   )
  // }, [isBatchView, batch, shipmentOrder])

  const canShowShipmentDetails = shipmentsForDetails.length > 0

  const handleStatusChange = async (nextStatus: SellerShipmentStatus, target?: SellerOrder) => {
    const targetOrder = target || order
    if (!targetOrder) return
    try {
      await updateStatusMutation.mutateAsync({
        orderId: targetOrder._id,
        status: nextStatus,
      })
      message.success('Status updated')
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to update status')
    }
  }
  const handleBatchMarkProcessing = async () => {
    if (!isBatchView || !batch) return

    const eligible = selectedBatchOrders.filter((o) => o.sellerShipment?.status === 'pending')
    if (eligible.length === 0) {
      message.warning('Select at least one order in pending status to mark as processing')
      return
    }

    await bulkStatusMutation.mutateAsync({
      status: 'processing',
      orderIds: eligible.map((o) => o._id),
    })
    message.success('Selected orders marked as processing')
  }

  const handleBatchMarkAllProcessing = async () => {
    if (!isBatchView || !batch) return
    const eligible = batch.orders.filter((o) => o.sellerShipment?.status === 'pending')
    if (eligible.length === 0) {
      message.warning('No pending orders to mark as processing')
      return
    }
    await bulkStatusMutation.mutateAsync({
      status: 'processing',
      batchId: batch.batchId,
    })
    message.success('All pending orders in this batch marked as processing')
  }

  const handleBatchRequestPickupSelected = () => {
    if (!isBatchView || !batch) return

    const eligible = selectedBatchOrders.filter((o) => o.sellerShipment?.status === 'processing')
    if (eligible.length === 0) {
      message.warning('Select at least one order in processing status to request pickup')
      return
    }

    setBatchBulkMode('pickup')
    setBatchBulkQueue(eligible)
    setActiveOrderForModal(eligible[0])
    setActiveShipmentForModal(eligible[0].sellerShipment)
    setPickupModalOpen(true)
  }

  const handleBatchShipAllProcessing = () => {
    if (!isBatchView || !batch) return

    const eligible = batch.orders.filter(
      (o) => o.canShip && o.sellerShipment?.status !== 'processing',
    )
    if (eligible.length === 0) {
      message.warning('No processed orders available to ship')
      return
    }

    setBatchBulkMode('ship')
    setBatchBulkQueue(eligible)
    setActiveOrderForModal(eligible[0])
    setActiveShipmentForModal(eligible[0].sellerShipment)
    setShipModalOpen(true)
  }

  // const handleDownloadLabel = async () => {
  //   if (!order || !shipment) return
  //   try {
  //     const response = await labelMutation.mutateAsync({
  //       orderId: order._id,
  //       shipmentId: shipment._id,
  //     })
  //     const labelUrl =
  //       (response.data as { label_url?: string })?.label_url || shipment.shippingMeta?.label
  //     if (labelUrl) {
  //       window.open(labelUrl, '_blank', 'noopener')
  //     } else {
  //       message.info('Label URL not available')
  //     }
  //   } catch (error) {
  //     message.error((error as Error)?.message || 'Failed to fetch label')
  //   }
  // }

  // const handleDownloadInvoice = async () => {
  //   const targetOrder = isBatchView ? shipmentOrder || order : order
  //   if (!targetOrder) return
  //   try {
  //     const response = await downloadInvoiceMutation.mutateAsync(targetOrder._id)
  //     if (response.data?.invoice_url) {
  //       window.open(response.data.invoice_url, '_blank', 'noopener')
  //     } else {
  //       message.info('Invoice URL not available')
  //     }
  //   } catch (error) {
  //     message.error((error as Error)?.message || 'Failed to fetch invoice')
  //   }
  // }

  // const handleDownloadOrderLabel = async () => {
  //   const targetOrder = isBatchView ? shipmentOrder || order : order
  //   if (!targetOrder) return
  //   try {
  //     const response = await downloadLabelMutation.mutateAsync(targetOrder._id)
  //     if (response.data?.label_url) {
  //       window.open(response.data.label_url, '_blank', 'noopener')
  //     } else {
  //       message.info('Label URL not available')
  //     }
  //   } catch (error) {
  //     message.error((error as Error)?.message || 'Failed to fetch label')
  //   }
  // }

  const handleDownloadManifest = async () => {
    if (!shipment?.manifest?.manifest_url) {
      message.warning('Manifest URL not available')
      return
    }

    try {
      const manifestUrl = shipment.manifest.manifest_url

      const response = await fetch(manifestUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch manifest')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      const manifestId = shipment.manifest.manifest_id || 'manifest'
      const filename = `manifest-${manifestId}.pdf`
      a.download = filename

      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      message.success('Manifest downloaded successfully')
    } catch (error) {
      console.error('Error downloading manifest:', error)
      message.error('Failed to download manifest. Opening in new tab instead.')
      window.open(shipment.manifest.manifest_url, '_blank', 'noopener')
    }
  }

  const handleTrackShipment = () => {
    if (!order || !shipment) return
    setSelectedShipmentForTracking(shipment)
    setTrackingModalOpen(true)
  }

  const handleCancelOrder = (targetOrder: SellerOrder) => {
    setOrderToCancel(targetOrder)
    setCancelModalOpen(true)
  }

  const handleConfirmCancel = async () => {
    if (!orderToCancel) return
    try {
      await cancelOrderMutation.mutateAsync(orderToCancel._id)
      message.success('Order cancelled successfully')
      setCancelModalOpen(false)
      setOrderToCancel(undefined)
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to cancel order')
    }
  }

  const canCancelOrder = (order: SellerOrder) => {
    const status = order.sellerShipment?.status

    // If any AWB already exists for this seller shipment, do not allow cancellation.
    const awbAlreadyGenerated =
      !!order.sellerShipment?.shippingMeta?.awb || !!order.sellerShipment?.kourierBoyzLogistics?.awb_number

    if (awbAlreadyGenerated) {
      return false
    }

    return (
      !!status &&
      !['shipped', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'].includes(status)
    )
  }

  const isLoading = isBatchView ? isBatchLoading : isSingleLoading

  // Orders that the RequestPickupModal should operate on:
  // - In batch pickup mode: all eligible selected orders in the batchBulkQueue
  // - Otherwise: the active order for the modal, or the single order view
  const modalOrders: SellerOrder[] = useMemo(() => {
    if (isBatchView && batchBulkMode === 'pickup' && batchBulkQueue.length > 0) {
      return batchBulkQueue
    }
    if (activeOrderForModal) {
      return [activeOrderForModal]
    }
    return order ? [order] : []
  }, [isBatchView, batchBulkMode, batchBulkQueue, activeOrderForModal, order])

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

  const isBusy =
    updateStatusMutation.isPending ||
    labelMutation.isPending ||
    trackShipmentMutation.isPending ||
    downloadInvoiceMutation.isPending ||
    downloadLabelMutation.isPending

  const settlementInfo = {
    settlementStatus: (order as unknown as { settlementStatus?: string }).settlementStatus,
    settlementEligibleAt: (order as unknown as { settlementEligibleAt?: string | Date })
      .settlementEligibleAt,
    settlementBatch: (order as unknown as { settlementBatch?: string }).settlementBatch,
    sellerSaleAmount: (order as unknown as { sellerSaleAmount?: number }).sellerSaleAmount,
    sellerCommissionAmount: (order as unknown as { sellerCommissionAmount?: number })
      .sellerCommissionAmount,
    sellerNetAmount: (order as unknown as { sellerNetAmount?: number }).sellerNetAmount,
  }

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-white px-2 py-3 sm:px-2 sm:py-5">
      <div className="w-full max-w-6xl mx-auto space-y-4 relative">
        {/* Light global loading overlay when key actions are happening */}
        {isBusy && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center">
            <div className="mt-3 flex items-center gap-2 rounded-full bg-white/70 px-4 py-1 shadow-sm border border-slate-200">
              <Spin size="small" />
              <span className="text-xs text-slate-600">Processing action…</span>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto mb-3">
          <Button
            type="default"
            size="small"
            onClick={() => window.history.back()}
            className="flex items-center gap-1"
          >
            ← Back
          </Button>
        </div>
        {/* Header Card */}
        <Card
          bordered={false}
          className="shadow-sm rounded-2xl overflow-hidden relative"
          bodyStyle={{ padding: 16 }}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400" />
          <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Title level={4} className="!mb-0">
                  {isBatchView && batch
                    ? `Order Group ${batch.batchCode || batch.batchId || ''}`
                    : `Order #${order.orderNumber || order._id}`}
                </Title>
                {!isBatchView && order.paymentStatus === 'paid' && <Tag color="green">Paid</Tag>}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                <Tag color="blue">
                  Placed on {dayjs(order.orderedAt).format('DD MMM YYYY, HH:mm')}
                </Tag>
                {!isBatchView && (
                  <>
                    <Tag color={order.status === 'cancelled' ? 'red' : 'geekblue'}>
                      {formatStatusLabel(order.status)}
                    </Tag>
                    {shipment && (
                      <>
                        {shipment.shippingMeta?.courier && (
                          <Tag color="cyan">Courier: {shipment.shippingMeta.courier}</Tag>
                        )}
                        {/* Prefer AWB from shipping meta, fall back to kourierBoyzLogistics awb_number */}
                        {(shipment.shippingMeta?.awb || shipment.kourierBoyzLogistics?.awb_number) && (
                          <Tag color="purple">
                            AWB: {shipment.shippingMeta?.awb || shipment.kourierBoyzLogistics?.awb_number}
                          </Tag>
                        )}
                        {/* Display tracking link prominently */}
                        {(shipment.shippingMeta?.tracking_link ||
                          shipment.kourierBoyzLogistics?.tracking_link) && (
                          <Tag color="blue">
                            <a
                              href={
                                shipment.shippingMeta?.tracking_link ||
                                shipment.kourierBoyzLogistics?.tracking_link
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'inherit', textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              🔗 Track Order
                            </a>
                          </Tag>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Primary Action Bar - Removed invoice/label buttons per requirements */}
            <Space wrap className="justify-end sm:justify-end w-full sm:w-auto">
              {!isBatchView && order.status === 'pending' && (
                <Button
                  type="primary"
                  size="small"
                  className="shadow-sm"
                  loading={updateStatusMutation.isPending}
                  onClick={() => handleStatusChange('processing')}
                >
                  Mark as Processing
                </Button>
              )}

              {!isBatchView && order.status === 'processing' && (
                <Button
                  type="primary"
                  size="small"
                  className="shadow-sm"
                  onClick={() => setPickupModalOpen(true)}
                >
                  Request Pickup
                </Button>
              )}

              {!isBatchView && order.canShip && order.status !== 'processing' && (
                <Button
                  type="primary"
                  size="small"
                  className="shadow-sm"
                  onClick={() => setShipModalOpen(true)}
                >
                  Ship Order
                </Button>
              )}
            </Space>
          </div>
        </Card>

        {/* Status Steps - only for single-order view */}
        {!isBatchView && (
          <Card bordered={false} className="shadow-sm rounded-2xl" bodyStyle={{ padding: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <Text strong className="text-slate-800">
                Fulfilment Progress
              </Text>
              {shipment?.status && (
                <Tag color={statusColors[shipment.status]}>
                  {formatStatusLabel(shipment.status)}
                </Tag>
              )}
            </div>
            <Steps
              size="small"
              current={currentStepIndex}
              labelPlacement="vertical"
              items={statusSteps.map((status) => ({
                title: formatStatusLabel(status),
                status:
                  shipment?.status === 'cancelled'
                    ? 'error'
                    : shipment?.status === status
                    ? 'process'
                    : undefined,
              }))}
            />
          </Card>
        )}

        {/* Summary + Buyer Info */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              bordered={false}
              className="shadow-sm rounded-2xl h-full"
              title={
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">
                    {isBatchView && batch ? 'Batch Summary' : 'Order Summary'}
                  </span>
                  {isBatchView &&
                    batch &&
                    (() => {
                      // Find first order with customer invoice for batch view
                      const batchInvoiceOrder = batch.orders.find((o) => o.invoice?.invoice_url)
                      return (
                        batchInvoiceOrder?.invoice?.invoice_url && (
                          <Button
                            size="small"
                            type="link"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              window.open(
                                batchInvoiceOrder.invoice!.invoice_url!,
                                '_blank',
                                'noopener',
                              )
                            }
                            title="Customer invoice (same as sent to buyer)"
                          >
                            Customer Invoice
                          </Button>
                        )
                      )
                    })()}
                  {!isBatchView && order?.invoice?.invoice_url && (
                    <Button
                      size="small"
                      type="link"
                      icon={<FilePdfOutlined />}
                      onClick={() => window.open(order.invoice!.invoice_url!, '_blank', 'noopener')}
                      title="Customer invoice (same as sent to buyer)"
                    >
                      Customer Invoice
                    </Button>
                  )}
                </div>
              }
            >
              <Space direction="vertical" size="middle" className="w-full">
                <div className="flex items-center justify-between">
                  <Text type="secondary">
                    {isBatchView && batch ? 'Group Total Amount' : 'Total Amount'}
                  </Text>
                  <Text strong className="text-lg text-slate-900">
                    ₹{(isBatchView && batch ? batch.summary.total : order.total).toFixed(2)}
                  </Text>
                </div>
                <div className="flex items-center justify-between">
                  <Text type="secondary">Payment Status</Text>
                  <Tag
                    color={
                      order.paymentStatus === 'paid'
                        ? 'green'
                        : order.paymentStatus === 'failed'
                        ? 'red'
                        : 'gold'
                    }
                  >
                    {formatStatusLabel(order.paymentStatus)}
                  </Tag>
                </div>
                <div className="flex items-center justify-between">
                  <Text type="secondary">Payment Method</Text>
                  <Tag>{order.paymentMethod.toUpperCase()}</Tag>
                </div>
                {order.adminCoupon && (
                  <div className="flex items-start justify-between">
                    <Text type="secondary">Platform Coupon</Text>
                    <Text className="text-xs text-slate-700 text-right">
                      Customer also used platform coupon{' '}
                      <span className="font-semibold">{order.adminCoupon.code}</span> (
                      {order.adminCoupon.type === 'percentage'
                        ? `${order.adminCoupon.value}%`
                        : `₹${order.adminCoupon.value}`}{' '}
                      off on cart)
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              bordered={false}
              className="shadow-sm rounded-2xl h-full"
              title={<span className="text-sm font-semibold text-slate-800">Buyer & Shipping</span>}
            >
              <Descriptions
                column={1}
                labelStyle={{ fontWeight: 500 }}
                contentStyle={{ fontSize: 13 }}
              >
                <Descriptions.Item label="Buyer">
                  {order.buyer?.name} {order.buyer?.email && `(${order.buyer.email})`}
                </Descriptions.Item>
                <Descriptions.Item label="Phone">{order.shippingAddress.phone}</Descriptions.Item>
                <Descriptions.Item label="Shipping Address">
                  {order.shippingAddress.addressLine1}
                  {order.shippingAddress.addressLine2 &&
                    `, ${order.shippingAddress.addressLine2}`}, {order.shippingAddress.city},{' '}
                  {order.shippingAddress.state} – {order.shippingAddress.postalCode}
                </Descriptions.Item>
                {order.deliveryInstructions && (
                  <Descriptions.Item label="Delivery Instructions">
                    <span className="whitespace-pre-wrap break-words text-xs text-slate-700">
                      {order.deliveryInstructions}
                    </span>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Col>
        </Row>

        {/* Settlement summary – hide for batch (group) view, show only on single-order detail */}
        {!isBatchView && (
          <Card
            bordered={false}
            className="shadow-sm rounded-2xl"
            title={<span className="text-sm font-semibold text-slate-800">Settlement</span>}
          >
            {(() => {
              const firstItem = (order.items || [])[0]
              const itemSubtotal =
                firstItem && typeof firstItem.subtotal === 'number'
                  ? firstItem.subtotal
                  : settlementInfo.sellerSaleAmount || order.total
              const originalItemTotal =
                firstItem &&
                typeof firstItem.price === 'number' &&
                typeof firstItem.quantity === 'number'
                  ? firstItem.price * firstItem.quantity
                  : itemSubtotal
              const sellerDiscount =
                firstItem && typeof firstItem.couponDiscountAmount === 'number'
                  ? firstItem.couponDiscountAmount
                  : Math.max(0, originalItemTotal - itemSubtotal)
              const saleBase = settlementInfo.sellerSaleAmount || itemSubtotal
              const commission = settlementInfo.sellerCommissionAmount || 0
              const net = settlementInfo.sellerNetAmount || saleBase - commission

              return (
                <Descriptions
                  column={2}
                  labelStyle={{ fontWeight: 500 }}
                  contentStyle={{ fontSize: 13 }}
                >
                  <Descriptions.Item label="Settlement Status">
                    <Tag>{settlementInfo.settlementStatus || 'NOT_ELIGIBLE'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Eligible At">
                    {settlementInfo.settlementEligibleAt
                      ? dayjs(settlementInfo.settlementEligibleAt).format('DD MMM YYYY, HH:mm')
                      : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Item Subtotal">
                    ₹{originalItemTotal.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Seller Discounts">
                    −₹{sellerDiscount.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Seller Sale Base">
                    ₹{saleBase.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Commission">
                    −₹{commission.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Net Earning (this order)">
                    <Tag color="green">₹{net.toFixed(2)}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Settlement Batch ID">
                    {settlementInfo.settlementBatch ? String(settlementInfo.settlementBatch) : '—'}
                  </Descriptions.Item>
                </Descriptions>
              )
            })()}
          </Card>
        )}

        {/* Items / Orders in Group */}
        <Card
          bordered={false}
          className="shadow-sm rounded-2xl"
          title={
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                {isBatchView && batch
                  ? `Orders in Group (${batch.orders.length})`
                  : `Items (${items.length})`}
              </span>
              {isBatchView && batch && (
                <Space size="small">
                  <Button
                    size="small"
                    type="default"
                    disabled={batch.orders.every((o) => o.sellerShipment?.status !== 'pending')}
                    onClick={handleBatchMarkAllProcessing}
                  >
                    Mark All Pending Processing
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    disabled={selectedBatchOrderIds.length === 0 || !hasSelectedProcessing}
                    onClick={handleBatchRequestPickupSelected}
                  >
                    Request Pickup for Selected
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    className="shadow-sm"
                    disabled={selectedBatchOrderIds.length === 0 || !hasSelectedPending}
                    onClick={handleBatchMarkProcessing}
                  >
                    Mark Selected Processing
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    className="shadow-sm"
                    onClick={handleBatchShipAllProcessing}
                    disabled={!batch.orders.some((o) => o.canShip && o.status !== 'processing')}
                  >
                    Ship All Processed
                  </Button>
                </Space>
              )}
            </div>
          }
        >
          {isBatchView && batch ? (
            <Table<SellerOrder>
              size="small"
              className="border border-slate-100 rounded-xl overflow-hidden"
              rowClassName={(_, index) =>
                `transition-colors hover:bg-slate-50 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                }`
              }
              columns={[
                {
                  title: 'Order',
                  dataIndex: 'orderNumber',
                  render: (_: unknown, record: SellerOrder) => (
                    <div className="flex flex-col">
                      <span className="font-medium text-sm text-slate-900">
                        #{record.orderNumber || record._id}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {dayjs(record.orderedAt).format('DD MMM YYYY, HH:mm')}
                      </span>
                    </div>
                  ),
                },
                {
                  title: 'Product',
                  dataIndex: 'items',
                  render: (_: unknown, record: SellerOrder) => {
                    const line = record.items?.[0] as SellerOrderItem | undefined
                    const merged = line?.item as
                      | {
                          name?: string
                          baseName?: string
                          sku?: string
                          baseSku?: string
                          mainImage?: string
                        }
                      | undefined

                    if (!merged) return 'Item'

                    const displayName = merged.name || merged.baseName || 'Unnamed Product'
                    const sku = merged.sku || merged.baseSku
                    const thumbnail = merged.mainImage || '/image-placeholder.svg'

                    return (
                      <div className="flex items-center gap-3">
                        <img
                          src={thumbnail}
                          alt={displayName}
                          className="w-12 h-12 rounded-md object-cover border border-slate-200"
                        />
                        <div className="flex flex-col">
                          <span className="font-medium text-sm text-slate-900">{displayName}</span>
                          {sku && <span className="text-[11px] text-slate-500">SKU: {sku}</span>}
                        </div>
                      </div>
                    )
                  },
                },
                {
                  title: 'Quantity',
                  dataIndex: 'items',
                  align: 'center',
                  render: (_: unknown, record: SellerOrder) =>
                    record.items?.reduce((sum, it) => sum + it.quantity, 0) || 0,
                },
                {
                  title: 'Subtotal',
                  dataIndex: 'total',
                  align: 'right',
                  render: (_: number, record: SellerOrder) => {
                    const discounted = record.total
                    const original = record.originalTotal ?? record.total
                    const hasDiscount = original > discounted
                    if (!hasDiscount) {
                      return (
                        <span className="font-semibold text-slate-900">
                          ₹{discounted.toFixed(2)}
                        </span>
                      )
                    }
                    return (
                      <span className="font-semibold text-slate-900 flex flex-col items-end">
                        <span className="text-xs text-slate-500 line-through">
                          ₹{original.toFixed(2)}
                        </span>
                        <span>₹{discounted.toFixed(2)}</span>
                      </span>
                    )
                  },
                },
                {
                  title: 'Status',
                  dataIndex: ['sellerShipment', 'status'],
                  render: (_: unknown, record: SellerOrder) => {
                    const st = record.sellerShipment?.status || 'pending'
                    return <Tag color={statusColors[st]}>{formatStatusLabel(st)}</Tag>
                  },
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  render: (_: unknown, record: SellerOrder) => {
                    const st = record.sellerShipment?.status
                    const hasAnyInstructions =
                      !!record.deliveryInstructions ||
                      (record.items || []).some(
                        (it) => it.instructions && it.instructions.trim().length > 0,
                      )
                    const canShowOrderDocuments =
                      st &&
                      [
                        'pickup_requested',
                        'shipped',
                        'in_transit',
                        'out_for_delivery',
                        'delivered',
                      ].includes(st)
                    return (
                      <Space size="small" wrap>
                        {st === 'pending' && (
                          <Button
                            size="small"
                            type="default"
                            className="border-blue-200 text-blue-600 hover:border-blue-400 hover:text-blue-700"
                            onClick={() => void handleStatusChange('processing', record)}
                          >
                            Mark Processing
                          </Button>
                        )}
                        {st === 'processing' && (
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => {
                              setActiveOrderForModal(record)
                              setActiveShipmentForModal(record.sellerShipment)
                              setPickupModalOpen(true)
                            }}
                          >
                            Request Pickup
                          </Button>
                        )}
                        {record.canShip && st !== 'processing' && (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              setActiveOrderForModal(record)
                              setActiveShipmentForModal(record.sellerShipment)
                              setShipModalOpen(true)
                            }}
                          >
                            Ship
                          </Button>
                        )}
                        {canShowOrderDocuments && record.invoice?.invoice_url && (
                          <Button
                            type="link"
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              window.open(record.invoice!.invoice_url!, '_blank', 'noopener')
                            }
                            title="Customer invoice (same as sent to buyer)"
                          >
                            Customer Invoice
                          </Button>
                        )}
                        {canShowOrderDocuments && record.sellerShipment?.invoice?.invoice_url && (
                          <Button
                            type="link"
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              window.open(
                                record.sellerShipment!.invoice!.invoice_url!,
                                '_blank',
                                'noopener',
                              )
                            }
                            title="Shipment Invoice"
                          >
                            Shipment Invoice
                          </Button>
                        )}
                        {canShowOrderDocuments &&
                          record.sellerShipment?.triplicateInvoice?.invoice_url && (
                            <Button
                              type="link"
                              size="small"
                              icon={<FilePdfOutlined />}
                              onClick={() =>
                                window.open(
                                  record.sellerShipment!.triplicateInvoice!.invoice_url!,
                                  '_blank',
                                  'noopener',
                                )
                              }
                              title="Triplicate copy (To Supplier)"
                            >
                              Triplicate (To Supplier)
                            </Button>
                          )}
                        {canShowOrderDocuments && record.sellerShipment?.label?.label_url && (
                          <Button
                            type="link"
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              window.open(
                                record.sellerShipment!.label!.label_url!,
                                '_blank',
                                'noopener',
                              )
                            }
                            title="Shipment Label"
                          >
                            Shipment Label
                          </Button>
                        )}
                        {canCancelOrder(record) && (
                          <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleCancelOrder(record)}
                          >
                            Cancel Order
                          </Button>
                        )}
                        {hasAnyInstructions && (
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              setNotesOrder(record)
                              setNotesModalOpen(true)
                            }}
                          >
                            View Notes
                          </Button>
                        )}
                      </Space>
                    )
                  },
                },
              ]}
              dataSource={batch.orders}
              rowKey={(r) => r._id}
              rowSelection={{
                selectedRowKeys: selectedBatchOrderIds,
                onChange: (keys) => setSelectedBatchOrderIds(keys),
              }}
              pagination={false}
            />
          ) : (
            <Table<SellerOrderItem>
              size="middle"
              columns={itemsColumns}
              dataSource={items}
              rowKey={(record) =>
                record._id || record.item?.sku || record.item?.name || Math.random().toString(36)
              }
              pagination={false}
            />
          )}
        </Card>

        {/* Shipment Details */}
        <Card
          bordered={false}
          className="shadow-sm rounded-2xl"
          title={<span className="text-sm font-semibold text-slate-800">Shipment Details</span>}
          extra={
            shipment && (
              <Space wrap>
                {order?.invoice?.invoice_url && (
                  <Button
                    size="small"
                    icon={<FilePdfOutlined />}
                    onClick={() => window.open(order.invoice!.invoice_url!, '_blank', 'noopener')}
                    title="Customer invoice (same as sent to buyer)"
                  >
                    Customer Invoice
                  </Button>
                )}
                {shipment?.manifest?.manifest_url && (
                  <Button size="small" icon={<FilePdfOutlined />} onClick={handleDownloadManifest}>
                    Download Manifest
                  </Button>
                )}
                {shipment?.invoice?.invoice_url && (
                  <Button
                    size="small"
                    icon={<FilePdfOutlined />}
                    onClick={() =>
                      window.open(shipment.invoice!.invoice_url!, '_blank', 'noopener')
                    }
                  >
                    Shipment Invoice
                  </Button>
                )}
                {shipment?.triplicateInvoice?.invoice_url && (
                  <Button
                    size="small"
                    icon={<FilePdfOutlined />}
                    onClick={() =>
                      window.open(shipment.triplicateInvoice!.invoice_url!, '_blank', 'noopener')
                    }
                    title="Triplicate copy (To Supplier)"
                  >
                    Triplicate (To Supplier)
                  </Button>
                )}
                {/* Enable tracking as soon as we have any AWB (from shippingMeta or kourierBoyzLogistics) */}
                {(shipment.shippingMeta?.awb || shipment.kourierBoyzLogistics?.awb_number) && (
                  <Button
                    size="small"
                    type="primary"
                    onClick={handleTrackShipment}
                    loading={trackShipmentMutation.isPending}
                  >
                    Track Shipment
                  </Button>
                )}
              </Space>
            )
          }
        >
          {canShowShipmentDetails && shipmentsForDetails.length > 0 ? (
            <Space direction="vertical" size="large" className="w-full">
              {shipmentsForDetails.map((s, idx) => (
                <div
                  key={s._id || idx}
                  className={
                    shipmentsForDetails.length > 1 ? 'border border-slate-200 rounded-xl p-3' : ''
                  }
                >
                  {shipmentsForDetails.length > 1 && (
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          Shipment #{idx + 1}
                        </div>
                        {isBatchView && (
                          <div className="text-xs text-slate-500">
                            Covers{' '}
                            {batchShipmentGroups[idx]?.orders
                              ?.map((o) => o.orderNumber || o._id)
                              .join(', ')}
                          </div>
                        )}
                      </div>
                      <Space size="small">
                        {s.invoice?.invoice_url && (
                          <Button
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              window.open(s.invoice!.invoice_url!, '_blank', 'noopener')
                            }
                          >
                            Shipment Invoice
                          </Button>
                        )}
                        {s.triplicateInvoice?.invoice_url && (
                          <Button
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              window.open(s.triplicateInvoice!.invoice_url!, '_blank', 'noopener')
                            }
                            title="Triplicate copy (To Supplier)"
                          >
                            Triplicate (To Supplier)
                          </Button>
                        )}
                        {s.label?.label_url && (
                          <Button
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() => window.open(s.label!.label_url!, '_blank', 'noopener')}
                          >
                            Shipment Label
                          </Button>
                        )}
                      </Space>
                    </div>
                  )}
                  {shipmentsForDetails.length === 1 && (
                    <div className="mb-3 flex justify-end">
                      <Space size="small">
                        {s.invoice?.invoice_url && (
                          <Button
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              window.open(s.invoice!.invoice_url!, '_blank', 'noopener')
                            }
                          >
                            Shipment Invoice
                          </Button>
                        )}
                        {s.triplicateInvoice?.invoice_url && (
                          <Button
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() =>
                              window.open(s.triplicateInvoice!.invoice_url!, '_blank', 'noopener')
                            }
                            title="Triplicate copy (To Supplier)"
                          >
                            Triplicate (To Supplier)
                          </Button>
                        )}
                        {s.label?.label_url && (
                          <Button
                            size="small"
                            icon={<FilePdfOutlined />}
                            onClick={() => window.open(s.label!.label_url!, '_blank', 'noopener')}
                          >
                            Shipment Label
                          </Button>
                        )}
                      </Space>
                    </div>
                  )}
                  <Row gutter={[24, 16]}>
                    <Col xs={24} md={12}>
                      <Space direction="vertical" size="small" className="w-full">
                        <div className="flex items-center justify-between">
                          <Text type="secondary">Current Status</Text>
                          <Tag color={statusColors[s.status]}>{formatStatusLabel(s.status)}</Tag>
                        </div>
                        <div className="flex items-center justify-between">
                          <Text type="secondary">Courier</Text>
                          <Text strong>{s.shippingMeta?.courier || 'Not assigned'}</Text>
                        </div>
                        <div className="flex items-center justify-between">
                          <Text type="secondary">AWB</Text>
                          <Text strong>
                            {s.shippingMeta?.awb || s.kourierBoyzLogistics?.awb_number || 'NA'}
                          </Text>
                        </div>
                        {(s.shippingMeta?.tracking_link ||
                          s.kourierBoyzLogistics?.tracking_link ||
                          s.shareableTrackingLink) && (
                          <div className="flex flex-col gap-2">
                            {(s.shippingMeta?.tracking_link || s.kourierBoyzLogistics?.tracking_link) && (
                              <div className="flex items-center justify-between">
                                <Text type="secondary">Courier Link</Text>
                                <a
                                  href={
                                    s.shippingMeta?.tracking_link || s.kourierBoyzLogistics?.tracking_link
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline font-medium text-sm"
                                >
                                  Open
                                </a>
                              </div>
                            )}
                            {s.shareableTrackingLink && (
                              <div className="mt-2">
                                <div className="mb-1">
                                  <Text type="secondary" className="text-xs">
                                    Shareable Tracking Link:
                                  </Text>
                                </div>
                                <Space.Compact style={{ width: '100%' }}>
                                  <Input
                                    value={s.shareableTrackingLink}
                                    readOnly
                                    size="small"
                                    className="text-xs"
                                  />
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<CopyOutlined />}
                                    onClick={() => {
                                      navigator.clipboard.writeText(s.shareableTrackingLink!)
                                      message.success('Tracking link copied!')
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </Space.Compact>
                              </div>
                            )}
                          </div>
                        )}
                        {s.shippingMeta?.pickup_address && (
                          <div className="mt-2">
                            <Text strong>Pickup Address</Text>
                            <div className="text-sm text-gray-600 mt-1">
                              {s.shippingMeta.pickup_address.warehouseName}
                              <br />
                              {s.shippingMeta.pickup_address.addressLine1}
                              {s.shippingMeta.pickup_address.addressLine2 && (
                                <>
                                  <br />
                                  {s.shippingMeta.pickup_address.addressLine2}
                                </>
                              )}
                              <br />
                              {s.shippingMeta.pickup_address.city},{' '}
                              {s.shippingMeta.pickup_address.state}{' '}
                              {s.shippingMeta.pickup_address.postalCode}
                            </div>
                          </div>
                        )}
                      </Space>
                    </Col>
                    <Col xs={24} md={12}>
                      <Text strong>Tracking Timeline</Text>
                      {s.trackingEvents && s.trackingEvents.length > 0 ? (
                        <Timeline
                          style={{ marginTop: 12 }}
                          items={s.trackingEvents.map((event) => ({
                            dot: <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />,
                            children: (
                              <div className="p-1">
                                <div className="font-medium text-sm text-slate-900">
                                  {event.status}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {dayjs(event.timestamp).format('DD MMM, HH:mm')}
                                </div>
                                {event.location && (
                                  <div className="text-[11px] text-slate-400">{event.location}</div>
                                )}
                                {event.message && (
                                  <div className="text-[11px] text-slate-400">{event.message}</div>
                                )}
                              </div>
                            ),
                          }))}
                        />
                      ) : (
                        <Empty
                          description="No tracking events yet"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          className="mt-2"
                        />
                      )}
                    </Col>
                  </Row>
                </div>
              ))}
            </Space>
          ) : (
            !isBatchView && (
              <Empty
                description="Shipment details will appear after pickup is requested"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )
          )}
        </Card>

        {/* Modals */}
        <RequestPickupModal
          open={pickupModalOpen}
          onClose={() => {
            setPickupModalOpen(false)
            setBatchBulkMode(null)
            setBatchBulkQueue([])
            setActiveOrderForModal(undefined)
            setActiveShipmentForModal(undefined)
          }}
          // Primary order context (used for header, address, etc.)
          order={modalOrders[0]}
          // All orders that should be considered for this pickup flow
          orders={modalOrders}
          shipment={activeShipmentForModal || shipment}
          pickupAddresses={pickupAddresses}
          onSuccess={() => {
            if (batchBulkMode === 'pickup' && batchBulkQueue.length > 0) {
              const [, ...rest] = batchBulkQueue
              if (rest.length > 0) {
                setBatchBulkQueue(rest)
                setActiveOrderForModal(rest[0])
                setActiveShipmentForModal(rest[0].sellerShipment)
              } else {
                setBatchBulkMode(null)
                setBatchBulkQueue([])
                setPickupModalOpen(false)
                setActiveOrderForModal(undefined)
                setActiveShipmentForModal(undefined)
              }
            } else {
              setPickupModalOpen(false)
              setActiveOrderForModal(undefined)
              setActiveShipmentForModal(undefined)
            }
          }}
        />
        <ShipOrderModal
          open={shipModalOpen}
          onClose={() => {
            setShipModalOpen(false)
            setActiveOrderForModal(undefined)
            setActiveShipmentForModal(undefined)
          }}
          order={activeOrderForModal || order}
          shipment={activeShipmentForModal || shipment}
          pickupAddresses={pickupAddresses}
        />
        {selectedShipmentForTracking && order && (
          <TrackingModal
            open={trackingModalOpen}
            onClose={() => {
              setTrackingModalOpen(false)
              setSelectedShipmentForTracking(undefined)
            }}
            orderId={order._id}
            shipment={selectedShipmentForTracking}
          />
        )}
        <Modal
          open={notesModalOpen}
          title="Customer Instructions"
          onCancel={() => {
            setNotesModalOpen(false)
            setNotesOrder(undefined)
          }}
          footer={null}
          centered
        >
          {!notesOrder ? (
            <Empty description="No instructions" />
          ) : (
            <Space direction="vertical" size="small" className="w-full">
              {notesOrder.deliveryInstructions && (
                <div>
                  <Text strong>Delivery Instructions</Text>
                  <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">
                    {notesOrder.deliveryInstructions}
                  </div>
                </div>
              )}
              <div>
                <Text strong>Item Instructions</Text>
                <div className="mt-1 space-y-1">
                  {(notesOrder.items || [])
                    .filter((it) => it.instructions && it.instructions.trim().length > 0)
                    .map((it) => {
                      const label =
                        it.item?.name || it.item?.baseName || `Item x${it.quantity.toString()}`
                      return (
                        <div
                          key={
                            it._id ||
                            `${it.item?.productId}-${it.item?.variantId}-${it.instructions}`
                          }
                          className="text-xs text-slate-700 whitespace-pre-wrap break-words"
                        >
                          <span className="font-semibold text-slate-800">{label}: </span>
                          {it.instructions}
                        </div>
                      )
                    })}
                  {(notesOrder.items || []).every(
                    (it) => !it.instructions || it.instructions.trim().length === 0,
                  ) && <div className="text-xs text-slate-400">No item-level instructions.</div>}
                </div>
              </div>
            </Space>
          )}
        </Modal>
        <Modal
          title="Cancel Order?"
          open={cancelModalOpen}
          onOk={handleConfirmCancel}
          onCancel={() => {
            setCancelModalOpen(false)
            setOrderToCancel(undefined)
          }}
          okText="Cancel Order"
          okButtonProps={{ danger: true }}
          confirmLoading={cancelOrderMutation.isPending}
        >
          <p>
            Are you sure you want to cancel order #
            {orderToCancel?.orderNumber || orderToCancel?._id}? This action cannot be undone.
          </p>
        </Modal>
      </div>
    </div>
  )
}

export default OrderDetail
