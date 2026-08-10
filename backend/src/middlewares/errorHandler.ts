import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Multer file size limit
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Max size is 10MB per file.' })
    }
    return res.status(400).json({ error: `Upload error: ${err.message}` })
  }

  // Invalid file type or other known upload errors
  if (err?.message && /Invalid file type/i.test(err.message)) {
    return res.status(400).json({ error: err.message })
  }

  // Express-validator or generic errors that include a status
  if (typeof err?.status === 'number' && err?.message) {
    return res.status(err.status).json({ error: err.message })
  }

  // Fallback
  console.error('Unhandled error:', err)
  return res.status(500).json({ error: 'Server error' })
}
