import { GetBucketCorsCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3'
import * as dotenv from 'dotenv'
import path from 'path'

process.env.NODE_ENV = process.env.NODE_ENV || 'production'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${process.env.NODE_ENV}`) })

const parseOrigins = () =>
  (process.env.R2_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const allowedOrigins = [
  ...new Set([
    'https://kourierboyz.com',
    'https://www.kourierboyz.com',
    'https://admin.kourierboyz.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    ...parseOrigins(),
  ]),
]

const configure = async () => {
  const [{ r2 }, { getBucketName }] = await Promise.all([
    import('../config/r2Client'),
    import('../utils/functions'),
  ])
  const bucket = getBucketName()
  if (!bucket) throw new Error('R2 bucket name is not configured for this environment')

  await r2.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: allowedOrigins,
            AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
            AllowedHeaders: ['*'],
            ExposeHeaders: ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  )

  const current = await r2.send(new GetBucketCorsCommand({ Bucket: bucket }))
  console.log(JSON.stringify({ bucket, cors: current.CORSRules }, null, 2))
}

configure().catch((error) => {
  console.error('Failed to configure R2 CORS:', error)
  process.exit(1)
})
