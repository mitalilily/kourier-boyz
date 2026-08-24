import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import http from 'http'
import path from 'path'
import { randomUUID } from 'crypto'
import { corsOriginCallback } from './config/cors'
import {
  delhiveryDocumentPushHandler,
  delhiveryScanPushHandler,
  delhiveryWebhookHandler,
} from './controllers/webhooks/delhivery.webhook'
import { ekartWebhookHandler } from './controllers/webhooks/ekart.webhook'
import { xpressbeesWebhookHandler } from './controllers/webhooks/xpressbees.webhook'
import {
  shopifyAppUninstalledWebhookController,
  shopifyComplianceWebhookController,
  shopifyOrderWebhookController,
} from './controllers/shopify.controller'
import { wooCommerceOrderWebhookController } from './controllers/woocommerce.controller'
import adminCourierRoutes from './routes/adminRoutes/adminCourier.routes'
import adminSupportRoutes from './routes/adminRoutes/adminSupport.routes'
import adminUserRoutes from './routes/adminRoutes/adminUser.routes'
import adminWalletRoutes from './routes/adminRoutes/adminWallet.routes'
import b2bAdminRoutes from './routes/adminRoutes/b2b.routes'
import adminBillingInvoiceRoutes from './routes/adminRoutes/billingInvoice.admin.routes'
import adminBillingPreferencesRoutes from './routes/adminRoutes/billingPreferences.admin.routes'
import adminCodRemittanceRoutes from './routes/adminRoutes/codRemittance.admin.routes'
import adminDeveloperRoutes from './routes/adminRoutes/developer.routes'
import locationRoutes from './routes/adminRoutes/location.routes'
import adminOrderRoutes from './routes/adminRoutes/order.routes'
import adminPaymentOptionsRoutes from './routes/adminRoutes/paymentOptions.admin.routes'
import planRoutes from './routes/adminRoutes/plan.routes'
import adminWeightReconciliationRoutes from './routes/adminRoutes/weightReconciliation.admin.routes'
import zoneRoutes from './routes/adminRoutes/zone.routes'
import authRoutes from './routes/authRoutes'
import bankAccountRoutes from './routes/bank.routes'
import billingInvoiceRoutes from './routes/billingInvoice.routes'
import billingPreferencesRoutes from './routes/billingPreferences.routes'
import blogRoutes from './routes/blogs.routes'
import codRemittanceRoutes from './routes/codRemittance.routes'
import courierRoutes from './routes/courier.routes'
import courierPriorityRoutes from './routes/courierPriority.routes'
import dashboardRoutes from './routes/dashboard.routes'
import employeeRoutes from './routes/employee.routes'
import externalApiRoutes from './routes/externalApi.routes'
import globalSearchRoutes from './routes/globalSearch.routes'
import ftlRequestRoutes from './routes/ftlRequest.routes'
import integrationRoutes from './routes/integrationRoutes'
import innofulfillRoutes from './routes/innofulfill.routes'
import internationalShipmentRoutes from './routes/internationalShipment.routes'
import invoicesRoutes from './routes/invoice.routes'
import invoicePreferencesRoutes from './routes/invoicePreferences.routes'
import labelRoutes from './routes/labelPreferences.routes'
import ndrRoutes from './routes/ndr.routes'
import notificationRoutes from './routes/notifications.routes'
import orderRoutes from './routes/order.routes'
import paymentOptionsRoutes from './routes/paymentOptions.routes'
import pickupRoutes from './routes/pickup.routes'
import pickupAddressesRoutes from './routes/pickupAddresses.route'
import returnsRoutes from './routes/returns.routes'
import rtoRoutes from './routes/rto.routes'
import staticPagesRoutes from './routes/staticPages.routes'
import supportRoutes from './routes/support.routes'
import uploadRoutes from './routes/upload.route'
import profileRoutes from './routes/userProfileRoutes'
import reportsRoutes from './routes/reports.routes'
import publicToolsRoutes from './routes/publicTools.routes'
import userRoutes from './routes/userRoutes'
import walletRoutes from './routes/walletRoutes'
import weightReconciliationRoutes from './routes/weightReconciliation.routes'

// Routes imports
// import other routes here...
// Determine environment
const env = process.env.NODE_ENV || 'development'

// Load correct .env file
dotenv.config({ path: path.resolve(__dirname, `../.env.${env}`) })

const app = express()
const server = http.createServer(app) // ✅ HTTP server for socket.io

if (env === 'production') {
  app.set('trust proxy', 1)
}

app.use(helmet())

const normalizeJsonCharsetHeader = (contentType: string) =>
  contentType.replace(/charset=([^;]+)/i, (_match, charset) => `charset=${String(charset).trim().toLowerCase()}`)

app.use((req: any, res, next) => {
  const startedAt = process.hrtime.bigint()
  const requestId = randomUUID()
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    if (durationMs >= 1000 || res.statusCode >= 500) {
      console.log('[HTTP]', {
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      })
    }
  })

  next()
})

app.use(cookieParser())

app.use((req, _res, next) => {
  const contentType = req.headers['content-type']
  if (typeof contentType === 'string' && /application\/json/i.test(contentType) && /charset=/i.test(contentType)) {
    req.headers['content-type'] = normalizeJsonCharsetHeader(contentType)
  }
  next()
})

app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
    exposedHeaders: [
      'Content-Disposition',
      'X-Request-Id',
      'X-Kourier-Boyz-Archive-Name',
      'X-Kourier-Boyz-Requested-Count',
      'X-Kourier-Boyz-Document-Count',
      'X-Kourier-Boyz-Missing-Count',
      'X-Kourier-Boyz-Deduplicated-Count',
    ],
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    environment: env,
    timestamp: new Date().toISOString(),
  })
})

// Shopify webhooks require raw body for HMAC verification
app.post('/api/webhooks/shopify/order-created', express.raw({ type: 'application/json' }), shopifyOrderWebhookController)
app.post('/api/webhooks/shopify/compliance', express.raw({ type: 'application/json' }), shopifyComplianceWebhookController)
app.post(
  '/api/webhooks/shopify/app-uninstalled',
  express.raw({ type: 'application/json' }),
  shopifyAppUninstalledWebhookController,
)
app.post('/api/webhook/shopify/orders', express.raw({ type: 'application/json' }), shopifyOrderWebhookController)
app.post('/api/webhook/shopify/compliance', express.raw({ type: 'application/json' }), shopifyComplianceWebhookController)
app.post('/api/webhook/woocommerce/orders', express.raw({ type: 'application/json' }), wooCommerceOrderWebhookController)

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8')
    },
  }),
)
app.use(express.urlencoded({ extended: true }))

app.use('/api/user', userRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/innofulfill', innofulfillRoutes)
app.use('/api/integrations', integrationRoutes)
app.use('/api/payments', walletRoutes)
app.use('/api/uploads', uploadRoutes)
app.use('/api/bank-account', bankAccountRoutes)
app.use('/api/pickup-addresses', pickupAddressesRoutes)
app.use('/api', pickupRoutes)
app.use('/api', returnsRoutes)
app.use('/api/couriers', courierRoutes)
app.use('/api/courier', courierPriorityRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/admin', adminSupportRoutes)
app.use('/api/admin/users', adminUserRoutes)
app.use('/api/admin/orders', adminOrderRoutes)
app.use('/api/admin/developer', adminDeveloperRoutes)
app.use('/api/admin/couriers', adminCourierRoutes)
app.use('/api/admin/zones', zoneRoutes)
app.use('/api/admin/b2b', b2bAdminRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api', invoicePreferencesRoutes)
app.use('/api', invoicesRoutes)
app.use('/api', billingInvoiceRoutes)
app.use('/api', adminBillingInvoiceRoutes)
app.use('/api/blogs', blogRoutes)
app.use('/api/static-pages', staticPagesRoutes)
app.use('/api/public', publicToolsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/search', globalSearchRoutes)
app.use('/api', ftlRequestRoutes)
app.use('/api', internationalShipmentRoutes)
app.use('/api/serviceability', locationRoutes)
app.use('/api/user-management', employeeRoutes)
app.use('/api/label-preference', labelRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/billing-preferences', billingPreferencesRoutes)
app.use('/api/cod-remittance', codRemittanceRoutes)
app.use('/api/admin/cod-remittance', adminCodRemittanceRoutes)
app.use('/api/admin/weight-reconciliation', adminWeightReconciliationRoutes)
app.use('/api/admin/wallets', adminWalletRoutes)
app.use('/api/admin/payment-options', adminPaymentOptionsRoutes)
app.use('/api/admin/billing-preferences', adminBillingPreferencesRoutes)
app.use('/api/payment-options', paymentOptionsRoutes)
app.use('/api/weight-reconciliation', weightReconciliationRoutes)
app.use('/api', ndrRoutes)
app.use('/api', rtoRoutes)
app.use('/api/v1', externalApiRoutes)
// Ekart webhook
app.post('/api/webhook/ekart', express.json(), ekartWebhookHandler)
app.post('/api/webhook/ekart/track', express.json(), ekartWebhookHandler)
app.post(
  '/api/webhook/xpressbees',
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8')
    },
  }),
  xpressbeesWebhookHandler,
)
app.post(
  '/api/webhook/xpressbees/track',
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString('utf8')
    },
  }),
  xpressbeesWebhookHandler,
)
// Delhivery webhooks - separate endpoints for Scan Push and Document Push
app.post('/api/webhook/delhivery/scan', express.json(), delhiveryScanPushHandler) // Scan Push (Status Updates)
app.post('/api/webhook/delhivery/document', express.json(), delhiveryDocumentPushHandler) // Document Push (POD, Sorter Image, QC Image)
// Legacy unified endpoint (auto-detects type) - kept for backward compatibility
app.post('/api/webhook/delhivery/order', express.json(), delhiveryWebhookHandler)

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl || req.url,
  })
})

app.use((err: any, req: any, res: any, next: any) => {
  if (res.headersSent) {
    return next(err)
  }

  const statusCode =
    err?.message?.startsWith('Not allowed by CORS')
      ? 403
      : typeof err?.statusCode === 'number'
        ? err.statusCode
        : 500

  console.error('❌ Unhandled request error', {
    requestId: req?.requestId ?? null,
    method: req?.method,
    path: req?.originalUrl || req?.url,
    statusCode,
    message: err?.message || String(err),
    stack: err?.stack,
  })

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : err?.message || 'Request failed',
    requestId: req?.requestId ?? null,
  })
})

export { app, server } // ✅ named exports
