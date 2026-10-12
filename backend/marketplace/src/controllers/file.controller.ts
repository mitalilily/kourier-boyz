import { Request, Response } from 'express'
import {
  decodeR2DeliveryToken,
  downloadFromR2,
  getFileMetadataFromR2,
  getPreviewUrl,
  getR2ObjectStream,
  getSignedUrlFromR2,
  isPrivateR2Object,
} from '../utils/r2Upload'

export const streamDeliveryObject = async (req: Request, res: Response) => {
  try {
    const token = req.params.token
    if (!token) return res.status(400).json({ error: 'File token is required' })

    const key = decodeR2DeliveryToken(token)
    const range = typeof req.headers.range === 'string' ? req.headers.range : undefined
    const { response } = await getR2ObjectStream(key, range)
    const body = response.Body as any

    res.status(response.ContentRange ? 206 : 200)
    res.setHeader('Content-Type', response.ContentType || 'application/octet-stream')
    res.setHeader('Content-Disposition', response.ContentDisposition || 'inline')
    res.setHeader('Accept-Ranges', response.AcceptRanges || 'bytes')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader(
      'Cache-Control',
      isPrivateR2Object(key) ? 'private, no-store' : response.CacheControl || 'public, max-age=86400',
    )
    if (response.ContentLength !== undefined) {
      res.setHeader('Content-Length', String(response.ContentLength))
    }
    if (response.ContentRange) res.setHeader('Content-Range', response.ContentRange)
    if (response.ETag) res.setHeader('ETag', response.ETag)

    if (body && typeof body.pipe === 'function') {
      body.on('error', (error: Error) => {
        console.error('R2 delivery stream failed:', error)
        if (!res.headersSent) res.status(500).end()
        else res.destroy(error)
      })
      body.pipe(res)
      return
    }

    const bytes = body ? await body.transformToByteArray() : new Uint8Array()
    res.send(Buffer.from(bytes))
  } catch (error: any) {
    const notFound =
      error?.name === 'NoSuchKey' ||
      error?.name === 'NotFound' ||
      error?.$metadata?.httpStatusCode === 404
    if (!notFound) console.error('Error streaming R2 delivery object:', error)
    res.status(notFound ? 404 : 403).json({ error: notFound ? 'File not found' : 'Invalid file link' })
  }
}

/**
 * Download a file from R2
 * GET /api/files/download?url=<file-url>
 */
export const downloadFile = async (req: Request, res: Response) => {
  try {
    const { url } = req.query

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'File URL is required' })
    }

    // Download file from R2
    const { buffer, contentType, fileName } = await downloadFromR2(url)

    // Set headers for download
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', buffer.length)

    // Send file
    res.send(buffer)
  } catch (error) {
    console.error('Error downloading file:', error)
    res.status(500).json({ error: 'Failed to download file' })
  }
}

/**
 * Get a preview URL for a file
 * GET /api/files/preview?url=<file-url>&private=<true|false>
 */
export const getPreview = async (req: Request, res: Response) => {
  try {
    const { url, private: isPrivate } = req.query

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'File URL is required' })
    }

    const isPrivateBucket = isPrivate === 'true'

    // Get preview URL (signed if private, public if not)
    const previewUrl = await getPreviewUrl(url, isPrivateBucket)

    res.json({ previewUrl })
  } catch (error) {
    console.error('Error generating preview URL:', error)
    res.status(500).json({ error: 'Failed to generate preview URL' })
  }
}

/**
 * Get a signed URL for temporary access
 * GET /api/files/signed-url?url=<file-url>&expiresIn=<seconds>
 */
export const getSignedUrl = async (req: Request, res: Response) => {
  try {
    const { url, expiresIn } = req.query

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'File URL is required' })
    }

    const expirationTime = expiresIn ? parseInt(expiresIn as string) : 3600 // Default 1 hour

    // Generate signed URL
    const signedUrl = await getSignedUrlFromR2(url, expirationTime)

    res.json({ signedUrl, expiresIn: expirationTime })
  } catch (error) {
    console.error('Error generating signed URL:', error)
    res.status(500).json({ error: 'Failed to generate signed URL' })
  }
}

/**
 * Get file metadata
 * GET /api/files/metadata?url=<file-url>
 */
export const getFileMetadata = async (req: Request, res: Response) => {
  try {
    const { url } = req.query

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'File URL is required' })
    }

    // Get file metadata
    const metadata = await getFileMetadataFromR2(url)

    if (!metadata.exists) {
      return res.status(404).json({ error: 'File not found' })
    }

    res.json(metadata)
  } catch (error) {
    console.error('Error getting file metadata:', error)
    res.status(500).json({ error: 'Failed to get file metadata' })
  }
}

/**
 * Stream a file for inline viewing (preview in browser)
 * GET /api/files/stream?url=<file-url>
 */
export const streamFile = async (req: Request, res: Response) => {
  try {
    const { url } = req.query

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'File URL is required' })
    }

    // Download file from R2
    const { buffer, contentType } = await downloadFromR2(url)

    // Set headers for inline viewing
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Content-Length', buffer.length)

    // Send file
    res.send(buffer)
  } catch (error) {
    console.error('Error streaming file:', error)
    res.status(500).json({ error: 'Failed to stream file' })
  }
}

