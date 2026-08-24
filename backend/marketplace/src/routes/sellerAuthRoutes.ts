import { Router } from 'express'
import {
  changePassword,
  forgotPassword,
  getSellerProfile,
  googleOAuthSeller,
  loginSeller,
  logoutSeller,
  markOnboardingTourCompleted,
  refreshSeller,
  registerSeller,
  resendVerificationEmail,
  resetPassword,
  updateSellerProfile,
  updateStoreInfo,
  verifyEmail,
} from '../controllers/sellerAuthController'
import { saveKYCDraft } from '../controllers/kycDraft.controller'
import { submitKYC } from '../controllers/userController'
import { submitSellerFeedback } from '../controllers/feedbackController'
import { protect } from '../middlewares/authMiddleware'
import { uploadKYCDocuments, uploadProfilePhoto, uploadStoreSettings } from '../middlewares/upload.middleware'

const router = Router()

// Public routes
router.post('/register', registerSeller)
router.post('/login', loginSeller)
router.post('/google-oauth', googleOAuthSeller)
router.post('/refresh', refreshSeller)
router.post('/logout', logoutSeller)
router.get('/verify-email/:token', verifyEmail)
router.post('/resend-verification', resendVerificationEmail)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password/:token', resetPassword)

// Protected routes (require authentication)
router.use(protect)
router.get('/profile', getSellerProfile)
router.put('/profile', uploadProfilePhoto, updateSellerProfile)
router.put('/onboarding-tour-completed', markOnboardingTourCompleted)
router.put('/change-password', changePassword)
router.post('/kyc-draft', saveKYCDraft)
router.post('/submit-kyc', uploadKYCDocuments, submitKYC)
router.put('/update-store', uploadStoreSettings, updateStoreInfo)
router.post('/feedback', submitSellerFeedback)

export default router
