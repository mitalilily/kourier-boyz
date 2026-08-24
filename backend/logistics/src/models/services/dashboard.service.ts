// services/pickupService.ts
import { and, count, desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { codRemittances } from '../schema/codRemittance'
import { invoices } from '../schema/invoices'
import { rto_events } from '../schema/rto'
import { supportTickets } from '../schema/supportTickets'
import { wallets, walletTransactions } from '../schema/wallet'
import { weight_discrepancies } from '../schema/weightDiscrepancies'

type DashboardOrder = {
  id: string
  order_number: string
  order_date: string
  order_amount: unknown
  order_type: string
  order_status: string | null
  shipping_charges: unknown
  freight_charges: unknown
  courier_partner: string | null
  city: string
  state: string
  provider_meta?: unknown
  created_at: Date | null
  updated_at: Date | null
}

const ACTIVE_NDR_STATUSES = new Set([
  'ndr',
  'undelivered',
  'lost',
  'address_issue',
  'nsl',
  'delivery_attempt_failed',
  'door_closed',
  'attempt_undelivered',
  'customer_not_available',
  'customer_unavailable',
  'consignee_not_available',
  'consignee_unavailable',
])

const ACTIVE_PENDING_STATUSES = new Set([
  'pending',
  'booked',
  'pickup_requested',
  'pickup_initiated',
  'manifest_pending',
  'manifested',
])

const ACTIVE_SHIPMENT_STATUSES = new Set([
  'shipment_created',
  'in_transit',
  'out_for_delivery',
])

const NON_REVENUE_STATUSES = new Set([
  'failed',
  'manifest_failed',
  'cancelled',
  'cancellation_requested',
])

const parseProviderMeta = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }

  return {}
}

const getResolvedCodAmount = (order: DashboardOrder) => {
  if (String(order.order_type || '').trim().toLowerCase() !== 'cod') {
    return 0
  }

  const providerMeta = parseProviderMeta(order.provider_meta)
  const providerMetaCodAmount = Number(
    providerMeta.cod_amount ?? providerMeta.codAmount ?? providerMeta.collectable_amount ?? 0,
  )

  if (Number.isFinite(providerMetaCodAmount) && providerMetaCodAmount > 0) {
    return providerMetaCodAmount
  }

  return Number(order.order_amount || 0)
}

const isActiveNdrStatus = (status: unknown) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (!normalized || normalized === 'ndr_action') return false

  if (ACTIVE_NDR_STATUSES.has(normalized)) return true

  return Array.from(ACTIVE_NDR_STATUSES).some((needle) => normalized.includes(needle))
}

const countActiveNdrOrders = (orders: Array<{ id: string; order_status: string | null }>) =>
  new Set(orders.filter((order) => isActiveNdrStatus(order.order_status)).map((order) => order.id))
    .size

const getUnifiedRtoCount = async (userId: string, asOf: Date) => {
  const [eventRows, legacyRows] = await Promise.all([
    db
      .select({ orderId: rto_events.order_id })
      .from(rto_events)
      .where(and(eq(rto_events.user_id, userId), sql`${rto_events.created_at} <= ${asOf}`)),
    db
      .select({ orderId: b2c_orders.id })
      .from(b2c_orders)
      .where(
        and(
          eq(b2c_orders.user_id, userId),
          sql`${b2c_orders.order_status} IN ('rto', 'rto_in_transit', 'rto_delivered')`,
          sql`coalesce(${b2c_orders.updated_at}, ${b2c_orders.created_at}) <= ${asOf}`,
          sql`NOT EXISTS (
            SELECT 1
            FROM ${rto_events} existing_rto
            WHERE existing_rto.order_id = ${b2c_orders.id}
          )`,
        ),
      ),
  ])

  return new Set([...eventRows.map((event) => event.orderId), ...legacyRows.map((order) => order.orderId)])
    .size
}

export const getIncomingPickups = async (userId: string) => {
  // 🔹 Fetch top 3 pickups from B2C
  const b2cPickups = await db
    .select({
      id: b2c_orders.id,
      awb_number: b2c_orders.awb_number,
      courier_partner: b2c_orders.courier_partner,
      order_number: b2c_orders.order_number,
      pickup_details: b2c_orders.pickup_details,
      created_at: b2c_orders.created_at,
    })
    .from(b2c_orders)
    .where(and(eq(b2c_orders.user_id, userId), eq(b2c_orders.order_status, 'pickup_initiated')))
    .orderBy(b2c_orders.created_at) // oldest first
    .limit(3)

  // 🔹 Fetch top 3 pickups from B2B
  const b2bPickups = await db
    .select({
      id: b2b_orders.id,
      awb_number: b2b_orders.awb_number,
      courier_partner: b2b_orders.courier_partner,
      order_number: b2b_orders.order_number,
      pickup_details: b2b_orders.pickup_details,
      created_at: b2b_orders.created_at,
    })
    .from(b2b_orders)
    .where(and(eq(b2b_orders.user_id, userId), eq(b2b_orders.order_status, 'pickup_initiated')))
    .orderBy(b2b_orders.created_at)
    .limit(3)

  // Merge and sort by created_at
  const allPickups = [...b2cPickups, ...b2bPickups].sort(
    (a, b) => (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0),
  )

  // Return only top 3 overall
  return allPickups.slice(0, 3)
}

export const getPendingActions = async (userId: string) => {
  const [b2cActiveNdrOrders, b2bActiveNdrOrders] = await Promise.all([
    db
      .select({
        id: b2c_orders.id,
        order_status: b2c_orders.order_status,
      })
      .from(b2c_orders)
      .where(eq(b2c_orders.user_id, userId)),
    db
      .select({
        id: b2b_orders.id,
        order_status: b2b_orders.order_status,
      })
      .from(b2b_orders)
      .where(eq(b2b_orders.user_id, userId)),
  ])

  const ndrCount = countActiveNdrOrders([...b2cActiveNdrOrders, ...b2bActiveNdrOrders])
  const rtoCount = await getUnifiedRtoCount(userId, new Date())

  // Count pending weight discrepancies
  const weightCount = await db
    .select({ count: count() })
    .from(weight_discrepancies)
    .where(and(eq(weight_discrepancies.user_id, userId), eq(weight_discrepancies.status, 'pending')))

  return {
    ndrCount,
    rtoCount: Number(rtoCount || 0),
    weightDiscrepancyCount: Number(weightCount[0]?.count || 0),
  }
}

export const getInvoiceStatus = async (userId: string) => {
  const statusCounts = await db
    .select({
      status: invoices.status,
      count: count(),
      totalAmount: sql<number>`COALESCE(SUM(${invoices.netPayableAmount}::numeric), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.userId, userId))
    .groupBy(invoices.status)

  const statusSummary: Record<string, { count: number; totalAmount: number }> = {
    pending: { count: 0, totalAmount: 0 },
    paid: { count: 0, totalAmount: 0 },
    overdue: { count: 0, totalAmount: 0 },
  }

  for (const row of statusCounts) {
    if (row.status) {
      statusSummary[row.status] = {
        count: Number(row.count),
        totalAmount: Number(row.totalAmount),
      }
    }
  }

  return statusSummary
}

export const getTopDestinations = async (userId: string, limit = 10) => {
  // Get top cities from B2C orders
  const b2cCities = await db
    .select({
      city: b2c_orders.city,
      state: b2c_orders.state,
      count: count(),
    })
    .from(b2c_orders)
    .where(eq(b2c_orders.user_id, userId))
    .groupBy(b2c_orders.city, b2c_orders.state)
    .orderBy(sql`count(*) DESC`)

  // Get top cities from B2B orders
  const b2bCities = await db
    .select({
      city: b2b_orders.city,
      state: b2b_orders.state,
      count: count(),
    })
    .from(b2b_orders)
    .where(eq(b2b_orders.user_id, userId))
    .groupBy(b2b_orders.city, b2b_orders.state)
    .orderBy(sql`count(*) DESC`)

  // Merge and aggregate by city+state
  const cityMap = new Map<string, { city: string; state: string; count: number }>()

  for (const row of b2cCities) {
    const key = `${row.city}-${row.state}`
    const existing = cityMap.get(key)
    if (existing) {
      existing.count += Number(row.count)
    } else {
      cityMap.set(key, { city: row.city, state: row.state, count: Number(row.count) })
    }
  }

  for (const row of b2bCities) {
    const key = `${row.city}-${row.state}`
    const existing = cityMap.get(key)
    if (existing) {
      existing.count += Number(row.count)
    } else {
      cityMap.set(key, { city: row.city, state: row.state, count: Number(row.count) })
    }
  }

  // Sort by count and return top N
  return Array.from(cityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export const getCourierDistribution = async (userId: string) => {
  // Get courier distribution from B2C orders
  const b2cCouriers = await db
    .select({
      courier: b2c_orders.courier_partner,
      count: count(),
    })
    .from(b2c_orders)
    .where(and(eq(b2c_orders.user_id, userId), sql`${b2c_orders.courier_partner} IS NOT NULL`))
    .groupBy(b2c_orders.courier_partner)

  // Get courier distribution from B2B orders
  const b2bCouriers = await db
    .select({
      courier: b2b_orders.courier_partner,
      count: count(),
    })
    .from(b2b_orders)
    .where(and(eq(b2b_orders.user_id, userId), sql`${b2b_orders.courier_partner} IS NOT NULL`))
    .groupBy(b2b_orders.courier_partner)

  // Merge and aggregate
  const courierMap = new Map<string, number>()

  for (const row of b2cCouriers) {
    if (row.courier) {
      const existing = courierMap.get(row.courier) || 0
      courierMap.set(row.courier, existing + Number(row.count))
    }
  }

  for (const row of b2bCouriers) {
    if (row.courier) {
      const existing = courierMap.get(row.courier) || 0
      courierMap.set(row.courier, existing + Number(row.count))
    }
  }

  // Convert to array and sort by count
  return Array.from(courierMap.entries())
    .map(([courier, count]) => ({ courier, count }))
    .sort((a, b) => b.count - a.count)
}

// Comprehensive merchant dashboard stats
export const getMerchantDashboardStats = async (userId: string, selectedDate?: Date) => {
  const dashboardOrderColumns = {
    id: b2c_orders.id,
    order_number: b2c_orders.order_number,
    order_date: b2c_orders.order_date,
    order_amount: b2c_orders.order_amount,
    order_type: b2c_orders.order_type,
    order_status: b2c_orders.order_status,
    shipping_charges: b2c_orders.shipping_charges,
    freight_charges: b2c_orders.freight_charges,
    courier_partner: b2c_orders.courier_partner,
    city: b2c_orders.city,
    state: b2c_orders.state,
    provider_meta: b2c_orders.provider_meta,
    created_at: b2c_orders.created_at,
    updated_at: b2c_orders.updated_at,
  }
  const b2cOrders = await db
    .select(dashboardOrderColumns)
    .from(b2c_orders)
    .where(eq(b2c_orders.user_id, userId))
  const b2bOrders = await db
    .select({
      id: b2b_orders.id,
      order_number: b2b_orders.order_number,
      order_date: b2b_orders.order_date,
      order_amount: b2b_orders.order_amount,
      order_type: b2b_orders.order_type,
      order_status: b2b_orders.order_status,
      shipping_charges: b2b_orders.shipping_charges,
      freight_charges: b2b_orders.freight_charges,
      courier_partner: b2b_orders.courier_partner,
      city: b2b_orders.city,
      state: b2b_orders.state,
      provider_meta: b2b_orders.provider_meta,
      created_at: b2b_orders.created_at,
      updated_at: b2b_orders.updated_at,
    })
    .from(b2b_orders)
    .where(eq(b2b_orders.user_id, userId))
  const allOrders: DashboardOrder[] = [...b2cOrders, ...b2bOrders]

  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)

  const codRemittanceStats = await db
    .select({
      pending: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN remittable_amount::numeric ELSE 0 END), 0)`,
      credited: sql<number>`COALESCE(SUM(CASE WHEN status = 'credited' THEN remittable_amount::numeric ELSE 0 END), 0)`,
    })
    .from(codRemittances)
    .where(eq(codRemittances.userId, userId))

  const tickets = await db.select().from(supportTickets).where(eq(supportTickets.userId, userId))

  const actualNow = new Date()
  const requestedDate = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : actualNow
  const endOfRequestedDay = new Date(
    requestedDate.getFullYear(),
    requestedDate.getMonth(),
    requestedDate.getDate(),
    23,
    59,
    59,
    999,
  )
  const now = endOfRequestedDay.getTime() > actualNow.getTime() ? actualNow : endOfRequestedDay
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(thisWeekStart.getDate() - 6)
  const previousWeekStart = new Date(thisWeekStart)
  previousWeekStart.setDate(previousWeekStart.getDate() - 7)
  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const todayIso = today.toISOString().slice(0, 10)

  const getFirstValidDate = (...values: unknown[]) => {
    for (const value of values) {
      if (!value) continue
      const parsed = new Date(value as string | number | Date)
      if (!isNaN(parsed.getTime())) return parsed
    }
    return new Date(0)
  }

  const getOrderTimestamp = (order: any) =>
    getFirstValidDate(order.order_date, order.created_at, order.updated_at)
  const isOnOrBeforeSelectedDate = (date: Date) =>
    !isNaN(date.getTime()) && date.getTime() <= now.getTime()
  const isSameLocalDay = (date: Date, target: Date) =>
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  const isWithinInclusiveRange = (date: Date, start: Date, end: Date) => date >= start && date <= end
  const isWithinHalfOpenRange = (date: Date, start: Date, endExclusive: Date) =>
    date >= start && date < endExclusive
  const getCustomerProfit = (order: any) => {
    const normalizedStatus = String(order?.order_status || '').trim().toLowerCase()
    if (NON_REVENUE_STATUSES.has(normalizedStatus)) {
      return 0
    }

    const shippingCharge = Number(order?.shipping_charges || 0)
    const freightCharge = Number(order?.freight_charges || 0)
    return freightCharge > 0 ? shippingCharge - freightCharge : shippingCharge
  }

  const eligibleOrders = allOrders.filter((order) => isOnOrBeforeSelectedDate(getOrderTimestamp(order)))

  const todayOrders = eligibleOrders.filter((order) => isSameLocalDay(getOrderTimestamp(order), today))
  const pendingOrders = todayOrders.filter((order) =>
    ACTIVE_PENDING_STATUSES.has(String(order.order_status || '').toLowerCase()),
  )
  const inTransitOrders = todayOrders.filter((order) =>
    ACTIVE_SHIPMENT_STATUSES.has(String(order.order_status || '').toLowerCase()),
  )
  const deliveredToday = todayOrders.filter(
    (order) => String(order.order_status || '').toLowerCase() === 'delivered',
  )

  const todayRevenue = todayOrders.reduce((sum, order) => sum + getCustomerProfit(order), 0)
  const totalRevenue = eligibleOrders.reduce((sum, order) => sum + getCustomerProfit(order), 0)
  const totalShippingCharges = eligibleOrders.reduce(
    (sum, order) => sum + Number((order as any).shipping_charges || 0),
    0,
  )
  const totalFreightCharges = eligibleOrders.reduce(
    (sum, order) => sum + Number((order as any).freight_charges || 0),
    0,
  )

  const codOrders = eligibleOrders.filter(
    (order) => String((order as any).order_type || '').toLowerCase() === 'cod',
  )
  const codAmount = codOrders.reduce((sum, order) => sum + getResolvedCodAmount(order), 0)

  const codPendingAsOf = await db
    .select({
      pending: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' AND ${codRemittances.createdAt} <= ${now} THEN remittable_amount::numeric ELSE 0 END), 0)`,
    })
    .from(codRemittances)
    .where(eq(codRemittances.userId, userId))

  const codRemittanceCreditedThisMonth = await db
    .select({
      credited: sql<number>`COALESCE(SUM(${codRemittances.remittableAmount}::numeric), 0)`,
    })
    .from(codRemittances)
    .where(
      and(
        eq(codRemittances.userId, userId),
        eq(codRemittances.status, 'credited'),
        sql`${codRemittances.creditedAt} >= ${thisMonthStart}`,
        sql`${codRemittances.creditedAt} <= ${now}`,
      ),
    )

  const totalOrders = eligibleOrders.length
  const nonCancelledOrders = eligibleOrders.filter(
    (order) => String((order as any).order_status || '').toLowerCase() !== 'cancelled',
  )
  const deliveredOrders = eligibleOrders.filter((order) => {
    const deliveredAt = getFirstValidDate(
      (order as any).delivered_at,
      (order as any).updated_at,
      (order as any).created_at,
    )
    return (
      String(order.order_status || '').toLowerCase() === 'delivered' &&
      isOnOrBeforeSelectedDate(deliveredAt)
    )
  })
  const operationalBaseCount = nonCancelledOrders.length
  const deliverySuccessRate =
    operationalBaseCount > 0 ? Math.round((deliveredOrders.length / operationalBaseCount) * 100) : 0

  const ndrCount = countActiveNdrOrders(eligibleOrders)
  const ndrRate = operationalBaseCount > 0 ? Math.round((ndrCount / operationalBaseCount) * 100) : 0

  const rtoCount = await getUnifiedRtoCount(userId, now)
  const rtoRate = operationalBaseCount > 0 ? Math.round((rtoCount / operationalBaseCount) * 100) : 0

  const deliveredOrdersWithDates = deliveredOrders.filter((order) => {
    const created = getOrderTimestamp(order)
    const delivered = getFirstValidDate(
      (order as any).delivered_at,
      (order as any).updated_at,
      (order as any).created_at,
    )
    return !isNaN(created.getTime()) && !isNaN(delivered.getTime())
  })
  const avgDeliveryTime =
    deliveredOrdersWithDates.length > 0
      ? Math.round(
          deliveredOrdersWithDates.reduce((sum, order) => {
            const created = getOrderTimestamp(order)
            const delivered = getFirstValidDate(
              (order as any).delivered_at,
              (order as any).updated_at,
              (order as any).created_at,
            )
            return sum + Math.floor((delivered.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
          }, 0) / deliveredOrdersWithDates.length,
        )
      : 0

  const courierPerformance = eligibleOrders.reduce((acc, order) => {
    const courier = (order as any).courier_partner || 'Unknown'
    if (!acc[courier]) acc[courier] = { count: 0, delivered: 0, revenue: 0, deliveryRate: 0 }
    if (String((order as any).order_status || '').toLowerCase() !== 'cancelled') {
      acc[courier].count += 1
    }
    acc[courier].revenue += getCustomerProfit(order)
    if (String((order as any).order_status || '').toLowerCase() === 'delivered') {
      acc[courier].delivered += 1
    }
    return acc
  }, {} as Record<string, { count: number; delivered: number; revenue: number; deliveryRate: number }>)

  Object.keys(courierPerformance).forEach((courier) => {
    const perf = courierPerformance[courier]
    perf.deliveryRate = perf.count > 0 ? Math.round((perf.delivered / perf.count) * 100) : 0
  })

  const ordersByDate: Record<string, number> = {}
  const revenueByDate: Record<string, number> = {}
  const ordersByStatus: Record<string, number> = {}
  const revenueByOrderType: Record<string, number> = {}
  const ordersByCourier: Record<string, number> = {}
  const revenueByCourier: Record<string, number> = {}
  const ordersByDate30: Record<string, number> = {}
  const revenueByDate30: Record<string, number> = {}

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayOrders = eligibleOrders.filter((order) => isSameLocalDay(getOrderTimestamp(order), date))
    ordersByDate[dateStr] = dayOrders.length
    revenueByDate[dateStr] = dayOrders.reduce((sum, order) => sum + getCustomerProfit(order), 0)
  }

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayOrders = eligibleOrders.filter((order) => isSameLocalDay(getOrderTimestamp(order), date))
    ordersByDate30[dateStr] = dayOrders.length
    revenueByDate30[dateStr] = dayOrders.reduce((sum, order) => sum + getCustomerProfit(order), 0)
  }

  eligibleOrders.forEach((order) => {
    const status = String((order as any).order_status || 'pending').toLowerCase()
    const orderType = String((order as any).order_type || 'prepaid').toLowerCase()
    const courier = (order as any).courier_partner || 'Unknown'
    const customerProfit = getCustomerProfit(order)

    ordersByStatus[status] = (ordersByStatus[status] || 0) + 1
    revenueByOrderType[orderType] = (revenueByOrderType[orderType] || 0) + customerProfit
    ordersByCourier[courier] = (ordersByCourier[courier] || 0) + 1
    revenueByCourier[courier] = (revenueByCourier[courier] || 0) + customerProfit
  })

  const prepaidOrders = eligibleOrders.filter(
    (order) => String((order as any).order_type || '').toLowerCase() === 'prepaid',
  )
  const codOrdersCount = eligibleOrders.filter(
    (order) => String((order as any).order_type || '').toLowerCase() === 'cod',
  )
  const avgOrderValue =
    eligibleOrders.length > 0
      ? eligibleOrders.reduce((sum, order) => sum + Number((order as any).order_amount || 0), 0) /
        eligibleOrders.length
      : 0

  const cityRevenue: Record<string, number> = {}
  eligibleOrders.forEach((order) => {
    const city = (order as any).city || 'Unknown'
    cityRevenue[city] = (cityRevenue[city] || 0) + getCustomerProfit(order)
  })
  const topRevenueCities = Object.entries(cityRevenue)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([city, revenue]) => ({ city, revenue }))

  const thisWeekEnd = new Date(now)
  const thisWeekOrders = eligibleOrders.filter((order) =>
    isWithinInclusiveRange(getOrderTimestamp(order), thisWeekStart, thisWeekEnd),
  )
  const previousWeekOrders = eligibleOrders.filter((order) =>
    isWithinHalfOpenRange(getOrderTimestamp(order), previousWeekStart, thisWeekStart),
  )
  const thisWeekRevenue = thisWeekOrders.reduce((sum, order) => sum + getCustomerProfit(order), 0)
  const previousWeekRevenue = previousWeekOrders.reduce(
    (sum, order) => sum + getCustomerProfit(order),
    0,
  )
  const ordersGrowth =
    previousWeekOrders.length > 0
      ? Math.round(((thisWeekOrders.length - previousWeekOrders.length) / previousWeekOrders.length) * 100)
      : thisWeekOrders.length > 0
        ? 100
        : 0
  const revenueGrowth =
    previousWeekRevenue > 0
      ? Math.round(((thisWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100)
      : thisWeekRevenue > 0
        ? 100
        : 0

  const historicalWalletBalance = wallet
    ? Number(
        (
          await db
            .select({
              balance: sql<number>`COALESCE(SUM(CASE WHEN ${walletTransactions.type} = 'credit' THEN ${walletTransactions.amount}::numeric ELSE -${walletTransactions.amount}::numeric END), 0)`,
            })
            .from(walletTransactions)
            .where(and(eq(walletTransactions.wallet_id, wallet.id), sql`${walletTransactions.created_at} <= ${now}`))
        )[0]?.balance || 0,
      )
    : 0

  const recentTransactions = wallet
    ? await db
        .select()
        .from(walletTransactions)
        .where(and(eq(walletTransactions.wallet_id, wallet.id), sql`${walletTransactions.created_at} <= ${now}`))
        .orderBy(sql`${walletTransactions.created_at} DESC`)
        .limit(5)
    : []

  const recentOrdersList = [...eligibleOrders]
    .sort((a, b) => getOrderTimestamp(b).getTime() - getOrderTimestamp(a).getTime())
    .slice(0, 5)

  const invoiceCounts = await db
    .select({
      status: invoices.status,
      count: count(),
      totalAmount: sql<number>`COALESCE(SUM(${invoices.netPayableAmount}::numeric), 0)`,
    })
    .from(invoices)
    .where(and(eq(invoices.userId, userId), sql`${invoices.invoiceDate} <= ${todayIso}`))
    .groupBy(invoices.status)

  const invoiceStatus: Record<string, { count: number; totalAmount: number }> = {
    pending: { count: 0, totalAmount: 0 },
    paid: { count: 0, totalAmount: 0 },
    overdue: { count: 0, totalAmount: 0 },
  }
  for (const row of invoiceCounts) {
    if (row.status) {
      invoiceStatus[row.status] = {
        count: Number(row.count),
        totalAmount: Number(row.totalAmount),
      }
    }
  }

  const weightDiscrepancyCount = Number(
    (
      await db
        .select({ count: count() })
        .from(weight_discrepancies)
        .where(
          and(
            eq(weight_discrepancies.user_id, userId),
            eq(weight_discrepancies.status, 'pending'),
            sql`${weight_discrepancies.created_at} <= ${now}`,
          ),
        )
    )[0]?.count || 0,
  )

  const topDestinations = Array.from(
    eligibleOrders.reduce((map, order) => {
      const city = String((order as any).city || '').trim()
      const state = String((order as any).state || '').trim()
      if (!city && !state) return map
      const key = `${city}-${state}`
      const current = map.get(key) || { city, state, count: 0 }
      current.count += 1
      map.set(key, current)
      return map
    }, new Map<string, { city: string; state: string; count: number }>()),
  )
    .map(([, value]) => value)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const courierDistribution = Array.from(
    eligibleOrders.reduce((map, order) => {
      const courier = String((order as any).courier_partner || '').trim() || 'Unknown'
      map.set(courier, (map.get(courier) || 0) + 1)
      return map
    }, new Map<string, number>()),
  )
    .map(([courier, countValue]) => ({ courier, count: countValue }))
    .sort((a, b) => b.count - a.count)

  const eligibleTickets = tickets.filter((ticket) =>
    isOnOrBeforeSelectedDate(getFirstValidDate((ticket as any).createdAt)),
  )
  const openTickets = eligibleTickets.filter((ticket) => ticket.status === 'open')
  const inProgressTickets = eligibleTickets.filter((ticket) => ticket.status === 'in_progress')

  return {
    success: true,
    data: {
      asOfDate: todayIso,
      todayOperations: {
        orders: todayOrders.length,
        pending: pendingOrders.length,
        inTransit: inTransitOrders.length,
        delivered: deliveredToday.length,
      },
      financial: {
        walletBalance: historicalWalletBalance,
        todayRevenue,
        totalRevenue,
        totalShippingCharges,
        totalFreightCharges,
        profit: totalRevenue,
        codAmount,
        codRemittanceDue: Number(codPendingAsOf[0]?.pending || 0),
        codRemittanceCredited: Number(codRemittanceCreditedThisMonth[0]?.credited || 0),
      },
      operational: {
        deliverySuccessRate,
        ndrRate,
        rtoRate,
        avgDeliveryTime,
        totalOrders,
        deliveredOrders: deliveredOrders.length,
        ndrCount,
        rtoCount,
      },
      actions: {
        ndrCount,
        rtoCount,
        weightDiscrepancyCount,
        openTickets: openTickets.length,
        inProgressTickets: inProgressTickets.length,
        pendingInvoices: invoiceStatus.pending.count,
        pendingInvoiceAmount: invoiceStatus.pending.totalAmount,
        overdueInvoices: invoiceStatus.overdue.count,
        overdueInvoiceAmount: invoiceStatus.overdue.totalAmount,
      },
      couriers: {
        performance: courierPerformance,
        distribution: courierDistribution,
      },
      geographic: {
        topDestinations,
      },
      charts: {
        ordersByDate: Object.entries(ordersByDate).map(([date, countValue]) => ({ date, orders: countValue })),
        revenueByDate: Object.entries(revenueByDate).map(([date, revenue]) => ({ date, revenue })),
        ordersByDate30: Object.entries(ordersByDate30).map(([date, countValue]) => ({ date, orders: countValue })),
        revenueByDate30: Object.entries(revenueByDate30).map(([date, revenue]) => ({ date, revenue })),
        ordersByStatus: Object.entries(ordersByStatus).map(([status, countValue]) => ({ status, count: countValue })),
        revenueByOrderType: Object.entries(revenueByOrderType).map(([type, revenue]) => ({ type, revenue })),
        ordersByCourier: Object.entries(ordersByCourier).map(([courier, countValue]) => ({ courier, count: countValue })),
        revenueByCourier: Object.entries(revenueByCourier).map(([courier, revenue]) => ({ courier, revenue })),
      },
      metrics: {
        avgOrderValue,
        totalPrepaidOrders: prepaidOrders.length,
        totalCodOrders: codOrdersCount.length,
        prepaidRevenue: prepaidOrders.reduce((sum, order) => sum + getCustomerProfit(order), 0),
        codRevenue: codOrdersCount.reduce((sum, order) => sum + getCustomerProfit(order), 0),
        topRevenueCities,
      },
      recentOrders: recentOrdersList,
      trends: {
        ordersGrowth,
        revenueGrowth,
        thisWeekOrders: thisWeekOrders.length,
        lastWeekOrders: previousWeekOrders.length,
        thisWeekRevenue,
        lastWeekRevenue: previousWeekRevenue,
      },
      recentActivity: {
        transactions: recentTransactions.map((transaction) => ({
          id: transaction.id,
          type: transaction.type,
          amount: Number(transaction.amount || 0),
          reason: transaction.reason || '',
          createdAt: transaction.created_at,
        })),
        recentOrders: recentOrdersList.map((order) => ({
          id: (order as any).id,
          orderNumber: (order as any).order_number || '',
          status: (order as any).order_status || '',
          amount: Number((order as any).order_amount || 0),
          createdAt: getOrderTimestamp(order),
        })),
      },
    },
  }
}
