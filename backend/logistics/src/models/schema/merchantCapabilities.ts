import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const merchantCapabilities = pgTable('merchant_capabilities', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  shippingStatus: varchar('shipping_status', { length: 32 }).notNull().default('onboarding'),
  marketplaceStatus: varchar('marketplace_status', { length: 32 })
    .notNull()
    .default('not_requested'),
  preferredWorkspace: varchar('preferred_workspace', { length: 20 }),
  firstChoiceCompleted: boolean('first_choice_completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date()),
})
