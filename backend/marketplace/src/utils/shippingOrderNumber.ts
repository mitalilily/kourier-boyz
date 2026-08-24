import crypto from 'crypto'

export const SHIPMOZO_ORDER_NUMBER_MAX_LENGTH = 30

const sanitizeSegment = (value: string | undefined | null, maxLength: number, fallback: string) => {
  const normalized = (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, maxLength)

  return normalized || fallback
}

const buildHashSegment = (parts: Array<string | undefined | null>, length: number) =>
  crypto
    .createHash('sha1')
    .update(parts.filter(Boolean).join('|') || 'SHIPMENT')
    .digest('hex')
    .slice(0, length)
    .toUpperCase()

const sanitizeOrderNumber = (value: string | undefined | null) =>
  (value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

export const normalizeShipmozoOrderNumber = (
  rawOrderNumber: string,
  maxLength: number = SHIPMOZO_ORDER_NUMBER_MAX_LENGTH,
) => {
  const sanitized = sanitizeOrderNumber(rawOrderNumber) || 'SHIPMENT'
  if (sanitized.length <= maxLength) {
    return sanitized
  }

  const hashLength = 6
  const baseLength = Math.max(1, maxLength - hashLength - 1)
  const base = sanitizeOrderNumber(sanitized.slice(0, baseLength)) || 'SHIP'
  const hash = buildHashSegment([sanitized], hashLength)

  return `${base}-${hash}`.slice(0, maxLength)
}

type ForwardShipmentOrderNumberInput = {
  orderNumber?: string
  orderId?: string
  shipmentId?: string
  itemIds?: Array<string | undefined | null>
}

export const buildForwardShipmentOrderNumber = ({
  orderNumber,
  orderId,
  shipmentId,
  itemIds = [],
}: ForwardShipmentOrderNumberInput) => {
  const hasGroupItems = itemIds.length > 0
  const base = sanitizeSegment(orderNumber || orderId, hasGroupItems ? 10 : 12, 'ORD')
  const shipmentHash = buildHashSegment([shipmentId, orderId, orderNumber], 6)

  if (!hasGroupItems) {
    return normalizeShipmozoOrderNumber(`F-${base}-${shipmentHash}`)
  }

  const groupHash = buildHashSegment(itemIds, 6)
  return normalizeShipmozoOrderNumber(`F-${base}-${shipmentHash}-${groupHash}`)
}

type ReturnShipmentOrderNumberInput = {
  orderNumber?: string
  orderId?: string
  returnId?: string
}

export const buildReturnShipmentOrderNumber = ({
  orderNumber,
  orderId,
  returnId,
}: ReturnShipmentOrderNumberInput) => {
  const base = sanitizeSegment(orderNumber || orderId, 12, 'RET')
  const returnHash = buildHashSegment([returnId, orderId, orderNumber], 6)

  return normalizeShipmozoOrderNumber(`RET-${base}-${returnHash}`)
}
