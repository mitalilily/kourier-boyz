import {
  shipmozoService,
  type ShipmozoRateCalculatorDimension,
  type ShipmozoReturnReason,
} from './shipmozo.service'
import { normalizeShipmozoOrderNumber } from '../utils/shippingOrderNumber'
import { kourierBoyzLogisticsService } from './kourierBoyzLogistics.service'

type LegacyLikeRateRequest = {
  order_id?: string
  destination: string
  origin?: string
  pickup_id?: string
  payment_type?: 'cod' | 'prepaid' | 'reverse'
  order_amount?: number
  weight?: number
  length?: number
  breadth?: number
  height?: number
  shipment_type?: 'b2b' | 'b2c'
  is_reverse?: boolean
}

export type ShippingRateRequest = LegacyLikeRateRequest
export type KourierBoyzLogisticsRateRequest = ShippingRateRequest

type LegacyLikeShipmentPayload = {
  order_number: string
  payment_type: 'cod' | 'prepaid'
  order_amount: number
  order_date?: string
  package_weight: number
  package_length: number
  package_breadth: number
  package_height: number
  courier_id?: number
  provider_code?: string
  consignee: {
    name: string
    company_name?: string
    address: string
    address_2?: string
    city: string
    state: string
    pincode: string
    phone: string
    email?: string
    gstin?: string
  }
  pickup: {
    warehouse_name?: string
    name: string
    address: string
    address_2?: string
    city: string
    state: string
    pincode: string
    phone: string
    gst_number?: string
    pickup_date?: string
    pickup_time?: string
  }
  order_items: Array<{
    name: string
    sku?: string
    qty: number
    price: number
    hsn?: string
    discount?: number
    tax_rate?: number
  }>
  invoice_number?: string
  invoice_date?: string
  invoice_amount?: number
  shipping_charges?: number
  gift_wrap?: number
  discount?: number
  cod_charges?: number
  is_insurance?: 0 | 1
  tags?: string
  request_auto_pickup?: 'yes' | 'no'
  company?: { name?: string; gst?: string }
  warehouse_id?: string
}

export type ShippingCreateShipmentRequest = LegacyLikeShipmentPayload
export type KourierBoyzLogisticsCreateShipmentRequest = ShippingCreateShipmentRequest

type LegacyLikeReturnPayload = {
  order_number: string
  original_order_id: string
  original_order_number?: string
  package_weight: number
  package_length: number
  package_breadth: number
  package_height: number
  courier_id?: number
  consignee: {
    name: string
    company_name?: string
    address: string
    address_2?: string
    city: string
    state: string
    pincode: string
    phone: string
    email?: string
    gstin?: string
  }
  pickup: {
    warehouse_name?: string
    name: string
    address: string
    address_2?: string
    city: string
    state: string
    pincode: string
    phone: string
    gst_number?: string
    pickup_date?: string
    pickup_time?: string
  }
  order_items: Array<{
    name: string
    sku?: string
    qty: number
    price: number
    hsn?: string
    discount?: number
    tax_rate?: number
  }>
  reason?: string
  customer_request?: string
  reason_comment?: string
  warehouse_id?: string
}

export type ShippingManifestRequest = {
  awbs?: string[]
  order_numbers?: string[]
  type: 'b2c' | 'b2b'
}
export type KourierBoyzLogisticsManifestRequest = ShippingManifestRequest

export type ShippingCourier = {
  courier_id?: number
  courier_name?: string
  provider_code?: string
  rate?: number
  estimated_delivery_days?: string
  estimated_delivery_date?: string
  serviceable?: boolean
  pickups_automatically_scheduled?: string
  cod_available?: boolean
  zone?: string
  local_rate_details?: {
    forward?: {
      rate?: string | number
      cod_charges?: string | number
      mode?: string
    }
    rto?: {
      rate?: string | number
    }
  }
  rate_details?: {
    forward?: {
      rate?: string | number
      cod_charges?: string | number
      mode?: string
    }
    rto?: {
      rate?: string | number
    }
  }
  [key: string]: unknown
}
export type KourierBoyzLogisticsCourier = ShippingCourier

type ShippingRatesResponse = {
  success: boolean
  message?: string
  error?: string
  data?: {
    rates: ShippingCourier[]
  }
}

type ShippingServiceabilityResponse = {
  success: boolean
  message?: string
  error?: string
  data?: {
    couriers: ShippingCourier[]
    courier?: ShippingCourier
    origin_pincode?: string
    destination_pincode?: string
    weight_grams?: number
  }
}

type ShippingShipmentResponse = {
  success: boolean
  message?: string
  error?: string
  data?: {
    order_id?: string
    order_number?: string
    awb_number?: string
    status?: string
    label?: string
    courier_partner?: string
    tracking_link?: string
    createManifest?: boolean
    warehouse_id?: string
  }
}

type ShippingLabelResponse = {
  success: boolean
  message?: string
  error?: string
  data?: {
    order_id?: string
    awb_number?: string
    label_url?: string
    created_at?: string
  }
}

type ShippingTrackingResponse = {
  success: boolean
  message?: string
  error?: string
  data?: {
    awb_number?: string
    order_number?: string
    status?: string
    current_location?: string
    estimated_delivery?: string
    tracking_events?: Array<{
      status_code?: string
      status?: string
      location?: string
      event_time?: string | null
      timestamp?: string | null
      message?: string
    }>
  }
}

type ShippingManifestResponse = {
  success: boolean
  message?: string
  error?: string
  data?: {
    manifest_id?: string
    manifest_url?: string
    manifest_key?: string
  }
}

type PickupAddressPayload = {
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country?: string
  contactName: string
  contactPhone: string
}

type PickupAddressOptions = {
  sellerEmail?: string
  gstNumber?: string
  isPrimary?: boolean
  isPickupEnabled?: boolean
  warehouseName?: string
  rtoAddress?: {
    contactName?: string
    contactPhone?: string
    contactEmail?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
}

const DEFAULT_PACKAGE_TYPE = 'SPS'
const DEFAULT_ROV_TYPE = 'ROV_OWNER'

const toShipmozoDimensions = (payload: {
  length?: number
  breadth?: number
  height?: number
}): ShipmozoRateCalculatorDimension[] => [
  {
    no_of_box: '1',
    length: String(payload.length || 10),
    width: String(payload.breadth || 10),
    height: String(payload.height || 10),
  },
]

const normalizeBoolean = (value: unknown, defaultValue = true) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['yes', 'true', '1'].includes(normalized)) return true
    if (['no', 'false', '0'].includes(normalized)) return false
  }
  return defaultValue
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

const pickFirstDefined = (...values: unknown[]) => values.find((value) => value !== undefined)

const resolveCourierId = (entry: Record<string, unknown>) =>
  toNumber(
    pickFirstDefined(
      entry.courier_id,
      entry.id,
      entry.courierId,
      entry.courier_company_id,
      entry.courier_companyId,
      entry.provider_id,
      entry.providerId,
      entry.carrier_id,
      entry.carrierId,
      entry.partner_id,
      entry.partnerId,
    ),
  )

const resolveCourierName = (entry: Record<string, unknown>) =>
  pickFirstDefined(
    entry.courier_name,
    entry.courier_company,
    entry.courier_company_name,
    entry.courier,
    entry.courier_partner,
    entry.provider_name,
    entry.partner_name,
    entry.name,
    entry.title,
    entry.service_name,
  )

const resolveProviderCode = (entry: Record<string, unknown>) => {
  const value = pickFirstDefined(
    entry.provider_code,
    entry.providerCode,
    entry.service_code,
    entry.serviceCode,
    entry.courier_company_service,
    entry.courier_service_code,
    entry.courier_service,
    entry.logistic_type,
    entry.mode,
  )

  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

const resolveRateValue = (entry: Record<string, unknown>, candidates: unknown[]) =>
  toNumber(pickFirstDefined(...candidates))

const buildRateBreakdown = (
  entry: Record<string, unknown>,
  existing: ShippingCourier['rate_details'] | ShippingCourier['local_rate_details'],
) => {
  const shippingCharges = resolveRateValue(entry, [entry.shipping_charges])
  const beforeTaxTotal = resolveRateValue(entry, [entry.before_tax_total_charges])
  const totalCharges = resolveRateValue(entry, [entry.total_charges])
  const gstCharges = resolveRateValue(entry, [entry.gst, entry.gst_amount, entry.tax_amount])
  const overheadCharges = resolveRateValue(entry, [entry.overhead_charges])
  const forwardRate = resolveRateValue(entry, [
    existing?.forward?.rate,
    entry.rate,
    entry.amount,
    entry.price,
    entry.total_amount,
    entry.shipping_amount,
    entry.forward_rate,
    beforeTaxTotal,
    shippingCharges,
    totalCharges,
    entry.base_rate,
    entry.freight_charge,
  ])
  const codCharges = resolveRateValue(entry, [
    existing?.forward?.cod_charges,
    entry.cod_charges,
    entry.cod_charge,
    entry.cod_amount,
  ])
  let otherCharges = resolveRateValue(entry, [
    (existing?.forward as any)?.other_charges,
    entry.other_charges,
    entry.other_charge,
    entry.fuel_charge,
    entry.oda_charges,
  ])
  if (otherCharges === undefined) {
    if (forwardRate !== undefined && totalCharges !== undefined && totalCharges >= forwardRate) {
      otherCharges = Number((totalCharges - forwardRate).toFixed(2))
    } else if (
      shippingCharges !== undefined &&
      beforeTaxTotal !== undefined &&
      beforeTaxTotal >= shippingCharges
    ) {
      otherCharges = Number(
        (beforeTaxTotal - shippingCharges + (gstCharges || 0)).toFixed(2),
      )
    } else if (gstCharges !== undefined || overheadCharges !== undefined) {
      otherCharges = Number(((gstCharges || 0) + (overheadCharges || 0)).toFixed(2))
    }
  }
  const rtoRate = resolveRateValue(entry, [
    existing?.rto?.rate,
    entry.rto_rate,
    entry.reverse_rate,
    entry.return_rate,
  ])

  if (
    forwardRate === undefined &&
    codCharges === undefined &&
    otherCharges === undefined &&
    rtoRate === undefined
  ) {
    return existing
  }

  return {
    forward: {
      ...(existing?.forward || {}),
      rate: existing?.forward?.rate ?? forwardRate,
      cod_charges: existing?.forward?.cod_charges ?? codCharges,
      ...(otherCharges !== undefined ? { other_charges: otherCharges } : {}),
      mode:
        existing?.forward?.mode ||
        (typeof entry.zone === 'string' ? entry.zone : undefined) ||
        (typeof entry.mode === 'string' ? entry.mode : undefined) ||
        (typeof entry.shipping_zone === 'string' ? entry.shipping_zone : undefined),
    },
    ...(existing?.rto || rtoRate !== undefined
      ? {
          rto: {
            ...(existing?.rto || {}),
            rate: existing?.rto?.rate ?? rtoRate,
          },
        }
      : {}),
  }
}

const normalizeRateEntries = (data: any): any[] => {
  const rawEntries = Array.isArray(data)
    ? data
    : Array.isArray(data?.rates)
    ? data.rates
    : Array.isArray(data?.couriers)
    ? data.couriers
    : Array.isArray(data?.data)
    ? data.data
    : data && typeof data === 'object'
    ? [data]
    : []

  return rawEntries
    .map((entry: any) => {
      const typedEntry = entry as Record<string, unknown>
      const courierId = resolveCourierId(typedEntry)
      const courierName = resolveCourierName(typedEntry)
      const rateDetails = buildRateBreakdown(
        typedEntry,
        (typedEntry.rate_details as ShippingCourier['rate_details'] | undefined) ||
          (typedEntry.local_rate_details as ShippingCourier['local_rate_details'] | undefined),
      )
      const rate =
        resolveRateValue(typedEntry, [
          rateDetails?.forward?.rate,
          typedEntry.rate,
          typedEntry.amount,
          typedEntry.price,
          typedEntry.total_amount,
          typedEntry.shipping_amount,
          typedEntry.forward_rate,
        ]) ?? 0
      const codCharges = resolveRateValue(typedEntry, [
        rateDetails?.forward?.cod_charges,
        typedEntry.cod_charges,
        typedEntry.cod_charge,
        typedEntry.cod_amount,
      ])

      return {
        ...entry,
        courier_id: courierId,
        courier_name:
          (typeof courierName === 'string' && courierName.trim() ? courierName.trim() : undefined) ||
          'Shipmozo Courier',
        provider_code: resolveProviderCode(typedEntry),
        rate,
        estimated_delivery_days:
          (typedEntry.estimated_delivery_days as string | undefined) ||
          (typedEntry.estimated_delivery as string | undefined) ||
          (typedEntry.delivery_days as string | undefined) ||
          (typedEntry.eta_days as string | undefined) ||
          (typedEntry.tat as string | undefined) ||
          undefined,
        estimated_delivery_date:
          (typedEntry.estimated_delivery_date as string | undefined) ||
          (typedEntry.expected_delivery_date as string | undefined) ||
          (typedEntry.delivery_date as string | undefined) ||
          (typedEntry.promise_date as string | undefined) ||
          undefined,
        serviceable: normalizeBoolean(typedEntry.serviceable, true),
        pickups_automatically_scheduled:
          (typedEntry.pickups_automatically_scheduled as string | undefined) ||
          (typedEntry.pickup_auto_scheduled as string | undefined) ||
          undefined,
        cod_available:
          normalizeBoolean(typedEntry.cod_available, codCharges !== undefined && codCharges >= 0) ||
          undefined,
        zone:
          (typedEntry.zone as string | undefined) ||
          (typedEntry.from_zone as string | undefined) ||
          (typedEntry.shipping_zone as string | undefined) ||
          rateDetails?.forward?.mode,
        rate_details: rateDetails,
        local_rate_details:
          (typedEntry.local_rate_details as ShippingCourier['local_rate_details'] | undefined) ||
          rateDetails,
      }
    })
    .filter((entry: any) => entry.courier_id !== undefined)
}

const normalizeTrackScanDetails = (scanDetail: unknown): Array<{
  status_code?: string
  status?: string
  location?: string
  event_time?: string | null
  timestamp?: string | null
  message?: string
}> => {
  if (!Array.isArray(scanDetail)) return []

  return scanDetail.map((entry: any) => ({
    status_code: entry?.status_code || entry?.scan_status || entry?.status,
    status: entry?.status || entry?.scan_status || entry?.status_code,
    location: entry?.location || entry?.current_location || entry?.city || '',
    event_time: entry?.event_time || entry?.status_time || entry?.created_at || null,
    timestamp: entry?.timestamp || entry?.status_time || entry?.created_at || null,
    message: entry?.message || entry?.remark || entry?.description || '',
  }))
}

const normalizeTrackingStatus = (status?: string | null) =>
  (status || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')

const mapReturnReasonId = (reason: string | undefined, reasons: ShipmozoReturnReason[]) => {
  if (!reason) return reasons[0]?.id

  const normalizedReason = reason.trim().toLowerCase()
  const exact = reasons.find((entry) => entry.title?.trim().toLowerCase() === normalizedReason)
  if (exact) return exact.id

  const partial = reasons.find((entry) => normalizedReason.includes(entry.title.toLowerCase()))
  if (partial) return partial.id

  const fallbackOther = reasons.find((entry) => entry.title?.trim().toLowerCase() === 'other')
  return fallbackOther?.id || reasons[0]?.id
}

const resolvePickupPincode = async (request: LegacyLikeRateRequest) => {
  if (request.origin) {
    const parsedOrigin = toNumber(request.origin)
    if (parsedOrigin) return parsedOrigin
  }

  if (request.pickup_id) {
    const warehouses = await shipmozoService.getWarehouses()
    const warehouse = (warehouses.data || []).find(
      (entry: any) => String(entry.id) === String(request.pickup_id),
    )
    const parsedPincode = toNumber(warehouse?.pincode)
    if (parsedPincode) return parsedPincode
  }

  throw new Error('Pickup warehouse or origin pincode is required')
}

const sanitizeWarehouseTitle = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 80)

const buildPickupWarehouseTitle = (
  address: PickupAddressPayload,
  options?: PickupAddressOptions,
  forceUnique = false,
) => {
  const prefix = sanitizeWarehouseTitle(options?.warehouseName || address.contactName || 'Warehouse')
  const suffix = forceUnique ? `${Date.now()}` : ''
  return `${prefix}${address.postalCode}${suffix}`.slice(0, 120)
}

const buildShipmentWarehouseTitle = (pickup: LegacyLikeShipmentPayload['pickup']) => {
  const prefix = sanitizeWarehouseTitle(pickup.warehouse_name || pickup.name || 'Warehouse')
  return `${prefix}${pickup.pincode}`.slice(0, 120)
}

const ensureWarehouseId = async (
  pickup: LegacyLikeShipmentPayload['pickup'],
  fallbackWarehouseId?: string,
) => {
  const warehouses = await shipmozoService.getWarehouses().catch(() => null)
  if (
    fallbackWarehouseId &&
    (warehouses?.data || []).some(
      (entry: any) => String(entry?.id) === String(fallbackWarehouseId),
    )
  ) {
    return fallbackWarehouseId
  }

  const normalizedLine1 = (pickup.address || '').trim().toLowerCase()
  const normalizedLine2 = (pickup.address_2 || '').trim().toLowerCase()
  const matchingWarehouse = (warehouses?.data || []).find((entry: any) => {
    return (
      String(entry?.pincode || '') === String(pickup.pincode || '') &&
      (entry?.address_line_one || '').trim().toLowerCase() === normalizedLine1 &&
      (entry?.address_line_two || '').trim().toLowerCase() === normalizedLine2
    )
  })

  if (matchingWarehouse?.id) {
    return String(matchingWarehouse.id)
  }

  const response = await shipmozoService.createWarehouse({
    address_title: buildShipmentWarehouseTitle(pickup),
    name: pickup.name,
    phone: toNumber(pickup.phone),
    email: undefined,
    address_line_one: pickup.address,
    address_line_two: pickup.address_2,
    pin_code: Number(pickup.pincode),
  })

  const warehouseId = response.data?.warehouse_id
  if (!warehouseId) {
    throw new Error('Shipmozo warehouse ID was not returned')
  }

  return String(warehouseId)
}

const formatOrderDate = (date?: string) => {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Date().toISOString().slice(0, 10)
}

const extractAwbFromOrderDetail = (data: any): string | undefined =>
  data?.awb_number ||
  data?.awb ||
  data?.data?.awb_number ||
  data?.shipment?.awb_number ||
  data?.shipment?.awb

const extractCourierNameFromOrderDetail = (data: any): string | undefined =>
  data?.courier ||
  data?.courier_company ||
  data?.courier_name ||
  data?.shipment?.courier ||
  data?.shipment?.courier_company

class ShippingProviderService {
  async createOrUpdatePickupAddress(
    address: PickupAddressPayload,
    options?: PickupAddressOptions,
    existingWarehouseId?: string,
  ) {
    if (kourierBoyzLogisticsService.isConfigured) {
      const toExternalAddress = (entry: PickupAddressPayload | PickupAddressOptions['rtoAddress']) =>
        entry
          ? {
              contact_name: entry.contactName,
              contact_phone: entry.contactPhone,
              contact_email: 'contactEmail' in entry ? entry.contactEmail : options?.sellerEmail,
              address_line_1: entry.addressLine1,
              address_line_2: entry.addressLine2,
              city: entry.city,
              state: entry.state,
              pincode: entry.postalCode,
              country: entry.country || 'India',
              gst_number: options?.gstNumber,
              warehouse_name: options?.warehouseName,
            }
          : undefined

      const payload = {
        pickup: toExternalAddress(address),
        rto_address: toExternalAddress(options?.rtoAddress),
        is_primary: options?.isPrimary,
        is_pickup_enabled: options?.isPickupEnabled,
      }

      return existingWarehouseId
        ? kourierBoyzLogisticsService.updatePickupAddress(existingWarehouseId, payload)
        : kourierBoyzLogisticsService.createPickupAddress(payload)
    }

    if (existingWarehouseId) {
      const warehouses = await shipmozoService.getWarehouses().catch(() => null)
      const existingWarehouse = (warehouses?.data || []).find(
        (entry) => String(entry.id) === String(existingWarehouseId),
      )

      if (
        existingWarehouse &&
        String(existingWarehouse.pincode || '') === String(address.postalCode || '') &&
        (existingWarehouse.address_line_one || '').trim() === (address.addressLine1 || '').trim() &&
        (existingWarehouse.address_line_two || '').trim() === (address.addressLine2 || '').trim()
      ) {
        return {
          success: true,
          data: {
            id: String(existingWarehouse.id),
          },
        }
      }
    }

    const response = await shipmozoService.createWarehouse({
      address_title: buildPickupWarehouseTitle(address, options, Boolean(existingWarehouseId)),
      name: address.contactName,
      phone: toNumber(address.contactPhone),
      alternate_phone: options?.rtoAddress?.contactPhone
        ? toNumber(options.rtoAddress.contactPhone)
        : undefined,
      email: options?.sellerEmail,
      address_line_one: address.addressLine1,
      address_line_two: address.addressLine2,
      pin_code: Number(address.postalCode),
    })

    const warehouseId = response.data?.warehouse_id
    if (!warehouseId) {
      throw new Error('Shipmozo warehouse ID was not returned')
    }

    return {
      success: true,
      data: {
        id: String(warehouseId),
      },
    }
  }

  async getRates(request: LegacyLikeRateRequest): Promise<ShippingRatesResponse> {
    if (kourierBoyzLogisticsService.isConfigured) {
      return kourierBoyzLogisticsService.getRates(request)
    }

    const pickupPincode = await resolvePickupPincode(request)
    const response = await shipmozoService.rateCalculator({
      order_id: request.order_id,
      pickup_pincode: pickupPincode,
      delivery_pincode: Number(request.destination),
      payment_type: request.payment_type === 'cod' ? 'COD' : 'PREPAID',
      shipment_type: request.is_reverse ? 'RETURN' : 'FORWARD',
      order_amount: Number(request.order_amount || 0),
      type_of_package: DEFAULT_PACKAGE_TYPE,
      rov_type: DEFAULT_ROV_TYPE,
      cod_amount: request.payment_type === 'cod' ? String(request.order_amount || '') : '',
      weight: Number(request.weight || 500),
      dimensions: toShipmozoDimensions({
        length: request.length,
        breadth: request.breadth,
        height: request.height,
      }),
    })

    return {
      success: true,
      data: {
        rates: normalizeRateEntries(response.data),
      },
    }
  }

  async checkServiceability(request: LegacyLikeRateRequest): Promise<ShippingServiceabilityResponse> {
    const rates = await this.getRates(request)
    return {
      success: true,
      data: {
        couriers: rates.data?.rates || [],
        origin_pincode: request.origin,
        destination_pincode: request.destination,
        weight_grams: request.weight ? Number(request.weight) : undefined,
      },
    }
  }

  async createShipment(
    payload: LegacyLikeShipmentPayload & { warehouse_id?: string },
  ): Promise<ShippingShipmentResponse> {
    if (kourierBoyzLogisticsService.isConfigured) {
      return kourierBoyzLogisticsService.createOrder(payload)
    }

    const warehouseId = await ensureWarehouseId(payload.pickup, payload.warehouse_id)
    const merchantOrderNumber = normalizeShipmozoOrderNumber(payload.order_number)

    const pushedOrder = await shipmozoService.pushOrder({
      order_id: merchantOrderNumber,
      order_date: formatOrderDate(payload.invoice_date || payload.order_date),
      order_type: payload.tags,
      consignee_name: payload.consignee.name,
      consignee_phone: Number(payload.consignee.phone),
      consignee_email: payload.consignee.email,
      consignee_address_line_one: payload.consignee.address,
      consignee_address_line_two: payload.consignee.address_2,
      consignee_pin_code: Number(payload.consignee.pincode),
      consignee_city: payload.consignee.city,
      consignee_state: payload.consignee.state,
      product_detail: payload.order_items.map((item) => ({
        name: item.name,
        sku_number: item.sku,
        quantity: item.qty,
        discount: item.discount || '',
        hsn: item.hsn,
        unit_price: item.price,
        product_category: 'Other',
      })),
      payment_type: payload.payment_type === 'cod' ? 'COD' : 'PREPAID',
      cod_amount: payload.payment_type === 'cod' ? String(payload.order_amount || '') : '',
      weight: Number(payload.package_weight),
      length: Number(payload.package_length),
      width: Number(payload.package_breadth),
      height: Number(payload.package_height),
      warehouse_id: warehouseId,
      gstin_number: payload.company?.gst,
    })
    const providerOrderId =
      pushedOrder.data?.order_id || pushedOrder.data?.reference_id || merchantOrderNumber
    const providerReferenceId = pushedOrder.data?.reference_id || merchantOrderNumber

    let awbNumber: string | undefined
    let courierPartner: string | undefined

    if (payload.courier_id) {
      await shipmozoService.assignCourier({
        order_id: providerOrderId,
        courier_id: payload.courier_id,
      })
      const scheduled = await shipmozoService.schedulePickup({ order_id: providerOrderId })
      awbNumber = scheduled.data?.awb_number
      courierPartner = scheduled.data?.courier
    } else {
      const autoAssigned = await shipmozoService.autoAssignOrder({ order_id: providerOrderId })
      awbNumber = autoAssigned.data?.awb_number
      courierPartner = autoAssigned.data?.courier_company

      if (!awbNumber) {
        const scheduled = await shipmozoService.schedulePickup({ order_id: providerOrderId })
        awbNumber = scheduled.data?.awb_number
        courierPartner = courierPartner || scheduled.data?.courier
      }
    }

    const orderDetail =
      (await shipmozoService.getOrderDetail(providerOrderId).catch(() => null)) ||
      (providerReferenceId !== providerOrderId
        ? await shipmozoService.getOrderDetail(providerReferenceId).catch(() => null)
        : null)
    awbNumber = awbNumber || extractAwbFromOrderDetail(orderDetail?.data)
    courierPartner = courierPartner || extractCourierNameFromOrderDetail(orderDetail?.data)

    let label: string | undefined
    if (awbNumber) {
      const labelResponse = await shipmozoService.getOrderLabel(awbNumber).catch(() => null)
      label = labelResponse?.data?.[0]?.label
    }

    return {
      success: true,
      data: {
        order_id: providerOrderId,
        order_number: providerReferenceId,
        awb_number: awbNumber,
        status: 'booked',
        label,
        courier_partner: courierPartner,
        tracking_link: undefined,
        createManifest: false,
        warehouse_id: warehouseId,
      },
    }
  }

  async getLabel(identifier: string): Promise<ShippingLabelResponse> {
    if (kourierBoyzLogisticsService.isConfigured) {
      return kourierBoyzLogisticsService.getLabel(identifier)
    }

    let awbNumber = identifier
    if (!/^[A-Za-z0-9-]+$/.test(identifier)) {
      awbNumber = identifier
    }

    const directLabel = await shipmozoService.getOrderLabel(awbNumber).catch(() => null)
    if (directLabel?.data?.[0]?.label) {
      return {
        success: true,
        data: {
          order_id: identifier,
          awb_number: awbNumber,
          label_url: directLabel.data[0].label,
          created_at: directLabel.data[0].created_at,
        },
      }
    }

    const orderDetail = await shipmozoService.getOrderDetail(identifier)
    awbNumber = extractAwbFromOrderDetail(orderDetail.data) || awbNumber
    const labelResponse = await shipmozoService.getOrderLabel(awbNumber)

    return {
      success: true,
      data: {
        order_id: identifier,
        awb_number: awbNumber,
        label_url: labelResponse.data?.[0]?.label,
        created_at: labelResponse.data?.[0]?.created_at,
      },
    }
  }

  async trackShipment(params: { awb: string }): Promise<ShippingTrackingResponse> {
    if (kourierBoyzLogisticsService.isConfigured) {
      return kourierBoyzLogisticsService.track(params.awb)
    }

    const tracking = await shipmozoService.trackOrder(params.awb)
    return {
      success: true,
      data: {
        awb_number: tracking.data?.awb_number || params.awb,
        order_number: tracking.data?.reference_id || tracking.data?.order_id || undefined,
        status: normalizeTrackingStatus(tracking.data?.current_status),
        current_location:
          tracking.data?.scan_detail && Array.isArray(tracking.data.scan_detail)
            ? (tracking.data.scan_detail[0] as any)?.location || undefined
            : undefined,
        estimated_delivery: tracking.data?.expected_delivery_date || undefined,
        tracking_events: normalizeTrackScanDetails(tracking.data?.scan_detail),
      },
    }
  }

  async trackReturnShipment(params: { awb: string }): Promise<ShippingTrackingResponse> {
    return this.trackShipment(params)
  }

  async generateManifest(request: {
    awbs?: string[]
    order_numbers?: string[]
    type: 'b2c' | 'b2b'
  }): Promise<ShippingManifestResponse> {
    if (kourierBoyzLogisticsService.isConfigured) {
      return kourierBoyzLogisticsService.generateManifest(request)
    }

    return {
      success: false,
      message: 'Manifest generation is not required for Shipmozo flow',
      data: undefined,
    }
  }

  async createReturnOrder(payload: LegacyLikeReturnPayload): Promise<ShippingShipmentResponse> {
    if (kourierBoyzLogisticsService.isConfigured) {
      return kourierBoyzLogisticsService.createReturn(payload)
    }

    const warehouseId =
      payload.warehouse_id || (await ensureWarehouseId(payload.consignee as any, undefined))
    const returnReasons = await shipmozoService.getReturnReasons()
    const returnReasonId = mapReturnReasonId(payload.reason, returnReasons.data || [])
    if (!returnReasonId) {
      throw new Error('No Shipmozo return reason could be resolved')
    }

    const merchantOrderNumber = normalizeShipmozoOrderNumber(payload.order_number)

    const pushedReturnOrder = await shipmozoService.pushReturnOrder({
      order_id: merchantOrderNumber,
      order_date: formatOrderDate(),
      pickup_name: payload.pickup.name,
      pickup_phone: Number(payload.pickup.phone),
      pickup_email: undefined,
      pickup_address_line_one: payload.pickup.address,
      pickup_address_line_two: payload.pickup.address_2,
      pickup_pin_code: Number(payload.pickup.pincode),
      pickup_city: payload.pickup.city,
      pickup_state: payload.pickup.state,
      product_detail: payload.order_items.map((item) => ({
        name: item.name,
        sku_number: item.sku,
        quantity: item.qty,
        discount: item.discount || '',
        hsn: item.hsn,
        unit_price: item.price,
        product_category: 'Other',
      })),
      payment_type: 'PREPAID',
      weight: Number(payload.package_weight),
      length: Number(payload.package_length),
      width: Number(payload.package_breadth),
      height: Number(payload.package_height),
      warehouse_id: warehouseId,
      return_reason_id: returnReasonId,
      customer_request: payload.customer_request || 'REFUND',
      reason_comment: payload.reason_comment,
    })
    const providerOrderId =
      pushedReturnOrder.data?.order_id || pushedReturnOrder.data?.reference_id || merchantOrderNumber
    const providerReferenceId = pushedReturnOrder.data?.reference_id || merchantOrderNumber

    let awbNumber: string | undefined
    let courierPartner: string | undefined

    if (payload.courier_id) {
      await shipmozoService.assignCourier({
        order_id: providerOrderId,
        courier_id: payload.courier_id,
      })
    }

    const scheduled = await shipmozoService.schedulePickup({ order_id: providerOrderId }).catch(
      () => null,
    )
    awbNumber = scheduled?.data?.awb_number
    courierPartner = scheduled?.data?.courier

    const orderDetail =
      (await shipmozoService.getOrderDetail(providerOrderId).catch(() => null)) ||
      (providerReferenceId !== providerOrderId
        ? await shipmozoService.getOrderDetail(providerReferenceId).catch(() => null)
        : null)
    awbNumber = awbNumber || extractAwbFromOrderDetail(orderDetail?.data)
    courierPartner = courierPartner || extractCourierNameFromOrderDetail(orderDetail?.data)

    return {
      success: true,
      data: {
        order_id: providerOrderId,
        order_number: providerReferenceId,
        awb_number: awbNumber,
        status: 'booked',
        courier_partner: courierPartner,
      },
    }
  }
}

export const shippingProviderService = new ShippingProviderService()
export default ShippingProviderService
