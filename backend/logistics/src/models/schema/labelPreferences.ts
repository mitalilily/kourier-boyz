import { sql } from 'drizzle-orm'
import { integer, jsonb, pgTableCreator, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

const createTable = pgTableCreator((name) => `kourier_boyz_${name}`)

export const labelPreferences = createTable('label_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),

  user_id: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  printer_type: varchar('printer_type', { length: 20 }).notNull().default('thermal'),

  order_info: jsonb('order_info')
    .default(
      sql`'{
        "alternatePhone": false,
        "billingGstin": false,
        "ewayBillNumber": false
      }'::jsonb`,
    )
    .notNull(),

  shipper_info: jsonb('shipper_info')
    .default(
      sql`'{
        "brandLogo": true,
        "shipperName": true,
        "shipperAddress": true,
        "shipperPhone": true,
        "gstin": true,
        "returnName": true,
        "returnAddress": true,
        "returnPhone": true
      }'::jsonb`,
    )
    .notNull(),

  product_info: jsonb('product_info')
    .default(
      sql`'{
        "productCost": true
      }'::jsonb`,
    )
    .notNull(),

  char_limit: integer('char_limit').default(30).notNull(),
  max_items: integer('max_items').default(4).notNull(),

  brand_logo: text('brand_logo'), // S3 key or URL
  powered_by: varchar('powered_by', { length: 120 }).default('Kourier Boyz'),

  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
