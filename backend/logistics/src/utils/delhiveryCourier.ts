export const DELHIVERY_COURIER_IDS = {
  EXPRESS: 99,
  SURFACE: 100,
  LTL: 101,
} as const

export type DelhiveryShippingMode = 'Express' | 'Surface'

const DELHIVERY_LEGACY_MODE_BY_ID: Record<number, DelhiveryShippingMode> = {
  // Current admin/manual setup.
  [DELHIVERY_COURIER_IDS.EXPRESS]: 'Express',
  [DELHIVERY_COURIER_IDS.SURFACE]: 'Surface',
  // Legacy/imported Shiprocket-style B2C rate cards commonly use id 1 for Delhivery Air.
  1: 'Express',
  92: 'Express',
  93: 'Surface',
}

export const DELHIVERY_ALLOWED_COURIER_IDS: number[] = [
  DELHIVERY_COURIER_IDS.EXPRESS,
  DELHIVERY_COURIER_IDS.SURFACE,
  1,
  92,
  93,
]

export const normalizeCourierId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const isSupportedDelhiveryCourierId = (value: unknown): boolean => {
  const id = normalizeCourierId(value)
  if (id === null) return false
  return DELHIVERY_ALLOWED_COURIER_IDS.includes(id)
}

export const getDelhiveryShippingModeByCourierId = (
  value: unknown,
): DelhiveryShippingMode | null => {
  const id = normalizeCourierId(value)
  return id === null ? null : DELHIVERY_LEGACY_MODE_BY_ID[id] ?? null
}

export const getCanonicalDelhiveryCourierIdByMode = (
  mode: DelhiveryShippingMode | null | undefined,
): number | null => {
  if (mode === 'Express') return DELHIVERY_COURIER_IDS.EXPRESS
  if (mode === 'Surface') return DELHIVERY_COURIER_IDS.SURFACE
  return null
}

export const getDelhiveryCourierDisplayName = (
  mode: DelhiveryShippingMode | null | undefined,
): string => (mode === 'Express' ? 'Delhivery Air' : 'Delhivery Surface')

export const normalizeDelhiveryShippingMode = (value: unknown): DelhiveryShippingMode | null => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()

  if (!normalized) return null
  if (['air', 'a', 'express', 'e'].includes(normalized) || normalized.includes('air')) {
    return 'Express'
  }
  if (['surface', 's', 'ground'].includes(normalized) || normalized.includes('surface')) {
    return 'Surface'
  }
  return null
}

export const resolveDelhiveryShippingMode = ({
  courierId,
  mode,
  courierName,
}: {
  courierId?: unknown
  mode?: unknown
  courierName?: unknown
}): DelhiveryShippingMode | null =>
  getDelhiveryShippingModeByCourierId(courierId) ||
  normalizeDelhiveryShippingMode(mode) ||
  normalizeDelhiveryShippingMode(courierName)

export const resolveDelhiveryRateCardShippingMode = ({
  courierId,
  mode,
  courierName,
}: {
  courierId?: unknown
  mode?: unknown
  courierName?: unknown
}): DelhiveryShippingMode | null => {
  const id = normalizeCourierId(courierId)

  // Imported rate cards can contain stale/generic mode values. In those files,
  // the courier display name is the most reliable Air/Surface signal.
  if (id === 1 || id === 92) return 'Express'
  if (id === 93) return 'Surface'

  const nameMode = normalizeDelhiveryShippingMode(courierName)
  if (nameMode) return nameMode

  const explicitMode =
    normalizeDelhiveryShippingMode(mode)
  if (explicitMode) return explicitMode

  return getDelhiveryShippingModeByCourierId(id)
}

export const resolveCanonicalDelhiveryCourierId = (source: {
  courierId?: unknown
  mode?: unknown
  courierName?: unknown
}): number | null =>
  getCanonicalDelhiveryCourierIdByMode(resolveDelhiveryShippingMode(source))
