import type { CsvValue } from './csv'

type ExportOrder = Record<string, any>

export const ADMIN_ORDER_EXPORT_HEADERS = [
  'Order ID',
  'Seller Name',
  'AWB Number',
  'Customer Name',
  'Customer Phone',
  'Customer Email',
  'Status',
  'Order Type',
  'Amount',
  'Courier Partner',
  'Order Date',
  'Pickup Date',
  'Delivery Date / Last Status',
  'Charged Weight (kg)',
  'City',
  'State',
  'Pincode',
  'Address',
]

const getTrimmedString = (value: unknown) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const firstPresent = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = getTrimmedString(value)
    if (normalized) return value
  }
  return ''
}

const parseJsonObject = (value: unknown) => {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, any>
  if (typeof value !== 'string') return {}

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : {}
  } catch {
    return {}
  }
}

const formatDateValue = (value: unknown) => {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()

  const raw = getTrimmedString(value)
  if (!raw) return ''

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toISOString()
}

const formatNumber = (value: unknown, fallback?: unknown) => {
  const candidate = value ?? fallback
  if (candidate === null || candidate === undefined || candidate === '') return ''

  const numeric = Number(candidate)
  return Number.isFinite(numeric) ? numeric.toFixed(3) : getTrimmedString(candidate)
}

const normalizeStatus = (value: unknown) =>
  getTrimmedString(value).toLowerCase().replace(/[\s-]+/g, '_')

export const getAdminOrderSellerName = (order: ExportOrder) => {
  const companyInfo = parseJsonObject(order.userProfile?.companyInfo)

  return getTrimmedString(
    firstPresent(
      order.merchantName,
      companyInfo.businessName,
      companyInfo.brandName,
      companyInfo.companyName,
      companyInfo.displayName,
      companyInfo.contactPerson,
      order.merchantEmail,
      order.merchantPhone,
      order.user_id,
    ),
  )
}

export const getAdminOrderPickupDate = (order: ExportOrder) => {
  const pickupDetails = parseJsonObject(order.pickup_details)

  return formatDateValue(
    firstPresent(
      order.pickup_date,
      order.pickupDate,
      pickupDetails.pickup_date,
      pickupDetails.pickupDate,
      pickupDetails.requested_pickup_date,
      pickupDetails.requestedPickupDate,
      pickupDetails.final_pickup_date,
      pickupDetails.finalPickupDate,
      pickupDetails.expected_pickup_date,
      pickupDetails.expectedPickupDate,
    ),
  )
}

export const getAdminOrderDeliveryDateOrLastStatus = (order: ExportOrder) => {
  if (normalizeStatus(order.order_status) !== 'delivered') {
    return getTrimmedString(firstPresent(order.delivery_message, order.order_status))
  }

  return formatDateValue(
    firstPresent(
      order.delivered_at,
      order.deliveredAt,
      order.delivery_date,
      order.deliveryDate,
      order.delivered_time,
      order.deliveredTime,
      order.updated_at,
      order.updatedAt,
      order.created_at,
      order.createdAt,
    ),
  )
}

export const toAdminOrderExportRow = (order: ExportOrder): CsvValue[] => [
  firstPresent(order.order_id, order.order_number, order.id),
  getAdminOrderSellerName(order),
  order.awb_number,
  order.buyer_name,
  order.buyer_phone,
  order.buyer_email,
  order.order_status,
  order.order_type,
  order.order_amount,
  order.courier_partner,
  order.order_date,
  getAdminOrderPickupDate(order),
  getAdminOrderDeliveryDateOrLastStatus(order),
  formatNumber(order.charged_weight, order.weight),
  order.city,
  order.state,
  order.pincode,
  order.address,
]
