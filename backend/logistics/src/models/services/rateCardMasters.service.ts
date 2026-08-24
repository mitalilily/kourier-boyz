import { desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { additionalChargeMasters, dieselRates } from '../schema/rateCardMasters'

const makeCode = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export const listAdditionalChargeMasters = () =>
  db.select().from(additionalChargeMasters).orderBy(desc(additionalChargeMasters.createdAt))

export const createAdditionalChargeMaster = async (input: any) => {
  const code = makeCode(input.code || input.name || '')
  if (!input.name?.trim()) throw new Error('Charge name is required')
  if (!code) throw new Error('A valid code is required')
  const [record] = await db.insert(additionalChargeMasters).values({
    name: input.name.trim(),
    code,
    defaultMode: input.defaultMode || 'flat',
    defaultBasis: input.defaultBasis || 'shipment',
    description: input.description?.trim() || null,
    isActive: input.isActive !== false,
  }).returning()
  return record
}

export const updateAdditionalChargeMaster = async (id: string, input: any) => {
  const changes: any = { updatedAt: new Date() }
  if (input.name !== undefined) changes.name = input.name.trim()
  if (input.code !== undefined) changes.code = makeCode(input.code || input.name || '')
  if (input.defaultMode !== undefined) changes.defaultMode = input.defaultMode
  if (input.defaultBasis !== undefined) changes.defaultBasis = input.defaultBasis
  if (input.description !== undefined) changes.description = input.description?.trim() || null
  if (input.isActive !== undefined) changes.isActive = Boolean(input.isActive)
  const [record] = await db.update(additionalChargeMasters).set(changes).where(eq(additionalChargeMasters.id, id)).returning()
  if (!record) throw new Error('Additional charge master not found')
  return record
}

export const deleteAdditionalChargeMaster = (id: string) =>
  db.delete(additionalChargeMasters).where(eq(additionalChargeMasters.id, id))

export const listDieselRates = () =>
  db.select().from(dieselRates).orderBy(desc(dieselRates.effectiveDate), desc(dieselRates.createdAt))

export const createDieselRate = async (input: any) => {
  const rate = Number(input.dieselRate)
  if (!Number.isFinite(rate) || rate < 0) throw new Error('A valid diesel rate is required')
  if (!input.effectiveDate) throw new Error('Effective date is required')
  const [record] = await db.insert(dieselRates).values({
    dieselRate: rate.toFixed(2),
    effectiveDate: input.effectiveDate,
    remarks: input.remarks?.trim() || null,
    isActive: input.isActive !== false,
  }).returning()
  return record
}

export const updateDieselRate = async (id: string, input: any) => {
  const changes: any = { updatedAt: new Date() }
  if (input.dieselRate !== undefined) {
    const rate = Number(input.dieselRate)
    if (!Number.isFinite(rate) || rate < 0) throw new Error('A valid diesel rate is required')
    changes.dieselRate = rate.toFixed(2)
  }
  if (input.effectiveDate !== undefined) changes.effectiveDate = input.effectiveDate
  if (input.remarks !== undefined) changes.remarks = input.remarks?.trim() || null
  if (input.isActive !== undefined) changes.isActive = Boolean(input.isActive)
  const [record] = await db.update(dieselRates).set(changes).where(eq(dieselRates.id, id)).returning()
  if (!record) throw new Error('Diesel rate not found')
  return record
}

export const deleteDieselRate = (id: string) => db.delete(dieselRates).where(eq(dieselRates.id, id))
