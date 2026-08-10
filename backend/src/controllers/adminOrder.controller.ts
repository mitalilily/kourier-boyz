import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Order, {
  IOrderItem,
  IOrderSellerShipment,
  OrderStatus,
  SellerShipmentStatus,
} from '../models/Order'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import Refund from '../models/Refund'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import User, { IUser } from '../models/User'
import {
  ShippingCreateShipmentRequest,
  ShippingRateRequest,
  shippingProviderService,
} from '../services/shippingProvider.service'
import { createAuditLog } from '../utils/auditLog'
import { generateInvoice } from '../utils/invoiceGenerator'
import { generateLabel } from '../utils/labelGenerator'
import { uploadToR2 } from '../utils/r2Upload'
import { buildForwardShipmentOrderNumber } from '../utils/shippingOrderNumber'
import {
  SELLER_STATUS_SET,
  addCustomerToSellers,
  canCancelOrder,
  computeSellerTotals,
  filterSellerItems,
  notifyOrderDelivered,
  notifyOrderShipped,
  recalcOrderStatus,
  updateShipmentStatus,
} from '../utils/orderStatus'
import { notifySellerLargeAdjustment, notifySellerRefund } from '../utils/sellerNotifications'
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
const toPlainObject = <T>(doc: T): T =>
  doc && typeof (doc as any).toObject === 'function'
    ? ((doc as any).toObject({ virtuals: true, flattenMaps: true }) as T)
    : (doc as T)

const toAdminOrderResponse = (order: any) => {
  const plain = toPlainObject(order)
  const sellerBreakdown = (plain.sellerShipments || []).map((shipment: IOrderSellerShipment) => {
    // Generate shareable tracking link
    const awb = shipment.shippingMeta?.awb || shipment.courierCart?.awb_number
    const trackingIdentifier = getTrackingIdentifier(awb, plain.orderNumber)
    const shareableTrackingLink = trackingIdentifier
      ? generateTrackingUrl(trackingIdentifier)
      : null

    return {
      ...shipment,
      seller: shipment.seller,
      shareableTrackingLink,
      // Explicitly include shippingMeta and courierCart to ensure they're in the response
      shippingMeta: shipment.shippingMeta || null,
      courierCart: shipment.courierCart || null,
      trackingEvents: shipment.trackingEvents || [],
      // Explicitly include invoice and label for shipment-level access
      invoice: shipment.invoice || null,
      label: shipment.label || null,
    }
  })

  // Calculate COD charges if payment method is COD
  // COD charges can be at order level or summed from seller shipments
  let codCharges = 0
  if (plain.paymentMethod === 'cod') {
    // Check order-level COD charge first
    codCharges = plain.codCharge || 0
    // If not found, sum from seller shipments
    if (codCharges === 0 && plain.sellerShipments) {
      codCharges = plain.sellerShipments.reduce((sum: number, shipment: any) => {
        return sum + (shipment.codCharge || 0)
      }, 0)
    }
    // Fallback to sellerCodFee if available
    if (codCharges === 0) {
      codCharges = plain.sellerCodFee || 0
    }
  }

  // Get estimated delivery date from first shipment
  const estimatedDeliveryDate =
    plain.sellerShipments?.[0]?.shippingMeta?.estimated_delivery_date ||
    plain.sellerShipments?.[0]?.courierCart?.estimated_delivery_date

  // Create timeline from order status changes if not available
  let timeline = plain.timeline || []
  if (!timeline || timeline.length === 0) {
    timeline = [
      {
        status: 'Order Placed',
        timestamp: plain.createdAt,
        message: 'Order was placed',
      },
    ]
    if (plain.updatedAt && plain.updatedAt !== plain.createdAt) {
      timeline.push({
        status: plain.status,
        timestamp: plain.updatedAt,
        message: `Status updated to ${plain.status}`,
      })
    }
  }

  return {
    _id: plain._id,
    orderNumber: plain.orderNumber,
    buyer: {
      name: plain.shippingAddress?.name,
      phone: plain.shippingAddress?.phone,
      email: plain.user?.email,
    },
    user: plain.user?._id || plain.user, // Include user ID for admin operations
    status: plain.status,
    paymentStatus: plain.paymentStatus,
    paymentMethod: plain.paymentMethod,
    subtotal: plain.subtotal,
    total: plain.total,
    discount: plain.discount,
    discountAmount: plain.discountAmount,
    shipping: plain.shipping,
    tax: plain.tax,
    codCharges,
    orderedAt: plain.createdAt,
    sellerShipments: sellerBreakdown,
    shippingAddress: plain.shippingAddress,
    items: plain.items,
    invoice: plain.invoice,
    label: plain.label,
    coupon: plain.coupon,
    couponCode: plain.coupon?.code || plain.couponCode,
    discountType: plain.coupon?.discountType,
    deliveryInstructions: plain.deliveryInstructions,
    estimatedDeliveryDate,
    settlementStatus: plain.settlementStatus,
    orderSource: plain.orderSource || 'web', // Default to 'web' if not specified
    notes: plain.notes || plain.adminNotes,
    timeline,
  }
}

const findOrder = async (orderId: string) => {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('ORDER_NOT_FOUND')
  }

  // Check if orderId is a valid ObjectId
  const isObjectId = mongoose.Types.ObjectId.isValid(orderId)

  let order = null
  try {
    if (isObjectId) {
      // Try to find by ObjectId first
      order = await Order.findById(orderId)
        .populate('items.product', 'name slug mainImage sku images')
        .populate('items.variant', 'name sku mainImage images attributes')
        .populate('items.seller', 'name businessName')
        .populate('sellerShipments.seller', 'name businessName storeSlug supportEmail storePhone')
        .populate('user', '_id name email')
        .populate('coupon', 'code discountType')
    }

    // If not found by ObjectId, or if it's not a valid ObjectId, try finding by orderNumber
    if (!order) {
      order = await Order.findOne({ orderNumber: orderId })
        .populate('items.product', 'name slug mainImage sku images')
        .populate('items.variant', 'name sku mainImage images attributes')
        .populate('items.seller', 'name businessName')
        .populate('sellerShipments.seller', 'name businessName storeSlug supportEmail storePhone')
        .populate('user', '_id name email')
        .populate('coupon', 'code discountType')
    }
  } catch (error: any) {
    console.error('[findOrder] Error finding order:', {
      orderId,
      isObjectId,
      error: error.message,
      stack: error.stack,
    })
    throw new Error('ORDER_NOT_FOUND')
  }

  if (!order) {
    throw new Error('ORDER_NOT_FOUND')
  }
  return order
}

export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    const {
      status,
      paymentStatus,
      seller,
      fromDate,
      toDate,
      search,
      page = 1,
      limit = 20,
    } = req.query

    const query: any = {}

    if (status && typeof status === 'string') {
      query.status = status
    }

    if (paymentStatus && typeof paymentStatus === 'string') {
      query.paymentStatus = paymentStatus
    }

    if (seller && typeof seller === 'string' && mongoose.Types.ObjectId.isValid(seller)) {
      query['sellerShipments.seller'] = new mongoose.Types.ObjectId(seller)
    }

    if (fromDate || toDate) {
      query.createdAt = {}
      if (fromDate) query.createdAt.$gte = new Date(fromDate as string)
      if (toDate) query.createdAt.$lte = new Date(toDate as string)
    }

    if (search && typeof search === 'string') {
      const regex = new RegExp(search, 'i')
      const conditions: any[] = [{ orderNumber: regex }, { 'shippingAddress.name': regex }]
      if (mongoose.Types.ObjectId.isValid(search)) {
        conditions.push({ _id: new mongoose.Types.ObjectId(search) })
      }
      query.$or = conditions
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('sellerShipments.seller', 'name businessName storeSlug')
        .populate('user', '_id name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(query),
    ])

    return res.json({
      success: true,
      data: orders.map(toAdminOrderResponse),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error fetching admin orders:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders',
    })
  }
}

export const getCustomerOrders = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params
    const { status, paymentStatus, fromDate, toDate, search, page = 1, limit = 20 } = req.query

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID',
      })
    }

    const query: any = {
      user: new mongoose.Types.ObjectId(customerId),
    }

    if (status && typeof status === 'string') {
      query.status = status
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

    const skip = (Number(page) - 1) * Number(limit)
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('items.product', 'name slug mainImage sku')
        .populate('items.variant', 'name sku')
        .populate('sellerShipments.seller', 'name businessName storeSlug')
        .populate('user', '_id name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(query),
    ])

    return res.json({
      success: true,
      data: orders.map(toAdminOrderResponse),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error fetching customer orders:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch customer orders',
    })
  }
}

export const getAdminOrderDetail = async (req: Request, res: Response) => {
  try {
    const order = await findOrder(req.params.id)
    return res.json({
      success: true,
      data: toAdminOrderResponse(order),
    })
  } catch (error: any) {
    return res.status(error.message === 'ORDER_NOT_FOUND' ? 404 : 500).json({
      success: false,
      message: error.message === 'ORDER_NOT_FOUND' ? 'Order not found' : error.message,
    })
  }
}

export const updateAdminOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { status }: { status: OrderStatus } = req.body

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' })
    }

    const order = await findOrder(id)
    const previousStatus = order.status
    order.status = status

    // Map order status to appropriate shipment status
    const orderToShipmentStatusMap: Record<OrderStatus, SellerShipmentStatus | null> = {
      pending: 'pending',
      confirmed: 'processing',
      processing: 'processing',
      ready_to_ship: 'pickup_requested',
      shipped: 'shipped',
      in_transit: 'in_transit',
      out_for_delivery: 'out_for_delivery',
      delivered: 'delivered',
      cancelled: 'cancelled',
      refunded: null, // Don't change shipment status for refunded orders
    }

    const targetShipmentStatus = orderToShipmentStatusMap[status]

    if (status === 'cancelled') {
      // For cancelled, only cancel shipments that haven't been shipped yet
      order.sellerShipments.forEach((shipment) => {
        if (!['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(shipment.status)) {
          shipment.status = 'cancelled'
          shipment.cancelledAt = new Date()
        }
      })
      order.markModified('sellerShipments')
    } else if (targetShipmentStatus && status !== 'refunded') {
      // For other statuses, update all shipments to match (only forward transitions)
      const statusSequence: SellerShipmentStatus[] = [
        'pending',
        'processing',
        'pickup_requested',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
      ]

      const targetIndex = statusSequence.indexOf(targetShipmentStatus)

      order.sellerShipments.forEach((shipment) => {
        // Skip if already cancelled (unless we're explicitly setting to cancelled)
        if (shipment.status === 'cancelled' && (status as string) !== 'cancelled') {
          return
        }

        const currentIndex = statusSequence.indexOf(shipment.status as SellerShipmentStatus)
        // Only update if target status is forward from current status
        if (targetIndex >= currentIndex || currentIndex === -1) {
          const now = new Date()

          // Update status
          shipment.status = targetShipmentStatus

          // Set appropriate timestamps
          switch (targetShipmentStatus) {
            case 'pickup_requested':
              shipment.readyToShipAt = shipment.readyToShipAt || now
              shipment.inventoryPacked = true
              shipment.inventoryPackedAt = shipment.inventoryPackedAt || now
              break
            case 'shipped':
              shipment.shippedAt = shipment.shippedAt || now
              shipment.inventoryPacked = true
              shipment.inventoryPackedAt = shipment.inventoryPackedAt || now
              break
            case 'in_transit':
              shipment.shippedAt = shipment.shippedAt || now
              shipment.inventoryPacked = true
              shipment.inventoryPackedAt = shipment.inventoryPackedAt || now
              break
            case 'out_for_delivery':
              shipment.shippedAt = shipment.shippedAt || now
              shipment.inventoryPacked = true
              shipment.inventoryPackedAt = shipment.inventoryPackedAt || now
              break
            case 'delivered':
              shipment.deliveredAt = shipment.deliveredAt || now
              shipment.inventoryPacked = true
              shipment.inventoryPackedAt = shipment.inventoryPackedAt || now
              break
            case 'processing':
              shipment.inventoryPacked = false
              break
            case 'pending':
              shipment.inventoryPacked = false
              break
          }

          // Update item statuses for this shipment
          const sellerId = shipment.seller?.toString() || shipment.seller?.toString()
          if (sellerId) {
            order.items.forEach((item) => {
              if (item.seller?.toString() === sellerId) {
                item.sellerStatus = targetShipmentStatus
              }
            })
          }
        }
      })

      order.markModified('sellerShipments')
      order.markModified('items')
    }

    await order.save()

    // Send notifications when status changes to shipped or delivered
    if (status === 'shipped' && previousStatus !== 'shipped') {
      // For shipped status, notify for the first shipment (or all shipments)
      // Use the first shipment that is actually shipped
      const shippedShipment = order.sellerShipments.find(
        (shipment) => shipment.status === 'shipped',
      )
      if (shippedShipment) {
        void notifyOrderShipped(order, shippedShipment)
      }
    } else if (status === 'delivered' && previousStatus !== 'delivered') {
      // For delivered status, send notification to buyer
      void notifyOrderDelivered(order)
      // Also add customer to sellers (if not returned)
      void addCustomerToSellers(order)
    } else if (status === 'delivered') {
      // If status was already delivered but we're re-saving, still add customer to sellers
      void addCustomerToSellers(order)
    }

    return res.json({
      success: true,
      data: toAdminOrderResponse(order),
    })
  } catch (error: any) {
    const statusCode = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update order status',
    })
  }
}

export const updateAdminPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { paymentStatus }: { paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' } =
      req.body

    if (!paymentStatus) {
      return res.status(400).json({ success: false, message: 'Payment status is required' })
    }

    const validStatuses = ['pending', 'paid', 'failed', 'refunded']
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid payment status' })
    }

    const order = await findOrder(id)
    order.paymentStatus = paymentStatus

    await order.save()

    return res.json({
      success: true,
      data: toAdminOrderResponse(order),
    })
  } catch (error: any) {
    const statusCode = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update payment status',
    })
  }
}

export const updateAdminSellerShipmentStatus = async (req: Request, res: Response) => {
  try {
    const { id, shipmentId } = req.params
    const { status }: { status: SellerShipmentStatus } = req.body

    if (!status || !SELLER_STATUS_SET.has(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' })
    }

    const order = await findOrder(id)
    const shipment = order.sellerShipments.find((entry) => entry._id?.toString() === shipmentId) as
      | IOrderSellerShipment
      | undefined
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    const previousStatus = shipment.status
    updateShipmentStatus(order, shipment, status)
    recalcOrderStatus(order)
    await order.save()

    // Send notifications if status changed to 'shipped'
    if (status === 'shipped' && previousStatus !== 'shipped') {
      void notifyOrderShipped(order, shipment)
    }

    return res.json({
      success: true,
      data: toAdminOrderResponse(order),
    })
  } catch (error: any) {
    const statusCode =
      error.message === 'INVALID_STATUS_TRANSITION'
        ? 400
        : error.message === 'ORDER_NOT_FOUND'
        ? 404
        : 500
    return res.status(statusCode).json({
      success: false,
      message:
        error.message === 'INVALID_STATUS_TRANSITION'
          ? 'Status transition not allowed'
          : error.message || 'Failed to update shipment',
    })
  }
}

export const regenerateSellerShipmentLabel = async (req: Request, res: Response) => {
  try {
    const { id, shipmentId } = req.params
    const order = await findOrder(id)
    const shipment = order.sellerShipments.find((entry) => entry._id?.toString() === shipmentId) as
      | IOrderSellerShipment
      | undefined
    if (!shipment?.courierCart?.order_id) {
      return res.status(400).json({
        success: false,
        message: 'Shipment not booked yet',
      })
    }

    const label = await shippingProviderService.getLabel(shipment.courierCart.order_id)
    if (label?.data?.label_url) {
      shipment.shippingMeta = shipment.shippingMeta || {}
      shipment.shippingMeta.label = label.data.label_url
      order.markModified('sellerShipments')
      await order.save()
    }

    return res.json({
      success: true,
      data: label.data,
    })
  } catch (error: any) {
    return res.status(error.message === 'ORDER_NOT_FOUND' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to regenerate label',
    })
  }
}

interface AdminManualRefundBody {
  refundAmount: number
  refundReason: string
  refundSource: 'PLATFORM' | 'SELLER'
  refundMethod: 'MANUAL_UPI' | 'MANUAL_BANK'
  referenceNumber: string
  refundDate?: string
  adminNote?: string
}

export const createManualRefund = async (req: Request, res: Response) => {
  // Retry logic for transient transaction errors
  const maxRetries = 3
  let lastError: any = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const session = await mongoose.startSession()
    try {
      const { id } = req.params
      const {
        refundAmount,
        refundReason,
        refundSource,
        refundMethod,
        referenceNumber,
        refundDate,
        adminNote,
      } = req.body as AdminManualRefundBody

      if (!refundAmount || refundAmount <= 0) {
        await session.endSession()
        return res.status(400).json({
          success: false,
          message: 'refundAmount must be greater than 0',
        })
      }
      if (!refundReason || typeof refundReason !== 'string') {
        await session.endSession()
        return res.status(400).json({
          success: false,
          message: 'refundReason is required',
        })
      }
      if (!referenceNumber || typeof referenceNumber !== 'string') {
        await session.endSession()
        return res.status(400).json({
          success: false,
          message: 'referenceNumber (UTR / bank reference) is required',
        })
      }
      if (!['PLATFORM', 'SELLER'].includes(refundSource)) {
        await session.endSession()
        return res.status(400).json({
          success: false,
          message: 'refundSource must be PLATFORM or SELLER',
        })
      }
      if (!['MANUAL_UPI', 'MANUAL_BANK'].includes(refundMethod)) {
        await session.endSession()
        return res.status(400).json({
          success: false,
          message: 'refundMethod must be MANUAL_UPI or MANUAL_BANK',
        })
      }

      // Check for existing refund outside transaction to avoid conflicts
      const existingRef = await Refund.findOne({ referenceNumber }).lean()
      if (existingRef) {
        await session.endSession()
        return res.status(400).json({
          success: false,
          message: 'A refund with this referenceNumber already exists',
        })
      }

      // Read order outside transaction first to avoid long locks
      const order = await Order.findById(id)
        .populate('items.seller')
        .populate('sellerShipments.seller')
        .lean()
      if (!order) {
        await session.endSession()
        return res.status(404).json({ success: false, message: 'Order not found' })
      }

      const paidAmount = (order as any).total ?? 0
      const orderId =
        typeof order._id === 'string' ? new mongoose.Types.ObjectId(order._id) : order._id

      // Calculate existing refunds outside transaction to avoid conflicts
      const existingRefundDebits = await SellerLedgerEntry.aggregate([
        {
          $match: {
            order: orderId,
            entryType: 'DEBIT',
            reason: { $in: ['REFUND_ITEM', 'REFUND_SHIPPING', 'REFUND_COD', 'REFUND_GST'] },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ])

      const alreadyRefunded = existingRefundDebits[0]?.total ?? 0
      const maxRefundable = Math.max(0, paidAmount - alreadyRefunded)

      if (refundAmount > maxRefundable + 0.01) {
        await session.endSession()
        return res.status(400).json({
          success: false,
          message: 'Refund amount exceeds maximum refundable amount for this order',
          data: {
            paidAmount,
            alreadyRefunded,
            maxRefundable,
          },
        })
      }

      const refundDateValue = refundDate ? new Date(refundDate) : new Date()

      const adminId = req.user?.userId ? new mongoose.Types.ObjectId(req.user.userId) : undefined
      if (!adminId) {
        await session.endSession()
        return res.status(401).json({ success: false, message: 'Not authenticated as admin' })
      }

      const adminIp = (req.headers['x-forwarded-for'] as string) || req.ip

      session.startTransaction()

      // Re-fetch order within transaction for consistency
      const orderInTx = await Order.findById(orderId).session(session)
      if (!orderInTx) {
        await session.abortTransaction()
        await session.endSession()
        return res.status(404).json({ success: false, message: 'Order not found' })
      }

      const refundDoc = await Refund.create(
        [
          {
            order: orderId,
            refundAmount,
            refundReason,
            refundSource,
            refundMethod,
            referenceNumber,
            refundDate: refundDateValue,
            initiatedByAdmin: adminId,
            adminNote: adminNote || undefined,
            adminIp,
          },
        ],
        { session },
      )

      const refund = refundDoc[0]

      const ratio = paidAmount > 0 ? refundAmount / paidAmount : 0
      const originalIgst =
        (order.items || []).reduce(
          (sum, item: any) => sum + (item.igst || 0) * (item.quantity || 1),
          0,
        ) || 0
      const originalCgst =
        (order.items || []).reduce(
          (sum, item: any) => sum + (item.cgst || 0) * (item.quantity || 1),
          0,
        ) || 0
      const originalSgst =
        (order.items || []).reduce(
          (sum, item: any) => sum + (item.sgst || 0) * (item.quantity || 1),
          0,
        ) || 0

      const igstRefund = Math.round(originalIgst * ratio * 100) / 100
      const cgstRefund = Math.round(originalCgst * ratio * 100) / 100
      const sgstRefund = Math.round(originalSgst * ratio * 100) / 100

      const shippingFee = (order as any).shipping ?? 0
      const codFee = 0
      const itemComponent = Math.max(0, refundAmount - shippingFee - codFee)

      // Get seller ID from order - try multiple sources
      // Note: seller might be populated (User object) or unpopulated (ObjectId)
      let sellerIdRaw: any = order.sellerShipments?.[0]?.seller
      if (!sellerIdRaw && order.items && order.items.length > 0) {
        // Fallback: get seller from first order item
        sellerIdRaw = (order.items[0] as any).seller
      }

      // Extract seller ID - handle both populated (object with _id) and unpopulated (ObjectId) cases
      let sellerId: mongoose.Types.ObjectId | null = null
      if (sellerIdRaw) {
        if (sellerIdRaw instanceof mongoose.Types.ObjectId) {
          sellerId = sellerIdRaw
        } else if (sellerIdRaw._id) {
          // Populated User object
          sellerId =
            sellerIdRaw._id instanceof mongoose.Types.ObjectId
              ? sellerIdRaw._id
              : new mongoose.Types.ObjectId(String(sellerIdRaw._id))
        } else if (
          typeof sellerIdRaw === 'string' &&
          mongoose.Types.ObjectId.isValid(sellerIdRaw)
        ) {
          sellerId = new mongoose.Types.ObjectId(sellerIdRaw)
        }
      }

      // CRITICAL: Check if order is already in a settlement batch
      // If order is already settled, we MUST NOT modify the existing batch.
      // New refund ledger entries will be picked up in the next settlement cycle.
      const orderSettlementBatch = (order as any).settlementBatch

      // IMPORTANT RULES:
      // 1. NEVER modify existing settlement batches
      // 2. NEVER edit or delete past ledger entries
      // 3. Always create NEW ledger entries with referenceId linking to refund
      // 4. Leave settlementBatch as null - let settlement aggregation handle it
      // 5. If settlement is unpaid: new entries may be included in open batch
      // 6. If settlement is paid: seller ledger becomes negative, adjusted in next cycle

      const ledgerEntries: any[] = []

      if (refundSource === 'SELLER') {
        if (!sellerId) {
          return res.status(400).json({
            success: false,
            message: 'Cannot create seller refund: Order seller not found',
          })
        }
        const sellerObjectId = sellerId
        const orderNumber = (order as any).orderNumber || String(orderId)
        if (itemComponent > 0) {
          ledgerEntries.push({
            seller: sellerObjectId,
            order: orderId,
            entryType: 'DEBIT',
            reason: 'REFUND_ITEM',
            amount: itemComponent,
            description: `Item refund for order #${orderNumber}`,
            referenceId: refund._id,
            // settlementBatch: null (explicitly not set - will be picked up by next settlement cycle)
          })
        }
        if (shippingFee > 0) {
          const shippingRefund = Math.min(refundAmount - itemComponent, shippingFee)
          if (shippingRefund > 0) {
            ledgerEntries.push({
              seller: sellerObjectId,
              order: orderId,
              entryType: 'DEBIT',
              reason: 'REFUND_SHIPPING',
              amount: shippingRefund,
              description: `Shipping refund for order #${orderNumber}`,
              referenceId: refund._id,
              // settlementBatch: null (explicitly not set - will be picked up by next settlement cycle)
            })
          }
        }
        if (codFee > 0) {
          ledgerEntries.push({
            seller: sellerObjectId,
            order: orderId,
            entryType: 'DEBIT',
            reason: 'REFUND_COD',
            amount: codFee,
            description: `COD fee refund for order #${orderNumber}`,
            referenceId: refund._id,
            // settlementBatch: null (explicitly not set - will be picked up by next settlement cycle)
          })
        }
        const totalGstRefund = igstRefund + cgstRefund + sgstRefund
        if (totalGstRefund > 0) {
          ledgerEntries.push({
            seller: sellerObjectId,
            order: orderId,
            entryType: 'DEBIT',
            reason: 'REFUND_GST',
            amount: totalGstRefund,
            description: `GST component refund for order #${orderNumber}`,
            referenceId: refund._id,
            // settlementBatch: null (explicitly not set - will be picked up by next settlement cycle)
          })
        }
      } else if (refundSource === 'PLATFORM') {
        // Platform refunds don't create seller ledger entries
        // They are tracked separately in the Refund model
        // No ledger entry needed for platform-funded refunds
      }

      if (ledgerEntries.length) {
        await SellerLedgerEntry.insertMany(ledgerEntries, { session })
      }

      // If this refund makes the order fully refunded, update order + payment status
      const totalRefundedAfterThis = alreadyRefunded + refundAmount
      const isFullyRefunded =
        paidAmount > 0 && Math.abs(paidAmount - totalRefundedAfterThis) <= 0.01

      if (isFullyRefunded) {
        ;(orderInTx as any).status = 'refunded'
        ;(orderInTx as any).paymentStatus = 'refunded'
        await orderInTx.save({ session })
      }

      // Commit transaction first - credit note generation can happen outside transaction
      // This prevents write conflicts and transaction timeouts
      await session.commitTransaction()
      await session.endSession()

      // Generate Credit Note for the refund (if not already generated)
      // Do this AFTER transaction commit to avoid write conflicts
      try {
        // Re-fetch refund to ensure we have the latest version
        const latestRefund = await Refund.findById(refund._id)
        if (!latestRefund) {
          console.error('Refund not found after transaction commit:', refund._id)
          return res.json({
            success: true,
            data: {
              refund,
              paidAmount,
              alreadyRefunded,
              maxRefundable,
              isFullyRefunded,
            },
            message: 'Manual refund recorded successfully',
          })
        }

        // Check if credit note already exists
        if ((latestRefund as any).creditNote?.credit_note_url) {
          console.log('Credit note already exists for refund:', refund._id)
          return res.json({
            success: true,
            data: {
              refund: latestRefund,
              paidAmount,
              alreadyRefunded,
              maxRefundable,
              isFullyRefunded,
            },
            message: 'Manual refund recorded successfully',
          })
        }

        // Populate order with necessary data for invoice generation
        const populatedOrder = await Order.findById(orderId)
          .populate('user', '_id name email')
          .populate('items.product', 'name images mainImage')
          .populate('items.variant', 'name sku images')
          .populate(
            'items.seller',
            'name email businessName storeLogo sellerAgreementSignature authorizedPersonName authorizedPersonDesignation storeDescription gstNumber state',
          )

        if (populatedOrder) {
          const invoiceData = {
            order: {
              ...populatedOrder.toObject(),
              subtotal: refundAmount,
              total: refundAmount,
              tax: igstRefund + cgstRefund + sgstRefund,
              shipping: shippingFee,
              discount: 0,
            } as any,
            customer: populatedOrder.user as any,
            seller:
              (populatedOrder.items[0] as any)?.seller ||
              populatedOrder.sellerShipments?.[0]?.seller,
            items: populatedOrder.items.map((item: any) => ({
              product: item.product,
              variant: item.variant,
              orderItem: {
                ...item.toObject(),
                // Adjust item amounts proportionally based on refund ratio
                price: item.price,
                effectivePrice: item.effectivePrice,
                subtotal: (item.subtotal || item.price * item.quantity) * ratio,
                tax:
                  ((item.igst || 0) + (item.cgst || 0) + (item.sgst || 0)) * ratio * item.quantity,
                total:
                  ((item.subtotal || item.price * item.quantity) +
                    ((item.igst || 0) + (item.cgst || 0) + (item.sgst || 0)) * item.quantity) *
                  ratio,
                igst: (item.igst || 0) * ratio,
                cgst: (item.cgst || 0) * ratio,
                sgst: (item.sgst || 0) * ratio,
                quantity: item.quantity,
              },
            })),
            audience: 'buyer' as const,
          }

          // Generate credit note (respects all invoice settings: currency, date format, rounding, etc.)
          const creditNote = await generateInvoice(invoiceData, 'CREDIT_NOTE', refundDateValue)

          // Store credit note in refund document (outside transaction)
          ;(latestRefund as any).creditNote = {
            credit_note_id: creditNote.invoice_id,
            credit_note_url: creditNote.invoice_url,
            credit_note_number: creditNote.invoice_number,
            generated_at: new Date(),
            hsnSummary: creditNote.hsnSummary,
          }
          await latestRefund.save()

          console.log(
            `✅ Credit Note ${creditNote.invoice_number} generated for Manual Refund ${latestRefund._id}`,
          )
        }
      } catch (creditNoteError) {
        console.error('❌ Error generating Credit Note for manual refund:', creditNoteError)
        // Don't fail the refund operation if credit note generation fails
        // The refund has already been committed successfully
      }

      // AUDIT LOG: Record who issued the refund (NON-NEGOTIABLE)
      try {
        await createAuditLog({
          action: 'REFUND_ISSUED',
          performedBy: String(adminId),
          req,
          entityType: 'REFUND',
          entityId: String(refund._id),
          metadata: {
            refundId: String(refund._id),
            orderId: String(orderId),
            orderNumber: (order as any).orderNumber,
            refundAmount,
            refundReason,
            refundSource,
            referenceNumber,
            refundMethod,
            refundDate: refundDateValue.toISOString(),
            adminNote: adminNote || undefined,
            isFullyRefunded,
          },
        })
      } catch (auditError) {
        // Log but don't fail the refund operation
        console.error('Failed to create audit log for refund:', auditError)
      }

      // NOTIFY SELLER: Only notify if refund affects seller balance (SELLER-funded refunds)
      if (refundSource === 'SELLER' && sellerId) {
        try {
          await notifySellerRefund(
            sellerId,
            (order as any).orderNumber || String(orderId),
            refundAmount,
            String(orderId),
          )

          // Check for negative balance after refund
          const allEntries = await SellerLedgerEntry.find({
            seller: sellerId,
            reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
          }).lean()

          let balance = 0
          allEntries.forEach((entry: any) => {
            const amount = Number(entry.amount) || 0
            if (entry.entryType === 'CREDIT') {
              balance += amount
            } else if (entry.entryType === 'DEBIT') {
              balance -= amount
            }
          })

          // Notify if balance becomes negative
          if (balance < 0) {
            const { notifySellerNegativeBalance } = await import('../utils/sellerNotifications')
            await notifySellerNegativeBalance(sellerId, balance)
          }

          // Check if this is a large refund and send email
          await notifySellerLargeAdjustment(
            sellerId,
            refundAmount,
            'refund',
            `Refund for order ${(order as any).orderNumber || String(orderId)}`,
            5000, // Threshold: ₹5,000
          )
        } catch (notifyError) {
          // Log but don't fail the refund operation
          console.error('Failed to notify seller about refund:', notifyError)
        }
      }

      // If we get here, transaction succeeded - break retry loop
      return res.json({
        success: true,
        data: {
          refund,
          paidAmount,
          alreadyRefunded,
          maxRefundable,
          isFullyRefunded,
        },
        message: 'Manual refund recorded successfully',
      })

      // If we get here, transaction succeeded - break retry loop
      break
    } catch (error: any) {
      await session.abortTransaction()
      await session.endSession()
      lastError = error

      // Check if it's a transient transaction error that we should retry
      const isTransientError =
        error.code === 112 || // WriteConflict
        error.codeName === 'WriteConflict' ||
        (error.errorLabels && error.errorLabels.includes('TransientTransactionError'))

      if (isTransientError && attempt < maxRetries - 1) {
        // Exponential backoff: wait 50ms, 100ms, 200ms
        const delay = 50 * Math.pow(2, attempt)
        console.warn(
          `WriteConflict on attempt ${attempt + 1}/${maxRetries}, retrying after ${delay}ms...`,
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue // Retry
      }

      // Not a transient error, or max retries reached
      console.error('Error creating manual refund:', error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create manual refund',
        ...(isTransientError && {
          retryable: true,
          message: 'Transaction conflict occurred. Please try again.',
        }),
      })
    }
  }

  // If we exhausted all retries
  if (lastError) {
    console.error('Failed to create manual refund after all retries:', lastError)
    return res.status(500).json({
      success: false,
      message: 'Failed to create manual refund after multiple attempts. Please try again.',
    })
  }
}

export const getOrderRefunds = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      })
    }

    const refunds = await Refund.find({ order: id })
      .populate('initiatedByAdmin', 'name email')
      .select('+creditNote') // Include creditNote field
      .sort({ refundDate: -1, createdAt: -1 })
      .lean()

    return res.json({
      success: true,
      data: refunds,
    })
  } catch (error: any) {
    console.error('Error fetching order refunds:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order refunds',
    })
  }
}

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const order = await findOrder(id)

    // Check if order can be cancelled
    const { canCancel, reason } = canCancelOrder(order)
    if (!canCancel) {
      return res.status(400).json({
        success: false,
        message: reason || 'Order cannot be cancelled',
      })
    }

    order.status = 'cancelled'
    order.sellerShipments.forEach((shipment) => {
      if (!['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(shipment.status)) {
        shipment.status = 'cancelled'
        shipment.cancelledAt = new Date()
      }
    })
    order.markModified('sellerShipments')
    await order.save()

    // Restore stock for all items in the order
    await restoreOrderStock(order.items)

    return res.json({
      success: true,
      data: toAdminOrderResponse(order),
    })
  } catch (error: any) {
    return res.status(error.message === 'ORDER_NOT_FOUND' ? 404 : 500).json({
      success: false,
      message: error.message || 'Failed to cancel order',
    })
  }
}

// Helper to fetch seller
const fetchSeller = async (sellerId: string) => {
  const seller = await User.findById(sellerId)
  if (!seller) {
    throw new Error('Seller profile not found')
  }
  return seller
}

// Helper to pick seller address
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
            address?.courierCartPickupAddressId &&
            String(address.courierCartPickupAddressId) === preferredId,
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

// Get shipping rates for admin
export const getAdminShipmentRates = async (req: Request, res: Response) => {
  try {
    const { id, shipmentId } = req.params
    const { weight, dimensions } = req.body as {
      weight: number
      dimensions?: { length: number; width: number; height: number }
    }

    if (!weight || weight <= 0) {
      return res.status(400).json({ success: false, message: 'Package weight is required' })
    }

    const order = await findOrder(id)
    const shipment = order.sellerShipments.find((entry) => entry._id?.toString() === shipmentId) as
      | IOrderSellerShipment
      | undefined

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    const sellerId = shipment.seller?._id?.toString() || shipment.seller?.toString()
    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Seller not found for shipment' })
    }

    const seller = await fetchSeller(sellerId)
    const destinationPincode = order.shippingAddress?.postalCode
    if (!destinationPincode) {
      return res.status(400).json({ success: false, message: 'Order address incomplete' })
    }

    const address = pickSellerAddress(seller)
    if (!address) {
      return res.status(400).json({ success: false, message: 'Seller pickup address missing' })
    }

    const sellerItems = order.items.filter((item) => item.seller?.toString() === sellerId)
    const sellerTotals = computeSellerTotals(sellerItems)

    const payload: ShippingRateRequest = {
      destination: destinationPincode,
      payment_type: order.paymentMethod === 'cod' ? 'cod' : 'prepaid',
      order_amount: sellerTotals.itemSubtotal,
      weight: weight,
      length: dimensions?.length || 10,
      breadth: dimensions?.width || 10,
      height: dimensions?.height || 10,
      shipment_type: 'b2c',
    }

    if (address.courierCartPickupAddressId) {
      payload.pickup_id = address.courierCartPickupAddressId
    } else {
      payload.origin = address.postalCode
    }

    const rates = await shippingProviderService.getRates(payload)
    const pickupAddressSnapshot = address ? JSON.parse(JSON.stringify(address)) : null

    return res.json({
      success: true,
      data: {
        rates: rates?.data?.rates || (Array.isArray(rates.data) ? rates.data : []),
        pickupAddress: pickupAddressSnapshot,
      },
    })
  } catch (error: any) {
    const statusCode = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch rates',
    })
  }
}

// Request pickup for admin (creates shipment with courier)
export const adminRequestPickup = async (req: Request, res: Response) => {
  try {
    const { id, shipmentId } = req.params
    const {
      package: packageInput,
      courierId,
      providerCode,
      pickupAddressId,
      pickupDate,
      pickupTime,
      estimatedCharge,
    } = req.body as {
      package: {
        weight: number
        length: number
        width: number
        height: number
      }
      courierId: number
      providerCode?: string
      pickupAddressId?: string
      pickupDate?: string
      pickupTime?: string
      estimatedCharge?: number
    }

    if (!packageInput || !courierId) {
      return res.status(400).json({
        success: false,
        message: 'Package details and courier are required',
      })
    }

    const order = await Order.findById(id)
      .populate('items.product', 'name sku weight shippingDimensions')
      .populate(
        'items.variant',
        'name sku attributes price comparePrice costPrice weight dimensions images mainImage status isDefault stock',
      )
      .populate('user', 'name email phone')
      .populate('sellerShipments.seller', 'name businessName storeSlug supportEmail storePhone')

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    const shipment = order.sellerShipments.find((entry) => entry._id?.toString() === shipmentId) as
      | IOrderSellerShipment
      | undefined

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    const sellerId = shipment.seller?._id?.toString() || shipment.seller?.toString()
    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Seller not found for shipment' })
    }

    // Check if shipment is in valid state for pickup request
    if (!['pending', 'processing'].includes(shipment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Shipment must be in pending or processing status to request pickup',
      })
    }

    const seller = await fetchSeller(sellerId)
    const pickupAddress = pickSellerAddress(seller, pickupAddressId)
    if (!pickupAddress) {
      return res.status(400).json({
        success: false,
        message: 'Seller has no pickup address configured',
      })
    }

    const sellerItems = filterSellerItems(order.items, sellerId)
    const sellerTotals = computeSellerTotals(sellerItems)
    const consigneeEmail = (order.user as any)?.email

    const shipmentPayload: ShippingCreateShipmentRequest = {
      order_number: buildForwardShipmentOrderNumber({
        orderNumber: order.orderNumber,
        orderId: order._id?.toString(),
        shipmentId: shipment._id?.toString(),
      }),
      payment_type: order.paymentMethod === 'cod' ? 'cod' : 'prepaid',
      order_amount: sellerTotals.itemSubtotal,
      package_weight: packageInput.weight,
      package_length: packageInput.length,
      package_breadth: packageInput.width,
      package_height: packageInput.height,
      courier_id: courierId,
      provider_code: providerCode,
      consignee: {
        name: order.shippingAddress?.name || 'Customer',
        company_name: order.shippingAddress?.name,
        address: order.shippingAddress?.addressLine1,
        address_2: order.shippingAddress?.addressLine2,
        city: order.shippingAddress?.city,
        state: order.shippingAddress?.state,
        pincode: order.shippingAddress?.postalCode,
        phone: order.shippingAddress?.phone,
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
      invoice_number: order.orderNumber,
      invoice_date: order.createdAt?.toISOString?.().slice(0, 10),
      invoice_amount: sellerTotals.itemSubtotal,
      shipping_charges: order.shipping,
      discount: order.discount,
      gift_wrap: order.giftWrap ? 1 : 0,
      cod_charges:
        order.paymentMethod === 'cod' ? Math.round(sellerTotals.itemSubtotal * 0.02) : undefined,
      request_auto_pickup: 'yes',
      company: {
        name: seller.businessName || seller.name,
        gst: seller.gstNumber,
      },
      warehouse_id: pickupAddress.courierCartPickupAddressId || undefined,
    }

    console.info('[Admin Shipmozo] createShipment request', {
      orderId: order._id?.toString(),
      shipmentId: shipment._id?.toString(),
      courierId,
    })

    const shipmentResponse = await shippingProviderService.createShipment(shipmentPayload)
    const shipmentData = shipmentResponse.data

    console.info('[Admin Shipmozo] createShipment response', {
      orderId: order._id?.toString(),
      courierCartOrderId: shipmentData?.order_id,
      awb: shipmentData?.awb_number,
    })

    // Update shipment with courier data
    shipment.package = {
      weight: packageInput.weight,
      dimensions: {
        length: packageInput.length,
        width: packageInput.width,
        height: packageInput.height,
      },
    }

    shipment.courierCart = {
      courier_id: courierId,
      order_id: shipmentData?.order_id,
      order_number: shipmentData?.order_number,
      rate: estimatedCharge,
      awb_number: shipmentData?.awb_number,
      label_url: shipmentData?.label,
      tracking_link: shipmentData?.tracking_link,
      estimated_delivery_date: undefined,
    }

    shipment.shippingMeta = {
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
    shipment.courierCharge = estimatedCharge || null
    // Calculate COD charge for this specific shipment if payment method is COD
    shipment.codCharge =
      order.paymentMethod === 'cod' ? Math.round(sellerTotals.itemSubtotal * 0.02) : null

    // Generate label
    try {
      const labelData = {
        order: order,
        shipment: shipment,
        customer: order.user as any,
        seller: seller,
        items: sellerItems.map((item) => ({
          product: item.product,
          variant: item.variant,
          quantity: item.quantity,
        })),
      }

      const labelBuffer = await generateLabel(labelData)
      const labelFileName = `labels/${order._id}-${shipment._id}-${Date.now()}.pdf`
      const labelUrl = await uploadToR2(labelBuffer, labelFileName, 'application/pdf', 'labels')
      const labelPayload = {
        label_url: labelUrl,
        generated_at: new Date(),
      }
      shipment.label = labelPayload
      order.label = labelPayload
    } catch (labelError) {
      console.error('Error generating label for shipment:', shipment._id, labelError)
    }

    // Generate invoice if not exists
    // Check lockAfterIssue setting - if invoice exists and lock is enabled, don't regenerate
    const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
    const invoiceSettings = await AdminInvoiceSettings.getSingleton()

    if (!order.invoice?.invoice_url) {
      try {
        const invoiceData = {
          order: order,
          customer: order.user as any,
          seller: seller,
          items: order.items.map((item) => ({
            product: item.product,
            variant: item.variant,
            orderItem: item,
          })),
        }

        const invoice = await generateInvoice(invoiceData)
        const invoicePayload = {
          invoice_id: invoice.invoice_id,
          invoice_url: invoice.invoice_url,
          invoice_number: invoice.invoice_number,
          generated_at: new Date(),
          hsnSummary: invoice.hsnSummary,
        }
        order.invoice = invoicePayload
      } catch (invoiceError) {
        console.error('Error generating invoice:', invoiceError)
      }
    } else if (invoiceSettings.lockAfterIssue) {
      // Invoice already exists and lock is enabled - skip regeneration
      console.log('Invoice already exists and lockAfterIssue is enabled, skipping regeneration')
    }

    updateShipmentStatus(order, shipment, 'pickup_requested')
    recalcOrderStatus(order)
    order.markModified('sellerShipments')

    await order.save()

    // Reload order with full population for response
    const updatedOrder = await findOrder(id)

    return res.json({
      success: true,
      data: toAdminOrderResponse(updatedOrder),
    })
  } catch (error: any) {
    console.error('Error requesting pickup:', error)
    const statusCode = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to request pickup',
    })
  }
}

// Track shipment for admin
export const adminTrackShipment = async (req: Request, res: Response) => {
  try {
    const { id, shipmentId } = req.params
    const order = await findOrder(id)
    const shipment = order.sellerShipments.find((entry) => entry._id?.toString() === shipmentId) as
      | IOrderSellerShipment
      | undefined

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    const awb = shipment.shippingMeta?.awb || shipment.courierCart?.awb_number
    if (!awb) {
      console.warn(`[adminTrackShipment] AWB not available for order ${id}, shipment ${shipmentId}`)
      return res.status(400).json({
        success: false,
        message: 'Shipment AWB not available',
      })
    }

    console.log(
      `[adminTrackShipment] Tracking shipment - Order: ${id}, Shipment: ${shipmentId}, AWB: ${awb}`,
    )

    const tracking = await shippingProviderService.trackShipment({ awb })

    console.log(
      `[adminTrackShipment] Full shipping provider response for AWB ${awb}:`,
      JSON.stringify(tracking, null, 2),
    )

    if (tracking?.data?.tracking_events) {
      const eventCount = tracking.data.tracking_events.length
      console.log(`[adminTrackShipment] Received ${eventCount} tracking events for AWB ${awb}`)

      shipment.trackingEvents = tracking.data.tracking_events.map((event: any) => ({
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

      if (mappedStatus && mappedStatus !== shipment.status) {
        const previousStatus = shipment.status
        console.log(
          `[adminTrackShipment] Updating shipment status from ${previousStatus} to ${mappedStatus} for AWB ${awb}`,
        )
        updateShipmentStatus(order, shipment, mappedStatus)
        recalcOrderStatus(order)
        await order.save()
        console.log(
          `[adminTrackShipment] Successfully updated order ${id} status based on tracking`,
        )

        // Note: mappedStatus from provider tracking can only be 'in_transit', 'out_for_delivery', or 'delivered'
        // 'shipped' status notifications are handled when seller/admin manually updates status to 'shipped'
      } else {
        console.log(
          `[adminTrackShipment] No status change needed - current: ${shipment.status}, courier: ${courierStatus}`,
        )
        order.markModified('sellerShipments')
        await order.save()
      }
    } else {
      console.warn(`[adminTrackShipment] No tracking events received for AWB ${awb}`)
    }

    console.log(`[adminTrackShipment] Successfully completed tracking for AWB ${awb}`)
    return res.json({
      success: true,
      data: tracking.data,
    })
  } catch (error: any) {
    const statusCode = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    console.error(
      `[adminTrackShipment] Error tracking shipment - Order: ${req.params.id}, Shipment: ${req.params.shipmentId}`,
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

// Download invoice for admin
export const adminDownloadInvoice = async (req: Request, res: Response) => {
  try {
    const { id, shipmentId } = req.params
    const order = await Order.findById(id)
      .populate('items.product', 'name slug')
      .populate('items.variant', 'name sku')
      .populate('user', 'name email phone')
      .populate('sellerShipments.seller', 'name businessName gstNumber')

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    const shipment = order.sellerShipments.find((entry) => entry._id?.toString() === shipmentId) as
      | IOrderSellerShipment
      | undefined

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    const sellerId = shipment.seller?._id?.toString() || shipment.seller?.toString()
    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Seller not found' })
    }

    const sellerItems = filterSellerItems(order.items || [], sellerId)
    const sellerTotals = computeSellerTotals(sellerItems)
    const seller = shipment.seller as unknown as IUser

    // Check lockAfterIssue - if invoice exists and lock is enabled, return existing invoice
    const AdminInvoiceSettings = (await import('../models/AdminInvoiceSettings')).default
    const invoiceSettings = await AdminInvoiceSettings.getSingleton()

    if (shipment.invoice?.invoice_url && invoiceSettings.lockAfterIssue) {
      // Return existing invoice instead of regenerating
      return res.json({
        success: true,
        data: {
          invoice_url: shipment.invoice.invoice_url,
          invoice_number: shipment.invoice.invoice_number,
          hsnSummary: shipment.invoice.hsnSummary,
        },
      })
    }

    const grossAmount = typeof order.total === 'number' ? order.total : sellerTotals.itemSubtotal
    const marketplaceFees = 0
    // Use allocated forward charge (courierCharge) for this order; not full AWB rate
    const courierCharges =
      shipment.courierCharge ??
      shipment.courierCart?.rate ??
      (typeof order.shipping === 'number' ? order.shipping : 0)
    const codFees = order.paymentMethod === 'cod' ? Math.round(grossAmount * 0.02) : 0
    const netSettlement = grossAmount - marketplaceFees - courierCharges - codFees

    const invoiceData = {
      order: order,
      customer: order.user as any,
      seller,
      items: sellerItems.map((item) => ({
        product: item.product,
        variant: item.variant,
        orderItem: item,
      })),
      audience: 'seller' as const,
      existingInvoice: shipment.invoice || undefined,
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
    const statusCode = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate invoice',
    })
  }
}

// Download label for admin
export const adminDownloadLabel = async (req: Request, res: Response) => {
  try {
    const { id, shipmentId } = req.params
    const order = await findOrder(id)
    const shipment = order.sellerShipments.find((entry) => entry._id?.toString() === shipmentId) as
      | IOrderSellerShipment
      | undefined

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    // Prefer order-level label, then shipment-level
    const labelUrl = order.label?.label_url || shipment.label?.label_url

    if (!labelUrl) {
      return res.status(404).json({
        success: false,
        message: 'Label not available for this shipment',
      })
    }

    return res.json({
      success: true,
      data: {
        label_url: labelUrl,
        label_id: order.label?.label_id || shipment.label?.label_id,
      },
    })
  } catch (error: any) {
    const statusCode = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch label',
    })
  }
}

// Get seller pickup addresses for admin
export const getSellerPickupAddresses = async (req: Request, res: Response) => {
  try {
    const { id, shipmentId } = req.params
    const order = await findOrder(id)
    const shipment = order.sellerShipments.find((entry) => entry._id?.toString() === shipmentId) as
      | IOrderSellerShipment
      | undefined

    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' })
    }

    const sellerId = shipment.seller?._id?.toString() || shipment.seller?.toString()
    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Seller not found for shipment' })
    }

    const seller = await fetchSeller(sellerId)
    const addresses = seller.pickupAddresses || []

    return res.json({
      success: true,
      data: addresses,
    })
  } catch (error: any) {
    const statusCode = error.message === 'ORDER_NOT_FOUND' ? 404 : 500
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch pickup addresses',
    })
  }
}

// Search orders for a seller by order ID or order number
export const searchSellerOrders = async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params
    const { q } = req.query

    if (!sellerId || !mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' })
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
