import { Router } from 'express'
import {
  innofulfillBulkCancelOrdersController,
  innofulfillBulkManifestOrdersController,
  innofulfillCreateInvoiceConfigurationController,
  innofulfillCreateLabelConfigurationController,
  innofulfillCreateEcommOrderController,
  innofulfillCreateHyperlocalOrderController,
  innofulfillCreateOrderController,
  innofulfillDeliveryWebhookController,
  innofulfillDownloadInvoiceController,
  innofulfillDownloadShippingLabelController,
  innofulfillEcommRateCalculationController,
  innofulfillEcommServiceabilityController,
  innofulfillGetOrderController,
  innofulfillListInvoiceConfigurationsController,
  innofulfillListLabelConfigurationsController,
  innofulfillListOrdersController,
  innofulfillLoginController,
  innofulfillRefreshTokenController,
  innofulfillTrackShipmentByAwbController,
} from '../controllers/innofulfill.controller'

const router = Router()

router.post('/auth/login', innofulfillLoginController)
router.post('/auth/refresh-token', innofulfillRefreshTokenController)
router.post('/webhook/delivery', innofulfillDeliveryWebhookController)
router.post('/gateway/serviceability/ecomm', innofulfillEcommServiceabilityController)
router.post(
  '/gateway/ure/api/external/rate-calculation/calculate/v2',
  innofulfillEcommRateCalculationController,
)
router.get('/gateway/booking-service/orders', innofulfillListOrdersController)
router.post('/gateway/booking-service/orders/ecomm', innofulfillCreateEcommOrderController)
router.post('/gateway/booking-service/orders/hyperlocal', innofulfillCreateHyperlocalOrderController)
router.post('/gateway/booking-service/orders', innofulfillCreateOrderController)
router.post('/gateway/booking-service/orders/manifest/bulk', innofulfillBulkManifestOrdersController)
router.post('/gateway/booking-service/orders/cancel/bulk', innofulfillBulkCancelOrdersController)
router.get('/gateway/pdf-generator/label-configs', innofulfillListLabelConfigurationsController)
router.post('/gateway/pdf-generator/label-configs', innofulfillCreateLabelConfigurationController)
router.get('/gateway/pdf-generator/invoice-configs', innofulfillListInvoiceConfigurationsController)
router.post('/gateway/pdf-generator/invoice-configs', innofulfillCreateInvoiceConfigurationController)
router.post('/gateway/pdf-generator/shipping-label', innofulfillDownloadShippingLabelController)
router.get('/gateway/pdf-generator/invoice/:orderId', innofulfillDownloadInvoiceController)
router.get('/gateway/tracking-v2/api/tracking/awb/:awbNumber', innofulfillTrackShipmentByAwbController)
router.get('/gateway/booking-service/orders/details/:orderId', innofulfillGetOrderController)
router.get('/gateway/booking-service/orders/:orderId', innofulfillGetOrderController)

export default router
