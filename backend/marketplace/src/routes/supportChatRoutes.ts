import express from 'express'
import { protect, requirePermission } from '../middlewares/authMiddleware'
import {
  assignChat,
  createChat,
  getAllChats,
  getChat,
  getMyChats,
  markMessagesAsRead,
  rateChat,
  sendMessage,
  updateChatStatus,
} from '../controllers/supportChat.controller'

const router = express.Router()

// Customer routes (require authentication)
router.post('/', protect, createChat)
router.get('/my', protect, getMyChats)
router.get('/my/:id', protect, getChat)
router.post('/my/:id/message', protect, sendMessage)
router.post('/my/:id/read', protect, markMessagesAsRead)
router.post('/my/:id/rate', protect, rateChat)
router.put('/my/:id/status', protect, updateChatStatus) // Allow customers to close their own chats

// Admin routes - permission-based access
router.get('/all', protect, requirePermission('supportChats', 'view'), getAllChats)
router.get('/:id', protect, requirePermission('supportChats', 'view'), getChat)
router.post('/:id/assign', protect, requirePermission('supportChats', 'assign'), assignChat)
router.put('/:id/status', protect, requirePermission('supportChats', 'update'), updateChatStatus)
router.post('/:id/message', protect, requirePermission('supportChats', 'update'), sendMessage)
router.post('/:id/read', protect, requirePermission('supportChats', 'update'), markMessagesAsRead)

export default router

