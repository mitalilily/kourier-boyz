import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../models/client'
import { plans, userPlans, users } from '../schema/schema'

async function assignBasicPlans() {
  const basicPlans = await db.select().from(plans).where(eq(plans.name, 'Basic'))
  const basicB2CPlan = basicPlans.find((plan) => plan.business_type === 'b2c')
  const basicB2BPlan = basicPlans.find((plan) => plan.business_type === 'b2b')

  if (!basicB2CPlan || !basicB2BPlan) {
    throw new Error('Basic B2C/B2B plans not found. Run seedBasicPlan.ts first.')
  }

  const appUsers = await db.select().from(users).where(eq(users.role, 'customer'))
  console.log(`Found ${appUsers.length} users with role "customer".`)

  for (const user of appUsers) {
    const existingB2C = await db
      .select()
      .from(userPlans)
      .where(and(eq(userPlans.userId, user.id), eq(userPlans.business_type, 'b2c')))
      .limit(1)
    const existingB2B = await db
      .select()
      .from(userPlans)
      .where(and(eq(userPlans.userId, user.id), eq(userPlans.business_type, 'b2b')))
      .limit(1)

    if (!existingB2C.length) {
      await db.insert(userPlans).values({
        id: randomUUID(),
        userId: user.id,
        plan_id: basicB2CPlan.id,
        business_type: 'b2c',
        assigned_at: new Date(),
        is_active: true,
      })
      console.log(`Assigned Basic B2C plan to ${user.email}`)
    }

    if (!existingB2B.length) {
      await db.insert(userPlans).values({
        id: randomUUID(),
        userId: user.id,
        plan_id: basicB2BPlan.id,
        business_type: 'b2b',
        assigned_at: new Date(),
        is_active: true,
      })
      console.log(`Assigned Basic B2B plan to ${user.email}`)
    }
  }

  console.log('Done seeding Basic B2C/B2B plans to users.')
}

assignBasicPlans()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
