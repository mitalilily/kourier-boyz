import { and, eq, sql } from 'drizzle-orm'
import { Response } from 'express'
import { db } from '../models/client'
import { b2c_orders } from '../models/schema/b2cOrders'
import { ndr_events } from '../models/schema/ndr'
import { getNdrTimeline, listNdrEvents, listNdrEventsAdmin } from '../models/services/ndr.service'
import { buildCsv } from '../utils/csv'

const visibleNdrWhere = sql`
  coalesce(${ndr_events.status}, '') <> 'ndr_action'
  AND lower(coalesce(${b2c_orders.order_status}, '')) NOT IN ('pickup_initiated', 'delivered', 'cancelled', 'rto', 'rto_in_transit', 'rto_delivered')
`

export const getMyNdrEvents = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    const {
      orderId,
      page,
      limit,
      search,
      fromDate,
      toDate,
      courier,
      integration_type,
      attempt_count,
      status,
    } = req.query as any
    const p = Number(page) || 1
    const l = Math.min(Number(limit) || 20, 200)
    const { rows, totalCount } = await listNdrEvents(userId, orderId, {
      page: p,
      limit: l,
      search: search || '',
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
    res.json({ success: true, data: rows, totalCount })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message })
  }
}

export const getAdminNdrEvents = async (req: any, res: Response) => {
  try {
    const {
      orderId,
      page,
      limit,
      search,
      fromDate,
      toDate,
      courier,
      integration_type,
      attempt_count,
      status,
    } = req.query as any
    const p = Number(page) || 1
    const l = Math.min(Number(limit) || 20, 200)
    const { rows, totalCount } = await listNdrEventsAdmin(orderId, {
      page: p,
      limit: l,
      search: search || '',
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      courier: courier || undefined,
      integration_type: integration_type || undefined,
      attempt_count: attempt_count ? Number(attempt_count) : undefined,
      status: status || undefined,
    })
    res.json({ success: true, data: rows, totalCount })
  } catch (e: any) {
    res.status(500).json({ success: false, message: e.message })
  }
}

export const getAdminNdrTimeline = async (req: any, res: Response) => {
  try {
    const { awb, orderId } = req.query as { awb?: string; orderId?: string }
    if (!awb && !orderId) {
      return res.status(400).json({ success: false, message: 'Provide awb or orderId' })
    }
    const data = await getNdrTimeline({ awb, orderId })
    return res.json({ success: true, data })
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message })
  }
}

export const getMyNdrTimeline = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub
    const { awb, orderId } = req.query as { awb?: string; orderId?: string }
    if (!awb && !orderId) {
      return res.status(400).json({ success: false, message: 'Provide awb or orderId' })
    }

    let resolvedOrderId: string | undefined

    if (orderId) {
      const [order] = await db
        .select({ id: b2c_orders.id })
        .from(b2c_orders)
        .where(and(eq(b2c_orders.id, orderId), eq(b2c_orders.user_id, userId)))
        .limit(1)
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' })
      }
      resolvedOrderId = order.id
    } else if (awb) {
      const [order] = await db
        .select({ id: b2c_orders.id })
        .from(b2c_orders)
        .where(and(eq(b2c_orders.awb_number, awb), eq(b2c_orders.user_id, userId)))
        .limit(1)
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' })
      }
      resolvedOrderId = order.id
    }

    const data = await getNdrTimeline({ orderId: resolvedOrderId })
    return res.json({ success: true, data })
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message })
  }
}

export const exportAdminNdrCsv = async (req: any, res: Response) => {
  try {
    const { search, fromDate, toDate, courier, integration_type, attempt_count, status } =
      req.query as any

    const { rows } = await listNdrEventsAdmin(undefined, {
      page: 1,
      limit: 100000,
      search: search || '',
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      courier: courier || undefined,
      integration_type: integration_type || undefined,
      attempt_count: attempt_count ? Number(attempt_count) : undefined,
      status: status || undefined,
    })

    const headers = [
      'AWB',
      'OrderId',
      'Courier',
      'Integration',
      'Status',
      'CurrentSection',
      'OrderStatus',
      'Reason',
      'Remarks',
      'AttemptNo',
      'CreatedAt',
    ]
    const csv = buildCsv(
      headers,
      rows.map((r: any) => [
        r.awb_number,
        r.order_id,
        r.courier_partner,
        r.integration_type,
        r.status,
        r.current_section,
        r.order_status,
        r.reason,
        r.remarks,
        r.attempt_no,
        (r.created_at as any)?.toISOString?.(),
      ]),
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="ndr_export.csv"`)
    return res.status(200).send(csv)
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message })
  }
}

export const getAdminNdrKpis = async (req: any, res: Response) => {
  try {
    // Simple KPIs: total NDRs, by status, by courier, unique orders affected
    const totalResult = (await db.execute(sql`
      WITH visible_ndr AS (
        SELECT
          ${ndr_events.id} AS id,
          ${ndr_events.order_id} AS order_id,
          ${ndr_events.status} AS status,
          ${b2c_orders.courier_partner} AS courier_partner
        FROM ${ndr_events}
        LEFT JOIN ${b2c_orders} ON ${ndr_events.order_id} = ${b2c_orders.id}
        WHERE ${visibleNdrWhere}
      )
      SELECT COUNT(*)::int AS total
      FROM visible_ndr
    `)) as any
    const total = Number(totalResult.rows?.[0]?.total || 0)

    const byStatusResult = (await db.execute(sql`
      WITH visible_ndr AS (
        SELECT
          ${ndr_events.id} AS id,
          ${ndr_events.order_id} AS order_id,
          ${ndr_events.status} AS status,
          ${b2c_orders.courier_partner} AS courier_partner
        FROM ${ndr_events}
        LEFT JOIN ${b2c_orders} ON ${ndr_events.order_id} = ${b2c_orders.id}
        WHERE ${visibleNdrWhere}
      )
      SELECT status, COUNT(*)::int AS count
      FROM visible_ndr
      GROUP BY status
      ORDER BY count DESC, status ASC
    `)) as any
    const byStatus = byStatusResult.rows || []

    const byCourierResult = (await db.execute(sql`
      WITH visible_ndr AS (
        SELECT
          ${ndr_events.id} AS id,
          ${ndr_events.order_id} AS order_id,
          ${ndr_events.status} AS status,
          ${b2c_orders.courier_partner} AS courier_partner
        FROM ${ndr_events}
        LEFT JOIN ${b2c_orders} ON ${ndr_events.order_id} = ${b2c_orders.id}
        WHERE ${visibleNdrWhere}
      )
      SELECT courier_partner AS courier, COUNT(*)::int AS count
      FROM visible_ndr
      GROUP BY courier_partner
      ORDER BY count DESC, courier ASC
    `)) as any
    const byCourier = byCourierResult.rows || []

    const ordersAffectedResult = (await db.execute(sql`
      WITH visible_ndr AS (
        SELECT
          ${ndr_events.id} AS id,
          ${ndr_events.order_id} AS order_id,
          ${ndr_events.status} AS status,
          ${b2c_orders.courier_partner} AS courier_partner
        FROM ${ndr_events}
        LEFT JOIN ${b2c_orders} ON ${ndr_events.order_id} = ${b2c_orders.id}
        WHERE ${visibleNdrWhere}
      )
      SELECT COUNT(DISTINCT order_id)::int AS ordersAffected
      FROM visible_ndr
    `)) as any
    const ordersAffected = Number(ordersAffectedResult.rows?.[0]?.ordersAffected || 0)

    return res
      .status(200)
      .json({ success: true, data: { total, byStatus, byCourier, ordersAffected } })
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message })
  }
}
