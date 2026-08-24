import { jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const ftlRequests = pgTable('ftl_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  requestNumber: varchar('request_number', { length: 60 }).notNull().unique(),
  customerName: varchar('customer_name', { length: 160 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 30 }).notNull(),
  customerEmail: varchar('customer_email', { length: 160 }),
  companyName: varchar('company_name', { length: 180 }),
  originCity: varchar('origin_city', { length: 120 }).notNull(),
  originState: varchar('origin_state', { length: 120 }),
  originPincode: varchar('origin_pincode', { length: 20 }).notNull(),
  originAddress: text('origin_address'),
  destinationCity: varchar('destination_city', { length: 120 }).notNull(),
  destinationState: varchar('destination_state', { length: 120 }),
  destinationPincode: varchar('destination_pincode', { length: 20 }).notNull(),
  destinationAddress: text('destination_address'),
  vehicleType: varchar('vehicle_type', { length: 120 }).notNull(),
  materialType: varchar('material_type', { length: 160 }).notNull(),
  weightKg: numeric('weight_kg').$type<number>(),
  truckCount: numeric('truck_count').$type<number>().default(1),
  loadingDate: timestamp('loading_date', { withTimezone: true }),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).default('requested').notNull(),
  awbNumber: varchar('awb_number', { length: 100 }),
  processedDate: timestamp('processed_date', { withTimezone: true }),
  adminNotes: text('admin_notes'),
  formData: jsonb('form_data').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})
