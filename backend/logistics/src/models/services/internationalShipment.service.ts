import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '../client'
import { internationalShipments } from '../schema/internationalShipments'
import { users } from '../schema/users'
import { createNotificationService } from './notifications.service'

export const INTERNATIONAL_SHIPMENT_STATUSES = [
  'requested',
  'reviewing',
  'booked',
  'in_transit',
  'delivered',
  'cancelled',
] as const

const trim = (value: unknown) => String(value ?? '').trim()
const shipmentNumber = () =>
  `INT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

export async function createInternationalShipment(input: any) {
  const [row] = await db
    .insert(internationalShipments)
    .values({
      userId: input.userId,
      shipmentNumber: shipmentNumber(),
      pickupId: trim(input.pickupId) || null,
      consigneeName: trim(input.consigneeName),
      consigneePhone: trim(input.consigneePhone),
      consigneeAlternatePhone: trim(input.consigneeAlternatePhone) || null,
      consigneeEmail: trim(input.consigneeEmail) || null,
      consigneeGstin: trim(input.consigneeGstin) || null,
      addressLine1: trim(input.addressLine1),
      addressLine2: trim(input.addressLine2) || null,
      landmark: trim(input.landmark) || null,
      destinationPincode: trim(input.destinationPincode),
      destinationCity: trim(input.destinationCity),
      destinationState: trim(input.destinationState),
      destinationCountry: trim(input.destinationCountry),
      paymentMethod: trim(input.paymentMethod) || 'prepaid',
      rov: trim(input.rov) || null,
      itemType: trim(input.itemType) || null,
      itemCategory: trim(input.itemCategory) || null,
      shippingMode: trim(input.shippingMode) || null,
      products: input.products || [],
      packages: input.packages || [],
      orderValue: Number.isFinite(Number(input.orderValue)) ? Number(input.orderValue) : undefined,
      applicableWeight: Number.isFinite(Number(input.applicableWeight)) ? Number(input.applicableWeight) : undefined,
      invoiceNumber: trim(input.invoiceNumber) || null,
      orderDate: input.orderDate ? new Date(input.orderDate) : undefined,
      ewayBillNo: trim(input.ewayBillNo) || null,
      customerReferenceNo: trim(input.customerReferenceNo) || null,
      sellerName: trim(input.sellerName) || null,
      rateQuote: input.rateQuote || null,
      formData: input,
    })
    .returning()

  await createNotificationService({
    targetRole: 'admin',
    title: 'New International Shipment',
    message: `${row.consigneeName} submitted ${row.shipmentNumber} for ${row.destinationCountry}.`,
    sendEmail: false,
  })

  return row
}

export async function listUserInternationalShipments(userId: string, page = 1, limit = 10, filters: any = {}) {
  const offset = (page - 1) * limit
  const conditions = [eq(internationalShipments.userId, userId)]
  if (filters.status) conditions.push(eq(internationalShipments.status, filters.status))
  if (filters.search) {
    const q = `%${filters.search}%`
    conditions.push(
      or(
        ilike(internationalShipments.shipmentNumber, q),
        ilike(internationalShipments.awbNumber, q),
        ilike(internationalShipments.consigneeName, q),
        ilike(internationalShipments.destinationCountry, q),
      )!,
    )
  }
  const where = and(...conditions)
  const rows = await db.select().from(internationalShipments).where(where).orderBy(desc(internationalShipments.createdAt)).limit(limit).offset(offset)
  const [{ count: totalCount } = { count: 0 }] = await db.select({ count: count() }).from(internationalShipments).where(where)
  return { shipments: rows, totalCount: Number(totalCount), totalPages: Math.ceil(Number(totalCount) / limit) || 1 }
}

export async function listAdminInternationalShipments(page = 1, limit = 10, filters: any = {}) {
  const offset = (page - 1) * limit
  const conditions = []
  if (filters.status) conditions.push(eq(internationalShipments.status, filters.status))
  if (filters.search) {
    const q = `%${filters.search}%`
    conditions.push(
      or(
        ilike(internationalShipments.shipmentNumber, q),
        ilike(internationalShipments.awbNumber, q),
        ilike(internationalShipments.consigneeName, q),
        ilike(users.email, q),
      )!,
    )
  }
  const where = conditions.length ? and(...conditions) : undefined
  const rows = await db
    .select({ shipment: internationalShipments, userEmail: users.email })
    .from(internationalShipments)
    .leftJoin(users, eq(internationalShipments.userId, users.id))
    .where(where)
    .orderBy(desc(internationalShipments.createdAt))
    .limit(limit)
    .offset(offset)
  const [{ count: totalCount } = { count: 0 }] = await db.select({ count: count() }).from(internationalShipments).leftJoin(users, eq(internationalShipments.userId, users.id)).where(where)
  return { shipments: rows.map((row) => ({ ...row.shipment, userEmail: row.userEmail })), totalCount: Number(totalCount), totalPages: Math.ceil(Number(totalCount) / limit) || 1 }
}

export async function updateAdminInternationalShipment(id: string, input: any) {
  const status = input.status ? trim(input.status) : undefined
  if (status && !INTERNATIONAL_SHIPMENT_STATUSES.includes(status as any)) throw new Error('Invalid international shipment status')
  const [row] = await db
    .update(internationalShipments)
    .set({
      ...(status ? { status } : {}),
      ...(input.awbNumber !== undefined ? { awbNumber: trim(input.awbNumber) || null } : {}),
      ...(input.bookedDate !== undefined ? { bookedDate: input.bookedDate } : {}),
      ...(input.adminNotes !== undefined ? { adminNotes: trim(input.adminNotes) || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(internationalShipments.id, id))
    .returning()
  if (!row) throw new Error('International shipment not found')
  return row
}
