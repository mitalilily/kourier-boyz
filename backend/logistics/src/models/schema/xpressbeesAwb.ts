import { boolean, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const xpressbeesAwbRanges = pgTable('xpressbees_awb_ranges', {
  id: uuid('id').primaryKey().defaultRandom(),
  startAwb: varchar('start_awb', { length: 64 }).notNull(),
  endAwb: varchar('end_awb', { length: 64 }).notNull(),
  nextAwb: varchar('next_awb', { length: 64 }).notNull(),
  lastAllocatedAwb: varchar('last_allocated_awb', { length: 64 }),
  status: varchar('status', { length: 24 }).notNull().default('active'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  exhaustedAt: timestamp('exhausted_at', { withTimezone: true }),
})

export const xpressbeesAwbAllocations = pgTable('xpressbees_awb_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  rangeId: uuid('range_id')
    .references(() => xpressbeesAwbRanges.id)
    .notNull(),
  awbNumber: varchar('awb_number', { length: 64 }).notNull().unique(),
  status: varchar('status', { length: 24 }).notNull().default('reserved'),
  orderNumber: varchar('order_number', { length: 100 }),
  localOrderId: uuid('local_order_id'),
  userId: uuid('user_id'),
  providerReference: varchar('provider_reference', { length: 120 }),
  failureReason: text('failure_reason'),
  providerResponse: jsonb('provider_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),
})
