import { eq } from 'drizzle-orm'
import { db, pool } from '../models/client'
import { stores } from '../models/schema/stores'
import {
  encryptShopifyStoreMetadata,
  encryptShopifyToken,
} from '../utils/shopifyTokenEncryption'

const SHOPIFY_PLATFORM_ID = 1

const run = async () => {
  const shopifyStores = await db.select().from(stores).where(eq(stores.platformId, SHOPIFY_PLATFORM_ID))
  let updated = 0

  for (const store of shopifyStores) {
    const accessToken = encryptShopifyToken(store.adminApiAccessToken)
    if (accessToken.length > 255) {
      throw new Error(`Encrypted Shopify access token exceeds the stores column limit for ${store.id}`)
    }

    const metadata = encryptShopifyStoreMetadata(
      store.metadata && typeof store.metadata === 'object' ? store.metadata : {},
    )
    if (accessToken === store.adminApiAccessToken && JSON.stringify(metadata) === JSON.stringify(store.metadata)) {
      continue
    }

    await db
      .update(stores)
      .set({ adminApiAccessToken: accessToken, metadata, updatedAt: new Date() })
      .where(eq(stores.id, store.id))
    updated += 1
  }

  console.log(`Shopify token encryption migration complete: ${updated}/${shopifyStores.length} stores updated`)
}

run()
  .catch((error) => {
    console.error('Shopify token encryption migration failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
