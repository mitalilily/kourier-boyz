import { Request, Response } from 'express'
import { HttpError } from '../../utils/classes'
import { EkartService } from '../../models/services/couriers/ekart.service'

const getErrorStatus = (error: any) =>
  typeof error?.statusCode === 'number'
    ? error.statusCode
    : typeof error?.response?.status === 'number'
      ? error.response.status
      : error instanceof HttpError
        ? error.statusCode
        : 500

export const getEkartBulkServiceabilityController = async (req: Request, res: Response) => {
  try {
    const type = String(req.params.type || '')
      .trim()
      .toUpperCase() as 'NON_LARGE' | 'LARGE'
    const format = String(req.query.format || 'JSON')
      .trim()
      .toUpperCase() as 'JSON' | 'EXCEL'

    if (!['NON_LARGE', 'LARGE'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be NON_LARGE or LARGE' })
    }

    if (!['JSON', 'EXCEL'].includes(format)) {
      return res.status(400).json({ success: false, message: 'format must be JSON or EXCEL' })
    }

    const ekart = new EkartService()
    const data = await ekart.getBulkServiceability(type, format)

    if (format === 'EXCEL' && Buffer.isBuffer(data)) {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      return res.send(data)
    }

    return res.json({ success: true, data })
  } catch (error: any) {
    console.error('Failed to fetch Ekart bulk serviceability:', error)
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: error?.message || 'Failed to fetch Ekart bulk serviceability',
    })
  }
}

export const listEkartAddressesController = async (_req: Request, res: Response) => {
  try {
    const ekart = new EkartService()
    const data = await ekart.listAddresses()
    return res.json({ success: true, data })
  } catch (error: any) {
    console.error('Failed to fetch Ekart addresses:', error)
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: error?.message || 'Failed to fetch Ekart addresses',
    })
  }
}

export const listEkartWebhooksController = async (_req: Request, res: Response) => {
  try {
    const ekart = new EkartService()
    const data = await ekart.listWebhooks()
    return res.json({ success: true, data })
  } catch (error: any) {
    console.error('Failed to fetch Ekart webhooks:', error)
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: error?.message || 'Failed to fetch Ekart webhooks',
    })
  }
}

export const createEkartWebhookController = async (req: Request, res: Response) => {
  try {
    const ekart = new EkartService()
    const data = await ekart.createWebhook(req.body || {})
    return res.json({ success: true, data })
  } catch (error: any) {
    console.error('Failed to create Ekart webhook:', error)
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: error?.message || 'Failed to create Ekart webhook',
    })
  }
}

export const updateEkartWebhookController = async (req: Request, res: Response) => {
  try {
    const webhookId = String(req.params.webhookId || '').trim()
    if (!webhookId) {
      return res.status(400).json({ success: false, message: 'webhookId is required' })
    }
    const ekart = new EkartService()
    const data = await ekart.updateWebhook(webhookId, req.body || {})
    return res.json({ success: true, data })
  } catch (error: any) {
    console.error('Failed to update Ekart webhook:', error)
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: error?.message || 'Failed to update Ekart webhook',
    })
  }
}

export const estimateEkartPricingController = async (req: Request, res: Response) => {
  try {
    const ekart = new EkartService()
    const data = await ekart.estimatePricing(req.body || {})
    return res.json({ success: true, data })
  } catch (error: any) {
    console.error('Failed to fetch Ekart estimate:', error)
    return res.status(getErrorStatus(error)).json({
      success: false,
      message: error?.message || 'Failed to fetch Ekart estimate',
    })
  }
}
