import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { rto_events } from '../schema/rto'
import { b2c_orders } from '../schema/b2cOrders'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { sendWebhookEvent } from '../../services/webhookDelivery.service'
import { buildCsv } from '../../utils/csv'
import { normalizePickupDetails } from './invoiceHelpers'

type UnifiedRtoRow = {
  id: string
  order_id: string
  user_id: string
  awb_number: string | null
  status: string
  reason: string | null
  remarks: string | null
  rto_charges: number | string | null
  created_at: Date | string | null
  updated_at: Date | string | null
  order_number: string | null
  courier_partner: string | null
  merchant_name: string | null
  pickup_details?: unknown
  product_summary: string | null
  source: 'event' | 'legacy'
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const parseProducts = (rawProducts: unknown): Array<{ name: string; qty: number }> => {
  let productsData: any[] = []

  if (Array.isArray(rawProducts)) {
    productsData = rawProducts
  } else if (typeof rawProducts === 'string' && rawProducts.trim()) {
    try {
      const parsed = JSON.parse(rawProducts)
      productsData = Array.isArray(parsed) ? parsed : []
    } catch {
      productsData = []
    }
  }

  return productsData
    .map((item: any) => {
      const name =
        normalizeText(item?.name ?? item?.productName ?? item?.box_name ?? item?.title ?? 'Product') ||
        'Product'
      const qty = Math.max(1, Number(item?.qty ?? item?.quantity ?? 1) || 1)
      return { name, qty }
    })
    .filter((item) => Boolean(item.name))
}

const summarizeProducts = (rawProducts: unknown) => {
  const products = parseProducts(rawProducts)
  if (!products.length) return null

  return products.map((item) => (item.qty > 1 ? `${item.name} x${item.qty}` : item.name)).join(', ')
}

const resolveMerchantName = (row: any) => {
  const pickupDetails = normalizePickupDetails(row.pickup_details)
  return (
    normalizeText(
      pickupDetails?.warehouse_name ||
        (pickupDetails as any)?.name ||
        row.merchant_name ||
        'Seller',
    ) || 'Seller'
  )
}

const rtoEventSelect = {
  id: rto_events.id,
  order_id: rto_events.order_id,
  user_id: rto_events.user_id,
  awb_number: rto_events.awb_number,
  status: rto_events.status,
  reason: rto_events.reason,
  remarks: rto_events.remarks,
  rto_charges: rto_events.rto_charges,
  created_at: rto_events.created_at,
  updated_at: rto_events.updated_at,
  order_number: b2c_orders.order_number,
  courier_partner: b2c_orders.courier_partner,
  pickup_details: b2c_orders.pickup_details,
  merchant_name: sql<string | null>`COALESCE(
    NULLIF((${b2c_orders.pickup_details} ->> 'warehouse_name'), ''),
    NULLIF((${b2c_orders.pickup_details} ->> 'name'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'brandName'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'businessName'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'contactPerson'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'companyName'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'displayName'), ''),
    NULLIF(${users.email}, ''),
    NULLIF(${users.phone}, ''),
    NULLIF(${b2c_orders.user_id}::text, '')
  )`,
  product_summary: b2c_orders.products,
  source: sql<string>`'event'`,
}

const legacyRtoSelect = {
  id: sql<string>`concat('legacy-', ${b2c_orders.id}::text)`,
  order_id: b2c_orders.id,
  user_id: b2c_orders.user_id,
  awb_number: b2c_orders.awb_number,
  status: b2c_orders.order_status,
  reason: b2c_orders.provider_last_status,
  remarks: b2c_orders.delivery_message,
  rto_charges: sql<number | null>`null`,
  created_at: sql<Date | null>`coalesce(${b2c_orders.updated_at}, ${b2c_orders.created_at})`,
  updated_at: sql<Date | null>`coalesce(${b2c_orders.updated_at}, ${b2c_orders.created_at})`,
  order_number: b2c_orders.order_number,
  courier_partner: b2c_orders.courier_partner,
  pickup_details: b2c_orders.pickup_details,
  merchant_name: sql<string | null>`COALESCE(
    NULLIF((${b2c_orders.pickup_details} ->> 'warehouse_name'), ''),
    NULLIF((${b2c_orders.pickup_details} ->> 'name'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'brandName'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'businessName'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'contactPerson'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'companyName'), ''),
    NULLIF((${userProfiles.companyInfo} ->> 'displayName'), ''),
    NULLIF(${users.email}, ''),
    NULLIF(${users.phone}, ''),
    NULLIF(${b2c_orders.user_id}::text, '')
  )`,
  product_summary: b2c_orders.products,
  delivery_location: b2c_orders.delivery_location,
  delivery_message: b2c_orders.delivery_message,
  provider_last_status: b2c_orders.provider_last_status,
  manifest_error: b2c_orders.manifest_error,
  source: sql<string>`'legacy'`,
}

const toStartOfDay = (value: string) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const toEndOfDay = (value: string) => {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

const getRowTimestamp = (row: Pick<UnifiedRtoRow, 'created_at' | 'updated_at'>) => {
  const value = row.created_at || row.updated_at
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

const buildSearchClause = (search: string, columns: any[]) => {
  if (!search) return undefined
  const term = `%${search}%`
  const clauses = columns.map((column) => sql`${column} ILIKE ${term}`)
  return clauses.length > 0 ? or(...clauses) : undefined
}

const buildDateClause = (column: any, fromDate?: string, toDate?: string) => {
  const clauses: any[] = []
  if (fromDate) clauses.push(sql`${column} >= ${toStartOfDay(fromDate)}`)
  if (toDate) clauses.push(sql`${column} <= ${toEndOfDay(toDate)}`)
  return clauses.length > 0 ? and(...clauses) : undefined
}

const normalizeEventRow = (row: any): UnifiedRtoRow => ({
  id: String(row.id),
  order_id: String(row.order_id),
  user_id: String(row.user_id),
  awb_number: row.awb_number ?? null,
  status: String(row.status || ''),
  reason: row.reason ?? null,
  remarks: row.remarks ?? null,
  rto_charges: row.rto_charges ?? null,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
  order_number: row.order_number ?? null,
  courier_partner: row.courier_partner ?? null,
  merchant_name: resolveMerchantName(row),
  product_summary: summarizeProducts(row.product_summary),
  source: 'event',
})

const normalizeLegacyRow = (row: any): UnifiedRtoRow => {
  const detailParts = [
    normalizeText(row.provider_last_status),
    normalizeText(row.delivery_message),
    normalizeText(row.manifest_error),
  ].filter(Boolean)
  const remarkParts = [normalizeText(row.delivery_location), normalizeText(row.delivery_message)].filter(
    Boolean,
  )

  return {
    id: String(row.id),
    order_id: String(row.order_id),
    user_id: String(row.user_id),
    awb_number: row.awb_number ?? null,
    status: String(row.status || 'rto'),
    reason: detailParts[0] || null,
    remarks: remarkParts.join(' | ') || null,
    rto_charges: null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    order_number: row.order_number ?? null,
    courier_partner: row.courier_partner ?? null,
    merchant_name: resolveMerchantName(row),
    product_summary: summarizeProducts(row.product_summary),
    source: 'legacy',
  }
}

async function loadUnifiedRtoRows(params: {
  userId?: string
  orderId?: string
  search?: string
  fromDate?: string
  toDate?: string
}) {
  const { userId, orderId, search = '', fromDate, toDate } = params
  const normalizedSearch = search.trim()

  const eventFilters = []
  if (userId) eventFilters.push(eq(rto_events.user_id, userId))
  if (orderId) eventFilters.push(eq(rto_events.order_id, orderId))
  const eventWhereBase = eventFilters.length > 0 ? and(...eventFilters) : sql`true`
  const eventSearchWhere = buildSearchClause(normalizedSearch, [
    rto_events.awb_number,
    sql`${rto_events.order_id}::text`,
    b2c_orders.order_number,
    rto_events.reason,
    rto_events.remarks,
    b2c_orders.courier_partner,
  ])
  const eventDateWhere = buildDateClause(rto_events.created_at, fromDate, toDate)
  const eventWhere =
    eventSearchWhere || eventDateWhere
      ? and(eventWhereBase, eventSearchWhere || sql`true`, eventDateWhere || sql`true`)
      : eventWhereBase

  const legacyFilters = [
    sql`${b2c_orders.order_status} IN ('rto', 'rto_in_transit', 'rto_delivered')`,
    sql`NOT EXISTS (
      SELECT 1
      FROM ${rto_events} legacy_rto_events
      WHERE legacy_rto_events.order_id = ${b2c_orders.id}
    )`,
  ]
  if (userId) legacyFilters.unshift(eq(b2c_orders.user_id, userId))
  if (orderId) legacyFilters.push(eq(b2c_orders.id, orderId))
  const legacyWhereBase = and(...legacyFilters)
  const legacySearchWhere = buildSearchClause(normalizedSearch, [
    b2c_orders.awb_number,
    b2c_orders.order_number,
    b2c_orders.provider_last_status,
    b2c_orders.delivery_message,
    b2c_orders.manifest_error,
    b2c_orders.courier_partner,
  ])
  const legacyDateWhere = buildDateClause(sql`coalesce(${b2c_orders.updated_at}, ${b2c_orders.created_at})`, fromDate, toDate)
  const legacyWhere =
    legacySearchWhere || legacyDateWhere
      ? and(legacyWhereBase, legacySearchWhere || sql`true`, legacyDateWhere || sql`true`)
      : legacyWhereBase

  const [eventRows, legacyRows] = await Promise.all([
    db
      .select(rtoEventSelect)
      .from(rto_events)
      .leftJoin(b2c_orders, eq(b2c_orders.id, rto_events.order_id))
      .leftJoin(users, eq(users.id, b2c_orders.user_id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eventWhere)
      .orderBy(desc(rto_events.created_at)),
    db
      .select(legacyRtoSelect)
      .from(b2c_orders)
      .leftJoin(users, eq(users.id, b2c_orders.user_id))
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(legacyWhere)
      .orderBy(desc(sql`coalesce(${b2c_orders.updated_at}, ${b2c_orders.created_at})`)),
  ])

  return [...eventRows.map(normalizeEventRow), ...legacyRows.map(normalizeLegacyRow)].sort(
    (a, b) => getRowTimestamp(b) - getRowTimestamp(a),
  )
}

export async function recordRtoEvent(params: {
  orderId: string
  userId: string
  awbNumber?: string | null
  status: string
  reason?: string | null
  remarks?: string | null
  rtoCharges?: number | null
  payload?: any
}) {
  const { orderId, userId, awbNumber, status, reason, remarks, rtoCharges, payload } = params

  const [inserted] = await db
    .insert(rto_events)
    .values({
      order_id: orderId,
      user_id: userId,
      awb_number: awbNumber || null,
      status,
      reason: reason || null,
      remarks: remarks || null,
      rto_charges: rtoCharges ?? null,
      payload: payload || null,
    })
    .returning()

  // Send webhook event for RTO
  sendWebhookEvent(userId, 'order.rto', {
    order_id: orderId,
    awb_number: awbNumber,
    status,
    reason,
    remarks,
    rto_charges: rtoCharges,
    created_at: inserted.created_at?.toISOString() || new Date().toISOString(),
  }).catch((err) => {
    console.error('Failed to send RTO webhook event:', err)
    // Don't fail the main flow if webhook fails
  })

  return inserted
}

export async function listRtoEvents(
  userId: string,
  orderId?: string,
  params?: { page?: number; limit?: number; search?: string; fromDate?: string; toDate?: string },
) {
  const { page = 1, limit = 20, search = '', fromDate, toDate } = params || {}
  const rows = await loadUnifiedRtoRows({ userId, orderId, search, fromDate, toDate })
  const offset = (page - 1) * limit

  return {
    rows: rows.slice(offset, offset + limit),
    totalCount: rows.length,
  }
}

export async function listRtoEventsAdmin(
  orderId?: string,
  params?: { page?: number; limit?: number; search?: string; fromDate?: string; toDate?: string },
) {
  const { page = 1, limit = 20, search = '', fromDate, toDate } = params || {}
  const rows = await loadUnifiedRtoRows({ orderId, search, fromDate, toDate })
  const offset = (page - 1) * limit

  return {
    rows: rows.slice(offset, offset + limit),
    totalCount: rows.length,
  }
}

export async function adminRtoKpis(params?: {
  search?: string
  fromDate?: string
  toDate?: string
}) {
  const { search = '', fromDate, toDate } = params || {}
  const rows = await loadUnifiedRtoRows({ search, fromDate, toDate })

  const byStatus = new Map<string, number>()
  const byCourier = new Map<string, number>()
  let totalCharges = 0

  for (const row of rows) {
    const status = normalizeText(row.status) || 'unknown'
    const courier = normalizeText(row.courier_partner) || 'Unknown'
    byStatus.set(status, (byStatus.get(status) || 0) + 1)
    byCourier.set(courier, (byCourier.get(courier) || 0) + 1)
    totalCharges += Number(row.rto_charges || 0)
  }

  return {
    total: rows.length,
    totalCharges,
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    byCourier: Array.from(byCourier.entries()).map(([courier, count]) => ({ courier, count })),
  }
}

export async function adminRtoExport(params?: {
  search?: string
  fromDate?: string
  toDate?: string
}) {
  const { search = '', fromDate, toDate } = params || {}
  const rows = await loadUnifiedRtoRows({ search, fromDate, toDate })

  const headers = [
    'Created At',
    'AWB',
    'Seller Detail',
    'Order ID',
    'Order Number',
    'Products',
    'Status',
    'Reason',
    'Remarks',
    'RTO Charges',
    'Courier',
    'Source',
  ]

  const rowsData = rows.map((r) => [
    r.created_at ? new Date(r.created_at).toISOString() : '',
    r.awb_number || '',
    r.merchant_name || '',
    r.order_id || '',
    r.order_number || '',
    r.product_summary || '',
    r.status || '',
    r.reason || '',
    r.remarks || '',
    r.rto_charges != null ? Number(r.rto_charges) : '',
    r.courier_partner || '',
    r.source,
  ])

  return buildCsv(headers, rowsData)
}
