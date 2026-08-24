import { and, asc, ilike, inArray, isNotNull, isNull, notInArray, or } from 'drizzle-orm'
import { db } from '../models/client'
import { b2b_orders } from '../models/schema/b2bOrders'
import { b2c_orders } from '../models/schema/b2cOrders'
import { trackByAwbService } from '../models/services/shiprocket.service'

const supportedTrackingProviders = [
  'delhivery',
  'shadowfax',
  'amazon',
  'xpressbees',
  'ekart',
] as const

type TrackingProvider = (typeof supportedTrackingProviders)[number]

const terminalStatuses = ['delivered', 'cancelled', 'rto_delivered', 'lost']

type PollableOrder = {
  id: string
  order_number: string | null
  awb_number: string | null
  integration_type: string | null
  courier_partner: string | null
  updated_at: Date | null
  source_type: 'b2c' | 'b2b'
}

const normalizeBatchSize = (batchSize: number) =>
  Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : 50

const normalizeProvider = (value: unknown): TrackingProvider | null => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\s+/g, '')
  if (normalized === 'xpressbees' || normalized === 'xpressbeeslogistics') return 'xpressbees'
  if (normalized === 'xpressbeeslogistic') return 'xpressbees'
  if (normalized === 'amazonshipping') return 'amazon'

  return supportedTrackingProviders.find((provider) => provider === normalized) || null
}

const parseProviderFilter = (providers?: string[]) => {
  const parsed = (providers || [])
    .map(normalizeProvider)
    .filter((provider): provider is TrackingProvider => Boolean(provider))

  return parsed.length ? Array.from(new Set(parsed)) : [...supportedTrackingProviders]
}

const courierPartnerNeedle = (provider: TrackingProvider) => {
  if (provider === 'xpressbees') return 'xpress'
  if (provider === 'amazon') return 'amazon'
  return provider
}

const providerScope = (
  table: { integration_type: any; courier_partner: any },
  providers: TrackingProvider[],
) =>
  or(
    inArray(table.integration_type, providers),
    ...providers.map((provider) => ilike(table.courier_partner, `%${courierPartnerNeedle(provider)}%`)),
  )

const sortByOldestUpdate = (a: PollableOrder, b: PollableOrder) =>
  new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime()

export async function pollCourierTracking({
  batchSize = 50,
  providers,
}: {
  batchSize?: number
  providers?: string[]
} = {}) {
  const limit = normalizeBatchSize(batchSize)
  const providerFilter = parseProviderFilter(providers)

  const b2cPending = await db
    .select({
      id: b2c_orders.id,
      order_number: b2c_orders.order_number,
      awb_number: b2c_orders.awb_number,
      integration_type: b2c_orders.integration_type,
      courier_partner: b2c_orders.courier_partner,
      updated_at: b2c_orders.updated_at,
    })
    .from(b2c_orders)
    .where(
      and(
        providerScope(b2c_orders, providerFilter),
        isNotNull(b2c_orders.awb_number),
        or(notInArray(b2c_orders.order_status, terminalStatuses), isNull(b2c_orders.order_status)),
      ),
    )
    .orderBy(asc(b2c_orders.updated_at))
    .limit(limit)

  const b2bPending = await db
    .select({
      id: b2b_orders.id,
      order_number: b2b_orders.order_number,
      awb_number: b2b_orders.awb_number,
      integration_type: b2b_orders.integration_type,
      courier_partner: b2b_orders.courier_partner,
      updated_at: b2b_orders.updated_at,
    })
    .from(b2b_orders)
    .where(
      and(
        providerScope(b2b_orders, providerFilter),
        isNotNull(b2b_orders.awb_number),
        or(notInArray(b2b_orders.order_status, terminalStatuses), isNull(b2b_orders.order_status)),
      ),
    )
    .orderBy(asc(b2b_orders.updated_at))
    .limit(limit)

  const pending: PollableOrder[] = [
    ...b2cPending.map((order) => ({ ...order, source_type: 'b2c' as const })),
    ...b2bPending.map((order) => ({ ...order, source_type: 'b2b' as const })),
  ]
    .sort(sortByOldestUpdate)
    .slice(0, limit)

  if (!pending.length) {
    return { checked: 0, updated: 0, failed: 0, providers: providerFilter }
  }

  let updated = 0
  let failed = 0

  for (const order of pending) {
    const awb = String(order.awb_number || '').trim()
    if (!awb) continue

    try {
      await trackByAwbService(awb)
      updated += 1
    } catch (err: any) {
      failed += 1
      console.error('[CourierTracking] Tracking poll failed', {
        order_id: order.id,
        order_number: order.order_number,
        order_type: order.source_type,
        integration_type: order.integration_type,
        courier_partner: order.courier_partner,
        awb,
        error: err?.message || err,
      })
    }
  }

  return { checked: pending.length, updated, failed, providers: providerFilter }
}
