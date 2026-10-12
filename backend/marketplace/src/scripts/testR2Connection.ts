import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { r2Client, R2_CONFIG } from '../config/r2.config'
import { buildR2DeliveryUrl, getKeyFromR2Reference } from '../utils/r2Upload'

const requiredEnvironment = [
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_DELIVERY_BASE_URL',
  'R2_URL_SIGNING_SECRET',
]

const assertEnvironment = () => {
  const missing = requiredEnvironment.filter((key) => !process.env[key])
  if (missing.length) throw new Error(`Missing R2 environment variables: ${missing.join(', ')}`)
}

const testR2Connection = async () => {
  assertEnvironment()
  await r2Client.send(new HeadBucketCommand({ Bucket: R2_CONFIG.bucketName }))

  const body = Buffer.from(`Kourier Boyz R2 check ${new Date().toISOString()}`)
  const deliveryUrl = buildR2DeliveryUrl(`healthchecks/marketplace-${Date.now()}.txt`)
  const key = getKeyFromR2Reference(deliveryUrl)

  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key,
        Body: body,
        ContentType: 'text/plain',
        CacheControl: 'private, no-store',
      }),
    )

    const response = await r2Client.send(
      new GetObjectCommand({ Bucket: R2_CONFIG.bucketName, Key: key }),
    )
    const downloaded = Buffer.from(await response.Body!.transformToByteArray())
    if (!downloaded.equals(body)) throw new Error('R2 read-back content did not match the upload')

    console.log(
      JSON.stringify({
        bucket: R2_CONFIG.bucketName,
        keyPrefix: key.split('/').slice(0, 2).join('/'),
        head: true,
        put: true,
        get: true,
        deliveryReference: true,
      }),
    )
  } finally {
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_CONFIG.bucketName, Key: key }))
  }
}

testR2Connection().catch((error) => {
  console.error('R2 connection check failed:', error?.message || error)
  process.exit(1)
})
