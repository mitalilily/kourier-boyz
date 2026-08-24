import { Response } from 'express'
import { getUserShippingRates } from '../models/services/courierIntegration.service'
import { ShippingRateFilters } from './admin/courier.controller'

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')

const assignedRateCardCourierName = (rate: any) => {
  const provider = String(rate?.service_provider || '').trim().toLowerCase()
  const mode = String(rate?.mode || '').trim().toLowerCase()
  const modeLabel = titleCase(mode)
  const courierName = String(rate?.courier_name || '').trim()

  if (provider === 'amazon') return modeLabel ? `Amazon Shipping ${modeLabel}` : 'Amazon Shipping'
  if (provider === 'xpressbees') return modeLabel ? `Xpressbees ${modeLabel}` : 'Xpressbees'

  return courierName
}

const sortAssignedRateCardRows = (rates: any[]) => {
  const priority = (rate: any) => {
    const provider = String(rate?.service_provider || '').trim().toLowerCase()
    if (provider === 'amazon') return 0
    return 1
  }

  return [...rates].sort((a, b) => {
    const priorityDelta = priority(a) - priority(b)
    if (priorityDelta !== 0) return priorityDelta
    return assignedRateCardCourierName(a).localeCompare(assignedRateCardCourierName(b))
  })
}

export const getShippingRatesForUserController = async (req: any, res: Response) => {
  try {
    const userId = req.user.sub
    let courierNames: string[] = []

    const rawCourierNames = req.query['courier_name[]'] ?? req.query.courier_name

    if (Array.isArray(rawCourierNames)) {
      courierNames = rawCourierNames.flat().filter(Boolean).map(String)
    } else if (typeof rawCourierNames === 'string') {
      courierNames = [rawCourierNames]
    }

    const filters: ShippingRateFilters = {
      courier_name: courierNames.length ? courierNames : undefined,
      mode: req.query.mode as string | undefined,
      min_weight: req.query.min_weight ? Number(req.query.min_weight) : undefined,
      business_type: (req.query.businessType as 'b2b' | 'b2c') || undefined,
    }

    const rates = await getUserShippingRates(userId, filters)
    const data =
      filters.business_type === 'b2b'
        ? rates
        : sortAssignedRateCardRows(rates).map((rate) => ({
            ...rate,
            courier_name: assignedRateCardCourierName(rate),
          }))

    res.json({ success: true, data })
  } catch (err) {
    console.error('Error fetching shipping rates:', err)
    res.status(500).json({ success: false, message: 'Internal Server Error' })
  }
}
