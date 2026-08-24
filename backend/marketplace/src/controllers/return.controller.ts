import { Request, Response } from 'express'
import mongoose from 'mongoose'
import {
  ALL_REPLACEMENT_REASONS,
  ALL_RETURN_REASONS,
  REPLACEMENT_REASON_LABELS,
  RETURN_REASON_LABELS,
  type ReplacementReason,
  type ReturnReason,
} from '../constants/returnReasons'
import Order from '../models/Order'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import RefundRequest from '../models/RefundRequest'
import Return from '../models/Return'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import SellerSettlementBatch from '../models/SellerSettlementBatch'
import User from '../models/User'
import { io } from '../server'
import {
  shippingProviderService,
  type ShippingManifestRequest,
} from '../services/shippingProvider.service'
import { updateProductTotalStock } from '../services/products/utils'
import { emailTemplates, sendEmail } from '../utils/email'
import { generateInvoice } from '../utils/invoiceGenerator'
import { uploadToR2 } from '../utils/r2Upload'
import {
  appendReturnTimeline,
  isOrderItemReturnEligible,
  markOrderReturnFlags,
} from '../utils/returns'
import { buildReturnShipmentOrderNumber } from '../utils/shippingOrderNumber'
import { isInterStateSupply } from '../utils/taxCompliance'

const toObjectId = (id: string) => new mongoose.Types.ObjectId(id)

/**
 * Parse numeric rate from various provider response formats
 */
const parseRate = (val: unknown): number | undefined => {
  if (val === null || val === undefined) return undefined
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  if (typeof val === 'string') {
    const n = parseFloat(val)
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}

/**
 * Normalize rate for reverse pickup couriers.
 * We create a FORWARD shipment (customer → seller), so use forward rate only.
 * The active provider may return rate in top-level `rate` or in
 * `local_rate_details.forward.rate`.
 */
const normalizeReverseCourierRate = (c: {
  rate?: number | string
  local_rate_details?: { forward?: { rate?: string }; rto?: { rate?: string } }
  rate_details?: { forward?: { rate?: string }; rto?: { rate?: string } }
}): number => {
  const topLevel = parseRate(c.rate)
  if (topLevel !== undefined && topLevel > 0) return topLevel
  // Use forward rate only (pickup from customer → deliver to seller)
  const forwardRate = parseRate(c.local_rate_details?.forward?.rate ?? c.rate_details?.forward?.rate)
  if (forwardRate !== undefined) return forwardRate
  return topLevel ?? 0
}

/**
 * Helper function to get replacement flow status description for sellers
 */
const getReplacementFlowStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    REQUESTED: 'Replacement request received - awaiting your approval',
    APPROVED_BY_SELLER: 'You approved - waiting for admin to create pickup',
    APPROVED_BY_ADMIN: 'Admin approved - pickup will be created',
    REVERSE_PICKUP_CREATED: 'Pickup created - waiting for courier to collect',
    REVERSE_PICKUP_IN_TRANSIT: 'Return item in transit to you',
    REVERSE_PICKUP_COMPLETED: 'Return item delivered to you',
    RETURN_RECEIVED_BY_SELLER: 'Return received - replacement order created',
    REFUND_INITIATED: 'Refund processed (if price difference)',
    REFUND_COMPLETED: 'Refund completed',
  }
  return statusMap[status] || status.replace(/_/g, ' ')
}

/**
 * Helper function to get next action for seller in replacement flow
 */
const getNextActionForSeller = (status: string, hasReplacementOrder: boolean): string => {
  if (status === 'REQUESTED') {
    return 'Review and approve/reject the replacement request'
  }
  if (status === 'APPROVED_BY_SELLER') {
    return 'Waiting for admin to create reverse pickup'
  }
  if (status === 'REVERSE_PICKUP_CREATED' || status === 'REVERSE_PICKUP_IN_TRANSIT') {
    return 'Waiting for return item to be delivered to you'
  }
  if (status === 'RETURN_RECEIVED_BY_SELLER' && hasReplacementOrder) {
    return 'Ship the replacement order (generate label and ship like normal order)'
  }
  if (status === 'RETURN_RECEIVED_BY_SELLER' && !hasReplacementOrder) {
    return 'Replacement order will be created automatically after pickup completion'
  }
  return 'Monitor the replacement flow status'
}

/**
 * Get valid return/replacement reasons for frontend
 */
export const getReturnReasons = async (req: Request, res: Response) => {
  try {
    const { type } = req.query // 'return' or 'replacement'

    if (type === 'replacement') {
      return res.status(200).json({
        success: true,
        data: {
          reasons: ALL_REPLACEMENT_REASONS.map((reason) => ({
            value: reason,
            label: REPLACEMENT_REASON_LABELS[reason as ReplacementReason],
          })),
        },
      })
    }

    // Default to return reasons
    return res.status(200).json({
      success: true,
      data: {
        reasons: ALL_RETURN_REASONS.map((reason) => ({
          value: reason,
          label: RETURN_REASON_LABELS[reason as ReturnReason],
        })),
      },
    })
  } catch (error: any) {
    console.error('Error fetching return reasons:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch return reasons',
    })
  }
}

/**
 * Validate return/replacement reason
 */
const validateReason = (
  reason: string,
  returnType: 'return' | 'replacement',
): { valid: boolean; message?: string } => {
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return { valid: false, message: 'Reason is required' }
  }

  const trimmedReason = reason.trim()
  const validReasons = returnType === 'replacement' ? ALL_REPLACEMENT_REASONS : ALL_RETURN_REASONS

  if (!validReasons.includes(trimmedReason as any)) {
    return {
      valid: false,
      message: `Invalid reason. Valid reasons for ${returnType} are: ${validReasons.join(', ')}`,
    }
  }

  return { valid: true }
}

/**
 * Validate images array (now supports both images and videos)
 */
const validateImages = (
  images: any,
): { valid: boolean; message?: string; normalizedImages?: string[] } => {
  // Images are optional
  if (!images) {
    return { valid: true, normalizedImages: [] }
  }

  if (!Array.isArray(images)) {
    return { valid: false, message: 'Images must be an array' }
  }

  // Limit to 5 files (images or videos)
  if (images.length > 5) {
    return { valid: false, message: 'Maximum 5 files allowed' }
  }

  // Validate each file URL (supports both images and videos)
  const validImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']
  const validVideoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi']
  const validExtensions = [...validImageExtensions, ...validVideoExtensions]
  const normalizedImages: string[] = []

  for (let i = 0; i < images.length; i++) {
    const image = images[i]

    if (typeof image !== 'string' || image.trim().length === 0) {
      return { valid: false, message: `File at index ${i} must be a non-empty string URL` }
    }

    const trimmedUrl = image.trim()

    // Basic URL validation
    try {
      const url = new URL(trimmedUrl)
      // Check if it's http or https
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { valid: false, message: `File at index ${i} must be a valid HTTP/HTTPS URL` }
      }

      // Check file extension (optional, but recommended)
      const pathname = url.pathname.toLowerCase()
      const hasValidExtension = validExtensions.some((ext) => pathname.endsWith(ext))

      // Warn but don't fail if no extension (some URLs might not have extensions)
      // We'll allow it but log a warning
      if (!hasValidExtension && pathname.includes('.')) {
        console.warn(`File URL at index ${i} may not have a recognized extension: ${trimmedUrl}`)
      }

      normalizedImages.push(trimmedUrl)
    } catch (error) {
      return { valid: false, message: `File at index ${i} is not a valid URL: ${trimmedUrl}` }
    }
  }

  return { valid: true, normalizedImages }
}

/**
 * Validate description
 */
const validateDescription = (
  description: any,
  isSecondAttempt: boolean,
): { valid: boolean; message?: string } => {
  // Description is optional, but required for second attempt if no images
  if (!description) {
    if (isSecondAttempt) {
      return { valid: false, message: 'Description is required for second return attempt' }
    }
    return { valid: true }
  }

  if (typeof description !== 'string') {
    return { valid: false, message: 'Description must be a string' }
  }

  const trimmed = description.trim()

  // Minimum length for second attempt
  if (isSecondAttempt && trimmed.length < 20) {
    return {
      valid: false,
      message: 'Description must be at least 20 characters for second return attempt',
    }
  }

  // Maximum length (2000 characters as per schema)
  if (trimmed.length > 2000) {
    return { valid: false, message: 'Description cannot exceed 2000 characters' }
  }

  return { valid: true }
}

export const createReturnRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const {
      order_id: orderId,
      order_item_id: orderItemId,
      reason,
      description,
      images,
      returnType = 'return', // Default to 'return'
      exchangeVariantId,
      // Refund details for replacement price difference
      refundMode,
      upiId,
      bankAccountNumber,
      ifscCode,
      accountHolderName,
    } = req.body

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'order_id is required' })
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'reason is required' })
    }

    // Validate returnType
    if (returnType && !['return', 'replacement'].includes(returnType)) {
      return res.status(400).json({
        success: false,
        message: 'returnType must be either "return" or "replacement"',
      })
    }

    // Validate reason
    const reasonValidation = validateReason(reason, returnType)
    if (!reasonValidation.valid) {
      return res.status(400).json({
        success: false,
        message: reasonValidation.message,
      })
    }

    // For replacement, validate variant selection
    if (returnType === 'replacement') {
      if (!exchangeVariantId) {
        return res.status(400).json({
          success: false,
          message: 'exchangeVariantId is required for replacement',
        })
      }

      // Validate exchangeVariantId format
      if (!mongoose.Types.ObjectId.isValid(exchangeVariantId)) {
        return res.status(400).json({
          success: false,
          message: 'exchangeVariantId must be a valid ObjectId',
        })
      }
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
    })
      .populate('items.product', 'returnable returnDays')
      .exec()

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    if (order.status !== 'delivered') {
      return res
        .status(400)
        .json({ success: false, message: 'Return can only be requested for delivered orders' })
    }

    // Enforce at most two attempts per order/item combination
    const baseReturnQuery: any = {
      order: order._id,
      customer: toObjectId(userId),
    }
    if (orderItemId) {
      baseReturnQuery.orderItem = orderItemId
    }
    const previousReturns = await Return.find(baseReturnQuery).lean().exec()
    const rejectedCount = previousReturns.filter((r) => r.status === 'REJECTED').length

    if (rejectedCount >= 2) {
      return res.status(400).json({
        success: false,
        message: 'Return request locked due to repeated rejection for this item.',
      })
    }

    let orderItem: any | null = null
    if (orderItemId) {
      orderItem = (order.items as any[]).find(
        (item) => String((item as any)?._id) === String(orderItemId),
      )
      if (!orderItem) {
        return res.status(400).json({ success: false, message: 'Order item not found' })
      }

      const eligible = isOrderItemReturnEligible(order, orderItem)
      if (!eligible) {
        return res
          .status(400)
          .json({ success: false, message: 'This item is not eligible for return' })
      }
    }

    const sellerIdRaw =
      orderItem?.seller ||
      (order.sellerShipments && order.sellerShipments[0] && order.sellerShipments[0].seller)
    if (!sellerIdRaw) {
      return res.status(400).json({ success: false, message: 'Seller not found for this order' })
    }

    const sellerId =
      typeof sellerIdRaw === 'string' ? new mongoose.Types.ObjectId(sellerIdRaw) : sellerIdRaw

    // Calculate refund amount and validate price difference for replacement
    let refundAmount = orderItem ? orderItem.subtotal : order.total
    let priceDifference = 0
    let replacementVariant: any = null

    if (returnType === 'replacement' && exchangeVariantId) {
      // Fetch the replacement variant
      // For simple products (no variants), exchangeVariantId is actually the product ID
      replacementVariant = await ProductVariant.findById(exchangeVariantId)
        .select('effectivePrice price hsnSacCode gstRatePercent')
        .lean()

      // If not found as a variant, check if it's a product ID (for simple products)
      if (!replacementVariant) {
        const product = await Product.findById(exchangeVariantId)
          .select('effectivePrice price hsnSacCode gstRatePercent hasVariants')
          .lean()

        if (product && !product.hasVariants) {
          // This is a simple product, use it as the replacement "variant"
          replacementVariant = {
            _id: product._id,
            effectivePrice: product.effectivePrice,
            price: product.price,
            hsnSacCode: product.hsnSacCode,
            gstRatePercent: product.gstRatePercent,
          }
        } else {
          return res.status(404).json({
            success: false,
            message: 'Replacement variant not found',
          })
        }
      }

      const originalPrice = orderItem?.effectivePrice || orderItem?.price || 0
      const replacementPrice = replacementVariant.effectivePrice || replacementVariant.price || 0
      priceDifference = originalPrice - replacementPrice

      // Debug logging for price calculation
      console.log('[createReturnRequest] Replacement price calculation:', {
        orderItemId: orderItem?._id?.toString(),
        originalPrice,
        replacementPrice,
        priceDifference,
        quantity: orderItem?.quantity || 1,
        orderItemEffectivePrice: orderItem?.effectivePrice,
        orderItemPrice: orderItem?.price,
        replacementVariantEffectivePrice: replacementVariant.effectivePrice,
        replacementVariantPrice: replacementVariant.price,
      })

      // Validate price difference rules
      if (replacementPrice > originalPrice) {
        return res.status(400).json({
          success: false,
          message: 'Higher priced variants require a new order. Please place a new order instead.',
        })
      }

      // If same price, no refund needed
      if (priceDifference === 0) {
        refundAmount = 0
        console.log('[createReturnRequest] Replacement prices are equal, no refund needed')
      } else {
        // Lower price - refund the difference
        refundAmount = priceDifference * (orderItem?.quantity || 1)
        console.log('[createReturnRequest] Replacement price difference refund:', {
          priceDifference,
          quantity: orderItem?.quantity || 1,
          refundAmount,
        })
      }

      // If refund is needed, validate refund details
      if (refundAmount > 0) {
        if (!refundMode || !['UPI', 'BANK'].includes(refundMode)) {
          return res.status(400).json({
            success: false,
            message: 'refundMode (UPI or BANK) is required when replacement price is lower',
          })
        }

        if (refundMode === 'UPI') {
          if (!upiId || typeof upiId !== 'string' || upiId.trim().length === 0) {
            return res.status(400).json({
              success: false,
              message: 'upiId is required and must be a non-empty string for UPI refund',
            })
          }

          // Basic UPI ID validation (format: xyz@paytm, xyz@ybl, etc.)
          const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
          if (!upiPattern.test(upiId.trim())) {
            return res.status(400).json({
              success: false,
              message: 'Invalid UPI ID format. Expected format: xyz@paytm or xyz@ybl',
            })
          }
        }

        if (refundMode === 'BANK') {
          if (
            !bankAccountNumber ||
            typeof bankAccountNumber !== 'string' ||
            bankAccountNumber.trim().length === 0
          ) {
            return res.status(400).json({
              success: false,
              message: 'bankAccountNumber is required and must be a non-empty string',
            })
          }

          // Bank account number should be 9-18 digits
          const accountNumberPattern = /^\d{9,18}$/
          if (!accountNumberPattern.test(bankAccountNumber.trim())) {
            return res.status(400).json({
              success: false,
              message: 'Invalid bank account number. Must be 9-18 digits',
            })
          }

          if (!ifscCode || typeof ifscCode !== 'string' || ifscCode.trim().length === 0) {
            return res.status(400).json({
              success: false,
              message: 'ifscCode is required and must be a non-empty string',
            })
          }

          // IFSC code format: 4 letters + 0 + 6 digits (e.g., HDFC0001234)
          const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/
          if (!ifscPattern.test(ifscCode.trim().toUpperCase())) {
            return res.status(400).json({
              success: false,
              message: 'Invalid IFSC code format. Expected format: ABCD0123456',
            })
          }

          if (
            !accountHolderName ||
            typeof accountHolderName !== 'string' ||
            accountHolderName.trim().length === 0
          ) {
            return res.status(400).json({
              success: false,
              message: 'accountHolderName is required and must be a non-empty string',
            })
          }

          // Account holder name should be 2-100 characters
          if (accountHolderName.trim().length < 2 || accountHolderName.trim().length > 100) {
            return res.status(400).json({
              success: false,
              message: 'Account holder name must be between 2 and 100 characters',
            })
          }
        }
      }
    }

    const attemptNumber = rejectedCount + 1
    const isSecondAttempt = attemptNumber === 2

    // Handle uploaded files and existing image URLs
    let allImageUrls: string[] = []

    // Upload files if any were uploaded
    const uploadedFiles = (req.files as Express.Multer.File[]) || []
    if (uploadedFiles.length > 0) {
      try {
        const uploadPromises = uploadedFiles.map(async (file) => {
          const fileName = `returns/${userId}/${Date.now()}-${file.originalname}`
          return await uploadToR2(file.buffer, fileName, file.mimetype, 'returns')
        })
        const uploadedUrls = await Promise.all(uploadPromises)
        allImageUrls.push(...uploadedUrls)
      } catch (error: any) {
        console.error('Error uploading return images:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to upload images. Please try again.',
        })
      }
    }

    // Add any existing image URLs from req.body (for backward compatibility)
    if (images && Array.isArray(images)) {
      allImageUrls.push(...images)
    }

    // Validate images
    const imageValidation = validateImages(allImageUrls)
    if (!imageValidation.valid) {
      return res.status(400).json({
        success: false,
        message: imageValidation.message,
      })
    }
    const validatedImages = imageValidation.normalizedImages || []

    // Validate description
    const descriptionValidation = validateDescription(description, isSecondAttempt)
    if (!descriptionValidation.valid) {
      return res.status(400).json({
        success: false,
        message: descriptionValidation.message,
      })
    }

    // For second attempt, require stronger justification (description or images)
    if (isSecondAttempt) {
      const desc = (description || '').trim()
      if (desc.length < 20 && validatedImages.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'For second return attempt, please provide a detailed description (at least 20 characters) or at least one clear photo.',
        })
      }
    }

    // Normalize description (trim and limit length)
    const normalizedDescription = description ? description.trim().substring(0, 2000) : undefined

    // Ensure order._id is properly converted to ObjectId
    // Use orderObjectId to avoid conflict with orderId from request body
    const orderObjectId = order._id as mongoose.Types.ObjectId
    if (!orderObjectId) {
      console.error('[createReturnRequest] Order ID is missing:', {
        orderIdFromBody: orderId,
        orderIdFromDoc: order._id,
        order: order.toObject ? order.toObject() : order,
      })
      return res
        .status(500)
        .json({ success: false, message: 'Order ID is missing. Please try again.' })
    }

    const ret = new Return({
      order: orderObjectId, // Explicitly ensure ObjectId format
      orderItem: orderItem?._id ? (orderItem._id as mongoose.Types.ObjectId) : undefined,
      seller: sellerId,
      customer: toObjectId(userId),
      reason: reason.trim(),
      description: normalizedDescription,
      images: validatedImages,
      returnType: returnType === 'replacement' ? 'replacement' : 'return',
      exchangeVariantId:
        returnType === 'replacement' && exchangeVariantId
          ? new mongoose.Types.ObjectId(exchangeVariantId)
          : null,
      originalOrderId: orderObjectId, // Store reference to original order
      status: 'REQUESTED',
      refundAmount,
      attemptNumber,
    })

    // Debug logging for replacement requests
    if (returnType === 'replacement') {
      console.log('[createReturnRequest] Creating replacement request:', {
        returnId: ret._id,
        orderId: orderObjectId.toString(),
        orderNumber: order.orderNumber,
        orderItemId: orderItem?._id?.toString(),
        exchangeVariantId: exchangeVariantId,
        sellerId: sellerId.toString(),
        customerId: userId,
      })
    }

    const requestType = returnType === 'replacement' ? 'Replacement' : 'Return'
    appendReturnTimeline(ret, 'REQUESTED', `${requestType} requested by customer`)

    await ret.save()

    // Verify the return was saved with order ID (critical check)
    const savedReturn = await Return.findById(ret._id)
    if (!savedReturn || !savedReturn.order) {
      console.error('[createReturnRequest] CRITICAL: Return saved without order ID:', {
        returnId: ret._id,
        savedReturn: savedReturn?.toObject ? savedReturn.toObject() : savedReturn,
        originalOrderId: orderObjectId.toString(),
      })
      return res.status(500).json({
        success: false,
        message: 'Failed to associate order with return. Please try again or contact support.',
      })
    }

    await markOrderReturnFlags(orderObjectId, 'REQUESTED')

    // Create refund request if replacement has price difference
    if (returnType === 'replacement' && refundAmount > 0 && refundMode) {
      try {
        const refundRequest = new RefundRequest({
          order: orderObjectId,
          return: ret._id,
          customer: toObjectId(userId),
          seller: sellerId,
          refundAmount,
          refundMode: refundMode as 'UPI' | 'BANK',
          refundType: 'replacement',
          status: 'pending',
          upiId: refundMode === 'UPI' ? upiId : undefined,
          bankAccountNumber: refundMode === 'BANK' ? bankAccountNumber : undefined,
          ifscCode: refundMode === 'BANK' ? ifscCode : undefined,
          accountHolderName: refundMode === 'BANK' ? accountHolderName : undefined,
        })
        await refundRequest.save()

        appendReturnTimeline(
          ret,
          'REQUESTED',
          `Price difference refund request created: ₹${refundAmount.toFixed(2)}`,
        )
        await ret.save()
      } catch (refundError: any) {
        console.error('Error creating refund request:', refundError)
        // Don't fail the return request if refund request creation fails
      }
    }

    // Notify seller & admin (best-effort)
    try {
      const seller = await User.findById(sellerId).select('name businessName email supportEmail')
      const sellerEmail = (seller as any)?.supportEmail || (seller as any)?.email
      const sellerName = (seller as any)?.businessName || (seller as any)?.name || 'Seller'
      if (sellerEmail) {
        const subject = `New return request for Order #${order.orderNumber || order._id}`
        const body = emailTemplates.sellerShipmentStatusUpdate(sellerName, {
          orderNumber: order.orderNumber || String(order._id),
          statusLabel: 'Return Requested',
          message: `A customer has requested a return for this order. Reason: ${reason}`,
        })
        void sendEmail(sellerEmail, subject, body)
      }
      try {
        io.to('super-admin').emit('return:requested', {
          returnId: String(ret._id),
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          sellerId: sellerId.toString(),
          customerId: userId,
          reason,
          createdAt: ret.createdAt,
        })
      } catch {
        // ignore socket errors
      }
    } catch {
      // ignore notification errors
    }

    return res.status(201).json({
      success: true,
      data: {
        return_id: ret._id,
        status: ret.status,
      },
    })
  } catch (error: any) {
    console.error('Error creating return request:', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to create return request' })
  }
}

/**
 * Admin can create return/replacement on behalf of customer
 * POST /api/admin/returns/create
 */
export const adminCreateReturnRequest = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const {
      order_id: orderId,
      customer_id: customerId, // Admin specifies which customer
      order_item_id: orderItemId,
      reason,
      description,
      images,
      returnType = 'return',
      exchangeVariantId,
      refundMode,
      upiId,
      bankAccountNumber,
      ifscCode,
      accountHolderName,
    } = req.body

    // Validate required fields
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'order_id is required' })
    }

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customer_id is required' })
    }

    if (!reason) {
      return res.status(400).json({ success: false, message: 'reason is required' })
    }

    // Validate returnType
    if (returnType && !['return', 'replacement'].includes(returnType)) {
      return res.status(400).json({
        success: false,
        message: 'returnType must be either "return" or "replacement"',
      })
    }

    // Validate reason
    const reasonValidation = validateReason(reason, returnType)
    if (!reasonValidation.valid) {
      return res.status(400).json({
        success: false,
        message: reasonValidation.message,
      })
    }

    // For replacement, validate variant selection
    if (returnType === 'replacement') {
      if (!exchangeVariantId) {
        return res.status(400).json({
          success: false,
          message: 'exchangeVariantId is required for replacement',
        })
      }

      if (!mongoose.Types.ObjectId.isValid(exchangeVariantId)) {
        return res.status(400).json({
          success: false,
          message: 'exchangeVariantId must be a valid ObjectId',
        })
      }
    }

    // Admin can access any order - no user check needed
    const order = await Order.findOne({
      _id: orderId,
    })
      .populate('items.product', 'returnable returnDays')
      .populate('user', '_id') // Populate user to get consistent format
      .exec()

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' })
    }

    // Verify customer ID matches order
    // Handle both populated and non-populated user field
    let orderCustomerId: string
    if (order.user) {
      // If populated, it's an object with _id
      if (typeof order.user === 'object' && (order.user as any)._id) {
        orderCustomerId = String((order.user as any)._id)
      } else if (order.user instanceof mongoose.Types.ObjectId) {
        // If it's an ObjectId
        orderCustomerId = String(order.user)
      } else {
        // If it's already a string
        orderCustomerId = String(order.user)
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Order does not have a customer associated',
      })
    }

    // Normalize both IDs to strings for comparison
    const normalizedOrderCustomerId = orderCustomerId.toString()
    const normalizedCustomerId = String(customerId).toString()

    if (normalizedOrderCustomerId !== normalizedCustomerId) {
      console.error('[adminCreateReturnRequest] Customer ID mismatch:', {
        orderId: order._id,
        orderCustomerId: normalizedOrderCustomerId,
        providedCustomerId: normalizedCustomerId,
        orderUserType: typeof order.user,
        orderUser: order.user,
      })
      return res.status(400).json({
        success: false,
        message: 'Customer ID does not match the order customer',
      })
    }

    if (order.status !== 'delivered') {
      return res
        .status(400)
        .json({ success: false, message: 'Return can only be requested for delivered orders' })
    }

    // Enforce at most two attempts per order/item combination
    const baseReturnQuery: any = {
      order: order._id,
      customer: toObjectId(customerId),
    }
    if (orderItemId) {
      baseReturnQuery.orderItem = orderItemId
    }
    const previousReturns = await Return.find(baseReturnQuery).lean().exec()
    const rejectedCount = previousReturns.filter((r) => r.status === 'REJECTED').length

    if (rejectedCount >= 2) {
      return res.status(400).json({
        success: false,
        message: 'Return request locked due to repeated rejection for this item.',
      })
    }

    let orderItem: any | null = null
    if (orderItemId) {
      orderItem = (order.items as any[]).find(
        (item) => String((item as any)?._id) === String(orderItemId),
      )
      if (!orderItem) {
        return res.status(400).json({ success: false, message: 'Order item not found' })
      }

      const eligible = isOrderItemReturnEligible(order, orderItem)
      if (!eligible) {
        return res
          .status(400)
          .json({ success: false, message: 'This item is not eligible for return' })
      }
    }

    const sellerIdRaw =
      orderItem?.seller ||
      (order.sellerShipments && order.sellerShipments[0] && order.sellerShipments[0].seller)
    if (!sellerIdRaw) {
      return res.status(400).json({ success: false, message: 'Seller not found for this order' })
    }

    const sellerId =
      typeof sellerIdRaw === 'string' ? new mongoose.Types.ObjectId(sellerIdRaw) : sellerIdRaw

    // Calculate refund amount and validate price difference for replacement
    let refundAmount = orderItem ? orderItem.subtotal : order.total
    let priceDifference = 0
    let replacementVariant: any = null

    if (returnType === 'replacement' && exchangeVariantId) {
      // Fetch the replacement variant
      // For simple products (no variants), exchangeVariantId is actually the product ID
      replacementVariant = await ProductVariant.findById(exchangeVariantId)
        .select('effectivePrice price hsnSacCode gstRatePercent')
        .lean()

      // If not found as a variant, check if it's a product ID (for simple products)
      if (!replacementVariant) {
        const product = await Product.findById(exchangeVariantId)
          .select('effectivePrice price hsnSacCode gstRatePercent hasVariants')
          .lean()

        if (product && !product.hasVariants) {
          // This is a simple product, use it as the replacement "variant"
          replacementVariant = {
            _id: product._id,
            effectivePrice: product.effectivePrice,
            price: product.price,
            hsnSacCode: product.hsnSacCode,
            gstRatePercent: product.gstRatePercent,
          }
        } else {
          return res.status(404).json({
            success: false,
            message: 'Replacement variant not found',
          })
        }
      }

      const originalPrice = orderItem?.effectivePrice || orderItem?.price || 0
      const replacementPrice = replacementVariant.effectivePrice || replacementVariant.price || 0
      priceDifference = originalPrice - replacementPrice

      if (replacementPrice > originalPrice) {
        return res.status(400).json({
          success: false,
          message: 'Higher priced variants require a new order. Please place a new order instead.',
        })
      }

      if (priceDifference === 0) {
        refundAmount = 0
      } else {
        refundAmount = priceDifference * (orderItem?.quantity || 1)
      }

      // If refund is needed, validate refund details
      if (refundAmount > 0) {
        if (!refundMode || !['UPI', 'BANK'].includes(refundMode)) {
          return res.status(400).json({
            success: false,
            message: 'refundMode (UPI or BANK) is required when replacement price is lower',
          })
        }

        if (refundMode === 'UPI') {
          if (!upiId || typeof upiId !== 'string' || upiId.trim().length === 0) {
            return res.status(400).json({
              success: false,
              message: 'upiId is required and must be a non-empty string for UPI refund',
            })
          }

          const upiPattern = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
          if (!upiPattern.test(upiId.trim())) {
            return res.status(400).json({
              success: false,
              message: 'Invalid UPI ID format. Expected format: xyz@paytm or xyz@ybl',
            })
          }
        }

        if (refundMode === 'BANK') {
          if (
            !bankAccountNumber ||
            typeof bankAccountNumber !== 'string' ||
            bankAccountNumber.trim().length === 0
          ) {
            return res.status(400).json({
              success: false,
              message: 'bankAccountNumber is required and must be a non-empty string',
            })
          }

          const accountNumberPattern = /^\d{9,18}$/
          if (!accountNumberPattern.test(bankAccountNumber.trim())) {
            return res.status(400).json({
              success: false,
              message: 'Invalid bank account number. Must be 9-18 digits',
            })
          }

          if (!ifscCode || typeof ifscCode !== 'string' || ifscCode.trim().length === 0) {
            return res.status(400).json({
              success: false,
              message: 'ifscCode is required and must be a non-empty string',
            })
          }

          const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/
          if (!ifscPattern.test(ifscCode.trim().toUpperCase())) {
            return res.status(400).json({
              success: false,
              message: 'Invalid IFSC code format. Expected format: ABCD0123456',
            })
          }

          if (
            !accountHolderName ||
            typeof accountHolderName !== 'string' ||
            accountHolderName.trim().length === 0
          ) {
            return res.status(400).json({
              success: false,
              message: 'accountHolderName is required and must be a non-empty string',
            })
          }

          if (accountHolderName.trim().length < 2 || accountHolderName.trim().length > 100) {
            return res.status(400).json({
              success: false,
              message: 'Account holder name must be between 2 and 100 characters',
            })
          }
        }
      }
    }

    const attemptNumber = rejectedCount + 1
    const isSecondAttempt = attemptNumber === 2

    // Handle uploaded files and existing image URLs
    let allImageUrls: string[] = []

    const uploadedFiles = (req.files as Express.Multer.File[]) || []
    if (uploadedFiles.length > 0) {
      try {
        const uploadPromises = uploadedFiles.map(async (file) => {
          const fileName = `returns/${customerId}/${Date.now()}-${file.originalname}`
          return await uploadToR2(file.buffer, fileName, file.mimetype, 'returns')
        })
        const uploadedUrls = await Promise.all(uploadPromises)
        allImageUrls.push(...uploadedUrls)
      } catch (error: any) {
        console.error('Error uploading return images:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to upload images. Please try again.',
        })
      }
    }

    if (images && Array.isArray(images)) {
      allImageUrls.push(...images)
    }

    const imageValidation = validateImages(allImageUrls)
    if (!imageValidation.valid) {
      return res.status(400).json({
        success: false,
        message: imageValidation.message,
      })
    }
    const validatedImages = imageValidation.normalizedImages || []

    const descriptionValidation = validateDescription(description, isSecondAttempt)
    if (!descriptionValidation.valid) {
      return res.status(400).json({
        success: false,
        message: descriptionValidation.message,
      })
    }

    if (isSecondAttempt) {
      const desc = (description || '').trim()
      if (desc.length < 20 && validatedImages.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            'For second return attempt, please provide a detailed description (at least 20 characters) or at least one clear photo.',
        })
      }
    }

    const normalizedDescription = description ? description.trim().substring(0, 2000) : undefined

    const orderObjectId = order._id as mongoose.Types.ObjectId
    if (!orderObjectId) {
      return res
        .status(500)
        .json({ success: false, message: 'Order ID is missing. Please try again.' })
    }

    const ret = new Return({
      order: orderObjectId,
      orderItem: orderItem?._id ? (orderItem._id as mongoose.Types.ObjectId) : undefined,
      seller: sellerId,
      customer: toObjectId(customerId),
      reason: reason.trim(),
      description: normalizedDescription,
      images: validatedImages,
      returnType: returnType === 'replacement' ? 'replacement' : 'return',
      exchangeVariantId:
        returnType === 'replacement' && exchangeVariantId
          ? new mongoose.Types.ObjectId(exchangeVariantId)
          : null,
      originalOrderId: orderObjectId,
      status: 'REQUESTED',
      refundAmount,
      attemptNumber,
    })

    const requestType = returnType === 'replacement' ? 'Replacement' : 'Return'
    appendReturnTimeline(
      ret,
      'REQUESTED',
      `${requestType} requested by admin on behalf of customer`,
    )

    await ret.save()

    const savedReturn = await Return.findById(ret._id)
    if (!savedReturn || !savedReturn.order) {
      return res.status(500).json({
        success: false,
        message: 'Failed to associate order with return. Please try again or contact support.',
      })
    }

    await markOrderReturnFlags(orderObjectId, 'REQUESTED')

    // Create refund request if replacement has price difference
    if (returnType === 'replacement' && refundAmount > 0 && refundMode) {
      try {
        const refundRequest = new RefundRequest({
          order: orderObjectId,
          return: ret._id,
          customer: toObjectId(customerId),
          seller: sellerId,
          refundAmount,
          refundMode: refundMode as 'UPI' | 'BANK',
          refundType: 'replacement',
          status: 'pending',
          upiId: refundMode === 'UPI' ? upiId : undefined,
          bankAccountNumber: refundMode === 'BANK' ? bankAccountNumber : undefined,
          ifscCode: refundMode === 'BANK' ? ifscCode : undefined,
          accountHolderName: refundMode === 'BANK' ? accountHolderName : undefined,
        })
        await refundRequest.save()

        appendReturnTimeline(
          ret,
          'REQUESTED',
          `Price difference refund request created: ₹${refundAmount.toFixed(2)}`,
        )
        await ret.save()
      } catch (refundError: any) {
        console.error('Error creating refund request:', refundError)
      }
    }

    // Notify seller & admin
    try {
      const seller = await User.findById(sellerId).select('name businessName email supportEmail')
      const sellerEmail = (seller as any)?.supportEmail || (seller as any)?.email
      const sellerName = (seller as any)?.businessName || (seller as any)?.name || 'Seller'
      if (sellerEmail) {
        const subject = `New return request for Order #${order.orderNumber || order._id}`
        const body = emailTemplates.sellerShipmentStatusUpdate(sellerName, {
          orderNumber: order.orderNumber || String(order._id),
          statusLabel: 'Return Requested',
          message: `A return has been requested for this order. Reason: ${reason}`,
        })
        void sendEmail(sellerEmail, subject, body)
      }
      try {
        io.to('super-admin').emit('return:requested', {
          returnId: String(ret._id),
          orderId: String(order._id),
          orderNumber: order.orderNumber,
          sellerId: sellerId.toString(),
          customerId: customerId,
          reason,
          createdAt: ret.createdAt,
        })
      } catch {
        // ignore socket errors
      }
    } catch {
      // ignore notification errors
    }

    return res.status(201).json({
      success: true,
      data: {
        return_id: ret._id,
        status: ret.status,
      },
    })
  } catch (error: any) {
    console.error('Error creating return request (admin):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to create return request' })
  }
}

export const listCustomerReturns = async (req: Request, res: Response) => {
  try {
    const customerId = req.user?.userId
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const { status, page = 1, limit = 20 } = req.query as any
    const query: any = {
      customer: toObjectId(customerId),
    }
    if (status) {
      query.status = status
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [returns, total] = await Promise.all([
      Return.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        // Only fetch fields needed for customer history cards
        .select('order seller reason status refundAmount returnType creditNote timeline createdAt')
        .populate('order', 'orderNumber status total')
        .populate('seller', 'name businessName')
        .lean()
        .exec(),
      Return.countDocuments(query),
    ])

    return res.json({
      success: true,
      data: returns,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error listing customer returns:', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to fetch returns' })
  }
}

export const listSellerReturns = async (req: Request, res: Response) => {
  try {
    // Debug logging for authorization issues

    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const { status, page = 1, limit = 20 } = req.query as any
    const query: any = {
      seller: toObjectId(sellerId),
    }
    if (status) {
      query.status = status
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [returns, total] = await Promise.all([
      Return.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        // Include images and description for detail modal view
        .select(
          'order customer reason description images status refundAmount returnType exchangeVariantId exchangeOrderId courierReverseAwb courierReverseId courierPartner reverseCharges creditNote timeline createdAt',
        )
        .populate('order', 'orderNumber status total')
        .populate('customer', 'name email')
        .populate({
          path: 'exchangeVariantId',
          select: 'name sku price effectivePrice stock attributes mainImage images',
        })
        .populate({
          path: 'exchangeOrderId',
          select: 'orderNumber status total items',
        })
        .lean()
        .exec(),
      Return.countDocuments(query),
    ])

    // Enhance returns data with replacement order information for seller clarity
    const enhancedReturns = returns.map((returnObj: any) => {
      // Add helpful information for replacement requests
      if (returnObj.returnType === 'replacement') {
        returnObj._sellerInfo = {
          isReplacement: true,
          replacementFlowStatus: getReplacementFlowStatus(returnObj.status),
          nextAction: getNextActionForSeller(returnObj.status, !!returnObj.exchangeOrderId),
          replacementOrderInfo: returnObj.exchangeOrderId
            ? {
                orderNumber: returnObj.exchangeOrderId?.orderNumber,
                status: returnObj.exchangeOrderId?.status,
                total: returnObj.exchangeOrderId?.total || 0,
                message: 'Replacement order created - ready to ship',
              }
            : {
                message: 'Waiting for return pickup completion before replacement order is created',
              },
          importantNotes: [
            'Replacement orders have ₹0 value - no payment collection required',
            'Replacement orders do NOT affect your earnings or payouts',
            'Ship replacement like a normal order (generate label, ship, track)',
            'Original order settlement remains unchanged',
          ],
        }
      }

      return returnObj
    })

    return res.json({
      success: true,
      data: enhancedReturns,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error listing seller returns:', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to fetch returns' })
  }
}

export const sellerApproveReturn = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const { id } = req.params
    const ret = await Return.findOne({ _id: id, seller: sellerId })
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    ret.status = 'APPROVED_BY_SELLER'
    appendReturnTimeline(ret, 'APPROVED_BY_SELLER', 'Return approved by seller')
    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    // Notify customer
    try {
      const order = await Order.findById(ret.order).populate('user', 'name email')
      const buyer: any = order?.user
      const buyerEmail = buyer?.email
      const buyerName = buyer?.name || order?.shippingAddress?.name || 'Customer'
      if (buyerEmail) {
        const subject = `Your return request for order ${
          order?.orderNumber || ''
        } was approved by seller`
        const body = emailTemplates.orderStatusUpdateBuyer(buyerName, {
          orderNumber: order?.orderNumber || 'N/A',
          statusLabel: 'Return Approved by Seller',
          message:
            'The seller has approved your return request. Our team will process the next steps shortly.',
        })
        void sendEmail(buyerEmail, subject, body)
      }
    } catch {
      // ignore
    }

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error approving return (seller):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to approve return' })
  }
}

export const sellerRejectReturn = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const { id } = req.params
    const { reason } = req.body as { reason?: string }
    const ret = await Return.findOne({ _id: id, seller: sellerId })
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    ret.status = 'REJECTED'
    appendReturnTimeline(
      ret,
      'REJECTED',
      reason ? `Return rejected by seller: ${reason}` : 'Return rejected by seller',
    )
    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    // Notify customer
    try {
      const order = await Order.findById(ret.order).populate('user', 'name email')
      const buyer: any = order?.user
      const buyerEmail = buyer?.email
      const buyerName = buyer?.name || order?.shippingAddress?.name || 'Customer'
      if (buyerEmail) {
        const subject = `Your return request for order ${order?.orderNumber || ''} was rejected`
        const body = emailTemplates.orderStatusUpdateBuyer(buyerName, {
          orderNumber: order?.orderNumber || 'N/A',
          statusLabel: 'Return Rejected',
          message:
            reason ||
            'The seller has rejected your return request. If you have questions, please contact support.',
        })
        void sendEmail(buyerEmail, subject, body)
      }
    } catch {
      // ignore
    }

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error rejecting return (seller):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to reject return' })
  }
}

export const sellerGetReturnQuote = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const { id } = req.params
    const ret = await Return.findOne({ _id: id, seller: sellerId })
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    // Ensure order ID exists
    if (!ret.order) {
      console.error('[sellerConfirmReturnApproval] Return has no order ID:', {
        returnId: id,
        return: ret.toObject ? ret.toObject() : ret,
      })
      return res.status(400).json({
        success: false,
        message: 'Return does not have an associated order. Please contact support.',
      })
    }

    // Fetch order directly to ensure all fields are loaded - use lean() to get plain object
    const orderDoc: any = await Order.findById(ret.order).lean()
    if (!orderDoc) {
      console.error('[sellerConfirmReturnApproval] Order not found for return:', {
        returnId: id,
        orderId: ret.order,
        orderIdType: typeof ret.order,
      })
      return res.status(400).json({
        success: false,
        message: `Order not found for this return. Order ID: ${ret.order}`,
      })
    }

    // Use first seller shipment as pickup address snapshot
    const shipment = orderDoc.sellerShipments?.[0]

    if (!shipment) {
      console.error('No seller shipment found for return quote:', {
        returnId: id,
        orderId: orderDoc._id,
        hasSellerShipments: !!orderDoc.sellerShipments,
        sellerShipmentsLength: orderDoc.sellerShipments?.length || 0,
      })
      return res.status(400).json({
        success: false,
        message: 'No seller shipment found for this order',
      })
    }

    // Convert shipment to plain object if it's a Mongoose document
    const shipmentPlain =
      shipment && typeof shipment.toObject === 'function' ? shipment.toObject() : shipment

    // Get pickup address from shippingMeta, and derive RTO address from seller's
    // configured pickupAddresses. If shippingMeta doesn't have pickup, we fall
    // back entirely to seller's pickupAddresses.
    let pickupAddress = shipmentPlain?.shippingMeta?.pickup_address
    let rtoAddress: {
      contactName?: string
      contactPhone?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    } | null = null

    // Always load seller pickup addresses so we can also derive the RTO address
    const seller = await User.findById(sellerId).select('pickupAddresses')
    if (seller?.pickupAddresses && seller.pickupAddresses.length > 0) {
      // Try to find the address that matches kourierBoyzLogisticsPickupAddressId if available
      const kourierBoyzLogisticsPickupId = shipmentPlain?.kourierBoyzLogistics?.kourierBoyzLogisticsPickupAddressId
      let selectedAddress: any = null

      if (kourierBoyzLogisticsPickupId) {
        selectedAddress = seller.pickupAddresses.find(
          (addr: any) => addr.kourierBoyzLogisticsPickupAddressId === kourierBoyzLogisticsPickupId,
        )
      }

      // If not found, use default or first address
      if (!selectedAddress) {
        selectedAddress =
          seller.pickupAddresses.find((addr: any) => addr.isDefault) || seller.pickupAddresses[0]
      }

      if (selectedAddress) {
        // If pickupAddress wasn't present in shippingMeta, derive it from seller config
        if (!pickupAddress) {
          pickupAddress = {
            warehouseName: selectedAddress.warehouseName,
            addressLine1: selectedAddress.addressLine1,
            addressLine2: selectedAddress.addressLine2,
            city: selectedAddress.city,
            state: selectedAddress.state,
            postalCode: selectedAddress.postalCode,
            country: selectedAddress.country,
            contactName: selectedAddress.contactName,
            contactPhone: selectedAddress.contactPhone,
          }
        }

        // Derive RTO address from seller's pickupAddress config
        const rtoSameAsPickup = selectedAddress.rtoSameAsPickup !== false
        const rtoSource =
          rtoSameAsPickup || !selectedAddress.rtoAddress
            ? {
                contactName: selectedAddress.contactName,
                contactPhone: selectedAddress.contactPhone,
                addressLine1: selectedAddress.addressLine1,
                addressLine2: selectedAddress.addressLine2,
                city: selectedAddress.city,
                state: selectedAddress.state,
                postalCode: selectedAddress.postalCode,
                country: selectedAddress.country,
              }
            : {
                contactName: selectedAddress.rtoAddress.contactName,
                contactPhone: selectedAddress.rtoAddress.contactPhone,
                addressLine1: selectedAddress.rtoAddress.addressLine1,
                addressLine2: selectedAddress.rtoAddress.addressLine2,
                city: selectedAddress.rtoAddress.city,
                state: selectedAddress.rtoAddress.state,
                postalCode: selectedAddress.rtoAddress.postalCode,
                country: selectedAddress.rtoAddress.country,
              }

        rtoAddress = {
          contactName: rtoSource.contactName,
          contactPhone: rtoSource.contactPhone,
          addressLine1: rtoSource.addressLine1,
          addressLine2: rtoSource.addressLine2,
          city: rtoSource.city,
          state: rtoSource.state,
          postalCode: rtoSource.postalCode,
          country: rtoSource.country,
        }
      }
    }

    if (!pickupAddress) {
      console.error('Pickup address not found in shipment or seller addresses for return quote:', {
        returnId: id,
        orderId: orderDoc._id,
        hasShippingMeta: !!shipmentPlain?.shippingMeta,
        shippingMetaKeys: shipmentPlain?.shippingMeta
          ? Object.keys(shipmentPlain.shippingMeta)
          : [],
        hasSellerPickupAddresses: !!seller?.pickupAddresses,
        pickupAddressesCount: seller?.pickupAddresses?.length || 0,
      })
      return res.status(400).json({
        success: false,
        message:
          'Pickup address not available. Please ensure the seller has a pickup address configured.',
      })
    }

    // If RTO address is still not resolved, default it to pickup address
    if (!rtoAddress && pickupAddress) {
      rtoAddress = {
        contactName: pickupAddress.contactName,
        contactPhone: pickupAddress.contactPhone,
        addressLine1: pickupAddress.addressLine1,
        addressLine2: pickupAddress.addressLine2,
        city: pickupAddress.city,
        state: pickupAddress.state,
        postalCode: pickupAddress.postalCode,
        country: pickupAddress.country,
      }
    }

    // Verify that order was shipped through the active shipping provider
    if (!shipmentPlain?.kourierBoyzLogistics?.order_id && !shipmentPlain?.kourierBoyzLogistics?.order_number) {
      console.error('Shipping provider shipment data not found for return:', {
        returnId: id,
        orderId: orderDoc._id,
        shipmentKourierBoyzLogistics: shipmentPlain?.kourierBoyzLogistics,
        hasKourierBoyzLogistics: !!shipmentPlain?.kourierBoyzLogistics,
      })
      return res.status(400).json({
        success: false,
        message:
          'Order was not shipped through the active shipping provider. Return quote can only be generated for shipped orders.',
      })
    }

    // Use serviceability API instead of quote API for returns
    // For returns: pickup from customer address, deliver to seller RTO address
    const pkgWeight = shipmentPlain.shippingMeta?.weight || 500
    const rawDims = shipmentPlain.shippingMeta?.dimensions
    const dims = rawDims
      ? {
          length: rawDims.length ?? 10,
          breadth: rawDims.breadth ?? rawDims.width ?? 10,
          height: rawDims.height ?? 10,
        }
      : { length: 10, breadth: 10, height: 10 }

    // Get pickup address ID from seller's pickup addresses (seller already loaded above)
    const kourierBoyzLogisticsPickupId = shipmentPlain?.kourierBoyzLogistics?.kourierBoyzLogisticsPickupAddressId
    let selectedAddress: any = null

    if (seller?.pickupAddresses && seller.pickupAddresses.length > 0) {
      if (kourierBoyzLogisticsPickupId) {
        selectedAddress = seller.pickupAddresses.find(
          (addr: any) => addr.kourierBoyzLogisticsPickupAddressId === kourierBoyzLogisticsPickupId,
        )
      }
      if (!selectedAddress) {
        selectedAddress =
          seller.pickupAddresses.find((addr: any) => addr.isDefault) || seller.pickupAddresses[0]
      }
    }

    // For returns: origin is customer's address (where pickup happens), destination is seller's RTO
    const customerPincode = orderDoc.shippingAddress?.postalCode
    const rtoPincode = rtoAddress?.postalCode || pickupAddress?.postalCode

    if (!customerPincode || !rtoPincode) {
      return res.status(400).json({
        success: false,
        message: 'Customer or RTO pincode not available for serviceability check',
      })
    }

    // Check serviceability for reverse shipment
    try {
      const serviceabilityRequest = {
        destination: rtoPincode,
        origin: customerPincode,
        pickup_id: selectedAddress?.kourierBoyzLogisticsPickupAddressId,
        payment_type: 'prepaid' as const, // Returns are prepaid
        order_amount: 0, // Return shipments have no order amount
        weight: pkgWeight,
        length: dims.length,
        breadth: dims.breadth,
        height: dims.height,
        shipment_type: 'b2c' as const,
        is_reverse: true, // Mark as reverse shipment
      }

      // Use getRates API to get detailed rates (same as order shipments)
      const ratesResponse = await shippingProviderService.getRates(serviceabilityRequest)

      console.log('[sellerGetReturnQuote] Shipping provider rates fetched', {
        returnId: id,
        orderId: orderDoc._id,
        serviceabilityRequest,
        rawData: ratesResponse.data,
      })

      // Extract couriers from rates response
      let couriers: any[] = []
      const responseData = ratesResponse.data
      if (responseData?.rates && Array.isArray(responseData.rates)) {
        couriers = responseData.rates
      } else if (Array.isArray(responseData)) {
        couriers = responseData
      } else if (responseData && typeof responseData === 'object' && 'couriers' in responseData) {
        couriers = Array.isArray(responseData.couriers) ? responseData.couriers : []
      } else if (responseData && typeof responseData === 'object' && 'courier' in responseData) {
        couriers = responseData.courier ? [responseData.courier] : []
      } else if (responseData && typeof responseData === 'object' && 'courier_id' in responseData) {
        // Single courier object
        couriers = [responseData]
      }

      // Normalize rate for reverse shipments (we use forward rate for pickup charges)
      couriers = couriers.map((c) => ({
        ...c,
        rate: normalizeReverseCourierRate(c),
      }))

      // Filter serviceable couriers and select the best one (fastest and economical)
      // Best courier = lowest rate, then fastest delivery (if rates are similar)
      const serviceableCouriers = couriers.filter(
        (c) => c.serviceable !== false && (c.rate !== undefined || c.rate === 0),
      )

      if (serviceableCouriers.length > 0) {
        // Sort by: 1) rate (ascending - lower is better), 2) estimated delivery days (ascending - faster is better)
        serviceableCouriers.sort((a, b) => {
          const rateA = typeof a.rate === 'number' ? a.rate : parseFloat(String(a.rate)) || Infinity
          const rateB = typeof b.rate === 'number' ? b.rate : parseFloat(String(b.rate)) || Infinity

          // Primary sort: by rate (lower is better)
          if (rateA !== rateB) {
            return rateA - rateB
          }

          // Secondary sort: by delivery days (faster is better)
          const daysA = a.estimated_delivery_days
            ? parseFloat(String(a.estimated_delivery_days)) || Infinity
            : Infinity
          const daysB = b.estimated_delivery_days
            ? parseFloat(String(b.estimated_delivery_days)) || Infinity
            : Infinity

          return daysA - daysB
        })

        // Use the best courier (first after sorting)
        const selected = serviceableCouriers[0]
        console.log('[sellerGetReturnQuote] Selected courier for return pickup', {
          returnId: id,
          orderId: orderDoc._id,
          courier_id: selected.courier_id,
          courier_name: selected.courier_name,
          rate: selected.rate,
          zone: selected.zone,
          estimated_delivery_days: selected.estimated_delivery_days,
        })
        couriers = [selected]
      } else if (couriers.length > 0) {
        // If no serviceable couriers with rates, just use first one
        couriers = [couriers[0]]
      }

      // For the quote UI, "Pickup Address" should reflect where the courier will
      // go in the reverse flow – i.e. the customer's original shipping address.
      const returnPickupAddress = orderDoc.shippingAddress
        ? {
            warehouseName: undefined,
            addressLine1: orderDoc.shippingAddress.addressLine1,
            addressLine2: orderDoc.shippingAddress.addressLine2,
            city: orderDoc.shippingAddress.city,
            state: orderDoc.shippingAddress.state,
            postalCode: orderDoc.shippingAddress.postalCode,
            country: orderDoc.shippingAddress.country,
            contactName: orderDoc.shippingAddress.name,
            contactPhone: orderDoc.shippingAddress.phone,
          }
        : undefined

      return res.json({
        success: true,
        data: {
          couriers, // Best courier selected (fastest and economical)
          weightGrams: pkgWeight,
          packageDimensions: dims,
          // From UI perspective this is the reverse pickup location (customer).
          pickupAddress: returnPickupAddress,
          rtoAddress,
          originPincode: customerPincode,
          destinationPincode: rtoPincode,
        },
      })
    } catch (error: any) {
      console.error('Error checking return serviceability:', error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to check return serviceability',
      })
    }
  } catch (error: any) {
    console.error('Error getting return quote (seller):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to get return quote' })
  }
}

export const adminGetReturnServiceability = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const ret = await Return.findById(id)
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    // Ensure order ID exists
    if (!ret.order) {
      return res.status(400).json({
        success: false,
        message: 'Return does not have an associated order. Please contact support.',
      })
    }

    // Fetch order directly to ensure all fields are loaded - use lean() to get plain object
    const orderDoc: any = await Order.findById(ret.order).lean()
    if (!orderDoc) {
      return res.status(400).json({
        success: false,
        message: `Order not found for this return. Order ID: ${ret.order}`,
      })
    }

    // Use first seller shipment as pickup address snapshot
    const shipment = orderDoc.sellerShipments?.[0]
    if (!shipment) {
      return res.status(400).json({
        success: false,
        message: 'No seller shipment found for this order',
      })
    }

    // Convert shipment to plain object if it's a Mongoose document
    const shipmentPlain =
      shipment && typeof shipment.toObject === 'function' ? shipment.toObject() : shipment

    // Get seller info for RTO address
    const sellerId = ret.seller
    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: 'Seller not found for this return',
      })
    }

    const seller = await User.findById(sellerId).select('pickupAddresses')
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' })
    }

    // Get pickup address and RTO address
    let pickupAddress = shipmentPlain?.shippingMeta?.pickup_address
    let rtoAddress: {
      contactName?: string
      contactPhone?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    } | null = null

    if (seller?.pickupAddresses && seller.pickupAddresses.length > 0) {
      const kourierBoyzLogisticsPickupId = shipmentPlain?.kourierBoyzLogistics?.kourierBoyzLogisticsPickupAddressId
      let selectedAddress: any = null

      if (kourierBoyzLogisticsPickupId) {
        selectedAddress = seller.pickupAddresses.find(
          (addr: any) => addr.kourierBoyzLogisticsPickupAddressId === kourierBoyzLogisticsPickupId,
        )
      }
      if (!selectedAddress) {
        selectedAddress =
          seller.pickupAddresses.find((addr: any) => addr.isDefault) || seller.pickupAddresses[0]
      }

      if (selectedAddress) {
        if (!pickupAddress) {
          pickupAddress = {
            warehouseName: selectedAddress.warehouseName,
            addressLine1: selectedAddress.addressLine1,
            addressLine2: selectedAddress.addressLine2,
            city: selectedAddress.city,
            state: selectedAddress.state,
            postalCode: selectedAddress.postalCode,
            country: selectedAddress.country,
            contactName: selectedAddress.contactName,
            contactPhone: selectedAddress.contactPhone,
          }
        }

        const rtoSameAsPickup = selectedAddress.rtoSameAsPickup !== false
        const rtoSource =
          rtoSameAsPickup || !selectedAddress.rtoAddress
            ? {
                contactName: selectedAddress.contactName,
                contactPhone: selectedAddress.contactPhone,
                addressLine1: selectedAddress.addressLine1,
                addressLine2: selectedAddress.addressLine2,
                city: selectedAddress.city,
                state: selectedAddress.state,
                postalCode: selectedAddress.postalCode,
                country: selectedAddress.country,
              }
            : {
                contactName: selectedAddress.rtoAddress.contactName,
                contactPhone: selectedAddress.rtoAddress.contactPhone,
                addressLine1: selectedAddress.rtoAddress.addressLine1,
                addressLine2: selectedAddress.rtoAddress.addressLine2,
                city: selectedAddress.rtoAddress.city,
                state: selectedAddress.rtoAddress.state,
                postalCode: selectedAddress.rtoAddress.postalCode,
                country: selectedAddress.rtoAddress.country,
              }

        rtoAddress = {
          contactName: rtoSource.contactName,
          contactPhone: rtoSource.contactPhone,
          addressLine1: rtoSource.addressLine1,
          addressLine2: rtoSource.addressLine2,
          city: rtoSource.city,
          state: rtoSource.state,
          postalCode: rtoSource.postalCode,
          country: rtoSource.country,
        }
      }
    }

    if (!pickupAddress) {
      return res.status(400).json({
        success: false,
        message:
          'Pickup address not available. Please ensure the seller has a pickup address configured.',
      })
    }

    if (!rtoAddress && pickupAddress) {
      rtoAddress = {
        contactName: pickupAddress.contactName,
        contactPhone: pickupAddress.contactPhone,
        addressLine1: pickupAddress.addressLine1,
        addressLine2: pickupAddress.addressLine2,
        city: pickupAddress.city,
        state: pickupAddress.state,
        postalCode: pickupAddress.postalCode,
        country: pickupAddress.country,
      }
    }

    // Use serviceability API instead of quote API for returns
    const pkgWeight = shipmentPlain.shippingMeta?.weight || 500
    const rawDims = shipmentPlain.shippingMeta?.dimensions
    const dims = rawDims
      ? {
          length: rawDims.length ?? 10,
          breadth: rawDims.breadth ?? rawDims.width ?? 10,
          height: rawDims.height ?? 10,
        }
      : { length: 10, breadth: 10, height: 10 }

    const kourierBoyzLogisticsPickupId = shipmentPlain?.kourierBoyzLogistics?.kourierBoyzLogisticsPickupAddressId
    let selectedAddress: any = null

    if (seller?.pickupAddresses && seller.pickupAddresses.length > 0) {
      if (kourierBoyzLogisticsPickupId) {
        selectedAddress = seller.pickupAddresses.find(
          (addr: any) => addr.kourierBoyzLogisticsPickupAddressId === kourierBoyzLogisticsPickupId,
        )
      }
      if (!selectedAddress) {
        selectedAddress =
          seller.pickupAddresses.find((addr: any) => addr.isDefault) || seller.pickupAddresses[0]
      }
    }

    // For returns: origin is customer's address (where pickup happens), destination is seller's RTO
    const customerPincode = orderDoc.shippingAddress?.postalCode
    const rtoPincode = rtoAddress?.postalCode || pickupAddress?.postalCode

    if (!customerPincode || !rtoPincode) {
      return res.status(400).json({
        success: false,
        message: 'Customer or RTO pincode not available for serviceability check',
      })
    }

    // Check serviceability for reverse shipment
    try {
      const serviceabilityRequest = {
        destination: rtoPincode,
        origin: customerPincode,
        pickup_id: selectedAddress?.kourierBoyzLogisticsPickupAddressId,
        payment_type: 'prepaid' as const,
        order_amount: 0,
        weight: pkgWeight,
        length: dims.length,
        breadth: dims.breadth,
        height: dims.height,
        shipment_type: 'b2c' as const,
        is_reverse: true,
      }

      // Use getRates API to get detailed rates (same as order shipments)
      const ratesResponse = await shippingProviderService.getRates(serviceabilityRequest)

      console.log('[adminGetReturnServiceability] Shipping provider rates fetched', {
        returnId: id,
        orderId: orderDoc._id,
        serviceabilityRequest,
        rawData: ratesResponse.data,
      })

      // Extract couriers from rates response
      let couriers: any[] = []
      const responseData = ratesResponse.data
      if (responseData?.rates && Array.isArray(responseData.rates)) {
        couriers = responseData.rates
      } else if (Array.isArray(responseData)) {
        couriers = responseData
      } else if (responseData && typeof responseData === 'object' && 'couriers' in responseData) {
        couriers = Array.isArray(responseData.couriers) ? responseData.couriers : []
      } else if (responseData && typeof responseData === 'object' && 'courier' in responseData) {
        couriers = responseData.courier ? [responseData.courier] : []
      } else if (responseData && typeof responseData === 'object' && 'courier_id' in responseData) {
        // Single courier object
        couriers = [responseData]
      }

      // Normalize rate for reverse shipments (we use forward rate for pickup charges)
      couriers = couriers.map((c) => ({
        ...c,
        rate: normalizeReverseCourierRate(c),
      }))

      // Filter serviceable couriers and select the best one (fastest and economical)
      // Best courier = lowest rate, then fastest delivery (if rates are similar)
      const serviceableCouriers = couriers.filter(
        (c) => c.serviceable !== false && (c.rate !== undefined || c.rate === 0),
      )

      if (serviceableCouriers.length > 0) {
        // Sort by: 1) rate (ascending - lower is better), 2) estimated delivery days (ascending - faster is better)
        serviceableCouriers.sort((a, b) => {
          const rateA = typeof a.rate === 'number' ? a.rate : parseFloat(String(a.rate)) || Infinity
          const rateB = typeof b.rate === 'number' ? b.rate : parseFloat(String(b.rate)) || Infinity

          // Primary sort: by rate (lower is better)
          if (rateA !== rateB) {
            return rateA - rateB
          }

          // Secondary sort: by delivery days (faster is better)
          const daysA = a.estimated_delivery_days
            ? parseFloat(String(a.estimated_delivery_days)) || Infinity
            : Infinity
          const daysB = b.estimated_delivery_days
            ? parseFloat(String(b.estimated_delivery_days)) || Infinity
            : Infinity

          return daysA - daysB
        })

        // Use the best courier (first after sorting)
        const selected = serviceableCouriers[0]
        console.log('[adminGetReturnServiceability] Selected courier for return pickup', {
          returnId: id,
          orderId: orderDoc._id,
          courier_id: selected.courier_id,
          courier_name: selected.courier_name,
          rate: selected.rate,
          zone: selected.zone,
          estimated_delivery_days: selected.estimated_delivery_days,
        })
        couriers = [selected]
      } else if (couriers.length > 0) {
        // If no serviceable couriers with rates, just use first one
        couriers = [couriers[0]]
      }

      const returnPickupAddress = orderDoc.shippingAddress
        ? {
            warehouseName: undefined,
            addressLine1: orderDoc.shippingAddress.addressLine1,
            addressLine2: orderDoc.shippingAddress.addressLine2,
            city: orderDoc.shippingAddress.city,
            state: orderDoc.shippingAddress.state,
            postalCode: orderDoc.shippingAddress.postalCode,
            country: orderDoc.shippingAddress.country,
            contactName: orderDoc.shippingAddress.name,
            contactPhone: orderDoc.shippingAddress.phone,
          }
        : undefined

      return res.json({
        success: true,
        data: {
          couriers, // Best courier selected (fastest and economical)
          weightGrams: pkgWeight,
          packageDimensions: dims,
          pickupAddress: returnPickupAddress,
          rtoAddress,
          originPincode: customerPincode,
          destinationPincode: rtoPincode,
        },
      })
    } catch (error: any) {
      console.error('Error checking return serviceability (admin):', error)
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to check return serviceability',
      })
    }
  } catch (error: any) {
    console.error('Error getting return serviceability (admin):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to get return serviceability' })
  }
}

export const sellerConfirmReturnApproval = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const { id } = req.params
    const { weightGrams, packageDimensions, courier_id } = req.body as {
      weightGrams?: number
      packageDimensions?: { length: number; breadth: number; height: number }
      courier_id?: number
    }

    const ret = await Return.findOne({ _id: id, seller: sellerId })
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    // Allow confirm-approve when status is REQUESTED (seller approving) or APPROVED_BY_ADMIN (admin already approved)
    if (ret.status !== 'REQUESTED' && ret.status !== 'APPROVED_BY_ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Return can only be confirmed when status is REQUESTED or APPROVED_BY_ADMIN',
      })
    }

    // Ensure order ID exists
    if (!ret.order) {
      console.error('[sellerConfirmReturnApproval] Return has no order ID:', {
        returnId: id,
        return: ret.toObject ? ret.toObject() : ret,
      })
      return res.status(400).json({
        success: false,
        message: 'Return does not have an associated order. Please contact support.',
      })
    }

    // Fetch order directly to ensure all fields are loaded - use lean() to get plain object
    const orderDoc: any = await Order.findById(ret.order).lean()
    if (!orderDoc) {
      console.error('[sellerConfirmReturnApproval] Order not found for return:', {
        returnId: id,
        orderId: ret.order,
        orderIdType: typeof ret.order,
      })
      return res.status(400).json({
        success: false,
        message: `Order not found for this return. Order ID: ${ret.order}`,
      })
    }

    // Use first seller shipment as pickup address snapshot
    const shipment = orderDoc.sellerShipments?.[0]

    if (!shipment) {
      console.error('No seller shipment found for return confirmation:', {
        returnId: id,
        orderId: orderDoc._id,
        hasSellerShipments: !!orderDoc.sellerShipments,
        sellerShipmentsLength: orderDoc.sellerShipments?.length || 0,
      })
      return res.status(400).json({
        success: false,
        message: 'No seller shipment found for this order',
      })
    }

    // Convert shipment to plain object if it's a Mongoose document
    const shipmentPlain =
      shipment && typeof shipment.toObject === 'function' ? shipment.toObject() : shipment

    // Get pickup address from shippingMeta, or fallback to seller's pickup addresses
    let pickupAddress = shipmentPlain?.shippingMeta?.pickup_address

    if (!pickupAddress) {
      // Fallback: Get pickup address from seller's stored addresses
      const seller = await User.findById(sellerId).select('pickupAddresses')
      if (seller?.pickupAddresses && seller.pickupAddresses.length > 0) {
        // Try to find the address that matches kourierBoyzLogisticsPickupAddressId if available
        const kourierBoyzLogisticsPickupId = shipmentPlain?.kourierBoyzLogistics?.kourierBoyzLogisticsPickupAddressId
        let selectedAddress = null

        if (kourierBoyzLogisticsPickupId) {
          selectedAddress = seller.pickupAddresses.find(
            (addr: any) => addr.kourierBoyzLogisticsPickupAddressId === kourierBoyzLogisticsPickupId,
          )
        }

        // If not found, use default or first address
        if (!selectedAddress) {
          selectedAddress =
            seller.pickupAddresses.find((addr: any) => addr.isDefault) || seller.pickupAddresses[0]
        }

        if (selectedAddress) {
          pickupAddress = {
            warehouseName: selectedAddress.warehouseName,
            addressLine1: selectedAddress.addressLine1,
            addressLine2: selectedAddress.addressLine2,
            city: selectedAddress.city,
            state: selectedAddress.state,
            postalCode: selectedAddress.postalCode,
            country: selectedAddress.country,
            contactName: selectedAddress.contactName,
            contactPhone: selectedAddress.contactPhone,
          }
        }
      }

      if (!pickupAddress) {
        console.error(
          'Pickup address not found in shipment or seller addresses for return confirmation:',
          {
            returnId: id,
            orderId: orderDoc._id,
            hasShippingMeta: !!shipmentPlain?.shippingMeta,
            shippingMetaKeys: shipmentPlain?.shippingMeta
              ? Object.keys(shipmentPlain.shippingMeta)
              : [],
            hasSellerPickupAddresses: !!seller?.pickupAddresses,
            pickupAddressesCount: seller?.pickupAddresses?.length || 0,
          },
        )
        return res.status(400).json({
          success: false,
          message:
            'Pickup address not available. Please ensure the seller has a pickup address configured.',
        })
      }
    }

    // Verify that order was shipped through the active shipping provider
    if (!shipmentPlain?.kourierBoyzLogistics?.order_id && !shipmentPlain?.kourierBoyzLogistics?.order_number) {
      console.error('Shipping provider shipment data not found for return confirmation:', {
        returnId: id,
        orderId: orderDoc._id,
        shipmentKourierBoyzLogistics: shipmentPlain?.kourierBoyzLogistics,
        hasKourierBoyzLogistics: !!shipmentPlain?.kourierBoyzLogistics,
      })
      return res.status(400).json({
        success: false,
        message:
          'Order was not shipped through the active shipping provider. Return can only be confirmed for shipped orders.',
      })
    }

    // Create a new shipment for return (instead of return order)
    // For returns: pickup from customer address, deliver to seller RTO address
    const pkgWeight = weightGrams || shipmentPlain.shippingMeta?.weight || 500
    const dims = packageDimensions ||
      shipmentPlain.shippingMeta?.dimensions || {
        length: 10,
        breadth: 10,
        height: 10,
      }

    // Get seller info for RTO address
    const seller = await User.findById(sellerId).select(
      'pickupAddresses businessName name gstNumber email',
    )
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' })
    }

    // Get RTO address (where return will be delivered)
    let rtoAddressForReturn: {
      contactName?: string
      contactPhone?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    } | null = null

    if (seller.pickupAddresses && seller.pickupAddresses.length > 0) {
      const kourierBoyzLogisticsPickupId = shipmentPlain?.kourierBoyzLogistics?.kourierBoyzLogisticsPickupAddressId
      let selectedAddress: any = null

      if (kourierBoyzLogisticsPickupId) {
        selectedAddress = seller.pickupAddresses.find(
          (addr: any) => addr.kourierBoyzLogisticsPickupAddressId === kourierBoyzLogisticsPickupId,
        )
      }
      if (!selectedAddress) {
        selectedAddress =
          seller.pickupAddresses.find((addr: any) => addr.isDefault) || seller.pickupAddresses[0]
      }

      if (selectedAddress) {
        const rtoSameAsPickup = selectedAddress.rtoSameAsPickup !== false
        const rtoSource =
          rtoSameAsPickup || !selectedAddress.rtoAddress
            ? {
                contactName: selectedAddress.contactName,
                contactPhone: selectedAddress.contactPhone,
                addressLine1: selectedAddress.addressLine1,
                addressLine2: selectedAddress.addressLine2,
                city: selectedAddress.city,
                state: selectedAddress.state,
                postalCode: selectedAddress.postalCode,
                country: selectedAddress.country,
              }
            : {
                contactName: selectedAddress.rtoAddress.contactName,
                contactPhone: selectedAddress.rtoAddress.contactPhone,
                addressLine1: selectedAddress.rtoAddress.addressLine1,
                addressLine2: selectedAddress.rtoAddress.addressLine2,
                city: selectedAddress.rtoAddress.city,
                state: selectedAddress.rtoAddress.state,
                postalCode: selectedAddress.rtoAddress.postalCode,
                country: selectedAddress.rtoAddress.country,
              }

        rtoAddressForReturn = {
          contactName: rtoSource.contactName,
          contactPhone: rtoSource.contactPhone,
          addressLine1: rtoSource.addressLine1,
          addressLine2: rtoSource.addressLine2,
          city: rtoSource.city,
          state: rtoSource.state,
          postalCode: rtoSource.postalCode,
          country: rtoSource.country,
        }
      }
    }

    if (!rtoAddressForReturn) {
      return res.status(400).json({
        success: false,
        message:
          'RTO address not available. Please ensure the seller has a pickup address configured.',
      })
    }

    // Get courier_id from request body (should be selected from serviceability response)
    if (!courier_id) {
      return res.status(400).json({
        success: false,
        message: 'Courier ID is required. Please select a courier from serviceability options.',
      })
    }

    // Create shipment payload for return
    // IMPORTANT: Return shipments use order_number starting with "RET-" prefix
    // These shipments are NOT added to Order.sellerShipments array
    // They are only stored in Return model (courierReverseAwb, courierReverseId, etc.)
    // This ensures return shipments only appear in Returns section, not in regular Orders
    // For returns: consignee = seller RTO (where it's delivered), pickup = customer address (where courier picks up)
    const shipmentPayload = {
      order_number: buildReturnShipmentOrderNumber({
        orderNumber: orderDoc.orderNumber,
        orderId: orderDoc._id?.toString(),
        returnId: ret._id?.toString(),
      }),
      original_order_id:
        shipmentPlain?.kourierBoyzLogistics?.order_id ||
        shipmentPlain?.kourierBoyzLogistics?.order_number ||
        String(orderDoc._id),
      original_order_number:
        shipmentPlain?.kourierBoyzLogistics?.order_number || orderDoc.orderNumber || String(orderDoc._id),
      payment_type: 'prepaid' as const, // Returns are prepaid
      order_amount: 0, // Return shipments have no order amount
      package_weight: pkgWeight,
      package_length: dims.length,
      package_breadth: dims.breadth,
      package_height: dims.height,
      courier_id: courier_id,
      consignee: {
        name: rtoAddressForReturn.contactName || seller.businessName || seller.name || 'Seller',
        company_name: seller.businessName || seller.name,
        address: rtoAddressForReturn.addressLine1 || '',
        address_2: rtoAddressForReturn.addressLine2,
        city: rtoAddressForReturn.city || '',
        state: rtoAddressForReturn.state || '',
        pincode: rtoAddressForReturn.postalCode || '',
        phone: rtoAddressForReturn.contactPhone || '',
        email: seller.email || '',
      },
      pickup: {
        warehouse_name: undefined,
        name: orderDoc.shippingAddress?.name || 'Customer',
        address: orderDoc.shippingAddress?.addressLine1 || '',
        address_2: orderDoc.shippingAddress?.addressLine2,
        city: orderDoc.shippingAddress?.city || '',
        state: orderDoc.shippingAddress?.state || '',
        pincode: orderDoc.shippingAddress?.postalCode || '',
        phone: orderDoc.shippingAddress?.phone || '',
        gst_number: seller.gstNumber,
      },
      order_items: (orderDoc.items || []).map((item: any) => ({
        name: item.product?.name || 'Product',
        sku: item.variant?.sku || item.product?.sku,
        qty: item.quantity,
        price: item.price || 0,
        hsn: undefined,
        discount: item.discountAmount || 0,
        tax_rate: 0,
      })),
      invoice_number: `RET-${orderDoc.orderNumber || orderDoc._id}`,
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_amount: 0,
      shipping_charges: 0,
      discount: 0,
      gift_wrap: 0,
      request_auto_pickup: 'yes' as const,
      reason: ret.reason,
      customer_request: ret.returnType === 'replacement' ? 'REPLACEMENT' : 'REFUND',
      reason_comment: ret.description,
      company: {
        name: seller.businessName || seller.name,
        gst: seller.gstNumber,
      },
    }

    // Log context for debugging reverse shipment creation
    console.info('[Shipmozo][Return] createShipment request', {
      returnId: ret._id?.toString?.(),
      orderId: orderDoc._id?.toString?.(),
      sellerId,
      courierId: courier_id,
      payload: {
        order_number: shipmentPayload.order_number,
        payment_type: shipmentPayload.payment_type,
        package_weight: shipmentPayload.package_weight,
        package_length: shipmentPayload.package_length,
        package_breadth: shipmentPayload.package_breadth,
        package_height: shipmentPayload.package_height,
        courier_id: shipmentPayload.courier_id,
        consignee: shipmentPayload.consignee,
        pickup: shipmentPayload.pickup,
        itemCount: Array.isArray(shipmentPayload.order_items)
          ? shipmentPayload.order_items.length
          : 0,
      },
    })

    const response = await shippingProviderService.createReturnOrder(shipmentPayload)
    const shipmentData = response.data

    console.info('[Shipmozo][Return] createShipment response', {
      returnId: ret._id?.toString?.(),
      orderId: orderDoc._id?.toString?.(),
      success: response.success,
      status: shipmentData?.status,
      awb_number: shipmentData?.awb_number,
      order_id: shipmentData?.order_id,
      order_number: shipmentData?.order_number,
      courier_partner: shipmentData?.courier_partner,
    })

    const data = shipmentData

    // Only now, after successful reverse shipment creation, update our return.
    // IMPORTANT: Return shipment data is stored ONLY in Return model, NOT in Order.sellerShipments
    // This ensures return shipments only appear in Returns section, not in regular Orders
    ret.courierReverseAwb = data?.awb_number
    ret.courierReverseId = data?.order_id
    ret.courierPartner = data?.courier_partner
    // For shipments, we need to get the rate from serviceability or store it separately
    // For now, we'll leave reverseCharges as is (can be updated later if needed)

    // Handle status transition based on current status
    // If REQUESTED: transition through APPROVED_BY_SELLER to REVERSE_PICKUP_CREATED
    // If APPROVED_BY_ADMIN: directly transition to REVERSE_PICKUP_CREATED (admin already approved)
    if (ret.status === 'REQUESTED') {
      ret.status = 'APPROVED_BY_SELLER'
      appendReturnTimeline(ret, 'APPROVED_BY_SELLER', 'Return approved by seller')
    }
    ret.status = 'REVERSE_PICKUP_CREATED'
    appendReturnTimeline(ret, 'REVERSE_PICKUP_CREATED', 'Reverse pickup created with courier')

    // Generate manifest for the reverse shipment so that labels/invoices are ready.
    try {
      const manifestRequest: ShippingManifestRequest = {
        order_numbers: [data?.order_number || ret.courierReverseId || ''],
        type: 'b2c',
      }

      const manifestResponse = await shippingProviderService.generateManifest(manifestRequest)
      const manifestData = manifestResponse.data
      if (manifestData?.manifest_id || manifestData?.manifest_url) {
        // We don't yet have dedicated fields on Return for manifest; for now
        // just log the manifest details for debugging/ops.
        console.info('[Shipmozo] reverse manifest step completed', {
          returnId: ret._id?.toString?.(),
          orderId: orderDoc._id?.toString?.(),
          reverseAwb: ret.courierReverseAwb,
          manifest_id: manifestData.manifest_id,
          manifest_url: manifestData.manifest_url,
          manifest_key: manifestData.manifest_key,
        })
      }
    } catch (manifestError: any) {
      // Manifest failure should not block return creation; log and continue.
      console.error(
        '[Shipmozo] Failed to finalize reverse manifest step',
        manifestError?.response?.data || manifestError?.message || manifestError,
      )
    }

    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    // Notify customer
    try {
      const order = await Order.findById(ret.order).populate('user', 'name email')
      const buyer: any = order?.user
      const buyerEmail = buyer?.email
      const buyerName = buyer?.name || order?.shippingAddress?.name || 'Customer'
      if (buyerEmail) {
        const subject = `Your return request for order ${
          order?.orderNumber || ''
        } was approved by seller`
        const body = emailTemplates.orderStatusUpdateBuyer(buyerName, {
          orderNumber: order?.orderNumber || 'N/A',
          statusLabel: 'Return Approved by Seller',
          message:
            'The seller has approved your return request and a reverse pickup has been created. Our team will process the next steps shortly.',
        })
        void sendEmail(buyerEmail, subject, body)
      }
    } catch {
      // ignore
    }

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error confirming return approval (seller):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to confirm return approval' })
  }
}

export const listAdminReturns = async (req: Request, res: Response) => {
  try {
    const { status, page = 1, limit = 20, orderId } = req.query as any

    const query: any = {}
    if (status) {
      query.status = status
    }
    if (orderId) {
      query.order = toObjectId(orderId)
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [returns, total] = await Promise.all([
      Return.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        // Keep payload lean for admin listing; modal can still use timeline/images from here
        .select(
          'order seller customer reason description images status refundAmount returnType exchangeVariantId exchangeOrderId courierReverseAwb courierReverseId courierPartner reverseCharges settlementAdjustment creditNote timeline createdAt',
        )
        .populate('order', 'orderNumber status total')
        .populate('seller', 'name businessName')
        .populate('customer', 'name email')
        .populate({
          path: 'exchangeVariantId',
          select: 'name sku price effectivePrice stock attributes mainImage images',
        })
        .populate({
          path: 'exchangeOrderId',
          select: 'orderNumber status total items',
        })
        .lean()
        .exec(),
      Return.countDocuments(query),
    ])

    return res.json({
      success: true,
      data: returns,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error listing admin returns:', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to fetch returns' })
  }
}

export const adminApproveReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const ret = await Return.findById(id)
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    ret.status = 'APPROVED_BY_ADMIN'
    appendReturnTimeline(ret, 'APPROVED_BY_ADMIN', 'Return approved by admin')
    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error approving return (admin):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to approve return' })
  }
}

export const adminRejectReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body as { reason?: string }
    const ret = await Return.findById(id)
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    ret.status = 'REJECTED'
    appendReturnTimeline(
      ret,
      'REJECTED',
      reason ? `Return rejected by admin: ${reason}` : 'Return rejected by admin',
    )
    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error rejecting return (admin):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to reject return' })
  }
}

/**
 * Admin can cancel return request
 * Can only cancel if:
 * - Status is REQUESTED (before approval)
 * - Status is APPROVED_BY_SELLER or APPROVED_BY_ADMIN (approved but pickup not created)
 * Cannot cancel once REVERSE_PICKUP_CREATED or later
 */
export const adminCancelReturn = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body as { reason?: string }
    const ret = await Return.findById(id)
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    // Check if return can be cancelled
    const cancellableStatuses = ['REQUESTED', 'APPROVED_BY_SELLER', 'APPROVED_BY_ADMIN']
    if (!cancellableStatuses.includes(ret.status)) {
      return res.status(400).json({
        success: false,
        message: `Return cannot be cancelled. Current status: ${ret.status}. Only returns with status REQUESTED, APPROVED_BY_SELLER, or APPROVED_BY_ADMIN can be cancelled.`,
      })
    }

    // Check if pickup has been created (even if status allows, if pickup exists, don't allow cancellation)
    if (ret.courierReverseId || ret.courierReverseAwb) {
      return res.status(400).json({
        success: false,
        message: 'Return cannot be cancelled because reverse pickup has already been created.',
      })
    }

    // Update status to CANCELLED (we'll use REJECTED status but with a cancellation message)
    // Or we could add a CANCELLED status, but for now let's use REJECTED with a clear message
    ret.status = 'REJECTED'
    appendReturnTimeline(
      ret,
      'REJECTED',
      reason
        ? `Return cancelled by admin: ${reason}`
        : 'Return cancelled by admin (before pickup was created)',
    )
    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    // Notify customer about cancellation
    try {
      const order = await Order.findById(ret.order).populate('user', 'name email')
      const buyer: any = order?.user
      const buyerEmail = buyer?.email
      const buyerName = buyer?.name || order?.shippingAddress?.name || 'Customer'
      if (buyerEmail) {
        const subject = `Return request cancelled for order ${order?.orderNumber || ''}`
        const body = emailTemplates.orderStatusUpdateBuyer(buyerName, {
          orderNumber: order?.orderNumber || 'N/A',
          statusLabel: 'Return Cancelled',
          message:
            reason ||
            'Your return request has been cancelled by admin. If you have questions, please contact support.',
        })
        void sendEmail(buyerEmail, subject, body)
      }
    } catch {
      // ignore notification errors
    }

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error cancelling return (admin):', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to cancel return' })
  }
}

export const adminCreateReversePickup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { weightGrams, packageDimensions, courier_id } = req.body as {
      weightGrams?: number
      packageDimensions?: { length: number; breadth: number; height: number }
      courier_id?: number
    }

    const ret = await Return.findById(id).populate('order')
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    const orderDoc: any = ret.order
    if (!orderDoc) {
      return res.status(400).json({ success: false, message: 'Order not loaded for this return' })
    }

    // Use first seller shipment as pickup address snapshot
    const shipment = orderDoc.sellerShipments?.[0]
    if (!shipment) {
      return res.status(400).json({
        success: false,
        message: 'No seller shipment found for this order',
      })
    }

    // Convert shipment to plain object if it's a Mongoose document
    const shipmentPlain =
      shipment && typeof shipment.toObject === 'function' ? shipment.toObject() : shipment

    const pkgWeight = weightGrams || shipmentPlain.shippingMeta?.weight || 500
    const dims = packageDimensions ||
      shipmentPlain.shippingMeta?.dimensions || {
        length: 10,
        breadth: 10,
        height: 10,
      }

    // Get seller info for RTO address
    const sellerId = ret.seller
    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: 'Seller not found for this return',
      })
    }

    const seller = await User.findById(sellerId).select(
      'pickupAddresses businessName name gstNumber email',
    )
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' })
    }

    // Get RTO address (where return will be delivered)
    let rtoAddressForReturn: {
      contactName?: string
      contactPhone?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
    } | null = null

    if (seller.pickupAddresses && seller.pickupAddresses.length > 0) {
      const kourierBoyzLogisticsPickupId = shipmentPlain?.kourierBoyzLogistics?.kourierBoyzLogisticsPickupAddressId
      let selectedAddress: any = null

      if (kourierBoyzLogisticsPickupId) {
        selectedAddress = seller.pickupAddresses.find(
          (addr: any) => addr.kourierBoyzLogisticsPickupAddressId === kourierBoyzLogisticsPickupId,
        )
      }
      if (!selectedAddress) {
        selectedAddress =
          seller.pickupAddresses.find((addr: any) => addr.isDefault) || seller.pickupAddresses[0]
      }

      if (selectedAddress) {
        const rtoSameAsPickup = selectedAddress.rtoSameAsPickup !== false
        const rtoSource =
          rtoSameAsPickup || !selectedAddress.rtoAddress
            ? {
                contactName: selectedAddress.contactName,
                contactPhone: selectedAddress.contactPhone,
                addressLine1: selectedAddress.addressLine1,
                addressLine2: selectedAddress.addressLine2,
                city: selectedAddress.city,
                state: selectedAddress.state,
                postalCode: selectedAddress.postalCode,
                country: selectedAddress.country,
              }
            : {
                contactName: selectedAddress.rtoAddress.contactName,
                contactPhone: selectedAddress.rtoAddress.contactPhone,
                addressLine1: selectedAddress.rtoAddress.addressLine1,
                addressLine2: selectedAddress.rtoAddress.addressLine2,
                city: selectedAddress.rtoAddress.city,
                state: selectedAddress.rtoAddress.state,
                postalCode: selectedAddress.rtoAddress.postalCode,
                country: selectedAddress.rtoAddress.country,
              }

        rtoAddressForReturn = {
          contactName: rtoSource.contactName,
          contactPhone: rtoSource.contactPhone,
          addressLine1: rtoSource.addressLine1,
          addressLine2: rtoSource.addressLine2,
          city: rtoSource.city,
          state: rtoSource.state,
          postalCode: rtoSource.postalCode,
          country: rtoSource.country,
        }
      }
    }

    if (!rtoAddressForReturn) {
      return res.status(400).json({
        success: false,
        message:
          'RTO address not available. Please ensure the seller has a pickup address configured.',
      })
    }

    // Get courier_id from request body (should be selected from serviceability response)
    if (!courier_id) {
      return res.status(400).json({
        success: false,
        message: 'Courier ID is required. Please select a courier from serviceability options.',
      })
    }

    // Create shipment payload for return
    // IMPORTANT: Return shipments use order_number starting with "RET-" prefix
    // These shipments are NOT added to Order.sellerShipments array
    // They are only stored in Return model (courierReverseAwb, courierReverseId, etc.)
    // This ensures return shipments only appear in Returns section, not in regular Orders
    // For returns: consignee = seller RTO (where it's delivered), pickup = customer address (where courier picks up)
    const shipmentPayload = {
      order_number: buildReturnShipmentOrderNumber({
        orderNumber: orderDoc.orderNumber,
        orderId: orderDoc._id?.toString(),
        returnId: ret._id?.toString(),
      }),
      original_order_id:
        shipmentPlain?.kourierBoyzLogistics?.order_id ||
        shipmentPlain?.kourierBoyzLogistics?.order_number ||
        String(orderDoc._id),
      original_order_number:
        shipmentPlain?.kourierBoyzLogistics?.order_number || orderDoc.orderNumber || String(orderDoc._id),
      payment_type: 'prepaid' as const, // Returns are prepaid
      order_amount: 0, // Return shipments have no order amount
      package_weight: pkgWeight,
      package_length: dims.length,
      package_breadth: dims.breadth,
      package_height: dims.height,
      courier_id: courier_id,
      consignee: {
        name: rtoAddressForReturn.contactName || seller.businessName || seller.name || 'Seller',
        company_name: seller.businessName || seller.name,
        address: rtoAddressForReturn.addressLine1 || '',
        address_2: rtoAddressForReturn.addressLine2,
        city: rtoAddressForReturn.city || '',
        state: rtoAddressForReturn.state || '',
        pincode: rtoAddressForReturn.postalCode || '',
        phone: rtoAddressForReturn.contactPhone || '',
        email: seller.email || '',
      },
      pickup: {
        warehouse_name: undefined,
        name: orderDoc.shippingAddress?.name || 'Customer',
        address: orderDoc.shippingAddress?.addressLine1 || '',
        address_2: orderDoc.shippingAddress?.addressLine2,
        city: orderDoc.shippingAddress?.city || '',
        state: orderDoc.shippingAddress?.state || '',
        pincode: orderDoc.shippingAddress?.postalCode || '',
        phone: orderDoc.shippingAddress?.phone || '',
        gst_number: seller.gstNumber,
      },
      order_items: (orderDoc.items || []).map((item: any) => ({
        name: item.product?.name || 'Product',
        sku: item.variant?.sku || item.product?.sku,
        qty: item.quantity,
        price: item.price || 0,
        hsn: undefined,
        discount: item.discountAmount || 0,
        tax_rate: 0,
      })),
      invoice_number: `RET-${orderDoc.orderNumber || orderDoc._id}`,
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_amount: 0,
      shipping_charges: 0,
      discount: 0,
      gift_wrap: 0,
      request_auto_pickup: 'yes' as const,
      reason: ret.reason,
      customer_request: ret.returnType === 'replacement' ? 'REPLACEMENT' : 'REFUND',
      reason_comment: ret.description,
      company: {
        name: seller.businessName || seller.name,
        gst: seller.gstNumber,
      },
    }

    console.info('[Shipmozo][Return][Admin] createShipment request', {
      returnId: ret._id?.toString?.(),
      orderId: orderDoc._id?.toString?.(),
      sellerId,
      courierId: courier_id,
      payload: {
        order_number: shipmentPayload.order_number,
        payment_type: shipmentPayload.payment_type,
        package_weight: shipmentPayload.package_weight,
        courier_id: shipmentPayload.courier_id,
      },
    })

    const response = await shippingProviderService.createReturnOrder(shipmentPayload)
    const shipmentData = response.data

    console.info('[Shipmozo][Return][Admin] createShipment response', {
      returnId: ret._id?.toString?.(),
      orderId: orderDoc._id?.toString?.(),
      success: response.success,
      status: shipmentData?.status,
      awb_number: shipmentData?.awb_number,
      order_id: shipmentData?.order_id,
    })

    const data = shipmentData

    // IMPORTANT: Return shipment data is stored ONLY in Return model, NOT in Order.sellerShipments
    // This ensures return shipments only appear in Returns section, not in regular Orders
    ret.courierReverseAwb = data?.awb_number
    ret.courierReverseId = data?.order_id
    ret.courierPartner = data?.courier_partner
    // For shipments, we need to get the rate from serviceability or store it separately
    // For now, we'll leave reverseCharges as is (can be updated later if needed)
    ret.status = 'REVERSE_PICKUP_CREATED'
    appendReturnTimeline(ret, 'REVERSE_PICKUP_CREATED', 'Reverse pickup created with courier')

    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    // Notify seller about reverse pickup
    try {
      const order = await Order.findById(ret.order).populate(
        'sellerShipments.seller',
        'name businessName email supportEmail',
      )
      const shipment: any = order?.sellerShipments?.[0]
      const seller: any = shipment?.seller
      const sellerEmail = seller?.supportEmail || seller?.email
      const sellerName = seller?.businessName || seller?.name || 'Seller'
      if (sellerEmail) {
        const subject = `Reverse pickup created for order ${order?.orderNumber || ''}`
        const body = emailTemplates.sellerShipmentStatusUpdate(sellerName, {
          orderNumber: order?.orderNumber || 'N/A',
          statusLabel: 'Reverse Pickup Created',
          message: `A reverse pickup has been created for a return on this order. AWB: ${
            ret.courierReverseAwb || data?.awb_number || 'N/A'
          }.`,
        })
        void sendEmail(sellerEmail, subject, body)
      }
    } catch {
      // ignore notification errors
    }

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error creating reverse pickup:', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to create reverse pickup' })
  }
}

/**
 * REPLACEMENT FLOW DOCUMENTATION FOR SELLERS
 * ===========================================
 *
 * This function handles the critical step of marking a return as received by the seller.
 * For replacement requests, this triggers the creation of a replacement order.
 *
 * REPLACEMENT FLOW STEPS:
 * -----------------------
 * 1. Customer requests replacement → Status: REQUESTED
 * 2. Seller approves replacement → Status: APPROVED_BY_SELLER
 * 3. Admin creates reverse pickup → Status: REVERSE_PICKUP_CREATED
 * 4. Courier picks up item → Status: REVERSE_PICKUP_IN_TRANSIT
 * 5. Item delivered to seller → Status: REVERSE_PICKUP_COMPLETED
 * 6. Seller/Admin marks as received → THIS FUNCTION → Status: RETURN_RECEIVED_BY_SELLER
 * 7. System auto-creates replacement order (₹0 value, linked to original order)
 * 8. Seller ships replacement → Normal order fulfillment process
 *
 * IMPORTANT FOR SELLERS:
 * ----------------------
 * - Replacement orders have ₹0 total (no payment collection)
 * - Replacement orders do NOT affect your earnings/payouts
 * - Replacement orders are for logistics only (fulfillment tracking)
 * - Original order settlement remains unchanged
 * - Stock is deducted when replacement order is created
 * - You ship replacement like a normal order (generate label, ship, track)
 *
 * REPLACEMENT ORDER DETAILS:
 * ---------------------------
 * - Order Number: ORD-XXXXX-R1, ORD-XXXXX-R2 (for multiple replacements)
 * - Total Amount: ₹0 (no COD, no payment)
 * - Payment Status: Paid (pre-paid, no collection needed)
 * - Linked to: Original order ID and Return ID
 * - Visible in: Your order list (tagged as replacement)
 * - Settlement: Excluded from all payout calculations
 */
export const adminMarkReturnReceived = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const ret = await Return.findById(id)
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    // CRITICAL: Verify pickup was completed before marking as received
    // Only proceed if reverse pickup was completed (delivered to seller)
    // This gate ensures returns/replacements are only marked as received after successful delivery
    // For replacements: Also ensures replacement orders are only created after pickup completion
    const validStatusesForMarkingReceived = [
      'REVERSE_PICKUP_COMPLETED',
      'RETURN_RECEIVED_BY_SELLER',
    ]
    if (!validStatusesForMarkingReceived.includes(ret.status)) {
      return res.status(400).json({
        success: false,
        message:
          'Reverse pickup must be completed (delivered to seller) before return can be marked as received. Current status: ' +
          ret.status +
          '. Expected status: REVERSE_PICKUP_COMPLETED',
      })
    }

    // If already marked as received, don't do anything (idempotent)
    if (ret.status === 'RETURN_RECEIVED_BY_SELLER') {
      return res.json({ success: true, data: ret, message: 'Return already marked as received' })
    }

    ret.status = 'RETURN_RECEIVED_BY_SELLER'
    appendReturnTimeline(ret, 'RETURN_RECEIVED_BY_SELLER', 'Returned item received by seller')

    // If this is a replacement/exchange, create the replacement order
    // ONLY after pickup is confirmed received by seller
    if (ret.returnType === 'replacement' && ret.exchangeVariantId && !ret.exchangeOrderId) {
      try {
        const originalOrder = await Order.findById(ret.order)
          .populate('items.product')
          .populate('items.variant')
          .exec()

        if (originalOrder) {
          const orderItem = ret.orderItem
            ? originalOrder.items.find((item: any) => String(item._id) === String(ret.orderItem))
            : originalOrder.items[0]

          if (orderItem) {
            const Product = mongoose.model('Product')
            const ProductVariant = mongoose.model('ProductVariant')

            // For simple products (no variants), exchangeVariantId is actually the product ID
            let exchangeVariant = await ProductVariant.findById(ret.exchangeVariantId)
              .select('effectivePrice price hsnSacCode gstRatePercent igstRatePercent sku name')
              .lean()

            // If not found as a variant, check if it's a product ID (for simple products)
            if (!exchangeVariant) {
              const exchangeProduct = (await Product.findById(ret.exchangeVariantId)
                .select('effectivePrice price hsnSacCode gstRatePercent hasVariants sku name')
                .lean()) as any

              if (exchangeProduct && !exchangeProduct.hasVariants) {
                // This is a simple product, use it as the replacement "variant"
                exchangeVariant = {
                  _id: exchangeProduct._id,
                  effectivePrice: exchangeProduct.effectivePrice,
                  price: exchangeProduct.price,
                  hsnSacCode: exchangeProduct.hsnSacCode,
                  gstRatePercent: exchangeProduct.gstRatePercent,
                  igstRatePercent: exchangeProduct.gstRatePercent, // Use same GST rate for IGST
                  sku: exchangeProduct.sku,
                  name: exchangeProduct.name,
                } as any
              }
            }

            const product = await Product.findById(orderItem.product)
              .select('hsnSacCode gstRatePercent')
              .lean()

            if (exchangeVariant && product) {
              // Type assertion for lean query result
              const variant = exchangeVariant as any
              const productData = product as any

              // Calculate replacement price
              const replacementPrice = variant.effectivePrice || variant.price || 0
              const originalPrice = orderItem.effectivePrice || orderItem.price || 0

              // Validate price (should already be validated, but double-check)
              if (replacementPrice > originalPrice) {
                throw new Error('Replacement variant price cannot be higher than original')
              }

              // Calculate GST amounts for replacement item (same logic as order creation)
              const hsnSacCode = variant.hsnSacCode || productData.hsnSacCode
              const gstRatePercent =
                variant.gstRatePercent || variant.igstRatePercent || productData.gstRatePercent

              let priceWithoutTax = replacementPrice
              let igst: number | undefined = undefined
              let cgst: number | undefined = undefined
              let sgst: number | undefined = undefined

              if (gstRatePercent !== undefined && gstRatePercent > 0) {
                priceWithoutTax = replacementPrice / (1 + gstRatePercent / 100)
                const gstAmountPerUnit = (priceWithoutTax * gstRatePercent) / 100

                // Use same tax type as original order (IGST or CGST+SGST)
                const originalTaxType = orderItem.gstTaxType || 'IGST'
                if (originalTaxType === 'IGST') {
                  igst = gstAmountPerUnit
                } else {
                  cgst = gstAmountPerUnit / 2
                  sgst = gstAmountPerUnit / 2
                }

                priceWithoutTax = Math.round(priceWithoutTax * 100) / 100
                if (igst !== undefined) igst = Math.round(igst * 100) / 100
                if (cgst !== undefined) cgst = Math.round(cgst * 100) / 100
                if (sgst !== undefined) sgst = Math.round(sgst * 100) / 100
              }

              // Replacement orders have ₹0 total (no additional payment required)
              // Price calculations are kept for GST/invoice purposes, but all order totals are 0

              // Create replacement order item (prices kept for GST/invoice, but won't be charged)
              const replacementItem = {
                product: orderItem.product,
                variant: variant._id,
                seller: orderItem.seller,
                sellerStatus: 'pending' as const,
                quantity: orderItem.quantity,
                price: replacementPrice,
                effectivePrice: replacementPrice,
                priceWithoutTax: priceWithoutTax,
                subtotal: replacementPrice * orderItem.quantity,
                variantId: String(variant._id),
                variantSku: variant.sku,
                variantName: variant.name,
                hsnSacCode: hsnSacCode,
                gstRatePercent: gstRatePercent,
                gstTaxType: orderItem.gstTaxType || 'IGST',
                igst: igst,
                cgst: cgst,
                sgst: sgst,
              }

              // Generate replacement order number with -R suffix
              // Check if there are existing replacement orders for this original order
              const originalOrderId = originalOrder._id as mongoose.Types.ObjectId
              const existingReplacements = await Order.countDocuments({
                originalOrderId: originalOrderId,
              })
              const replacementSuffix = existingReplacements > 0 ? existingReplacements + 1 : 1
              const originalOrderNumber =
                originalOrder.orderNumber || `ORD-${originalOrderId.toString().slice(-8)}`
              // Format: ORD-20240115-ABC12-R1, ORD-20240115-ABC12-R2, etc.
              const replacementOrderNumber = `${originalOrderNumber}-R${replacementSuffix}`

              // Create replacement order with ₹0 total
              // IMPORTANT: Replacement orders are NON-FINANCIAL events
              // - Payment method set to original for record-keeping, but COD is effectively disabled (₹0 total)
              // - No payment collection, no payout, no settlement impact
              const replacementOrder = new Order({
                user: originalOrder.user,
                items: [replacementItem],
                subtotal: 0, // ₹0 - no charge
                discount: 0,
                shipping: 0, // ₹0 - no shipping charge
                tax: 0, // ₹0 - no tax charge
                total: 0, // ₹0 total (COD effectively disabled)
                status: 'pending',
                paymentStatus: 'paid', // Replacement orders are pre-paid (no additional payment)
                // Keep original paymentMethod for record-keeping, but total=0 ensures no COD collection
                paymentMethod:
                  originalOrder.paymentMethod === 'cod' ? 'card' : originalOrder.paymentMethod,
                shippingAddress: originalOrder.shippingAddress,
                deliveryInstructions: originalOrder.deliveryInstructions,
                giftWrap: originalOrder.giftWrap || false,
                isReplacement: true,
                originalOrderId: originalOrderId,
                returnId: ret._id,
                // Settlement fields explicitly set to 0 to ensure no payout
                settlementStatus: 'NOT_ELIGIBLE',
                sellerSaleAmount: 0,
                sellerCommissionAmount: 0,
                sellerShippingEarning: 0,
                sellerCourierCost: 0,
                sellerPgFee: 0,
                sellerNetAmount: 0,
                sellerShipments: [
                  {
                    seller: orderItem.seller,
                    status: 'pending',
                    paymentStatus: 'paid',
                    inventoryPacked: false,
                    totals: {
                      itemSubtotal: 0, // ₹0
                      discount: 0,
                    },
                  },
                ],
              })

              // Set replacement order number
              replacementOrder.orderNumber = replacementOrderNumber

              await replacementOrder.save()

              // Log replacement order creation for seller visibility
              console.log(`[REPLACEMENT ORDER CREATED]`, {
                replacementOrderId: replacementOrder._id,
                replacementOrderNumber: replacementOrderNumber,
                originalOrderId: originalOrderId.toString(),
                originalOrderNumber: originalOrder.orderNumber,
                returnId: ret._id,
                variantId: variant._id,
                quantity: replacementItem.quantity,
                total: 0, // Always ₹0
                message: 'Replacement order created - seller can now ship replacement item',
              })

              // Deduct stock for replacement order (same logic as regular order creation)
              if (replacementItem.variant) {
                // Update variant stock
                await ProductVariant.findByIdAndUpdate(replacementItem.variant, {
                  $inc: { stock: -replacementItem.quantity },
                })
                // Update product totalStock (sum of all variant stocks)
                const product = await mongoose.model('Product').findById(replacementItem.product)
                if (product && product.hasVariants) {
                  await updateProductTotalStock(String(product._id))
                }
              } else {
                // Update product stock directly (non-variant products)
                await mongoose
                  .model('Product')
                  .updateOne(
                    { _id: replacementItem.product },
                    { $inc: { stock: -replacementItem.quantity } },
                  )
              }

              // Update return with replacement order ID
              ret.exchangeOrderId = replacementOrder._id as mongoose.Types.ObjectId
              appendReturnTimeline(
                ret,
                'RETURN_RECEIVED_BY_SELLER',
                `Replacement order ${replacementOrderNumber} created. Seller can now ship the replacement item. Order value: ₹0 (no payment collection required).`,
              )

              // Update refund request with replacement order ID if exists
              const refundRequest = await RefundRequest.findOne({ return: ret._id })
              if (refundRequest) {
                refundRequest.replacementOrder = replacementOrder._id as mongoose.Types.ObjectId
                await refundRequest.save()
              }
            }
          }
        }
      } catch (exchangeError: any) {
        console.error('Error creating replacement order:', exchangeError)
        // Don't fail the return - log error but continue
      }
    }

    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    // Create settlement adjustment ledger entries:
    // - Reverse item earning
    // - Reverse shipping earning
    // - Commission reversal (credit)
    // - Reverse courier cost (debit - seller pays)
    const order = await Order.findById(ret.order)
    if (order && order.sellerShipments?.[0]?.seller) {
      const sellerId = order.sellerShipments[0].seller
      const sellerObjectId = new mongoose.Types.ObjectId(String(sellerId))

      const entries: any[] = []
      const itemAmount = order.sellerSaleAmount || order.subtotal
      const shippingEarning = order.sellerShippingEarning || order.shipping
      const commissionAmount = order.sellerCommissionAmount || 0
      const reverseCharges = ret.reverseCharges || 0

      if (itemAmount > 0) {
        entries.push({
          seller: sellerObjectId,
          order: order._id,
          entryType: 'DEBIT',
          reason: 'RETURN_ITEM_REVERSAL',
          amount: itemAmount,
          description: `Item earning reversal for return Order #${order.orderNumber || order._id}`,
          referenceId: ret._id,
        })
      }

      if (shippingEarning > 0) {
        entries.push({
          seller: sellerObjectId,
          order: order._id,
          entryType: 'DEBIT',
          reason: 'RETURN_SHIPPING_REVERSAL',
          amount: shippingEarning,
          description: `Shipping earning reversal for return Order #${
            order.orderNumber || order._id
          }`,
          referenceId: ret._id,
        })
      }

      if (commissionAmount > 0) {
        entries.push({
          seller: sellerObjectId,
          order: order._id,
          entryType: 'CREDIT',
          reason: 'COMMISSION_REVERSAL',
          amount: commissionAmount,
          description: `Commission refunded due to return Order #${order.orderNumber || order._id}`,
          referenceId: ret._id,
        })
      }

      if (reverseCharges > 0) {
        entries.push({
          seller: sellerObjectId,
          order: order._id,
          entryType: 'DEBIT',
          reason: 'RETURN_REVERSE_COURIER_COST',
          amount: reverseCharges,
          description: `Reverse pickup courier charge for return Order #${
            order.orderNumber || order._id
          }`,
          referenceId: ret._id,
        })
      }

      // Calculate and reverse TCS (GST) for returned order
      // TCS must be reversed when orders are returned/refunded
      try {
        const seller = await User.findById(sellerId).select('state gstNumber').lean()
        const sellerState = seller?.state || ''
        const customerState = order.shippingAddress?.state || ''
        const orderTaxableValue = order.subtotal || 0

        if (orderTaxableValue > 0) {
          const TCS_RATE_INTER_STATE = 1.0 // IGST 1%
          const TCS_RATE_INTRA_STATE = 0.5 // CGST 0.5% + SGST 0.5% = 1% total

          let tcsReversalAmount = 0
          let tcsIgstReversal = 0
          let tcsCgstReversal = 0
          let tcsSgstReversal = 0

          if (isInterStateSupply(sellerState, customerState)) {
            // Inter-state: Reverse IGST 1%
            tcsIgstReversal = (orderTaxableValue * TCS_RATE_INTER_STATE) / 100
            tcsReversalAmount = tcsIgstReversal
          } else {
            // Intra-state: Reverse CGST 0.5% + SGST 0.5%
            tcsCgstReversal = (orderTaxableValue * TCS_RATE_INTRA_STATE) / 100
            tcsSgstReversal = (orderTaxableValue * TCS_RATE_INTRA_STATE) / 100
            tcsReversalAmount = tcsCgstReversal + tcsSgstReversal
          }

          if (tcsReversalAmount > 0) {
            entries.push({
              seller: sellerObjectId,
              order: order._id,
              entryType: 'CREDIT', // Credit because we're reversing TCS (reducing the debit)
              reason: 'TCS_REVERSAL',
              amount: tcsReversalAmount,
              description: `TCS reversal for return Order #${
                order.orderNumber || order._id
              }. IGST: ₹${tcsIgstReversal.toFixed(2)}, CGST: ₹${tcsCgstReversal.toFixed(
                2,
              )}, SGST: ₹${tcsSgstReversal.toFixed(2)}`,
              referenceId: ret._id,
            })
          }
        }
      } catch (tcsError) {
        // Log but don't fail the return operation if TCS reversal calculation fails
        console.error('Error calculating TCS reversal for return:', tcsError)
      }

      // Calculate and reverse TDS (194-O) for returned order
      // TDS must be reversed when orders are returned/refunded
      try {
        const orderTotal = order.total || 0 // Gross sales including GST

        if (orderTotal > 0) {
          const TDS_RATE = 0.1 // 0.1% as per Section 194-O
          // Calculate TDS on the order total (gross sales including GST)
          const tdsReversalAmount = (orderTotal * TDS_RATE) / 100

          if (tdsReversalAmount > 0) {
            entries.push({
              seller: sellerObjectId,
              order: order._id,
              entryType: 'CREDIT', // Credit because we're reversing TDS (reducing the debit)
              reason: 'TDS_REVERSAL',
              amount: tdsReversalAmount,
              description: `TDS reversal (194-O) @ ${TDS_RATE}% for return Order #${
                order.orderNumber || order._id
              }. Gross sales: ₹${orderTotal.toFixed(2)}`,
              referenceId: ret._id,
            })
          }
        }
      } catch (tdsError) {
        // Log but don't fail the return operation if TDS reversal calculation fails
        console.error('Error calculating TDS reversal for return:', tdsError)
      }

      if (entries.length) {
        const createdEntries = await SellerLedgerEntry.insertMany(entries)

        // CRITICAL GST COMPLIANCE: Generate credit note for commission reversal
        // Commission is a taxed service (SAC) - reversing it requires a credit note
        // This is MANDATORY for GST compliance, not optional
        if (commissionAmount > 0) {
          try {
            const commissionReversalEntry = createdEntries.find(
              (entry: any) => entry.reason === 'COMMISSION_REVERSAL',
            )

            if (commissionReversalEntry) {
              // Find settlement batch for this order (if it exists and has invoice)
              // First check if order has a settlementBatch field
              let settlementBatch = null
              if (order.settlementBatch) {
                settlementBatch = await SellerSettlementBatch.findById(order.settlementBatch)
                  .select('invoiceNumber status')
                  .lean()
              } else {
                // Fallback: Find batch by date range if order doesn't have settlementBatch field
                settlementBatch = await SellerSettlementBatch.findOne({
                  seller: sellerObjectId,
                  fromDate: { $lte: order.createdAt },
                  toDate: { $gte: order.createdAt },
                })
                  .select('invoiceNumber status')
                  .lean()
              }

              // Get seller details for credit note generation
              const seller = await User.findById(sellerId)
                .select(
                  'name email businessName storeLogo sellerAgreementSignature authorizedPersonName authorizedPersonDesignation storeDescription gstNumber state addressLine1 addressLine2 city postalCode country',
                )
                .lean()

              if (seller) {
                // Use the reusable credit note generator helper
                const { generateSellerCreditNote } = await import('../utils/creditNoteGenerator')

                const settlementBatchId = settlementBatch?._id
                  ? String(settlementBatch._id)
                  : undefined

                // Only generate credit note if batch has invoice (post-invoice correction)
                if (settlementBatchId && settlementBatch?.invoiceNumber) {
                  const creditNoteResult = await generateSellerCreditNote({
                    sellerId: sellerObjectId,
                    amount: commissionAmount,
                    description: `Commission refunded due to return Order #${
                      order.orderNumber || order._id
                    }`,
                    orderId: String(order._id),
                    settlementBatchId,
                    hsnSacCode: '998314', // SAC code for commission service (marketplace services)
                    gstRatePercent: 18, // GST rate for commission service
                    gstTaxType: 'IGST', // Default to IGST (can be adjusted based on seller/customer state)
                    productName: 'Commission Reversal',
                  })

                  if (creditNoteResult.success && creditNoteResult.creditNote) {
                    // Store credit note in ledger entry
                    commissionReversalEntry.creditNote = {
                      credit_note_id: creditNoteResult.creditNote.credit_note_id,
                      credit_note_url: creditNoteResult.creditNote.credit_note_url,
                      credit_note_number: creditNoteResult.creditNote.credit_note_number,
                      generated_at: creditNoteResult.creditNote.generated_at,
                      hsnSummary: creditNoteResult.creditNote.hsnSummary,
                    }
                    await commissionReversalEntry.save()

                    console.log(
                      `✅ Credit Note ${
                        creditNoteResult.creditNote.credit_note_number
                      } generated for Commission Reversal ${commissionReversalEntry._id} (Order: ${
                        order.orderNumber || order._id
                      })`,
                    )
                  } else {
                    console.error(
                      `❌ Failed to generate credit note for commission reversal: ${creditNoteResult.error}`,
                    )
                  }
                } else {
                  // Pre-invoice commission reversal - no credit note needed (ledger-only)
                  console.log(
                    `ℹ️ Commission reversal for order ${
                      order.orderNumber || order._id
                    } - no settlement invoice found, no credit note generated (ledger-only)`,
                  )
                }
              }
            }
          } catch (creditNoteError) {
            // Log but don't fail the return operation if credit note generation fails
            console.error(
              '❌ Error generating Credit Note for commission reversal:',
              creditNoteError,
            )
          }
        }

        // NOTIFY SELLER: Notify about return and ledger impact
        try {
          const { notifySellerReturn } = await import('../utils/sellerNotifications')
          await notifySellerReturn(
            sellerId,
            (order as any).orderNumber || String(order._id),
            String(ret._id),
          )

          // Check for negative balance after return
          const allEntries = await SellerLedgerEntry.find({
            seller: sellerObjectId,
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
            await notifySellerNegativeBalance(sellerObjectId, balance)
          }
        } catch (notifyError) {
          // Log but don't fail the return operation
          console.error('Failed to notify seller about return:', notifyError)
        }
      }
    }

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error marking return received:', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to mark return as received' })
  }
}

export const adminMarkRefundInitiated = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const ret = await Return.findById(id)
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    ret.status = 'REFUND_INITIATED'
    appendReturnTimeline(ret, 'REFUND_INITIATED', 'Refund initiated by admin')
    await ret.save()
    await markOrderReturnFlags(ret.order as mongoose.Types.ObjectId, ret.status)

    // Notify linked tickets automatically
    try {
      const { notifyLinkedTickets } = await import('../utils/ticketSystemMessages')
      await notifyLinkedTickets(
        'refund',
        String(ret._id),
        `Refund has been initiated for this return. The refund amount will be credited to your original payment method within 5-7 business days as per bank processing timelines.`,
      )
    } catch (error) {
      console.error('Error sending automated system message for refund initiated:', error)
    }

    // Notify customer
    try {
      const order = await Order.findById(ret.order).populate('user', 'name email')
      const buyer: any = order?.user
      const buyerEmail = buyer?.email
      const buyerName = buyer?.name || order?.shippingAddress?.name || 'Customer'
      if (buyerEmail) {
        const subject = `Refund initiated for your order ${order?.orderNumber || ''}`
        const body = emailTemplates.orderStatusUpdateBuyer(buyerName, {
          orderNumber: order?.orderNumber || 'N/A',
          statusLabel: 'Refund Initiated',
          message: 'Your refund has been initiated. Funds will be credited as per bank timelines.',
        })
        void sendEmail(buyerEmail, subject, body)
      }
    } catch {
      // ignore
    }

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error marking refund initiated:', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to mark refund initiated' })
  }
}

export const adminMarkRefundCompleted = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const ret = await Return.findById(id)
      .populate('order')
      .populate('orderItem')
      .populate('customer', 'name email')
      .populate(
        'seller',
        'name email businessName storeLogo sellerAgreementSignature authorizedPersonName authorizedPersonDesignation storeDescription',
      )
    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    ret.status = 'REFUND_COMPLETED'
    appendReturnTimeline(ret, 'REFUND_COMPLETED', 'Refund completed')

    // Generate credit note if not already generated
    if (!ret.creditNote?.credit_note_url) {
      try {
        const order = await Order.findById(ret.order)
          .populate('user', 'name email')
          .populate('items.product')
          .populate('items.variant')
          .populate(
            'items.seller',
            'name email businessName storeLogo sellerAgreementSignature authorizedPersonName authorizedPersonDesignation storeDescription gstNumber state',
          )

        if (!order) {
          throw new Error('Order not found for credit note generation')
        }

        const customer = ret.customer as any
        const seller = ret.seller as any

        // Get the returned order item(s)
        let returnedItems: any[] = []
        if (ret.orderItem) {
          // Single item return
          const orderItem = order.items.find(
            (item: any) => item._id.toString() === (ret.orderItem as any).toString(),
          )
          if (orderItem) {
            returnedItems = [orderItem]
          }
        } else {
          // Full order return - include all items
          returnedItems = order.items || []
        }

        if (returnedItems.length === 0) {
          throw new Error('No items found for credit note generation')
        }

        // Create a modified order object for credit note
        // Credit notes show positive amounts (standard practice) - the "Credit Note" label indicates it's a credit
        // Preserve invoice information for credit note reference
        const creditNoteOrder = {
          ...order.toObject(),
          // Preserve invoice information for credit note reference
          invoice: order.invoice || undefined,
          // Use refund amount as positive (credit note label makes it clear it's a credit)
          subtotal: ret.refundAmount,
          total: ret.refundAmount,
          tax: order.tax ? Math.abs(order.tax) : 0,
          shipping: 0, // Shipping typically not refunded
          discount: 0,
          items: returnedItems.map((item: any) => {
            const itemObj = item.toObject ? item.toObject() : item
            // Calculate proportional refund amount for this item
            const itemRefundAmount = itemObj.subtotal || itemObj.price * (itemObj.quantity || 1)
            return {
              ...itemObj,
              // Keep amounts positive for credit note (label indicates it's a credit)
              price: itemObj.price ? Math.abs(itemObj.price) : 0,
              effectivePrice: itemObj.effectivePrice ? Math.abs(itemObj.effectivePrice) : 0,
              subtotal: Math.abs(itemRefundAmount),
            }
          }),
        }

        // Prepare invoice data for credit note
        const creditNoteData = {
          order: creditNoteOrder as any,
          customer: customer || (order.user as any),
          seller: seller || (returnedItems[0]?.seller as any),
          items: returnedItems.map((item: any) => {
            const itemObj = item.toObject ? item.toObject() : item
            const itemRefundAmount = itemObj.subtotal || itemObj.price * (itemObj.quantity || 1)
            return {
              product: itemObj.product,
              variant: itemObj.variant,
              orderItem: {
                ...itemObj,
                // Keep amounts positive (credit note label makes it clear)
                price: itemObj.price ? Math.abs(itemObj.price) : 0,
                effectivePrice: itemObj.effectivePrice ? Math.abs(itemObj.effectivePrice) : 0,
                subtotal: Math.abs(itemRefundAmount),
              },
            }
          }),
          audience: 'buyer' as const,
        }

        // Generate credit note (respects all invoice settings: currency, date format, rounding, etc.)
        const creditNote = await generateInvoice(creditNoteData, 'CREDIT_NOTE', new Date())

        ret.creditNote = {
          credit_note_id: creditNote.invoice_id,
          credit_note_url: creditNote.invoice_url,
          credit_note_number: creditNote.invoice_number,
          generated_at: new Date(),
          hsnSummary: creditNote.hsnSummary,
        }
      } catch (creditNoteError) {
        console.error('Error generating credit note:', creditNoteError)
        // Don't fail the refund completion if credit note generation fails
      }
    }

    await ret.save()

    // Notify linked tickets automatically
    try {
      const { notifyLinkedTickets } = await import('../utils/ticketSystemMessages')
      await notifyLinkedTickets(
        'refund',
        String(ret._id),
        `Refund has been completed for this return. The refund amount has been successfully credited to your original payment method.`,
      )
    } catch (error) {
      console.error('Error sending automated system message for refund completed:', error)
    }

    const order = await Order.findById(ret.order).populate('user', 'name email')
    if (order) {
      order.status = 'refunded'
      ;(order as any).returnStatus = 'REFUND_COMPLETED'
      await order.save()

      // Notify customer about refund completion
      try {
        const buyer: any = order.user
        const buyerEmail = buyer?.email
        const buyerName = buyer?.name || order.shippingAddress?.name || 'Customer'
        if (buyerEmail) {
          const subject = `Refund completed for your order ${order.orderNumber || ''}`
          const body = emailTemplates.orderStatusUpdateBuyer(buyerName, {
            orderNumber: order.orderNumber || 'N/A',
            statusLabel: 'Refund Completed',
            message:
              'Your refund has been processed successfully. If it does not appear in your account within a few days, please contact support.',
          })
          void sendEmail(buyerEmail, subject, body)
        }
      } catch {
        // ignore notification errors
      }
    }

    return res.json({ success: true, data: ret })
  } catch (error: any) {
    console.error('Error marking refund completed:', error)
    return res
      .status(500)
      .json({ success: false, message: error.message || 'Failed to mark refund completed' })
  }
}

/**
 * Download credit note for a return
 * GET /api/returns/:id/credit-note
 */
export const downloadCreditNote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const userId = req.user?.userId
    const userRole = req.user?.role

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const ret = await Return.findById(id)
      .populate('order', 'orderNumber user')
      .populate('customer', '_id')
      .populate('seller', '_id')

    if (!ret) {
      return res.status(404).json({ success: false, message: 'Return not found' })
    }

    // Check access permissions
    const order = ret.order as any
    const customerId = (ret.customer as any)?._id?.toString()
    const sellerId = (ret.seller as any)?._id?.toString()

    if (userRole === 'customer' && customerId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }
    if (userRole === 'seller' && sellerId !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' })
    }
    // super-admin can access any credit note

    if (!ret.creditNote?.credit_note_url) {
      return res.status(404).json({
        success: false,
        message: 'Credit note not available for this return',
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        credit_note_url: ret.creditNote.credit_note_url,
        credit_note_number: ret.creditNote.credit_note_number,
        credit_note_id: ret.creditNote.credit_note_id,
        hsnSummary: ret.creditNote.hsnSummary,
      },
    })
  } catch (error: any) {
    console.error('Error downloading credit note:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to download credit note',
    })
  }
}
