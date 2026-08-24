import { Router } from 'express'
import {
  createFtlRequestController,
  listAdminFtlRequestsController,
  listMyFtlRequestsController,
  updateAdminFtlRequestController,
} from '../controllers/ftlRequest.controller'
import { isAdminMiddleware } from '../middlewares/isAdmin'
import { requireAuth } from '../middlewares/requireAuth'

const router = Router()

router.post('/ftl/requests', requireAuth, createFtlRequestController)
router.get('/ftl/requests', requireAuth, listMyFtlRequestsController)
router.get('/admin/ftl/requests', requireAuth, isAdminMiddleware, listAdminFtlRequestsController)
router.patch('/admin/ftl/requests/:id', requireAuth, isAdminMiddleware, updateAdminFtlRequestController)

export default router
