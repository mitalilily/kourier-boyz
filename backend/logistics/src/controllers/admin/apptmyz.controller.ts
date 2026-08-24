import { Request, Response } from 'express'
import { HttpError } from '../../utils/classes'
import { ApptmyzService } from '../../models/services/couriers/apptmyz.service'

const statusOf = (error: any) =>
  typeof error?.statusCode === 'number'
    ? error.statusCode
    : typeof error?.response?.status === 'number'
      ? error.response.status
      : error instanceof HttpError
        ? error.statusCode
        : 500

const handle = async (res: Response, action: () => Promise<any>, fallback: string) => {
  try {
    const data = await action()
    return res.json({ success: true, data })
  } catch (error: any) {
    console.error(fallback, error?.response?.data || error)
    return res.status(statusOf(error)).json({
      success: false,
      message: error?.message || fallback,
      data: error?.response?.data,
    })
  }
}

export const apptmyzGenerateTokenController = async (req: Request, res: Response) =>
  handle(
    res,
    () => new ApptmyzService().generateToken(req.body || {}),
    'Failed to generate Apptmyz token',
  )

export const apptmyzCreateOrderController = async (req: Request, res: Response) =>
  handle(res, () => new ApptmyzService().createOrder(req.body || {}), 'Failed to create Apptmyz order')

export const apptmyzGenerateDocketsController = async (req: Request, res: Response) =>
  handle(
    res,
    () => new ApptmyzService().generateDockets(req.params.travelMode, req.params.count),
    'Failed to generate Apptmyz dockets',
  )

export const apptmyzTrackOrdersController = async (req: Request, res: Response) =>
  handle(
    res,
    () => new ApptmyzService().trackOrders(req.body?.docketNo || req.body?.docketNumbers || []),
    'Failed to track Apptmyz orders',
  )

export const apptmyzListOrdersController = async (req: Request, res: Response) =>
  handle(
    res,
    () => new ApptmyzService().listOrders(req.params.startDate, req.params.endDate),
    'Failed to list Apptmyz orders',
  )

export const apptmyzCancelOrdersController = async (req: Request, res: Response) =>
  handle(res, () => new ApptmyzService().cancelOrders(req.body || {}), 'Failed to cancel Apptmyz orders')

export const apptmyzCancelReasonsController = async (_req: Request, res: Response) =>
  handle(res, () => new ApptmyzService().getCancelReasons(), 'Failed to fetch Apptmyz cancel reasons')

export const apptmyzDeliverySlotsController = async (_req: Request, res: Response) =>
  handle(res, () => new ApptmyzService().getDeliverySlots(), 'Failed to fetch Apptmyz delivery slots')

export const apptmyzTruckTypesController = async (_req: Request, res: Response) =>
  handle(res, () => new ApptmyzService().getTruckTypes(), 'Failed to fetch Apptmyz truck types')

export const apptmyzServiceabilityController = async (req: Request, res: Response) =>
  handle(
    res,
    () => new ApptmyzService().checkPincodeServiceability(req.params.pincode),
    'Failed to fetch Apptmyz pincode serviceability',
  )

export const apptmyzUpdateDeliveryAppointmentController = async (req: Request, res: Response) =>
  handle(
    res,
    () => new ApptmyzService().updateDeliveryAppointment(req.body || []),
    'Failed to update Apptmyz delivery appointment',
  )

export const apptmyzUpdateOrderDetailsController = async (req: Request, res: Response) =>
  handle(
    res,
    () => new ApptmyzService().updateOrderDetails(req.body || {}),
    'Failed to update Apptmyz order details',
  )

export const apptmyzCreatePickupRequestsController = async (req: Request, res: Response) =>
  handle(
    res,
    () => new ApptmyzService().createPickupRequests(req.body || []),
    'Failed to create Apptmyz pickup requests',
  )

export const apptmyzWebhookUpdatesController = async (req: Request, res: Response) => {
  console.log('[Apptmyz webhook update]', {
    docketNumber: req.body?.docketNumber,
    eventCode: req.body?.eventCode,
    eventTimeStamp: req.body?.eventTimeStamp,
  })
  return res.json({ success: true, message: 'Apptmyz webhook received' })
}
