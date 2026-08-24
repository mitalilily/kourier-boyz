import { PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import { r2Client, R2_CONFIG } from '../config/r2.config'

dotenv.config()

/**
 * Test script to verify R2 connection and configuration
 * Run: npx ts-node src/scripts/testR2Connection.ts
 */
async function testR2Connection() {
  console.log('\n🧪 Testing Cloudflare R2 Connection...\n')

  // Step 1: Check environment variables
  console.log('📋 Configuration Check:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Endpoint:      ${process.env.R2_ENDPOINT || '❌ NOT SET'}`)
  console.log(`Bucket Name:   ${R2_CONFIG.bucketName || '❌ NOT SET'}`)
  console.log(`Public URL:    ${R2_CONFIG.publicUrl || '❌ NOT SET'}`)
  console.log(`Access Key ID: ${process.env.R2_ACCESS_KEY_ID ? '✅ Set' : '❌ NOT SET'}`)
  console.log(
    `Secret Key:    ${process.env.R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ NOT SET'}`,
  )
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Check if all required variables are set
  if (
    !process.env.R2_ENDPOINT ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY ||
    !R2_CONFIG.bucketName
  ) {
    console.error('❌ Error: Missing required environment variables!')
    console.log('\n📝 Please add these to your .env file:')
    console.log('R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com')
    console.log('R2_ACCESS_KEY_ID=your_access_key_id')
    console.log('R2_SECRET_ACCESS_KEY=your_secret_access_key')
    console.log('R2_BUCKET_NAME=kourier-boyz-uploads-dev')
    console.log('R2_PUBLIC_URL=https://pub-xxxxx.r2.dev')
    console.log('\n📖 See LOCAL_DEVELOPMENT_SETUP.md for detailed instructions\n')
    process.exit(1)
  }

  // Step 2: Test upload
  console.log('📤 Testing file upload...')
  try {
    const testContent = Buffer.from(
      `Hello from Kourier Boyz! Test performed at ${new Date().toISOString()}`,
    )
    const testKey = `test/connection-test-${Date.now()}.txt`

    const command = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    })

    await r2Client.send(command)

    console.log('✅ Upload successful!\n')
    console.log('📂 File Details:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Key:        ${testKey}`)
    console.log(`Public URL: ${R2_CONFIG.publicUrl}/${testKey}`)
    console.log(`Size:       ${testContent.length} bytes`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('🎉 Success! Your R2 configuration is working correctly.\n')
    console.log('💡 Next steps:')
    console.log('   1. Start your server: npm run dev')
    console.log('   2. Open admin panel and try uploading a category image')
    console.log('   3. Check your R2 bucket dashboard to see uploaded files\n')

    console.log(`🔗 View your file: ${R2_CONFIG.publicUrl}/${testKey}`)
    console.log('   (If public access is enabled)\n')

    console.log('🗑️  You can delete the test file from your R2 bucket dashboard\n')
  } catch (error: any) {
    console.error('❌ Upload failed!\n')
    console.error('Error details:')
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error(`Name:    ${error.name}`)
    console.error(`Message: ${error.message}`)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('🔍 Common issues:\n')

    if (error.name === 'CredentialsProviderError' || error.message.includes('credentials')) {
      console.log('   ⚠️  Invalid credentials')
      console.log('   → Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env')
      console.log('   → Generate new API token in Cloudflare Dashboard\n')
    } else if (error.name === 'NoSuchBucket') {
      console.log('   ⚠️  Bucket not found')
      console.log('   → Check R2_BUCKET_NAME matches your bucket name exactly')
      console.log('   → Create bucket in Cloudflare R2 Dashboard\n')
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('network')) {
      console.log('   ⚠️  Network/DNS error')
      console.log('   → Check your internet connection')
      console.log('   → Verify R2_ENDPOINT format is correct')
      console.log('   → Should be: https://<account-id>.r2.cloudflarestorage.com\n')
    } else {
      console.log('   → Check your R2 configuration in .env file')
      console.log('   → See LOCAL_DEVELOPMENT_SETUP.md for help\n')
    }

    process.exit(1)
  }
}

// Run the test
testR2Connection()
  .then(() => {
    console.log('✨ Test completed successfully!\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error)
    process.exit(1)
  })

