import { Router } from 'express'
import { adminLogin, logout, refreshAdmin } from '../controllers/authController'

const router = Router()

router.post('/refresh', refreshAdmin)
router.post('/login', adminLogin)
router.post('/logout', logout)

export default router
