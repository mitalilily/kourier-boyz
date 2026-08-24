import { boolean, decimal, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { plans } from './plans'

export const shippingRates = pgTable('shipping_rates', {
  id: uuid('id').primaryKey().defaultRandom(),
  plan_id: uuid('plan_id')
    .references(() => plans.id, { onDelete: 'cascade' })
    .notNull(),
  service_provider: varchar('service_provider', { length: 50 }),
  cod_charges: decimal('cod_charges', { precision: 10, scale: 2 }),
  cod_percent: decimal('cod_percent', { precision: 5, scale: 2 }),
  other_charges: decimal('other_charges', { precision: 10, scale: 2 }),
  rate: decimal('rate', { precision: 10, scale: 2 }).notNull(),
  last_updated: timestamp('last_updated').defaultNow(),
  courier_id: integer('courier_id').notNull(),
  courier_name: varchar('courier_name', { length: 100 }).notNull(),
  mode: varchar('mode', { length: 50 }).notNull(),
  business_type: varchar('business_type', { length: 10 }).notNull(), // 'b2b' or 'b2c'
  min_weight: decimal('min_weight', { precision: 10, scale: 2 }).notNull(),
  zone_id: uuid('zone_id').notNull(), // FK to zones.id
  type: varchar('type', { length: 20 }).notNull(), // forward / rto
  created_at: timestamp('created_at').defaultNow(),
})

export const shippingRateSlabs = pgTable('shipping_rate_slabs', {
  id: uuid('id').primaryKey().defaultRandom(),
  shipping_rate_id: uuid('shipping_rate_id')
    .references(() => shippingRates.id, { onDelete: 'cascade' })
    .notNull(),
  weight_from: decimal('weight_from', { precision: 10, scale: 3 }).notNull(), // kg inclusive
  weight_to: decimal('weight_to', { precision: 10, scale: 3 }), // kg inclusive; null = open ended
  rate: decimal('rate', { precision: 10, scale: 2 }).notNull(),
  extra_rate: decimal('extra_rate', { precision: 10, scale: 2 }),
  extra_weight_unit: decimal('extra_weight_unit', { precision: 10, scale: 3 }),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
})

export const b2cCourierRateConfigs = pgTable(
  'kourier_boyz_b2c_courier_rate_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
    courierId: integer('courier_id').notNull(),
    serviceProvider: varchar('service_provider', { length: 100 }).notNull().default(''),
    mode: varchar('mode', { length: 50 }).notNull().default('surface'),
    useShippingChargeApi: boolean('use_shipping_charge_api').notNull().default(false),
    fscPercentage: decimal('fsc_percentage', { precision: 8, scale: 2 }),
    minimumCodCharge: decimal('minimum_cod_charge', { precision: 10, scale: 2 }),
    codChargePercentage: decimal('cod_charge_percentage', { precision: 8, scale: 2 }),
    toPayCharge: decimal('to_pay_charge', { precision: 10, scale: 2 }),
    minimumRasCharge: decimal('minimum_ras_charge', { precision: 10, scale: 2 }),
    rasChargePerKg: decimal('ras_charge_per_kg', { precision: 10, scale: 2 }),
    minimumCriticalPickupCharge: decimal('minimum_critical_pickup_charge', { precision: 10, scale: 2 }),
    criticalPickupChargePerKg: decimal('critical_pickup_charge_per_kg', { precision: 10, scale: 2 }),
    minimumCriticalDeliveryCharge: decimal('minimum_critical_delivery_charge', { precision: 10, scale: 2 }),
    criticalDeliveryChargePerKg: decimal('critical_delivery_charge_per_kg', { precision: 10, scale: 2 }),
    additionRules: jsonb('addition_rules').$type<Array<Record<string, unknown>>>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    scopeUnique: uniqueIndex('b2c_courier_rate_config_scope_unique').on(
      table.planId,
      table.courierId,
      table.serviceProvider,
      table.mode,
    ),
  }),
)
