import { Request, Response } from 'express'
import {
  createInternationalShipment,
  listAdminInternationalShipments,
  listUserInternationalShipments,
  updateAdminInternationalShipment,
} from '../models/services/internationalShipment.service'
import { calculateInternationalRate, listInternationalRateCards } from '../models/services/internationalRate.service'

const required = [
  'consigneeName',
  'consigneePhone',
  'addressLine1',
  'destinationPincode',
  'destinationCity',
  'destinationState',
  'destinationCountry',
]

export async function listClientInternationalRateCardsController(_req: Request, res: Response) {
  try {
    res.json({ success: true, data: await listInternationalRateCards() })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load international rate cards' })
  }
}

export async function calculateClientInternationalRateController(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await calculateInternationalRate(req.body) })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to calculate international rate' })
  }
}

export async function createInternationalShipmentController(req: Request, res: Response) {
  try {
    const missing = required.filter((field) => !String((req.body as any)?.[field] ?? '').trim())
    if (missing.length) return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` })
    const shipment = await createInternationalShipment({
      ...req.body,
      userId: (req as any).userId || (req as any).user?.sub,
    })
    res.status(201).json({ success: true, shipment })
  } catch (error: any) {
    console.error('[International] create failed', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to create international shipment' })
  }
}

export async function listMyInternationalShipmentsController(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)))
    const data = await listUserInternationalShipments((req as any).userId || (req as any).user?.sub, page, limit, {
      status: String(req.query.status || ''),
      search: String(req.query.search || ''),
    })
    res.json({ success: true, ...data })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch international shipments' })
  }
}

export async function listAdminInternationalShipmentsController(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)))
    const data = await listAdminInternationalShipments(page, limit, {
      status: String(req.query.status || ''),
      search: String(req.query.search || ''),
    })
    res.json({ success: true, ...data })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch admin international shipments' })
  }
}

export async function updateAdminInternationalShipmentController(req: Request, res: Response) {
  try {
    const shipment = await updateAdminInternationalShipment(req.params.id, {
      status: req.body.status,
      awbNumber: req.body.awbNumber,
      bookedDate: req.body.bookedDate ? new Date(req.body.bookedDate) : req.body.bookedDate === null ? null : undefined,
      adminNotes: req.body.adminNotes,
    })
    res.json({ success: true, shipment })
  } catch (error: any) {
    const statusCode = /not found/i.test(error.message) ? 404 : /invalid/i.test(error.message) ? 400 : 500
    res.status(statusCode).json({ success: false, message: error.message || 'Failed to update international shipment' })
  }
}
