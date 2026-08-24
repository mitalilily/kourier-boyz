import { and, count, desc, eq, ilike, or } from 'drizzle-orm'
import { db } from '../client'
import { ftlRequests } from '../schema/ftlRequests'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { createNotificationService } from './notifications.service'

export const FTL_STATUSES = [
  'requested',
  'reviewing',
  'quote_shared',
  'processed',
  'in_transit',
  'delivered',
  'cancelled',
] as const

export type FtlStatus = (typeof FTL_STATUSES)[number]

export type CreateFtlRequestInput = {
  userId: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  companyName?: string
  originCity: string
  originState?: string
  originPincode: string
  originAddress?: string
  destinationCity: string
  destinationState?: string
  destinationPincode: string
  destinationAddress?: string
  vehicleType: string
  materialType: string
  weightKg?: number
  truckCount?: number
  loadingDate?: Date
  notes?: string
  formData?: Record<string, unknown>
}

const asTrimmed = (value: unknown) => String(value ?? '').trim()

const generateRequestNumber = () =>
  `FTL-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`

export async function createFtlRequest(input: CreateFtlRequestInput) {
  const [row] = await db
    .insert(ftlRequests)
    .values({
      userId: input.userId,
      requestNumber: generateRequestNumber(),
      customerName: asTrimmed(input.customerName),
      customerPhone: asTrimmed(input.customerPhone),
      customerEmail: asTrimmed(input.customerEmail) || null,
      companyName: asTrimmed(input.companyName) || null,
      originCity: asTrimmed(input.originCity),
      originState: asTrimmed(input.originState) || null,
      originPincode: asTrimmed(input.originPincode),
      originAddress: asTrimmed(input.originAddress) || null,
      destinationCity: asTrimmed(input.destinationCity),
      destinationState: asTrimmed(input.destinationState) || null,
      destinationPincode: asTrimmed(input.destinationPincode),
      destinationAddress: asTrimmed(input.destinationAddress) || null,
      vehicleType: asTrimmed(input.vehicleType),
      materialType: asTrimmed(input.materialType),
      weightKg: input.weightKg,
      truckCount: input.truckCount || 1,
      loadingDate: input.loadingDate,
      notes: asTrimmed(input.notes) || null,
      formData: input.formData || null,
    })
    .returning()

  await createNotificationService({
    targetRole: 'admin',
    title: 'New FTL Request',
    message: `${row.customerName} submitted ${row.requestNumber} for ${row.originCity} to ${row.destinationCity}.`,
    sendEmail: false,
  })

  return row
}

export async function listUserFtlRequests(
  userId: string,
  page = 1,
  limit = 10,
  filters: { status?: string; search?: string } = {},
) {
  const offset = (page - 1) * limit
  const conditions = [eq(ftlRequests.userId, userId)]

  if (filters.status) conditions.push(eq(ftlRequests.status, filters.status))
  if (filters.search) {
    const search = `%${filters.search}%`
    conditions.push(
      or(
        ilike(ftlRequests.requestNumber, search),
        ilike(ftlRequests.awbNumber, search),
        ilike(ftlRequests.originCity, search),
        ilike(ftlRequests.destinationCity, search),
      )!,
    )
  }

  const where = and(...conditions)
  const rows = await db
    .select()
    .from(ftlRequests)
    .where(where)
    .orderBy(desc(ftlRequests.createdAt))
    .limit(limit)
    .offset(offset)
  const [{ count: totalCount } = { count: 0 }] = await db
    .select({ count: count() })
    .from(ftlRequests)
    .where(where)

  return { requests: rows, totalCount: Number(totalCount), totalPages: Math.ceil(Number(totalCount) / limit) || 1 }
}

export async function listAdminFtlRequests(
  page = 1,
  limit = 10,
  filters: { status?: string; search?: string } = {},
) {
  const offset = (page - 1) * limit
  const conditions = []

  if (filters.status) conditions.push(eq(ftlRequests.status, filters.status))
  if (filters.search) {
    const search = `%${filters.search}%`
    conditions.push(
      or(
        ilike(ftlRequests.requestNumber, search),
        ilike(ftlRequests.awbNumber, search),
        ilike(ftlRequests.customerName, search),
        ilike(ftlRequests.customerPhone, search),
        ilike(users.email, search),
      )!,
    )
  }

  const where = conditions.length ? and(...conditions) : undefined
  const rows = await db
    .select({
      request: ftlRequests,
      userEmail: users.email,
      companyInfo: userProfiles.companyInfo,
    })
    .from(ftlRequests)
    .leftJoin(users, eq(ftlRequests.userId, users.id))
    .leftJoin(userProfiles, eq(ftlRequests.userId, userProfiles.userId))
    .where(where)
    .orderBy(desc(ftlRequests.createdAt))
    .limit(limit)
    .offset(offset)

  const [{ count: totalCount } = { count: 0 }] = await db
    .select({ count: count() })
    .from(ftlRequests)
    .leftJoin(users, eq(ftlRequests.userId, users.id))
    .where(where)

  return {
    requests: rows.map((row) => ({
      ...row.request,
      userEmail: row.userEmail,
      profileCompanyName:
        typeof row.companyInfo === 'object' && row.companyInfo
          ? (row.companyInfo as any).companyName || (row.companyInfo as any).businessName || null
          : null,
    })),
    totalCount: Number(totalCount),
    totalPages: Math.ceil(Number(totalCount) / limit) || 1,
  }
}

export async function updateAdminFtlRequest(
  id: string,
  input: { status?: string; awbNumber?: string; processedDate?: Date | null; adminNotes?: string },
) {
  const status = input.status ? asTrimmed(input.status) : undefined
  if (status && !FTL_STATUSES.includes(status as FtlStatus)) {
    throw new Error('Invalid FTL status')
  }

  const [row] = await db
    .update(ftlRequests)
    .set({
      ...(status ? { status } : {}),
      ...(input.awbNumber !== undefined ? { awbNumber: asTrimmed(input.awbNumber) || null } : {}),
      ...(input.processedDate !== undefined ? { processedDate: input.processedDate } : {}),
      ...(input.adminNotes !== undefined ? { adminNotes: asTrimmed(input.adminNotes) || null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(ftlRequests.id, id))
    .returning()

  if (!row) throw new Error('FTL request not found')
  return row
}
