/**
 * Migration Script: Re-encrypt Phone Numbers
 * 
 * This script helps migrate phone numbers that were encrypted with an old key
 * to be encrypted with the current PHONE_ENCRYPTION_KEY.
 * 
 * Usage:
 * 1. If you have the old key, set OLD_PHONE_ENCRYPTION_KEY in .env
 * 2. Run: npx ts-node src/scripts/migratePhoneEncryption.ts
 * 
 * Note: If you don't have the old key, users will need to update their phone numbers
 * manually through the profile page, which will re-encrypt them automatically.
 */

import crypto from 'crypto'
import mongoose from 'mongoose'
import User from '../models/User'
import { decryptPhone, encryptPhone } from '../utils/phoneEncryption'

// You can set this in .env if you have the old encryption key
const OLD_ENCRYPTION_KEY = process.env.OLD_PHONE_ENCRYPTION_KEY

const decryptWithOldKey = (encryptedPhone: string, oldKeyHex: string): string | undefined => {
  try {
    // Get encryption key from hex string
    const key = Buffer.from(oldKeyHex, 'hex')
    const actualKey = key.length === 32 ? key : crypto.createHash('sha256').update(oldKeyHex).digest()
    
    // Decode base64
    const combined = Buffer.from(encryptedPhone, 'base64')
    if (combined.length < 28) return undefined

    // Extract IV, authTag, and encrypted data
    const iv = combined.slice(0, 12)
    const authTag = combined.slice(12, 28)
    const encrypted = combined.slice(28)

    if (encrypted.length === 0) return undefined

    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-gcm', actualKey, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    return undefined
  }
}

const migratePhones = async () => {
  try {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required')
    await mongoose.connect(databaseUrl)
    console.log('Connected to PostgreSQL')

    // Find all users with phone numbers
    const users = await User.find({ phone: { $exists: true, $ne: null } })
    console.log(`Found ${users.length} users with phone numbers`)

    let migrated = 0
    let failed = 0
    let skipped = 0

    for (const user of users) {
      try {
        const phone = (user as any).phone
        if (!phone) continue

        // Try to decrypt with current key
        const decrypted = decryptPhone(phone)

        if (decrypted) {
          // Already decryptable with current key - skip
          skipped++
          continue
        }

        // Can't decrypt - phone was encrypted with different key
        console.log(`User ${user._id}: Phone cannot be decrypted with current key`)
        
        if (OLD_ENCRYPTION_KEY) {
          // If we have old key, try to decrypt and re-encrypt
          const oldDecrypted = decryptWithOldKey(phone, OLD_ENCRYPTION_KEY)
          if (oldDecrypted) {
            // Re-encrypt with new key
            const newEncrypted = encryptPhone(oldDecrypted)
            if (newEncrypted) {
              ;(user as any).phone = newEncrypted
              await user.save()
              migrated++
              console.log(`  ✓ Migrated phone for user ${user._id}`)
            }
          }
        } else {
          // No old key - mark for manual update
          failed++
          console.log(`  ⚠ Phone needs manual update (user: ${user.email || user._id})`)
        }
      } catch (error) {
        console.error(`Error processing user ${user._id}:`, error)
        failed++
      }
    }

    console.log('\n=== Migration Summary ===')
    console.log(`Total users: ${users.length}`)
    console.log(`Migrated: ${migrated}`)
    console.log(`Skipped (already OK): ${skipped}`)
    console.log(`Failed/Needs manual update: ${failed}`)

    if (failed > 0 && !OLD_ENCRYPTION_KEY) {
      console.log('\n⚠ Some phones could not be migrated.')
      console.log('Users need to update their phone numbers in profile settings.')
      console.log('This will automatically re-encrypt them with the current key.')
    }

    await mongoose.disconnect()
    console.log('\nMigration complete!')
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  }
}

// Run migration
migratePhones()

import '../database/postgresMongoose'
