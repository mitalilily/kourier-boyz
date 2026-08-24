import { jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { addresses, pickupAddresses } from './pickupAddresses'
import { users } from './users'

export const courier_registration_errors = pgTable('courier_registration_errors', {
  id: uuid('id').defaultRandom().primaryKey(),
  user_id: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  operation: varchar('operation', { length: 50 }).notNull(),
  address_id: uuid('address_id').references(() => addresses.id, { onDelete: 'set null' }),
  pickup_address_id: uuid('pickup_address_id').references(() => pickupAddresses.id, {
    onDelete: 'set null',
  }),
  warehouse_alias: varchar('warehouse_alias', { length: 255 }),
  error_code: varchar('error_code', { length: 100 }),
  error_message: text('error_message').notNull(),
  error_payload: jsonb('error_payload').$type<Record<string, any> | null>(),
  request_payload: jsonb('request_payload').$type<Record<string, any> | null>(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
