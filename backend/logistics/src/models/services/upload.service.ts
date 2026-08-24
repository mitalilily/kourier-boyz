import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import axios from 'axios'
import { r2 } from '../../config/r2Client'
import { getBucketName, sanitizeFilename } from '../../utils/functions'

import * as dotenv from 'dotenv'
import path from 'path'

// Load correct .env based on NODE_ENV
const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../../.env.${env}`) })

interface PresignParams {
  filename: string
  contentType: string
  userId: string
  folderKey?: string
}

const PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS = 60 * 60 * 24 // 24h
const PRESIGN_CACHE_SAFETY_BUFFER_MS = 60 * 1000 // refresh 1 min before expiry
const R2_UPLOAD_TIMEOUT_MS = Number(process.env.R2_UPLOAD_TIMEOUT_MS || 30000)
const presignDownloadCache = new Map<string, { url: string; expiresAt: number }>()

const normalizePathSegment = (value: string) =>
  value
    .trim()
    .replace(/\\/g, '/')
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

const getProjectPrefix = () => normalizePathSegment(process.env.R2_PROJECT_PREFIX || 'kourier-boyz')

const hasProjectPrefix = (key: string) => {
  const prefix = getProjectPrefix()
  return !prefix || key === prefix || key.startsWith(`${prefix}/`)
}

const withProjectPrefix = (key: string) => {
  const normalizedKey = key.replace(/^\/+/, '')
  const prefix = getProjectPrefix()
  if (!prefix || hasProjectPrefix(normalizedKey)) return normalizedKey
  return `${prefix}/${normalizedKey}`
}

const buildObjectKey = ({
  folderKey,
  userId,
  filename,
}: {
  folderKey: string
  userId: string
  filename: string
}) => {
  const folder = normalizePathSegment(folderKey) || 'uploads'
  const owner = normalizePathSegment(userId) || 'anonymous'
  return withProjectPrefix(`${folder}/${owner}/${Date.now()}-${sanitizeFilename(filename)}`)
}

const getPublicStorageBaseUrl = (bucket: string) => {
  const endpoint = (process.env.R2_PUBLIC_URL || process.env.R2_ENDPOINT || '').replace(/\/+$/, '')
  if (!endpoint) return ''

  try {
    const url = new URL(endpoint)
    const pathParts = url.pathname.split('/').filter(Boolean)
    if (pathParts[pathParts.length - 1] === bucket) {
      return `${url.origin}/${pathParts.join('/')}`
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}/${bucket}`
  } catch {
    return `${endpoint}/${bucket}`
  }
}

const presignCacheKey = (
  bucket: string,
  key: string,
  options?: {
    downloadName?: string
    disposition?: 'inline' | 'attachment'
    contentType?: string
  },
) =>
  JSON.stringify({
    bucket,
    key,
    disposition: options?.disposition || null,
    downloadName: options?.downloadName || null,
    contentType: options?.contentType || null,
  })

export const presignUpload = async ({
  filename,
  contentType,
  userId,
  folderKey = 'userPp',
}: PresignParams) => {
  const bucket = getBucketName()
  const key = buildObjectKey({ folderKey, userId, filename })

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  })

  const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 60 * 5 }) // 5 min

  const publicBaseUrl = getPublicStorageBaseUrl(bucket)
  const publicUrl = publicBaseUrl ? `${publicBaseUrl}/${key}` : key
  return { uploadUrl, key, publicUrl, bucket }
}

/**
 * Download a file from a URL and upload it to R2, returning only the S3 key
 * This ensures we store keys only, not external URLs
 */
export const downloadAndUploadToR2 = async ({
  url,
  userId,
  filename,
  folderKey = 'labels',
  contentType = 'application/pdf',
}: {
  url: string
  userId: string
  filename: string
  folderKey?: string
  contentType?: string
}): Promise<string | null> => {
  try {
    const bucket = getBucketName()

    // Check if the input is a valid URL (starts with http:// or https://)
    const isValidUrl = /^https?:\/\//i.test(url)

    if (!isValidUrl) {
      // If it's not a URL, treat it as an R2 key
      // Check if it looks like an R2 key (contains slashes, doesn't start with http)
      console.log(`ℹ️ Input is not a URL, treating as R2 key: ${url}`)

      // If it's already a key (contains folder structure), return it as-is
      if (url.includes('/')) {
        const key = withProjectPrefix(url)
        console.log(`Using existing R2 key: ${key}`)
        return key
      }

      // If it's just a filename, construct a proper key path
      // This handles cases where Delhivery returns just a filename
      const key = buildObjectKey({ folderKey, userId, filename: url })
      console.log(`✅ Constructed R2 key from filename: ${key}`)
      return key
    }

    // If it's already an R2 URL, extract the key instead of re-uploading
    const extractedKey = extractKeyFromUrl(url, bucket)
    if (extractedKey) {
      const key = withProjectPrefix(extractedKey)
      console.log(`URL is already an R2 URL, using existing key: ${key}`)
      return key
    }

    // Download the file from the URL (external URL)
    console.log(`📥 Downloading file from URL: ${url}`)
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000, // 30 second timeout
    })

    const fileBuffer = Buffer.from(response.data)

    // Upload to R2
    console.log(`📤 Uploading downloaded file to R2: ${filename}`)
    const { uploadUrl, key } = await presignUpload({
      filename,
      contentType,
      userId,
      folderKey,
    })

    if (!uploadUrl || !key) {
      console.error('❌ Failed to get presigned upload URL')
      return null
    }

    await axios.put(Array.isArray(uploadUrl) ? uploadUrl[0] : uploadUrl, fileBuffer, {
      headers: { 'Content-Type': contentType },
      timeout: R2_UPLOAD_TIMEOUT_MS,
    })

    const finalKey = Array.isArray(key) ? key[0] : key
    console.log(`✅ File uploaded to R2 successfully: ${finalKey}`)
    return finalKey
  } catch (error: any) {
    console.error('❌ Failed to download and upload file to R2:', {
      url,
      filename,
      error: error?.message || error,
      stack: error?.stack,
    })
    return null
  }
}

/**
 * Extract S3/R2 key from a full URL
 * Example: https://xxx.r2.cloudflarestorage.com/bucket-name/folder/file.pdf -> folder/file.pdf
 */
const extractKeyFromUrl = (url: string, bucket: string): string | null => {
  try {
    // Check if it's an R2 URL that contains our bucket
    if (url.includes(bucket)) {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      // Find bucket index and return everything after it
      const bucketIndex = pathParts.indexOf(bucket)
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/')
      }
    }
    // If it's an R2 endpoint URL format, try to extract key
    if (process.env.R2_ENDPOINT && url.startsWith(process.env.R2_ENDPOINT)) {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      const bucketIndex = pathParts.indexOf(bucket)
      if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/')
      }
      if (pathParts.length) {
        return pathParts.join('/')
      }
    }
    return null
  } catch (error) {
    console.error('Error extracting key from URL:', url, error)
    return null
  }
}

const isMissingObjectError = (error: any) =>
  error?.name === 'NotFound' ||
  error?.name === 'NoSuchKey' ||
  error?.code === 'NotFound' ||
  error?.code === 'NoSuchKey' ||
  error?.$metadata?.httpStatusCode === 404 ||
  error?.message?.includes('NotFound') ||
  error?.message?.includes('NoSuchKey') ||
  error?.message?.includes('404')

const ensureObjectExists = async (bucket: string, key: string) => {
  try {
    await r2.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    )
    return true
  } catch (error: any) {
    if (isMissingObjectError(error)) {
      console.warn('⚠️ File missing in R2 storage:', { bucket, key })
      return false
    }

    throw error
  }
}

const buildPresignedDownloadUrl = async (
  bucket: string,
  rawValue: string,
  now: number,
  options?: {
    downloadName?: string
    disposition?: 'inline' | 'attachment'
    contentType?: string
    checkExists?: boolean
  },
) => {
  const value = rawValue.trim()

  if (!value) {
    console.warn('⚠️ Empty key provided to presignDownload')
    return null
  }

  const responseContentDisposition =
    options?.disposition && options?.downloadName
      ? `${options.disposition}; filename="${options.downloadName}"`
      : undefined
  const responseContentType = options?.contentType

  let storageKey = value

  if (/^https?:\/\//i.test(value)) {
    const extractedKey = extractKeyFromUrl(value, bucket)
    if (!extractedKey) {
      console.warn(`⚠️ Could not extract S3 key from URL, returning as-is: ${value}`)
      return value
    }

    storageKey = extractedKey
    console.log(`🔄 Extracted key from URL: ${storageKey}, regenerating presigned URL`)
  }

  const candidateKeys = hasProjectPrefix(storageKey)
    ? [storageKey]
    : [withProjectPrefix(storageKey), storageKey]

  if (options?.checkExists) {
    let foundKey: string | null = null
    for (const candidateKey of candidateKeys) {
      const exists = await ensureObjectExists(bucket, candidateKey)
      if (exists) {
        foundKey = candidateKey
        break
      }
    }
    if (!foundKey) return null
    storageKey = foundKey
  } else {
    storageKey = candidateKeys[0]
  }

  const cacheKey = presignCacheKey(bucket, storageKey, options)
  const cached = presignDownloadCache.get(cacheKey)
  if (cached && cached.expiresAt - PRESIGN_CACHE_SAFETY_BUFFER_MS > now) {
    return cached.url
  }

  console.log(`🔄 Presigning download URL for key: ${storageKey} in bucket: ${bucket}`)
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ResponseContentDisposition: responseContentDisposition,
    ResponseContentType: responseContentType,
  })
  const signedUrl = await getSignedUrl(r2, command, {
    expiresIn: PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS,
  })
  console.log(`✅ Presigned URL generated successfully for key: ${storageKey}`)
  presignDownloadCache.set(cacheKey, {
    url: signedUrl,
    expiresAt: now + PRESIGN_DOWNLOAD_EXPIRES_IN_SECONDS * 1000,
  })
  return signedUrl
}

export const presignDownload = async (
  keyOrKeys: string | string[],
  options?: {
    downloadName?: string
    disposition?: 'inline' | 'attachment'
    contentType?: string
    checkExists?: boolean
  },
): Promise<string | Array<string | null> | null> => {
  try {
    const bucket = getBucketName()
    const now = Date.now()

    if (typeof keyOrKeys === 'string') {
      return buildPresignedDownloadUrl(bucket, keyOrKeys, now, options)
    }

    const urls = await Promise.all(
      keyOrKeys.map((key) => buildPresignedDownloadUrl(bucket, key, now, options)),
    )

    return urls
  } catch (error: any) {
    if (isMissingObjectError(error)) {
      console.error('❌ File not found in S3/R2:', {
        keys: keyOrKeys,
        error: error?.message || error,
      })
      return typeof keyOrKeys === 'string' ? null : keyOrKeys.map(() => null)
    }

    console.error('❌ Error generating presigned download URL(s):', {
      error: error?.message || error,
      stack: error?.stack,
      keys: keyOrKeys,
    })
    throw new Error(`Failed to generate presigned URL(s): ${error?.message || 'Unknown error'}`)
  }
}
