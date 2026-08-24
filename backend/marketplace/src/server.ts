import './database/postgresMongoose'
import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import mongoose from 'mongoose'
import { Server as SocketIOServer } from 'socket.io'
import { processScheduledPromotionalEmails } from './controllers/promotionalEmail.controller'
import { errorHandler } from './middlewares/errorHandler'
import Product from './models/Product'
import addressRoutes from './routes/addressRoutes'
import adminAuthRoutes from './routes/adminAuthRoutes'
import adminBrandRoutes from './routes/adminBrandRoutes'
import adminCategoryExtensionRoutes from './routes/adminCategoryExtensionRoutes'
import adminDashboardRoutes from './routes/adminDashboardRoutes'
import adminOrderRoutes from './routes/adminOrderRoutes'
import adminPaymentRoutes from './routes/adminPaymentRoutes'
import adminProductRoutes from './routes/adminProductRoutes'
import adminProfileRoutes from './routes/adminProfileRoutes'
import adminReportRoutes from './routes/adminReportRoutes'
import adminSellerCouponRoutes from './routes/adminSellerCouponRoutes'
import adminSellerDeactivationRoutes from './routes/adminSellerDeactivationRoutes'
import adminSettingsRoutes from './routes/adminSettingsRoutes'
import adminSettlementRoutes from './routes/adminSettlementRoutes'
import agreementRoutes from './routes/agreementRoutes'
import announcementRoutes from './routes/announcementRoutes'
import authRoutes from './routes/authRoutes'
import bannerRoutes from './routes/bannerRoutes'
import blogRoutes from './routes/blogRoutes'
import brandRoutes from './routes/brandRoutes'
import cartRoutes from './routes/cartRoutes'
import categoryRequestRoutes from './routes/categoryRequestRoutes'
import categoryRoutes from './routes/categoryRoutes'
import certificateRoutes, {
    adminCertificateRoutes,
    getCertificateTypes,
} from './routes/certificateRoutes'
import contactFormRoutes from './routes/contactFormRoutes'
import couponRoutes from './routes/couponRoutes'
import customerRoutes from './routes/customerRoutes'
import feedbackRoutes from './routes/feedbackRoutes'
import fileRoutes from './routes/fileRoutes'
import notificationRoutes from './routes/notificationRoutes'
import orderRoutes from './routes/orderRoutes'
import paymentRoutes from './routes/paymentRoutes'
import productRoutes from './routes/productRoutes'
import promotionalEmailRoutes from './routes/promotionalEmailRoutes'
import publicProductRoutes from './routes/publicProductRoutes'
import publicSellerRoutes from './routes/publicSellerRoutes'
import returnRoutes from './routes/returnRoutes'
import roleRoutes from './routes/roleRoutes'
import searchRoutes from './routes/searchRoutes'
import sellerAuthRoutes from './routes/sellerAuthRoutes'
import sellerCouponRoutes from './routes/sellerCouponRoutes'
import sellerDashboardRoutes from './routes/sellerDashboardRoutes'
import sellerDeactivationRoutes from './routes/sellerDeactivationRoutes'
import sellerOrderRoutes from './routes/sellerOrderRoutes'
import sellerReturnRoutes from './routes/sellerReturnRoutes'
import sellerReviewRoutes from './routes/sellerReviewRoutes'
import sellerSettlementRoutes from './routes/sellerSettlementRoutes'
import sellerSizeChartRoutes from './routes/sellerSizeChartRoutes'
import sizeChartRoutes from './routes/sizeChartRoutes'
import slaReminderRoutes from './routes/slaReminderRoutes'
import subscriberRoutes from './routes/subscriberRoutes'
import supportArticleRoutes from './routes/supportArticleRoutes'
import supportChatRoutes from './routes/supportChatRoutes'
import ticketRoutes from './routes/ticketRoutes'
import trackingRoutes from './routes/trackingRoutes'
import userRoutes from './routes/userRoutes'
import webhookRoutes from './routes/webhookRoutes'
import wishlistRoutes from './routes/wishlistRoutes'
import { initializeAnnouncementScheduler, setIOInstance } from './services/announcementScheduler'
import { fiveMinuteCache } from './utils/cache'

dotenv.config()

export const app = express()
export const server = http.createServer(app)
app.set('trust proxy', 1)

const localOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:3000',
]

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const allowedOrigins = [...localOrigins, ...configuredOrigins]

export let io: SocketIOServer
let marketplaceSocketHandlersRegistered = false

export const attachMarketplaceSocketServer = (
  targetServer: http.Server,
  existingSocketServer?: SocketIOServer,
) => {
  io =
    existingSocketServer ||
    new SocketIOServer(targetServer, {
      cors: {
        origin: allowedOrigins,
      },
    })

  setIOInstance(io)
  if (!marketplaceSocketHandlersRegistered) {
    marketplaceSocketHandlersRegistered = true
    io.on('connection', (socket) => {
      socket.on('register', (payload: { role?: string; userId?: string } | string) => {
        if (!payload || typeof payload !== 'object') return
        try {
          if (payload.role === 'super-admin') socket.join('super-admin')
          if (payload.userId) socket.join(`user:${payload.userId}`)
        } catch {
          // A failed room registration must not terminate the socket connection.
        }
      })
    })
  }
  return io
}

// CORS configuration - Allow frontend, admin panel, seller panel, and tracking frontend
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)




app.use(
  express.json({
    // Increased limit to allow base64-encoded images for returns, reviews, etc.
    // Keep reasonable to avoid excessive payloads.
    limit: '15mb',
    verify: (req, _res, buffer) => {
      ;(req as any).rawBody = buffer
    },
  }),
)
// Note: Static uploads route removed - now using Cloudflare R2 for file storage

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/admin/auth', adminAuthRoutes)
app.use('/api/admin/profile', adminProfileRoutes)
app.use('/api/seller/auth', sellerAuthRoutes)
app.use('/api/seller/dashboard', sellerDashboardRoutes)
app.use('/api/seller/products', productRoutes)
app.use('/api/seller/reviews', sellerReviewRoutes)
app.use('/api/seller/customers', customerRoutes)
app.use('/api/seller/certificates', certificateRoutes)
app.use('/api/seller/brands', brandRoutes)
app.use('/api/seller/coupons', sellerCouponRoutes) // Must be before /api/seller to avoid route conflict
app.use('/api/seller/orders', sellerOrderRoutes)
app.use('/api/seller/settlements', sellerSettlementRoutes)
app.use('/api/seller/deactivation', sellerDeactivationRoutes)
app.use('/api/seller/size-charts', sellerSizeChartRoutes)
app.use('/api/admin/products', adminProductRoutes)
app.use('/api/admin/brands', adminBrandRoutes)
app.use('/api/admin/category-extensions', adminCategoryExtensionRoutes)
app.use('/api/admin/orders', adminOrderRoutes)
app.use('/api/admin/payments', adminPaymentRoutes)
app.use('/api/admin/settings', adminSettingsRoutes)
app.use('/api/admin/settlements', adminSettlementRoutes)
app.use('/api/admin/dashboard', adminDashboardRoutes)
app.use('/api/admin/reports', adminReportRoutes)
app.use('/api/sla', slaReminderRoutes)
// Mount seller return routes at /api/seller (separate router to avoid route conflicts)
app.use('/api/seller', sellerReturnRoutes)
// Mount customer/admin return routes at /api
app.use('/api', returnRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/category-requests', categoryRequestRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/admin/sellers', userRoutes)
app.use('/api/admin/users', userRoutes) // Also mount for buyer routes
app.use('/api/admin/sellers/deactivation', adminSellerDeactivationRoutes)
app.use('/api/admin/roles', roleRoutes)
app.use('/api/agreements', agreementRoutes)
app.use('/api/banners', bannerRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/blogs', blogRoutes)
app.use('/api/support/articles', supportArticleRoutes)
app.use('/api/support/chat', supportChatRoutes)
app.use('/api/support/tickets', ticketRoutes)
app.use('/api/support/contact', contactFormRoutes)
app.use('/api/products', publicProductRoutes)
app.use('/api/seller', publicSellerRoutes) // Public seller microsite routes (must be after specific routes)
app.use('/api/wishlist', wishlistRoutes)
app.use('/api/feedback', feedbackRoutes)
app.use('/api/addresses', addressRoutes)
app.use('/api/cart', cartRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/tracking', trackingRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/coupons', couponRoutes)
app.use('/api/admin/seller-coupons', adminSellerCouponRoutes)
app.use('/api/webhooks', webhookRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/promotional-emails', promotionalEmailRoutes)
app.use('/api/subscribers', subscriberRoutes)
// Public certificate types endpoint (accessible from both admin and seller)
app.get('/api/certificates/types', getCertificateTypes)
app.use('/api/admin/certificates', adminCertificateRoutes)
app.use('/api/size-charts', sizeChartRoutes)
app.use('/api', searchRoutes)

// Error handler (must be last)
app.use(errorHandler)

const PORT = process.env.PORT || 5004

type MarketplaceRuntimeOptions = {
  listen?: boolean
  socketServer?: SocketIOServer
  httpServer?: http.Server
}

export const startMarketplaceRuntime = async (options: MarketplaceRuntimeOptions = {}) => {
    await mongoose.connect(process.env.DATABASE_URL!)
    console.log('Marketplace PostgreSQL storage connected')
    const targetServer = options.httpServer || server
    attachMarketplaceSocketServer(targetServer, options.socketServer)
    if (options.listen !== false) {
      targetServer.listen(PORT, () => console.log(`Server running on port ${PORT}`))
    }

    // Auto-close inactive chats every hour
    const { autoCloseInactiveChats } = require('./controllers/supportChat.controller')
    setInterval(async () => {
      await autoCloseInactiveChats()
    }, 60 * 60 * 1000) // Run every hour
    console.log('Auto-close inactive chats task scheduled (runs every hour)')

    const { runCertificateExpiryChecks } = require('./utils/certificateExpiry')
    const {
      runSettlementEligibilitySweep,
      generateSettlementBatchesForAllSellers,
    } = require('./services/settlement.service')
    const { runReverseReturnTrackingSweep } = require('./services/returnTracking.service')
    const runExpiryCheckSafely = async () => {
      const startTime = Date.now()
      try {
        console.log(
          '[Certificate Expiry Job] Starting certificate expiry check at',
          new Date().toISOString(),
        )
        await runCertificateExpiryChecks()
        const duration = Date.now() - startTime
        console.log(
          `[Certificate Expiry Job] Completed successfully in ${duration}ms at`,
          new Date().toISOString(),
        )
      } catch (err) {
        const duration = Date.now() - startTime
        console.error(
          `[Certificate Expiry Job] Error during certificate expiry check (took ${duration}ms):`,
          err,
        )
        // Log stack trace for debugging
        if (err instanceof Error) {
          console.error('[Certificate Expiry Job] Stack trace:', err.stack)
        }
      }
    }
    // Run once on startup (with a small delay to ensure DB is ready)
    setTimeout(() => {
      console.log('[Certificate Expiry Job] Running initial check on startup...')
      void runExpiryCheckSafely()
    }, 10000) // 10 second delay
    // Schedule to run every 6 hours (more frequent than daily to catch expiries sooner)
    // This ensures certificates that expire are caught within 6 hours
    const EXPIRY_CHECK_INTERVAL = 6 * 60 * 60 * 1000 // 6 hours in milliseconds
    setInterval(runExpiryCheckSafely, EXPIRY_CHECK_INTERVAL)
    console.log(
      `[Certificate Expiry Job] Scheduled to run every ${
        EXPIRY_CHECK_INTERVAL / (60 * 60 * 1000)
      } hours`,
    )

    const runSettlementSweepSafely = async () => {
      try {
        const result = await runSettlementEligibilitySweep()
        if (result?.updatedCount) {
          console.log(
            `Settlement eligibility sweep updated ${result.updatedCount} order(s) at`,
            new Date().toISOString(),
          )
        }
      } catch (err) {
        console.error('Error during settlement eligibility sweep:', err)
      }
    }

    // Run settlement eligibility once on startup and then daily
    void runSettlementSweepSafely()
    setInterval(runSettlementSweepSafely, 24 * 60 * 60 * 1000)
    console.log('Settlement eligibility sweep scheduled (runs every 24 hours)')

    // Settlement batch generation - runs daily to create settlement batches for eligible orders
    const runSettlementGenerationSafely = async () => {
      try {
        const startTime = Date.now()
        console.log(
          '[Settlement Generation Job] Starting settlement batch generation at',
          new Date().toISOString(),
        )
        const result = await generateSettlementBatchesForAllSellers()
        const duration = Date.now() - startTime
        console.log(
          `[Settlement Generation Job] Generated ${result.createdBatches.length} settlement batch(es) in ${duration}ms at`,
          new Date().toISOString(),
        )
        if (result.createdBatches.length > 0) {
          console.log(
            `[Settlement Generation Job] Created batches for sellers: ${result.createdBatches
              .map((b: { seller: mongoose.Types.ObjectId | string }) => String(b.seller))
              .join(', ')}`,
          )
        }
      } catch (err) {
        console.error('[Settlement Generation Job] Error during settlement batch generation:', err)
        // Log stack trace for debugging
        if (err instanceof Error) {
          console.error('[Settlement Generation Job] Stack trace:', err.stack)
        }
      }
    }

    // Run settlement generation once on startup (with a delay to ensure DB is ready)
    setTimeout(() => {
      console.log('[Settlement Generation Job] Running initial generation on startup...')
      void runSettlementGenerationSafely()
    }, 30000) // 30 second delay to let eligibility sweep run first
    // Schedule to run daily (after eligibility sweep has had time to mark orders as eligible)
    // Run at 2 AM daily (2 hours after midnight to allow eligibility sweep to complete)
    const SETTLEMENT_GENERATION_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    setInterval(runSettlementGenerationSafely, SETTLEMENT_GENERATION_INTERVAL)
    console.log(
      `[Settlement Generation Job] Scheduled to run every ${
        SETTLEMENT_GENERATION_INTERVAL / (60 * 60 * 1000)
      } hours`,
    )

    // SLA Reminder System - Automatic reminders
    const {
      processAutomaticReminders,
      checkAndResolveSLAs,
    } = require('./services/slaReminder.service')
    const { checkAndMarkBreachedSLAs } = require('./utils/slaTrackingHooks')

    const runSLAReminderSafely = async () => {
      try {
        // First, check and resolve SLAs that are no longer eligible
        const resolveResult = await checkAndResolveSLAs()
        if (resolveResult.resolved > 0) {
          console.log(
            `SLA resolution check resolved ${resolveResult.resolved} SLA(s) at`,
            new Date().toISOString(),
          )
        }

        // Mark SLAs as breached if deadline passed
        await checkAndMarkBreachedSLAs()

        // Process automatic reminders
        const reminderResult = await processAutomaticReminders()
        if (reminderResult.sent > 0 || reminderResult.processed > 0) {
          console.log(
            `SLA reminder processing: sent ${reminderResult.sent} reminder(s), processed ${reminderResult.processed} SLA(s) at`,
            new Date().toISOString(),
          )
        }
        if (reminderResult.errors.length > 0) {
          console.error('SLA reminder errors:', reminderResult.errors)
        }
      } catch (err) {
        console.error('Error during SLA reminder processing:', err)
      }
    }
    // Run once on startup (after a short delay to let server fully initialize)
    setTimeout(() => void runSLAReminderSafely(), 60000) // 1 minute delay
    // Schedule to run every 30 minutes
    setInterval(runSLAReminderSafely, 30 * 60 * 1000)
    console.log('SLA reminder system scheduled (runs every 30 minutes)')

    // const runReverseTrackingSafely = async () => {
    //   try {
    //     const result = await runReverseReturnTrackingSweep()
    //     if (result?.updatedCount) {
    //       console.log(
    //         `Reverse return tracking sweep updated ${result.updatedCount} return(s) at`,
    //         new Date().toISOString(),
    //       )
    //     }
    //   } catch (err) {
    //     console.error('Error during reverse return tracking sweep:', err)
    //   }
    // }

    // // Run reverse pickup tracking every 2 hours
    // void runReverseTrackingSafely()
    // setInterval(runReverseTrackingSafely, 2 * 60 * 60 * 1000)
    console.log('Reverse return tracking sweep scheduled (runs every 2 hours)')

    // Schedule promotional email processing (runs every 5 minutes)
    const runScheduledEmailsSafely = async () => {
      try {
        await processScheduledPromotionalEmails()
      } catch (err) {
        console.error('Error in scheduled promotional emails task:', err)
      }
    }
    setInterval(runScheduledEmailsSafely, 5 * 60 * 1000)
    console.log('Scheduled promotional emails check scheduled (runs every 5 minutes)')

    // Initialize announcement scheduler (socket-based, no interval needed)
    initializeAnnouncementScheduler()

    // Payment intent recovery jobs
    const {
      checkStuckPaymentIntents,
      cleanupExpiredPaymentIntents,
      notifyExpiredPaymentIntents,
    } = require('./services/paymentIntentRecovery.service')

    // Check for stuck payment intents (paid but no orders) - runs every 10 minutes
    const runStuckIntentCheckSafely = async () => {
      try {
        const result = await checkStuckPaymentIntents()
        if (result.processed > 0) {
          console.log(
            `[Payment Intent Recovery] Processed ${result.processed} stuck payment intent(s) at`,
            new Date().toISOString(),
          )
        }
      } catch (err) {
        console.error('[Payment Intent Recovery] Error checking stuck intents:', err)
      }
    }
    // Run once on startup (with delay)
    setTimeout(() => {
      void runStuckIntentCheckSafely()
    }, 30000) // 30 second delay
    setInterval(runStuckIntentCheckSafely, 10 * 60 * 1000) // Every 10 minutes
    console.log('[Payment Intent Recovery] Stuck intent check scheduled (runs every 10 minutes)')

    // Cleanup expired payment intents - runs daily
    const runCleanupSafely = async () => {
      try {
        const result = await cleanupExpiredPaymentIntents()
        if (result.deleted > 0) {
          console.log(
            `[Payment Intent Cleanup] Deleted ${result.deleted} expired payment intent(s) at`,
            new Date().toISOString(),
          )
        }
      } catch (err) {
        console.error('[Payment Intent Cleanup] Error cleaning up expired intents:', err)
      }
    }
    // Run once on startup (with delay)
    setTimeout(() => {
      void runCleanupSafely()
    }, 60000) // 1 minute delay
    setInterval(runCleanupSafely, 24 * 60 * 60 * 1000) // Daily
    console.log('[Payment Intent Cleanup] Expired intent cleanup scheduled (runs daily)')

    // Notify users of expired payment intents - runs every 5 minutes
    const runExpirationNotificationSafely = async () => {
      try {
        const result = await notifyExpiredPaymentIntents()
        if (result.notified > 0) {
          console.log(
            `[Payment Intent Expiration] Notified ${result.notified} user(s) of expired intents at`,
            new Date().toISOString(),
          )
        }
      } catch (err) {
        console.error('[Payment Intent Expiration] Error notifying expired intents:', err)
      }
    }
    // Run once on startup (with delay)
    setTimeout(() => {
      void runExpirationNotificationSafely()
    }, 60000) // 1 minute delay
    setInterval(runExpirationNotificationSafely, 5 * 60 * 1000) // Every 5 minutes
    console.log(
      '[Payment Intent Expiration] Expiration notification scheduled (runs every 5 minutes)',
    )

    // Pre-warm suggestion cache
    try {
      const trending = await Product.find({}, { name: 1, soldCount: 1, viewCount: 1 })
        .sort({ soldCount: -1, viewCount: -1 })
        .limit(6)
        .lean()
        .exec()
      const response = {
        products: trending.slice(0, 5).map((p) => p.name),
        categories: [] as string[],
        trending: trending.map((p) => p.name),
      }
      fiveMinuteCache.set('suggest:', response, 300)
      ;['a', 'e', 's'].forEach((letter) => {
        fiveMinuteCache.set(`suggest:${letter}`, response, 300)
      })
      console.log('Search suggestion cache pre-warmed')
    } catch (e) {
      console.warn('Failed to pre-warm suggestion cache', e)
    }
}

if (require.main === module) {
  void startMarketplaceRuntime().catch((error) => {
    console.error('Marketplace backend failed to start', error)
    process.exitCode = 1
  })
}
