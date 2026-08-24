/**
 * One-time script: Mark onboarding tour as complete for existing sellers.
 * Run this once after deploying the seller onboarding tour so existing users
 * don't see the tour auto-show.
 *
 * Usage: npx ts-node src/scripts/markTourCompleteExisting.ts
 * Or: npm run mark-tour-complete-existing
 */

import mongoose from 'mongoose'
import User from '../models/User'

const run = async () => {
  try {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) throw new Error('DATABASE_URL is required')
    await mongoose.connect(databaseUrl)
    console.log('Connected to PostgreSQL')

    const result = await User.updateMany(
      {
        role: 'seller',
        $or: [{ onboardingTourCompletedAt: { $exists: false } }, { onboardingTourCompletedAt: null }],
      },
      { $set: { onboardingTourCompletedAt: new Date() } }
    )

    console.log(`Marked onboarding tour complete for ${result.modifiedCount} existing seller(s).`)
    if (result.matchedCount > result.modifiedCount) {
      console.log(`(${result.matchedCount - result.modifiedCount} already had tour completed.)`)
    }

    await mongoose.disconnect()
    console.log('Done.')
    process.exit(0)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

run()
import '../database/postgresMongoose'
