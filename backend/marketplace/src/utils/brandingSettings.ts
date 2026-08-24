import axios from 'axios'
import SiteSettings, { type BrandingSettings } from '../models/SiteSettings'

const CACHE_TTL_MS = 5 * 60 * 1000

let brandingCache: {
  data: BrandingSettings
  fetchedAt: number
} | null = null

export const getBrandingSettingsCached = async (): Promise<BrandingSettings> => {
  const now = Date.now()
  if (brandingCache && now - brandingCache.fetchedAt < CACHE_TTL_MS) {
    return brandingCache.data
  }

  const settings = await SiteSettings.findOne().lean()
  const branding = settings?.branding || {}
  brandingCache = { data: branding, fetchedAt: now }
  return branding
}

export const clearBrandingSettingsCache = () => {
  brandingCache = null
}

export const fetchBrandingAssetBuffer = async (url?: string): Promise<Buffer | null> => {
  if (!url) return null
  try {
    const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
    return Buffer.from(response.data)
  } catch (error) {
    console.error('Failed to fetch branding asset:', url, error)
    return null
  }
}









































