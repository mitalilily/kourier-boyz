import { randomUUID } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../models/client'
import { plans } from '../schema/schema'

const ensureBasicPlan = async (businessType: 'b2c' | 'b2b', description: string) => {
  const existing = await db
    .select()
    .from(plans)
    .where(and(eq(plans.name, 'Basic'), eq(plans.business_type, businessType)))
    .limit(1)

  if (existing.length > 0) {
    console.log(`Basic ${businessType.toUpperCase()} plan already exists:`, existing[0])
    return existing[0]
  }

  const [plan] = await db
    .insert(plans)
    .values({
      id: randomUUID(),
      name: 'Basic',
      description,
      business_type: businessType,
      created_at: new Date(),
    })
    .returning()

  console.log(`Seeded Basic ${businessType.toUpperCase()} plan:`, plan)
  return plan
}

async function seedBasicPlan() {
  await ensureBasicPlan('b2c', 'Default B2C plan assigned to all new users')
  await ensureBasicPlan('b2b', 'Default B2B plan assigned to all users')
}

seedBasicPlan()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
