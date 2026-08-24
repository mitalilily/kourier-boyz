import mongoose from 'mongoose'
import Coupon from '../models/Coupon'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })

const dummyTncList = [
  'This coupon cannot be combined with other offers or discounts',
  'Valid only on full-priced items, excludes sale items',
  'Minimum purchase amount must be met before discount is applied',
  'Coupon expires on the specified date and cannot be extended',
  'One coupon per customer per transaction',
  'Cannot be used for gift cards or previous purchases',
  'Discount will be applied at checkout',
  'Kourier Boyz reserves the right to modify or cancel this offer at any time',
]

const addDummyTncToCoupons = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not defined in environment variables')
      process.exit(1)
    }

    await mongoose.connect(process.env.DATABASE_URL)
    console.log('Connected to PostgreSQL')

    // Find all coupons
    const coupons = await Coupon.find({})
    console.log(`Found ${coupons.length} coupons`)

    let updatedCount = 0
    let skippedCount = 0

    for (const coupon of coupons) {
      // Skip if already has T&C
      if (coupon.termsAndConditions && coupon.termsAndConditions.length > 0) {
        console.log(`Skipping coupon ${coupon.code} - already has T&C`)
        skippedCount++
        continue
      }

      // Add dummy T&C (randomly select 3-5 terms)
      const numTerms = Math.floor(Math.random() * 3) + 3 // 3 to 5 terms
      const selectedTerms = []
      const availableTerms = [...dummyTncList]

      for (let i = 0; i < numTerms && availableTerms.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableTerms.length)
        selectedTerms.push(availableTerms.splice(randomIndex, 1)[0])
      }

      // Update coupon
      coupon.termsAndConditions = selectedTerms
      await coupon.save()

      console.log(`✓ Added ${selectedTerms.length} T&C to coupon ${coupon.code}`)
      updatedCount++
    }

    console.log('\n=== Summary ===')
    console.log(`Total coupons: ${coupons.length}`)
    console.log(`Updated: ${updatedCount}`)
    console.log(`Skipped (already had T&C): ${skippedCount}`)

    await mongoose.disconnect()
    console.log('\nDisconnected from PostgreSQL')
    process.exit(0)
  } catch (error) {
    console.error('Error adding dummy T&C to coupons:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

// Run the script
addDummyTncToCoupons()

import '../database/postgresMongoose'
