import * as dotenv from 'dotenv'
import path from 'path'
import { db } from '../models/client'
import { users } from '../models/schema/users'
import { userProfiles } from '../models/schema/userProfile'
import { eq } from 'drizzle-orm'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

async function createDummyMerchant() {
  try {
    console.log('🚀 Creating dummy merchant user...')

    const email = 'merchant@kourier-boyz.local'
    const phone = '+919876543210'

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    let userId = existingUser?.id

    if (existingUser) {
      console.log('⚠️  Merchant user already exists. Updating...')
      await db
        .update(users)
        .set({
          emailVerified: true,
          phoneVerified: true,
          accountVerified: true,
          phone,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
      console.log('✓ Merchant user updated')
    } else {
      // Create new merchant user
      const newUser = await db
        .insert(users)
        .values({
          email,
          phone,
          emailVerified: true,
          phoneVerified: true,
          accountVerified: true,
          role: 'customer',
        })
        .returning()

      userId = newUser[0].id
      console.log('✓ Merchant user created:', userId)
    }

    // Check if profile exists
    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId!),
    })

    if (existingProfile) {
      console.log('⚠️  Profile already exists. Updating...')
      await db
        .update(userProfiles)
        .set({
          companyInfo: {
            businessName: 'Test Merchant Store',
            contactPerson: 'John Merchant',
            POCEmailVerified: true,
            POCPhoneVerified: true,
            companyAddress: '123 Business Street, Mumbai',
            pincode: '400001',
            state: 'Maharashtra',
            city: 'Mumbai',
            contactNumber: '+919876543210',
            contactEmail: 'merchant@kourier-boyz.local',
            companyContactNumber: '+919876543210',
            brandName: 'Test Store',
            companyEmail: 'merchant@kourier-boyz.local',
            website: 'https://teststore.local',
          },
          businessType: ['b2c'],
          approved: true,
          onboardingComplete: true,
          profileComplete: true,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.userId, userId!))
      console.log('✓ Merchant profile updated')
    } else {
      // Create user profile with approved and onboarding complete
      await db
        .insert(userProfiles)
        .values({
          userId: userId!,
          companyInfo: {
            businessName: 'Test Merchant Store',
            contactPerson: 'John Merchant',
            POCEmailVerified: true,
            POCPhoneVerified: true,
            companyAddress: '123 Business Street, Mumbai',
            pincode: '400001',
            state: 'Maharashtra',
            city: 'Mumbai',
            contactNumber: '+919876543210',
            contactEmail: 'merchant@kourier-boyz.local',
            companyContactNumber: '+919876543210',
            brandName: 'Test Store',
            companyEmail: 'merchant@kourier-boyz.local',
            website: 'https://teststore.local',
          },
          businessType: ['b2c'],
          approved: true,
          onboardingComplete: true,
          profileComplete: true,
          approvedAt: new Date(),
        })
        .returning()

      console.log('✓ Merchant profile created with approved=true, onboardingComplete=true')
    }

    console.log('\n✅ Dummy merchant setup complete!')
    console.log('\n📊 MERCHANT LOGIN (OTP Flow):')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📧 Email: merchant@kourier-boyz.local')
    console.log('📱 Phone: +919876543210')
    console.log('🔐 OTP: Any 6-digit number (validation disabled in dev)')
    console.log('   Example: 123456')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n✨ Account Status:')
    console.log('   ✅ Email Verified')
    console.log('   ✅ Phone Verified')
    console.log('   ✅ Account Verified')
    console.log('   ✅ KYC: Done (approved=true)')
    console.log('   ✅ Onboarding: Complete')
    console.log('   ✅ Profile: Complete')

    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating dummy merchant:', error)
    process.exit(1)
  }
}

createDummyMerchant()
