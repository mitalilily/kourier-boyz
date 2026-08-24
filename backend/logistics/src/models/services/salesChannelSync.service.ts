import { db } from '../client'
import {
  SalesChannel,
  detectSalesChannel,
  getSalesChannelSyncCandidates,
  recordSalesChannelSyncOutcome,
} from './salesChannelSyncAudit.service'

type SyncSourceOptions = {
  source?: string
  tx?: any
}

const channelLabel: Record<SalesChannel, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
}

export const syncSalesChannelStatusForLocalOrder = async (
  order: any,
  { source = 'manual', tx = db }: SyncSourceOptions = {},
) => {
  const channel = detectSalesChannel(order)
  if (!channel) {
    return { attempted: false, success: true, channel: null, reason: 'not_a_sales_channel_order' }
  }

  if (channel === 'shopify') {
    const { syncShopifyStatusForLocalOrder } = await import('./shopify.service')
    return syncShopifyStatusForLocalOrder(order, tx, { source })
  }

  const { syncWooCommerceStatusForLocalOrder } = await import('./woocommerce.service')
  return syncWooCommerceStatusForLocalOrder(order, tx, { source })
}

export const retryPendingSalesChannelStatusSync = async ({
  batchSize = Number(process.env.SALES_CHANNEL_SYNC_RETRY_BATCH_SIZE || 50),
  retryDelayMinutes = Number(process.env.SALES_CHANNEL_SYNC_RETRY_DELAY_MINUTES || 10),
  recentDays = Number(process.env.SALES_CHANNEL_SYNC_RETRY_RECENT_DAYS || 45),
  tx = db,
}: {
  batchSize?: number
  retryDelayMinutes?: number
  recentDays?: number
  tx?: any
} = {}) => {
  const orders = await getSalesChannelSyncCandidates({
    batchSize,
    retryDelayMinutes,
    recentDays,
    tx,
  })

  const summary = {
    checked: orders.length,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  }

  for (const order of orders) {
    const channel = detectSalesChannel(order)
    if (!channel) {
      summary.skipped += 1
      continue
    }

    try {
      const result = await syncSalesChannelStatusForLocalOrder(order, {
        source: 'retry-cron',
        tx,
      })

      if (result?.attempted === false) {
        summary.skipped += 1
        continue
      }

      summary.attempted += 1
      if (result?.success === false) {
        summary.failed += 1
      } else {
        summary.succeeded += 1
      }
    } catch (err: any) {
      summary.attempted += 1
      summary.failed += 1
      await recordSalesChannelSyncOutcome(
        order,
        {
          channel,
          status: 'failed',
          source: 'retry-cron',
          error: err,
        },
        tx,
      )
      console.warn(`${channelLabel[channel]} status sync failed during retry cron:`, err?.message || err)
    }
  }

  return summary
}
