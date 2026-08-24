import { Router } from "express";
import {
  integrateMagentoStore,
  integrateShopifyStore,
  integrateWixStore,
  integrateWooCommerceStore,
} from "../controllers/platformIntegration.controller";
import {
  connectConfiguredShopifyStoreController,
  exchangeShopifyBootstrapController,
  exchangeShopifySessionController,
  publicStartShopifyOAuthController,
  shopifyInstallAuditController,
  shopifyOAuthCallbackController,
  shopifyOAuthInstallController,
  startShopifyOAuthController,
  syncShopifyOrdersController,
  testShopifyConnectionController,
  uninstallShopifyStoreController,
  updateShopifySettingsController,
} from '../controllers/shopify.controller'
import { syncWooCommerceOrdersController } from '../controllers/woocommerce.controller'
import {
  cancelAmazonShipmentController,
  getAmazonAccessPointsController,
  getAmazonAdditionalInputsController,
  getAmazonRatesController,
  getAmazonShipmentDocumentsController,
  oneClickAmazonShipmentController,
  purchaseAmazonShipmentController,
  submitAmazonNdrFeedbackController,
  trackAmazonShipmentController,
} from '../controllers/amazonShipping.controller'
import { requireAuth } from '../middlewares/requireAuth'
import { deleteStoreById } from "../models/services/PlatformIntegration.service";

const router = Router();

router.get('/shopify/oauth/callback', shopifyOAuthCallbackController)
router.get('/shopify/oauth/install', shopifyOAuthInstallController)
router.post('/shopify/oauth/public/start', publicStartShopifyOAuthController)
router.post('/shopify/oauth/bootstrap', exchangeShopifyBootstrapController)
router.post('/shopify/oauth/session', exchangeShopifySessionController)
router.post('/shopify/oauth/audit', shopifyInstallAuditController)

router.use(requireAuth)

router.post('/shopify/oauth/start', startShopifyOAuthController)
router.post("/shopify-auth", integrateShopifyStore);
router.get('/shopify/test-connection', testShopifyConnectionController)
router.post('/shopify/connect-env', connectConfiguredShopifyStoreController)
router.put('/shopify/settings', updateShopifySettingsController)
router.post('/shopify/settings', updateShopifySettingsController)
router.post('/shopify/sync-orders', syncShopifyOrdersController)
router.delete('/shopify/stores/:storeId', uninstallShopifyStoreController)
router.post("/woocommerce-auth", integrateWooCommerceStore);
router.post('/woocommerce/sync-orders', syncWooCommerceOrdersController)
router.post("/magento-auth", integrateMagentoStore);
router.post("/wix-auth", integrateWixStore);
router.delete("/stores/:storeId", deleteStoreById);
router.post('/amazon-shipping/rates', getAmazonRatesController)
router.post('/amazon-shipping/shipments', purchaseAmazonShipmentController)
router.post('/amazon-shipping/one-click-shipment', oneClickAmazonShipmentController)
router.post('/amazon-shipping/oneClickShipment', oneClickAmazonShipmentController)
router.get('/amazon-shipping/tracking', trackAmazonShipmentController)
router.post('/amazon-shipping/tracking', trackAmazonShipmentController)
router.get('/amazon-shipping/shipments/:shipmentId/documents', getAmazonShipmentDocumentsController)
router.post('/amazon-shipping/shipments/:shipmentId/documents', getAmazonShipmentDocumentsController)
router.put('/amazon-shipping/shipments/:shipmentId/cancel', cancelAmazonShipmentController)
router.post('/amazon-shipping/shipments/:shipmentId/cancel', cancelAmazonShipmentController)
router.get('/amazon-shipping/access-points', getAmazonAccessPointsController)
router.post('/amazon-shipping/access-points', getAmazonAccessPointsController)
router.get('/amazon-shipping/accessPoints', getAmazonAccessPointsController)
router.post('/amazon-shipping/accessPoints', getAmazonAccessPointsController)
router.post('/amazon-shipping/ndr-feedback', submitAmazonNdrFeedbackController)
router.post('/amazon-shipping/ndrFeedback', submitAmazonNdrFeedbackController)
router.get('/amazon-shipping/additional-inputs/schema', getAmazonAdditionalInputsController)
router.post('/amazon-shipping/additional-inputs/schema', getAmazonAdditionalInputsController)

export default router;
