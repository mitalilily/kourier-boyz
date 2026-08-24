import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Coupon from '../models/Coupon'
import User from '../models/User'

dotenv.config()

const seedTestCoupons = async () => {
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

    // Define test coupons
    const testCoupons = [
      {
        code: 'SAVE10',
        type: 'percentage' as const,
        value: 10,
        minPurchaseAmount: 500,
        maxDiscountAmount: 200,
        description: 'Get 10% off on orders above ₹500. Maximum discount ₹200.',
        applicableTo: 'all' as const,
        usageLimit: 1000,
        perUserLimit: 3,
        validFrom,
        validTo,
        status: 'active' as const,
        createdBy: adminUser._id,
      },
      {
        code: 'FLAT50',
        type: 'fixed' as const,
        value: 50,
        minPurchaseAmount: 200,
        description: 'Flat ₹50 off on orders above ₹200',
        applicableTo: 'all' as const,
        usageLimit: 500,
        perUserLimit: 2,
        validFrom,
        validTo,
        status: 'active' as const,
        createdBy: adminUser._id,
      },
      {
        code: 'WELCOME20',
        type: 'percentage' as const,
        value: 20,
        minPurchaseAmount: 1000,
        maxDiscountAmount: 500,
        description: 'Welcome offer! Get 20% off on your first order above ₹1000',
        applicableTo: 'all' as const,
        firstTimeUserOnly: true,
        usageLimit: 200,
        perUserLimit: 1,
        validFrom,
        validTo,
        status: 'active' as const,
        createdBy: adminUser._id,
      },
      {
        code: 'BIG50',
        type: 'percentage' as const,
        value: 15,
        minPurchaseAmount: 2000,
        maxDiscountAmount: 1000,
        description: 'Get 15% off on big orders above ₹2000. Maximum discount ₹1000',
        applicableTo: 'all' as const,
        usageLimit: 100,
        perUserLimit: 1,
        validFrom,
        validTo,
        status: 'active' as const,
        createdBy: adminUser._id,
      },
      {
        code: 'FLAT100',
        type: 'fixed' as const,
        value: 100,
        minPurchaseAmount: 500,
        description: 'Flat ₹100 off on orders above ₹500',
        applicableTo: 'all' as const,
        usageLimit: 300,
        perUserLimit: 2,
        validFrom,
        validTo,
        status: 'active' as const,
        createdBy: adminUser._id,
      },
      {
        code: 'MEGA25',
        type: 'percentage' as const,
        value: 25,
        minPurchaseAmount: 3000,
        maxDiscountAmount: 1500,
        description: 'Mega discount! Get 25% off on orders above ₹3000. Maximum discount ₹1500',
        applicableTo: 'all' as const,
        usageLimit: 50,
        perUserLimit: 1,
        validFrom,
        validTo,
        status: 'active' as const,
        createdBy: adminUser._id,
      },
    ]

    // Check if coupons already exist
    const existingCodes = await Coupon.find({
      code: { $in: testCoupons.map((c) => c.code) },
    }).select('code')

    if (existingCodes.length > 0) {
      console.log('⚠️  Some coupons already exist:')
      existingCodes.forEach((c) => console.log(`  - ${c.code}`))
      console.log('\nSkipping existing coupons and creating new ones...\n')
    }

    // Create coupons
    const createdCoupons = []
    const skippedCoupons = []

    for (const couponData of testCoupons) {
      const existing = await Coupon.findOne({ code: couponData.code })
      if (existing) {
        skippedCoupons.push(couponData.code)
        console.log(`⏭️  Skipped ${couponData.code} (already exists)`)
        continue
      }

      try {
        const coupon = await Coupon.create(couponData)
        createdCoupons.push(coupon)
        console.log(`✅ Created coupon: ${coupon.code}`)
        console.log(`   Type: ${coupon.type === 'percentage' ? `${coupon.value}%` : `₹${coupon.value}`}`)
        console.log(`   Min Purchase: ₹${coupon.minPurchaseAmount || 0}`)
        if (coupon.maxDiscountAmount) {
          console.log(`   Max Discount: ₹${coupon.maxDiscountAmount}`)
        }
        console.log(`   Description: ${coupon.description}`)
        console.log('')
      } catch (error: any) {
        console.error(`❌ Error creating coupon ${couponData.code}:`, error.message)
      }
    }

    console.log('\n📊 Summary:')
    console.log(`   Created: ${createdCoupons.length} coupons`)
    console.log(`   Skipped: ${skippedCoupons.length} coupons`)
    console.log(`   Total: ${testCoupons.length} coupons`)

    if (createdCoupons.length > 0) {
      console.log('\n✅ Test coupons seeded successfully!')
      console.log('\nTest coupon codes:')
      createdCoupons.forEach((c) => {
        const discountText =
          c.type === 'percentage'
            ? `${c.value}% off${c.maxDiscountAmount ? ` (max ₹${c.maxDiscountAmount})` : ''}`
            : `₹${c.value} off`
        console.log(`   ${c.code} - ${discountText} - Min: ₹${c.minPurchaseAmount || 0}`)
      })
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding test coupons:', error)
    process.exit(1)
  }
}

seedTestCoupons()









import '../database/postgresMongoose'
