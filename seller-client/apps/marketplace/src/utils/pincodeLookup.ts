export interface PincodeLocation {
  city: string
  state: string
}

const ZIPPOPOTAM_URL = (pin: string) => `https://api.zippopotam.us/in/${pin}`
const POSTAL_PINCODE_URL = (pin: string) => `https://api.postalpincode.in/pincode/${pin}`

async function fetchJsonWithTimeout(url: string, timeoutMs = 5000): Promise<any | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function lookupZippopotam(pin: string): Promise<PincodeLocation | null> {
  const data = await fetchJsonWithTimeout(ZIPPOPOTAM_URL(pin))
  const place = data?.places?.[0]
  const city = place?.['place name']
  const state = place?.state
  if (!city || !state) return null
  return { city: String(city).trim(), state: String(state).trim() }
}

async function lookupPostalPincode(pin: string): Promise<PincodeLocation | null> {
  const data = await fetchJsonWithTimeout(POSTAL_PINCODE_URL(pin))
  const first = Array.isArray(data) ? data[0] : null
  if (first?.Status !== 'Success') return null
  const po = first?.PostOffice?.[0]
  const city = po?.Block || po?.District || po?.Name
  const state = po?.State
  if (!city || !state) return null
  return { city: String(city).trim(), state: String(state).trim() }
}

/**
 * Resolve city/state from a 6-digit Indian pincode.
 * Tries Zippopotam first (more reliable), falls back to postalpincode.in.
 */
export async function lookupPincode(pincode: string): Promise<PincodeLocation | null> {
  const pin = String(pincode || '').trim()
  if (!/^[0-9]{6}$/.test(pin)) return null
  return (await lookupZippopotam(pin)) || (await lookupPostalPincode(pin))
}
