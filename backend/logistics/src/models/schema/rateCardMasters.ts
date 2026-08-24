import { boolean, date, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const additionalChargeMasters = pgTable('kourier_boyz_additional_charge_masters', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 150 }).notNull(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  defaultMode: varchar('default_mode', { length: 30 }).notNull().default('flat'),
  defaultBasis: varchar('default_basis', { length: 40 }).notNull().default('shipment'),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dieselRates = pgTable('kourier_boyz_diesel_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  dieselRate: numeric('diesel_rate', { precision: 10, scale: 2 }).notNull(),
  effectiveDate: date('effective_date').notNull(),
  remarks: text('remarks'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const internationalRateCards = pgTable('kourier_boyz_international_rate_cards', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 180 }).notNull(),
  originZone: varchar('origin_zone', { length: 20 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const internationalRates = pgTable('kourier_boyz_international_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  rateCardId: uuid('rate_card_id').notNull().references(() => internationalRateCards.id, { onDelete: 'cascade' }),
  deliveryPartner: varchar('delivery_partner', { length: 150 }).notNull(),
  destinationCountry: varchar('destination_country', { length: 120 }).notNull(),
  destinationZone: varchar('destination_zone', { length: 20 }),
  minWeight: numeric('min_weight', { precision: 10, scale: 3 }).notNull().default('0'),
  maxWeight: numeric('max_weight', { precision: 10, scale: 3 }).notNull(),
  baseRate: numeric('base_rate', { precision: 12, scale: 2 }).notNull().default('0'),
  ratePerKg: numeric('rate_per_kg', { precision: 12, scale: 2 }).notNull(),
  fuelSurchargeMode: varchar('fuel_surcharge_mode', { length: 20 }).notNull().default('percentage'),
  fuelSurchargeValue: numeric('fuel_surcharge_value', { precision: 12, scale: 2 }).notNull().default('0'),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  estimatedDays: varchar('estimated_days', { length: 40 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const internationalCountryZones = pgTable('kourier_boyz_international_country_zones', {
  id: uuid('id').primaryKey().defaultRandom(),
  countryName: varchar('country_name', { length: 160 }).notNull(),
  countryKey: varchar('country_key', { length: 180 }).notNull().unique(),
  zoneCode: varchar('zone_code', { length: 20 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
