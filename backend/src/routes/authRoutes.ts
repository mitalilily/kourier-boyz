import { Router } from 'express'
import {
  changePassword,
  forgotPassword,
  forgotPasswordViaPhone,
  forgotPasswordViaEmail,
  resendPasswordResetOtp,
  resendProfilePhoneOTP,
  getProfile,
  getTwoFactorStatus,
  getVerificationStatus,
  googleOAuth,
  login,
  logout,
  refresh,
  register,
  resendPhoneCode,
  resendVerificationEmail,
  resetPassword,
  sendLoginOTP,
  sendUpdateOTP,
  updateProfile,
  activateTwoFactor,
  disableTwoFactor,
  initiateTwoFactorSetup,
  regenerateTwoFactorBackupCodes,
  sendTwoFactorLoginCode,
  verifyTwoFactorLogin,
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getPasskeyAuthenticationOptions,
  verifyPasskeyLogin,
  removePasskey,
  verifyEmail,
  verifyLoginOTP,
  verifyPhone,
} from '../controllers/authController'
import {
  confirmBuyerDeactivation,
  getBuyerDeactivationStatus,
  reactivateBuyer,
  requestBuyerDeactivation,
} from '../controllers/buyerDeactivationController'
import { protect } from '../middlewares/authMiddleware'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/google', googleOAuth)
router.post('/refresh', refresh)
router.post('/logout', logout)
router.get('/verify-email/:token', verifyEmail)
router.post('/verify-phone', verifyPhone)
router.post('/resend-verification', resendVerificationEmail)
router.post('/resend-phone-code', resendPhoneCode)
router.post('/send-login-otp', sendLoginOTP)
router.post('/verify-login-otp', verifyLoginOTP)
router.post('/forgot-password', forgotPassword)
router.post('/forgot-password/phone', forgotPasswordViaPhone)
router.post('/forgot-password/phone/resend', resendPasswordResetOtp)
router.post('/forgot-password/email', forgotPasswordViaEmail)
router.post('/reset-password', resetPassword)
router.get('/verification-status/:userId', getVerificationStatus)
router.post('/2fa/verify-login', verifyTwoFactorLogin)
router.post('/2fa/send-login-code', sendTwoFactorLoginCode)
router.post('/passkeys/authentication/options', getPasskeyAuthenticationOptions)
router.post('/passkeys/authentication/verify', verifyPasskeyLogin)

// Protected routes (require authentication)
router.use(protect)
router.get('/profile', getProfile)
router.post('/profile/send-otp', sendUpdateOTP)
router.post('/profile/resend-phone-otp', resendProfilePhoneOTP)
router.put('/profile', updateProfile)
router.put('/change-password', changePassword)
router.get('/2fa/status', getTwoFactorStatus)
router.post('/2fa/setup', initiateTwoFactorSetup)
router.post('/2fa/activate', activateTwoFactor)
router.post('/2fa/backup-codes', regenerateTwoFactorBackupCodes)
router.post('/2fa/disable', disableTwoFactor)
router.get('/passkeys/register/options', getPasskeyRegistrationOptions)
router.post('/passkeys/register/verify', verifyPasskeyRegistration)
router.delete('/passkeys/:passkeyId', removePasskey)

// Buyer deactivation routes
router.post('/buyer/deactivation/request', requestBuyerDeactivation)
router.post('/buyer/deactivation/confirm', confirmBuyerDeactivation)
router.post('/buyer/reactivate', reactivateBuyer)
router.get('/buyer/deactivation/status', getBuyerDeactivationStatus)

export default router
