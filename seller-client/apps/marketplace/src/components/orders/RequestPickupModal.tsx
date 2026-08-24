import {
  CheckCircleOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  ShopOutlined,
  TruckOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { App, Badge, Button, Card, Divider, Empty, Modal, Radio, Select, Space, Spin } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PublicAPI } from '../../api/axiosInstance'
import { useRequestPickup } from '../../api/orderQueries'
import type { CourierRateOption, SellerOrder, SellerShipment } from '../../api/orders'
import { getProductsForOrderItems, type ProductWarehouseForOrderItem } from '../../api/products'

interface RequestPickupModalProps {
  open: boolean
  onClose: () => void
  // Primary order used for header and address display
  order?: SellerOrder
  // Optional list of orders this pickup flow should consider (e.g. batch selected orders)
  orders?: SellerOrder[]
  shipment?: SellerShipment
  pickupAddresses?: Array<{
    _id?: string
    warehouseName?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    contactName?: string
    contactPhone?: string
    isDefault?: boolean
  }>
  onSuccess?: () => void
}

interface WarehouseOption {
  itemId: string
  warehouseId: string
  warehouseName: string
  pickupId: string | null
  sku: string
  productName: string
  quantity: number
  lowStockThreshold?: number
}

interface CourierData {
  courier_id: number
  courier_name: string
  rate?: number | string
  estimated_delivery_days?: string
  'estimated delivery days'?: string
  estimated_delivery_date?: string
  'estimated delivery_date'?: string
  serviceable?: boolean
  cod_available?: boolean
  zone?: string
  rate_details?: {
    forward?: {
      rate?: string | number
      cod_charges?: string | number
      cod_percent?: string | number
      other_charges?: string | number
    }
    rto?: {
      rate?: string | number
      cod_charges?: string | number
    }
  }
  provider_code?: string
}

const RequestPickupModal = ({
  open,
  onClose,
  order,
  orders,
  shipment,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pickupAddresses: _pickupAddresses = [],
  onSuccess,
}: RequestPickupModalProps) => {
  const { message } = App.useApp()
  const requestPickupMutation = useRequestPickup()
  // Selected warehouse per-order-item (keyed by order item _id)
  const [selectedWarehousesByItem, setSelectedWarehousesByItem] = useState<
    Record<string, string | undefined>
  >({})
  // Courier options and selection per shipment group (grouped by warehouse)
  const [couriersByGroup, setCouriersByGroup] = useState<Record<string, CourierRateOption[]>>({})
  const [selectedCourierByGroup, setSelectedCourierByGroup] = useState<
    Record<string, CourierRateOption | null>
  >({})
  const [fragileByGroup, setFragileByGroup] = useState<Record<string, boolean>>({})
  const [loadingGroupKey, setLoadingGroupKey] = useState<string | null>(null)
  const [loadingServiceability, setLoadingServiceability] = useState(false)

  // All items from the active orders context (single order or multiple selected orders)
  const allItems: SellerOrder['items'] = useMemo(() => {
    if (orders && orders.length > 0) {
      return orders.flatMap((o) => o.items || [])
    }
    return order?.items || []
  }, [orders, order])

  // Extract item IDs for these orders
  const orderItemIds = useMemo(() => {
    if (!allItems.length) return []
    return allItems.map((item) => item._id || '').filter((id): id is string => Boolean(id))
  }, [allItems])

  // Fetch compact product + warehouse info for specific order items
  const { data: productsByItem } = useQuery({
    queryKey: [
      'products-by-order-items',
      orders && orders.length > 0 ? orders.map((o) => o._id) : order?._id,
      orderItemIds,
    ],
    queryFn: async () => {
      // When multiple orders are provided (batch "request pickup for selected"),
      // fetch compact product+warehouse info for each order and flatten.
      if (orders && orders.length > 0) {
        const results = await Promise.all(
          orders.map((o) => {
            const itemIdsForOrder = (o.items || [])
              .map((item) => item._id || '')
              .filter((id): id is string => Boolean(id))
            if (!itemIdsForOrder.length) {
              return Promise.resolve([] as ProductWarehouseForOrderItem[])
            }
            return getProductsForOrderItems(o._id, itemIdsForOrder)
          }),
        )
        return results.flat()
      }

      if (!order?._id || orderItemIds.length === 0) return []
      return getProductsForOrderItems(order._id, orderItemIds)
    },
    enabled: open && ((orders && orders.length > 0) || (!!order?._id && orderItemIds.length > 0)),
  })

  // Extract warehouse options from products-by-item response
  const warehouseOptions = useMemo((): WarehouseOption[] => {
    if (!productsByItem?.length) return []
    const warehouses: WarehouseOption[] = []

    productsByItem.forEach((entry: ProductWarehouseForOrderItem) => {
      if (entry.warehouseInventory?.length) {
        entry.warehouseInventory.forEach((warehouse) => {
          warehouses.push({
            itemId: entry.itemId,
            warehouseId: warehouse.warehouseId,
            warehouseName: warehouse.warehouseName,
            pickupId: warehouse.pickupId || null,
            sku: entry.sku,
            productName: entry.name,
            quantity: warehouse.quantity,
            lowStockThreshold: warehouse.lowStockThreshold,
          })
        })
      }
    })
    return warehouses
  }, [productsByItem])

  interface ShipmentGroup {
    key: string
    warehouse: WarehouseOption
    items: NonNullable<SellerOrder['items']>
  }

  // Group order items by their selected warehouse
  const shipmentGroups = useMemo<ShipmentGroup[]>(() => {
    if (!allItems.length) return []
    const groupsMap = new Map<string, ShipmentGroup>()

    allItems.forEach((item) => {
      const itemId = item._id
      if (!itemId) return

      const selectedKey = selectedWarehousesByItem[itemId]
      if (!selectedKey) return

      const warehouse = warehouseOptions.find(
        (w) => w.itemId === itemId && (w.pickupId || w.warehouseId) === selectedKey,
      )
      if (!warehouse) return

      const groupKey = `${warehouse.warehouseId}|${warehouse.pickupId || ''}`
      const existing = groupsMap.get(groupKey)
      if (!existing) {
        groupsMap.set(groupKey, {
          key: groupKey,
          warehouse,
          items: [item],
        })
      } else {
        existing.items.push(item)
      }
    })

    return Array.from(groupsMap.values())
  }, [allItems, selectedWarehousesByItem, warehouseOptions])

  // Helper: compute forward total (forward rate + COD if COD order + other). Used for display and backend.
  const getForwardTotalCharges = useCallback(
    (courier: CourierRateOption, isCod: boolean): number => {
      const forwardRate =
        courier.rate_details?.forward?.rate !== undefined
          ? typeof courier.rate_details.forward.rate === 'string'
            ? parseFloat(courier.rate_details.forward.rate)
            : courier.rate_details.forward.rate
          : (typeof courier.rate === 'number' ? courier.rate : courier.rate ? parseFloat(String(courier.rate)) : 0)

      const codCharges =
        isCod && courier.rate_details?.forward?.cod_charges !== undefined
          ? typeof courier.rate_details.forward.cod_charges === 'string'
            ? parseFloat(courier.rate_details.forward.cod_charges)
            : courier.rate_details.forward.cod_charges
          : 0

      const otherCharges =
        courier.rate_details?.forward?.other_charges !== undefined
          ? typeof courier.rate_details.forward.other_charges === 'string'
            ? parseFloat(courier.rate_details.forward.other_charges)
            : courier.rate_details.forward.other_charges
          : 0

      return forwardRate + codCharges + otherCharges
    },
    [],
  )

  // Transform courier data to standard format (rate = forward rate for display/fallback)
  const transformCourierData = useCallback((c: CourierData): CourierRateOption => {
    let rate: number | undefined
    if (c.rate_details?.forward?.rate !== undefined) {
      rate =
        typeof c.rate_details.forward.rate === 'string'
          ? parseFloat(c.rate_details.forward.rate)
          : c.rate_details.forward.rate
    } else if (c.rate !== undefined) {
      rate = typeof c.rate === 'string' ? parseFloat(c.rate) : c.rate
    }

    return {
      courier_id: c.courier_id,
      courier_name: c.courier_name,
      rate,
      estimated_delivery_days: c.estimated_delivery_days || c['estimated delivery days'],
      estimated_delivery_date: c.estimated_delivery_date || c['estimated delivery_date'],
      serviceable: c.serviceable,
      cod_available: c.cod_available,
      zone: c.zone,
      rate_details: c.rate_details,
      provider_code: c.provider_code,
    }
  }, [])

  // Parse courier data from serviceability response
  const parseCouriers = useCallback(
    (data: unknown): CourierRateOption[] => {
      if (Array.isArray(data)) {
        return data.map(transformCourierData)
      }
      if (data && typeof data === 'object') {
        const dataObj = data as {
          couriers?: CourierData[]
          courier?: CourierData
        }
        if (dataObj.couriers && Array.isArray(dataObj.couriers)) {
          return dataObj.couriers.map(transformCourierData)
        }
        if (dataObj.courier) {
          return [transformCourierData(dataObj.courier)]
        }
      }
      return []
    },
    [transformCourierData],
  )

  // Fetch serviceability for a specific shipment group
  const fetchServiceabilityForGroup = useCallback(
    async (group: ShipmentGroup) => {
      if (!order?.shippingAddress?.postalCode || !productsByItem?.length) return

      setLoadingServiceability(true)
      setLoadingGroupKey(group.key)
      try {
        const product = productsByItem[0]
        // Use public serviceability API (same as storefront), not seller-scoped one
        const response = await PublicAPI.get(`/products/${product.productId}/serviceability`, {
          params: {
            destination: order.shippingAddress.postalCode,
            pickup_id: group.warehouse.pickupId || undefined,
            origin: group.warehouse.pickupId ? undefined : group.warehouse.warehouseId,
            orderAmount: order.total,
            paymentType: order.paymentMethod === 'cod' ? 'cod' : 'prepaid',
          },
        })

        if (response.data?.success && response.data?.data) {
          const parsedCouriers = parseCouriers(response.data.data)
          setCouriersByGroup((prev) => ({
            ...prev,
            [group.key]: parsedCouriers,
          }))

          if (parsedCouriers.length > 0) {
            const isCod = order?.paymentMethod === 'cod'
            const cheapest = parsedCouriers.reduce((prev, curr) => {
              const prevTotal = getForwardTotalCharges(prev, isCod)
              const currTotal = getForwardTotalCharges(curr, isCod)
              return currTotal < prevTotal ? curr : prev
            })
            setSelectedCourierByGroup((prev) => ({
              ...prev,
              [group.key]: cheapest,
            }))
          }
        }
      } catch (error) {
        console.error('Failed to fetch serviceability:', error)
        message.error('Failed to fetch courier options')
        setCouriersByGroup((prev) => ({ ...prev, [group.key]: [] }))
        setSelectedCourierByGroup((prev) => ({ ...prev, [group.key]: null }))
      } finally {
        setLoadingServiceability(false)
        setLoadingGroupKey(null)
      }
    },
    [order, productsByItem, parseCouriers, getForwardTotalCharges, message],
  )
  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedWarehousesByItem({})
      setCouriersByGroup({})
      setSelectedCourierByGroup({})
      setFragileByGroup({})
      setLoadingGroupKey(null)
    }
  }, [open])

  // Handle pickup confirmation for all shipment groups
  const handleConfirmPickup = useCallback(async () => {
    if (!order) return

    if (!shipmentGroups.length) {
      message.error('Assign at least one item to a warehouse')
      return
    }

    // Ensure each shipment group has a selected courier
    for (const group of shipmentGroups) {
      if (!selectedCourierByGroup[group.key]) {
        message.error('Please select courier options for all shipment groups before confirming')
        return
      }
    }

    try {
      const isCod = order.paymentMethod === 'cod'
      const shipments = shipmentGroups.map((group) => {
        const courier = selectedCourierByGroup[group.key]!
        const itemIds = group.items.map((item) => item._id || '').filter(Boolean) as string[]
        const fragile = fragileByGroup[group.key] || false
        const totalCharges = getForwardTotalCharges(courier, isCod)

        return {
          package: {
            weight: 500,
            length: 20,
            width: 15,
            height: 10,
          },
          courierId: courier.courier_id,
          providerCode: courier.provider_code,
          estimatedCharge: totalCharges,
          itemIds,
          fragile,
        }
      })

      // Extract pickup address ID from the first shipment group's warehouse
      // Since all items in a shipment group share the same warehouse/pickup address,
      // we use the first group's pickupId (KourierBoyzLogistics ID) or warehouseId (MongoDB _id or KourierBoyzLogistics ID)
      // Backend will handle matching by either _id or kourierBoyzLogisticsPickupAddressId
      const pickupAddressId =
        shipmentGroups.length > 0
          ? shipmentGroups[0]?.warehouse?.pickupId ||
            shipmentGroups[0]?.warehouse?.warehouseId ||
            undefined
          : undefined

      // Set up timeout to show a message if request takes too long (5 seconds)
      let timeoutId: ReturnType<typeof setTimeout> | null = null
      const showLongRunningToast = () => {
        message.info({
          content: 'Hold on, this is taking longer than usual...',
          duration: 8, // Show for 8 seconds
          key: 'pickup-request-long-running', // Use key to prevent duplicates
        })
      }
      timeoutId = setTimeout(showLongRunningToast, 12000) // Show after 10 seconds

      try {
        await requestPickupMutation.mutateAsync({
          orderId: order._id,
          payload: {
            shipments,
            pickupAddressId,
          },
        })

        // Clear timeout if request completes before timeout
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }

        message.success('Pickup requested for all shipment groups!')
        onSuccess?.()
        // Ensure modal closes even if parent didn't change its own state on success
        onClose?.()
      } catch (requestError) {
        // Clear timeout on error
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        throw requestError // Re-throw to be caught by outer catch
      }
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to request pickup')
    }
  }, [
    order,
    shipmentGroups,
    selectedCourierByGroup,
    fragileByGroup,
    getForwardTotalCharges,
    message,
    onClose,
    onSuccess,
    requestPickupMutation,
  ])

  if (!order || !shipment) return null

  return (
    <Modal
      title={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
              <TruckOutlined className="text-white text-lg" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">Request Pickup</div>
              <div className="text-xs text-gray-500 font-normal">
                Assign warehouses and confirm courier for this shipment
              </div>
            </div>
          </div>
          {allItems.length > 0 && (
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>
                {orders?.length ?? 1} order{(orders?.length ?? 1) > 1 ? 's' : ''}, {allItems.length}{' '}
                item{allItems.length > 1 ? 's' : ''} to ship
              </span>
            </div>
          )}
        </div>
      }
      open={open}
      onCancel={onClose}
      // Responsive modal: use viewport width with a sensible max width
      width="90vw"
      style={{ top: 16, maxWidth: 1400 }}
      confirmLoading={requestPickupMutation.isPending}
      onOk={handleConfirmPickup}
      okText={
        <span className="flex items-center gap-2">
          <CheckCircleOutlined />
          Confirm Pickup Request
        </span>
      }
      okButtonProps={{
        disabled:
          loadingServiceability ||
          shipmentGroups.length === 0 ||
          shipmentGroups.some((group) => !selectedCourierByGroup[group.key]),
        size: 'large',
        className:
          'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 border-0 shadow-lg',
      }}
      cancelButtonProps={{ size: 'large' }}
      className="request-pickup-modal"
    >
      <Space direction="vertical" size="large" className="w-full">
        {/* Items & Address stacked for clarity */}
        <Card
          size="small"
          title={
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
                <ShopOutlined className="text-blue-600 text-sm" />
              </div>
              <span className="text-sm font-semibold text-gray-800">Items & Warehouses</span>
            </div>
          }
          className="border-2 border-blue-100 hover:border-blue-300 transition-all duration-300 shadow-sm hover:shadow-md"
          headStyle={{ borderBottom: '2px solid #e0f2fe', padding: '16px' }}
          bodyStyle={{ padding: '16px' }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                Items in this pickup
              </span>
              {shipmentGroups.length > 0 && (
                <span className="text-[11px] text-slate-500">
                  {shipmentGroups.length} planned shipment
                  {shipmentGroups.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {allItems.map((item) => {
                const merged = item.item
                const sku = merged?.sku || merged?.baseSku || undefined
                const itemId = item._id
                if (!itemId) return null

                const optionsForSku =
                  sku && warehouseOptions.length
                    ? warehouseOptions.filter((w) => w.sku === sku)
                    : []

                const selectedKey = selectedWarehousesByItem[itemId]

                const renderStockStatus = (warehouse: WarehouseOption) => {
                  const qty = warehouse.quantity ?? 0
                  const threshold = warehouse.lowStockThreshold ?? 0
                  const isOut = qty <= 0
                  const isLow = !isOut && threshold > 0 && qty <= threshold

                  if (isOut) {
                    return { text: 'Out of stock', className: 'text-red-500 font-semibold' }
                  }
                  if (isLow) {
                    return {
                      text: `Low: ${qty} in stock`,
                      className: 'text-amber-500 font-semibold',
                    }
                  }
                  return { text: `${qty} in stock`, className: 'text-emerald-600 font-semibold' }
                }

                return (
                  <div
                    key={itemId}
                    className="flex items-start justify-between gap-3 py-2 border-b border-slate-100"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900 line-clamp-2">
                        {merged?.name || merged?.baseName || 'Product'}
                      </div>
                      {sku && <div className="text-xs text-gray-500">SKU: {sku}</div>}
                      {/* Show stock for all warehouses upfront so seller can compare before selecting */}
                      {optionsForSku.length > 0 ? (
                        <div className="mt-1 space-y-0.5">
                          {optionsForSku.slice(0, 3).map((w) => {
                            const { text, className } = renderStockStatus(w)
                            const isSelected =
                              !!selectedKey && (w.pickupId || w.warehouseId) === selectedKey
                            return (
                              <div
                                key={w.warehouseId}
                                className="text-[11px] flex flex-wrap items-center gap-1 text-slate-600"
                              >
                                <span
                                  className={isSelected ? 'font-semibold text-emerald-700' : ''}
                                >
                                  {w.warehouseName}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className={className}>{text}</span>
                                {isSelected && (
                                  <span className="ml-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 border border-emerald-100">
                                    Selected
                                  </span>
                                )}
                              </div>
                            )
                          })}
                          {optionsForSku.length > 3 && (
                            <div className="text-[10px] text-slate-400">
                              +{optionsForSku.length - 3} more warehouses
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-amber-500">
                          No warehouse inventory configured for this SKU
                        </div>
                      )}
                    </div>
                    <div className="w-56">
                      <Select
                        size="small"
                        className="warehouse-select w-full"
                        placeholder="Select warehouse"
                        value={selectedKey}
                        onChange={(value) =>
                          setSelectedWarehousesByItem((prev) => ({
                            ...prev,
                            [itemId]: value,
                          }))
                        }
                        disabled={!optionsForSku.length}
                        options={optionsForSku.map((w) => {
                          const { text, className } = renderStockStatus(w)
                          const isOut = w.quantity <= 0
                          return {
                            value: w.pickupId || w.warehouseId,
                            disabled: isOut,
                            label: (
                              <div className="flex items-center justify-between w-full">
                                <span>
                                  {w.warehouseName}
                                  {w.productName ? ` (${w.productName})` : ''}
                                </span>
                                <span className={`text-[11px] ${className}`}>{text}</span>
                              </div>
                            ),
                          }
                        })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>

        <Card
          size="small"
          title={
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50">
                <HomeOutlined className="text-emerald-600 text-sm" />
              </div>
              <span className="text-sm font-semibold text-gray-800">Delivery Address</span>
            </div>
          }
          className="border-2 border-emerald-100 hover:border-emerald-300 transition-all duration-300 shadow-sm hover:shadow-md"
          headStyle={{ borderBottom: '2px solid #d1fae5', padding: '16px' }}
          bodyStyle={{ padding: '16px' }}
        >
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="font-bold text-gray-900 text-base">{order.shippingAddress.name}</div>
              <Badge status="success" text="Verified" />
            </div>
            <div className="text-gray-700 font-medium">{order.shippingAddress.addressLine1}</div>
            {order.shippingAddress.addressLine2 && (
              <div className="text-gray-600">{order.shippingAddress.addressLine2}</div>
            )}
            <div className="text-gray-600 flex items-center gap-1">
              <EnvironmentOutlined className="text-gray-400" />
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              {order.shippingAddress.postalCode}
            </div>
            <Divider className="my-2" />
            <div className="text-gray-600 flex items-center gap-2">
              <span className="font-medium">Phone:</span>
              <span className="font-mono">{order.shippingAddress.phone}</span>
            </div>
          </div>
        </Card>

        <Divider className="my-1" />

        {/* Shipment Groups & Courier Options */}
        <Card
          size="small"
          title={
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50">
                <TruckOutlined className="text-purple-600 text-sm" />
              </div>
              <span className="text-sm font-semibold text-gray-800">
                Shipments & Courier Options
              </span>
            </div>
          }
          extra={
            shipmentGroups.length > 0 && (
              <Button
                size="small"
                type="primary"
                icon={<TruckOutlined />}
                loading={loadingServiceability}
                onClick={async () => {
                  if (!shipmentGroups.length) return
                  // Check serviceability & pricing for all shipment groups
                  for (const group of shipmentGroups) {
                    await fetchServiceabilityForGroup(group)
                  }
                }}
              >
                Check for all shipments
              </Button>
            )
          }
          className="border border-gray-200 shadow-sm"
          headStyle={{ borderBottom: '2px solid #f3f4f6', padding: '16px' }}
          bodyStyle={{ padding: '20px' }}
        >
          {loadingServiceability && !shipmentGroups.length ? (
            <div className="flex justify-center py-8">
              <Spin size="large" tip="Fetching courier options..." />
            </div>
          ) : shipmentGroups.length > 0 ? (
            <Space direction="vertical" size="large" className="w-full">
              {shipmentGroups.map((group, index) => {
                const couriers = couriersByGroup[group.key] || []
                const selected = selectedCourierByGroup[group.key] || null

                return (
                  <div key={group.key} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-sm text-gray-900">
                          Shipment #{index + 1} – {group.warehouse.warehouseName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {group.items.length} item
                          {group.items.length > 1 ? 's' : ''} in this shipment
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fragileByGroup[group.key] || false}
                            onChange={(e) =>
                              setFragileByGroup((prev) => ({
                                ...prev,
                                [group.key]: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Contains Fragile Items
                          </span>
                        </label>
                      </div>
                    </div>

                    {loadingGroupKey === group.key ? (
                      <div className="flex justify-center py-4">
                        <Spin size="small" tip="Loading courier options..." />
                      </div>
                    ) : couriers.length > 0 ? (
                      couriers.length === 1 ? (
                        // Single courier: auto-selected, no radio needed
                        (() => {
                          const courier = couriers[0]
                          const isCod = order?.paymentMethod === 'cod'
                          const totalCharges = getForwardTotalCharges(courier, isCod)

                          return (
                            <div className="mt-2 border rounded-xl bg-blue-50/60 border-blue-100 p-3 flex flex-col gap-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="font-semibold text-gray-900">
                                      {courier.courier_name}
                                    </div>
                                    {courier.provider_code && (
                                      <Badge
                                        count={courier.provider_code}
                                        style={{
                                          backgroundColor: '#f0f0f0',
                                          color: '#666',
                                        }}
                                      />
                                    )}
                                    <Badge
                                      status="success"
                                      text="Best delivery option chosen for you"
                                    />
                                  </div>

                                  <div className="space-y-1 text-xs text-gray-600">
                                    {courier.estimated_delivery_days && (
                                      <div>
                                        <span className="font-medium text-slate-700">
                                          Est. Delivery:
                                        </span>{' '}
                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                          {courier.estimated_delivery_days} days
                                        </span>
                                        {courier.estimated_delivery_date && (
                                          <span className="ml-1 text-gray-500">
                                            (
                                            {new Date(
                                              courier.estimated_delivery_date,
                                            ).toLocaleDateString('en-IN', {
                                              day: 'numeric',
                                              month: 'short',
                                              year: 'numeric',
                                            })}
                                            )
                                          </span>
                                        )}
                                      </div>
                                    )}

                                  </div>
                                </div>

                                <div className="text-right ml-4">
                                  <div className="text-xl font-extrabold text-blue-600">
                                    ₹{totalCharges.toFixed(2)}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">Total shipping charges</div>
                                </div>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                We’ve picked a reliable option for you based on this shipment’s
                                pincode, weight and payment method. You can review the pricing and
                                estimated delivery above before confirming.
                              </div>
                            </div>
                          )
                        })()
                      ) : (
                        <Radio.Group
                          value={selected?.courier_id}
                          onChange={(e) => {
                            const courier = couriers.find((c) => c.courier_id === e.target.value)
                            setSelectedCourierByGroup((prev) => ({
                              ...prev,
                              [group.key]: courier || null,
                            }))
                          }}
                          className="w-full"
                        >
                          <Space direction="vertical" size="middle" className="w-full">
                            {couriers.map((courier) => {
                              const isCod = order?.paymentMethod === 'cod'
                              const totalCharges = getForwardTotalCharges(courier, isCod)

                              return (
                                <Radio
                                  key={courier.courier_id}
                                  value={courier.courier_id}
                                  className="w-full"
                                >
                                  <div className="flex items-start justify-between w-full ml-2 p-3 border rounded-lg hover:bg-blue-50 transition-colors">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <div className="font-semibold text-gray-900">
                                          {courier.courier_name}
                                        </div>
                                        {courier.provider_code && (
                                          <Badge
                                            count={courier.provider_code}
                                            style={{
                                              backgroundColor: '#f0f0f0',
                                              color: '#666',
                                            }}
                                          />
                                        )}
                                        {selected?.courier_id === courier.courier_id && (
                                          <Badge status="success" text="Selected" />
                                        )}
                                      </div>

                                      <div className="space-y-1 text-xs text-gray-600">
                                        {courier.estimated_delivery_days && (
                                          <div>
                                            <span className="font-medium text-slate-700">
                                              Est. Delivery:
                                            </span>{' '}
                                            <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                              {courier.estimated_delivery_days} days
                                            </span>
                                            {courier.estimated_delivery_date && (
                                              <span className="ml-1 text-gray-500">
                                                (
                                                {new Date(
                                                  courier.estimated_delivery_date,
                                                ).toLocaleDateString('en-IN', {
                                                  day: 'numeric',
                                                  month: 'short',
                                                  year: 'numeric',
                                                })}
                                                )
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-right ml-4">
                                      <div className="text-lg font-bold text-blue-600">
                                        ₹{totalCharges.toFixed(2)}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">Total shipping charges</div>
                                    </div>
                                  </div>
                                </Radio>
                              )
                            })}
                          </Space>
                        </Radio.Group>
                      )
                    ) : (
                      <Empty
                        description="Check courier serviceability & pricing for this shipment"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        className="py-4"
                      />
                    )}
                  </div>
                )
              })}
              <div className="text-xs text-gray-500 mt-2">
                This order will be split into {shipmentGroups.length} shipment
                {shipmentGroups.length > 1 ? 's' : ''} based on warehouse selection. Each shipment
                has its own courier, label and invoice.
              </div>
            </Space>
          ) : (
            <Empty
              description="Assign warehouses to items to view shipment groups"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              className="py-8"
            />
          )}
        </Card>
      </Space>
    </Modal>
  )
}

export default RequestPickupModal
