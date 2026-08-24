import axios from 'axios'
import { and, eq, sql } from 'drizzle-orm'
import { Request, Response } from 'express'
import { db } from '../client'
import { stores } from '../schema/stores'
import { setUserChannelIntegration } from './userService'

const PLATFORM_API_TIMEOUT_MS = Number(process.env.PLATFORM_API_TIMEOUT_MS || 15000)

export const integrateWithWooCommerce = async (
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
) => {
  try {
    const response = await axios.get(`${storeUrl}/wp-json/wc/v3`, {
      auth: {
        username: consumerKey.trim(),
        password: consumerSecret.trim(),
      },
      timeout: PLATFORM_API_TIMEOUT_MS,
    })

    return {
      storeName: response.data?.name || 'WooCommerce Store',
      url: storeUrl,
    }
  } catch (error: any) {
    console.error('WooCommerce API Error:', error?.response?.data || error.message)
    throw new Error('Failed to connect to WooCommerce store')
  }
}

export const integrateWithMagento = async (storeUrl: string, accessToken: string) => {
  try {
    const response = await axios.get(`${storeUrl}/rest/V1/store/storeViews`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: PLATFORM_API_TIMEOUT_MS,
    })

    return response.data
  } catch (error: any) {
    console.error('Magento API Error:', error?.response?.data || error.message)
    throw new Error('Failed to connect to Magento store')
  }
}

export const integrateWithWix = async (storeUrl: string, accessToken: string): Promise<any> => {
  try {
    const wixApiUrl = `https://www.wixapis.com/stores/v1/products`
    const response = await axios.get(wixApiUrl, {
      headers: {
        Authorization: accessToken,
      },
      timeout: PLATFORM_API_TIMEOUT_MS,
    })
    return response.data
  } catch (error) {
    console.error('Wix API Error:', error)
    throw new Error('Failed to connect to Wix store')
  }
}

export const deleteStoreById = async (req: Request, res: Response): Promise<any> => {
  const { storeId } = req.params
  const userId = (req as any)?.user?.sub

  if (!storeId || !userId) {
    return res.status(400).json({ error: 'Missing store ID' })
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [store] = await tx
        .select({ id: stores.id, platformId: stores.platformId })
        .from(stores)
        .where(and(eq(stores.id, storeId), eq(stores.userId, userId as string)))
        .limit(1)

      if (!store) return { deleted: false, shopifyUninstallRequired: false }
      if (store.platformId === 1) {
        return { deleted: false, shopifyUninstallRequired: true }
      }

      await tx.delete(stores).where(eq(stores.id, store.id))

      const [remaining] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(stores)
        .where(and(eq(stores.userId, userId as string), eq(stores.platformId, store.platformId)))

      await setUserChannelIntegration(
        userId as string,
        store.platformId,
        Number(remaining?.count || 0) > 0,
        tx,
      )

      return { deleted: true, shopifyUninstallRequired: false }
    })

    if (result.shopifyUninstallRequired) {
      return res.status(409).json({
        error: 'Shopify apps must be removed through the Shopify uninstall workflow',
      })
    }

    if (!result.deleted) {
      return res.status(404).json({ error: 'Store not found' })
    }

    res.status(200).json({ message: 'Store deleted successfully' })
  } catch (error) {
    console.error('Failed to delete store:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

export const getStoresByUserId = async (userId: string) => {
  return await db
    .select()
    .from(stores)
    .where(
      and(
        eq(stores.userId, userId),
        sql`not (
          ${stores.platformId} = 1
          and coalesce(${stores.metadata}->'oauth'->>'active', 'true') = 'false'
        )`,
      ),
    )
}
