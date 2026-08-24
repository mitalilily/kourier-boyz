import axios from 'axios'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { b2b_orders } from '../schema/b2bOrders'
import { b2c_orders } from '../schema/b2cOrders'
import { invoicePreferences } from '../schema/invoicePreferences'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { sanitizeOrdersForCustomer } from '../../utils/orderSanitizer'
import { getAmazonOrderLabelReference } from '../../utils/orderLabels'
import {
  backfillDelhiveryB2BLabelsService,
  IOrderFilters,
  PaginationParams,
} from './shiprocket.service'
import { generateLabelForOrder } from './generateCustomLabelService'
import dayjs from 'dayjs'
import { generateInvoicePDF, Product } from './invoice.service'
import {
  formatPickupAddress,
  loadInvoiceAssets,
  normalizePickupDetails,
} from './invoiceHelpers'
import { presignDownload, presignUpload } from './upload.service'
import { resolveInvoiceNumber } from './invoiceNumber.service'
import {
  fetchCombinedOrderStatusSummary,
  fetchCombinedOrdersPage,
  fetchOrderUserMetadata,
} from './orderListing.service'
import { recordNdrEvent } from './ndr.service'
import { logTrackingEvent } from './trackingEvents.service'
import { createNotificationService } from './notifications.service'

const ADMIN_UPDATABLE_ORDER_STATUSES = new Set([
  'pending',
  'booked',
  'shipment_created',
  'pickup_initiated',
  'in_transit',
  'out_for_delivery',
  'ndr',
  'undelivered',
  'delivered',
  'cancellation_requested',
  'cancelled',
  'rto',
  'rto_in_transit',
  'rto_delivered',
  'manifest_failed',
])

const ADMIN_NDR_STATUSES = new Set(['ndr', 'undelivered'])

const isDelhiveryB2BOrder = (order: any, orderType: string) =>
  orderType === 'b2b' &&
  (String(order?.integration_type || '').trim().toLowerCase() === 'delhivery' ||
    String(order?.courier_partner || '').trim().toLowerCase().includes('delhivery'))

const resolveProviderDocumentLookup = (order: any) =>
  String(
    order?.awb_number ||
      order?.provider_request_id ||
      order?.provider_reference ||
      order?.shipment_id ||
      order?.order_id ||
      order?.order_number ||
    '',
  ).trim()

const preferenceText = (value: unknown) => String(value ?? '').trim()

const getInvoiceLogoKey = (prefs: any, fallbackLogoKey?: unknown) => {
  if (prefs?.includeLogo === false) return undefined
  return preferenceText(prefs?.logoFile) || preferenceText(fallbackLogoKey) || undefined
}

export const getAllOrdersServiceAdmin = async ({
  page = 1,
  limit = 10,
  filters = {} as IOrderFilters,
  sanitizeDocuments = true,
}: PaginationParams & { filters?: IOrderFilters; sanitizeDocuments?: boolean }) => {
  const combinedFilters = {
    userId: filters.userId,
    status: filters.status,
    statusGroup: (filters as any).statusGroup,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    search: filters.search,
    pickupAlert: (filters as any).pickupAlert,
    sortBy: (filters as any).sortBy,
    sortOrder: filters.sortOrder,
  }

  const [{ orders: combinedOrdersRaw, totalCount, totalPages }, statusSummary] =
    await Promise.all([
      fetchCombinedOrdersPage({
        page,
        limit,
        filters: combinedFilters,
      }),
      fetchCombinedOrderStatusSummary(combinedFilters),
    ])

  if (totalCount === 0) {
    return {
      orders: [],
      totalCount: 0,
      totalPages: 0,
      statusSummary,
    }
  }

  const userIds = combinedOrdersRaw
    .map((order) => order.user_id)
    .filter((id): id is string => Boolean(id))
  const { userProfilesMap, usersMap } = await fetchOrderUserMetadata(userIds)

  const combinedOrders = combinedOrdersRaw.map((order) => {
    const userId = order.user_id
    const profile = userId ? userProfilesMap.get(userId) || null : null
    const userRecord = userId ? usersMap.get(userId) || null : null

    const companyName =
      profile?.companyInfo?.companyName ||
      profile?.companyInfo?.displayName ||
      null

    return {
      ...order,
      userProfile: profile,
      merchantName: companyName || userRecord?.email || userRecord?.phone || null,
      merchantEmail: userRecord?.email || null,
      merchantPhone: userRecord?.phone || null,
    }
  })

  return {
    orders: sanitizeDocuments ? await sanitizeOrdersForCustomer(combinedOrders) : combinedOrders,
    totalCount,
    totalPages,
    statusSummary,
  }
}

const toNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const normalizeProducts = (rawProducts: unknown, fallbackAmount = 0): Product[] => {
  let productsData: any[] = []
  if (Array.isArray(rawProducts)) {
    productsData = rawProducts
  } else if (typeof rawProducts === 'string' && rawProducts.trim()) {
    try {
      const parsed = JSON.parse(rawProducts)
      productsData = Array.isArray(parsed) ? parsed : []
    } catch {
      productsData = []
    }
  }

  const products = productsData.map((p: any) => ({
    name: p?.name ?? p?.productName ?? p?.box_name ?? 'N/A',
    price: toNumber(p?.price),
    qty: Math.max(1, toNumber(p?.qty ?? p?.quantity, 1)),
    sku: p?.sku ?? p?.skuCode ?? '',
    hsn: p?.hsn ?? p?.hsnCode ?? '',
    discount: Math.max(0, toNumber(p?.discount)),
    tax_rate: Math.max(0, toNumber(p?.tax_rate ?? p?.taxRate)),
  }))

  if (products.length > 0) return products
  return [
    {
      name: 'Product',
      price: toNumber(fallbackAmount),
      qty: 1,
      sku: '',
      hsn: '',
      discount: 0,
      tax_rate: 0,
    },
  ]
}

export const regenerateOrderDocumentsServiceAdmin = async ({
  orderId,
  regenerateLabel = true,
  regenerateInvoice = true,
  expectedUserId,
}: {
  orderId: string
  regenerateLabel?: boolean
  regenerateInvoice?: boolean
  expectedUserId?: string
}) => {
  if (!regenerateLabel && !regenerateInvoice) {
    throw new Error('At least one document must be selected for regeneration')
  }

  const [b2cOrder] = await db.select().from(b2c_orders).where(eq(b2c_orders.id, orderId)).limit(1)
  const [b2bOrder] = b2cOrder
    ? [undefined]
    : await db.select().from(b2b_orders).where(eq(b2b_orders.id, orderId)).limit(1)

  const order = b2cOrder || b2bOrder
  if (!order) throw new Error('Order not found')

  const orderType = b2cOrder ? 'b2c' : 'b2b'
  const userId = order.user_id
  if (!userId) throw new Error('Order user not found')
  if (expectedUserId && userId !== expectedUserId) throw new Error('Order not found')

  let newLabelKey: string | null = null
  let newInvoiceKey: string | null = null

  if (regenerateLabel) {
    const isAmazonOrder = String(order.integration_type || order.courier_partner || '')
      .toLowerCase()
      .includes('amazon')

    if (isAmazonOrder) {
      const labelKey = getAmazonOrderLabelReference(order)
      if (!labelKey || typeof labelKey !== 'string') {
        throw new Error('Amazon label regeneration failed because the provider label was not available')
      }
      newLabelKey = labelKey.trim()
    } else if (isDelhiveryB2BOrder(order, orderType)) {
      const lookup = resolveProviderDocumentLookup(order)
      if (!lookup) {
        throw new Error('Delhivery B2B label regeneration failed because AWB/LRN was not available')
      }

      const backfillResult = await backfillDelhiveryB2BLabelsService({
        orderNumber: lookup,
        limit: 1,
        onlyMissing: false,
      })
      const storedLabelKey = backfillResult.results.find((result) => result.status === 'stored')?.label_key
      if (!storedLabelKey || typeof storedLabelKey !== 'string') {
        throw new Error('Delhivery B2B label regeneration failed because provider labels were not available')
      }
      newLabelKey = storedLabelKey.trim()
    } else {
      const labelKey = await generateLabelForOrder(order, userId, db)
      if (!labelKey || typeof labelKey !== 'string') {
        throw new Error('Label regeneration failed')
      }
      newLabelKey = labelKey.trim()
    }
  }

  let generatedInvoiceData: { number: string; date: string; amount: number } | null = null

  if (regenerateInvoice) {
    const [prefs] = await db
      .select()
      .from(invoicePreferences)
      .where(eq(invoicePreferences.userId, userId))
      .limit(1)
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1)
    const companyInfo = (profile as any)?.companyInfo || {}
    const gstDetails = (profile as any)?.gstDetails || {}
    const companyName =
      companyInfo.companyName || companyInfo.businessName || companyInfo.brandName || ''
    const companyGST = gstDetails.gstNumber || companyInfo.gstNumber || ''

    const invoiceNumber = await resolveInvoiceNumber({
      userId,
      existingInvoiceNumber: (order as any)?.invoice_number,
      prefix: prefs?.prefix ?? undefined,
      suffix: prefs?.suffix ?? undefined,
    })
    const invoiceDateDisplay = dayjs().format('DD MMM YYYY')
    const invoiceDateStored = dayjs().format('YYYY-MM-DD')
    const pickupDetails = normalizePickupDetails(order.pickup_details)
    const pickupPincode = pickupDetails?.pincode

    const serviceType = (order as any).service_type || order.integration_type || order.courier_partner || ''
    const pickupAddress = formatPickupAddress(pickupDetails)
    const sellerAddress =
      preferenceText(prefs?.sellerAddress) ||
      pickupAddress ||
      companyInfo.companyAddress ||
      companyInfo.address ||
      ''
    const sellerStateCode =
      preferenceText(prefs?.stateCode) || pickupDetails?.state || companyInfo.state || ''
    const sellerName =
      preferenceText(prefs?.sellerName) ||
      pickupDetails?.warehouse_name ||
      companyInfo.brandName ||
      companyInfo.companyName ||
      companyInfo.businessName ||
      'Seller'
    const brandName =
      preferenceText(prefs?.brandName) ||
      companyInfo.brandName ||
      companyInfo.companyName ||
      pickupDetails?.warehouse_name ||
      ''
    const gstNumber =
      preferenceText(prefs?.gstNumber) || companyGST || companyInfo.gstNumber || companyInfo.gst || ''
    const panNumber = preferenceText(prefs?.panNumber) || companyInfo.panNumber || companyInfo.pan || ''
    const supportPhone =
      preferenceText(prefs?.supportPhone) ||
      pickupDetails?.phone ||
      companyInfo.companyContactNumber ||
      companyInfo.contactNumber ||
      ''
    const supportEmail =
      preferenceText(prefs?.supportEmail) || companyInfo.contactEmail || companyInfo.companyEmail || ''

    const products = normalizeProducts(order.products, toNumber(order.order_amount))
    const { logoBuffer, signatureBuffer } = await loadInvoiceAssets(
      {
        companyLogoKey: getInvoiceLogoKey(prefs, companyInfo.companyLogoUrl),
        includeSignature: prefs?.includeSignature,
        signatureFile: prefs?.signatureFile ?? undefined,
      },
      order.order_number || String(order.id),
    )

    const invoiceAmount =
      toNumber(order.order_amount) +
      toNumber(order.shipping_charges) +
      toNumber((order as any).gift_wrap) +
      toNumber((order as any).transaction_fee) -
      (toNumber((order as any).discount) + toNumber((order as any).prepaid_amount))

    generatedInvoiceData = {
      number: invoiceNumber,
      date: invoiceDateStored,
      amount: invoiceAmount,
    }

    const invoiceBuffer = await generateInvoicePDF({
      invoiceNumber,
      invoiceDate: invoiceDateDisplay,
      invoiceAmount,
      buyerName: order.buyer_name,
      buyerPhone: order.buyer_phone,
      buyerEmail: order.buyer_email ?? '',
      buyerAddress: order.address,
      buyerCity: order.city,
      buyerState: order.state,
      buyerPincode: order.pincode,
      products,
      shippingCharges: toNumber(order.shipping_charges),
      giftWrap: toNumber((order as any).gift_wrap),
      transactionFee: toNumber((order as any).transaction_fee),
      discount: toNumber((order as any).discount),
      prepaidAmount: toNumber((order as any).prepaid_amount),
      courierName: (order as any).courier_partner ?? '',
      courierId: String((order as any).courier_id ?? ''),
      logoBuffer,
      orderType: (order.order_type as 'prepaid' | 'cod') || 'prepaid',
      courierCod: order.order_type === 'cod' ? toNumber((order as any).cod_charges) : 0,
      signatureBuffer,
      companyName: sellerName,
      supportEmail,
      supportPhone,
      companyGST: gstNumber,
      sellerName,
      brandName,
      sellerAddress,
      sellerStateCode,
      gstNumber,
      panNumber,
      invoiceNotes: prefs?.invoiceNotes ?? '',
      termsAndConditions: prefs?.termsAndConditions ?? '',
      orderId: order.order_number,
      awbNumber: order.awb_number ?? '',
      courierPartner: order.courier_partner ?? '',
      serviceType,
      pickupPincode: pickupPincode ?? '',
      deliveryPincode: order.pincode ?? '',
      orderDate: order.order_date ?? '',
      rtoCharges: Number((order as any).rto_charges ?? 0),
      layout: ((prefs?.template as 'classic' | 'thermal') ?? 'classic'),
    })

    const { uploadUrl, key } = await presignUpload({
      filename: `invoice-${order.id}.pdf`,
      contentType: 'application/pdf',
      userId,
      folderKey: 'invoices',
    })
    const finalUploadUrl = Array.isArray(uploadUrl) ? uploadUrl[0] : uploadUrl
    await axios.put(finalUploadUrl, invoiceBuffer, {
      headers: { 'Content-Type': 'application/pdf' },
      validateStatus: (status) => status >= 200 && status < 300,
      timeout: 60000,
    })
    const finalKey = Array.isArray(key) ? key[0] : key
    if (!finalKey || typeof finalKey !== 'string') {
      throw new Error('Invoice upload key missing')
    }
    newInvoiceKey = finalKey.trim()
  }

  const updates: Record<string, unknown> = { updated_at: new Date() }
  if (newLabelKey) updates.label = newLabelKey
  if (newInvoiceKey) updates.invoice_link = newInvoiceKey
  if (newInvoiceKey && generatedInvoiceData) {
    updates.invoice_number = generatedInvoiceData.number
    updates.invoice_date = generatedInvoiceData.date
    updates.invoice_amount = generatedInvoiceData.amount
  }

  if (orderType === 'b2c') {
    await db.update(b2c_orders).set(updates).where(eq(b2c_orders.id, orderId))
  } else {
    await db.update(b2b_orders).set(updates).where(eq(b2b_orders.id, orderId))
  }

  return {
    orderId,
    orderType,
    label: newLabelKey,
    invoice_link: newInvoiceKey,
  }
}

export const addManualNdrToOrderServiceAdmin = async ({
  orderId,
  adminUserId,
  status = 'ndr',
  reason,
  remarks,
  attemptNo,
}: {
  orderId: string
  adminUserId?: string
  status?: string
  reason?: string
  remarks?: string
  attemptNo?: string | number
}) => {
  const normalizedStatus = String(status || 'ndr').trim().toLowerCase()
  if (!normalizedStatus) {
    throw new Error('NDR status is required')
  }

  const [order] = await db.select().from(b2c_orders).where(eq(b2c_orders.id, orderId)).limit(1)
  if (!order) {
    throw new Error('B2C order not found')
  }

  const attemptValue =
    attemptNo !== undefined && attemptNo !== null && String(attemptNo).trim()
      ? String(attemptNo).trim()
      : '1'
  const auditRemarks = [remarks?.trim(), adminUserId ? `admin:${adminUserId}` : null]
    .filter(Boolean)
    .join(' | ')

  await db
    .update(b2c_orders)
    .set({
      order_status: normalizedStatus,
      updated_at: new Date(),
    })
    .where(eq(b2c_orders.id, order.id))

  const event = await recordNdrEvent({
    orderId: order.id,
    userId: order.user_id,
    awbNumber: order.awb_number || undefined,
    status: normalizedStatus,
    reason: reason?.trim() || 'Manual NDR added by admin',
    remarks: auditRemarks || 'Manual NDR added by admin',
    attemptNo: attemptValue,
    payload: {
      source: 'admin_manual',
      adminUserId: adminUserId || null,
      orderId: order.id,
    },
  })

  await logTrackingEvent({
    orderId: order.id,
    userId: order.user_id,
    awbNumber: order.awb_number || null,
    courier: order.courier_partner || order.integration_type || null,
    statusCode: normalizedStatus,
    statusText: reason?.trim() || 'Manual NDR added by admin',
    location: order.city || null,
    raw: {
      source: 'admin_manual_ndr',
      remarks: auditRemarks || null,
      adminUserId: adminUserId || null,
    },
  })

  await Promise.allSettled([
    createNotificationService({
      targetRole: 'user',
      userId: order.user_id,
      title: 'Order marked as NDR',
      message: `Order ${order.order_number} has been marked as ${normalizedStatus}.`,
    }),
    createNotificationService({
      targetRole: 'admin',
      title: 'Manual NDR added',
      message: `Order ${order.order_number} (${order.awb_number || order.id}) marked as ${normalizedStatus}.`,
    }),
  ])

  return { order, event }
}

export const updateOrderStatusServiceAdmin = async ({
  orderId,
  adminUserId,
  status,
  reason,
  remarks,
  attemptNo,
}: {
  orderId: string
  adminUserId?: string
  status?: string
  reason?: string
  remarks?: string
  attemptNo?: string | number
}) => {
  const normalizedStatus = String(status || '')
    .trim()
    .toLowerCase()
  if (!normalizedStatus) {
    throw new Error('Order status is required')
  }

  if (!ADMIN_UPDATABLE_ORDER_STATUSES.has(normalizedStatus)) {
    throw new Error('Unsupported order status')
  }

  const trimmedReason = String(reason || '').trim()
  const trimmedRemarks = String(remarks || '').trim()
  if (ADMIN_NDR_STATUSES.has(normalizedStatus) && !trimmedReason) {
    throw new Error('Reason is required for NDR and undelivered statuses')
  }

  const [b2cOrder] = await db.select().from(b2c_orders).where(eq(b2c_orders.id, orderId)).limit(1)
  const [b2bOrder] = b2cOrder
    ? [undefined]
    : await db.select().from(b2b_orders).where(eq(b2b_orders.id, orderId)).limit(1)

  const order = b2cOrder || b2bOrder
  if (!order) {
    throw new Error('Order not found')
  }

  const orderType = b2cOrder ? 'b2c' : 'b2b'
  const previousStatus = String(order.order_status || '').trim().toLowerCase()
  const auditRemarks = [trimmedRemarks || null, adminUserId ? `admin:${adminUserId}` : null]
    .filter(Boolean)
    .join(' | ')

  if (orderType === 'b2c') {
    await db
      .update(b2c_orders)
      .set({
        order_status: normalizedStatus,
        updated_at: new Date(),
      })
      .where(eq(b2c_orders.id, order.id))
  } else {
    await db
      .update(b2b_orders)
      .set({
        order_status: normalizedStatus,
        updated_at: new Date(),
      })
      .where(eq(b2b_orders.id, order.id))
  }

  let ndrEvent: any = null
  if (orderType === 'b2c' && ADMIN_NDR_STATUSES.has(normalizedStatus)) {
    const attemptValue =
      attemptNo !== undefined && attemptNo !== null && String(attemptNo).trim()
        ? String(attemptNo).trim()
        : '1'

    ndrEvent = await recordNdrEvent({
      orderId: order.id,
      userId: order.user_id,
      awbNumber: order.awb_number || undefined,
      status: normalizedStatus,
      reason: trimmedReason,
      remarks: auditRemarks || 'Manual status update by admin',
      attemptNo: attemptValue,
      payload: {
        source: 'admin_status_update',
        adminUserId: adminUserId || null,
        orderId: order.id,
        previousStatus: previousStatus || null,
      },
    })
  }

  await logTrackingEvent({
    orderId: order.id,
    userId: order.user_id,
    awbNumber: order.awb_number || null,
    courier: order.courier_partner || null,
    statusCode: normalizedStatus,
    statusText:
      trimmedReason ||
      `Order status changed by admin${previousStatus ? ` from ${previousStatus}` : ''}`,
    location: order.city || null,
    raw: {
      source: 'admin_manual_status_update',
      remarks: auditRemarks || null,
      adminUserId: adminUserId || null,
      previousStatus: previousStatus || null,
    },
  })

  const userMessage = trimmedReason
    ? `Order ${order.order_number} status updated to ${normalizedStatus}: ${trimmedReason}.`
    : `Order ${order.order_number} status updated to ${normalizedStatus}.`
  const adminMessage = `${orderType.toUpperCase()} order ${order.order_number} (${order.awb_number || order.id}) status updated to ${normalizedStatus}.`

  await Promise.allSettled([
    createNotificationService({
      targetRole: 'user',
      userId: order.user_id,
      title: 'Order status updated',
      message: userMessage,
    }),
    createNotificationService({
      targetRole: 'admin',
      title: 'Admin updated order status',
      message: adminMessage,
    }),
  ])

  return {
    orderId: order.id,
    orderType,
    previousStatus: previousStatus || null,
    currentStatus: normalizedStatus,
    ndrEvent,
  }
}
