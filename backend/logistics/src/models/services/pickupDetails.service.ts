import { and, desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { addresses, pickupAddresses } from '../schema/pickupAddresses'
import { userProfiles } from '../schema/userProfile'

export type ResolvedPickupDetails = Record<string, any>

type PickupSourceRow = {
  pickupLocationId?: string | null
  addressNickname?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  contactName?: string | null
  contactPhone?: string | null
  gstNumber?: string | null
}

const trimText = (value: unknown) => String(value ?? '').trim()

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    const text = trimText(value)
    if (text) return text
  }
  return ''
}

const parseObject = (value: unknown): Record<string, any> | null => {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : null
}

const AWB_KEY_PATTERN = /(awb|waybill|airwaybill|air_waybill|tracking_number)/i

const INVALID_AWB_VALUES = new Set([
  'pending',
  'completed',
  'cancelled',
  'delivered',
  'failed',
  'success',
])

const normalizeAwbCandidate = (value: unknown) => {
  const text = trimText(value)
  if (!text) return ''
  const lower = text.toLowerCase()
  if (lower.startsWith('status_')) return ''
  if (INVALID_AWB_VALUES.has(lower)) return ''
  if (text.length < 6) return ''
  return text
}

const findAwbLikeValue = (value: unknown, seen = new Set<unknown>()): string | null => {
  if (!value) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = normalizeAwbCandidate(value)
    return text || null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = findAwbLikeValue(item, seen)
      if (candidate) return candidate
    }
    return null
  }
  if (typeof value !== 'object') return null

  const record = value as Record<string, any>
  if (seen.has(record)) return null
  seen.add(record)

  for (const [key, nestedValue] of Object.entries(record)) {
    if (AWB_KEY_PATTERN.test(key)) {
      const candidate = findAwbLikeValue(nestedValue, seen)
      if (candidate) return candidate
    }
  }

  for (const nestedValue of Object.values(record)) {
    if (nestedValue && typeof nestedValue === 'object') {
      const candidate = findAwbLikeValue(nestedValue, seen)
      if (candidate) return candidate
    }
  }

  return null
}

const mergeDefinedValues = (...sources: Array<Record<string, any> | null | undefined>) => {
  const merged: Record<string, any> = {}

  for (const source of sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined || value === null) continue
      if (typeof value === 'string' && !value.trim()) continue
      if (merged[key] === undefined || merged[key] === null) {
        merged[key] = value
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : null
}

const buildProfilePickupDetails = (profileRow: any): ResolvedPickupDetails | null => {
  const companyInfo = (profileRow?.companyInfo || {}) as Record<string, any>
  const gstDetails = (profileRow?.gstDetails || {}) as Record<string, any>

  const warehouseName = firstText(
    companyInfo.brandName,
    companyInfo.businessName,
    companyInfo.companyName,
    companyInfo.displayName,
    companyInfo.contactPerson,
    'Seller',
  )
  const address = firstText(companyInfo.companyAddress, companyInfo.address)
  const city = firstText(companyInfo.city)
  const state = firstText(companyInfo.state)
  const pincode = firstText(companyInfo.pincode)
  const phone = firstText(companyInfo.companyContactNumber, companyInfo.contactNumber)
  const name = firstText(companyInfo.contactPerson, companyInfo.brandName, companyInfo.businessName, companyInfo.companyName)
  const gstNumber = firstText(gstDetails.gstNumber, companyInfo.gstNumber, companyInfo.gst, companyInfo.companyGst)

  const details: ResolvedPickupDetails = {
    warehouse_name: warehouseName,
    name: name || warehouseName,
    address,
    city,
    state,
    pincode,
    phone,
  }

  if (gstNumber) {
    details.gst_number = gstNumber
  }

  return mergeDefinedValues(details)
}

const buildAddressPickupDetails = (pickupRow: PickupSourceRow | null): ResolvedPickupDetails | null => {
  if (!pickupRow) return null

  const details: ResolvedPickupDetails = {
    warehouse_name: firstText(pickupRow.addressNickname, pickupRow.contactName),
    name: firstText(pickupRow.contactName, pickupRow.addressNickname),
    address: firstText(pickupRow.addressLine1),
    address_2: firstText(pickupRow.addressLine2),
    city: firstText(pickupRow.city),
    state: firstText(pickupRow.state),
    pincode: firstText(pickupRow.pincode),
    phone: firstText(pickupRow.contactPhone),
  }

  const gstNumber = firstText(pickupRow.gstNumber)
  if (gstNumber) {
    details.gst_number = gstNumber
  }

  return mergeDefinedValues(details)
}

const fetchPrimaryPickupAddress = async (userId: string, pickupLocationId?: string | null, tx: any = db) => {
  const normalizedPickupLocationId = trimText(pickupLocationId)
  const whereClause = normalizedPickupLocationId
    ? and(
        eq(pickupAddresses.userId, userId),
        eq(pickupAddresses.id, normalizedPickupLocationId),
        eq(pickupAddresses.isPickupEnabled, true),
      )
    : and(eq(pickupAddresses.userId, userId), eq(pickupAddresses.isPickupEnabled, true))

  const rows = await tx
    .select({
      pickupLocationId: pickupAddresses.id,
      addressNickname: addresses.addressNickname,
      addressLine1: addresses.addressLine1,
      addressLine2: addresses.addressLine2,
      city: addresses.city,
      state: addresses.state,
      pincode: addresses.pincode,
      contactName: addresses.contactName,
      contactPhone: addresses.contactPhone,
      gstNumber: addresses.gstNumber,
    })
    .from(pickupAddresses)
    .innerJoin(addresses, eq(pickupAddresses.addressId, addresses.id))
    .where(whereClause)
    .orderBy(desc(pickupAddresses.isPrimary))
    .limit(1)

  return (rows[0] as PickupSourceRow | undefined) ?? null
}

export const resolvePickupDetailsForOrder = async (
  userId: string,
  tx: any = db,
  order?: { pickup_details?: unknown; pickup_location_id?: string | null } | null,
  profileOverride?: any,
) => {
  const orderPickupDetails = parseObject(order?.pickup_details)
  const pickupAddressRow = await fetchPrimaryPickupAddress(userId, order?.pickup_location_id, tx)
  const profileRow =
    profileOverride ??
    (await tx
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1)
      .then((rows: any[]) => rows[0] ?? null))

  const resolved = mergeDefinedValues(
    orderPickupDetails,
    buildAddressPickupDetails(pickupAddressRow),
    buildProfilePickupDetails(profileRow),
  )
  const pickupLocationId =
    trimText(pickupAddressRow?.pickupLocationId) || trimText(order?.pickup_location_id) || null

  return {
    pickupLocationId,
    pickupDetails: resolved,
  }
}

export const resolveOrderAwbNumber = (order: any) => {
  const providerMeta = parseObject(order?.provider_meta)
  const candidates = [
    order?.awb_number,
    providerMeta?.awb_number,
    providerMeta?.awbNumber,
    providerMeta?.waybill,
    providerMeta?.AirWayBillNO,
    providerMeta?.awb,
    providerMeta?.tracking_number,
    findAwbLikeValue(order),
    order?.provider_reference,
    order?.provider_request_id,
    findAwbLikeValue(providerMeta),
  ]

  for (const candidate of candidates) {
    const normalized = normalizeAwbCandidate(candidate)
    if (normalized) return normalized
  }

  return null
}
