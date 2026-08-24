import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  adminChangePasswordController,
  adminLoginController,
  googleOAuthLogin,
  logoutController,
  //   loginController,
  //   logoutController,
  refreshTokenController,
  requestEmailVerification,
  requestOtp,
  verifyEmailToken,
  verifyOtp,
} from '../controllers/authController'
import { isAdminMiddleware } from '../middlewares/isAdmin'
import { requireAuth } from '../middlewares/requireAuth'

const router = Router()

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again later.',
    }),
})

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again later.',
    }),
})

router.post('/admin/login', adminLoginLimiter, adminLoginController)
router.post('/admin/change-password', requireAuth, isAdminMiddleware, adminChangePasswordController)

router.post('/request-otp', authenticationLimiter, requestOtp)
router.post('/verify-otp', authenticationLimiter, verifyOtp)

router.post('/request-password-login', authenticationLimiter, requestEmailVerification)

router.post('/verify-user-email', authenticationLimiter, verifyEmailToken)
router.post('/signin-with-google', authenticationLimiter, googleOAuthLogin)

// router.post("/login", loginController);
router.post('/refresh-token', refreshTokenController) // ✅ No auth needed - uses refresh token
router.post('/logout', logoutController) // ✅ Logout should work even if access token expired

export default router
