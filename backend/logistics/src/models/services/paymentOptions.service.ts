import { db } from '../client'
import { paymentOptions } from '../schema/paymentOptions'
import { normalizeGstPercent } from '../../utils/gst'
import { sql } from 'drizzle-orm'

let paymentOptionsSchemaReady: Promise<void> | null = null

const ensurePaymentOptionsSchema = () => {
  if (!paymentOptionsSchemaReady) {
    paymentOptionsSchemaReady = db
      .execute(sql`
        ALTER TABLE payment_options
          ADD COLUMN IF NOT EXISTS min_account_wallet_balance INTEGER DEFAULT 0,
          ADD COLUMN IF NOT EXISTS gst_percent NUMERIC(6, 2) DEFAULT '0'
      `)
      .then(() =>
        db.execute(sql`
          UPDATE payment_options
          SET
            min_account_wallet_balance = COALESCE(min_account_wallet_balance, 0),
            gst_percent = COALESCE(gst_percent, '0')
          WHERE min_account_wallet_balance IS NULL OR gst_percent IS NULL
        `),
      )
      .then(() =>
        db.execute(sql`
          ALTER TABLE payment_options
            ALTER COLUMN min_account_wallet_balance SET DEFAULT 0,
            ALTER COLUMN min_account_wallet_balance SET NOT NULL,
            ALTER COLUMN gst_percent SET DEFAULT '0',
            ALTER COLUMN gst_percent SET NOT NULL
        `),
      )
      .then(() => undefined)
      .catch((err) => {
        paymentOptionsSchemaReady = null
        throw err
      })
  }

  return paymentOptionsSchemaReady
}

/**
 * Get payment options settings
 * Returns the first (and only) row, or creates default if none exists
 */
export async function getPaymentOptions() {
  await ensurePaymentOptionsSchema()

  const [settings] = await db.select().from(paymentOptions).limit(1)

  if (settings) {
    return settings
  }

  // Create default settings (both enabled by default)
  const [newSettings] = await db
    .insert(paymentOptions)
    .values({
      codEnabled: true,
      prepaidEnabled: true,
      minWalletRecharge: 0,
      minAccountWalletBalance: 0,
      gstPercent: 0,
    })
    .returning()

  return newSettings
}

/**
 * Update payment options settings
 */
export async function updatePaymentOptions(updates: {
  codEnabled?: boolean
  prepaidEnabled?: boolean
  minWalletRecharge?: number
  minAccountWalletBalance?: number
  gstPercent?: number
}) {
  // Ensure settings exist
  await getPaymentOptions()

  const updateData: any = { updatedAt: new Date() }

  if (updates.codEnabled !== undefined) {
    updateData.codEnabled = updates.codEnabled
  }
  if (updates.prepaidEnabled !== undefined) {
    updateData.prepaidEnabled = updates.prepaidEnabled
  }
  if (updates.minWalletRecharge !== undefined) {
    const value = Number(updates.minWalletRecharge)
    updateData.minWalletRecharge = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
  }
  if (updates.minAccountWalletBalance !== undefined) {
    const value = Number(updates.minAccountWalletBalance)
    updateData.minAccountWalletBalance = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
  }
  if (updates.gstPercent !== undefined) {
    updateData.gstPercent = normalizeGstPercent(updates.gstPercent)
  }

  // Update the first (and only) row
  const [updated] = await db.update(paymentOptions).set(updateData).returning()

  // If no rows exist, create one
  if (!updated) {
    const [newSettings] = await db
      .insert(paymentOptions)
      .values({
        codEnabled: updates.codEnabled ?? true,
        prepaidEnabled: updates.prepaidEnabled ?? true,
        minWalletRecharge:
          updates.minWalletRecharge !== undefined && !isNaN(Number(updates.minWalletRecharge))
            ? Math.max(0, Math.floor(Number(updates.minWalletRecharge)))
            : 0,
        minAccountWalletBalance:
          updates.minAccountWalletBalance !== undefined && !isNaN(Number(updates.minAccountWalletBalance))
            ? Math.max(0, Math.floor(Number(updates.minAccountWalletBalance)))
            : 0,
        gstPercent:
          updates.gstPercent !== undefined && !isNaN(Number(updates.gstPercent))
            ? normalizeGstPercent(updates.gstPercent)
            : 0,
      })
      .returning()

    return newSettings
  }

  return updated
}
