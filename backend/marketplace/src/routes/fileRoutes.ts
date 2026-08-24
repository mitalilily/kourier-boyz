import { Router } from 'express'
import {
  downloadFile,
  getFileMetadata,
  getPreview,
  getSignedUrl,
  streamFile,
} from '../controllers/file.controller'

const router = Router()

// Download file
router.get('/download', downloadFile)

// Get preview URL (handles both public and private files)
router.get('/preview', getPreview)

// Generate signed URL for temporary access
router.get('/signed-url', getSignedUrl)

// Get file metadata (size, type, etc.)
router.get('/metadata', getFileMetadata)

// Stream file for inline viewing
router.get('/stream', streamFile)

export default router

