import crypto from 'crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_CONFIG } from '../config/r2.config'

const normalizePath = (value: string) =>
  value
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')

const normalizePrefix = (value: string) =>
  normalizePath(value)
    .split('/')
    .map((part) =>
      part
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[-_.]+|[-_.]+$/g, ''),
    )
    .filter(Boolean)
    .join('/')

const getMarketplacePrefix = () =>
  [normalizePrefix(R2_CONFIG.projectPrefix), normalizePrefix(R2_CONFIG.marketplacePrefix)]
    .filter(Boolean)
    .join('/')

const withMarketplacePrefix = (key: string) => {
  const normalizedKey = normalizePath(key).replace(/^\/+/, '')
  const prefix = getMarketplacePrefix()
  if (!prefix || normalizedKey === prefix || normalizedKey.startsWith(`${prefix}/`)) {
    return normalizedKey
  }
  return `${prefix}/${normalizedKey}`
}

const assertR2Configuration = () => {
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 storage credentials are not configured')
  }
  if (!R2_CONFIG.bucketName) throw new Error('R2 bucket name is not configured')
}

const getDeliveryConfiguration = () => {
  const baseUrl = (R2_CONFIG.deliveryBaseUrl || '').replace(/\/+$/, '')
  const secret = R2_CONFIG.urlSigningSecret || ''
  if (!/^https?:\/\//i.test(baseUrl) || secret.length < 32) {
    throw new Error(
      'R2_DELIVERY_BASE_URL and an R2_URL_SIGNING_SECRET of at least 32 characters are required',
    )
  }
  return { baseUrl, secret }
}

const signDeliveryPayload = (payload: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('base64url')

export const buildR2DeliveryUrl = (key: string) => {
  const { baseUrl, secret } = getDeliveryConfiguration()
  const payload = Buffer.from(withMarketplacePrefix(key), 'utf8').toString('base64url')
  const signature = signDeliveryPayload(payload, secret)
  return `${baseUrl}/${payload}.${signature}`
}

export const decodeR2DeliveryToken = (token: string) => {
  const { secret } = getDeliveryConfiguration()
  const [payload, signature, ...extra] = token.split('.')
  if (!payload || !signature || extra.length) throw new Error('Invalid R2 delivery token')

  const expected = signDeliveryPayload(payload, secret)
  const actualBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid R2 delivery token')
  }

  const key = Buffer.from(payload, 'base64url').toString('utf8')
  if (!key || key.includes('..') || !key.startsWith(`${getMarketplacePrefix()}/`)) {
    throw new Error('Invalid R2 object key')
  }
  return key
}

export const isPrivateR2Object = (key: string) => {
  const relativeKey = key.replace(new RegExp(`^${getMarketplacePrefix()}/?`), '')
  return /^(kyc|certificates|agreements|invoices|labels|settlements|tickets|returns)(\/|$)/i.test(
    relativeKey,
  )
}

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
  assertR2Configuration()
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
  const relativeKey = sanitizedFileName.includes('/')
    ? sanitizedFileName 
    : `${folder}/${Date.now()}-${sanitizedFileName}`
  const key = withMarketplacePrefix(relativeKey)

  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
    CacheControl: isPrivateR2Object(key) ? 'private, no-store' : 'public, max-age=86400',
  })

  await r2Client.send(command)

  if (R2_CONFIG.deliveryBaseUrl && R2_CONFIG.urlSigningSecret) {
    return buildR2DeliveryUrl(key)
  }

  const publicBaseUrl = (R2_CONFIG.publicUrl || '').replace(/\/+$/, '')
  if (/^https?:\/\//i.test(publicBaseUrl)) return `${publicBaseUrl}/${key}`

  throw new Error('R2 delivery is not configured')
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
  assertR2Configuration()
  const storageKey = withMarketplacePrefix(key)
  const command = new PutObjectCommand({
    Bucket: R2_CONFIG.bucketName,
    Key: storageKey,
    ContentType: mimeType,
  })

  return await getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Delete a file from Cloudflare R2
 * @param fileUrl - The full URL of the file to delete
 */
export const getKeyFromR2Reference = (fileUrl: string): string => {
  if (!fileUrl || typeof fileUrl !== 'string') throw new Error('R2 file reference is required')

  if (fileUrl.startsWith('r2://')) {
    const withoutScheme = fileUrl.slice('r2://'.length)
    const slashIndex = withoutScheme.indexOf('/')
    if (slashIndex === -1) throw new Error('Invalid R2 file reference')
    const bucket = withoutScheme.slice(0, slashIndex)
    if (bucket !== R2_CONFIG.bucketName) throw new Error('R2 bucket does not match configuration')
    return normalizePath(withoutScheme.slice(slashIndex + 1))
  }

  const deliveryBase = (R2_CONFIG.deliveryBaseUrl || '').replace(/\/+$/, '')
  if (deliveryBase && fileUrl.startsWith(`${deliveryBase}/`)) {
    const token = fileUrl.slice(deliveryBase.length + 1).split(/[?#]/, 1)[0]
    return decodeR2DeliveryToken(decodeURIComponent(token))
  }

  const baseUrl = (R2_CONFIG.publicUrl || '').replace(/\/+$/, '')
  if (baseUrl && fileUrl.startsWith(`${baseUrl}/`)) {
    return normalizePath(fileUrl.slice(baseUrl.length + 1).split(/[?#]/, 1)[0])
  }

  if (/^https?:\/\//i.test(fileUrl)) {
    const parsed = new URL(fileUrl)
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (parts[0] === R2_CONFIG.bucketName) parts.shift()
    if (!parts.length) throw new Error('Invalid R2 object URL')
    return normalizePath(parts.join('/'))
  }

  return normalizePath(fileUrl).replace(/^\/+/, '')
}

export const deleteFromR2 = async (fileUrl: string): Promise<void> => {
  try {
    assertR2Configuration()
    const key = getKeyFromR2Reference(fileUrl)

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
    assertR2Configuration()
    const key = getKeyFromR2Reference(fileUrl)

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
    assertR2Configuration()
    const key = getKeyFromR2Reference(fileUrl)

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
    assertR2Configuration()
    const key = getKeyFromR2Reference(fileUrl)

    const command = new HeadObjectCommand({
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
    if (
      error.name === 'NoSuchKey' ||
      error.name === 'NotFound' ||
      error.$metadata?.httpStatusCode === 404
    ) {
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
  const deliveryBase = (R2_CONFIG.deliveryBaseUrl || '').replace(/\/+$/, '')
  if (deliveryBase && fileUrl.startsWith(`${deliveryBase}/`)) return fileUrl

  if (isPrivate) {
    // For private files, generate a signed URL (expires in 1 hour)
    return await getSignedUrlFromR2(fileUrl, 3600)
  }
  
  // For public files, return the public URL directly
  return fileUrl
}

export const getR2ObjectStream = async (fileReference: string, range?: string) => {
  assertR2Configuration()
  const key = getKeyFromR2Reference(fileReference)
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Range: range,
    }),
  )

  return { key, response }
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

