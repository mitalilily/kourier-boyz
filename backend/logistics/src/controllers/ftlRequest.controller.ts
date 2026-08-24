import { Request, Response } from 'express'
import {
  createFtlRequest,
  listAdminFtlRequests,
  listUserFtlRequests,
  updateAdminFtlRequest,
} from '../models/services/ftlRequest.service'

const requiredFields = [
  'customerName',
  'customerPhone',
  'originCity',
  'originPincode',
  'destinationCity',
  'destinationPincode',
  'vehicleType',
  'materialType',
]

const numberOrUndefined = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export async function createFtlRequestController(req: Request, res: Response) {
  try {
    const missing = requiredFields.filter((field) => !String((req.body as any)?.[field] ?? '').trim())
    if (missing.length) {
      return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` })
    }

    const body = req.body as any
    const request = await createFtlRequest({
      userId: (req as any).userId || (req as any).user?.sub,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      companyName: body.companyName,
      originCity: body.originCity,
      originState: body.originState,
      originPincode: body.originPincode,
      originAddress: body.originAddress,
      destinationCity: body.destinationCity,
      destinationState: body.destinationState,
      destinationPincode: body.destinationPincode,
      destinationAddress: body.destinationAddress,
      vehicleType: body.vehicleType,
      materialType: body.materialType,
      weightKg: numberOrUndefined(body.weightKg),
      truckCount: numberOrUndefined(body.truckCount),
      loadingDate: body.loadingDate ? new Date(body.loadingDate) : undefined,
      notes: body.notes,
      formData: body,
    })

    res.status(201).json({ success: true, request })
  } catch (error: any) {
    console.error('[FTL] create failed', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to create FTL request' })
  }
}

export async function listMyFtlRequestsController(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)))
    const data = await listUserFtlRequests((req as any).userId || (req as any).user?.sub, page, limit, {
      status: String(req.query.status || ''),
      search: String(req.query.search || ''),
    })
    res.json({ success: true, ...data })
  } catch (error: any) {
    console.error('[FTL] list user failed', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch FTL requests' })
  }
}

export async function listAdminFtlRequestsController(req: Request, res: Response) {
  try {
    const page = Math.max(1, Number(req.query.page || 1))
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)))
    const data = await listAdminFtlRequests(page, limit, {
      status: String(req.query.status || ''),
      search: String(req.query.search || ''),
    })
    res.json({ success: true, ...data })
  } catch (error: any) {
    console.error('[FTL] list admin failed', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch admin FTL requests' })
  }
}

export async function updateAdminFtlRequestController(req: Request, res: Response) {
  try {
    const request = await updateAdminFtlRequest(req.params.id, {
      status: req.body.status,
      awbNumber: req.body.awbNumber,
      processedDate: req.body.processedDate ? new Date(req.body.processedDate) : req.body.processedDate === null ? null : undefined,
      adminNotes: req.body.adminNotes,
    })
    res.json({ success: true, request })
  } catch (error: any) {
    const statusCode = /not found/i.test(error.message) ? 404 : /invalid/i.test(error.message) ? 400 : 500
    res.status(statusCode).json({ success: false, message: error.message || 'Failed to update FTL request' })
  }
}
