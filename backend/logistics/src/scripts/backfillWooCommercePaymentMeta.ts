import * as dotenv from 'dotenv'
import path from 'path'
import { eq } from 'drizzle-orm'
import { db } from '../models/client'
import { stores } from '../models/schema/stores'
import { syncExistingWooCommerceOrdersForUser } from '../models/services/woocommerce.service'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(process.cwd(), `.env.${env}`) })

const WOOCOMMERCE_PLATFORM_ID = 2

const getArg = (name: string) => {
  const prefix = `--${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : ''
}

const main = async () => {
  const userId = getArg('user-id')
  const storeId = getArg('store-id')
  const limit = Number(getArg('limit') || 1000)

  const storeRows = userId
    ? [{ userId, storeId }]
    : await db
        .select({ userId: stores.userId, storeId: stores.id })
        .from(stores)
        .where(eq(stores.platformId, WOOCOMMERCE_PLATFORM_ID))

  const totals = { users: 0, checked: 0, created: 0, updated: 0, skipped: 0, failed: 0 }

  for (const row of storeRows) {
    const result = await syncExistingWooCommerceOrdersForUser(
      row.userId,
      Number.isFinite(limit) ? limit : 1000,
      row.storeId || undefined,
    )
    totals.users += 1
    totals.checked += result.checked
    totals.created += result.created
    totals.updated += result.updated
    totals.skipped += result.skipped
    totals.failed += result.failed
    console.log('WooCommerce existing payment refresh complete', {
      userId: row.userId,
      storeId: row.storeId || 'all',
      result,
    })
  }

  console.log('WooCommerce existing payment refresh totals', totals)
}

main().catch((error) => {
  console.error('WooCommerce existing payment refresh failed:', error)
  process.exit(1)
})
