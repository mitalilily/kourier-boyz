import { and, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'
import { userProfiles } from '../schema/userProfile'
import { ndr_events } from '../schema/ndr'
import { tracking_events } from '../schema/trackingEvents'
import { sendWebhookEvent } from '../../services/webhookDelivery.service'

const currentSectionExpr = sql<string>`CASE
  WHEN lower(coalesce(${ndr_events.status}, '')) = 'ndr_action' THEN 'Shipment'
  WHEN lower(coalesce(${b2c_orders.order_status}, '')) IN ('cancelled', 'cancellation_requested') THEN 'Cancelled'
  WHEN lower(coalesce(${b2c_orders.order_status}, '')) LIKE 'rto%' THEN 'RTO'
  WHEN lower(coalesce(${b2c_orders.order_status}, '')) = 'delivered' THEN 'Delivered'
  WHEN lower(coalesce(${b2c_orders.order_status}, '')) IN ('shipment_created', 'pickup_initiated', 'booked', 'pending', 'in_transit', 'out_for_delivery') THEN 'Shipment'
  WHEN lower(coalesce(${ndr_events.status}, '')) IN ('ndr', 'undelivered', 'lost', 'address_issue', 'nsl') THEN 'NDR'
  ELSE 'Other'
END`

const hiddenOrderStatusesSql =
  `'shipment_created', 'pickup_initiated', 'booked', 'pending', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'rto', 'rto_in_transit', 'rto_delivered'`

const buildLatestVisibilityClause = () => sql`
  AND coalesce(latest.status, '') <> 'ndr_action'
  AND lower(coalesce(latest.order_status, '')) NOT IN (${sql.raw(hiddenOrderStatusesSql)})
`

const buildLatestSearchClause = (search: string) => {
  if (!search) return sql``
  const term = `%${search}%`
  return sql`
    AND (
      coalesce(latest.awb_number, '') ILIKE ${term}
      OR (latest.order_id::text) ILIKE ${term}
      OR coalesce(latest.order_number, '') ILIKE ${term}
      OR coalesce(latest.buyer_name, '') ILIKE ${term}
      OR coalesce(latest.buyer_phone, '') ILIKE ${term}
      OR coalesce(latest.reason, '') ILIKE ${term}
      OR coalesce(latest.remarks, '') ILIKE ${term}
    )
  `
}

const buildLatestDateClause = (fromDate?: string, toDate?: string) => {
  const clauses: ReturnType<typeof sql>[] = []
  if (fromDate) {
    const date = new Date(fromDate)
    if (!Number.isNaN(date.getTime())) {
      clauses.push(sql`AND latest.created_at >= ${date}`)
    }
  }
  if (toDate) {
    const date = new Date(toDate)
    if (!Number.isNaN(date.getTime())) {
      clauses.push(sql`AND latest.created_at <= ${date}`)
    }
  }
  return clauses.length ? sql.join(clauses, sql``) : sql``
}

const buildLatestStatusClause = (status?: string) =>
  status ? sql`AND latest.status ILIKE ${`%${status}%`}` : sql``

const buildLatestCourierClause = (courier?: string) =>
  courier ? sql`AND latest.courier_partner ILIKE ${`%${courier}%`}` : sql``

const buildLatestIntegrationClause = (integration_type?: string) =>
  integration_type ? sql`AND latest.integration_type ILIKE ${`%${integration_type}%`}` : sql``

const buildLatestAttemptClause = (attempt_count?: number) =>
  attempt_count ? sql`AND latest.attempt_no = ${String(attempt_count)}` : sql``

export async function recordNdrEvent(params: {
  orderId: string
  userId: string
  awbNumber?: string | null
  status: string
  reason?: string | null
  remarks?: string | null
  attemptNo?: string | null
  payload?: any
}) {
  const { orderId, userId, awbNumber, status, reason, remarks, attemptNo, payload } = params

  const [inserted] = await db
    .insert(ndr_events)
    .values({
      order_id: orderId,
      user_id: userId,
      awb_number: awbNumber || null,
      status,
      reason: reason || null,
      remarks: remarks || null,
      attempt_no: attemptNo || null,
      payload: payload || null,
    })
    .returning()

  sendWebhookEvent(userId, 'order.ndr', {
    order_id: orderId,
    awb_number: awbNumber,
    status,
    reason,
    remarks,
    attempt_no: attemptNo,
    created_at: inserted.created_at?.toISOString() || new Date().toISOString(),
  }).catch((err) => {
    console.error('Failed to send NDR webhook event:', err)
  })

  return inserted
}

export async function listNdrEvents(
  userId: string,
  orderId?: string,
  params?: { page?: number; limit?: number; search?: string; fromDate?: string; toDate?: string },
) {
  const { page = 1, limit = 20, search = '', fromDate, toDate } = params || {}
  const whereBase = orderId
    ? and(eq(ndr_events.user_id, userId), eq(ndr_events.order_id, orderId))
    : eq(ndr_events.user_id, userId)

  const offset = (page - 1) * limit
  const baseCte = sql`
    WITH latest AS (
      SELECT DISTINCT ON (${ndr_events.order_id})
        ${ndr_events.id} AS id,
        ${ndr_events.awb_number} AS awb_number,
        ${ndr_events.order_id} AS order_id,
        ${ndr_events.user_id} AS user_id,
        ${ndr_events.status} AS status,
        ${ndr_events.reason} AS reason,
        ${ndr_events.remarks} AS remarks,
        ${ndr_events.attempt_no} AS attempt_no,
        ${ndr_events.created_at} AS created_at,
        ${ndr_events.updated_at} AS last_event_time,
        ${b2c_orders.order_number} AS order_number,
        ${b2c_orders.buyer_name} AS buyer_name,
        ${b2c_orders.buyer_phone} AS buyer_phone,
        ${b2c_orders.courier_partner} AS courier_partner,
        ${b2c_orders.order_status} AS order_status,
        ${currentSectionExpr} AS current_section,
        ${b2c_orders.integration_type} AS integration_type
      FROM ${ndr_events}
      LEFT JOIN ${b2c_orders} ON ${ndr_events.order_id} = ${b2c_orders.id}
      WHERE ${whereBase}
      ORDER BY ${ndr_events.order_id}, ${ndr_events.created_at} DESC, ${ndr_events.id} DESC
    )
  `

  const countResult = (await db.execute(sql`
    ${baseCte}
    SELECT COUNT(*)::int AS total
    FROM latest
    WHERE 1 = 1
    ${buildLatestSearchClause(search)}
    ${buildLatestDateClause(fromDate, toDate)}
    ${buildLatestVisibilityClause()}
  `)) as any

  const totalCount = Number(countResult.rows?.[0]?.total || 0)
  if (totalCount === 0) {
    return { rows: [], totalCount: 0 }
  }

  const rowsResult = (await db.execute(sql`
    ${baseCte}
    SELECT
      id,
      awb_number,
      order_id,
      status,
      reason,
      remarks,
      attempt_no,
      created_at,
      last_event_time,
      order_number,
      buyer_name,
      buyer_phone,
      courier_partner,
      order_status,
      current_section,
      integration_type
    FROM latest
    WHERE 1 = 1
    ${buildLatestSearchClause(search)}
    ${buildLatestDateClause(fromDate, toDate)}
    ${buildLatestVisibilityClause()}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)) as any

  return { rows: rowsResult.rows || [], totalCount }
}

export async function listNdrEventsAdmin(
  orderId?: string,
  params?: {
    page?: number
    limit?: number
    search?: string
    fromDate?: string
    toDate?: string
    courier?: string
    integration_type?: string
    attempt_count?: number
    status?: string
  },
) {
  const {
    page = 1,
    limit = 20,
    search = '',
    fromDate,
    toDate,
    courier,
    integration_type,
    attempt_count,
    status,
  } = params || {}

  const base = orderId ? eq(ndr_events.order_id, orderId) : sql`true`
  const offset = (page - 1) * limit

  const baseCte = sql`
    WITH latest AS (
      SELECT DISTINCT ON (${ndr_events.order_id})
        ${ndr_events.id} AS id,
        ${ndr_events.awb_number} AS awb_number,
        ${ndr_events.order_id} AS order_id,
        ${ndr_events.user_id} AS user_id,
        ${ndr_events.status} AS status,
        ${ndr_events.reason} AS reason,
        ${ndr_events.remarks} AS remarks,
        ${ndr_events.attempt_no} AS attempt_no,
        ${ndr_events.created_at} AS created_at,
        ${b2c_orders.order_number} AS order_number,
        ${b2c_orders.buyer_name} AS buyer_name,
        ${b2c_orders.buyer_phone} AS buyer_phone,
        ${b2c_orders.courier_partner} AS courier_partner,
        ${b2c_orders.order_status} AS order_status,
        ${currentSectionExpr} AS current_section,
        ${b2c_orders.integration_type} AS integration_type,
        ${b2c_orders.user_id} AS merchant_id,
        ${userProfiles.companyInfo} ->> 'companyName' AS merchant_name,
        ${ndr_events.updated_at} AS last_event_time,
        CASE
          WHEN ${ndr_events.payload} ->> 'source' = 'admin_manual' THEN 'admin'
          ELSE 'webhook'
        END AS source
      FROM ${ndr_events}
      LEFT JOIN ${b2c_orders} ON ${ndr_events.order_id} = ${b2c_orders.id}
      LEFT JOIN ${userProfiles} ON ${userProfiles.userId} = ${b2c_orders.user_id}
      WHERE ${base}
      ORDER BY ${ndr_events.order_id}, ${ndr_events.created_at} DESC, ${ndr_events.id} DESC
    )
  `

  const countResult = (await db.execute(sql`
    ${baseCte}
    SELECT COUNT(*)::int AS total
    FROM latest
    WHERE 1 = 1
    ${buildLatestSearchClause(search)}
    ${buildLatestDateClause(fromDate, toDate)}
    ${buildLatestStatusClause(status)}
    ${buildLatestCourierClause(courier)}
    ${buildLatestIntegrationClause(integration_type)}
    ${buildLatestAttemptClause(attempt_count)}
    ${buildLatestVisibilityClause()}
  `)) as any

  const totalCount = Number(countResult.rows?.[0]?.total || 0)
  if (totalCount === 0) {
    return { rows: [], totalCount: 0 }
  }

  const rowsResult = (await db.execute(sql`
    ${baseCte}
    SELECT
      id,
      awb_number,
      order_id,
      status,
      reason,
      remarks,
      attempt_no,
      created_at,
      order_number,
      buyer_name,
      buyer_phone,
      courier_partner,
      order_status,
      current_section,
      integration_type,
      merchant_id,
      merchant_name,
      last_event_time,
      source
    FROM latest
    WHERE 1 = 1
    ${buildLatestSearchClause(search)}
    ${buildLatestDateClause(fromDate, toDate)}
    ${buildLatestStatusClause(status)}
    ${buildLatestCourierClause(courier)}
    ${buildLatestIntegrationClause(integration_type)}
    ${buildLatestAttemptClause(attempt_count)}
    ${buildLatestVisibilityClause()}
    ORDER BY created_at DESC, id DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `)) as any

  return { rows: rowsResult.rows || [], totalCount }
}

export async function getNdrTimeline(params: { awb?: string; orderId?: string }) {
  const { awb, orderId } = params

  let orderRow: { id: string; awb_number: string | null } | null = null

  if (orderId) {
    const [o] = await db
      .select({ id: b2c_orders.id, awb_number: b2c_orders.awb_number })
      .from(b2c_orders)
      .where(eq(b2c_orders.id, orderId))
      .limit(1)
    if (o) orderRow = o
  } else if (awb) {
    const [o] = await db
      .select({ id: b2c_orders.id, awb_number: b2c_orders.awb_number })
      .from(b2c_orders)
      .where(eq(b2c_orders.awb_number, awb))
      .limit(1)
    if (o) orderRow = o
  }

  const resolvedOrderId = orderRow?.id
  const resolvedAwb = orderRow?.awb_number || awb

  const ndr = await db
    .select({
      type: sql<string>`'ndr'`,
      at: ndr_events.created_at,
      status: ndr_events.status,
      remarks: ndr_events.remarks,
      reason: ndr_events.reason,
      attempt_no: ndr_events.attempt_no,
      raw: ndr_events.payload,
    })
    .from(ndr_events)
    .where(resolvedOrderId ? eq(ndr_events.order_id, resolvedOrderId) : sql`false`)

  const tracking = resolvedAwb
    ? await db
        .select({
          type: sql<string>`'tracking'`,
          at: tracking_events.created_at,
          status: tracking_events.status_code,
          remarks: tracking_events.status_text,
          reason: sql<string>`null`,
          attempt_no: sql<string>`null`,
          raw: tracking_events.raw,
        })
        .from(tracking_events)
        .where(eq(tracking_events.awb_number, resolvedAwb))
    : []

  const combined = [...ndr, ...tracking].sort(
    (a, b) => new Date(a.at as any).getTime() - new Date(b.at as any).getTime(),
  )

  return { orderId: resolvedOrderId, awb: resolvedAwb, events: combined }
}
