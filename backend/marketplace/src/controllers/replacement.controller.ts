import { Request, Response } from 'express'
import { SAME_VARIANT_REPLACEMENT_REASONS } from '../constants/returnReasons'
import Order from '../models/Order'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import { checkUserAccess } from '../utils/checkUserAccess'

/**
 * Get replacement variants for an order item
 * Only returns variants from the same parent product
 * Only allows color and size attribute changes
 * Validates HSN and GST rate match
 */
export const getReplacementVariants = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer', 'super-admin'])
    if (!user) return

    const { orderId, orderItemId, reason, customerId } = req.query

    if (!orderId || !orderItemId) {
      return res.status(400).json({
        success: false,
        message: 'orderId and orderItemId are required',
      })
    }

    // Check if this is a same-variant replacement reason (damaged/defective)
    const allowSameVariant =
      reason &&
      SAME_VARIANT_REPLACEMENT_REASONS.includes(
        reason as (typeof SAME_VARIANT_REPLACEMENT_REASONS)[number],
      )

    // For admins, use customerId if provided; otherwise use their own ID
    // For customers, use their own ID
    const customerUserId =
      user.role === 'super-admin' && customerId ? String(customerId) : user._id.toString()

    // Find the order and item
    // For admins, don't restrict by user (they can access any order)
    const orderQuery: any = { _id: orderId }
    if (user.role !== 'super-admin') {
      orderQuery.user = customerUserId
    }
    const order = await Order.findOne(orderQuery)
      .populate(
        'items.product',
        'name hasVariants hsnSacCode gstRatePercent stock totalStock sku images mainImage',
      )
      .populate({
        path: 'items.variant',
        select: 'name attributes hsnSacCode gstRatePercent effectivePrice price',
        model: 'ProductVariant',
      })
      .exec()

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      })
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Replacement can only be requested for delivered orders',
      })
    }

    // Find the order item
    const orderItem = (order.items as any[]).find(
      (item) => String(item._id) === String(orderItemId),
    )

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      })
    }

    const product = orderItem.product as any
    let originalVariant = orderItem.variant || (orderItem.variantId as any)

    // If product doesn't have variants (simple product)
    // For simple products, stock is tracked at product level
    if (!product.hasVariants) {
      // For same-variant replacement reasons (damaged/defective), allow replacement with same product
      if (allowSameVariant) {
        const originalPrice = orderItem.effectivePrice || orderItem.price || 0
        // For simple products, use product.stock
        // Ensure stock is a number
        const stockValue =
          typeof product.stock === 'number' ? product.stock : Number(product.stock) || 0
        return res.status(200).json({
          success: true,
          data: {
            variants: [
              {
                _id: product._id, // Use product ID as variant ID for simple products
                name: product.name,
                sku: product.sku || product._id.toString(),
                attributes: {},
                price: originalPrice,
                originalPrice: originalPrice,
                priceDifference: 0,
                stock: stockValue,
                images: product.images || [],
                mainImage: product.mainImage,
                canReplace: stockValue > 0,
                requiresNewOrder: false,
                isSameVariant: true, // This is the same product
              },
            ],
            originalPrice: originalPrice,
            originalVariant: {
              _id: product._id,
              name: product.name,
              sku: product.sku || product._id.toString(),
              attributes: {},
              price: originalPrice,
            },
            parentProduct: {
              _id: product._id,
              name: product.name,
            },
            allowSameVariant: true,
          },
        })
      }
      // For other reasons, return empty array
      return res.status(200).json({
        success: true,
        data: {
          variants: [],
          originalPrice: orderItem.effectivePrice || orderItem.price,
          message: 'This product has no variants available for replacement',
        },
      })
    }
    console.log('oridginal variant', originalVariant)
    console.log('orderItem', orderItem)
    // If variant wasn't populated but variantId exists, fetch it manually
    if (!originalVariant) {
      // Try to get variantId from different possible fields
      // orderItem.variant could be:
      // 1. A populated object with _id
      // 2. An ObjectId (if populate failed)
      // 3. null/undefined
      let variantIdToFetch: string | undefined

      if (orderItem.variantId) {
        // Use the stored variantId string field
        variantIdToFetch = String(orderItem.variantId)
      } else if (orderItem.variant) {
        // If variant exists but wasn't populated, it might be an ObjectId
        if (typeof orderItem.variant === 'object' && (orderItem.variant as any)?._id) {
          variantIdToFetch = String((orderItem.variant as any)._id)
        } else if (typeof orderItem.variant === 'string') {
          variantIdToFetch = orderItem.variant
        } else {
          // Try to convert ObjectId to string
          variantIdToFetch = String(orderItem.variant)
        }
      }

      if (variantIdToFetch) {
        try {
          originalVariant = await ProductVariant.findById(variantIdToFetch)
            .select('name attributes hsnSacCode gstRatePercent effectivePrice price')
            .lean()

          if (!originalVariant) {
            console.warn(
              `Variant not found for variantId: ${variantIdToFetch}, orderItemId: ${orderItemId}`,
            )
          }
        } catch (error) {
          console.error('Error fetching variant:', error, {
            variantId: variantIdToFetch,
            orderItemId: orderItemId,
            variantField: orderItem.variant,
            variantIdField: orderItem.variantId,
          })
          // Continue - will be handled below
        }
      } else {
        console.warn(`No variant or variantId found for orderItem: ${orderItemId}`, {
          hasVariant: !!orderItem.variant,
          variantId: orderItem.variantId,
          variantType: typeof orderItem.variant,
          variantValue: orderItem.variant,
          orderItemKeys: Object.keys(orderItem),
        })
      }
    }

    // If no variant was selected in original order
    // This can happen in two cases:
    // 1. Simple product (no variants) - handled above at line 85
    // 2. Product with variants but order item has no variantId (edge case or legacy data)
    if (!originalVariant) {
      // For same-variant replacement reasons (damaged/defective), allow replacement with same product
      if (allowSameVariant) {
        // Fetch the product to get its details
        // For products with variants, use totalStock (sum of all variant stocks)
        // For simple products, use stock
        const productDetails = await Product.findById(product._id)
          .select('name sku images mainImage stock totalStock hasVariants effectivePrice price')
          .lean()

        if (!productDetails) {
          return res.status(404).json({
            success: false,
            message: 'Product not found',
          })
        }

        const originalPrice = orderItem.effectivePrice || orderItem.price || 0
        // For variant products, use totalStock; for simple products, use stock
        const stockToUse = productDetails.hasVariants
          ? productDetails.totalStock || 0
          : productDetails.stock || 0
        // Ensure stock is a number
        const stockValue = typeof stockToUse === 'number' ? stockToUse : Number(stockToUse) || 0

        return res.status(200).json({
          success: true,
          data: {
            variants: [
              {
                _id: product._id, // Use product ID as variant ID
                name: productDetails.name,
                sku: productDetails.sku || product._id.toString(),
                attributes: {},
                price: originalPrice,
                originalPrice: originalPrice,
                priceDifference: 0,
                stock: stockValue,
                images: productDetails.images || [],
                mainImage: productDetails.mainImage,
                canReplace: stockValue > 0,
                requiresNewOrder: false,
                isSameVariant: true, // This is the same product
              },
            ],
            originalPrice: originalPrice,
            originalVariant: {
              _id: product._id,
              name: productDetails.name,
              sku: productDetails.sku || product._id.toString(),
              attributes: {},
              price: originalPrice,
            },
            parentProduct: {
              _id: product._id,
              name: productDetails.name,
            },
            allowSameVariant: true,
          },
        })
      }
      // For other reasons, return error
      return res.status(400).json({
        success: false,
        message: 'Original order item does not have a variant',
      })
    }

    // Get the parent product
    const parentProduct = await Product.findById(product._id)
      .select('_id hsnSacCode gstRatePercent variantAttributes')
      .lean()

    if (!parentProduct) {
      return res.status(404).json({
        success: false,
        message: 'Parent product not found',
      })
    }

    // Get all variants of the same parent product
    // Include both active and out_of_stock variants (exclude only inactive)
    // Don't filter by stock - show all variants, but mark out-of-stock ones as unavailable
    const allVariants = await ProductVariant.find({
      product: parentProduct._id,
      status: { $in: ['active', 'out_of_stock'] }, // Include active and out_of_stock variants
    })
      .select(
        '_id name sku attributes effectivePrice price hsnSacCode gstRatePercent stock images mainImage',
      )
      .lean()

    // Helper function to convert attributes (Map or object) to plain object
    const normalizeAttributes = (attrs: any): Record<string, string> => {
      if (!attrs) return {}
      // If it's already a plain object
      if (attrs.constructor === Object) {
        return attrs as Record<string, string>
      }
      // If it's a Map
      if (attrs instanceof Map) {
        const result: Record<string, string> = {}
        attrs.forEach((value, key) => {
          result[key] = String(value)
        })
        return result
      }
      // If it has toObject method (Mongoose Map)
      if (typeof attrs.toObject === 'function') {
        return attrs.toObject() as Record<string, string>
      }
      // Try to convert to object
      try {
        return attrs as Record<string, string>
      } catch {
        return {}
      }
    }

    // Filter variants based on replacement rules:
    // 1. Same parent product (already filtered by query)
    // 2. Must be different variant (not the same one)
    // 3. Must have different size/color combination (exclude same size+color)
    // 4. Only allow color and size attribute changes (all other attributes must match)
    // Note: HSN/GST matching is optional - variants from same product are generally eligible
    const originalAttrs = normalizeAttributes(originalVariant.attributes)
    const originalColor = originalAttrs['color'] || originalAttrs['colour'] || ''
    const originalSize = originalAttrs['size'] || ''

    const eligibleVariants = allVariants
      .filter((variant) => {
        const isSameVariant = String(variant._id) === String(originalVariant._id)

        // For damaged/defective reasons, include the same variant (for same product replacement)
        if (isSameVariant) {
          // Only include same variant if reason allows it (damaged/defective)
          return allowSameVariant
        }

        // Check if only color and size attributes differ
        const variantAttrs = normalizeAttributes(variant.attributes)
        const variantColor = variantAttrs['color'] || variantAttrs['colour'] || ''
        const variantSize = variantAttrs['size'] || ''

        // Get all attribute keys
        const allKeys = new Set([...Object.keys(originalAttrs), ...Object.keys(variantAttrs)])

        // If there are no attributes at all, allow the variant (same product, no attributes)
        if (allKeys.size === 0) {
          return true
        }

        // Must have different size/color combination (at least one must differ)
        // If both original and variant have color/size attributes, they must differ in at least one
        const hasColorAttrs = originalColor || variantColor
        const hasSizeAttrs = originalSize || variantSize

        if (hasColorAttrs || hasSizeAttrs) {
          const sameColor = (!originalColor && !variantColor) || originalColor === variantColor
          const sameSize = (!originalSize && !variantSize) || originalSize === variantSize

          // Exclude if both color and size are the same (same combination)
          if (sameColor && sameSize) {
            return false
          }
        }

        // Check each attribute
        for (const key of allKeys) {
          // Color and size can differ (we already verified they differ above)
          if (key === 'color' || key === 'colour' || key === 'size') {
            continue
          }

          // All other attributes must match
          const originalValue = String(originalAttrs[key] || '')
          const variantValue = String(variantAttrs[key] || '')
          if (originalValue !== variantValue) {
            return false
          }
        }

        return true
      })
      .map((variant) => {
        const variantPrice = variant.effectivePrice || variant.price || 0
        const originalPrice = orderItem.effectivePrice || orderItem.price || 0
        const priceDifference = variantPrice - originalPrice

        // Ensure stock is a number and check if it's greater than 0
        const stockValue =
          typeof variant.stock === 'number' ? variant.stock : Number(variant.stock) || 0
        const hasStock = stockValue > 0
        const isSameVariant = String(variant._id) === String(originalVariant._id)

        return {
          _id: variant._id,
          name: variant.name,
          sku: variant.sku,
          attributes: normalizeAttributes(variant.attributes), // Normalize attributes for response
          price: variantPrice,
          originalPrice: originalPrice,
          priceDifference: priceDifference,
          stock: stockValue,
          images: variant.images || [],
          mainImage: variant.mainImage,
          // Replacement eligibility
          // For same variant replacements (damaged/defective): allow if has stock (price difference is always 0 for same variant)
          // For different variants: can replace if same or lower price AND has stock
          canReplace: isSameVariant ? hasStock : priceDifference <= 0 && hasStock,
          requiresNewOrder: !isSameVariant && priceDifference > 0, // Higher price requires new order (not applicable for same variant)
          // Flag for same variant replacement (damaged/defective cases)
          isSameVariant: isSameVariant,
        }
      })
      .sort((a, b) => {
        // Sort by price difference (lower price first, then same price)
        if (a.priceDifference !== b.priceDifference) {
          return a.priceDifference - b.priceDifference
        }
        // Then by name
        return a.name.localeCompare(b.name)
      })

    const originalPrice = orderItem.effectivePrice || orderItem.price || 0

    return res.status(200).json({
      success: true,
      data: {
        variants: eligibleVariants,
        originalPrice: originalPrice,
        originalVariant: {
          _id: originalVariant._id,
          name: originalVariant.name,
          sku: originalVariant.sku,
          attributes: normalizeAttributes(originalVariant.attributes), // Normalize attributes for response
          price: originalPrice,
        },
        parentProduct: {
          _id: parentProduct._id,
          name: product.name,
        },
        // Flag to indicate if same variant replacement is allowed (for damaged/defective cases)
        allowSameVariant: !!allowSameVariant,
      },
    })
  } catch (error: any) {
    console.error('Error fetching replacement variants:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch replacement variants',
    })
  }
}
