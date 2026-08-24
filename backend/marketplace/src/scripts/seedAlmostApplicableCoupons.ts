import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Coupon from '../models/Coupon'
import User from '../models/User'

dotenv.config()

// Cart total is ₹2204
// Almost applicable means: within 30% of minPurchaseAmount or ₹200, whichever is smaller
// So for ₹2204 cart:
// - minPurchaseAmount of ₹2400: difference = ₹196 (within ₹200 threshold) ✓
// - minPurchaseAmount of ₹2300: difference = ₹96 (within ₹200 threshold) ✓
// - minPurchaseAmount of ₹2500: difference = ₹296 (outside ₹200 threshold) ✗
// - minPurchaseAmount of ₹2350: difference = ₹146 (within ₹200 threshold) ✓

const seedAlmostApplicableCoupons = async () => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not defined in .env')
    await mongoose.connect(process.env.DATABASE_URL)
    console.log('✅ Connected to PostgreSQL')

    // Find an admin user to use as createdBy
    const adminUser = await User.findOne({ role: 'super-admin' })
    if (!adminUser) {
      throw new Error('No admin user found. Please create an admin user first.')
    }

    console.log(`Using admin user: ${adminUser.email} (${adminUser._id})`)

    // Set dates
    const now = new Date()
    const validFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
    const validTo = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 days from now

    // Define almost applicable test coupons (for cart total ₹2204)
    const almostApplicableCoupons = [
      {
        code: 'ALMOST100',
        type: 'fixed' as const,
        value: 100,
        minPurchaseAmount: 2400, // Difference: ₹196 (within ₹200)
        description: 'Almost there! Add ₹196 more to unlock this coupon',
        termsAndConditions: [
          'Valid for orders above ₹2400',
          'Cannot be combined with other offers',
          'One coupon per customer',
        ],
      },
      {
        code: 'ALMOST50',
        type: 'fixed' as const,
        value: 50,
        minPurchaseAmount: 2300, // Difference: ₹96 (within ₹200)
        description: 'Just ₹96 away from saving ₹50!',
        termsAndConditions: [
          'Minimum purchase of ₹2300 required',
          'Valid on full-priced items only',
        ],
      },
      {
        code: 'ALMOST15',
        type: 'percentage' as const,
        value: 15,
        maxDiscountAmount: 500,
        minPurchaseAmount: 2350, // Difference: ₹146 (within ₹200)
        description: 'Add ₹146 more for 15% off (up to ₹500)',
        termsAndConditions: [
          'Minimum order value of ₹2350',
          'Maximum discount ₹500',
          'Excludes sale items',
        ],
      },
      {
        code: 'ALMOST200',
        type: 'fixed' as const,
        value: 200,
        minPurchaseAmount: 2450, // Difference: ₹246 (outside ₹200, but let's include it for testing)
        description: 'Add ₹246 more to save ₹200',
        termsAndConditions: [
          'Valid for orders above ₹2450',
          'Cannot be used for gift cards',
        ],
      },
    ]

    let createdCount = 0
    let skippedCount = 0

    for (const couponData of almostApplicableCoupons) {
      // Check if coupon already exists
      const existingCoupon = await Coupon.findOne({ code: couponData.code })
      if (existingCoupon) {
        console.log(`⏭️  Skipping ${couponData.code} - already exists`)
        skippedCount++
        continue
      }

      // Create coupon
      const coupon = new Coupon({
        ...couponData,
        usageLimit: 100,
        usageCount: 0,
        perUserLimit: 1,
        validFrom,
        validTo,
        status: 'active',
        applicableTo: 'all',
        firstTimeUserOnly: false,
        createdBy: adminUser._id,
      })

      await coupon.save()
      console.log(`✅ Created coupon: ${couponData.code} (Min: ₹${couponData.minPurchaseAmount}, Difference: ₹${couponData.minPurchaseAmount - 2204})`)
      createdCount++
    }

    console.log('\n=== Summary ===')
    console.log(`Created: ${createdCount}`)
    console.log(`Skipped: ${skippedCount}`)
    console.log(`\n💡 Your cart total is ₹2204. These coupons require:`)
    almostApplicableCoupons.forEach((c) => {
      const diff = c.minPurchaseAmount - 2204
      console.log(`   - ${c.code}: Add ₹${diff} more (Min: ₹${c.minPurchaseAmount})`)
    })

    await mongoose.disconnect()
    console.log('\n✅ Disconnected from PostgreSQL')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding almost applicable coupons:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

// Run the script
seedAlmostApplicableCoupons()









import '../database/postgresMongoose'
