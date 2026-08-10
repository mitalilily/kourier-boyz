import express from 'express'
import {
  createRole,
  deleteRole,
  getAllRoles,
  getRoleById,
  getRoleUsers,
  updateRole,
} from '../controllers/roleController'
import { protect, requirePermission } from '../middlewares/authMiddleware'

const router = express.Router()

// All routes require authentication
router.use(protect)

// Permission-based access for role management
router.get('/', requirePermission('roleManagement', 'view'), getAllRoles)
router.get('/:id', requirePermission('roleManagement', 'view'), getRoleById)
router.post('/', requirePermission('roleManagement', 'create'), createRole)
router.put('/:id', requirePermission('roleManagement', 'update'), updateRole)
router.delete('/:id', requirePermission('roleManagement', 'delete'), deleteRole)
router.get('/:id/users', requirePermission('roleManagement', 'view'), getRoleUsers)

export default router


