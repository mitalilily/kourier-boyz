import { Request, Response } from 'express'
import mongoose, { HydratedDocument } from 'mongoose'
import Order, {
  IOrder,
  IOrderItem,
  IOrderSellerShipment,
  ISellerShippingMeta,
  SellerShipmentStatus,
} from '../models/Order'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import { Shipment } from '../models/Shipment'
import User, { IUser } from '../models/User'
import { io } from '../server'
import {
  ShippingCreateShipmentRequest,
  ShippingManifestRequest,
  ShippingRateRequest,
  shippingProviderService,
} from '../services/shippingProvider.service'
import { checkUserAccess } from '../utils/checkUserAccess'
import { emailTemplates, sendEmail } from '../utils/email'
import { generateInvoice } from '../utils/invoiceGenerator'
import { generateLabel, isProductFragile } from '../utils/labelGenerator'
import {
  SELLER_STATUS_SET,
  canCancelOrder,
  computeSellerTotals,
  filterSellerItems,
  isForwardStatusTransition,
  notifyOrderShipped,
  recalcOrderStatus,
  updateShipmentStatus,
} from '../utils/orderStatus'
import { uploadToR2 } from '../utils/r2Upload'
import { buildForwardShipmentOrderNumber } from '../utils/shippingOrderNumber'
import { generateTrackingUrl, getTrackingIdentifier } from '../utils/trackingUrl'

// Helper function to restore stock when order is cancelled
const restoreOrderStock = async (orderItems: IOrderItem[]) => {
  for (const orderItem of orderItems) {
    if (orderItem.variant) {
      // Restore variant stock
      await ProductVariant.findByIdAndUpdate(orderItem.variant, {
        $inc: { stock: orderItem.quantity },
      })
      // Update product totalStock (sum of all variant stocks)
      const product = await Product.findById(orderItem.product)
      if (product && product.hasVariants) {
        const variants = await ProductVariant.find({
          product: orderItem.product,
        })
        const totalStock = variants.reduce((sum, v) => sum + v.stock, 0)
        await Product.updateOne({ _id: orderItem.product }, { totalStock })
      }
    } else {
      // Restore product stock directly
      await Product.updateOne({ _id: orderItem.product }, { $inc: { stock: orderItem.quantity } })
    }
  }
}
const toObjectId = (id: string) => new mongoose.Types.ObjectId(id)

const cloneDoc = <T>(doc: T): T =>
  doc && typeof (doc as any).toObject === 'function'
    ? ((doc as any).toObject({ virtuals: true }) as T)
    : (doc as T)

const normalizeSellerShipment = (shipment?: IOrderSellerShipment | null) =>
  shipment ? cloneDoc(shipment) : null

const isSameShippingAddress = (a: IOrder['shippingAddress'], b: IOrder['shippingAddress']) => {
  if (!a || !b) return false
  return (
    a.name === b.name &&
    a.phone === b.phone &&
    a.addressLine1 === b.addressLine1 &&
    (a.addressLine2 || '') === (b.addressLine2 || '') &&
    a.city === b.city &&
    a.state === b.state &&
    a.postalCode === b.postalCode &&
    a.country === b.country
  )
}

const toSellerResponse = (orderDoc: any, sellerId: string) => {
  const plain = cloneDoc(orderDoc)
  const sellerShipment = normalizeSellerShipment(
    plain.sellerShipments?.find((shipment: IOrderSellerShipment) => {
      return shipment?.seller?._id?.toString() === sellerId
    }),
  )
  const sellerItems = filterSellerItems(plain.items || [], sellerId)
  const totals = computeSellerTotals(sellerItems)

  // Original (pre item-level coupon) subtotal for this seller = sum of unit price * qty
  const originalSubtotal = sellerItems.reduce((sum: number, item: any) => {
    const unitPrice = Number(item.price || 0)
    const qty = Number(item.quantity || 0)
    if (!Number.isFinite(unitPrice) || !Number.isFinite(qty)) return sum
    return sum + unitPrice * qty
  }, 0)

  // Seller-facing total should reflect only seller item totals after any seller coupons.
  // Platform-funded (admin) cart coupons should NOT reduce this amount.
  const netTotal = totals.itemSubtotal

  // If an admin/global coupon was applied on this order, expose minimal info for transparency.
  let adminCouponSummary: { code: string; type: string; value: number } | undefined
  if (plain.coupon && typeof (plain.coupon as any).code === 'string') {
    const c: any = plain.coupon
    adminCouponSummary = {
      code: c.code,
      type: c.type,
      value: c.value,
    }
  }

  return {
    _id: plain._id,
    orderNumber: plain.orderNumber,
    batchId: plain.batchId?.toString?.(),
    batchCode: plain.batchCode,
    // Expose order-level invoice & label so seller UI can show download buttons
    invoice: plain.invoice,
    label: plain.label,
    buyer: {
      name: plain?.shippingAddress?.name,
      phone: plain?.shippingAddress?.phone,
      email: plain?.user?.email,
    },
    paymentStatus: plain.paymentStatus,
    paymentMethod: plain.paymentMethod,
    status: sellerShipment?.status || 'pending',
    // Total shown to seller = item subtotal after any seller coupons (no admin/cart coupon)
    total: netTotal,
    originalTotal: originalSubtotal || netTotal,
    orderedAt: plain.createdAt,
    shippingAddress: plain.shippingAddress,
    deliveryInstructions: plain.deliveryInstructions,
    sellerShipment: sellerShipment
      ? {
          ...sellerShipment,
          // Generate shareable tracking link
          shareableTrackingLink: (() => {
            const awb = sellerShipment.shippingMeta?.awb || sellerShipment.kourierBoyzLogistics?.awb_number
            const trackingIdentifier = getTrackingIdentifier(awb, plain.orderNumber)
            return trackingIdentifier ? generateTrackingUrl(trackingIdentifier) : null
          })(),
          // Explicitly include invoice, triplicate (To Supplier), and label for shipment-level access
          invoice: sellerShipment.invoice || null,
          triplicateInvoice: sellerShipment.triplicateInvoice || null,
          label: sellerShipment.label || null,
        }
      : null,
    adminCoupon: adminCouponSummary,
    // Settlement eligibility fields
    settlementStatus: plain.settlementStatus || null,
    settlementEligibleAt: plain.settlementEligibleAt || null,
    settlementBatch: plain.settlementBatch?.toString() || null,
    sellerSaleAmount: plain.sellerSaleAmount || null,
    sellerCommissionAmount: plain.sellerCommissionAmount || null,
    sellerNetAmount: plain.sellerNetAmount || null,
    canShip:
      !!sellerShipment &&
      sellerShipment.inventoryPacked &&
      sellerShipment.status === 'processing' &&
      plain.paymentStatus === 'paid',
    items: sellerItems.map((item: any) => {
      const product: any = item.product || {}
      let variant: any = item.variant || null

      // Normalize variant attributes if it's a Map
      if (variant && typeof variant === 'object' && variant.attributes instanceof Map) {
        variant = {
          ...variant,
          attributes: Object.fromEntries(variant.attributes),
        }
      }

      // Build a single merged "item" object for the seller UI
      const mergedItem = {
        productId: product?._id?.toString?.(),
        variantId: variant?._id?.toString?.(),
        // Prefer variant-level name/sku/image; fall back to product
        name: (variant && variant.name) || product.name,
        baseName: product.name,
        sku: (variant && variant.sku) || product.sku,
        baseSku: product.sku,
        mainImage:
          (variant && (variant.mainImage || variant.image || variant.thumbnail)) ||
          product.mainImage ||
          product.thumbnail ||
          product.image ||
          (Array.isArray(product.images) && product.images[0]?.url) ||
          undefined,
      }

      const quantity = item.quantity
      const unitPrice = item.price
      const lineSubtotal = item.subtotal || 0
      const lineOriginalTotal =
        typeof unitPrice === 'number' && typeof quantity === 'number'
          ? unitPrice * quantity
          : lineSubtotal
      const lineDiscount = Math.max(0, lineOriginalTotal - lineSubtotal)

      return {
        // Use the actual order item _id, not the product id
        _id: (item as any)?._id,
        item: mergedItem,
        quantity,
        price: unitPrice,
        subtotal: lineSubtotal,
        instructions: item.instructions,
        sellerStatus: item.sellerStatus,
        couponCode: item.couponCode,
        couponDiscountAmount: lineDiscount > 0 ? lineDiscount : undefined,
      }
    }),
  }
}

const fetchSeller = async (sellerId: string) => {
  const seller = await User.findById(sellerId)
  if (!seller) {
    throw new Error('Seller profile not found')
  }
  return seller
}

const pickSellerAddress = (seller: IUser, preferredId?: string) => {
  const addresses = seller.pickupAddresses || []

  // If there are pickup addresses, use them
  if (addresses.length) {
    if (preferredId) {
      // Try to match by MongoDB _id first
      let matched = addresses.find(
        (address: any) => address?._id?.toString && address._id.toString() === preferredId,
      )
      // If not found by _id, try matching by the synced shipping-provider pickup address ID
      if (!matched) {
        matched = addresses.find(
          (address: any) =>
            address?.kourierBoyzLogisticsPickupAddressId &&
            String(address.kourierBoyzLogisticsPickupAddressId) === preferredId,
        )
      }
      if (matched) return matched
    }
    const defaultAddress = addresses.find((address: any) => address.isDefault)
    return defaultAddress || addresses[0]
  }

  // Fallback to business address if no pickup addresses exist
  if (seller.addressLine1 && seller.city && seller.state && seller.postalCode && seller.country) {
    return {
      warehouseName: seller.businessName || 'Default Warehouse',
      addressLine1: seller.addressLine1,
      addressLine2: seller.addressLine2,
      city: seller.city,
      state: seller.state,
      postalCode: seller.postalCode,
      country: seller.country,
      contactName: seller.name,
      contactPhone: seller.storePhone || seller.phone || '',
      isDefault: true,
    }
  }

  return null
}

const ensureSellerAccess = (
  order: HydratedDocument<IOrder> | null,
  sellerId: string,
): {
  order: HydratedDocument<IOrder>
  sellerShipment: IOrderSellerShipment
} => {
  if (!order) {
    throw new Error('ORDER_NOT_FOUND')
  }
  const shipment = order.sellerShipments.find(
    (sellerShipment) => sellerShipment?.seller?._id?.toString() === sellerId,
  )
  if (!shipment) {
    throw new Error('SELLER_SHIPMENT_NOT_FOUND')
  }
  return { order, sellerShipment: shipment }
}

const buildRateRequest = (
  order: IOrder,
  sellerShipment: IOrderSellerShipment,
  seller: IUser,
  body: {
    weight: number
    dimensions?: { length: number; width: number; height: number }
  },
) => {
  const destinationPincode = order.shippingAddress?.postalCode
  if (!destinationPincode) {
    throw new Error('ORDER_ADDRESS_INCOMPLETE')
  }

  const address = pickSellerAddress(seller)
  if (!address) {
    throw new Error('SELLER_PICKUP_ADDRESS_MISSING')
  }

  const sellerItems = order.items.filter(
    (item) => item.seller?.toString() === sellerShipment.seller.toString(),
  )
  const sellerTotals = computeSellerTotals(sellerItems)

  const payload: ShippingRateRequest = {
    destination: destinationPincode,
    payment_type: order.paymentMethod === 'cod' ? 'cod' : 'prepaid',
    order_amount: sellerTotals.itemSubtotal,
    weight: body.weight,
    length: body.dimensions?.length || 10,
    breadth: body.dimensions?.width || 10,
    height: body.dimensions?.height || 10,
    shipment_type: 'b2c',
  }

  if (address.kourierBoyzLogisticsPickupAddressId) {
    payload.pickup_id = address.kourierBoyzLogisticsPickupAddressId
  } else {
    payload.origin = address.postalCode
  }

  return { payload, pickupAddress: address }
}

const buildShippingMeta = (
  sellerShipment: IOrderSellerShipment,
  addressSnapshot: any,
  packageInput: {
    weight: number
    length: number
    width: number
    height: number
  },
): ISellerShippingMeta => {
  return {
    awb: sellerShipment?.kourierBoyzLogistics?.awb_number,
    courier: sellerShipment?.kourierBoyzLogistics?.courier_id?.toString(),
    label: sellerShipment?.kourierBoyzLogistics?.label_url,
    tracking_link: sellerShipment?.kourierBoyzLogistics?.tracking_link,
    weight: packageInput.weight,
    dimensions: {
      length: packageInput.length,
      width: packageInput.width,
      height: packageInput.height,
    },
    pickup_address: {
      warehouseName: addressSnapshot?.warehouseName,
      addressLine1: addressSnapshot?.addressLine1,
      addressLine2: addressSnapshot?.addressLine2,
      city: addressSnapshot?.city,
      state: addressSnapshot?.state,
      postalCode: addressSnapshot?.postalCode,
      country: addressSnapshot?.country,
      contactName: addressSnapshot?.contactName,
      contactPhone: addressSnapshot?.contactPhone,
    },
  }
}

export const getSellerOrders = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const { status, paymentStatus, fromDate, toDate, search, page = 1, limit = 20 } = req.query

    const sellerObjectId = toObjectId(sellerId)
    const query: any = {
      'items.seller': sellerObjectId,
    }

    if (status && typeof status === 'string') {
      query.sellerShipments = {
        $elemMatch: { seller: sellerObjectId, status },
      }
    }

    if (paymentStatus && typeof paymentStatus === 'string') {
      query.paymentStatus = paymentStatus
    }

    if (fromDate || toDate) {
      query.createdAt = {}
      if (fromDate) query.createdAt.$gte = new Date(fromDate as string)
      if (toDate) query.createdAt.$lte = new Date(toDate as string)
    }

    if (search && typeof search === 'string') {
      const regex = new RegExp(search, 'i')
      const conditions: any[] = [{ orderNumber: regex }]
      if (mongoose.Types.ObjectId.isValid(search)) {
        conditions.push({ _id: new mongoose.Types.ObjectId(search) })
      }
      query.$or = conditions
    }

    const numericLimit = Number(limit) || 20
    const numericPage = Number(page) || 1
    const batchSkip = (numericPage - 1) * numericLimit

    const batchPagination = await Order.aggregate([
      { $match: query },
      {
        $addFields: {
          sellerBatchKey: { $ifNull: ['$batchId', '$_id'] },
        },
      },
      {
        $group: {
          _id: '$sellerBatchKey',
          orderedAt: { $max: '$createdAt' },
        },
      },
      { $sort: { orderedAt: -1, _id: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: batchSkip }, { $limit: numericLimit }],
        },
      },
    ])

    const batchPage = batchPagination[0]
    const batchGroups = (batchPage?.data || []) as Array<{ _id: mongoose.Types.ObjectId; orderedAt: Date }>
    const batchTotal = batchPage?.metadata?.[0]?.total || 0

    if (!batchGroups.length) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          total: batchTotal,
          page: numericPage,
          limit: numericLimit,
          pages: Math.ceil(batchTotal / numericLimit),
        },
      })
    }

    const pageBatchIds = batchGroups.map((group) => group._id)
    const pageBatchIdStrings = batchGroups.map((group) => group._id.toString())

    const pagedOrdersQuery = {
      ...query,
      $and: [
        ...(query.$and || []),
        {
          $or: [
            { batchId: { $in: pageBatchIds } },
            {
              _id: { $in: pageBatchIds },
              $or: [{ batchId: { $exists: false } }, { batchId: null }],
            },
          ],
        },
      ],
    }

    delete pagedOrdersQuery.$or
    if (query.$or) {
      pagedOrdersQuery.$and.unshift({ $or: query.$or })
    }

    const orders = await Order.find(pagedOrdersQuery)
      .populate('items.product', 'name slug mainImage sku')
      .populate(
        'items.variant',
        'name sku attributes price comparePrice costPrice weight dimensions images mainImage status isDefault stock',
      )
      .populate('user', 'name email')
      .populate('coupon', 'code type value')
      .sort({ createdAt: -1 })
      .lean()

    // First map raw Order docs into seller-scoped order views
    const sellerOrders = orders.map((order) => toSellerResponse(order, sellerId))

    // Group seller orders by batch so API is batch-wise for the seller UI
    type SellerOrderForBatch = ReturnType<typeof toSellerResponse>
    type SellerShipmentGroupForBatch = {
      shipmentId: string
      status: SellerShipmentStatus
      orderIds: string[]
      courier?: string
      awb?: string
      kourierBoyzLogisticsOrderId?: string
      shippingMeta?: ISellerShippingMeta
      invoice?: {
        invoice_id?: string
        invoice_url?: string
        invoice_number?: string
        generated_at?: Date
        hsnSummary?: Array<{
          hsnSacCode: string
          gstRatePercent: number
          taxableValueTotal: number
          igstAmountTotal: number
          cgstAmountTotal: number
          sgstAmountTotal: number
        }>
      }
      triplicateInvoice?: {
        invoice_id?: string
        invoice_url?: string
        invoice_number?: string
        generated_at?: Date
      }
      label?: {
        label_id?: string
        label_url?: string
        generated_at?: Date
      }
    }
    type SellerOrderBatch = {
      batchId?: string
      batchCode?: string
      orders: SellerOrderForBatch[]
      orderCount: number
      buyerNames: string
      paymentStatus: IOrder['paymentStatus'] | 'mixed'
      status: SellerShipmentStatus | 'mixed'
      total: number
      orderedAt: Date | string
      shipments?: SellerShipmentGroupForBatch[]
    }

    const batchMap = new Map<string, SellerOrderBatch>()

    sellerOrders.forEach((order) => {
      const key = order.batchId || order._id.toString()
      const existing = batchMap.get(key)

      if (!existing) {
        const initial: SellerOrderBatch = {
          batchId: order.batchId,
          batchCode: (order as any).batchCode,
          orders: [order],
          orderCount: 1,
          buyerNames: order.buyer?.name || '',
          paymentStatus: order.paymentStatus,
          status: order.status,
          total: order.total || 0,
          orderedAt: order.orderedAt,
        }
        batchMap.set(key, initial)
      } else {
        existing.orders.push(order)
        existing.orderCount += 1
        existing.total += order.total || 0

        // Aggregate buyer names
        const names = new Set(
          existing.buyerNames
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean),
        )
        if (order.buyer?.name) {
          names.add(order.buyer.name)
        }
        existing.buyerNames = Array.from(names).join(', ')

        // Aggregate payment status
        if (existing.paymentStatus !== order.paymentStatus) {
          existing.paymentStatus = 'mixed'
        }

        // Aggregate shipment status
        if (existing.status !== order.status) {
          existing.status = 'mixed'
        }
      }
    })

    const batchOrderMap = new Map(pageBatchIdStrings.map((id, index) => [id, index]))

    const allBatches: SellerOrderBatch[] = Array.from(batchMap.values()).map((batchValue) => {
      const shipmentMap = new Map<string, SellerShipmentGroupForBatch>()

      batchValue.orders.forEach((orderForBatch) => {
        const s = (orderForBatch as any).sellerShipment as IOrderSellerShipment | undefined
        if (!s?._id) return

        const kourierBoyzLogisticsOrderId = (s.kourierBoyzLogistics as any)?.order_id?.toString?.()
        const awb = s.shippingMeta?.awb || (s.kourierBoyzLogistics as any)?.awb_number
        const shipmentKey = kourierBoyzLogisticsOrderId || awb || s._id.toString()
        const orderId = (orderForBatch as any)?._id?.toString?.()

        const existing = shipmentMap.get(shipmentKey)
        if (existing) {
          if (orderId && !existing.orderIds.includes(orderId)) {
            existing.orderIds.push(orderId)
          }
        } else {
          shipmentMap.set(shipmentKey, {
            shipmentId: s._id.toString(),
            status: s.status,
            orderIds: orderId ? [orderId] : [],
            courier: s.shippingMeta?.courier,
            awb,
            kourierBoyzLogisticsOrderId,
            shippingMeta: s.shippingMeta ? { ...s.shippingMeta } : undefined,
            invoice: s.invoice || undefined,
            triplicateInvoice: s.triplicateInvoice || undefined,
            label: s.label || undefined,
          })
        }
      })

      return {
        ...batchValue,
        shipments: Array.from(shipmentMap.values()),
      }
    }).sort((a, b) => {
      const aKey = a.batchId || a.orders[0]?._id?.toString?.() || ''
      const bKey = b.batchId || b.orders[0]?._id?.toString?.() || ''
      return (batchOrderMap.get(aKey) ?? Number.MAX_SAFE_INTEGER) - (batchOrderMap.get(bKey) ?? Number.MAX_SAFE_INTEGER)
    })

    return res.json({
      success: true,
      data: allBatches,
      pagination: {
        total: batchTotal,
        page: numericPage,
        limit: numericLimit,
        pages: Math.ceil(batchTotal / numericLimit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching seller orders:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders',
    })
  }
}

export const getSellerBatchDetail = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { batchId } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ success: false, message: 'Invalid batch id' })
    }

    const sellerObjectId = toObjectId(sellerId)
    const batchObjectId = new mongoose.Types.ObjectId(batchId)

    const orders = await Order.find({
      batchId: batchObjectId,
      'items.seller': sellerObjectId,
    })
      .populate('items.product', 'name slug mainImage sku')
      .populate(
        'items.variant',
        'name sku attributes price comparePrice costPrice weight dimensions images mainImage status isDefault stock',
      )
      .populate('user', 'name email')
      .populate('coupon', 'code type value')
      .sort({ createdAt: 1 })

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found for this seller',
      })
    }

    type SellerOrderForBatch = ReturnType<typeof toSellerResponse>
    type SellerShipmentGroupForBatch = {
      shipmentId: string
      status: SellerShipmentStatus
      orderIds: string[]
      courier?: string
      awb?: string
      kourierBoyzLogisticsOrderId?: string
      shippingMeta?: ISellerShippingMeta
      invoice?: {
        invoice_id?: string
        invoice_url?: string
        invoice_number?: string
        generated_at?: Date
        hsnSummary?: Array<{
          hsnSacCode: string
          gstRatePercent: number
          taxableValueTotal: number
          igstAmountTotal: number
          cgstAmountTotal: number
          sgstAmountTotal: number
        }>
      }
      triplicateInvoice?: {
        invoice_id?: string
        invoice_url?: string
        invoice_number?: string
        generated_at?: Date
      }
      label?: {
        label_id?: string
        label_url?: string
        generated_at?: Date
      }
    }

    const sellerOrders: SellerOrderForBatch[] = orders.map((order) =>
      toSellerResponse(order, sellerId),
    )
    const first = sellerOrders[0]

    const buyerNames = Array.from(
      new Set(
        sellerOrders.map((o) => o.buyer?.name).filter((name): name is string => Boolean(name)),
      ),
    ).join(', ')

    const paymentStatuses = Array.from(new Set(sellerOrders.map((o) => o.paymentStatus)))
    const statusLabels = Array.from(new Set(sellerOrders.map((o) => o.status)))

    // Build shipment groups consistent with `getSellerOrders` so the seller UI
    // can show one physical shipment (AWB) covering multiple orders.
    const shipmentMap = new Map<string, SellerShipmentGroupForBatch>()

    sellerOrders.forEach((orderForBatch) => {
      const s = (orderForBatch as any).sellerShipment as IOrderSellerShipment | undefined
      if (!s?._id) return

      const kourierBoyzLogisticsOrderId = (s.kourierBoyzLogistics as any)?.order_id?.toString?.()
      const awb = s.shippingMeta?.awb || (s.kourierBoyzLogistics as any)?.awb_number
      const shipmentKey = kourierBoyzLogisticsOrderId || awb || s._id.toString()
      const orderId = (orderForBatch as any)?._id?.toString?.()

      const existing = shipmentMap.get(shipmentKey)
      if (existing) {
        if (orderId && !existing.orderIds.includes(orderId)) {
          existing.orderIds.push(orderId)
        }
      } else {
        shipmentMap.set(shipmentKey, {
          shipmentId: s._id.toString(),
          status: s.status,
          orderIds: orderId ? [orderId] : [],
          courier: s.shippingMeta?.courier,
          awb,
          kourierBoyzLogisticsOrderId,
          shippingMeta: s.shippingMeta ? { ...s.shippingMeta } : undefined,
          invoice: s.invoice || undefined,
          triplicateInvoice: s.triplicateInvoice || undefined,
          label: s.label || undefined,
        })
      }
    })

    const batch = {
      batchId: first.batchId,
      batchCode: (first as any).batchCode,
      summary: {
        orderCount: sellerOrders.length,
        buyerNames,
        paymentStatus:
          paymentStatuses.length === 1
            ? paymentStatuses[0]
            : ('mixed' as IOrder['paymentStatus'] | 'mixed'),
        status:
          statusLabels.length === 1 ? statusLabels[0] : ('mixed' as SellerShipmentStatus | 'mixed'),
        total: sellerOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        orderedAt: first.orderedAt,
      },
      orders: sellerOrders,
      shipments: Array.from(shipmentMap.values()),
    }

    return res.json({
      success: true,
      data: batch,
    })
  } catch (error: any) {
    console.error('Error fetching seller batch detail:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch batch detail',
    })
  }
}

export const getSellerBatchShipments = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { batchId } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({ success: false, message: 'Invalid batch id' })
    }

    const sellerObjectId = toObjectId(sellerId)
    const batchObjectId = new mongoose.Types.ObjectId(batchId)

    // Load only the minimal fields needed for grouping shipments
    const orders = await Order.find({
      batchId: batchObjectId,
      'items.seller': sellerObjectId,
    }).select(['_id', 'sellerShipments'])

    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found for this seller',
      })
    }

    type SellerBatchShipmentGroup = {
      shipmentId: string
      status: SellerShipmentStatus
      orderIds: string[]
      courier?: string
      awb?: string
      kourierBoyzLogisticsOrderId?: string
      shippingMeta?: ISellerShippingMeta
      invoice?: {
        invoice_id?: string
        invoice_url?: string
        invoice_number?: string
        generated_at?: Date
        hsnSummary?: Array<{
          hsnSacCode: string
          gstRatePercent: number
          taxableValueTotal: number
          igstAmountTotal: number
          cgstAmountTotal: number
          sgstAmountTotal: number
        }>
      }
      triplicateInvoice?: {
        invoice_id?: string
        invoice_url?: string
        invoice_number?: string
        generated_at?: Date
      }
      label?: {
        label_id?: string
        label_url?: string
        generated_at?: Date
      }
    }

    const shipmentMap = new Map<string, SellerBatchShipmentGroup>()

    orders.forEach((orderDoc) => {
      const orderId = (orderDoc as any)._id.toString()

      // Find the seller's shipment on this order that is pickup_requested
      const sellerShipment = orderDoc.sellerShipments?.find((s: IOrderSellerShipment) => {
        const belongsToSeller =
          s?.seller?.toString?.() === sellerObjectId.toString() ||
          (s as any)?.seller?._id?.toString?.() === sellerObjectId.toString()
        return belongsToSeller && s.status === 'pickup_requested'
      })

      if (!sellerShipment?._id) return

      const kourierBoyzLogisticsOrderId = (sellerShipment.kourierBoyzLogistics as any)?.order_id?.toString?.()
      const awb =
        sellerShipment.shippingMeta?.awb || (sellerShipment.kourierBoyzLogistics as any)?.awb_number
      const shipmentKey =
        kourierBoyzLogisticsOrderId || awb || (sellerShipment._id as any)?.toString?.() || orderId

      const existing = shipmentMap.get(shipmentKey)
      if (existing) {
        if (!existing.orderIds.includes(orderId)) {
          existing.orderIds.push(orderId)
        }
      } else {
        shipmentMap.set(shipmentKey, {
          shipmentId: (sellerShipment._id as any)?.toString?.() || shipmentKey,
          status: sellerShipment.status,
          orderIds: [orderId],
          courier: sellerShipment.shippingMeta?.courier,
          awb,
          kourierBoyzLogisticsOrderId,
          // Clone the nested subdocument so dimensions/pickup_address are fully serialized
          shippingMeta: sellerShipment.shippingMeta
            ? cloneDoc(sellerShipment.shippingMeta)
            : undefined,
          invoice: sellerShipment.invoice || undefined,
          triplicateInvoice: sellerShipment.triplicateInvoice || undefined,
          label: sellerShipment.label || undefined,
        })
      }
    })

    return res.json({
      success: true,
      data: Array.from(shipmentMap.values()),
    })
  } catch (error: any) {
    console.error('Error fetching seller batch shipments:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch batch shipments',
    })
  }
}

export const getSellerOrderDetail = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const order = await Order.findOne({
      _id: id,
      'items.seller': sellerId,
    }).populate([
      {
        path: 'items.product',
        model: 'Product',
        select: 'name slug mainImage sku weight shippingDimensions',
      },
      {
        path: 'items.variant',
        model: 'ProductVariant',
        select:
          'name sku attributes price comparePrice costPrice weight dimensions images mainImage status isDefault stock',
      },
      {
        path: 'sellerShipments.seller',
        model: 'User',
        select: 'name businessName storeSlug supportEmail storePhone',
      },
      {
        path: 'user',
        model: 'User',
        select: 'name email',
      },
    ])

    const { order: ownedOrder } = ensureSellerAccess(order, sellerId)
    return res.json({
      success: true,
      data: toSellerResponse(ownedOrder, sellerId),
    })
  } catch (error: any) {
    const status = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    return res.status(status).json({
      success: false,
      message:
        error.message === 'ORDER_NOT_FOUND'
          ? 'Order not found'
          : error.message || 'Failed to fetch order',
    })
  }
}

export const updateSellerOrderStatus = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const { status } = req.body as { status: SellerShipmentStatus }

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!status || !SELLER_STATUS_SET.has(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided',
      })
    }

    const order = await Order.findOne({
      _id: id,
      'items.seller': sellerId,
    })

    const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)
    const previousStatus = sellerShipment.status
    updateShipmentStatus(ownedOrder, sellerShipment, status)
    recalcOrderStatus(ownedOrder)

    await ownedOrder.save()

    // Send notifications if status changed to 'shipped'
    if (status === 'shipped' && previousStatus !== 'shipped') {
      void notifyOrderShipped(ownedOrder, sellerShipment)
    }

    // Update SLA tracking after status change
    try {
      const { updateSLATrackingForOrder } = await import('../utils/slaTrackingHooks')
      await updateSLATrackingForOrder(ownedOrder._id as mongoose.Types.ObjectId)
    } catch (error) {
      console.error('[SLA Tracking] Failed to update SLA tracking:', error)
    }

    // Create customer notification for status changes
    try {
      const Notification = (await import('../models/Notification')).default
      const userId =
        typeof ownedOrder.user === 'string'
          ? ownedOrder.user
          : (ownedOrder.user as any)?._id?.toString?.()
          ? (ownedOrder.user as any)._id.toString()
          : undefined

      if (userId && status !== previousStatus) {
        const orderId = (ownedOrder as any)._id?.toString?.() || String(ownedOrder._id)
        // Only notify for significant status changes
        if (status === 'pickup_requested' && ownedOrder.status === 'ready_to_ship') {
          await Notification.create({
            userId,
            title: 'Order Ready for Pickup',
            message: `Your order ${ownedOrder.orderNumber} is ready for pickup and will be shipped soon.`,
            type: 'order',
            read: false,
            link: `/profile/orders?orderId=${orderId}`,
          })
        } else if (status === 'processing' && ownedOrder.status === 'processing') {
          await Notification.create({
            userId,
            title: 'Order Confirmed',
            message: `Your order ${ownedOrder.orderNumber} has been confirmed and is being processed.`,
            type: 'order',
            read: false,
            link: `/profile/orders?orderId=${orderId}`,
          })
        }
      }
    } catch (error) {
      console.error('[Notification] Failed to create customer notification:', error)
    }

    return res.json({
      success: true,
      data: toSellerResponse(ownedOrder, sellerId),
    })
  } catch (error: any) {
    const statusCode =
      error.message === 'ORDER_NOT_FOUND' || error.message === 'SELLER_SHIPMENT_NOT_FOUND'
        ? 404
        : error.message === 'INVALID_STATUS_TRANSITION'
        ? 400
        : 500
    return res.status(statusCode).json({
      success: false,
      message:
        error.message === 'INVALID_STATUS_TRANSITION'
          ? 'Status transition not allowed'
          : error.message || 'Failed to update order status',
    })
  }
}

export const bulkUpdateSellerOrderStatus = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { status, orderIds, batchId } = req.body as {
      status: SellerShipmentStatus
      orderIds?: string[]
      batchId?: string
    }

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!status || !SELLER_STATUS_SET.has(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided',
      })
    }

    if ((!orderIds || orderIds.length === 0) && !batchId) {
      return res.status(400).json({
        success: false,
        message: 'Provide orderIds or batchId for bulk status update',
      })
    }

    const sellerObjectId = toObjectId(sellerId)
    const query: any = {
      'items.seller': sellerObjectId,
    }

    if (orderIds && orderIds.length > 0) {
      query._id = { $in: orderIds.map((id) => new mongoose.Types.ObjectId(id)) }
    } else if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ success: false, message: 'Invalid batch id' })
      }
      query.batchId = new mongoose.Types.ObjectId(batchId)
    }

    const orders = await Order.find(query)
    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: 'No matching orders found for bulk update',
      })
    }

    const updatedOrders: any[] = []
    for (const order of orders) {
      const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)
      updateShipmentStatus(ownedOrder, sellerShipment, status)
      recalcOrderStatus(ownedOrder)
      // eslint-disable-next-line no-await-in-loop
      await ownedOrder.save()
      updatedOrders.push(toSellerResponse(ownedOrder, sellerId))
    }

    return res.json({
      success: true,
      data: updatedOrders,
    })
  } catch (error: any) {
    const statusCode =
      error.message === 'ORDER_NOT_FOUND' || error.message === 'SELLER_SHIPMENT_NOT_FOUND'
        ? 404
        : error.message === 'INVALID_STATUS_TRANSITION'
        ? 400
        : 500
    return res.status(statusCode).json({
      success: false,
      message:
        error.message === 'INVALID_STATUS_TRANSITION'
          ? 'Status transition not allowed'
          : error.message || 'Failed to update orders status',
    })
  }
}

export const getSellerShipmentRates = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const { weight, dimensions } = req.body as {
      weight: number
      dimensions?: { length: number; width: number; height: number }
    }

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!weight || weight <= 0) {
      return res.status(400).json({ success: false, message: 'Package weight is required' })
    }

    const order = await Order.findOne({
      _id: id,
      'items.seller': sellerId,
    }).populate('items.product', 'name sku shippingWeight shippingDimensions')

    const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)
    const seller = await fetchSeller(sellerId)

    const { payload, pickupAddress } = buildRateRequest(ownedOrder, sellerShipment, seller, {
      weight,
      dimensions,
    })

    const rates = await shippingProviderService.getRates(payload)
    console.log('rates', rates)
    const pickupAddressSnapshot = pickupAddress ? JSON.parse(JSON.stringify(pickupAddress)) : null

    return res.json({
      success: true,
      data: {
        rates: rates?.data?.rates || (Array.isArray(rates.data) ? rates.data : []),
        pickupAddress: pickupAddressSnapshot,
      },
    })
  } catch (error: any) {
    const statusCode = error.message?.includes('NOT_AUTHENTICATED')
      ? 401
      : error.message === 'ORDER_NOT_FOUND'
      ? 404
      : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch rates',
    })
  }
}

export const createSellerShipment = async (req: Request, res: Response) => {
  let courierLogContext: Record<string, unknown> | null = null
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const {
      shipments: rawShipments,
      package: legacyPackageInput,
      courierId: legacyCourierId,
      providerCode: legacyProviderCode,
      pickupAddressId,
      pickupDate,
      pickupTime,
      estimatedCharge: legacyEstimatedCharge,
      itemIds: legacyItemIds,
    } = req.body as {
      shipments?: Array<{
        package: {
          weight: number
          length: number
          width: number
          height: number
        }
        courierId: number
        providerCode?: string
        estimatedCharge?: number
        itemIds: string[]
        fragile?: boolean
      }>
      // legacy single-shipment shape (for backward compatibility)
      package?: {
        weight: number
        length: number
        width: number
        height: number
      }
      courierId?: number
      providerCode?: string
      pickupAddressId?: string
      pickupDate?: string
      pickupTime?: string
      estimatedCharge?: number
      itemIds?: string[]
    }

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const shipmentInputs =
      rawShipments && rawShipments.length
        ? rawShipments
        : legacyCourierId && legacyPackageInput
        ? [
            {
              package: legacyPackageInput,
              courierId: legacyCourierId,
              providerCode: legacyProviderCode,
              estimatedCharge: legacyEstimatedCharge,
              itemIds: legacyItemIds || [],
              fragile: undefined, // Legacy doesn't support fragile
            },
          ]
        : []

    console.log('[requestPickup] Received shipment inputs:', {
      count: shipmentInputs.length,
      inputs: shipmentInputs.map((input) => ({
        itemIds: input.itemIds?.length || 0,
        fragile: input.fragile,
        fragileType: typeof input.fragile,
      })),
    })

    if (!shipmentInputs.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one shipment with package and courier is required',
      })
    }

    // For createSellerShipment we currently support only a single physical shipment.
    // Use the first shipment definition from the payload (or legacy fields).
    const {
      package: packageInput,
      courierId,
      providerCode,
      estimatedCharge,
      itemIds: bodyItemIds,
    } = shipmentInputs[0]

    const order = await Order.findOne({
      _id: id,
      'items.seller': sellerId,
    })
      .populate(
        'items.product',
        'name sku weight shippingDimensions tags specifications description',
      )
      .populate(
        'items.variant',
        'name sku attributes price comparePrice costPrice weight dimensions images mainImage status isDefault stock',
      )
      .populate('user', 'name email phone')

    const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)

    if (ownedOrder.paymentStatus !== 'paid' && ownedOrder.paymentMethod !== 'cod') {
      return res.status(400).json({
        success: false,
        message: 'Order must be paid before shipping',
      })
    }

    if (
      !sellerShipment.inventoryPacked ||
      !['ready_to_ship', 'pickup_requested'].includes(sellerShipment.status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Request pickup before creating shipment. Order must be in "Pickup Requested" status.',
      })
    }

    if (sellerShipment.kourierBoyzLogistics?.order_id) {
      return res.json({
        success: true,
        message: 'Shipment was already created earlier and has been reused',
        data: toSellerResponse(ownedOrder, sellerId),
      })
    }

    const seller = await fetchSeller(sellerId)
    const pickupAddress = pickSellerAddress(seller, pickupAddressId)
    if (!pickupAddress) {
      return res.status(400).json({
        success: false,
        message: 'Add a pickup address in store settings',
      })
    }

    const sellerItems = filterSellerItems(ownedOrder.items, sellerId)
    const sellerItemIds = sellerItems
      .map((orderItem) => (orderItem as any)?._id as mongoose.Types.ObjectId | undefined)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id))
    if (sellerItemIds.length > 0) {
      sellerShipment.itemIds = sellerItemIds
    }
    const sellerTotals = computeSellerTotals(sellerItems)
    const consigneeEmail = (ownedOrder.user as any)?.email

    const shipmentPayload: ShippingCreateShipmentRequest = {
      order_number: buildForwardShipmentOrderNumber({
        orderNumber: ownedOrder.orderNumber,
        orderId: ownedOrder._id?.toString(),
        shipmentId: sellerShipment._id?.toString(),
      }),
      payment_type: ownedOrder.paymentMethod === 'cod' ? 'cod' : 'prepaid',
      order_amount: sellerTotals.itemSubtotal,
      package_weight: packageInput.weight,
      package_length: packageInput.length,
      package_breadth: packageInput.width,
      package_height: packageInput.height,
      courier_id: courierId,
      provider_code: providerCode,
      consignee: {
        name: ownedOrder.shippingAddress?.name || 'Customer',
        company_name: ownedOrder.shippingAddress?.name,
        address: ownedOrder.shippingAddress?.addressLine1,
        address_2: ownedOrder.shippingAddress?.addressLine2,
        city: ownedOrder.shippingAddress?.city,
        state: ownedOrder.shippingAddress?.state,
        pincode: ownedOrder.shippingAddress?.postalCode,
        phone: ownedOrder.shippingAddress?.phone,
        email: consigneeEmail,
      },
      pickup: {
        warehouse_name: pickupAddress.warehouseName,
        name: pickupAddress.contactName || pickupAddress.warehouseName || seller.name,
        address: pickupAddress.addressLine1,
        address_2: pickupAddress.addressLine2,
        city: pickupAddress.city,
        state: pickupAddress.state,
        pincode: pickupAddress.postalCode,
        phone: pickupAddress.contactPhone || seller.storePhone || seller.phone || '',
        gst_number: seller.gstNumber,
        pickup_date: pickupDate,
        pickup_time: pickupTime,
      },
      order_items: sellerItems.map((orderItem) => ({
        name: (orderItem.product as any)?.name || 'Product',
        sku: (orderItem.variant as any)?.sku || (orderItem.product as any)?.sku,
        qty: orderItem.quantity,
        price: orderItem.price,
      })),
      invoice_number: ownedOrder.orderNumber,
      invoice_date: ownedOrder.createdAt?.toISOString?.().slice(0, 10),
      invoice_amount: sellerTotals.itemSubtotal,
      shipping_charges: ownedOrder.shipping,
      discount: ownedOrder.discount,
      gift_wrap: ownedOrder.giftWrap ? 1 : 0,
      cod_charges:
        ownedOrder.paymentMethod === 'cod'
          ? Math.round(sellerTotals.itemSubtotal * 0.02)
          : undefined,
      request_auto_pickup: 'yes',
      company: {
        name: seller.businessName || seller.name,
        gst: seller.gstNumber,
      },
      warehouse_id: pickupAddress.kourierBoyzLogisticsPickupAddressId || undefined,
    }

    courierLogContext = {
      orderId: ownedOrder._id?.toString(),
      sellerShipmentId: sellerShipment._id?.toString(),
      courierId,
      orderNumber: shipmentPayload.order_number,
      paymentType: shipmentPayload.payment_type,
      orderAmount: shipmentPayload.order_amount,
      package: {
        weight: shipmentPayload.package_weight,
        length: shipmentPayload.package_length,
        breadth: shipmentPayload.package_breadth,
        height: shipmentPayload.package_height,
      },
      pickupPincode: shipmentPayload.pickup?.pincode,
      destinationPincode: shipmentPayload.consignee?.pincode,
    }

    // Detect retry-after-partial-success: if sellerShipment already has
    // Existing provider data persisted for this exact order_number should be reused
    // so retries do not recreate the shipment.
    let shipmentResponse: Awaited<ReturnType<typeof shippingProviderService.createShipment>>
    if (
      sellerShipment.kourierBoyzLogistics?.order_number === shipmentPayload.order_number &&
      sellerShipment.kourierBoyzLogistics?.order_id &&
      sellerShipment.kourierBoyzLogistics?.awb_number
    ) {
      console.info('[Shipmozo] Reusing existing shipment from previous attempt', {
        ...courierLogContext,
        kourierBoyzLogisticsOrderId: sellerShipment.kourierBoyzLogistics.order_id,
        awb: sellerShipment.kourierBoyzLogistics.awb_number,
      })
      shipmentResponse = {
        success: true,
        data: {
          order_id: sellerShipment.kourierBoyzLogistics.order_id,
          order_number: sellerShipment.kourierBoyzLogistics.order_number || shipmentPayload.order_number,
          awb_number: sellerShipment.kourierBoyzLogistics.awb_number,
          status: 'booked',
          label: sellerShipment.kourierBoyzLogistics.label_url,
          courier_partner: sellerShipment.shippingMeta?.courier,
          tracking_link: sellerShipment.kourierBoyzLogistics.tracking_link,
          createManifest: true,
        },
      }
    } else {
      console.info('[Shipmozo] createShipment request', courierLogContext)
      shipmentResponse = await shippingProviderService.createShipment(shipmentPayload)
    }

    const shipmentData = shipmentResponse.data

    console.info('[Shipmozo] createShipment response', {
      ...courierLogContext,
      kourierBoyzLogisticsOrderId: shipmentData?.order_id,
      awb: shipmentData?.awb_number,
      success: shipmentResponse.success,
    })

    sellerShipment.package = {
      weight: packageInput.weight,
      dimensions: {
        length: packageInput.length,
        width: packageInput.width,
        height: packageInput.height,
      },
    }

    sellerShipment.kourierBoyzLogistics = {
      courier_id: courierId,
      order_id: shipmentData?.order_id,
      order_number: shipmentData?.order_number,
      rate: estimatedCharge,
      awb_number: shipmentData?.awb_number,
      label_url: shipmentData?.label,
      tracking_link: shipmentData?.tracking_link,
      estimated_delivery_date: undefined,
    }

    // Build shippingMeta directly from payload + courier response so that it
    // always reflects the actual shipment request made from the frontend.
    sellerShipment.shippingMeta = {
      awb: shipmentData?.awb_number,
      courier: shipmentData?.courier_partner || String(courierId),
      label: shipmentData?.label,
      tracking_link: shipmentData?.tracking_link,
      weight: packageInput.weight,
      dimensions: {
        length: packageInput.length,
        width: packageInput.width,
        height: packageInput.height,
      },
      pickup_address: {
        warehouseName: pickupAddress?.warehouseName,
        addressLine1: pickupAddress?.addressLine1,
        addressLine2: pickupAddress?.addressLine2,
        city: pickupAddress?.city,
        state: pickupAddress?.state,
        postalCode: pickupAddress?.postalCode,
        country: pickupAddress?.country,
        contactName: pickupAddress?.contactName,
        contactPhone: pickupAddress?.contactPhone,
      },
      charges: estimatedCharge,
    }

    // Store AWB-wise charges
    sellerShipment.courierCharge = estimatedCharge || null
    // Calculate COD charge for this specific shipment if payment method is COD
    sellerShipment.codCharge =
      ownedOrder.paymentMethod === 'cod' ? Math.round(sellerTotals.itemSubtotal * 0.02) : null

    // Persist provider identifiers immediately so retries do not create duplicates
    // if later label generation or post-processing fails.
    ownedOrder.markModified('sellerShipments')
    await ownedOrder.save()

    // Generate label if not already generated
    if (!sellerShipment.label?.label_url) {
      try {
        const populatedOrder = await Order.findById(ownedOrder._id)
          .populate('items.product', 'name slug')
          .populate('items.variant', 'name sku')
          .populate('user', 'name email phone')
          .populate('sellerShipments.seller', 'name businessName gstNumber')

        if (populatedOrder) {
          const sellerItems = filterSellerItems(populatedOrder.items, sellerId)
          const customer = populatedOrder.user as any
          const seller = await fetchSeller(sellerId)

          const labelData = {
            order: populatedOrder,
            shipment: sellerShipment,
            customer: customer,
            seller: seller,
            items: sellerItems.map((item) => ({
              product: item.product,
              variant: item.variant,
              quantity: item.quantity,
            })),
          }

          const labelBuffer = await generateLabel(labelData)
          const labelFileName = `labels/${ownedOrder._id}-${sellerShipment._id}-${Date.now()}.pdf`
          const labelUrl = await uploadToR2(labelBuffer, labelFileName, 'application/pdf', 'labels')
          const labelPayload = {
            label_url: labelUrl,
            generated_at: new Date(),
          }
          sellerShipment.label = labelPayload
          ownedOrder.label = labelPayload
        }
      } catch (labelError) {
        console.error('Error generating label for shipment:', sellerShipment._id, labelError)
        // Don't fail shipment creation if label generation fails
      }
    }

    updateShipmentStatus(ownedOrder, sellerShipment, 'shipped')
    recalcOrderStatus(ownedOrder)
    ownedOrder.markModified('sellerShipments')

    await ownedOrder.save()

    // Send notifications when order is shipped
    void notifyOrderShipped(ownedOrder, sellerShipment)

    return res.json({
      success: true,
      data: toSellerResponse(ownedOrder, sellerId),
    })
  } catch (error: any) {
    console.error('Error creating seller shipment:', error)
    if (error) {
      console.error('[Shipmozo] createShipment failed', {
        ...(courierLogContext || {}),
        error: error.response?.data || error.message || error,
      })
    }
    const statusCode =
      error.message === 'ORDER_NOT_FOUND' || error.message === 'SELLER_SHIPMENT_NOT_FOUND'
        ? 404
        : error.message === 'INVALID_STATUS_TRANSITION'
        ? 400
        : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create shipment',
    })
  }
}

export const requestPickup = async (req: Request, res: Response) => {
  let courierLogContext: Record<string, unknown> | null = null
  try {
    const sellerId = req.user?.userId
    const { id } = req.params
    const {
      shipments: rawShipments,
      package: legacyPackageInput,
      courierId: legacyCourierId,
      providerCode: legacyProviderCode,
      pickupAddressId,
      pickupDate,
      pickupTime,
      estimatedCharge: legacyEstimatedCharge,
      itemIds: legacyItemIds,
    } = req.body as {
      shipments?: Array<{
        package: {
          weight: number
          length: number
          width: number
          height: number
        }
        courierId: number
        providerCode?: string
        estimatedCharge?: number
        itemIds: string[]
        fragile?: boolean
      }>
      // legacy single-shipment shape (for backward compatibility)
      package?: {
        weight: number
        length: number
        width: number
        height: number
      }
      courierId?: number
      providerCode?: string
      pickupAddressId?: string
      pickupDate?: string
      pickupTime?: string
      estimatedCharge?: number
      itemIds?: string[]
    }

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const shipmentInputs =
      rawShipments && rawShipments.length
        ? rawShipments
        : legacyCourierId && legacyPackageInput
        ? [
            {
              package: legacyPackageInput,
              courierId: legacyCourierId,
              providerCode: legacyProviderCode,
              estimatedCharge: legacyEstimatedCharge,
              itemIds: legacyItemIds || [],
              fragile: undefined, // Legacy doesn't support fragile
            },
          ]
        : []

    console.log('[requestPickup] Received shipment inputs:', {
      count: shipmentInputs.length,
      inputs: shipmentInputs.map((input) => ({
        itemIds: input.itemIds?.length || 0,
        fragile: input.fragile,
        fragileType: typeof input.fragile,
      })),
    })

    if (!shipmentInputs.length) {
      return res.status(400).json({
        success: false,
        message: 'At least one shipment with package and courier is required',
      })
    }

    const order = await Order.findOne({
      _id: id,
      'items.seller': sellerId,
    })
      .populate(
        'items.product',
        'name sku weight shippingDimensions tags specifications description',
      )
      .populate(
        'items.variant',
        'name sku attributes price comparePrice costPrice weight dimensions images mainImage status isDefault stock',
      )
      .populate('user', 'name email phone')

    const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)

    // Allow pickup requests when shipment is in processing or already pickup_requested.
    // This is important for multi-shipment scenarios where multiple pickup calls are
    // made for different item groups on the same order.
    // Also allow if shipment already has kourierBoyzLogistics data (already processed but may need labels/invoices)
    if (
      !['processing', 'pickup_requested'].includes(sellerShipment.status) &&
      !sellerShipment.kourierBoyzLogistics?.order_id
    ) {
      return res.status(400).json({
        success: false,
        message: 'Order must be in processing or pickup_requested status to request pickup',
      })
    }

    const seller = await fetchSeller(sellerId)
    const pickupAddress = pickSellerAddress(seller, pickupAddressId)
    if (!pickupAddress) {
      return res.status(400).json({
        success: false,
        message: 'Add a pickup address in store settings',
      })
    }

    // Build a group of orders to include in this shipment:
    // - same seller
    // - same batch
    // - same shipping address
    // - sellerShipment.status === 'processing'
    const groupOrders: HydratedDocument<IOrder>[] = [ownedOrder]
    const groupShipments: IOrderSellerShipment[] = [sellerShipment]

    if (ownedOrder.batchId) {
      const sameBatchOrders = await Order.find({
        batchId: ownedOrder.batchId,
        _id: { $ne: ownedOrder._id },
        'items.seller': sellerId,
      })
        .populate(
          'items.product',
          'name sku weight shippingDimensions tags specifications description',
        )
        .populate(
          'items.variant',
          'name sku attributes price comparePrice costPrice weight dimensions images mainImage status isDefault stock',
        )
        .populate('user', 'name email phone')

      for (const batchOrder of sameBatchOrders) {
        const shipmentForSeller = batchOrder.sellerShipments.find(
          (s) => s?.seller?._id?.toString() === sellerId,
        )
        if (!shipmentForSeller || shipmentForSeller.status !== 'processing') continue
        if (!isSameShippingAddress(batchOrder.shippingAddress, ownedOrder.shippingAddress)) continue
        groupOrders.push(batchOrder as HydratedDocument<IOrder>)
        groupShipments.push(shipmentForSeller)
      }
    }

    // Collect all seller items across grouped orders and build a map from
    // order item _id -> index of groupOrder so we can later determine which
    // orders belong to which physical shipment based on payload.itemIds.
    const allSellerItems: any[] = []
    const orderItemToOrderIndex = new Map<string, number>()

    groupOrders.forEach((o, orderIndex) => {
      const sellerItemsForOrder = filterSellerItems(o.items || [], sellerId)
      sellerItemsForOrder.forEach((orderItem: any) => {
        const oid = orderItem?._id?.toString()
        if (oid) {
          allSellerItems.push(orderItem)
          orderItemToOrderIndex.set(oid, orderIndex)
        }
      })
    })

    if (allSellerItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No items found for this seller to request pickup',
      })
    }

    // Save itemIds per shipment (for each order)
    groupOrders.forEach((groupOrder, index) => {
      const itemsForOrder = filterSellerItems(groupOrder.items || [], sellerId)
      const itemIds = itemsForOrder
        .map((orderItem) => (orderItem as any)?._id as mongoose.Types.ObjectId | undefined)
        .filter((oid): oid is mongoose.Types.ObjectId => Boolean(oid))
      if (itemIds.length > 0) {
        groupShipments[index].itemIds = itemIds
      }
    })

    const consigneeEmail = (ownedOrder.user as any)?.email

    // Step 1: For each shipment input, create a provider shipment and update grouped orders.
    // This keeps a single API call from the frontend while still creating
    // multiple physical shipments (e.g. per warehouse).
    let manifestData: ShippingManifestRequest['order_numbers'] | null = null
    const createdShipments: {
      payload: ShippingCreateShipmentRequest
      response: Awaited<ReturnType<typeof shippingProviderService.createShipment>>
    }[] = []

    // Track which orders were actually updated in any shipment
    // Only these orders should get labels/invoices and status updates
    const updatedOrderIndexes = new Set<number>()

    // Track fragile flags by kourierBoyzLogistics order_id for label generation
    const fragileFlagsByKourierBoyzLogisticsOrderId = new Map<string, boolean>()

    for (const shipmentInput of shipmentInputs) {
      const {
        package: packageInput,
        courierId,
        providerCode,
        estimatedCharge,
        itemIds,
        fragile: fragileFromInput,
      } = shipmentInput

      console.log('[requestPickup] Processing shipment input:', {
        itemIds: itemIds?.length || 0,
        fragile: fragileFromInput,
        fragileType: typeof fragileFromInput,
      })

      if (
        !packageInput?.weight ||
        !packageInput?.length ||
        !packageInput?.width ||
        !packageInput?.height ||
        !courierId
      ) {
        throw new Error('Package details and courier are required for each shipment')
      }

      // If specific itemIds were provided, restrict the shipment to those items only
      let sellerItemsForShipment = allSellerItems
      const orderIndexesForShipment = new Set<number>()

      if (itemIds && itemIds.length > 0) {
        const idSet = new Set(itemIds.map((id) => id.toString()))
        sellerItemsForShipment = allSellerItems.filter((orderItem) => {
          const oid = (orderItem as any)?._id?.toString()
          if (oid && idSet.has(oid)) {
            const orderIndex = orderItemToOrderIndex.get(oid)
            if (orderIndex !== undefined) {
              orderIndexesForShipment.add(orderIndex)
            }
            return true
          }
          return false
        })

        if (!sellerItemsForShipment.length) {
          throw new Error('No items found for the selected shipment group')
        }
      }

      const sellerTotals = computeSellerTotals(sellerItemsForShipment)

      const compactOrderNumber = buildForwardShipmentOrderNumber({
        orderNumber: ownedOrder.orderNumber,
        orderId: ownedOrder._id?.toString(),
        shipmentId: sellerShipment._id?.toString(),
        itemIds: itemIds?.map((id: string) => id.toString()).sort(),
      })

      const shipmentPayload: ShippingCreateShipmentRequest = {
        order_number: compactOrderNumber,
        payment_type: ownedOrder.paymentMethod === 'cod' ? 'cod' : 'prepaid',
        order_amount: sellerTotals.itemSubtotal,
        package_weight: packageInput.weight,
        package_length: packageInput.length,
        package_breadth: packageInput.width,
        package_height: packageInput.height,
        courier_id: courierId,
        provider_code: providerCode,
        consignee: {
          name: ownedOrder.shippingAddress?.name || 'Customer',
          company_name: ownedOrder.shippingAddress?.name,
          address: ownedOrder.shippingAddress?.addressLine1,
          address_2: ownedOrder.shippingAddress?.addressLine2,
          city: ownedOrder.shippingAddress?.city,
          state: ownedOrder.shippingAddress?.state,
          pincode: ownedOrder.shippingAddress?.postalCode,
          phone: ownedOrder.shippingAddress?.phone,
          email: consigneeEmail,
        },
        pickup: {
          warehouse_name: pickupAddress.warehouseName,
          name: pickupAddress.contactName || pickupAddress.warehouseName || seller.name,
          address: pickupAddress.addressLine1,
          address_2: pickupAddress.addressLine2,
          city: pickupAddress.city,
          state: pickupAddress.state,
          pincode: pickupAddress.postalCode,
          phone: pickupAddress.contactPhone || seller.storePhone || seller.phone || '',
          gst_number: seller.gstNumber,
          pickup_date: pickupDate,
          pickup_time: pickupTime,
        },
        order_items: sellerItemsForShipment.map((orderItem) => ({
          name: (orderItem.product as any)?.name || 'Product',
          sku: (orderItem.variant as any)?.sku || (orderItem.product as any)?.sku,
          qty: orderItem.quantity,
          price: orderItem.price,
        })),
        invoice_number: ownedOrder.orderNumber,
        invoice_date: ownedOrder.createdAt?.toISOString?.().slice(0, 10),
        invoice_amount: sellerTotals.itemSubtotal,
        shipping_charges: groupOrders.reduce((sum, o) => sum + (o.shipping || 0), 0),
        discount: groupOrders.reduce((sum, o) => sum + (o.discount || 0), 0),
        gift_wrap: groupOrders.some((o) => o.giftWrap) ? 1 : 0,
        cod_charges:
          ownedOrder.paymentMethod === 'cod'
            ? Math.round(sellerTotals.itemSubtotal * 0.02)
            : undefined,
        request_auto_pickup: 'yes',
        company: {
          name: seller.businessName || seller.name,
          gst: seller.gstNumber,
        },
        warehouse_id: pickupAddress.kourierBoyzLogisticsPickupAddressId || undefined,
      }

      courierLogContext = {
        orderId: ownedOrder._id?.toString(),
        sellerShipmentId: sellerShipment._id?.toString(),
        courierId,
        orderNumber: shipmentPayload.order_number,
      }

      // Detect retry-after-partial-success: if any groupShipment already has
      // Existing provider data persisted for this exact order_number should be reused
      // so retries do not recreate the shipment.
      const existingShipment = groupShipments.find(
        (gs) =>
          gs.kourierBoyzLogistics?.order_number === compactOrderNumber &&
          gs.kourierBoyzLogistics?.order_id &&
          gs.kourierBoyzLogistics?.awb_number,
      )

      let shipmentResponse: Awaited<ReturnType<typeof shippingProviderService.createShipment>>
      if (existingShipment?.kourierBoyzLogistics) {
        console.info('[Shipmozo] Reusing existing shipment from previous attempt', {
          ...courierLogContext,
          kourierBoyzLogisticsOrderId: existingShipment.kourierBoyzLogistics.order_id,
          awb: existingShipment.kourierBoyzLogistics.awb_number,
        })
        shipmentResponse = {
          success: true,
          data: {
            order_id: existingShipment.kourierBoyzLogistics.order_id!,
            order_number: existingShipment.kourierBoyzLogistics.order_number || compactOrderNumber,
            awb_number: existingShipment.kourierBoyzLogistics.awb_number!,
            status: 'booked',
            label: existingShipment.kourierBoyzLogistics.label_url,
            courier_partner: existingShipment.shippingMeta?.courier,
            tracking_link: existingShipment.kourierBoyzLogistics.tracking_link,
            createManifest: true,
          },
        }
      } else {
        console.info('[Shipmozo] createShipment request', courierLogContext)
        shipmentResponse = await shippingProviderService.createShipment(shipmentPayload)
      }

      const shipmentData = shipmentResponse.data

      if (!shipmentData?.order_id || !shipmentData?.awb_number) {
        throw new Error('Failed to create shipment: Missing order_id or AWB')
      }

      console.info('[Shipmozo] createShipment response', {
        ...courierLogContext,
        kourierBoyzLogisticsOrderId: shipmentData.order_id,
        awb: shipmentData.awb_number,
        shipmentData,
      })

      createdShipments.push({ payload: shipmentPayload, response: shipmentResponse })

      // For now, attach manifest info only from the first shipment that requests it.
      if (shipmentData.createManifest === true) {
        if (!manifestData) {
          manifestData = []
        }
        manifestData.push(shipmentPayload.order_number)
      }

      // Collect order IDs and item IDs for this physical shipment
      const shipmentOrderIds: mongoose.Types.ObjectId[] = []
      const shipmentItemIds: mongoose.Types.ObjectId[] = []

      // Calculate charge allocation for multi-order shipments
      // When multiple orders share one shipment (one AWB), allocate courier charge proportionally
      const ordersInShipment: Array<{ index: number; order: any; shipment: any; value: number }> =
        []
      groupShipments.forEach((groupShipment, index) => {
        // Check if this order has items in this shipment
        const groupOrder = groupOrders[index]
        const itemsForThisOrder = filterSellerItems(groupOrder.items || [], sellerId)

        // Check if this order should be included (based on itemIds filter if provided)
        let shouldInclude = false
        if (itemIds && itemIds.length > 0) {
          const matchingIds = itemsForThisOrder
            .map((orderItem) => (orderItem as any)?._id as mongoose.Types.ObjectId | undefined)
            .filter((oid): oid is mongoose.Types.ObjectId => Boolean(oid))
            .filter((oid) => itemIds.includes(oid.toString()))
          shouldInclude = matchingIds.length > 0
        } else {
          shouldInclude = orderIndexesForShipment.size === 0 || orderIndexesForShipment.has(index)
        }

        if (shouldInclude) {
          const totals = computeSellerTotals(itemsForThisOrder)
          ordersInShipment.push({
            index,
            order: groupOrder,
            shipment: groupShipment,
            value: totals.itemSubtotal, // Use subtotal for proportional allocation
          })
        }
      })

      // Calculate proportional allocation of courier charge
      const totalShipmentValue = ordersInShipment.reduce((sum, o) => sum + o.value, 0)
      const chargeAllocations = new Map<number, number>() // index -> allocated charge

      if (totalShipmentValue > 0 && estimatedCharge) {
        ordersInShipment.forEach(({ index, value }) => {
          // Allocate proportionally based on order value
          const allocatedCharge = Math.round((value / totalShipmentValue) * estimatedCharge)
          chargeAllocations.set(index, allocatedCharge)
        })

        // Handle rounding errors: ensure total equals estimatedCharge
        const allocatedTotal = Array.from(chargeAllocations.values()).reduce(
          (sum, charge) => sum + charge,
          0,
        )
        const roundingDiff = estimatedCharge - allocatedTotal
        if (roundingDiff !== 0 && ordersInShipment.length > 0) {
          // Add rounding difference to the largest order
          const largestOrder = ordersInShipment.reduce((max, o) => (o.value > max.value ? o : max))
          const currentAllocation = chargeAllocations.get(largestOrder.index) || 0
          chargeAllocations.set(largestOrder.index, currentAllocation + roundingDiff)
        }
      } else if (ordersInShipment.length > 0 && estimatedCharge) {
        // If no value-based allocation possible, split equally
        const equalShare = Math.round(estimatedCharge / ordersInShipment.length)
        const remainder = estimatedCharge - equalShare * ordersInShipment.length
        ordersInShipment.forEach(({ index }, i) => {
          // Add remainder to first order
          chargeAllocations.set(index, equalShare + (i === 0 ? remainder : 0))
        })
      }

      // Update shipments with provider data only for the orders that have
      // items in this shipment (based on itemIds mapping).
      // CRITICAL: Only update orders that actually have items in this specific shipment.
      // If itemIds are provided, we MUST only update orders that contain those items.
      groupShipments.forEach((groupShipment, index) => {
        // If itemIds were provided, only update orders that have items in this shipment
        if (itemIds && itemIds.length > 0) {
          // Check if this order has any items in the current shipment
          const itemsForThisOrder = filterSellerItems(groupOrders[index].items || [], sellerId)
          const matchingIds = itemsForThisOrder
            .map((orderItem) => (orderItem as any)?._id as mongoose.Types.ObjectId | undefined)
            .filter((oid): oid is mongoose.Types.ObjectId => Boolean(oid))
            .filter((oid) => itemIds.includes(oid.toString()))

          // If this order has no items in this shipment, skip it
          if (matchingIds.length === 0) {
            return
          }

          // Mark this order as updated
          updatedOrderIndexes.add(index)

          // Update itemIds for this order's shipment
          groupShipment.itemIds = matchingIds

          // Collect order and item IDs for Shipment record
          const orderId = groupOrders[index]._id as mongoose.Types.ObjectId | undefined
          if (orderId) {
            shipmentOrderIds.push(orderId)
          }
          shipmentItemIds.push(...matchingIds)
        } else {
          // If no itemIds provided, check if orderIndexesForShipment was populated
          // (this happens when filtering by itemIds in the earlier logic)
          if (orderIndexesForShipment.size > 0 && !orderIndexesForShipment.has(index)) {
            return
          }

          // Mark this order as updated
          updatedOrderIndexes.add(index)

          // Collect order and item IDs for Shipment record when no itemIds filter
          const orderId = groupOrders[index]._id as mongoose.Types.ObjectId | undefined
          if (orderId) {
            shipmentOrderIds.push(orderId)
          }
          const itemsForThisOrder = filterSellerItems(groupOrders[index].items || [], sellerId)
          const allItemIds = itemsForThisOrder
            .map((orderItem) => (orderItem as any)?._id as mongoose.Types.ObjectId | undefined)
            .filter((oid): oid is mongoose.Types.ObjectId => Boolean(oid))
          shipmentItemIds.push(...allItemIds)
        }

        // Update shipment details for orders that have items in this shipment
        groupShipment.package = {
          weight: packageInput.weight,
          dimensions: {
            length: packageInput.length,
            width: packageInput.width,
            height: packageInput.height,
          },
        }

        groupShipment.kourierBoyzLogistics = {
          courier_id: courierId,
          order_id: shipmentData.order_id,
          order_number: shipmentData.order_number,
          rate: estimatedCharge,
          awb_number: shipmentData.awb_number,
          label_url: shipmentData.label,
          tracking_link: shipmentData.tracking_link,
          estimated_delivery_date: undefined,
        }

        // Build shippingMeta directly from the shipment payload + courier response
        groupShipment.shippingMeta = {
          awb: shipmentData.awb_number,
          courier: shipmentData.courier_partner || String(courierId),
          label: shipmentData.label,
          tracking_link: shipmentData.tracking_link,
          weight: packageInput.weight,
          dimensions: {
            length: packageInput.length,
            width: packageInput.width,
            height: packageInput.height,
          },
          pickup_address: {
            warehouseName: pickupAddress?.warehouseName,
            addressLine1: pickupAddress?.addressLine1,
            addressLine2: pickupAddress?.addressLine2,
            city: pickupAddress?.city,
            state: pickupAddress?.state,
            postalCode: pickupAddress?.postalCode,
            country: pickupAddress?.country,
            contactName: pickupAddress?.contactName,
            contactPhone: pickupAddress?.contactPhone,
          },
          charges: estimatedCharge,
        }

        // Store AWB-wise charges for this shipment
        // For multi-order shipments, use allocated charge; for single orders, use full charge
        const allocatedCourierCharge =
          chargeAllocations.get(index) ?? (updatedOrderIndexes.has(index) ? estimatedCharge : null)
        groupShipment.courierCharge = allocatedCourierCharge || null

        // Calculate COD charge for this specific order (not shared, each order has its own COD)
        const groupOrder = groupOrders[index]
        const itemsForThisShipment = filterSellerItems(groupOrder.items || [], sellerId)
        const shipmentTotals = computeSellerTotals(itemsForThisShipment)
        groupShipment.codCharge =
          groupOrder.paymentMethod === 'cod' ? Math.round(shipmentTotals.itemSubtotal * 0.02) : null
      })

      // Check if shipment contains fragile items
      // Priority: 1) User-specified fragile flag from pickup request, 2) Auto-detect from products
      // Find the shipment input that matches this shipment group (by itemIds)
      const shipmentItemIdsStrings = shipmentItemIds.map((id) => id.toString())
      const matchingShipmentInput = shipmentInputs.find((input) => {
        const inputItemIds = (input.itemIds || []).map((id) => id.toString())
        // Check if any itemIds from input match shipmentItemIds
        return inputItemIds.some((id) => shipmentItemIdsStrings.includes(id))
      })

      // Extract fragile flag from matching shipment input
      const userSpecifiedFragile =
        matchingShipmentInput?.fragile !== undefined
          ? Boolean(matchingShipmentInput.fragile)
          : undefined
      let hasFragileItemsInShipment = userSpecifiedFragile === true

      console.log('[requestPickup] Fragile detection:', {
        userSpecifiedFragile,
        userSpecifiedFragileType: typeof userSpecifiedFragile,
        matchingShipmentInputFound: !!matchingShipmentInput,
        shipmentItemIds: shipmentItemIds.length,
        matchingInputItemIds: matchingShipmentInput?.itemIds?.length || 0,
        allShipmentInputs: shipmentInputs.map((input) => ({
          itemIds: input.itemIds?.length || 0,
          fragile: input.fragile,
          fragileType: typeof input.fragile,
        })),
      })

      // If not specified by user (undefined), auto-detect from products
      if (userSpecifiedFragile === undefined) {
        const allItemsInShipment: any[] = []
        ordersInShipment.forEach(({ order }) => {
          const itemsForOrder = filterSellerItems(order.items || [], sellerId)
          allItemsInShipment.push(...itemsForOrder)
        })

        hasFragileItemsInShipment = allItemsInShipment.some((item) => {
          const product = item.product as any
          const isFragile = product && isProductFragile(product)
          if (isFragile) {
            console.log('[requestPickup] Found fragile product:', {
              productName: product?.name,
              productId: product?._id,
            })
          }
          return isFragile
        })
      }

      console.log('[requestPickup] Setting fragile flag:', {
        hasFragileItemsInShipment,
        shipmentCount: ordersInShipment.length,
      })

      // Set fragile flag on ALL shipments that are part of this shipment group
      // Ensure it's always a boolean (not undefined)
      const fragileValue = Boolean(hasFragileItemsInShipment)
      ordersInShipment.forEach(({ shipment }) => {
        shipment.fragile = fragileValue
      })

      // Track fragile flag by kourierBoyzLogistics order_id for label generation
      if (shipmentData?.order_id) {
        fragileFlagsByKourierBoyzLogisticsOrderId.set(shipmentData.order_id, fragileValue)
      }

      console.log('[requestPickup] Fragile flag set on shipments:', {
        fragileValue,
        shipmentCount: ordersInShipment.length,
        kourierBoyzLogisticsOrderId: shipmentData?.order_id,
        ordersInShipment: ordersInShipment.map(({ order }) => ({
          orderId: order._id?.toString(),
          orderNumber: (order as any).orderNumber,
        })),
      })

      // Create a Shipment record to track this physical shipment
      if (shipmentOrderIds.length > 0 && shipmentItemIds.length > 0) {
        const shipmentRecord = new Shipment({
          seller: toObjectId(sellerId),
          status: 'pickup_requested',
          package: {
            weight: packageInput.weight,
            dimensions: {
              length: packageInput.length,
              width: packageInput.width,
              height: packageInput.height,
            },
          },
          kourierBoyzLogistics: {
            courier_id: courierId,
            order_id: shipmentData.order_id,
            rate: estimatedCharge,
            awb_number: shipmentData.awb_number,
            label_url: shipmentData.label,
            tracking_link: shipmentData.tracking_link,
            estimated_delivery_date: undefined,
          },
          shippingMeta: {
            awb: shipmentData.awb_number,
            courier: shipmentData.courier_partner || String(courierId),
            label: shipmentData.label,
            tracking_link: shipmentData.tracking_link,
            weight: packageInput.weight,
            dimensions: {
              length: packageInput.length,
              width: packageInput.width,
              height: packageInput.height,
            },
            pickup_address: {
              warehouseName: pickupAddress?.warehouseName,
              addressLine1: pickupAddress?.addressLine1,
              addressLine2: pickupAddress?.addressLine2,
              city: pickupAddress?.city,
              state: pickupAddress?.state,
              postalCode: pickupAddress?.postalCode,
              country: pickupAddress?.country,
              contactName: pickupAddress?.contactName,
              contactPhone: pickupAddress?.contactPhone,
            },
            charges: estimatedCharge,
          },
          orderIds: shipmentOrderIds,
          itemIds: shipmentItemIds,
          pickupAddress: {
            warehouseName: pickupAddress?.warehouseName,
            addressLine1: pickupAddress?.addressLine1,
            addressLine2: pickupAddress?.addressLine2,
            city: pickupAddress?.city,
            state: pickupAddress?.state,
            postalCode: pickupAddress?.postalCode,
            country: pickupAddress?.country,
            contactName: pickupAddress?.contactName,
            contactPhone: pickupAddress?.contactPhone,
          },
        })
        await shipmentRecord.save()
      }
    }

    // Persist provider identifiers immediately so retries don't recreate
    // shipments if any downstream manifest/label/invoice step fails.
    groupOrders.forEach((orderDoc) => orderDoc.markModified('sellerShipments'))
    await Promise.all(groupOrders.map((orderDoc) => orderDoc.save()))

    // Persist updated shipment details (kourierBoyzLogistics, shippingMeta, package) for all grouped orders
    groupOrders.forEach((orderDoc) => orderDoc.markModified('sellerShipments'))
    await Promise.all(groupOrders.map((orderDoc) => orderDoc.save()))


    // Step 2: Generate a manifest if any shipment requested it
    let manifestDataResult: any = null
    if (manifestData && manifestData.length > 0) {
      const manifestRequest: ShippingManifestRequest = {
        order_numbers: manifestData,
        type: 'b2c',
      }

      console.info('[Shipmozo] generateManifest request', {
        ...courierLogContext,
        orderNumbers: manifestData,
      })

      const manifestResponse = await shippingProviderService.generateManifest(manifestRequest)
      manifestDataResult = manifestResponse.data

      console.info('[Shipmozo] generateManifest response', {
        ...courierLogContext,
        manifestData: manifestDataResult,
      })

      // Attach manifest only to shipments that were actually updated (have kourierBoyzLogistics data)
      groupShipments.forEach((groupShipment, index) => {
        if (updatedOrderIndexes.has(index) && groupShipment.kourierBoyzLogistics?.order_id) {
          groupShipment.manifest = {
            manifest_id: manifestDataResult.manifest_id,
            manifest_url: manifestDataResult.manifest_url,
            manifest_key: manifestDataResult.manifest_key,
          }
        }
      })
    } else {
      console.info(
        '[Shipmozo] Skipping manifest creation - createManifest is false or not set',
        {
          ...courierLogContext,
        },
      )
    }

    // Step 4: Generate label & order invoice (only when pickup is requested)
    // CRITICAL: Only process orders that were actually part of a shipment
    // SELLER INVOICES: Always generate individual order-wise invoices (never batch-wise)
    // Batch invoices are customer-facing and generated separately (not in this seller endpoint)

    const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
    const invoiceSettings = await AdminInvoiceSettings.getSingleton()

    // Step 4a: Generate shipment-wise labels (ONE label per shipment group with all items from all orders in that shipment)
    // Group orders by kourierBoyzLogistics.order_id to identify shipment groups
    // (fragileFlagsByKourierBoyzLogisticsOrderId is already declared above)
    const shipmentLabelGroups = new Map<string, typeof groupOrders>()
    for (let orderIndex = 0; orderIndex < groupOrders.length; orderIndex++) {
      if (!updatedOrderIndexes.has(orderIndex)) continue

      const groupOrder = groupOrders[orderIndex]
      const populatedOrder = await Order.findById(groupOrder._id).populate(
        'sellerShipments.seller',
        'name businessName gstNumber',
      )

      if (!populatedOrder) continue

      const shipmentForOrder = populatedOrder.sellerShipments.find(
        (s) => s?.seller?._id?.toString() === sellerId,
      )

      if (!shipmentForOrder?.kourierBoyzLogistics?.order_id) continue

      const kourierBoyzLogisticsOrderId = shipmentForOrder.kourierBoyzLogistics.order_id
      if (!shipmentLabelGroups.has(kourierBoyzLogisticsOrderId)) {
        shipmentLabelGroups.set(kourierBoyzLogisticsOrderId, [])
      }
      shipmentLabelGroups.get(kourierBoyzLogisticsOrderId)!.push(groupOrder)
    }

    // Generate ONE label per shipment group with all items from all orders in that shipment
    for (const [kourierBoyzLogisticsOrderId, ordersInShipment] of shipmentLabelGroups.entries()) {
      // Get first order in shipment to use as template
      const firstOrderInShipment = ordersInShipment[0]
      const populatedFirstOrder = await Order.findById(firstOrderInShipment._id)
        .populate('items.product', 'name slug')
        .populate('items.variant', 'name sku')
        .populate('user', 'name email phone')
        .populate('sellerShipments.seller', 'name businessName gstNumber')

      if (!populatedFirstOrder) continue

      const shipmentForFirstOrder = populatedFirstOrder.sellerShipments.find(
        (s) =>
          s?.seller?._id?.toString() === sellerId && s.kourierBoyzLogistics?.order_id === kourierBoyzLogisticsOrderId,
      )

      if (!shipmentForFirstOrder) continue

      // Check if AWB is available before generating label
      const awbNumber =
        shipmentForFirstOrder.kourierBoyzLogistics?.awb_number || shipmentForFirstOrder.shippingMeta?.awb
      if (!awbNumber) {
        console.log(
          `[requestPickup] AWB not available yet for kourierBoyzLogistics order ${kourierBoyzLogisticsOrderId}, skipping label generation`,
        )
        continue
      }

      console.log('[requestPickup] Shipment for label generation:', {
        kourierBoyzLogisticsOrderId,
        awbNumber,
        fragile: shipmentForFirstOrder.fragile,
        hasFragile: shipmentForFirstOrder.fragile === true,
        kourierBoyzLogisticsAwb: shipmentForFirstOrder.kourierBoyzLogistics?.awb_number,
        shippingMetaAwb: shipmentForFirstOrder.shippingMeta?.awb,
      })

      // Check if shipment label already exists
      if (shipmentForFirstOrder.label?.label_url) {
        console.log(
          `[requestPickup] Shipment label already exists for kourierBoyzLogistics order ${kourierBoyzLogisticsOrderId}`,
        )
        continue
      }

      const customer = populatedFirstOrder.user as any
      const sellerForShipment = await fetchSeller(sellerId)

      // Collect all items from all orders in this shipment (for shipment-wise label)
      const allShipmentItemsForLabel: any[] = []
      const allOrderItems: any[] = [] // Store all order items for price calculation
      const allShipmentItemIds: string[] = [] // Collect itemIds from all shipments in this group

      for (const orderInShipment of ordersInShipment) {
        const populatedOrderInShipment = await Order.findById(orderInShipment._id)
          .populate('items.product', 'name slug tags specifications')
          .populate('items.variant', 'name sku')
          .populate('user', 'name email phone')

        if (populatedOrderInShipment) {
          // Find the shipment for this order in the group
          const shipmentInGroup = populatedOrderInShipment.sellerShipments.find(
            (s) =>
              s?.seller?._id?.toString() === sellerId &&
              s.kourierBoyzLogistics?.order_id === kourierBoyzLogisticsOrderId,
          )

          // Collect itemIds from this shipment
          if (shipmentInGroup?.itemIds) {
            allShipmentItemIds.push(...shipmentInGroup.itemIds.map((id) => id.toString()))
          }

          // Include all items from this order (for shipment label showing all items)
          allShipmentItemsForLabel.push(
            ...(populatedOrderInShipment.items || []).map((item) => ({
              product: item.product,
              variant: item.variant,
              quantity: item.quantity,
            })),
          )

          // Also store order items for price calculation
          allOrderItems.push(...(populatedOrderInShipment.items || []))
        }
      }

      // Generate ONE label for the entire shipment with all items from all orders
      // Create a combined shipment object with all itemIds from all orders
      // Ensure fragile flag and AWB are explicitly included
      // Get fragile flag from our tracking map (more reliable than DB read)
      const trackedFragileFlag = fragileFlagsByKourierBoyzLogisticsOrderId.get(kourierBoyzLogisticsOrderId)
      const fragileFlag =
        trackedFragileFlag !== undefined
          ? Boolean(trackedFragileFlag)
          : Boolean(shipmentForFirstOrder.fragile)
      const combinedShipment = {
        ...shipmentForFirstOrder,
        itemIds: allShipmentItemIds, // All itemIds from all orders in this shipment
        fragile: fragileFlag, // Explicitly include fragile flag (ensure boolean)
        // Explicitly ensure AWB is included (should already be present, but make it explicit)
        kourierBoyzLogistics: {
          ...shipmentForFirstOrder.kourierBoyzLogistics,
          awb_number: shipmentForFirstOrder.kourierBoyzLogistics?.awb_number || awbNumber,
        },
        shippingMeta: {
          ...shipmentForFirstOrder.shippingMeta,
          awb: shipmentForFirstOrder.shippingMeta?.awb || awbNumber,
        },
      }

      console.log('[requestPickup] Combined shipment for label:', {
        fragile: combinedShipment.fragile,
        fragileType: typeof combinedShipment.fragile,
        trackedFragile: trackedFragileFlag,
        originalFragile: shipmentForFirstOrder.fragile,
        itemIdsCount: combinedShipment.itemIds?.length || 0,
        awbNumber: combinedShipment.kourierBoyzLogistics?.awb_number || combinedShipment.shippingMeta?.awb,
        hasKourierBoyzLogistics: !!combinedShipment.kourierBoyzLogistics,
        hasShippingMeta: !!combinedShipment.shippingMeta,
      })

      const shipmentLabelData = {
        order: populatedFirstOrder as any, // Use first order as template for customer/shipping address
        shipment: combinedShipment as any, // Use combined shipment with all itemIds
        customer, // Customer from first order (or could be combined)
        seller: sellerForShipment,
        items: allShipmentItemsForLabel, // All items from all orders
        allOrderItems: allOrderItems, // Pass order items for price calculation
      }

      const shipmentLabelBuffer = await generateLabel(shipmentLabelData)
      // Reuse awbNumber from above (already validated)
      const labelFileName = `labels/${awbNumber || 'unknown'}-${Date.now()}.pdf`
      const labelUrl = await uploadToR2(
        shipmentLabelBuffer,
        labelFileName,
        'application/pdf',
        'labels',
      )
      const shipmentLabelPayload = {
        label_url: labelUrl,
        generated_at: new Date(),
      }

      // Store the SAME shipment label in all shipments and orders that are part of this shipment group
      for (const orderInShipment of ordersInShipment) {
        const populatedOrderInShipment = await Order.findById(orderInShipment._id).populate(
          'sellerShipments.seller',
          'name businessName gstNumber',
        )

        if (populatedOrderInShipment) {
          const shipmentInGroup = populatedOrderInShipment.sellerShipments.find(
            (s) =>
              s?.seller?._id?.toString() === sellerId &&
              s.kourierBoyzLogistics?.order_id === kourierBoyzLogisticsOrderId,
          )

          if (shipmentInGroup) {
            shipmentInGroup.label = shipmentLabelPayload
            populatedOrderInShipment.label = shipmentLabelPayload
            populatedOrderInShipment.markModified('sellerShipments')
            await populatedOrderInShipment.save()
          }
        }
      }

      console.log(
        `[requestPickup] Generated ONE shipment label for ${ordersInShipment.length} orders shipped together (kourierBoyzLogistics order: ${kourierBoyzLogisticsOrderId}) with ${allShipmentItemsForLabel.length} items`,
      )
    }

    // Step 4b: Generate order-level invoices for each order
    // SELLER INVOICES: ALWAYS order-wise (each order gets its own invoice with only its items)
    // Never batch-wise - sellers should see individual invoices for each order
    try {
      for (let orderIndex = 0; orderIndex < groupOrders.length; orderIndex++) {
        // Skip orders that were not part of any shipment
        if (!updatedOrderIndexes.has(orderIndex)) {
          continue
        }

        const groupOrder = groupOrders[orderIndex]
        const populatedOrder = await Order.findById(groupOrder._id)
          .populate('items.product', 'name slug mainImage sku images')
          .populate('items.variant', 'name sku mainImage images attributes')
          .populate(
            'items.seller',
            'name businessName storeSlug panNumber gstNumber state addressLine1 addressLine2 city postalCode country',
          )
          .populate('user', 'name email phone gstNumber')
          .populate(
            'sellerShipments.seller',
            'name businessName gstNumber panNumber state addressLine1 addressLine2 city postalCode country',
          )
          .populate('coupon', 'code discountType')

        if (populatedOrder) {
          const customer = populatedOrder.user as any
          const sellerForOrder = await fetchSeller(sellerId)
          const shipmentForOrder = populatedOrder.sellerShipments.find(
            (s) => s?.seller?._id?.toString() === sellerId,
          )

          if (!shipmentForOrder) {
            console.log(
              `[requestPickup] No shipment found for order ${populatedOrder._id}, skipping`,
            )
            continue
          }

          // Only generate invoices if this shipment has kourierBoyzLogistics data
          // (meaning it was actually part of a shipment)
          if (!shipmentForOrder.kourierBoyzLogistics?.order_id) {
            console.log(
              `[requestPickup] No provider order_id for order ${populatedOrder._id}, skipping invoice generation`,
            )
            continue
          }

          // Labels are already generated shipment-wise above, so skip label generation here

          // Generate CUSTOMER (buyer) invoice at pickup — always generate here when missing (never defer to download)
          if (!populatedOrder.invoice?.invoice_url) {
            try {
              console.log(
                `[requestPickup] Generating customer invoice for order ${populatedOrder._id}`,
              )
              const sellerForCustomerInvoice =
                (populatedOrder.items?.[0] as any)?.seller ||
                (populatedOrder.sellerShipments?.[0] as any)?.seller ||
                sellerForOrder
              const customerInvoiceData = {
                order: populatedOrder.toObject ? populatedOrder.toObject() : (populatedOrder as any),
                customer: customer,
                seller: sellerForCustomerInvoice,
                items: (populatedOrder.items || []).map((item: any) => ({
                  product: item.product,
                  variant: item.variant,
                  orderItem: item.toObject ? item.toObject() : item,
                })),
                audience: 'buyer' as const,
              }
              const customerInvoice = await generateInvoice(customerInvoiceData, 'INVOICE')
              if (customerInvoice.invoice_url && customerInvoice.invoice_number) {
                populatedOrder.invoice = {
                  invoice_id: customerInvoice.invoice_id,
                  invoice_url: customerInvoice.invoice_url,
                  invoice_number: customerInvoice.invoice_number,
                  generated_at: new Date(),
                  hsnSummary: customerInvoice.hsnSummary,
                }
                populatedOrder.markModified('invoice')
                console.log(
                  `[requestPickup] Generated customer invoice for order ${populatedOrder._id}: ${customerInvoice.invoice_url}`,
                )
              }
            } catch (customerInvoiceError) {
              console.error(
                `[requestPickup] Error generating customer invoice for order ${populatedOrder._id}:`,
                customerInvoiceError,
              )
            }
          } else {
            console.log(
              `[requestPickup] Customer invoice already exists for order ${populatedOrder._id}`,
            )
          }

          // Generate TRIPLICATE (To Supplier) invoice at pickup — same as customer invoice with "Triplicate - To Supplier" (if not exists). Never defer to download.
          if (!shipmentForOrder.triplicateInvoice?.invoice_url) {
            try {
              console.log(
                `[requestPickup] Generating triplicate (To Supplier) invoice for order ${populatedOrder._id}`,
              )
              const sellerForTriplicate =
                (populatedOrder.items?.[0] as any)?.seller ||
                (populatedOrder.sellerShipments?.[0] as any)?.seller ||
                sellerForOrder
              const triplicateInvoiceData = {
                order: populatedOrder.toObject ? populatedOrder.toObject() : (populatedOrder as any),
                customer: customer,
                seller: sellerForTriplicate,
                items: (populatedOrder.items || []).map((item: any) => ({
                  product: item.product,
                  variant: item.variant,
                  orderItem: item.toObject ? item.toObject() : item,
                })),
                audience: 'buyer' as const,
                copyLabel: 'triplicate_to_supplier' as const,
              }
              const triplicateInvoice = await generateInvoice(triplicateInvoiceData, 'INVOICE')
              if (triplicateInvoice.invoice_url && triplicateInvoice.invoice_number) {
                const triplicatePayload = {
                  invoice_id: triplicateInvoice.invoice_id,
                  invoice_url: triplicateInvoice.invoice_url,
                  invoice_number: triplicateInvoice.invoice_number,
                  generated_at: new Date(),
                }
                const shipmentIndex = populatedOrder.sellerShipments.findIndex(
                  (s) => s?.seller?._id?.toString() === sellerId,
                )
                if (shipmentIndex >= 0) {
                  populatedOrder.set(
                    `sellerShipments.${shipmentIndex}.triplicateInvoice`,
                    triplicatePayload,
                  )
                } else {
                  shipmentForOrder.triplicateInvoice = triplicatePayload
                  populatedOrder.markModified('sellerShipments')
                }
                console.log(
                  `[requestPickup] Generated triplicate (To Supplier) invoice for order ${populatedOrder._id}: ${triplicateInvoice.invoice_url}`,
                )
              }
            } catch (triplicateError) {
              console.error(
                `[requestPickup] Error generating triplicate invoice for order ${populatedOrder._id}:`,
                triplicateError,
              )
            }
          }

          // Generate SELLER invoice when pickup is requested (if not exists)
          // Seller invoices include settlement summary and are generated order-wise
          if (!shipmentForOrder.invoice?.invoice_url) {
            try {
              console.log(
                `[requestPickup] Generating seller invoice for order ${populatedOrder._id}`,
              )

              // Filter items for this seller only
              const sellerItems = filterSellerItems(populatedOrder.items || [], sellerId)
              const sellerTotals = computeSellerTotals(sellerItems)

              // Build settlement summary for seller invoice
              const grossAmount =
                typeof populatedOrder.total === 'number'
                  ? populatedOrder.total
                  : sellerTotals.itemSubtotal

              const marketplaceFees = 0 // Placeholder - can be wired to real fee model later
              // Use allocated forward charge (courierCharge) for this order; not full AWB rate
              const courierCharges =
                shipmentForOrder.courierCharge ??
                shipmentForOrder.kourierBoyzLogistics?.rate ??
                (typeof populatedOrder.shipping === 'number' ? populatedOrder.shipping : 0)
              const codFees =
                populatedOrder.paymentMethod === 'cod' ? Math.round(grossAmount * 0.02) : 0
              const netSettlement = grossAmount - marketplaceFees - courierCharges - codFees

              const sellerInvoiceData = {
                order: populatedOrder,
                customer: customer,
                seller: sellerForOrder,
                items: sellerItems.map((item) => ({
                  product: item.product,
                  variant: item.variant,
                  orderItem: item,
                })),
                audience: 'seller' as const,
                existingInvoice: shipmentForOrder.invoice || undefined,
                settlement: {
                  grossAmount,
                  marketplaceFees,
                  courierCharges,
                  codFees,
                  netSettlement,
                },
              }

              const sellerInvoice = await generateInvoice(sellerInvoiceData)
              const sellerInvoicePayload = {
                invoice_id: sellerInvoice.invoice_id,
                invoice_url: sellerInvoice.invoice_url,
                invoice_number: sellerInvoice.invoice_number,
                generated_at: new Date(),
                hsnSummary: sellerInvoice.hsnSummary,
              }

              const shipmentIdx = populatedOrder.sellerShipments.findIndex(
                (s) => s?.seller?._id?.toString() === sellerId,
              )
              if (shipmentIdx >= 0) {
                populatedOrder.set(`sellerShipments.${shipmentIdx}.invoice`, sellerInvoicePayload)
              } else {
                shipmentForOrder.invoice = sellerInvoicePayload
                populatedOrder.markModified('sellerShipments')
              }
              console.log(
                `[requestPickup] Generated seller invoice for order ${populatedOrder._id}: ${sellerInvoice.invoice_url}`,
              )
            } catch (invoiceError) {
              console.error(
                `[requestPickup] Error generating seller invoice for order ${populatedOrder._id}:`,
                invoiceError,
              )
              // Don't fail the pickup request if invoice generation fails
            }
          } else {
            console.log(
              `[requestPickup] Seller invoice already exists for order ${populatedOrder._id}: ${shipmentForOrder.invoice.invoice_url}`,
            )
          }

          // Only update status if it's a forward transition (skip if already past pickup_requested)
          // Use isForwardStatusTransition to check if we can safely update
          const currentStatus = shipmentForOrder.status

          if (
            isForwardStatusTransition(currentStatus, 'pickup_requested') &&
            currentStatus !== 'pickup_requested'
          ) {
            // Status is before pickup_requested, safe to update
            try {
              updateShipmentStatus(populatedOrder, shipmentForOrder, 'pickup_requested')
            } catch (statusError: any) {
              // If status transition fails for any reason, log and continue
              console.warn(
                `[requestPickup] Failed to update status for order ${populatedOrder._id}: ${statusError.message}`,
              )
            }
          } else {
            // Status is already at or past pickup_requested, skip update
            console.log(
              `[requestPickup] Skipping status update for order ${populatedOrder._id} - shipment already at or past pickup_requested status (current: ${currentStatus})`,
            )
          }
          recalcOrderStatus(populatedOrder)
          populatedOrder.markModified('sellerShipments')

          // Handle version conflicts by reloading and retrying
          try {
            await populatedOrder.save()
          } catch (saveError: any) {
            if (saveError.name === 'VersionError') {
              console.warn(
                `[requestPickup] Version conflict for order ${populatedOrder._id}, reloading and retrying...`,
              )
              // Reload the document and retry the save
              const reloadedOrder = await Order.findById(populatedOrder._id)
                .populate('items.product', 'name slug')
                .populate('items.variant', 'name sku')
                .populate('user', 'name email phone')
                .populate('sellerShipments.seller', 'name businessName gstNumber')

              if (reloadedOrder) {
                const reloadedShipment = reloadedOrder.sellerShipments.find(
                  (s) => s?.seller?._id?.toString() === sellerId,
                )
                let didChange = false
                if (reloadedShipment) {
                  if (shipmentForOrder.label?.label_url) {
                    reloadedShipment.label = shipmentForOrder.label
                    didChange = true
                  }
                  if (shipmentForOrder.triplicateInvoice?.invoice_url) {
                    reloadedShipment.triplicateInvoice = shipmentForOrder.triplicateInvoice
                    didChange = true
                  }
                  if (shipmentForOrder.invoice?.invoice_url) {
                    reloadedShipment.invoice = shipmentForOrder.invoice
                    didChange = true
                  }
                }
                if (populatedOrder.invoice?.invoice_url) {
                  reloadedOrder.invoice = populatedOrder.invoice
                  reloadedOrder.markModified('invoice')
                  didChange = true
                }
                if (didChange) {
                  if (reloadedShipment) {
                    reloadedOrder.markModified('sellerShipments')
                  }
                  await reloadedOrder.save()
                }
              }
            } else {
              throw saveError
            }
          }

          // Create customer notification for ready to ship
          try {
            const Notification = (await import('../models/Notification')).default
            const userId =
              typeof populatedOrder.user === 'string'
                ? populatedOrder.user
                : (populatedOrder.user as any)?._id?.toString?.()
                ? (populatedOrder.user as any)._id.toString()
                : undefined

            if (userId && populatedOrder.status === 'ready_to_ship') {
              const orderId =
                (populatedOrder as any)._id?.toString?.() || String(populatedOrder._id)
              await Notification.create({
                userId,
                title: 'Order Ready for Pickup',
                message: `Your order ${populatedOrder.orderNumber} is ready for pickup and will be shipped soon.`,
                type: 'order',
                read: false,
                link: `/profile/orders?orderId=${orderId}`,
              })
            }
          } catch (error) {
            console.error('[Notification] Failed to create ready_to_ship notification:', error)
          }

          // Notify seller: AWB / label ready (shipping label + invoice URLs)
          try {
            const sellerSnapshot = shipmentForOrder.sellerSnapshot || (sellerForOrder as any)
            const sellerName =
              sellerSnapshot?.businessName ||
              sellerSnapshot?.name ||
              (sellerForOrder as any)?.name ||
              'Seller'
            const sellerEmail =
              (sellerForOrder as any)?.supportEmail ||
              (sellerForOrder as any)?.email ||
              sellerSnapshot?.supportEmail

            const awb =
              shipmentForOrder.shippingMeta?.awb || shipmentForOrder.kourierBoyzLogistics?.awb_number
            const trackingLink =
              shipmentForOrder.shippingMeta?.tracking_link ||
              shipmentForOrder.kourierBoyzLogistics?.tracking_link ||
              undefined
            const labelUrl =
              shipmentForOrder.label?.label_url ||
              shipmentForOrder.shippingMeta?.label ||
              shipmentForOrder.kourierBoyzLogistics?.label_url
            const invoiceUrl = populatedOrder.invoice?.invoice_url

            if (sellerEmail) {
              void sendEmail(
                sellerEmail,
                `Shipping label ready for order ${populatedOrder.orderNumber || ''}`,
                emailTemplates.sellerAwbGenerated(sellerName, {
                  orderNumber: populatedOrder.orderNumber || 'N/A',
                  awb,
                  labelUrl,
                  invoiceUrl,
                  trackingLink,
                }),
              )
            }

            try {
              io.to(`user:${sellerId}`).emit('order:awb_generated', {
                orderId: (populatedOrder as any)._id?.toString?.() || String(populatedOrder._id),
                orderNumber: populatedOrder.orderNumber,
                awb,
                trackingLink,
                labelUrl,
                invoiceUrl,
                shipmentId: shipmentForOrder._id?.toString(),
                triggeredAt: new Date().toISOString(),
              })
            } catch {
              // ignore socket errors
            }
          } catch {
            // ignore notification failures
          }
        }
      }
    } catch (labelError) {
      console.error('Error generating labels for grouped shipment:', labelError)
      // Don't fail shipment creation if label generation fails
      // Only update status for orders that were actually part of a shipment
      for (const [index, groupOrder] of groupOrders.entries()) {
        if (updatedOrderIndexes.has(index)) {
          const shipment = groupShipments[index]
          // Only update if shipment has kourierBoyzLogistics data (was part of a shipment)
          if (shipment.kourierBoyzLogistics?.order_id) {
            try {
              updateShipmentStatus(groupOrder, shipment, 'pickup_requested')
              recalcOrderStatus(groupOrder)
            } catch (statusError: any) {
              // Skip status update if invalid transition (already past pickup_requested)
              if (statusError.message !== 'INVALID_STATUS_TRANSITION') {
                throw statusError
              }
            }
          }
        }
      }
      // Save orders one by one to handle version conflicts
      for (const order of groupOrders) {
        try {
          await order.save()
        } catch (saveError: any) {
          if (saveError.name === 'VersionError') {
            console.warn(
              `[requestPickup] Version conflict for order ${order._id} in error handler, skipping save`,
            )
            // Skip this order's save on version conflict in error handler
            continue
          }
          throw saveError
        }
      }
    }

    // Reload primary order so response includes updated sellerShipments (triplicateInvoice, invoice, label)
    const orderForResponse = await Order.findById(ownedOrder._id)
      .populate('sellerShipments.seller', 'name businessName gstNumber')
      .lean()
    const responseOrder = orderForResponse ?? ownedOrder

    return res.json({
      success: true,
      data: {
        ...toSellerResponse(responseOrder, sellerId),
        manifest: manifestDataResult
          ? {
              manifest_id: manifestDataResult.manifest_id,
              manifest_url: manifestDataResult.manifest_url,
              invoice_url: manifestDataResult.manifest_url,
              label_url: manifestDataResult.manifest_url,
            }
          : undefined,
      },
    })
  } catch (error: any) {
    console.error('Error requesting pickup:', error)
    if (courierLogContext) {
      console.error('[Shipmozo] requestPickup failed', {
        ...courierLogContext,
        error: error.response?.data || error.message || error,
      })
    }
    const statusCode =
      error.message === 'ORDER_NOT_FOUND' || error.message === 'SELLER_SHIPMENT_NOT_FOUND'
        ? 404
        : error.message === 'INVALID_STATUS_TRANSITION'
        ? 400
        : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to request pickup',
    })
  }
}

export const getSellerShipmentLabel = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id, shipmentId } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const order = await Order.findOne({
      _id: id,
      'sellerShipments._id': shipmentId,
      'items.seller': sellerId,
    })

    const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)
    if (!sellerShipment?.kourierBoyzLogistics?.order_id) {
      return res.status(400).json({
        success: false,
        message: 'Shipment not booked yet',
      })
    }

    const label = await shippingProviderService.getLabel(sellerShipment.kourierBoyzLogistics.order_id)

    if (label?.data?.label_url) {
      sellerShipment.shippingMeta = sellerShipment.shippingMeta || {}
      sellerShipment.shippingMeta.label = label.data.label_url
      ownedOrder.markModified('sellerShipments')
      await ownedOrder.save()
    }

    return res.json({
      success: true,
      data: label.data,
    })
  } catch (error: any) {
    const statusCode =
      error.message === 'ORDER_NOT_FOUND' || error.message === 'SELLER_SHIPMENT_NOT_FOUND'
        ? 404
        : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch label',
    })
  }
}

export const downloadSellerInvoice = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }
    // Load full order with related data so we can generate a seller-facing invoice
    const order = await Order.findOne({
      _id: id,
      'items.seller': sellerId,
    })
      .populate('items.product', 'name slug')
      .populate('items.variant', 'name sku')
      .populate('user', 'name email phone')
      .populate('sellerShipments.seller', 'name businessName gstNumber')

    const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)

    // Filter items for this seller only
    const sellerItems = filterSellerItems(ownedOrder.items || [], sellerId)
    const sellerTotals = computeSellerTotals(sellerItems)

    const seller = sellerShipment.seller as unknown as IUser

    // Build a simple settlement summary for the seller's invoice
    const grossAmount =
      typeof ownedOrder.total === 'number' ? ownedOrder.total : sellerTotals.itemSubtotal

    // Check lockAfterIssue - if invoice exists and lock is enabled, return existing invoice
    const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
    const invoiceSettings = await AdminInvoiceSettings.getSingleton()

    if (sellerShipment.invoice?.invoice_url && invoiceSettings.lockAfterIssue) {
      // Return existing invoice instead of regenerating
      return res.json({
        success: true,
        data: {
          invoice_url: sellerShipment.invoice.invoice_url,
          invoice_number: sellerShipment.invoice.invoice_number,
          hsnSummary: sellerShipment.invoice.hsnSummary,
        },
      })
    }

    const marketplaceFees = 0 // Placeholder - can be wired to real fee model later
    // Use allocated forward charge (courierCharge) for this order; not full AWB rate
    const courierCharges =
      sellerShipment.courierCharge ??
      sellerShipment.kourierBoyzLogistics?.rate ??
      (typeof ownedOrder.shipping === 'number' ? ownedOrder.shipping : 0)
    const codFees = ownedOrder.paymentMethod === 'cod' ? Math.round(grossAmount * 0.02) : 0
    const netSettlement = grossAmount - marketplaceFees - courierCharges - codFees

    const invoiceData = {
      order: ownedOrder,
      customer: ownedOrder.user as any,
      seller,
      items: sellerItems.map((item) => ({
        product: item.product,
        variant: item.variant,
        orderItem: item,
      })),
      audience: 'seller' as const,
      existingInvoice: sellerShipment.invoice || undefined,
      settlement: {
        grossAmount,
        marketplaceFees,
        courierCharges,
        codFees,
        netSettlement,
      },
    }

    const invoice = await generateInvoice(invoiceData)

    return res.json({
      success: true,
      data: {
        invoice_url: invoice.invoice_url,
        invoice_number: invoice.invoice_number,
        hsnSummary: invoice.hsnSummary,
      },
    })
  } catch (error: any) {
    const statusCode =
      error.message === 'ORDER_NOT_FOUND' || error.message === 'SELLER_SHIPMENT_NOT_FOUND'
        ? 404
        : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch invoice',
    })
  }
}

export const downloadSellerLabel = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const order = await Order.findOne({
      _id: id,
      'items.seller': sellerId,
    })

    const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)

    // Prefer order-level label (consolidated), then shipment-level
    const labelUrl = ownedOrder.label?.label_url || sellerShipment.label?.label_url

    if (!labelUrl) {
      return res.status(404).json({
        success: false,
        message: 'Label not available for this order',
      })
    }

    return res.json({
      success: true,
      data: {
        label_url: labelUrl,
        label_id: ownedOrder.label?.label_id || sellerShipment.label?.label_id,
      },
    })
  } catch (error: any) {
    const statusCode =
      error.message === 'ORDER_NOT_FOUND' || error.message === 'SELLER_SHIPMENT_NOT_FOUND'
        ? 404
        : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch label',
    })
  }
}

export const trackSellerShipment = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id, shipmentId } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const order = await Order.findOne({
      _id: id,
      'sellerShipments._id': shipmentId,
      'items.seller': sellerId,
    })

    const { order: ownedOrder, sellerShipment } = ensureSellerAccess(order, sellerId)
    const awb = sellerShipment.shippingMeta?.awb || sellerShipment.kourierBoyzLogistics?.awb_number
    if (!awb) {
      console.warn(
        `[trackSellerShipment] AWB not available for order ${id}, shipment ${shipmentId}, seller ${sellerId}`,
      )
      return res.status(400).json({
        success: false,
        message: 'Shipment AWB not available',
      })
    }

    console.log(
      `[trackSellerShipment] Tracking shipment - Order: ${id}, Shipment: ${shipmentId}, Seller: ${sellerId}, AWB: ${awb}`,
    )

    const tracking = await shippingProviderService.trackShipment({ awb })

    console.log(
      `[trackSellerShipment] Full shipping provider response for AWB ${awb}:`,
      JSON.stringify(tracking, null, 2),
    )

    if (tracking?.data?.tracking_events) {
      const eventCount = tracking.data.tracking_events.length
      console.log(`[trackSellerShipment] Received ${eventCount} tracking events for AWB ${awb}`)

      sellerShipment.trackingEvents = tracking.data.tracking_events.map((event: any) => ({
        status: event.status_code || event.status || 'unknown',
        location: event.location || '',
        message: event.message || '',
        timestamp: new Date(event.event_time || event.timestamp || Date.now()),
      }))

      const courierStatus = tracking.data.status?.toLowerCase()
      let mappedStatus: SellerShipmentStatus | null = null
      switch (courierStatus) {
        case 'in_transit':
          mappedStatus = 'in_transit'
          break
        case 'out_for_delivery':
          mappedStatus = 'out_for_delivery'
          break
        case 'delivered':
          mappedStatus = 'delivered'
          break
        default:
          mappedStatus = null
      }

      if (mappedStatus && mappedStatus !== sellerShipment.status) {
        const previousStatus = sellerShipment.status
        console.log(
          `[trackSellerShipment] Updating shipment status from ${previousStatus} to ${mappedStatus} for AWB ${awb}`,
        )
        updateShipmentStatus(ownedOrder, sellerShipment, mappedStatus)
        recalcOrderStatus(ownedOrder)
      } else {
        console.log(
          `[trackSellerShipment] No status change needed - current: ${sellerShipment.status}, courier: ${courierStatus}`,
        )
        ownedOrder.markModified('sellerShipments')
      }
      await ownedOrder.save()
      console.log(`[trackSellerShipment] Successfully updated order ${id} status based on tracking`)
    } else {
      console.warn(`[trackSellerShipment] No tracking events received for AWB ${awb}`)
    }

    console.log(`[trackSellerShipment] Successfully completed tracking for AWB ${awb}`)
    return res.json({
      success: true,
      data: tracking.data,
    })
  } catch (error: any) {
    const statusCode =
      error.message === 'ORDER_NOT_FOUND' || error.message === 'SELLER_SHIPMENT_NOT_FOUND'
        ? 404
        : 500
    console.error(
      `[trackSellerShipment] Error tracking shipment - Order: ${req.params.id}, Shipment: ${req.params.shipmentId}, Seller: ${req.user?.userId}`,
      {
        error: error.message,
        stack: error.stack,
        statusCode,
      },
    )
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to track shipment',
    })
  }
}

// Cancel order (seller)
export const cancelSellerOrder = async (req: Request, res: Response) => {
  try {
    const seller = await checkUserAccess(req, res, ['seller'])
    if (!seller) return

    const { id } = req.params

    // Find order where seller has a shipment
    const order = await Order.findOne({
      _id: id,
      'sellerShipments.seller': seller._id,
    })
      .populate('sellerShipments.seller', 'name businessName storeSlug supportEmail storePhone')
      .populate('user', 'name email')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    // Check if order can be cancelled
    const { canCancel, reason } = canCancelOrder(order)
    if (!canCancel) {
      return res.status(400).json({
        success: false,
        message: reason || 'Order cannot be cancelled',
      })
    }

    // Cancel only the seller's shipment
    const sellerShipment = order.sellerShipments.find(
      (shipment) => shipment.seller?._id?.toString() === seller._id.toString(),
    )

    if (!sellerShipment) {
      return res.status(404).json({
        success: false,
        message: 'Seller shipment not found',
      })
    }

    // Cancel the seller's shipment
    if (
      !['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(sellerShipment.status)
    ) {
      sellerShipment.status = 'cancelled'
      sellerShipment.cancelledAt = new Date()
    }

    // Update order status based on all shipments
    recalcOrderStatus(order)
    order.markModified('sellerShipments')
    await order.save()

    // Update SLA tracking after cancellation
    try {
      const { updateSLATrackingForOrder } = await import('../utils/slaTrackingHooks')
      await updateSLATrackingForOrder(order._id as mongoose.Types.ObjectId)
    } catch (error) {
      console.error('[SLA Tracking] Failed to update SLA tracking:', error)
    }

    // Restore stock for items belonging to this seller's shipment
    const sellerItems = order.items.filter(
      (item) => item.seller?.toString() === seller._id.toString(),
    )
    await restoreOrderStock(sellerItems)

    // Create database notification for customer about order cancellation
    try {
      const Notification = (await import('../models/Notification')).default
      const userId = (order.user as any)?._id?.toString() || (order.user as any)?.toString()
      if (userId) {
        const orderId = (order as any)._id?.toString?.() || String(order._id)
        await Notification.create({
          userId,
          title: 'Order Cancelled',
          message: `Your order ${order.orderNumber} has been cancelled.`,
          type: 'order',
          read: false,
          link: `/profile/orders?orderId=${orderId}`,
        })
        console.log(
          `[Notification] Created order cancellation notification for customer ${userId} for order ${order.orderNumber}`,
        )
      }
    } catch (error) {
      console.error('[Notification] Failed to create cancellation notification:', error)
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: normalizeSellerShipment(sellerShipment),
    })
  } catch (error: any) {
    console.error('Error cancelling seller order:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while cancelling order',
    })
  }
}

// Search orders for the authenticated seller by order ID or order number
export const searchMyOrders = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { q } = req.query

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      return res.json({
        success: true,
        data: [],
      })
    }

    const searchTerm = q.trim()
    const sellerObjectId = new mongoose.Types.ObjectId(sellerId)

    // Search by order ID (if it's a valid ObjectId) or order number
    const query: any = {
      'sellerShipments.seller': sellerObjectId,
    }

    if (mongoose.Types.ObjectId.isValid(searchTerm)) {
      // Search by order ID
      query._id = new mongoose.Types.ObjectId(searchTerm)
    } else {
      // Search by order number (partial match)
      query.orderNumber = { $regex: searchTerm, $options: 'i' }
    }

    const orders = await Order.find(query)
      .select('_id orderNumber status paymentStatus total createdAt')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean()

    const results = orders.map((order) => ({
      _id: String(order._id),
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      createdAt: order.createdAt,
      label: `${order.orderNumber} (${order.status}) - ₹${order.total?.toFixed(2) || '0.00'}`,
    }))

    return res.json({
      success: true,
      data: results,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to search orders'
    console.error('Error searching seller orders:', error)
    return res.status(500).json({
      success: false,
      message: errorMessage,
    })
  }
}
