import { and, eq, inArray, or } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import {
  getWalletTransactionOrderLookup,
  isUuidLike,
  normalizeLookupValue,
  WalletTransactionOrderLookup,
} from '../../utils/walletTransactionOrderLink'

type PlainRecord = Record<string, any>
const WALLET_TRANSACTION_GST_PERCENT = 18

interface WalletTransactionOrderRefs {
  awbNumbers: string[]
  orderIds: string[]
  orderNumbers: string[]
  shipmentIds: string[]
}

interface OrderMaps {
  byAwb: Map<string, PlainRecord>
  byId: Map<string, PlainRecord>
  byOrderId: Map<string, PlainRecord>
  byOrderNumber: Map<string, PlainRecord>
  byShipmentId: Map<string, PlainRecord>
}

interface EnrichmentOptions {
  masked?: boolean
}

interface BreakupOptions {
  masked?: boolean
}

interface BreakupLineOptions {
  adminOnly?: boolean
  includeZero?: boolean
  kind?: 'charge' | 'tax' | 'subtotal' | 'total'
  source?: string
}

const emptyRefs = (): WalletTransactionOrderRefs => ({
  awbNumbers: [],
  orderIds: [],
  orderNumbers: [],
  shipmentIds: [],
})

const addUniqueRef = (target: string[], value: unknown) => {
  const normalized = normalizeLookupValue(value)
  if (!normalized) return

  const exists = target.some((item) => item.toLowerCase() === normalized.toLowerCase())
  if (!exists) target.push(normalized)
}

const collectOrderRefs = (lookups: WalletTransactionOrderLookup[]) =>
  lookups.reduce((refs, lookup) => {
    lookup.awbNumbers.forEach((value) => addUniqueRef(refs.awbNumbers, value))
    lookup.orderIds.forEach((value) => addUniqueRef(refs.orderIds, value))
    lookup.orderNumbers.forEach((value) => addUniqueRef(refs.orderNumbers, value))
    lookup.shipmentIds.forEach((value) => addUniqueRef(refs.shipmentIds, value))
    return refs
  }, emptyRefs())

const mapKey = (value: unknown) => normalizeLookupValue(value)?.toLowerCase() || null

const addOrderMapValue = (map: Map<string, PlainRecord>, value: unknown, order: PlainRecord) => {
  const key = mapKey(value)
  if (key && !map.has(key)) map.set(key, order)
}

const addOrderToMaps = (maps: OrderMaps, order: PlainRecord, shipmentType: 'b2c' | 'b2b') => {
  const enrichedOrder: PlainRecord = {
    ...order,
    shipment_type: shipmentType,
    order_category: shipmentType,
  }

  addOrderMapValue(maps.byAwb, enrichedOrder.awb_number, enrichedOrder)
  addOrderMapValue(maps.byId, enrichedOrder.id, enrichedOrder)
  addOrderMapValue(maps.byOrderId, enrichedOrder.order_id, enrichedOrder)
  addOrderMapValue(maps.byOrderNumber, enrichedOrder.order_number, enrichedOrder)
  addOrderMapValue(maps.byShipmentId, enrichedOrder.shipment_id, enrichedOrder)
}

const findMappedOrder = (map: Map<string, PlainRecord>, values: string[]): PlainRecord | null => {
  for (const value of values) {
    const key = mapKey(value)
    if (!key) continue
    const order = map.get(key)
    if (order) return order
  }

  return null
}

const findOrderForLookup = (
  lookup: WalletTransactionOrderLookup,
  maps: OrderMaps,
): PlainRecord | null =>
  findMappedOrder(maps.byAwb, lookup.awbNumbers) ||
  findMappedOrder(maps.byId, lookup.orderIds) ||
  findMappedOrder(maps.byOrderId, lookup.orderIds) ||
  findMappedOrder(maps.byOrderNumber, lookup.orderNumbers) ||
  findMappedOrder(maps.byShipmentId, lookup.shipmentIds)

const buildOrderLookupConditions = (table: any, refs: WalletTransactionOrderRefs) => {
  const conditions: any[] = []
  const uuidOrderIds = refs.orderIds.filter(isUuidLike)

  if (refs.awbNumbers.length) conditions.push(inArray(table.awb_number, refs.awbNumbers))
  if (uuidOrderIds.length) conditions.push(inArray(table.id, uuidOrderIds))
  if (refs.orderIds.length) conditions.push(inArray(table.order_id, refs.orderIds))
  if (refs.orderNumbers.length) conditions.push(inArray(table.order_number, refs.orderNumbers))
  if (refs.shipmentIds.length) conditions.push(inArray(table.shipment_id, refs.shipmentIds))

  return conditions
}

const getLinkedOrders = async (table: any, userId: string, refs: WalletTransactionOrderRefs) => {
  const lookupConditions = buildOrderLookupConditions(table, refs)
  if (!lookupConditions.length) return []

  return db
    .select()
    .from(table)
    .where(and(eq(table.user_id, userId), or(...lookupConditions)))
}

const asRecord = (value: unknown): PlainRecord => {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value as PlainRecord

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as PlainRecord
      }
    } catch {
      return {}
    }
  }

  return {}
}

const readPath = (source: unknown, path: string[]) =>
  path.reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    return (current as PlainRecord)[key]
  }, source)

const readFirst = (sources: unknown[], paths: string[][]) => {
  for (const source of sources) {
    for (const path of paths) {
      const value = readPath(source, path)
      if (value !== undefined && value !== null && value !== '') return value
    }
  }

  return undefined
}

const toNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null
  const normalized = typeof value === 'string' ? value.replace(/,/g, '').trim() : value
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

const toText = (value: unknown): string | null => {
  const normalized = normalizeLookupValue(value)
  return normalized || null
}

const readNumber = (sources: unknown[], paths: string[][]) => toNumber(readFirst(sources, paths))

const readText = (sources: unknown[], paths: string[][]) => toText(readFirst(sources, paths))

const money = (value: number) => Number(value.toFixed(2))

type ShipmentWeightUnit = 'grams' | 'kilograms'

const formatCompactNumber = (value: number, maximumFractionDigits = 3) =>
  value.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })

const formatShipmentWeight = (value: unknown, sourceUnit: ShipmentWeightUnit) => {
  const weight = toNumber(value)
  if (weight === null) return null

  const grams = sourceUnit === 'kilograms' ? weight * 1000 : weight
  const displayGrams = Math.abs(grams) < 1000

  if (displayGrams) {
    return `${formatCompactNumber(Math.round(grams), 0)} gm`
  }

  return `${formatCompactNumber(grams / 1000, 3)} kg`
}

const resolveShipmentWeightUnit = (
  sources: unknown[],
  reason: string,
): ShipmentWeightUnit => {
  const shipmentType = String(
    readText(sources, [
      ['shipment_type'],
      ['shipmentType'],
      ['shipment_order_type'],
      ['shipmentOrderType'],
      ['order_category'],
      ['orderCategory'],
    ]) || '',
  ).toLowerCase()

  if (shipmentType === 'b2b') return 'kilograms'
  if (shipmentType === 'b2c') return 'grams'
  if (reason.includes('b2b')) return 'kilograms'

  return 'grams'
}

const CLIENT_ORDER_FIELDS = [
  'id',
  'order_id',
  'order_number',
  'order_date',
  'order_amount',
  'order_type',
  'order_status',
  'pickup_status',
  'courier_partner',
  'courier_id',
  'integration_type',
  'shipping_mode',
  'shipment_id',
  'awb_number',
  'freight_charges',
  'other_charges',
  'cod_charges',
  'gst_percent',
  'gst_amount',
  'wallet_debit_amount',
  'charged_weight',
  'volumetric_weight',
  'charged_slabs',
  'weight',
  'length',
  'breadth',
  'height',
  'shipping_charges',
  'transaction_fee',
  'gift_wrap',
  'discount',
  'charges_breakdown',
  'shipment_type',
  'order_category',
  'created_at',
  'updated_at',
]

const CLIENT_META_BLOCKLIST = [
  'courier_cost',
  'provider_quote_charge',
  'final_courier_charge',
  'platform_freight_charge',
  'internal_margin',
  'provider_meta',
  'provider_reference',
  'provider_request_id',
  'raw',
  'raw_request',
  'raw_response',
  'request',
  'response',
  'token',
  'secret',
]

const shouldMaskMetaKey = (key: string) => {
  const normalized = key.toLowerCase()
  return CLIENT_META_BLOCKLIST.some((blocked) => normalized.includes(blocked))
}

const sanitizeMetaForClient = (meta: unknown) => {
  const record = asRecord(meta)
  const sanitized: PlainRecord = {}

  Object.entries(record).forEach(([key, value]) => {
    if (shouldMaskMetaKey(key)) return
    sanitized[key] = value
  })

  return sanitized
}

const sanitizeOrderForClient = (order: PlainRecord | null) => {
  if (!order) return null

  const sanitized: PlainRecord = {}
  CLIENT_ORDER_FIELDS.forEach((field) => {
    if (order[field] !== undefined) sanitized[field] = order[field]
  })

  return sanitized
}

const getChargesBreakdown = (order: PlainRecord | null) => asRecord(order?.charges_breakdown)

export const buildWalletTransactionBreakup = (
  transaction: PlainRecord,
  order: PlainRecord | null,
  options: BreakupOptions = {},
) => {
  const masked = Boolean(options.masked)
  const meta = asRecord(transaction.meta)
  const sources = [meta, order || {}]
  const reason = String(transaction.reason || '').toLowerCase()
  const transactionAmount = toNumber(transaction.amount) ?? 0
  const currency = String(transaction.currency || 'INR')
  const paymentType = readText(sources, [['payment_type'], ['order_type']])
  const isCod = String(paymentType || '').toLowerCase() === 'cod' || reason.includes('cod')
  const lines: Array<{
    key: string
    label: string
    amount: number
    kind: 'charge' | 'tax' | 'subtotal' | 'total'
    adminOnly?: boolean
    source?: string
  }> = []
  const facts: Array<{ label: string; value: string }> = []

  const addFact = (label: string, value: unknown, suffix = '') => {
    const text = toText(value)
    if (!text) return
    facts.push({ label, value: `${text}${suffix}` })
  }

  const addWeightFact = (label: string, value: unknown, sourceUnit: ShipmentWeightUnit) => {
    const text = formatShipmentWeight(value, sourceUnit)
    if (!text) return
    facts.push({ label, value: text })
  }

  const addMoneyLine = (
    key: string,
    label: string,
    amount: number | null,
    lineOptions: BreakupLineOptions = {},
  ) => {
    if (lineOptions.adminOnly && masked) return
    if (amount === null || !Number.isFinite(amount)) return
    if (amount === 0 && !lineOptions.includeZero) return

    lines.push({
      key,
      label,
      amount: money(amount),
      kind: lineOptions.kind || 'charge',
      adminOnly: lineOptions.adminOnly,
      source: lineOptions.source,
    })
  }

  const freightCharges = readNumber(sources, [
    ['freight_charges'],
    ['freightCharges'],
    ['shipping_charge'],
    ['shippingCharge'],
  ])
  const otherCharges = readNumber(sources, [['other_charges'], ['otherCharges']])
  const codCharges = readNumber(sources, [['cod_charges'], ['codCharges']])
  const gstPercent = WALLET_TRANSACTION_GST_PERCENT
  let walletBaseDebit = readNumber(sources, [
    ['wallet_base_debit'],
    ['walletBaseDebit'],
    ['wallet_base_amount'],
  ])
  const totalWalletDebit = readNumber(sources, [
    ['total_wallet_debit'],
    ['wallet_debit_amount'],
    ['totalWalletDebit'],
    ['walletDebitAmount'],
  ])
  const chargesBreakdown = getChargesBreakdown(order)
  const overheads = Array.isArray(chargesBreakdown.overheads) ? chargesBreakdown.overheads : []
  const hasDetailedB2BBreakup =
    toNumber(chargesBreakdown.baseFreight) !== null || overheads.length > 0

  if (walletBaseDebit === null) {
    if (hasDetailedB2BBreakup) {
      walletBaseDebit = toNumber(chargesBreakdown.total)
    } else {
      const chargeParts = [
        freightCharges ?? 0,
        otherCharges ?? 0,
        isCod ? codCharges ?? 0 : 0,
      ]
      const computedBase = chargeParts.reduce((sum, value) => sum + value, 0)
      walletBaseDebit = computedBase > 0 ? money(computedBase) : null
    }
  }

  const gstAmount = walletBaseDebit !== null ? money((walletBaseDebit * gstPercent) / 100) : null

  if (hasDetailedB2BBreakup) {
    addMoneyLine('base_freight', 'Base freight', toNumber(chargesBreakdown.baseFreight), {
      source: 'charges_breakdown',
    })
    addMoneyLine('demurrage', 'Demurrage', toNumber(chargesBreakdown.demurrage), {
      source: 'charges_breakdown',
    })
    overheads.forEach((overhead: PlainRecord, index: number) => {
      const label = toText(overhead?.name) || toText(overhead?.code) || `Overhead ${index + 1}`
      addMoneyLine(`overhead_${overhead?.id || index}`, label, toNumber(overhead?.amount), {
        source: 'charges_breakdown',
      })
    })
  } else {
    addMoneyLine('freight_charges', 'Freight charge', freightCharges, { source: 'wallet_meta' })
  }

  addMoneyLine('other_charges', 'Other charge', otherCharges, { source: 'wallet_meta' })
  addMoneyLine('cod_charges', 'COD charge', codCharges, {
    includeZero: isCod,
    source: 'wallet_meta',
  })

  const chargeLineCount = lines.filter((line) => line.kind === 'charge' && !line.adminOnly).length
  if (chargeLineCount === 0) {
    if (reason.includes('rto freight')) {
      addMoneyLine('rto_freight', 'RTO freight charge', transactionAmount, { includeZero: true })
    } else if (reason.includes('weight discrepancy')) {
      addMoneyLine('weight_discrepancy', 'Weight discrepancy charge', transactionAmount, {
        includeZero: true,
      })
    } else if (reason.includes('reverse')) {
      addMoneyLine('reverse_shipment', 'Reverse shipment charge', transactionAmount, {
        includeZero: true,
      })
    } else {
      addMoneyLine('shipment_charge', 'Shipment charge', transactionAmount, { includeZero: true })
    }
  }

  addMoneyLine('taxable_subtotal', 'Taxable subtotal', walletBaseDebit, {
    kind: 'subtotal',
    includeZero: false,
  })
  addMoneyLine(
    'gst_amount',
    `GST (${gstPercent}%)`,
    gstAmount,
    {
      kind: 'tax',
      includeZero: walletBaseDebit !== null,
      source: 'wallet_meta',
    },
  )

  if (!masked) {
    addMoneyLine(
      'courier_cost',
      'Courier actual cost',
      readNumber(sources, [['courier_cost'], ['courierCost']]),
      { adminOnly: true, source: 'order' },
    )
    addMoneyLine(
      'provider_quote_charge',
      'Provider quoted charge',
      readNumber(sources, [['provider_quote_charge'], ['providerQuoteCharge']]),
      { adminOnly: true, source: 'wallet_meta' },
    )
    addMoneyLine(
      'final_courier_charge',
      'Final courier charge',
      readNumber(sources, [['final_courier_charge'], ['finalCourierCharge']]),
      { adminOnly: true, source: 'wallet_meta' },
    )
    addMoneyLine(
      'platform_freight_charge',
      'Platform freight charge',
      readNumber(sources, [['platform_freight_charge'], ['platformFreightCharge']]),
      { adminOnly: true, source: 'wallet_meta' },
    )
    addMoneyLine(
      'internal_margin',
      'Internal margin',
      readNumber(sources, [['internal_margin'], ['internalMargin']]),
      { adminOnly: true, source: 'wallet_meta' },
    )
  }

  const total = totalWalletDebit ?? transactionAmount
  addMoneyLine(
    'wallet_transaction_total',
    transaction.type === 'credit' ? 'Wallet credit total' : 'Wallet debit total',
    total,
    { kind: 'total', includeZero: true },
  )

  addFact('Order number', readFirst(sources, [['order_number'], ['orderNumber']]))
  addFact('Shipment ID', readFirst(sources, [['shipment_id'], ['shipmentId']]))
  addFact('Courier', readFirst(sources, [['courier_name'], ['courier_partner'], ['integration_type']]))
  addFact('Payment type', paymentType ? paymentType.toUpperCase() : null)
  const shipmentWeightUnit = resolveShipmentWeightUnit(sources, reason)
  addWeightFact(
    'Charged weight',
    readFirst(sources, [['charged_weight'], ['chargedWeight']]),
    shipmentWeightUnit,
  )
  addWeightFact(
    'Volumetric weight',
    readFirst(sources, [['volumetric_weight'], ['volumetricWeight']]),
    shipmentWeightUnit,
  )
  addFact('Charged slabs', readFirst(sources, [['charged_slabs'], ['chargedSlabs']]))
  addWeightFact(
    'Declared weight',
    readFirst(sources, [['declared_weight'], ['declaredWeight']]),
    shipmentWeightUnit,
  )
  addWeightFact(
    'Weight difference',
    readFirst(sources, [['weight_difference'], ['weightDifference']]),
    shipmentWeightUnit,
  )

  if (!masked) {
    addFact('Provider ref', readFirst(sources, [['provider_reference'], ['providerReference']]))
    addFact('Provider request', readFirst(sources, [['provider_request_id'], ['providerRequestId']]))
    addFact('Courier ID', readFirst(sources, [['courier_id'], ['courierId']]))
  }

  return {
    masked,
    currency,
    total: money(total),
    subtotal: walletBaseDebit !== null ? money(walletBaseDebit) : null,
    gstPercent,
    gstAmount: gstAmount !== null ? money(gstAmount) : null,
    lines,
    facts,
  }
}

export const enrichWalletTransactionsWithShipmentDetails = async (
  userId: string,
  transactions: PlainRecord[],
  options: EnrichmentOptions = {},
) => {
  const lookupsByTransactionId = new Map<string, WalletTransactionOrderLookup>()

  transactions.forEach((transaction) => {
    const lookup = getWalletTransactionOrderLookup(transaction)
    if (!lookup.isShipmentOrderTransaction) return
    lookupsByTransactionId.set(transaction.id, lookup)
  })

  const refs = collectOrderRefs(Array.from(lookupsByTransactionId.values()))
  const hasRefs = Boolean(
    refs.awbNumbers.length ||
      refs.orderIds.length ||
      refs.orderNumbers.length ||
      refs.shipmentIds.length,
  )

  if (!hasRefs) return transactions

  const [b2cOrders, b2bOrders] = await Promise.all([
    getLinkedOrders(b2c_orders, userId, refs),
    getLinkedOrders(b2b_orders, userId, refs),
  ])

  const orderMaps: OrderMaps = {
    byAwb: new Map(),
    byId: new Map(),
    byOrderId: new Map(),
    byOrderNumber: new Map(),
    byShipmentId: new Map(),
  }

  b2cOrders.forEach((order) => addOrderToMaps(orderMaps, order, 'b2c'))
  b2bOrders.forEach((order) => addOrderToMaps(orderMaps, order, 'b2b'))

  return transactions.map((transaction) => {
    const lookup = lookupsByTransactionId.get(transaction.id)
    if (!lookup) return transaction

    const order = findOrderForLookup(lookup, orderMaps)
    const awbNumber = order?.awb_number || lookup.awbNumbers[0] || null
    const transactionBreakup = buildWalletTransactionBreakup(transaction, order, {
      masked: options.masked,
    })

    return {
      ...transaction,
      meta: options.masked ? sanitizeMetaForClient(transaction.meta) : transaction.meta,
      awb_number: awbNumber,
      order: options.masked ? sanitizeOrderForClient(order) : order,
      shipment_order_type: order?.shipment_type || null,
      transaction_breakup: transactionBreakup,
    }
  })
}
