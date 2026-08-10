export interface StoredDeliveryLocation {
  id: string
  label: string
  detail: string
  postalCode?: string
  source: 'address' | 'preset' | 'detected' | 'custom'
  ownerUserId?: string
}

const SELECTED_LOCATION_KEY = 'kourier_boyz_selected_location'
const LEGACY_POSTAL_KEY = 'kourier_boyz_last_detected_postal'

const getStoredAuthUserId = (): string | undefined => {
  if (typeof window === 'undefined') return undefined

  try {
    const rawUser = localStorage.getItem('auth_user')
    if (!rawUser) return undefined
    const user = JSON.parse(rawUser) as { userId?: string }
    return user.userId
  } catch {
    return undefined
  }
}

export const clearStoredDeliveryLocation = () => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SELECTED_LOCATION_KEY)
  localStorage.removeItem(LEGACY_POSTAL_KEY)
}

export const readStoredDeliveryLocation = (
  currentUserId = getStoredAuthUserId(),
): StoredDeliveryLocation | null => {
  if (typeof window === 'undefined') return null

  const rawLocation = localStorage.getItem(SELECTED_LOCATION_KEY)
  if (!rawLocation) {
    localStorage.removeItem(LEGACY_POSTAL_KEY)
    return null
  }

  try {
    const location = JSON.parse(rawLocation) as StoredDeliveryLocation
    if (!location?.id || !location?.label) {
      clearStoredDeliveryLocation()
      return null
    }

    // Authenticated locations must be explicitly owned by the current account.
    // This also removes legacy unowned data for already-authenticated sessions.
    if (currentUserId && location.ownerUserId !== currentUserId) {
      clearStoredDeliveryLocation()
      return null
    }

    // A guest must never inherit an authenticated customer's location.
    if (!currentUserId && location.ownerUserId) {
      clearStoredDeliveryLocation()
      return null
    }

    return location
  } catch {
    clearStoredDeliveryLocation()
    return null
  }
}

export const writeStoredDeliveryLocation = (
  location: StoredDeliveryLocation,
  currentUserId = getStoredAuthUserId(),
): StoredDeliveryLocation => {
  const ownedLocation: StoredDeliveryLocation = {
    ...location,
    ownerUserId: currentUserId,
  }

  if (!currentUserId) delete ownedLocation.ownerUserId

  if (typeof window !== 'undefined') {
    localStorage.setItem(SELECTED_LOCATION_KEY, JSON.stringify(ownedLocation))
    localStorage.removeItem(LEGACY_POSTAL_KEY)
  }

  return ownedLocation
}

export const getStoredDeliveryPin = () => readStoredDeliveryLocation()?.postalCode || ''
