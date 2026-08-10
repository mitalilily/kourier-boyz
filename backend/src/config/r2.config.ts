import { S3Client } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

dotenv.config()

// Cloudflare R2 configuration using S3-compatible API
export const r2Client = new S3Client({
  region: 'auto', // Cloudflare R2 uses 'auto' for region
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<account-id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export const R2_CONFIG = {
  bucketName: process.env.R2_BUCKET_NAME || 'kourier-boyz-uploads',
  publicUrl: process.env.R2_PUBLIC_URL, // e.g., https://cdn.yourdomain.com or R2 public bucket URL
}
