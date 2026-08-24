import { Router } from 'express'
import {
  deleteUserRecentSearch,
  getSearch,
  getSearchSuggestions,
  getUserRecentSearches,
} from '../controllers/search.controller'
import { authorize, optionalAuth, protect } from '../middlewares/authMiddleware'

const router = Router()

router.get('/search', optionalAuth, getSearch)
router.get('/search-suggestions', getSearchSuggestions)
router.get('/recent-searches', optionalAuth, getUserRecentSearches)
router.delete('/recent-searches', protect, authorize(['customer']), deleteUserRecentSearch)

export default router
