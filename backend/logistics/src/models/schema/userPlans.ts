import { boolean, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const userPlans = pgTable(
  'user_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    plan_id: uuid('plan_id').notNull(), // FK to plans.id
    business_type: varchar('business_type', { length: 20 }).default('b2c').notNull(),
    assigned_at: timestamp('assigned_at').defaultNow(),
    is_active: boolean('is_active').default(true),
  },
  (table) => ({
    userBusinessTypeUnique: uniqueIndex('user_plans_user_business_type_unique').on(
      table.userId,
      table.business_type,
    ),
  }),
)
