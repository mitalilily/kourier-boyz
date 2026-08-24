import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_CONFIG } from '../config/r2.config'

/**
 * Sanitize a filename by removing emojis, special characters, and spaces
 * Keeps only alphanumeric characters, dots, hyphens, and underscores
 * Preserves the file extension
 * @param fileName - The original filename to sanitize
 * @returns Sanitized filename safe for use in URLs and object keys
 */
export const sanitizeFileName = (fileName: string): string => {
  // Extract file extension
  const lastDotIndex = fileName.lastIndexOf('.')
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : ''
  const nameWithoutExt = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName

  // Remove emojis and special characters, replace spaces with hyphens
  // Keep only alphanumeric, dots (already removed), hyphens, and underscores
  const sanitized = nameWithoutExt
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
    .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .toLowerCase()

  // If sanitized name is empty, use a default name
  const finalName = sanitized || 'file'

  return `${finalName}${extension}`
}

/**
 * Upload a file buffer to Cloudflare R2
 * @param fileBuffer - The file buffer to upload
 * @param fileName - The name to save the file as (can include path like 'kyc/userId/filename.jpg')
 * @param mimeType - The MIME type of the file
 * @param folder - Optional folder path within the bucket (only used if fileName doesn't include a path)
 * @returns The public URL of the uploaded file
 */
export const uploadToR2 = async (
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'categories',
): Promise<string> => {
  // If fileName already includes a path (contains '/'), sanitize just the filename part
  // Otherwise, sanitize the entire fileName
  let sanitizedFileName: string
  if (fileName.includes('/')) {
    const parts = fileName.split('/')
    const filename = parts.pop() || fileName
    const path = parts.join('/')
    sanitizedFileName = `${path}/${sanitizeFileName(filename)}`
  } else {
    sanitizedFileName = sanitizeFileName(fileName)
  }

  // If fileName already includes a path (contains '/'), use it directly
  // Otherwise, prepend folder and timestamp
  const key = sanitizedFileName.includes('/') 
    ? sanitizedFileName 
    : `${folder}/${Date.now()}-${sanitizedFileName}`

  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  })

  await r2Client.send(command)

  // Build public URL: ensure publicUrl is set and has no trailing slash to avoid double slash
  const baseUrl = (R2_CONFIG.publicUrl || '').replace(/\/+$/, '')
  if (!baseUrl || !baseUrl.startsWith('http')) {
    throw new Error(
      'R2_PUBLIC_URL must be set and must be a valid HTTP(S) URL (e.g. https://your-bucket.r2.dev or custom domain) for invoice/file links to work.',
    )
  }
  const fullUrl = `${baseUrl}/${key}`
  return fullUrl
}

/**
 * Generate a presigned PUT URL for direct uploads to R2.
 * @param key - The object key (path within the bucket)
 * @param mimeType - The MIME type of the file
 * @param expiresIn - Expiration time in seconds (default: 15 minutes)
 */
export const getPresignedUploadUrl = async (
  key: string,
  mimeType: string,
  expiresIn: number = 900,
): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
    ContentType: mimeType,
  })

  return await getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Delete a file from Cloudflare R2
 * @param fileUrl - The full URL of the file to delete
 */
const getKeyFromUrl = (fileUrl: string): string => {
  const baseUrl = (R2_CONFIG.publicUrl || '').replace(/\/+$/, '')
  if (!baseUrl) return fileUrl
  const escapedBase = baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let key = fileUrl.replace(new RegExp(`^${escapedBase}/?`), '')
  return key.replace(/^\/+/, '') // R2 keys must not have leading slash
}

export const deleteFromR2 = async (fileUrl: string): Promise<void> => {
  try {
    const key = getKeyFromUrl(fileUrl)

    const command = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    })

    await r2Client.send(command)
  } catch (error) {
    console.error('Error deleting file from R2:', error)
    throw error
  }
}

/**
 * Delete multiple files from Cloudflare R2
 * @param fileUrls - Array of file URLs to delete
 */
export const deleteMultipleFromR2 = async (fileUrls: string[]): Promise<void> => {
  try {
    await Promise.all(fileUrls.map((url) => deleteFromR2(url)))
  } catch (error) {
    console.error('Error deleting multiple files from R2:', error)
    throw error
  }
}

/**
 * Download a file from Cloudflare R2
 * @param fileUrl - The full URL of the file to download
 * @returns File buffer and metadata
 */
export const downloadFromR2 = async (
  fileUrl: string,
): Promise<{ buffer: Buffer; contentType: string; fileName: string }> => {
  try {
    const key = getKeyFromUrl(fileUrl)

    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    })

    const response = await r2Client.send(command)

    // Convert stream to buffer
    const buffer = await streamToBuffer(response.Body as any)

    // Extract filename from key
    const fileName = key.split('/').pop() || 'download'

    return {
      buffer,
      contentType: response.ContentType || 'application/octet-stream',
      fileName,
    }
  } catch (error) {
    console.error('Error downloading file from R2:', error)
    throw error
  }
}

/**
 * Generate a signed URL for temporary access to a private file
 * Useful for preview functionality or temporary downloads
 * @param fileUrl - The full URL of the file
 * @param expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL that expires after the specified time
 */
export const getSignedUrlFromR2 = async (
  fileUrl: string,
  expiresIn: number = 3600,
): Promise<string> => {
  try {
    const key = getKeyFromUrl(fileUrl)

    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    })

    // Generate signed URL
    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn })

    return signedUrl
  } catch (error) {
    console.error('Error generating signed URL from R2:', error)
    throw error
  }
}

/**
 * Get file metadata without downloading the entire file
 * Useful for checking file existence and getting info
 * @param fileUrl - The full URL of the file
 * @returns File metadata (size, type, last modified)
 */
export const getFileMetadataFromR2 = async (
  fileUrl: string,
): Promise<{
  size?: number
  contentType?: string
  lastModified?: Date
  exists: boolean
}> => {
  try {
    const key = getKeyFromUrl(fileUrl)

    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
    })

    const response = await r2Client.send(command)

    return {
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      exists: true,
    }
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return { exists: false }
    }
    console.error('Error getting file metadata from R2:', error)
    throw error
  }
}

/**
 * Generate a preview-friendly URL for images
 * For public buckets, this returns the public URL
 * For private buckets, this returns a signed URL
 * @param fileUrl - The full URL of the file
 * @param isPrivate - Whether the bucket is private (default: false)
 * @returns Preview URL
 */
export const getPreviewUrl = async (fileUrl: string, isPrivate: boolean = false): Promise<string> => {
  if (isPrivate) {
    // For private files, generate a signed URL (expires in 1 hour)
    return await getSignedUrlFromR2(fileUrl, 3600)
  }
  
  // For public files, return the public URL directly
  return fileUrl
}

/**
 * Helper function to convert stream to buffer
 */
const streamToBuffer = async (stream: any): Promise<Buffer> => {
  const chunks: Buffer[] = []
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

