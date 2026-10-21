import express from 'express'
import {
  getCapabilities,
  selectWorkspace,
} from '../controllers/merchantCapabilities.controller'
import { requireAuth } from '../middlewares/requireAuth'

const router = express.Router()

router.use(requireAuth)
router.get('/capabilities', getCapabilities)
router.post('/workspace', selectWorkspace)

export default router
