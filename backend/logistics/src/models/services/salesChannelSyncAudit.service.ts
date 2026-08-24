import { and, desc, like, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { b2c_orders } from '../schema/b2cOrders'

export type SalesChannel = 'shopify' | 'woocommerce'

export type SalesChannelSyncOutcome = {
  channel: SalesChannel
  status: 'success' | 'failed' | 'skipped'
  source?: string
  actions?: string[]
  reason?: string
  error?: unknown
  syncedStatus?: string
  syncedAwb?: string
}

const toPlainMeta = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {}

const toErrorMessage = (error: unknown) => {
  if (!error) return null
  if (typeof error === 'string') return error.slice(0, 500)
  const err = error as any
  const responseData = err?.response?.data
  if (responseData?.message) return String(responseData.message).slice(0, 500)
  if (responseData?.errors?.[0]?.message) return String(responseData.errors[0].message).slice(0, 500)
  if (responseData) return JSON.stringify(responseData).slice(0, 500)
  return String(err?.message || err).slice(0, 500)
}

export const detectSalesChannel = (order: any): SalesChannel | null => {
  const localOrderId = String(order?.order_id || '').trim()
  if (localOrderId.startsWith('shopify_')) return 'shopify'
  if (localOrderId.startsWith('woo_')) return 'woocommerce'
  return null
}

export const recordSalesChannelSyncOutcome = async (
  order: any,
  outcome: SalesChannelSyncOutcome,
  tx: any = db,
) => {
  const orderId = String(order?.id || '').trim()
  if (!orderId) return

  try {
    const [freshOrder] = await tx
      .select({
        id: b2c_orders.id,
        provider_meta: b2c_orders.provider_meta,
        order_status: b2c_orders.order_status,
        awb_number: b2c_orders.awb_number,
      })
      .from(b2c_orders)
      .where(sql`${b2c_orders.id} = ${orderId}::uuid`)
      .limit(1)

    if (!freshOrder?.id) return

    const existingMeta = toPlainMeta(freshOrder.provider_meta)
    const previousSync = toPlainMeta(existingMeta.sales_channel_sync)
    const previousAttempts = Number(previousSync.attempts || 0)
    const now = new Date().toISOString()
    const status = outcome.status
    const completedWithoutRetry = status === 'success' || status === 'skipped'
    const syncedStatus = String(outcome.syncedStatus ?? freshOrder.order_status ?? order?.order_status ?? '')
    const syncedAwb = String(outcome.syncedAwb ?? freshOrder.awb_number ?? order?.awb_number ?? '')

    const nextSync = {
      ...previousSync,
      channel: outcome.channel,
      status,
      source: outcome.source || previousSync.source || null,
      actions: outcome.actions || [],
      reason: outcome.reason || null,
      error: status === 'failed' ? toErrorMessage(outcome.error) : null,
      attempts: completedWithoutRetry ? 0 : previousAttempts + 1,
      last_attempted_at: now,
      last_success_at: status === 'success' ? now : previousSync.last_success_at || null,
      synced_status: completedWithoutRetry ? syncedStatus : previousSync.synced_status || null,
      synced_awb: completedWithoutRetry ? syncedAwb : previousSync.synced_awb || null,
    }

    await tx
      .update(b2c_orders)
      .set({
        provider_meta: {
          ...existingMeta,
          sales_channel_sync: nextSync,
        },
      })
      .where(sql`${b2c_orders.id} = ${orderId}::uuid`)
  } catch (err: any) {
    console.warn('Sales channel sync audit update failed:', err?.message || err)
  }
}

export const getSalesChannelSyncCandidates = async ({
  batchSize = 50,
  retryDelayMinutes = 10,
  recentDays = 45,
  tx = db,
}: {
  batchSize?: number
  retryDelayMinutes?: number
  recentDays?: number
  tx?: any
} = {}) => {
  const safeBatchSize = Math.min(Math.max(Number(batchSize) || 50, 1), 250)
  const safeRetryDelayMinutes = Math.min(Math.max(Number(retryDelayMinutes) || 10, 1), 1440)
  const safeRecentDays = Math.min(Math.max(Number(recentDays) || 45, 1), 365)

  return tx
    .select()
    .from(b2c_orders)
    .where(
      and(
        or(like(b2c_orders.order_id, 'shopify_%'), like(b2c_orders.order_id, 'woo_%')),
        sql`
          lower(coalesce(${b2c_orders.order_status}, '')) in (
            'booked',
            'pickup_initiated',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'cancelled',
            'cancellation_requested'
          )
        `,
        sql`${b2c_orders.updated_at} >= now() - (${safeRecentDays}::text || ' days')::interval`,
        sql`
          (
            ${b2c_orders.provider_meta} is null
            or ${b2c_orders.provider_meta}->'sales_channel_sync' is null
            or ${b2c_orders.provider_meta}->'sales_channel_sync'->>'synced_status'
              is distinct from coalesce(${b2c_orders.order_status}, '')
            or ${b2c_orders.provider_meta}->'sales_channel_sync'->>'synced_awb'
              is distinct from coalesce(${b2c_orders.awb_number}, '')
            or (
              ${b2c_orders.provider_meta}->'sales_channel_sync'->>'status' = 'failed'
              and coalesce(
                (${b2c_orders.provider_meta}->'sales_channel_sync'->>'last_attempted_at')::timestamptz,
                to_timestamp(0)
              ) < now() - (${safeRetryDelayMinutes}::text || ' minutes')::interval
            )
          )
        `,
      ),
    )
    .orderBy(desc(b2c_orders.updated_at))
    .limit(safeBatchSize)
}
