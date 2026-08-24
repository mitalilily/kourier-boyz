import { eq } from 'drizzle-orm'
import { db } from '../client'
import { labelPreferences } from '../schema/labelPreferences'

export const DEFAULT_PREFERENCES = {
  printer_type: 'thermal',
  char_limit: 30,
  max_items: 4,
  order_info: {
    alternatePhone: false,
    billingGstin: false,
    ewayBillNumber: false,
  },
  shipper_info: {
    brandLogo: true,
    shipperName: true,
    shipperAddress: true,
    shipperPhone: true,
    gstin: true,
    returnName: true,
    returnAddress: true,
    returnPhone: true,
  },
  product_info: {
    productCost: true,
  },
  brand_logo: null,
  powered_by: 'Kourier Boyz',
  created_at: new Date(),
  updated_at: new Date(),
}

export const labelPreferencesService = {
  async getByUser(userId: string) {
    const [prefs] = await db
      .select()
      .from(labelPreferences)
      .where(eq(labelPreferences.user_id, userId))

    if (prefs) {
      return prefs
    }

    // Fallback defaults
    return {
      id: null,
      user_id: userId,
      ...DEFAULT_PREFERENCES,
    }
  },

  async createOrUpdate(userId: string, data: any) {
    const [existing] = await db
      .select()
      .from(labelPreferences)
      .where(eq(labelPreferences.user_id, userId))

    if (existing) {
      const [updated] = await db
        .update(labelPreferences)
        .set({ ...data, updated_at: new Date() })
        .where(eq(labelPreferences.user_id, userId))
        .returning()
      return updated
    } else {
      const [created] = await db
        .insert(labelPreferences)
        .values({ user_id: userId, ...DEFAULT_PREFERENCES, ...data })
        .returning()
      return created
    }
  },
}
