export interface WalletTransactionLike {
  type?: string | null
  reason?: string | null
  ref?: string | null
  meta?: unknown
}

export interface WalletTransactionOrderLookup {
  isShipmentOrderTransaction: boolean
  awbNumbers: string[]
  orderIds: string[]
  orderNumbers: string[]
  shipmentIds: string[]
}

const SHIPMENT_REASON_MARKERS = [
  'b2c prepaid order payment',
  'b2c cod service charges',
  'reverse_shipment',
  'reverse shipment',
  'rto freight',
  'manifest failed',
  'weight discrepancy charge',
  'shipment',
]

const AWB_PATHS = [
  ['awb'],
  ['awb_number'],
  ['awbNumber'],
  ['waybill'],
  ['waybill_number'],
  ['waybillNumber'],
  ['tracking_number'],
  ['trackingNumber'],
  ['shipment', 'awb'],
  ['shipment', 'awb_number'],
  ['shipment', 'awbNumber'],
]

const ORDER_ID_PATHS = [
  ['order_id'],
  ['orderId'],
  ['orderUuid'],
  ['order_uuid'],
  ['original_order_id'],
  ['originalOrderId'],
]

const ORDER_NUMBER_PATHS = [
  ['order_number'],
  ['orderNumber'],
  ['merchant_order_number'],
  ['merchantOrderNumber'],
  ['order', 'order_number'],
  ['order', 'orderNumber'],
]

const SHIPMENT_ID_PATHS = [
  ['shipment_id'],
  ['shipmentId'],
  ['shipment', 'id'],
  ['shipment', 'shipment_id'],
  ['shipment', 'shipmentId'],
]

const SHIPMENT_META_PATHS = [
  ['courier_name'],
  ['courier_partner'],
  ['integration_type'],
  ['final_courier_charge'],
  ['platform_freight_charge'],
  ['provider_quote_charge'],
  ['charged_weight'],
  ['charged_slabs'],
  ['boxes'],
]

export const normalizeLookupValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }

  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed || null
}

export const isUuidLike = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )

const uniqueValues = (values: Array<unknown>) => {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    const normalized = normalizeLookupValue(value)
    if (!normalized) return

    const key = normalized.toLowerCase()
    if (seen.has(key)) return

    seen.add(key)
    result.push(normalized)
  })

  return result
}

const normalizeMeta = (meta: unknown): Record<string, unknown> => {
  if (!meta) return {}

  if (typeof meta === 'object' && !Array.isArray(meta)) {
    return meta as Record<string, unknown>
  }

  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return {}
    }
  }

  return {}
}

const readPath = (source: Record<string, unknown>, path: string[]) =>
  path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    return (current as Record<string, unknown>)[key]
  }, source)

const collectPaths = (source: Record<string, unknown>, paths: string[][]) =>
  uniqueValues(paths.map((path) => readPath(source, path)))

const extractOrderNumbersFromReason = (reason?: string | null) => {
  if (!reason) return []

  const values: string[] = []
  const parentheticalMatches = reason.matchAll(/\(([^)]+)\)/g)
  for (const match of parentheticalMatches) {
    if (match[1]) values.push(match[1])
  }

  const orderMatches = reason.matchAll(/order\s+#?([A-Za-z0-9._-]+)/gi)
  for (const match of orderMatches) {
    if (match[1]) values.push(match[1])
  }

  return uniqueValues(values)
}

export const getWalletTransactionOrderLookup = (
  transaction: WalletTransactionLike,
): WalletTransactionOrderLookup => {
  const meta = normalizeMeta(transaction.meta)
  const reason = normalizeLookupValue(transaction.reason)
  const reasonLower = reason?.toLowerCase() || ''

  const awbNumbers = collectPaths(meta, AWB_PATHS)
  const shipmentIds = collectPaths(meta, SHIPMENT_ID_PATHS)
  const orderNumbers = uniqueValues([
    ...collectPaths(meta, ORDER_NUMBER_PATHS),
    ...extractOrderNumbersFromReason(reason),
  ])
  const orderIds = uniqueValues([
    ...collectPaths(meta, ORDER_ID_PATHS),
    transaction.ref,
  ])

  const hasLookup = Boolean(
    awbNumbers.length || shipmentIds.length || orderNumbers.length || orderIds.length,
  )
  const hasShipmentReason = SHIPMENT_REASON_MARKERS.some((marker) => reasonLower.includes(marker))
  const hasShipmentMeta = Boolean(
    awbNumbers.length || shipmentIds.length || collectPaths(meta, SHIPMENT_META_PATHS).length,
  )
  const isShipmentOrderTransaction = hasLookup && (hasShipmentReason || hasShipmentMeta)

  if (!isShipmentOrderTransaction) {
    return {
      isShipmentOrderTransaction: false,
      awbNumbers: [],
      orderIds: [],
      orderNumbers: [],
      shipmentIds: [],
    }
  }

  return {
    isShipmentOrderTransaction,
    awbNumbers,
    orderIds,
    orderNumbers,
    shipmentIds,
  }
}
