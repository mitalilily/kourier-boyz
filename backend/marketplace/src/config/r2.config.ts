import { S3Client } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

dotenv.config()

export const normalizeR2Endpoint = (endpoint?: string) => {
  if (!endpoint) return undefined

  try {
    const url = new URL(endpoint)
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return endpoint.replace(/\/+$/, '')
  }
}

// Cloudflare R2 configuration using S3-compatible API
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: normalizeR2Endpoint(process.env.R2_ENDPOINT),
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || 'missing-r2-access-key',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'missing-r2-secret-key',
  },
})

export const R2_CONFIG = {
  bucketName: process.env.R2_BUCKET_NAME || 'kourier-boyz-prod',
  projectPrefix:
    process.env.R2_MARKETPLACE_PROJECT_PREFIX || process.env.R2_PROJECT_PREFIX || 'kourier-boyz',
  marketplacePrefix: process.env.R2_MARKETPLACE_PREFIX || 'marketplace',
  publicUrl: process.env.R2_PUBLIC_URL,
  deliveryBaseUrl:
    process.env.R2_DELIVERY_BASE_URL ||
    (process.env.API_URL
      ? `${process.env.API_URL.replace(/\/+$/, '')}/api/marketplace/files/object`
      : undefined),
  urlSigningSecret: process.env.R2_URL_SIGNING_SECRET,
}
