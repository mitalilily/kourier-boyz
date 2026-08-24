import { Request, Response } from 'express'
import {
  createAdditionalChargeMaster,
  createDieselRate,
  deleteAdditionalChargeMaster,
  deleteDieselRate,
  listAdditionalChargeMasters,
  listDieselRates,
  updateAdditionalChargeMaster,
  updateDieselRate,
} from '../../../models/services/rateCardMasters.service'

const sendError = (res: Response, error: any) => {
  const duplicate = error?.code === '23505'
  return res.status(duplicate ? 409 : 400).json({ success: false, error: duplicate ? 'Code already exists' : error?.message || 'Request failed' })
}

export const listAdditionalChargeMastersController = async (_req: Request, res: Response) => {
  try { res.json({ success: true, data: await listAdditionalChargeMasters() }) } catch (error) { sendError(res, error) }
}
export const createAdditionalChargeMasterController = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, data: await createAdditionalChargeMaster(req.body) }) } catch (error) { sendError(res, error) }
}
export const updateAdditionalChargeMasterController = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: await updateAdditionalChargeMaster(req.params.id, req.body) }) } catch (error) { sendError(res, error) }
}
export const deleteAdditionalChargeMasterController = async (req: Request, res: Response) => {
  try { await deleteAdditionalChargeMaster(req.params.id); res.json({ success: true }) } catch (error) { sendError(res, error) }
}
export const listDieselRatesController = async (_req: Request, res: Response) => {
  try { res.json({ success: true, data: await listDieselRates() }) } catch (error) { sendError(res, error) }
}
export const createDieselRateController = async (req: Request, res: Response) => {
  try { res.status(201).json({ success: true, data: await createDieselRate(req.body) }) } catch (error) { sendError(res, error) }
}
export const updateDieselRateController = async (req: Request, res: Response) => {
  try { res.json({ success: true, data: await updateDieselRate(req.params.id, req.body) }) } catch (error) { sendError(res, error) }
}
export const deleteDieselRateController = async (req: Request, res: Response) => {
  try { await deleteDieselRate(req.params.id); res.json({ success: true }) } catch (error) { sendError(res, error) }
}
