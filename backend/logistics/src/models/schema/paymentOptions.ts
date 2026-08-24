import { boolean, integer, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Global payment options settings
 * This table stores a single row with global payment options configuration
 */
export const paymentOptions = pgTable('payment_options', {
  id: uuid('id').defaultRandom().primaryKey(),

  // Payment type availability
  codEnabled: boolean('cod_enabled').default(true).notNull(),
  prepaidEnabled: boolean('prepaid_enabled').default(true).notNull(),

  // Minimum wallet recharge amount in smallest currency unit (e.g. INR rupees)
  // 0 = no minimum enforced
  minWalletRecharge: integer('min_wallet_recharge').default(0).notNull(),

  // Minimum wallet balance merchants must keep to continue placing orders
  // 0 = no readiness minimum enforced beyond per-order wallet debit checks
  minAccountWalletBalance: integer('min_account_wallet_balance').default(0).notNull(),

  // GST percentage applied to seller courier wallet debit
  gstPercent: numeric('gst_percent').$type<number>().default(0).notNull(),

  // Metadata
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})
