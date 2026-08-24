import { Request, Response } from 'express'

import {
  cancelAmazonShipment,
  getAmazonAccessPoints,
  getAmazonAdditionalInputs,
  getAmazonShipmentDocuments,
  getAmazonShippingRates,
  getAmazonShippingTracking,
  oneClickAmazonShipment,
  purchaseAmazonShipment,
  submitAmazonNdrFeedback,
  type AmazonShippingCredentials,
} from '../models/services/amazonShipping.service'
import {
  applyAmazonShippingCredentialsToEnv,
  getStoredAmazonShippingCredentials,
  mergeAmazonShippingCredentials,
} from '../models/services/amazonShippingCredentials.service'

const bodyObject = (req: Request) =>
  req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}

const unwrapPayload = (req: Request) => {
  const body = bodyObject(req)
  return body.body && typeof body.body === 'object' ? body.body : body
}

const loadCredentials = async (req: Request): Promise<AmazonShippingCredentials> => {
  const stored = await getStoredAmazonShippingCredentials()
  const override = bodyObject(req).amazonCredentials
  const credentials =
    override && typeof override === 'object'
      ? mergeAmazonShippingCredentials(stored, override as AmazonShippingCredentials)
      : stored
  applyAmazonShippingCredentialsToEnv(credentials)
  return credentials
}

const sendResult = (res: Response, result: any) =>
  res.json({
    success: true,
    data: result?.data ?? result,
    amazon: result?.amazon,
  })

const handleAmazonError = (res: Response, error: any, fallback: string) => {
  const statusCode = Number(error?.statusCode || error?.status || 500)
  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    success: false,
    message: error?.message || fallback,
    details: error?.details || undefined,
  })
}

export const getAmazonRatesController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const result = await getAmazonShippingRates(unwrapPayload(req), credentials)
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to fetch Amazon Shipping rates')
  }
}

export const purchaseAmazonShipmentController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const result = await purchaseAmazonShipment(unwrapPayload(req), credentials)
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to purchase Amazon Shipping shipment')
  }
}

export const oneClickAmazonShipmentController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const result = await oneClickAmazonShipment(unwrapPayload(req), credentials)
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to create Amazon one-click shipment')
  }
}

export const trackAmazonShipmentController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const input = { ...bodyObject(req), ...req.query }
    const result = await getAmazonShippingTracking(
      {
        trackingId:
          input.trackingId ||
          input.tracking_id ||
          input.amazonTrackingId ||
          input.amazon_tracking_id,
        carrierId:
          input.carrierId ||
          input.carrier_id ||
          input.amazonCarrierId ||
          input.amazon_carrier_id ||
          input.carrier,
      },
      credentials,
    )
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to track Amazon Shipping shipment')
  }
}

export const getAmazonShipmentDocumentsController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const input = { ...bodyObject(req), ...req.query, ...req.params }
    const result = await getAmazonShipmentDocuments(
      {
        shipmentId:
          input.shipmentId ||
          input.shipment_id ||
          input.amazonShipmentId ||
          input.amazon_shipment_id,
        packageClientReferenceId:
          input.packageClientReferenceId ||
          input.package_client_reference_id ||
          input.packageReferenceId ||
          input.package_reference_id ||
          input.amazonPackageClientReferenceId ||
          input.amazon_package_client_reference_id,
        format: input.format,
        dpi: input.dpi,
      },
      credentials,
    )
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to fetch Amazon Shipping documents')
  }
}

export const cancelAmazonShipmentController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const input = { ...bodyObject(req), ...req.params }
    const result = await cancelAmazonShipment(
      {
        shipmentId:
          input.shipmentId ||
          input.shipment_id ||
          input.amazonShipmentId ||
          input.amazon_shipment_id,
      },
      credentials,
    )
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to cancel Amazon Shipping shipment')
  }
}

export const getAmazonAccessPointsController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const input = { ...bodyObject(req), ...req.query }
    const result = await getAmazonAccessPoints(
      {
        accessPointTypes:
          input.accessPointTypes ||
          input.access_point_types ||
          input.accessPoints ||
          input.access_points,
        countryCode: input.countryCode || input.country_code,
        postalCode: input.postalCode || input.postal_code,
      },
      credentials,
    )
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to fetch Amazon Shipping access points')
  }
}

export const submitAmazonNdrFeedbackController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const result = await submitAmazonNdrFeedback(unwrapPayload(req), credentials)
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to submit Amazon Shipping NDR feedback')
  }
}

export const getAmazonAdditionalInputsController = async (req: Request, res: Response) => {
  try {
    const credentials = await loadCredentials(req)
    const input = { ...bodyObject(req), ...req.query }
    const result = await getAmazonAdditionalInputs(
      {
        requestToken: input.requestToken || input.request_token,
        rateId: input.rateId || input.rate_id,
      },
      credentials,
    )
    sendResult(res, result)
  } catch (error) {
    handleAmazonError(res, error, 'Failed to fetch Amazon Shipping additional inputs')
  }
}
