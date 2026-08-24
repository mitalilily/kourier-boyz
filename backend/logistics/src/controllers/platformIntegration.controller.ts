import { Request, Response } from "express";
import {
  getStoresByUserId,
  integrateWithMagento,
  integrateWithWix,
} from "../models/services/PlatformIntegration.service";
import { connectShopifyStore } from "../models/services/shopify.service";
import { connectWooCommerceStore } from "../models/services/woocommerce.service";
import { updateUserChannelIntegration, upsertStore } from "../models/services/userService";
import { db } from "../models/client";
import { stores, users } from "../schema/schema";
import { eq } from "drizzle-orm";

/**
 * Enum for supported platforms
 */
enum PLATFORMS {
  SHOPIFY = 1,
  WOOCOMMERCE = 2,
  AMAZON = 3,
  MAGENTO = 4,
  WIX,
}

const logIntegrationError = (label: string, error: any) => {
  console.error(label, {
    message: error?.message || String(error),
    status: error?.response?.status,
    shopifyErrors: error?.response?.data?.errors,
  })
}

const resolveIntegrationUserId = async (req: Request, requestedUserId?: string) => {
  const actorUserId = (req as any)?.user?.sub
  const targetUserId = String(requestedUserId || '').trim() || actorUserId

  if (!actorUserId && !targetUserId) return ''
  if (!actorUserId || actorUserId === targetUserId) return targetUserId

  const [actor] = await db.select({ role: users.role }).from(users).where(eq(users.id, actorUserId)).limit(1)
  if (actor?.role !== 'admin') {
    const error: any = new Error('Admin access is required to connect a store for another user')
    error.statusCode = 403
    throw error
  }

  return targetUserId
}

/**
 * Handles Shopify store integration using user-provided credentials
 */
export const integrateShopifyStore = async (
  req: Request,
  res: Response
): Promise<any> => {
  if (String(process.env.SHOPIFY_ALLOW_LEGACY_MANUAL_AUTH || '').toLowerCase() !== 'true') {
    return res.status(410).json({
      success: false,
      error: 'Manual Shopify Admin API token connection is no longer supported. Connect Shopify through OAuth.',
      migrationPath: '/api/integrations/shopify/oauth/start',
    });
  }

  const {
    storeUrl,
    domain,
    apiKey,
    apiSecretKey,
    apiSecret,
    clientSecret,
    adminApiAccessToken,
    accessToken,
    token,
    webhookSecret,
    userId: bodyUserId,
    targetUserId,
    settings,
  } = req.body;
  const normalizedAccessToken = adminApiAccessToken || accessToken || token;
  const normalizedSecret = webhookSecret || apiSecretKey || apiSecret || clientSecret;

  try {
    const userId = await resolveIntegrationUserId(req, targetUserId || bodyUserId);

    if ((!storeUrl && !domain) || !normalizedAccessToken || !userId) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["storeUrl/domain", "adminApiAccessToken/accessToken", "authenticated user"],
      });
    }

    const result = await connectShopifyStore({
      storeUrl: storeUrl ?? domain,
      apiKey,
      apiSecretKey: normalizedSecret,
      webhookSecret: normalizedSecret,
      adminApiAccessToken: normalizedAccessToken,
      userId,
      settings,
    });

    return res.status(200).json({
      message: "Shopify integration successful!",
      data: result.shopifyData,
      store: result.store,
      webhooks: result.webhooks,
      warning: result.warning,
    });
  } catch (error: any) {
    logIntegrationError("Error integrating Shopify:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to integrate Shopify store";

    return res.status(error?.statusCode || 500).json({
      success: false,
      error: message,
      message,
    });
  }
};

export const integrateWooCommerceStore = async (
  req: Request,
  res: Response
): Promise<any> => {
  const {
    storeUrl,
    consumerKey,
    consumerSecret,
    userId: bodyUserId,
    settings,
    webhookSecret,
    targetUserId,
  } = req.body;

  try {
    const userId = await resolveIntegrationUserId(req, targetUserId || bodyUserId);

    if (!storeUrl || !consumerKey || !consumerSecret || !userId) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["storeUrl", "consumerKey", "consumerSecret", "authenticated user"],
      });
    }

    const result = await connectWooCommerceStore({
      storeUrl,
      consumerKey,
      consumerSecret,
      userId,
      settings,
      webhookSecret,
    });

    res.status(200).json({
      message: "WooCommerce integration successful!",
      data: result.wooData,
      store: result.store,
      webhooks: result.webhooks,
      warning: result.warning,
    });
  } catch (error: any) {
    console.error("Error integrating WooCommerce:", error);
    const rawMessage =
      error instanceof Error
        ? error.message
        : "Failed to integrate WooCommerce store";
    const isDatabaseError = /Failed query|insert into|duplicate key|violates|invalid input syntax/i.test(rawMessage);
    const message = isDatabaseError
      ? "Failed to save WooCommerce store. Please retry after refreshing the app."
      : rawMessage;

    res.status(error?.statusCode || (isDatabaseError ? 500 : 400)).json({
      success: false,
      error: message,
      message,
    });
  }
};

export const integrateWixStore = async (req: Request, res: Response) => {
  const { storeUrl, accessToken, userId: bodyUserId } = req.body;
  const userId = (req as any)?.user?.sub || bodyUserId;

  if (!accessToken || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const wixData = await integrateWithWix(storeUrl, accessToken);
    const storeId = `wix_${userId}_${storeUrl}`;

    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);

      if (!existing.length) {
        await upsertStore(
          {
            id: storeId,
            domain: storeUrl,
            name: "Wix Store",
            adminApiAccessToken: accessToken,
          },
          PLATFORMS.WIX,
          userId,
          tx
        );

        const updated = await updateUserChannelIntegration(
          userId,
          PLATFORMS.WIX,
          tx
        );
        if (!updated) throw new Error("Failed to update sales channels");
      }
    });

    res.status(200).json({
      message: "Wix integration successful!",
      data: wixData,
    });
  } catch (error) {
    console.error("Error integrating Wix:", error);
    res.status(500).json({ error: "Failed to integrate Wix store" });
  }
};

export const integrateMagentoStore = async (req: Request, res: Response) => {
  const { storeUrl, accessToken, userId: bodyUserId } = req.body;
  const userId = (req as any)?.user?.sub || bodyUserId;

  if (!storeUrl || !accessToken || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const magentoData = await integrateWithMagento(storeUrl, accessToken);
    const storeId = `magento_${userId}_${storeUrl}`;

    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);

      if (!existing.length) {
        await upsertStore(
          {
            id: storeId,
            domain: storeUrl,
            name: "Magento Store",
            adminApiAccessToken: accessToken,
          },
          PLATFORMS.MAGENTO,
          userId,
          tx
        );

        const updated = await updateUserChannelIntegration(userId, PLATFORMS.MAGENTO, tx);
        if (!updated) throw new Error("Failed to update sales channels");
      }
    });

    res.status(200).json({
      message: "Magento integration successful!",
      data: magentoData,
    });
  } catch (error) {
    console.error("Magento integration error:", error);
    res.status(500).json({ error: "Failed to integrate Magento store" });
  }
};

export const getUserStoreIntegrations = async (
  req: any,
  res: Response
): Promise<any> => {
  const userId = req.user.sub;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const stores = await getStoresByUserId(userId);

    res.status(200).json({
      success: true,
      data: stores,
    });
  } catch (error) {
    console.error("Error fetching store integrations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
