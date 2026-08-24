import { Router } from 'express'
import {
  getDeveloperErrorLogsController,
  getDeveloperLiveLogsController,
  getShopifyOAuthCredentialsController,
  retryDeveloperManifestController,
  updateShopifyOAuthCredentialsController,
  updateDeveloperIssueStateController,
} from '../../controllers/admin/developer.controller'
import { isAdminMiddleware } from '../../middlewares/isAdmin'
import { requireAuth } from '../../middlewares/requireAuth'

const router = Router()

router.get('/error-logs', requireAuth, isAdminMiddleware, getDeveloperErrorLogsController)
router.get('/live-logs', requireAuth, isAdminMiddleware, getDeveloperLiveLogsController)
router.get(
  '/shopify-oauth-credentials',
  requireAuth,
  isAdminMiddleware,
  getShopifyOAuthCredentialsController,
)
router.put(
  '/shopify-oauth-credentials',
  requireAuth,
  isAdminMiddleware,
  updateShopifyOAuthCredentialsController,
)
router.patch('/issues/:issueKey', requireAuth, isAdminMiddleware, updateDeveloperIssueStateController)
router.post('/retry-manifest', requireAuth, isAdminMiddleware, retryDeveloperManifestController)

export default router
