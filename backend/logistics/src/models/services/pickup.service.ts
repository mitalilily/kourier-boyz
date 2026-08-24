import { eq } from 'drizzle-orm'
import { sendWebhookEvent } from '../../services/webhookDelivery.service'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { cancelAmazonShipment, getAmazonShippingTracking } from './amazonShipping.service'
import {
  applyAmazonShippingCredentialsToEnv,
  getStoredAmazonShippingCredentials,
} from './amazonShippingCredentials.service'
import { DelhiveryService } from './couriers/delhivery.service'
import { DtdcService } from './couriers/dtdc.service'
import { EkartService } from './couriers/ekart.service'
import { ShadowfaxService } from './couriers/shadowfax.service'
import { XpressbeesService } from './couriers/xpressbees.service'
import { logTrackingEvent } from './trackingEvents.service'
import { applyCancellationRefundOnce } from './webhookProcessor'

const SUPPORTED_CANCELLATION_PROVIDERS = new Set([
  'delhivery',
  'ekart',
  'xpressbees',
  'shadowfax',
  'amazon',
  'dtdc',
])

const TERMINAL_NON_CANCELLABLE_STATUSES = new Set(['delivered', 'rto_delivered'])
const DELHIVERY_LTL_PLACEHOLDER_VALUES = new Set([
  'processing',
  'pending',
  'unknown',
  'null',
  'undefined',
  'n/a',
  'na',
])

const cancellationResponseText = (value: unknown) => {
  try {
    return JSON.stringify(value || {}).toLowerCase()
  } catch {
    return String(value || '').toLowerCase()
  }
}

const isCancellationAccepted = (result: any) => {
  const responseText = cancellationResponseText(result)
  const numericStatus = Number(
    result?.status ??
      result?.responseCode ??
      result?.code ??
      result?.ReturnCode ??
      result?.returnCode,
  )
  const alreadyCancelled =
    responseText.includes('already cancelled') || responseText.includes('already canceled')
  const rejected =
    responseText.includes('not accepted') ||
    responseText.includes('failed') ||
    responseText.includes('failure')
  const acceptedText =
    responseText.includes('cancelled') ||
    responseText.includes('canceled') ||
    responseText.includes('shipment updated successfully') ||
    responseText.includes('successful') ||
    responseText.includes('cancellation initiated') ||
    responseText.includes('cancellation accepted') ||
    responseText.includes('cancellation request accepted')

  return (
    alreadyCancelled ||
    result?.success === true ||
    result?.Success === true ||
    result?.status === true ||
    String(result?.ReturnCode || result?.returnCode || '').trim() === '100' ||
    String(result?.status || '').toLowerCase() === 'success' ||
    (Number.isFinite(numericStatus) && numericStatus >= 200 && numericStatus < 300) ||
    result?.response?.status === true ||
    (acceptedText && !rejected)
  )
}

const getCancellationErrorMessage = (result: any) =>
  result?.error ||
  result?.message ||
  result?.ReturnMessage ||
  result?.returnMessage ||
  result?.responseMsg ||
  result?.remark ||
  'Courier cancellation not accepted'

const truncateText = (value: unknown, maxLength: number) => {
  const text = String(value || '').trim()
  if (!text) return null
  return text.length > maxLength ? text.slice(0, maxLength - 3).trimEnd() + '...' : text
}

const getCancellationDeliveryMessage = (result: any) =>
  truncateText(
    result?.message ||
      result?.ReturnMessage ||
      result?.returnMessage ||
      result?.remark ||
      result?.responseMsg,
    100,
  )

const isShadowfaxCancellationProcessingError = (error: any) => {
  const responseText = cancellationResponseText({
    message: error?.message,
    response: error?.response?.data,
    status: error?.statusCode || error?.response?.status,
  })

  return (
    responseText.includes('order is being processed') ||
    responseText.includes('try cancelling after sometime')
  )
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const isAmazonCancellationPropagationError = (error: any) => {
  const responseText = cancellationResponseText({
    message: error?.message,
    response: error?.response?.data,
    status: error?.statusCode || error?.response?.status,
  })

  return (
    responseText.includes('ineligible state') ||
    responseText.includes('trackingid not found') ||
    responseText.includes('tracking id not found')
  )
}

const amazonTrackingConfirmsCancellation = async ({
  order,
  credentials,
}: {
  order: any
  credentials: any
}) => {
  const trackingId = String(
    order?.awb_number ||
      order?.provider_meta?.amazon_tracking_id ||
      order?.provider_meta?.trackingId ||
      order?.provider_meta?.tracking_id ||
      '',
  ).trim()

  if (!trackingId) return false

  const carrierId = String(
    order?.provider_meta?.amazon_carrier_id ||
      order?.provider_meta?.carrierId ||
      order?.provider_service ||
      'ATS',
  ).trim()

  try {
    const tracking = await getAmazonShippingTracking({ trackingId, carrierId }, credentials)
    const trackingText = cancellationResponseText(tracking)
    return (
      trackingText.includes('pickupcancelled') ||
      trackingText.includes('pickup cancelled') ||
      trackingText.includes('cancelled') ||
      trackingText.includes('canceled')
    )
  } catch {
    return false
  }
}

const cancelAmazonShipmentWithRetry = async ({
  shipmentId,
  order,
  credentials,
}: {
  shipmentId: string
  order: any
  credentials: any
}) => {
  const retryDelaysMs = [5000, 15000, 30000]
  let lastError: any = null

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await cancelAmazonShipment({ shipmentId }, credentials)
    } catch (error: any) {
      lastError = error
      if (!isAmazonCancellationPropagationError(error)) {
        throw error
      }

      if (await amazonTrackingConfirmsCancellation({ order, credentials })) {
        return {
          success: true,
          message: 'Amazon tracking confirms cancellation',
          provider_response: error?.response?.data || null,
        }
      }

      const delayMs = retryDelaysMs[attempt]
      if (!delayMs) break
      console.warn('Amazon cancellation is still propagating; retrying', {
        orderId: order?.id,
        shipmentId,
        attempt: attempt + 1,
        delayMs,
        message: error?.message || error,
      })
      await delay(delayMs)
    }
  }

  if (await amazonTrackingConfirmsCancellation({ order, credentials })) {
    return {
      success: true,
      message: 'Amazon tracking confirms cancellation',
      provider_response: lastError?.response?.data || null,
    }
  }

  throw lastError
}

const resolveCancellationProvider = (order: any) => {
  const providerText = `${order?.integration_type || ''} ${order?.courier_partner || ''}`
    .trim()
    .toLowerCase()
  if (providerText.includes('delhivery')) return 'delhivery'
  if (providerText.includes('ekart')) return 'ekart'
  if (providerText.includes('xpressbees') || providerText.includes('xpress bees')) {
    return 'xpressbees'
  }
  if (providerText.includes('shadowfax')) return 'shadowfax'
  if (providerText.includes('amazon')) return 'amazon'
  return providerText
}

const getOrderProviderMeta = (order: any) =>
  order?.provider_meta && typeof order.provider_meta === 'object' && !Array.isArray(order.provider_meta)
    ? (order.provider_meta as Record<string, unknown>)
    : {}

const normalizeMeaningfulText = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value || '').trim()
    if (!text) continue
    if (DELHIVERY_LTL_PLACEHOLDER_VALUES.has(text.toLowerCase())) continue
    return text
  }

  return ''
}

const isMeaningfulDelhiveryValue = (value: unknown, blocked: Set<string> = new Set()) => {
  const normalized = normalizeMeaningfulText(value)
  return normalized.length > 0 && !blocked.has(normalized)
}

const extractAcceptedDelhiveryB2BIdentifiers = async (order: any, delhivery: DelhiveryService) => {
  const providerMeta = getOrderProviderMeta(order)
  const pickupRequestMeta =
    providerMeta.pickup_request && typeof providerMeta.pickup_request === 'object'
      ? (providerMeta.pickup_request as Record<string, unknown>)
      : {}
  const pickupResponseMeta =
    pickupRequestMeta.response && typeof pickupRequestMeta.response === 'object'
      ? (pickupRequestMeta.response as Record<string, unknown>)
      : {}
  const pickupProviderResponseMeta =
    pickupResponseMeta.provider_response && typeof pickupResponseMeta.provider_response === 'object'
      ? (pickupResponseMeta.provider_response as Record<string, unknown>)
      : {}
  const pickupProviderDataMeta =
    pickupProviderResponseMeta.data && typeof pickupProviderResponseMeta.data === 'object'
      ? (pickupProviderResponseMeta.data as Record<string, unknown>)
      : {}
  const manifestSubmissionMeta =
    providerMeta.manifest_submission && typeof providerMeta.manifest_submission === 'object'
      ? (providerMeta.manifest_submission as Record<string, unknown>)
      : {}
  const manifestSubmissionProviderResponse =
    manifestSubmissionMeta.provider_response && typeof manifestSubmissionMeta.provider_response === 'object'
      ? (manifestSubmissionMeta.provider_response as Record<string, unknown>)
      : {}

  const jobId = normalizeMeaningfulText(
    providerMeta.job_id,
    manifestSubmissionMeta.jobId,
    manifestSubmissionMeta.job_id,
    manifestSubmissionProviderResponse.job_id,
    manifestSubmissionProviderResponse.jobId,
    order.order_status === 'manifest_pending' ? order.provider_request_id : '',
    order.shipment_id,
    order.manifest,
  )
  const pickupId = normalizeMeaningfulText(
    pickupResponseMeta.pickupId,
    pickupResponseMeta.pickup_id,
    pickupProviderResponseMeta.pickupId,
    pickupProviderDataMeta.pickup_id,
    pickupProviderDataMeta.pickupId,
  )
  const pickupRequestId = normalizeMeaningfulText(
    pickupResponseMeta.requestId,
    pickupResponseMeta.request_id,
    pickupProviderResponseMeta.request_id,
    pickupProviderResponseMeta.requestId,
  )
  const blockedValues = new Set(
    [jobId, pickupId, pickupRequestId].map((value) => String(value || '').trim()).filter(Boolean),
  )

  let lrn = normalizeMeaningfulText(order.provider_reference, order.order_id, providerMeta.lrn)
  if (!isMeaningfulDelhiveryValue(lrn, blockedValues)) {
    lrn = ''
  }

  const awbCandidates = [
    order.awb_number,
    providerMeta.awb_number,
    ...(Array.isArray(providerMeta.awbs) ? providerMeta.awbs : []),
  ]
  let awb = awbCandidates
    .map((value) => normalizeMeaningfulText(value))
    .find((value) => value && !blockedValues.has(value))
  if (!awb) awb = ''

  let manifestStatusResponse: any = null
  if (jobId && (!lrn || !awb)) {
    manifestStatusResponse = await delhivery.getLtlManifestStatus(jobId)

    const refreshedBlockedValues = new Set([
      ...blockedValues,
      normalizeMeaningfulText(manifestStatusResponse?.jobId),
      normalizeMeaningfulText(manifestStatusResponse?.provider_response?.request_id),
    ])

    const refreshedLrn = normalizeMeaningfulText(manifestStatusResponse?.lrn)
    if (refreshedLrn && !refreshedBlockedValues.has(refreshedLrn)) {
      lrn = refreshedLrn
    }

    const refreshedAwbCandidates = Array.isArray(manifestStatusResponse?.awbs)
      ? manifestStatusResponse.awbs
      : []
    const refreshedAwb = refreshedAwbCandidates
      .map((value: unknown) => normalizeMeaningfulText(value))
      .find((value: string) => value && !refreshedBlockedValues.has(value))
    if (refreshedAwb) {
      awb = refreshedAwb
    }
  }

  return {
    jobId: jobId || null,
    pickupId: pickupId || null,
    pickupRequestId: pickupRequestId || null,
    lrn: lrn || null,
    awb: awb || null,
    manifestStatusResponse,
    providerMeta,
  }
}

const cancelB2BOrderShipment = async (order: any, integration: string) => {
  const currentStatus = String(order.order_status || '').trim().toLowerCase()

  if (currentStatus === 'cancelled') {
    return {
      success: true,
      alreadyCancelled: true,
      message: 'Order already cancelled',
    }
  }

  if (TERMINAL_NON_CANCELLABLE_STATUSES.has(currentStatus)) {
    throw new Error(`Order is already ${currentStatus} and cannot be cancelled`)
  }

  const providerMeta = getOrderProviderMeta(order)
  const cancelledAt = new Date()
  let cancellationResult: any = null
  let resolvedAwb = normalizeMeaningfulText(order.awb_number) || null
  let resolvedReference = normalizeMeaningfulText(order.provider_reference, order.order_id) || null
  let providerRequestId = normalizeMeaningfulText(order.provider_request_id) || null

  if (integration === 'delhivery') {
    const delhivery = new DelhiveryService()
    const identifiers = await extractAcceptedDelhiveryB2BIdentifiers(order, delhivery)
    resolvedAwb = identifiers.awb || resolvedAwb
    resolvedReference = identifiers.lrn || resolvedReference
    providerRequestId = identifiers.jobId || providerRequestId

    let shipmentCancellation: any = null
    let pickupCancellation: any = null

    if (identifiers.lrn) {
      shipmentCancellation = await delhivery.cancelLtlShipment(identifiers.lrn)
    }

    if (
      identifiers.pickupId &&
      (!shipmentCancellation || !isCancellationAccepted(shipmentCancellation))
    ) {
      pickupCancellation = await delhivery.cancelLtlPickupRequest(
        identifiers.pickupId,
        identifiers.pickupRequestId || undefined,
      )
    }

    const shipmentAccepted = shipmentCancellation && isCancellationAccepted(shipmentCancellation)
    const pickupAccepted = pickupCancellation?.success === true || isCancellationAccepted(pickupCancellation)
    if (!shipmentAccepted && !pickupAccepted && !identifiers.jobId) {
      throw new Error('Delhivery cancellation requires a valid LRN or pickup request.')
    }

    cancellationResult =
      shipmentCancellation ||
      pickupCancellation ||
      ({
        success: true,
        localOnly: true,
        pending: true,
        job_id: identifiers.jobId,
        message:
          'Delhivery manifest was accepted but no LRN/AWB has been issued yet. The order has been cancelled locally before pickup dispatch.',
      } as const)

    await db
      .update(b2b_orders)
      .set({
        order_status: 'cancelled',
        awb_number: resolvedAwb || order.awb_number || null,
        order_id: resolvedReference || order.order_id || null,
        shipment_id: resolvedReference || order.shipment_id || identifiers.jobId || null,
        provider_reference: resolvedReference || order.provider_reference || null,
        provider_request_id: providerRequestId || order.provider_request_id || null,
        provider_last_status: 'cancelled',
        delivery_message: getCancellationDeliveryMessage(cancellationResult) || 'Shipment cancelled',
        provider_meta: {
          ...providerMeta,
          ...(identifiers.manifestStatusResponse
            ? { manifest_status: identifiers.manifestStatusResponse }
            : {}),
          cancellation: {
            provider: integration,
            requested_at: cancelledAt.toISOString(),
            awb_number: resolvedAwb,
            lrn: resolvedReference,
            job_id: identifiers.jobId,
            pickup_id: identifiers.pickupId,
            result: cancellationResult,
          },
        },
        updated_at: cancelledAt,
      } as any)
      .where(eq(b2b_orders.id, order.id))
  } else {
    if (!resolvedAwb && integration !== 'shadowfax') {
      cancellationResult = {
        success: true,
        localOnly: true,
        message: 'Order has no provider AWB yet; cancelled locally before courier booking.',
      }
    } else if (integration === 'shadowfax') {
      const svc = new ShadowfaxService()
      const reference = normalizeMeaningfulText(
        order.provider_request_id,
        order.provider_reference,
        order.awb_number,
      )
      cancellationResult = await svc.cancelShipment(reference)
    } else if (integration === 'ekart') {
      const svc = new EkartService()
      cancellationResult = await svc.cancelShipment(String(resolvedAwb))
    } else if (integration === 'xpressbees') {
      const svc = new XpressbeesService()
      cancellationResult = await svc.cancelShipment(String(resolvedAwb))
    } else if (integration === 'amazon') {
      const amazonShipmentId = normalizeMeaningfulText(
        order.shipment_id,
        order.provider_reference,
        order.order_id,
        providerMeta.shipment_id,
        providerMeta.provider_reference,
        providerMeta.shipmentId,
      )
      if (!amazonShipmentId) {
        throw new Error('Amazon cancellation requires a shipment id')
      }

      const amazonCredentials = await getStoredAmazonShippingCredentials()
      applyAmazonShippingCredentialsToEnv(amazonCredentials)
      cancellationResult = await cancelAmazonShipmentWithRetry({
        shipmentId: amazonShipmentId,
        order,
        credentials: amazonCredentials,
      })
    } else {
      throw new Error('Unsupported B2B cancellation provider')
    }

    if (!isCancellationAccepted(cancellationResult) && cancellationResult?.localOnly !== true) {
      throw new Error(getCancellationErrorMessage(cancellationResult))
    }

    await db
      .update(b2b_orders)
      .set({
        order_status: 'cancelled',
        provider_last_status: 'cancelled',
        delivery_message: getCancellationDeliveryMessage(cancellationResult) || 'Shipment cancelled',
        provider_meta: {
          ...providerMeta,
          cancellation: {
            provider: integration,
            requested_at: cancelledAt.toISOString(),
            awb_number: resolvedAwb,
            result: cancellationResult,
          },
        },
        updated_at: cancelledAt,
      } as any)
      .where(eq(b2b_orders.id, order.id))
  }

  await sendWebhookEvent(order.user_id, 'order.cancelled', {
    order_id: order.id,
    order_number: order.order_number,
    awb_number: resolvedAwb || order.awb_number || null,
    status: 'cancelled',
    courier_partner: order.courier_partner || integration,
    provider_reference: resolvedReference || order.provider_reference || null,
    provider_request_id: providerRequestId || order.provider_request_id || null,
    cancelled_at: cancelledAt.toISOString(),
    order_type: 'b2b',
  }).catch((err) => {
    console.warn('Failed to send B2B cancellation webhook:', err)
  })

  return cancellationResult
}

const isSalesChannelSourceOrder = (order: any) => {
  const localOrderId = String(order?.order_id || '').trim()
  return localOrderId.startsWith('shopify_') || localOrderId.startsWith('woo_')
}

const syncSalesChannelStatusForOrder = async (orderId: string, source: string) => {
  const [updatedOrder] = await db
    .select()
    .from(b2c_orders)
    .where(eq(b2c_orders.id, orderId))
    .limit(1)

  if (!updatedOrder) return

  const localOrderId = String(updatedOrder.order_id || '').trim()
  if (localOrderId.startsWith('shopify_')) {
    const { syncShopifyStatusForLocalOrder } = await import('./shopify.service')
    await syncShopifyStatusForLocalOrder(updatedOrder, db, { source }).catch((err: any) => {
      console.warn(`Shopify status sync skipped after ${source}:`, err?.message || err)
    })
  }

  if (localOrderId.startsWith('woo_')) {
    const { syncWooCommerceStatusForLocalOrder } = await import('./woocommerce.service')
    await syncWooCommerceStatusForLocalOrder(updatedOrder, db, { source }).catch((err: any) => {
      console.warn(`WooCommerce status sync skipped after ${source}:`, err?.message || err)
    })
  }
}

export async function cancelOrderShipment(orderId: string) {
  console.log('Starting cancellation for orderId:', orderId)

  const [b2cOrder] = await db.select().from(b2c_orders).where(eq(b2c_orders.id, orderId))
  let order: any = b2cOrder || null
  let orderType: 'b2c' | 'b2b' = 'b2c'

  if (!order) {
    ;[order] = await db.select().from(b2b_orders).where(eq(b2b_orders.id, orderId))
    if (order) orderType = 'b2b'
  }

  if (!order) {
    console.error('Order not found:', orderId)
    throw new Error('Order not found')
  }

  const integration = resolveCancellationProvider(order)
  const currentStatus = String(order.order_status || '').trim().toLowerCase()
  const awbNumber = String(order.awb_number || '').trim()

  console.log('Order found for cancellation:', {
    orderId: order.id,
    orderNumber: order.order_number,
    integrationType: integration,
    awbNumber,
    shipmentId: order.shipment_id,
    currentStatus,
  })

  if (currentStatus === 'cancelled') {
    await syncSalesChannelStatusForOrder(orderId, 'already-cancelled order check')
    return {
      success: true,
      alreadyCancelled: true,
      message: 'Order already cancelled',
    }
  }

  if (TERMINAL_NON_CANCELLABLE_STATUSES.has(currentStatus)) {
    throw new Error(`Order is already ${currentStatus} and cannot be cancelled`)
  }

  if (orderType === 'b2b') {
    if (!SUPPORTED_CANCELLATION_PROVIDERS.has(integration)) {
      console.error('Unsupported B2B integration type:', { orderId, integration })
      throw new Error(
        'Only Delhivery, Ekart, Xpressbees, Shadowfax and Amazon are supported for cancellation',
      )
    }

    return cancelB2BOrderShipment(order, integration)
  }

  if (!SUPPORTED_CANCELLATION_PROVIDERS.has(integration) && !(isSalesChannelSourceOrder(order) && !awbNumber)) {
    console.error('Unsupported integration type:', { orderId, integration })
    throw new Error('Only Delhivery, Ekart, Xpressbees, Shadowfax and Amazon are supported for cancellation')
  }

  const amazonShipmentId = String(
    order.shipment_id ||
      order.provider_reference ||
      order.order_id ||
      (order.provider_meta as any)?.shipment_id ||
      (order.provider_meta as any)?.provider_reference ||
      (order.provider_meta as any)?.shipmentId ||
      '',
  ).trim()

  if (integration === 'amazon' && !amazonShipmentId) {
    console.error('Amazon cancellation failed: Missing shipment id', {
      orderId,
      integration,
      awbNumber,
      shipmentId: order.shipment_id,
      providerReference: order.provider_reference,
    })
    throw new Error('Amazon cancellation requires a shipment id')
  }

  const providerMeta: Record<string, unknown> =
    order.provider_meta && typeof order.provider_meta === 'object' && !Array.isArray(order.provider_meta)
      ? (order.provider_meta as Record<string, unknown>)
      : {}

  console.log('Attempting courier cancellation:', {
    orderId,
    awbNumber,
    shipmentId: integration === 'amazon' ? amazonShipmentId : order.shipment_id,
    integration,
  })

  let cancellationResult: any = null
  if (integration === 'delhivery' && !awbNumber) {
    throw new Error('Delhivery cancellation requires an AWB number')
  }

  if (integration !== 'amazon' && !awbNumber) {
    cancellationResult = {
      success: true,
      localOnly: true,
      message: 'Order has no provider AWB yet; cancelled locally before courier booking.',
    }
  } else if (integration === 'delhivery') {
    const svc = new DelhiveryService()
    cancellationResult = await svc.cancelShipment(awbNumber)
  } else if (integration === 'ekart') {
    const svc = new EkartService()
    cancellationResult = await svc.cancelShipment(awbNumber)
  } else if (integration === 'dtdc') {
    const svc = new DtdcService()
    cancellationResult = await svc.cancelShipment(awbNumber)
  } else if (integration === 'shadowfax') {
    const svc = new ShadowfaxService()
    const shadowfaxCancelRef = String(
      order.provider_request_id || order.provider_reference || awbNumber,
    ).trim()
    console.log('Shadowfax cancellation identifier', {
      orderId,
      awbNumber,
      providerRequestId: order.provider_request_id,
      providerReference: order.provider_reference,
      cancelReference: shadowfaxCancelRef,
      orderStatus: order.order_status,
    })
    try {
      cancellationResult = await svc.cancelShipment(shadowfaxCancelRef)
    } catch (error: any) {
      if (!isShadowfaxCancellationProcessingError(error)) {
        throw error
      }

      const requestedAt = new Date()
      const pendingResult = {
        success: true,
        pending: true,
        provider: 'shadowfax',
        message:
          'Shadowfax is still processing this new order. Cancellation has been requested and will finalize after provider confirmation.',
        provider_response: error?.response?.data || null,
      }

      console.warn('Shadowfax cancellation is processing; marking local order as cancellation_requested', {
        orderId,
        awbNumber,
        cancelReference: shadowfaxCancelRef,
        providerResponse: error?.response?.data || null,
      })

      await db
        .update(b2c_orders)
        .set({
          order_status: 'cancellation_requested',
          pickup_status: 'cancellation_requested',
          provider_last_status: 'cancellation_requested',
          delivery_message: 'Cancellation requested with Shadowfax',
          provider_meta: {
            ...providerMeta,
            cancellation: {
              provider: integration,
              requested_at: requestedAt.toISOString(),
              awb_number: awbNumber || null,
              pending: true,
              result: pendingResult,
            },
          },
          updated_at: requestedAt,
        })
        .where(eq(b2c_orders.id, orderId))

      await logTrackingEvent({
        orderId: order.id,
        userId: order.user_id,
        awbNumber: awbNumber || null,
        courier: order.courier_partner || integration,
        statusCode: 'cancellation_requested',
        statusText: 'Cancellation requested',
        raw: pendingResult,
      }).catch((err) => {
        console.warn('Failed to log Shadowfax cancellation-requested event:', err)
      })

      await sendWebhookEvent(order.user_id, 'tracking.updated', {
        awb_number: awbNumber || order.awb_number,
        order_id: order.id,
        order_number: order.order_number,
        status: 'cancellation_requested',
        raw_status: 'cancellation_requested',
        courier_partner: order.courier_partner,
      }).catch((err) => {
        console.warn('Failed to send Shadowfax cancellation-requested webhook:', err)
      })

      await syncSalesChannelStatusForOrder(orderId, 'cancellation request')

      return pendingResult
    }
  } else if (integration === 'amazon') {
    const amazonCredentials = await getStoredAmazonShippingCredentials()
    applyAmazonShippingCredentialsToEnv(amazonCredentials)
    cancellationResult = await cancelAmazonShipmentWithRetry({
      shipmentId: amazonShipmentId,
      order,
      credentials: amazonCredentials,
    })
  } else {
    const svc = new XpressbeesService()
    cancellationResult = await svc.cancelShipment(awbNumber)
  }

  const isSuccess = isCancellationAccepted(cancellationResult)

  console.log('Courier cancellation response validation:', {
    integration,
    isSuccess,
    success: cancellationResult?.success,
    Success: cancellationResult?.Success,
    status: cancellationResult?.status,
    statusType: typeof cancellationResult?.status,
    remark: cancellationResult?.remark,
    message: cancellationResult?.message,
    error: cancellationResult?.error,
    fullResponse: cancellationResult,
  })

  if (!isSuccess) {
    const errorMsg = getCancellationErrorMessage(cancellationResult)
    console.error('Courier cancellation failed:', {
      orderId,
      integration,
      response: cancellationResult,
      message: errorMsg,
    })
    throw new Error(errorMsg)
  }

  const finalStatus = 'cancelled'
  console.log(`Updating order status to ${finalStatus}:`, { orderId, integration })
  const cancelledAt = new Date()

  await db.transaction(async (tx) => {
    await tx
      .update(b2c_orders)
      .set({
        order_status: finalStatus,
        pickup_status: finalStatus,
        provider_last_status: finalStatus,
        delivery_message: getCancellationDeliveryMessage(cancellationResult),
        provider_meta: {
          ...providerMeta,
          cancellation: {
            provider: integration,
            requested_at: cancelledAt.toISOString(),
            awb_number: awbNumber || null,
            result: cancellationResult,
          },
        },
        updated_at: cancelledAt,
      })
      .where(eq(b2c_orders.id, orderId))

    await applyCancellationRefundOnce(tx, order, 'pickup_cancel_api')
  })

  await syncSalesChannelStatusForOrder(orderId, 'order cancellation')

  await logTrackingEvent({
    orderId: order.id,
    userId: order.user_id,
    awbNumber: awbNumber || null,
    courier: order.courier_partner || integration,
    statusCode: finalStatus,
    statusText: 'Shipment cancelled',
    raw: cancellationResult,
  }).catch((err) => {
    console.warn('Failed to log cancellation tracking event:', err)
  })

  await sendWebhookEvent(order.user_id, 'tracking.updated', {
    awb_number: awbNumber || order.awb_number,
    order_id: order.id,
    order_number: order.order_number,
    status: finalStatus,
    raw_status: finalStatus,
    courier_partner: order.courier_partner,
  }).catch((err) => {
    console.warn('Failed to send cancellation tracking webhook:', err)
  })

  await sendWebhookEvent(order.user_id, 'order.cancelled', {
    awb_number: awbNumber || order.awb_number,
    order_id: order.id,
    order_number: order.order_number,
    status: finalStatus,
    courier_partner: order.courier_partner,
  }).catch((err) => {
    console.warn('Failed to send order cancellation webhook:', err)
  })

  console.log(`Order status updated to ${finalStatus} successfully:`, { orderId, integration })

  return cancellationResult
}
