import { Request, Response } from 'express'
import Cart from '../models/Cart'
import CouponRedemption from '../models/CouponRedemption'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'
import SellerCoupon from '../models/SellerCoupon'
import Wishlist from '../models/Wishlist'
import { findCartItemIndex, getOrCreateCart, validateProductAndVariant } from '../utils/cartUtils'
import { checkUserAccess } from '../utils/checkUserAccess'
import { calculateShippingCharge } from '../utils/shippingCalculator'

// Helper function to calculate shipping for cart items
// Sums shipping charges for all selected items (each item has its own shipping charge)
const calculateCartShipping = (cartData: any): any => {
  if (!cartData || !cartData.items || !Array.isArray(cartData.items)) {
    return {
      ...cartData,
      shipping: 0,
      totalWithShipping: cartData?.totalAmount || 0,
    }
  }

  let selectedItemsSubtotal = 0
  let totalShipping = 0

  // Calculate shipping for each selected item and sum them
  cartData.items.forEach((item: any) => {
    if (item.selected !== false && !item.unavailable) {
      selectedItemsSubtotal += item.subtotal || 0

      const product = item.product as any
      const seller = product?.seller

      let itemShipping = 0
      if (seller) {
        itemShipping = calculateShippingCharge({
          product: {
            ...product,
            shippingCharge: product?.shippingCharge,
            freeShipping: product?.freeShipping,
            requiresShipping: product?.requiresShipping,
          },
          seller: {
            ...seller,
            defaultShippingRate: seller?.defaultShippingRate || 0,
          },
        })
      }

      item.shipping = itemShipping
      totalShipping += itemShipping
    } else {
      item.shipping = 0
    }
  })

  return {
    ...cartData,
    shipping: totalShipping,
    totalWithShipping: selectedItemsSubtotal + totalShipping,
  }
}

// Helper function to extract variantId from Mongoose document items before toObject()
const extractVariantIdsFromCart = (cart: any): void => {
  if (!cart || !cart.items || !Array.isArray(cart.items)) return

  cart.items.forEach((item: any) => {
    if (item.variant && !(item as any).variantId) {
      // Extract variantId from populated variant document
      const variantId = item.variant._id
        ? String(item.variant._id)
        : typeof item.variant === 'string'
        ? item.variant
        : String(item.variant)

      // Only set if it's a valid ObjectId
      if (variantId && /^[0-9a-fA-F]{24}$/.test(variantId)) {
        ;(item as any).variantId = variantId
      }
    }
  })
}

// Helper function to merge variant data into product and remove variant field
const mergeVariantIntoProduct = (cartData: any): any => {
  if (!cartData || !cartData.items || !Array.isArray(cartData.items)) {
    return cartData
  }

  const mergedItems = cartData.items.map((item: any) => {
    const product = item.product as any
    const variant = item.variant as any
    const seller = product?.seller

    // Check if product is unavailable (null means it was filtered out, or status is not active/out_of_stock)
    const isUnavailable =
      !product || (product.status && !['active', 'out_of_stock'].includes(product.status))

    // Store variantId at item level (needed for operations like remove, update)
    // Handle both populated variant object and ObjectId reference
    let variantId: string | undefined = undefined

    // First, check if variantId is already in the item (from previous merge or database)
    if ((item as any).variantId) {
      variantId = String((item as any).variantId)
    }
    // Then try to extract from variant field
    else if (variant !== null && variant !== undefined) {
      // Handle populated variant object with _id (most common case when populated)
      if (variant._id) {
        variantId = String(variant._id)
      }
      // Handle string (common after toObject() converts ObjectId to string)
      else if (typeof variant === 'string') {
        // Only use if it's a valid ObjectId format (24 hex chars)
        if (/^[0-9a-fA-F]{24}$/.test(variant)) {
          variantId = variant
        }
      }
      // Handle ObjectId directly (when not populated, it's an ObjectId instance)
      else if (variant.constructor && variant.constructor.name === 'ObjectId') {
        variantId = String(variant)
      }
      // Handle ObjectId with toString method (fallback)
      else if (variant.toString && typeof variant.toString === 'function') {
        const variantStr = variant.toString()
        // Only use if it's a valid ObjectId format (24 hex chars)
        if (variantStr && /^[0-9a-fA-F]{24}$/.test(variantStr)) {
          variantId = variantStr
        }
      }
      // Final fallback: convert to string if it looks like an ObjectId
      if (!variantId && variant) {
        const str = String(variant)
        if (/^[0-9a-fA-F]{24}$/.test(str)) {
          variantId = str
        }
      }
    }

    // IMPORTANT: Also check the raw item's variant field before toObject() conversion
    // This handles cases where variant might be stored as ObjectId in the document
    if (!variantId && (item as any).variant) {
      const rawVariant = (item as any).variant
      if (rawVariant && typeof rawVariant === 'object' && rawVariant._id) {
        variantId = String(rawVariant._id)
      } else if (typeof rawVariant === 'string' && /^[0-9a-fA-F]{24}$/.test(rawVariant)) {
        variantId = rawVariant
      }
    }

    // Debug logging for variantId extraction
    if (variant && !variantId) {
      console.warn('Failed to extract variantId from variant:', {
        variant,
        variantType: typeof variant,
        variantConstructor: variant.constructor?.name,
        hasId: !!variant._id,
        itemProductId: product?._id,
        variantString: String(variant),
        variantToString: variant.toString ? variant.toString() : 'no toString',
      })
    } else if (!variant && product) {
      // Log when variant is missing but product exists (might be a variant product)
      console.log('No variant in cart item:', {
        productId: product._id,
        productName: product.name,
        itemHasVariantField: 'variant' in item,
        itemVariantValue: (item as any).variant,
      })
    }

    // If product is unavailable, return item with unavailable flag but preserve product name
    if (isUnavailable) {
      // Preserve product name even if product is null (filtered out)
      let productName = 'Product Unavailable'
      let productMainImage = '/image-placeholder.svg'
      if (product && product.name) {
        productName = product.name
        productMainImage = product.mainImage || productMainImage
      } else if (item.product && typeof item.product === 'object') {
        // Try to get name from the product reference
        const productRef = item.product as any
        if (productRef.name) {
          productName = productRef.name
          productMainImage = productRef.mainImage || productMainImage
        }
      }

      return {
        ...item,
        variantId: item.variantId || undefined,
        product: product || {
          _id: item.product,
          name: productName,
          status: 'inactive',
          mainImage: productMainImage,
        },
        unavailable: true,
        subtotal: 0,
        selected: false, // Auto-deselect unavailable items
      }
    }

    // Merge variant data into product (don't send variant as separate field)
    // Preserve all product fields including shippingCharge, freeShipping, requiresShipping
    let mergedProduct = { ...product }
    if (variant) {
      // Merge variant fields into product
      if (variant.effectivePrice !== undefined && variant.effectivePrice !== null) {
        mergedProduct.effectivePrice = variant.effectivePrice
      } else if (variant.price !== undefined && variant.price !== null) {
        mergedProduct.effectivePrice = variant.price
      }
      if (variant.price !== undefined && variant.price !== null) {
        mergedProduct.price = variant.price
      }
      if (variant.comparePrice !== undefined && variant.comparePrice !== null) {
        mergedProduct.comparePrice = variant.comparePrice
      }
      if (variant.stock !== undefined) {
        mergedProduct.stock = variant.stock
      }
      if (variant.mainImage) {
        mergedProduct.mainImage = variant.mainImage
      }
      if (variant.name) {
        mergedProduct.name = variant.name
      }
      if (variant.discountPercent !== undefined) {
        mergedProduct.discountPercent = variant.discountPercent
      }
      // Note: shippingCharge, freeShipping, and requiresShipping come from product, not variant
      // They are preserved via the spread operator above
    }

    // If product doesn't have free shipping enabled, append default shipping rate
    if (
      mergedProduct &&
      seller &&
      mergedProduct.freeShipping !== true &&
      mergedProduct.requiresShipping !== false
    ) {
      mergedProduct.defaultShippingRate = seller.defaultShippingRate || 0
    }

    // Calculate subtotal based on current effectivePrice
    // Get current effectivePrice from merged product
    const currentEffectivePrice =
      mergedProduct.effectivePrice ?? mergedProduct.price ?? item.effectivePrice ?? 0

    // Calculate subtotal: handle per-unit redemption limits for coupons
    let subtotal = 0
    if (
      item.appliedCoupon &&
      item.allowedDiscountUnits !== undefined &&
      item.fullPriceUnits !== undefined
    ) {
      // Mixed pricing: some units discounted, some at full price
      const discountedAmount =
        (item.discountedPrice ?? currentEffectivePrice) * item.allowedDiscountUnits
      const fullPriceAmount = currentEffectivePrice * item.fullPriceUnits
      subtotal = discountedAmount + fullPriceAmount
    } else if (item.discountedPrice) {
      // All units discounted (backward compatibility)
      subtotal = item.quantity * item.discountedPrice
    } else {
      // No discount - use current effectivePrice
      subtotal = item.quantity * currentEffectivePrice
    }

    // Keep variant object if it exists (for frontend compatibility)
    // Also add variantId at item level for operations
    const result: any = {
      ...item,
      variantId, // Add variantId at item level for operations
      product: mergedProduct,
      subtotal, // Recalculated subtotal based on effectivePrice
      unavailable: false, // Product is available
      selected: item.selected !== false, // Preserve selection state
    }

    // If variant exists, keep it in the response (frontend may need it)
    if (variant) {
      result.variant = variant
    }

    return result
  })

  return {
    ...cartData,
    items: mergedItems,
  }
}

export const getCart = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const cart = await getOrCreateCart(user?._id?.toString()!)

    // First populate without match to get product names even if unavailable
    await cart.populate([
      {
        path: 'items.product',
        model: 'Product',
        select:
          'name slug price effectivePrice comparePrice mainImage stock description status discountPercent shortDescription tags isFeatured freeShipping requiresShipping shippingCharge',
        populate: {
          path: 'seller',
          select: 'businessName defaultShippingRate',
        },
      },
      {
        path: 'items.variant',
        model: 'ProductVariant',
        select:
          '_id name price effectivePrice comparePrice sku stock mainImage status discountPercent shortDescription',
      },
    ])

    // 🔄 ALWAYS update priceAtAddition to current effectivePrice and recalculate coupon discounts
    // This ensures cart always uses current prices, not outdated prices from when item was added
    let cartNeedsSave = false

    // Auto-deselect unavailable products
    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i]
      const product = item.product as any
      const variant = item.variant as any

      // Check if product or variant is unavailable
      const isProductUnavailable =
        !product || (product.status && !['active', 'out_of_stock'].includes(product.status))
      const isVariantUnavailable =
        variant && variant.status && !['active', 'out_of_stock'].includes(variant.status)

      if (isProductUnavailable || isVariantUnavailable) {
        if (item.selected !== false) {
          cart.items[i].selected = false
          cartNeedsSave = true
        }
      }
    }
    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i]
      const product = item.product as any
      const variant = item.variant as any

      // Get current effectivePrice (what customer actually pays now)
      const currentEffectivePrice =
        variant?.effectivePrice ??
        variant?.price ??
        product?.effectivePrice ??
        product?.price ??
        item.effectivePrice ??
        item.priceAtAddition // Fallback for backward compatibility

      // Update effectivePrice to current effectivePrice if it has changed
      // This ensures the pre-save hook calculates subtotal using current price
      if (Math.abs(item.effectivePrice - currentEffectivePrice) > 0.01) {
        cart.items[i].effectivePrice = currentEffectivePrice
        cartNeedsSave = true
      }

      if (item.appliedCoupon) {
        try {
          // Fetch latest coupon data
          const coupon = await SellerCoupon.findById(item.appliedCoupon)
          if (!coupon) {
            // Coupon deleted - remove it
            cart.items[i].appliedCoupon = undefined
            cart.items[i].couponCode = undefined
            cart.items[i].discountAmount = undefined
            cart.items[i].discountedPrice = undefined
            cart.items[i].allowedDiscountUnits = undefined
            cart.items[i].fullPriceUnits = undefined
            cartNeedsSave = true
            continue
          }

          // Use currentEffectivePrice already calculated above
          const currentPrice = currentEffectivePrice

          // Check if coupon is still valid
          const now = new Date()
          const isDateValid = coupon.startDate <= now && coupon.endDate >= now
          const isStatusValid = coupon.status === 'active'
          const isApproved = !coupon.requiresApproval || coupon.isApproved

          if (!isDateValid || !isStatusValid || !isApproved) {
            // Coupon is no longer valid - remove it
            cart.items[i].appliedCoupon = undefined
            cart.items[i].couponCode = undefined
            cart.items[i].discountAmount = undefined
            cart.items[i].discountedPrice = undefined
            cart.items[i].allowedDiscountUnits = undefined
            cart.items[i].fullPriceUnits = undefined
            cartNeedsSave = true
            continue
          }

          // Check if coupon still applies to this product
          let isEligible = false
          if (
            (!coupon.productIds || coupon.productIds.length === 0) &&
            (!coupon.categoryIds || coupon.categoryIds.length === 0)
          ) {
            // No restrictions - applies to all seller products
            if (product?.seller?._id?.toString() === coupon.seller.toString()) {
              isEligible = true
            }
          } else {
            // Check product-level
            if (coupon.productIds && coupon.productIds.length > 0) {
              const productIdsStr = coupon.productIds.map((id: any) => (id?._id || id).toString())
              if (productIdsStr.includes(product?._id?.toString())) {
                isEligible = true
              }
            }

            // Check category-level
            if (!isEligible && coupon.categoryIds && coupon.categoryIds.length > 0) {
              const categoryIdsStr = coupon.categoryIds.map((id: any) => (id?._id || id).toString())
              const productCategoryId =
                (product?.category as any)?._id?.toString() || product?.category?.toString()
              if (productCategoryId && categoryIdsStr.includes(productCategoryId)) {
                isEligible = true
              }
            }
          }

          if (!isEligible) {
            // Coupon no longer applies to this product - remove it
            cart.items[i].appliedCoupon = undefined
            cart.items[i].couponCode = undefined
            cart.items[i].discountAmount = undefined
            cart.items[i].discountedPrice = undefined
            cart.items[i].allowedDiscountUnits = undefined
            cart.items[i].fullPriceUnits = undefined
            cartNeedsSave = true
            continue
          }

          // ✅ Coupon is valid - recalculate discount using latest rules
          // Check maxRedemptionsPerUser limit (using latest value)
          let allowedDiscountUnits = item.quantity
          if (coupon.maxRedemptionsPerUser) {
            // Count how many times user has already redeemed this coupon
            const existingRedemptions = await CouponRedemption.countDocuments({
              coupon: item.appliedCoupon,
              user: user._id,
              status: 'redeemed',
            })

            // Calculate how many units can still get discount (using latest maxRedemptionsPerUser)
            const remainingAllowed = Math.max(0, coupon.maxRedemptionsPerUser - existingRedemptions)
            allowedDiscountUnits = Math.min(item.quantity, remainingAllowed)
          }

          // Calculate discount per unit (using latest discountValue)
          let discountPerUnit = 0
          if (coupon.discountType === 'percent') {
            discountPerUnit = (currentPrice * coupon.discountValue) / 100
          } else {
            discountPerUnit = coupon.discountValue
            // Don't let discount exceed price per unit
            if (discountPerUnit > currentPrice) {
              discountPerUnit = currentPrice
            }
          }

          // Calculate total discount (only for allowed units)
          const discountAmount = discountPerUnit * allowedDiscountUnits

          // Calculate discounted price per unit
          const discountedPricePerUnit = currentPrice - discountPerUnit

          // Update coupon data with latest values
          cart.items[i].couponCode = coupon.couponCode
          cart.items[i].discountAmount = discountAmount
          cart.items[i].discountedPrice = discountedPricePerUnit
          cart.items[i].allowedDiscountUnits = allowedDiscountUnits
          cart.items[i].fullPriceUnits = item.quantity - allowedDiscountUnits
          cartNeedsSave = true
        } catch (couponError) {
          console.error('Error recalculating coupon discount:', couponError)
          // If recalculation fails, remove coupon to be safe
          cart.items[i].appliedCoupon = undefined
          cart.items[i].couponCode = undefined
          cart.items[i].discountAmount = undefined
          cart.items[i].discountedPrice = undefined
          cart.items[i].allowedDiscountUnits = undefined
          cart.items[i].fullPriceUnits = undefined
          cartNeedsSave = true
        }
      }
    }

    // Save cart if any changes were made
    if (cartNeedsSave) {
      await cart.save()
      // Re-populate after save (pre-save hook recalculates totals)
      await cart.populate([
        {
          path: 'items.product',
          model: 'Product',
          select:
            'name slug price mainImage stock description status discountPercent shortDescription tags isFeatured freeShipping requiresShipping shippingCharge',
          populate: {
            path: 'seller',
            select: 'businessName defaultShippingRate',
          },
        },
        {
          path: 'items.variant',
          model: 'ProductVariant',
          select:
            '_id name price effectivePrice sku stock mainImage status discountPercent shortDescription',
        },
      ])
    }

    // Extract variantId from Mongoose document before toObject() conversion
    extractVariantIdsFromCart(cart)

    // Convert cart to plain object with populated fields
    // Use lean() equivalent by converting to object, but we already populated above
    const cartPlain = cart.toObject({ virtuals: true })

    // Debug: Log raw cart items before merging
    console.log(
      'Raw cart items before merge:',
      cartPlain.items?.map((item: any) => ({
        productId: item.product?._id,
        variantRaw: item.variant,
        variantType: typeof item.variant,
        variantIsObject: item.variant && typeof item.variant === 'object',
        variantId: item.variant?._id || item.variant,
        variantConstructor: item.variant?.constructor?.name,
        hasVariantField: 'variant' in item,
        variantIsNull: item.variant === null,
        variantIsUndefined: item.variant === undefined,
      })),
    )

    // Merge variant data into product using the helper function
    // This ensures variantId is properly extracted and included
    const cartResponse = mergeVariantIntoProduct(cartPlain)

    // Debug: Log variantId extraction after merging
    if (cartResponse.items && Array.isArray(cartResponse.items)) {
      console.log(
        'Cart response items with variantId after merge:',
        cartResponse.items.map((item: any) => ({
          productId: item.product?._id,
          variantId: item.variantId,
          hasVariant: !!item.variantId,
        })),
      )
    }

    // Calculate shipping for selected items
    // Sum shipping charges for all selected items (each item has its own shipping charge)
    let selectedItemsSubtotal = 0
    let totalShipping = 0

    // Calculate shipping for each item in the response
    if (cartResponse.items && Array.isArray(cartResponse.items)) {
      cartResponse.items.forEach((item: any) => {
        // Skip unavailable items for shipping calculation
        if (item.unavailable) {
          item.shipping = 0
          return
        }

        // Calculate subtotal for selected items
        if (item.selected !== false) {
          selectedItemsSubtotal += item.subtotal || 0

          const product = item.product as any
          const seller = product?.seller

          let itemShipping = 0
          if (seller) {
            // Calculate shipping for this individual item
            // Product should already have shippingCharge, freeShipping, requiresShipping from merge
            // The spread operator preserves all product fields including seller
            itemShipping = calculateShippingCharge({
              product: {
                ...product,
                shippingCharge: product?.shippingCharge, // Explicitly ensure shippingCharge is included
                freeShipping: product?.freeShipping,
                requiresShipping: product?.requiresShipping,
              },
              seller: {
                ...seller,
                defaultShippingRate: seller?.defaultShippingRate || 0,
              },
            })
          }

          // Add shipping to item (for display purposes, shows individual item shipping)
          item.shipping = itemShipping
          totalShipping += itemShipping
        } else {
          // Unselected items have no shipping
          item.shipping = 0
        }
      })
    }

    // Add shipping to response
    // totalWithShipping should be based on selected items only, not all items
    const cartWithShipping = {
      ...cartResponse,
      shipping: totalShipping,
      totalWithShipping: selectedItemsSubtotal + totalShipping,
    }

    return res.status(200).json({
      success: true,
      message: 'Cart fetched successfully',
      data: cartWithShipping,
    })
  } catch (error) {
    console.error('Error fetching cart:', error)
    return res.status(500).json({
      success: false,
      message: 'Error fetching cart',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// Guest cart endpoint - calculates shipping for guest cart items
export const getGuestCart = async (req: Request, res: Response) => {
  try {
    const { items } = req.body // Array of { productId, variantId?, quantity, selected? }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Guest cart fetched successfully',
        data: {
          items: [],
          shipping: 0,
          totalWithShipping: 0,
        },
      })
    }

    // Fetch product details for all items
    const cartItems = await Promise.all(
      items.map(async (item: any) => {
        try {
          const product = await Product.findById(item.productId)
            .select(
              'name slug price effectivePrice comparePrice mainImage stock description status discountPercent shortDescription tags isFeatured freeShipping requiresShipping shippingCharge seller',
            )
            .populate({
              path: 'seller',
              select: 'businessName defaultShippingRate',
            })

          // Check if product is unavailable (not found or status is not active/out_of_stock)
          const isUnavailable =
            !product || (product.status && !['active', 'out_of_stock'].includes(product.status))

          if (!product) {
            // Try to fetch product name even if it's unavailable
            const unavailableProduct = await Product.findById(item.productId)
              .select('name mainImage status')
              .lean()
            const productName = unavailableProduct?.name || 'Product Unavailable'
            const productMainImage = unavailableProduct?.mainImage || '/image-placeholder.svg'
            // Return item with unavailable flag instead of null, so frontend can show message
            return {
              product: {
                _id: item.productId,
                name: productName,
                mainImage: productMainImage,
                status: unavailableProduct?.status || 'inactive',
              },
              variantId: item.variantId || undefined,
              quantity: item.quantity || 1,
              selected: false, // Auto-deselect unavailable items
              unavailable: true,
              subtotal: 0,
              shipping: 0,
            }
          }

          let variant = null
          if (item.variantId) {
            variant = await ProductVariant.findOne({
              _id: item.variantId,
              product: item.productId,
              status: { $in: ['active', 'out_of_stock'] },
            }).select(
              '_id name price effectivePrice comparePrice sku stock mainImage status discountPercent shortDescription',
            )
          }

          // Merge variant data into product
          const mergedProduct: any = {
            ...product.toObject(),
            _id: product._id,
          }

          if (variant) {
            if (variant.effectivePrice !== undefined && variant.effectivePrice !== null) {
              mergedProduct.effectivePrice = variant.effectivePrice
            } else if (variant.price !== undefined && variant.price !== null) {
              mergedProduct.effectivePrice = variant.price
            }
            if (variant.price !== undefined && variant.price !== null) {
              mergedProduct.price = variant.price
            }
            if (variant.comparePrice !== undefined && variant.comparePrice !== null) {
              mergedProduct.comparePrice = variant.comparePrice
            }
            if (variant.stock !== undefined) {
              mergedProduct.stock = variant.stock
            }
            if (variant.mainImage) {
              mergedProduct.mainImage = variant.mainImage
            }
            if (variant.name) {
              mergedProduct.name = variant.name
            }
            if (variant.discountPercent !== undefined) {
              mergedProduct.discountPercent = variant.discountPercent
            }
          }

          // Calculate subtotal
          const currentEffectivePrice = mergedProduct.effectivePrice ?? mergedProduct.price ?? 0
          const quantity = item.quantity || 1
          const subtotal = currentEffectivePrice * quantity

          // Calculate shipping for this item
          const seller = (product as any).seller
          let itemShipping = 0
          if (seller) {
            // Handle both Mongoose document and plain object
            const sellerObj = seller.toObject ? seller.toObject() : seller
            itemShipping = calculateShippingCharge({
              product: {
                ...mergedProduct,
                shippingCharge: mergedProduct.shippingCharge,
                freeShipping: mergedProduct.freeShipping,
                requiresShipping: mergedProduct.requiresShipping,
              },
              seller: {
                ...sellerObj,
                defaultShippingRate: sellerObj.defaultShippingRate || 0,
              },
            })
          }

          return {
            product: mergedProduct,
            variantId: item.variantId || undefined,
            quantity,
            selected: isUnavailable ? false : item.selected !== false, // Auto-deselect unavailable items
            subtotal,
            shipping: itemShipping,
            priceAtAddition: currentEffectivePrice,
            unavailable: isUnavailable, // Mark if product is unavailable
          }
        } catch (error) {
          console.error(`Error processing cart item ${item.productId}:`, error)
          return null
        }
      }),
    )

    // Filter out null items (products not found)
    const validItems = cartItems.filter((item): item is NonNullable<typeof item> => item !== null)

    // Calculate totals for selected items only (excluding unavailable items)
    const selectedItems = validItems.filter((item) => item.selected !== false && !item.unavailable)
    const selectedItemsSubtotal = selectedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0)

    // Sum shipping charges for all selected items (each item has its own shipping charge)
    const totalShipping = selectedItems.reduce((sum, item) => sum + (item.shipping || 0), 0)

    return res.status(200).json({
      success: true,
      message: 'Guest cart fetched successfully',
      data: {
        items: validItems,
        shipping: totalShipping,
        totalWithShipping: selectedItemsSubtotal + totalShipping,
      },
    })
  } catch (error) {
    console.error('Error fetching guest cart:', error)
    return res.status(500).json({
      success: false,
      message: 'Something went wrong while fetching cart',
    })
  }
}

export const addToCart = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { productId, variantId, quantity = 1, couponId } = req.body

    if (!productId || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Invalid product or quantity' })
    }

    const { product, variant } = await validateProductAndVariant(productId, variantId, quantity)

    const cart = await getOrCreateCart(user._id?.toString()!)

    // Find existing item in cart - match by product and variant (if provided)
    const index = findCartItemIndex(cart, productId, variantId)

    // Use effectivePrice (what customer actually pays) instead of regular price
    const currentPrice =
      variant?.effectivePrice ?? variant?.price ?? product.effectivePrice ?? product.price

    if (!currentPrice || currentPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product price is not available',
      })
    }

    // Validate and calculate coupon discount if provided
    let couponData = null
    let discountAmount = 0
    let discountedPricePerUnit = currentPrice

    if (couponId) {
      try {
        const coupon = await SellerCoupon.findById(couponId)
        if (!coupon) {
          return res.status(404).json({ success: false, message: 'Coupon not found' })
        }

        // Check if coupon is active and approved
        if (coupon.status !== 'active') {
          return res.status(400).json({ success: false, message: 'Coupon is not active' })
        }

        if (coupon.requiresApproval && !coupon.isApproved) {
          return res.status(400).json({ success: false, message: 'Coupon is pending approval' })
        }

        // Check dates
        const now = new Date()
        if (coupon.startDate > now || coupon.endDate < now) {
          return res.status(400).json({ success: false, message: 'Coupon is not valid' })
        }

        // Check if coupon applies to this product
        let isEligible = false
        if (
          (!coupon.productIds || coupon.productIds.length === 0) &&
          (!coupon.categoryIds || coupon.categoryIds.length === 0)
        ) {
          // No restrictions - applies to all seller products
          if (product.seller.toString() === coupon.seller.toString()) {
            isEligible = true
          }
        } else {
          // Check product-level
          if (coupon.productIds && coupon.productIds.length > 0) {
            const productIdsStr = coupon.productIds.map((id: any) => (id?._id || id).toString())
            if (productIdsStr.includes(productId.toString())) {
              isEligible = true
            }
          }

          // Check category-level
          if (!isEligible && coupon.categoryIds && coupon.categoryIds.length > 0) {
            const categoryIdsStr = coupon.categoryIds.map((id: any) => (id?._id || id).toString())
            const productCategoryId =
              (product.category as any)?._id?.toString() || product.category?.toString()
            if (productCategoryId && categoryIdsStr.includes(productCategoryId)) {
              isEligible = true
            }
          }
        }

        if (isEligible) {
          // Check maxRedemptionsPerUser limit
          let allowedDiscountUnits = quantity
          if (coupon.maxRedemptionsPerUser) {
            // Count how many times user has already redeemed this coupon
            const existingRedemptions = await CouponRedemption.countDocuments({
              coupon: couponId,
              user: user._id,
              status: 'redeemed',
            })

            // Calculate how many units can still get discount
            const remainingAllowed = Math.max(0, coupon.maxRedemptionsPerUser - existingRedemptions)
            allowedDiscountUnits = Math.min(quantity, remainingAllowed)
          }

          // Calculate discount per unit (not on total)
          let discountPerUnit = 0
          if (coupon.discountType === 'percent') {
            discountPerUnit = (currentPrice * coupon.discountValue) / 100
          } else {
            discountPerUnit = coupon.discountValue
            // Don't let discount exceed price per unit
            if (discountPerUnit > currentPrice) {
              discountPerUnit = currentPrice
            }
          }

          // Calculate total discount (only for allowed units)
          discountAmount = discountPerUnit * allowedDiscountUnits

          // Calculate discounted price per unit
          discountedPricePerUnit = currentPrice - discountPerUnit

          // Calculate effective price per unit (weighted average if some units are discounted)
          // This is for display purposes - actual calculation will be done in subtotal
          const discountedUnits = allowedDiscountUnits
          const fullPriceUnits = quantity - allowedDiscountUnits
          const effectivePricePerUnit =
            discountedUnits > 0
              ? (discountedPricePerUnit * discountedUnits + currentPrice * fullPriceUnits) /
                quantity
              : currentPrice

          couponData = {
            appliedCoupon: couponId,
            couponCode: coupon.couponCode,
            discountAmount, // Total discount for allowed units only
            discountedPrice: discountedPricePerUnit, // Price per unit after discount (for discounted units)
            allowedDiscountUnits, // How many units get discount
            fullPriceUnits: quantity - allowedDiscountUnits, // How many units at full price
          }
        } else {
          return res.status(400).json({
            success: false,
            message: 'Coupon is not applicable to this product',
          })
        }
      } catch (couponError) {
        console.error('Error validating coupon:', couponError)
        return res.status(400).json({
          success: false,
          message: 'Invalid coupon',
        })
      }
    }

    if (index !== -1) {
      // Item already exists in cart - update quantity and coupon if provided
      const existingItem = cart.items[index]
      const newQuantity = existingItem.quantity + quantity

      const availableStock = variant ? variant.stock : product.stock

      if (availableStock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock',
          availableStock,
        })
      }

      // Update quantity
      existingItem.quantity = newQuantity

      // Update effectivePrice and priceAtAddition to current price
      // This ensures cart always uses current prices, not outdated prices
      existingItem.effectivePrice = currentPrice
      existingItem.priceAtAddition = currentPrice

      // Update coupon if provided (replace existing coupon)
      if (couponData) {
        existingItem.appliedCoupon = couponData.appliedCoupon
        existingItem.couponCode = couponData.couponCode
        existingItem.allowedDiscountUnits = couponData.allowedDiscountUnits
        existingItem.fullPriceUnits = couponData.fullPriceUnits
        existingItem.discountAmount = couponData.discountAmount
        existingItem.discountedPrice = couponData.discountedPrice
      }
    } else {
      // ➕ Add new item to cart
      const newItem: any = {
        product: productId,
        variant: variantId,
        quantity,
        priceAtAddition: currentPrice, // Keep for backward compatibility
        effectivePrice: currentPrice, // Use effectivePrice for all calculations
        selected: true, // Items are selected by default
      }

      // Add coupon data if provided
      if (couponData) {
        newItem.appliedCoupon = couponData.appliedCoupon
        newItem.couponCode = couponData.couponCode
        newItem.discountAmount = couponData.discountAmount
        newItem.discountedPrice = couponData.discountedPrice
        newItem.allowedDiscountUnits = couponData.allowedDiscountUnits
        newItem.fullPriceUnits = couponData.fullPriceUnits
      }

      cart.items.push(newItem)
      // Note: subtotal will be recalculated automatically by pre-save hook
    }

    await cart.save()

    // Remove item from wishlist if it exists there
    try {
      const wishlist = await Wishlist.findOne({ user: user._id?.toString() })
      if (wishlist) {
        // Check if using new structure (items array)
        if (wishlist.items && Array.isArray(wishlist.items)) {
          // Remove from items array where product matches
          wishlist.items = wishlist.items.filter(
            (item) => item.product?.toString() !== productId.toString(),
          )
          await wishlist.save()
        }
        // Also handle old structure (products array) for backward compatibility
        else if ((wishlist as any).products && Array.isArray((wishlist as any).products)) {
          ;(wishlist as any).products = (wishlist as any).products.filter(
            (prodId: any) => prodId.toString() !== productId.toString(),
          )
          await wishlist.save()
        }
      }
    } catch (wishlistError) {
      // Log error but don't fail the cart operation
      console.error('Error removing from wishlist:', wishlistError)
    }

    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.product',
        select:
          'name slug mainImage price effectivePrice comparePrice seller status freeShipping requiresShipping shippingCharge',
        populate: {
          path: 'seller',
          select: 'businessName defaultShippingRate',
        },
      })
      .populate(
        'items.variant',
        '_id name sku price effectivePrice comparePrice stock mainImage discountPercent',
      )

    // Extract variantId from Mongoose document before toObject() conversion
    if (updatedCart) {
      extractVariantIdsFromCart(updatedCart)
    }

    // Merge variant data into product
    const mergedCart = mergeVariantIntoProduct(updatedCart?.toObject())

    // Calculate shipping for cart
    const cartWithShipping = calculateCartShipping(mergedCart)

    return res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: cartWithShipping,
    })
  } catch (error) {
    console.error('Add to cart error:', error)

    if (error instanceof Error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      })
    }

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while adding item to cart',
    })
  }
}

export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { productId, variantId, quantity, removeCoupon, couponId } = req.body

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' })
    }

    if (quantity !== undefined && quantity < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' })
    }

    const cart = await getOrCreateCart(user?._id?.toString()!)

    // Normalize variantId: convert to string or undefined
    const normalizedVariantId = variantId && variantId !== '' ? String(variantId) : undefined
    const itemIndex = findCartItemIndex(cart, productId, normalizedVariantId)

    if (itemIndex === -1) {
      // Log for debugging
      console.log('Cart item not found:', {
        productId,
        variantId: normalizedVariantId,
        cartItems: cart.items.map((item) => ({
          product: item.product.toString(),
          variant: item.variant ? item.variant.toString() : null,
        })),
      })
      return res.status(404).json({ error: 'Cart item not found' })
    }

    const item = cart.items[itemIndex]

    // If removeCoupon is true, remove coupon from cart item
    if (removeCoupon === true) {
      cart.items[itemIndex].appliedCoupon = undefined
      cart.items[itemIndex].couponCode = undefined
      cart.items[itemIndex].discountAmount = undefined
      cart.items[itemIndex].discountedPrice = undefined
      cart.items[itemIndex].allowedDiscountUnits = undefined
      cart.items[itemIndex].fullPriceUnits = undefined
      await cart.save()

      const updatedCart = await Cart.findById(cart._id)
        .populate({
          path: 'items.product',
          select:
            'name slug mainImage price effectivePrice comparePrice seller status freeShipping requiresShipping shippingCharge',
          populate: {
            path: 'seller',
            select: 'businessName defaultShippingRate',
          },
        })
        .populate(
          'items.variant',
          'name sku price effectivePrice comparePrice stock mainImage discountPercent',
        )

      // Merge variant data into product
      const mergedCart = mergeVariantIntoProduct(updatedCart?.toObject())

      // Calculate shipping for cart
      const cartWithShipping = calculateCartShipping(mergedCart)

      return res.status(200).json({
        success: true,
        message: 'Coupon removed from cart item',
        data: cartWithShipping,
      })
    }

    // Validate product and variant availability
    const { product } = await validateProductAndVariant(
      item.product.toString(),
      item.variant?.toString(),
      quantity ?? item.quantity,
    )

    // Check min/max order quantity (only if quantity is being updated)
    if (quantity !== undefined) {
      const minOrderQuantity = product.minOrderQuantity || 1
      const maxOrderQuantity = product.maxOrderQuantity

      if (quantity < minOrderQuantity) {
        return res.status(400).json({
          error: `Minimum order quantity is ${minOrderQuantity}`,
        })
      }

      if (maxOrderQuantity && quantity > maxOrderQuantity) {
        return res.status(400).json({
          error: `Maximum order quantity is ${maxOrderQuantity}`,
        })
      }

      // Update quantity
      cart.items[itemIndex].quantity = quantity
    }

    // Get current price (variant or product) - use effectivePrice
    const variant = item.variant ? await ProductVariant.findById(item.variant.toString()) : null
    const currentPrice =
      variant?.effectivePrice ??
      variant?.price ??
      product.effectivePrice ??
      product.price ??
      item.effectivePrice ??
      item.priceAtAddition // Fallback for backward compatibility

    // Update effectivePrice if price has changed
    if (Math.abs(item.effectivePrice - currentPrice) > 0.01) {
      cart.items[itemIndex].effectivePrice = currentPrice
    }

    const updatedQuantity = cart.items[itemIndex].quantity
    const couponToEvaluate = couponId ?? (item.appliedCoupon ? item.appliedCoupon.toString() : null)

    // Apply or recalculate coupon if requested/present
    if (couponToEvaluate) {
      try {
        const coupon = await SellerCoupon.findById(couponToEvaluate)
        if (!coupon) {
          if (couponId) {
            return res.status(404).json({ error: 'Coupon not found' })
          }
          // Coupon deleted - remove it
          cart.items[itemIndex].appliedCoupon = undefined
          cart.items[itemIndex].couponCode = undefined
          cart.items[itemIndex].discountAmount = undefined
          cart.items[itemIndex].discountedPrice = undefined
          cart.items[itemIndex].allowedDiscountUnits = undefined
          cart.items[itemIndex].fullPriceUnits = undefined
        } else {
          // Check if coupon is still valid (using latest status/dates)
          const now = new Date()
          const isDateValid = coupon.startDate <= now && coupon.endDate >= now
          const isStatusValid = coupon.status === 'active'
          const isApproved = !coupon.requiresApproval || coupon.isApproved

          if (!isDateValid || !isStatusValid || !isApproved) {
            if (couponId) {
              return res.status(400).json({ error: 'Coupon is not active or approved' })
            }
            // Coupon is no longer valid - remove it
            cart.items[itemIndex].appliedCoupon = undefined
            cart.items[itemIndex].couponCode = undefined
            cart.items[itemIndex].discountAmount = undefined
            cart.items[itemIndex].discountedPrice = undefined
            cart.items[itemIndex].allowedDiscountUnits = undefined
            cart.items[itemIndex].fullPriceUnits = undefined
          } else {
            // Ensure coupon still applies to this product/category
            let isEligible = false
            if (
              (!coupon.productIds || coupon.productIds.length === 0) &&
              (!coupon.categoryIds || coupon.categoryIds.length === 0)
            ) {
              if (product.seller.toString() === coupon.seller.toString()) {
                isEligible = true
              }
            } else {
              if (coupon.productIds && coupon.productIds.length > 0) {
                const productIdsStr = coupon.productIds.map((id: any) => (id?._id || id).toString())
                if (productIdsStr.includes(product.id)) {
                  isEligible = true
                }
              }

              if (!isEligible && coupon.categoryIds && coupon.categoryIds.length > 0) {
                const categoryIdsStr = coupon.categoryIds.map((id: any) =>
                  (id?._id || id).toString(),
                )
                const productCategoryId =
                  (product.category as any)?._id?.toString() || product.category?.toString()
                if (productCategoryId && categoryIdsStr.includes(productCategoryId)) {
                  isEligible = true
                }
              }
            }

            if (!isEligible) {
              if (couponId) {
                return res
                  .status(400)
                  .json({ error: 'Coupon is not applicable to this product or variant' })
              }
              cart.items[itemIndex].appliedCoupon = undefined
              cart.items[itemIndex].couponCode = undefined
              cart.items[itemIndex].discountAmount = undefined
              cart.items[itemIndex].discountedPrice = undefined
              cart.items[itemIndex].allowedDiscountUnits = undefined
              cart.items[itemIndex].fullPriceUnits = undefined
            } else {
              // ✅ Coupon is valid - recalculate discount using latest rules
              let allowedDiscountUnits = updatedQuantity
              if (coupon.maxRedemptionsPerUser) {
                const existingRedemptions = await CouponRedemption.countDocuments({
                  coupon: coupon._id,
                  user: user._id,
                  status: 'redeemed',
                })

                const remainingAllowed = Math.max(
                  0,
                  coupon.maxRedemptionsPerUser - existingRedemptions,
                )
                allowedDiscountUnits = Math.min(updatedQuantity, remainingAllowed)
              }

              let discountPerUnit = 0
              if (coupon.discountType === 'percent') {
                discountPerUnit = (currentPrice * coupon.discountValue) / 100
              } else {
                discountPerUnit = coupon.discountValue
                if (discountPerUnit > currentPrice) {
                  discountPerUnit = currentPrice
                }
              }

              const newDiscountAmount = discountPerUnit * allowedDiscountUnits
              const discountedPricePerUnit = currentPrice - discountPerUnit

              cart.items[itemIndex].appliedCoupon =
                coupon._id as (typeof cart.items)[number]['appliedCoupon']
              cart.items[itemIndex].couponCode = coupon.couponCode
              cart.items[itemIndex].discountAmount = newDiscountAmount
              cart.items[itemIndex].discountedPrice = discountedPricePerUnit
              cart.items[itemIndex].allowedDiscountUnits = allowedDiscountUnits
              cart.items[itemIndex].fullPriceUnits = updatedQuantity - allowedDiscountUnits
            }
          }
        }
      } catch (couponError) {
        console.error('Error recalculating coupon discount:', couponError)
        // If coupon validation fails, remove it
        cart.items[itemIndex].appliedCoupon = undefined
        cart.items[itemIndex].couponCode = undefined
        cart.items[itemIndex].discountAmount = undefined
        cart.items[itemIndex].discountedPrice = undefined
        cart.items[itemIndex].allowedDiscountUnits = undefined
        cart.items[itemIndex].fullPriceUnits = undefined
      }
    }

    await cart.save()

    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.product',
        select:
          'name slug mainImage price effectivePrice comparePrice seller status freeShipping requiresShipping shippingCharge',
        populate: {
          path: 'seller',
          select: 'businessName defaultShippingRate',
        },
      })
      .populate(
        'items.variant',
        '_id name sku price effectivePrice comparePrice stock mainImage discountPercent',
      )

    // Extract variantId from Mongoose document before toObject() conversion
    if (updatedCart) {
      extractVariantIdsFromCart(updatedCart)
    }

    // Merge variant data into product
    const mergedCart = mergeVariantIntoProduct(updatedCart?.toObject())

    // Calculate shipping for cart
    const cartWithShipping = calculateCartShipping(mergedCart)

    return res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
      data: cartWithShipping,
    })
  } catch (error: any) {
    console.error('Error updating cart item:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Something went wrong while updating cart item',
    })
  }
}

export const removeCartItem = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { productId, variantId } = req.query

    if (!productId || typeof productId !== 'string') {
      return res.status(400).json({ error: 'Product ID is required' })
    }

    const cart = await getOrCreateCart(user?._id?.toString()!)

    // Debug logging
    console.log('Remove cart item - Request params:', { productId, variantId })
    console.log(
      'Cart items:',
      cart.items.map((item) => ({
        productId: item.product?.toString(),
        variantId: item.variant?.toString(),
      })),
    )

    const itemIndex = findCartItemIndex(cart, productId as string, variantId as string | undefined)

    if (itemIndex === -1) {
      console.log('Cart item not found - productId:', productId, 'variantId:', variantId)
      return res.status(404).json({ error: 'Cart item not found' })
    }

    // Remove item
    cart.items.splice(itemIndex, 1)
    await cart.save()

    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.product',
        select:
          'name slug mainImage price effectivePrice comparePrice seller status freeShipping requiresShipping shippingCharge',
        populate: {
          path: 'seller',
          select: 'businessName defaultShippingRate',
        },
      })
      .populate(
        'items.variant',
        '_id name sku price effectivePrice comparePrice stock mainImage discountPercent',
      )

    // Extract variantId from Mongoose document before toObject() conversion
    if (updatedCart) {
      extractVariantIdsFromCart(updatedCart)
    }

    // Merge variant data into product
    const mergedCart = mergeVariantIntoProduct(updatedCart?.toObject())

    // Calculate shipping for cart
    const cartWithShipping = calculateCartShipping(mergedCart)

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cartWithShipping,
    })
  } catch (error) {
    console.error('Error removing cart item:', error)
    return res.status(500).json({
      success: false,
      message: 'Something went wrong while removing cart item',
    })
  }
}

export const clearCart = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const cart = await getOrCreateCart(user?._id?.toString()!)

    cart.items = []
    await cart.save()

    const cartData = {
      ...cart.toObject(),
      items: [],
      shipping: 0,
      totalWithShipping: 0,
    }

    return res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      data: cartData,
    })
  } catch (error) {
    console.error('Error clearing cart:', error)
    return res.status(500).json({
      success: false,
      message: 'Something went wrong while clearing cart',
    })
  }
}

export const saveForLater = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { productId, variantId } = req.body
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' })
    }

    // Ensure product exists (wishlist stores only products, not variants)
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }

    // Get cart and locate item
    const cart = await getOrCreateCart(user?._id?.toString()!)
    const itemIndex = findCartItemIndex(cart, productId as string, variantId as string | undefined)

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in cart' })
    }

    // Get or create wishlist and add product if not already present
    let wishlist = await Wishlist.findOne({ user: user._id })

    // Get product price for tracking - use effectivePrice
    const productPrice = product.effectivePrice ?? product.price ?? 0

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: user._id,
        items: [
          {
            product: productId,
            priceAtAddition: productPrice,
            addedAt: new Date(),
          },
        ],
      })
    } else {
      const alreadyInWishlist = wishlist.items.some((item) => item.product.toString() === productId)
      if (!alreadyInWishlist) {
        wishlist.items.push({
          product: productId as any,
          priceAtAddition: productPrice,
          addedAt: new Date(),
        })
        await wishlist.save()
      }
    }

    // Remove item from cart
    cart.items.splice(itemIndex, 1)
    await cart.save()

    // Populate updated resources for response
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.product',
        select: 'name slug mainImage price effectivePrice comparePrice seller status',
        populate: {
          path: 'seller',
          select: 'businessName defaultShippingRate',
        },
      })
      .populate(
        'items.variant',
        '_id name sku price effectivePrice comparePrice stock mainImage discountPercent',
      )

    // Extract variantId from Mongoose document before toObject() conversion
    if (updatedCart) {
      extractVariantIdsFromCart(updatedCart)
    }

    // Merge variant data into product
    const mergedCart = mergeVariantIntoProduct(updatedCart?.toObject())

    const updatedWishlist = await Wishlist.findOne({ user: user._id }).populate({
      path: 'items.product',
      select:
        'name mainImage price comparePrice discountPercent rating reviewCount seller slug status stock',
      populate: { path: 'seller', select: 'businessName' },
    })

    return res.status(200).json({
      success: true,
      message: 'Item saved for later',
      data: {
        wishlist: updatedWishlist,
        cart: mergedCart,
      },
    })
  } catch (error: any) {
    console.error('Save for later error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
}

// Toggle item selection
export const toggleItemSelection = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { productId, variantId, selected } = req.body

    if (selected === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Selected status is required',
      })
    }

    const cart = await getOrCreateCart(user._id?.toString()!)
    const itemIndex = findCartItemIndex(cart, productId, variantId)

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart',
      })
    }

    cart.items[itemIndex].selected = selected
    await cart.save()

    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.product',
        model: 'Product',
        select:
          'name slug price effectivePrice comparePrice mainImage stock description status discountPercent shortDescription tags isFeatured freeShipping requiresShipping shippingCharge',
        populate: {
          path: 'seller',
          select: 'businessName defaultShippingRate',
        },
      })
      .populate({
        path: 'items.variant',
        model: 'ProductVariant',
        select:
          '_id name price effectivePrice comparePrice sku stock mainImage status discountPercent shortDescription',
      })

    // Extract variantId from Mongoose document before toObject() conversion
    if (updatedCart) {
      extractVariantIdsFromCart(updatedCart)
    }

    // Merge variant data into product
    const mergedCart = mergeVariantIntoProduct(updatedCart?.toObject())

    // Calculate shipping for cart
    const cartWithShipping = calculateCartShipping(mergedCart)

    return res.status(200).json({
      success: true,
      message: 'Item selection updated',
      data: cartWithShipping,
    })
  } catch (error: any) {
    console.error('Toggle selection error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
}

// Toggle all items selection
export const toggleAllSelection = async (req: Request, res: Response) => {
  try {
    const user = await checkUserAccess(req, res, ['customer'])
    if (!user) return

    const { selected } = req.body

    if (selected === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Selected status is required',
      })
    }

    const cart = await getOrCreateCart(user._id?.toString()!)

    cart.items.forEach((item) => {
      item.selected = selected
    })

    await cart.save()

    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.product',
        model: 'Product',
        select:
          'name slug price effectivePrice comparePrice mainImage stock description status discountPercent shortDescription tags isFeatured freeShipping requiresShipping shippingCharge',
        populate: { path: 'seller', select: 'businessName defaultShippingRate' },
      })
      .populate({
        path: 'items.variant',
        model: 'ProductVariant',
        select:
          '_id name price effectivePrice comparePrice sku stock mainImage status discountPercent shortDescription',
      })

    // Extract variantId from Mongoose document before toObject() conversion
    if (updatedCart) {
      extractVariantIdsFromCart(updatedCart)
    }

    // Merge variant data into product
    const mergedCart = mergeVariantIntoProduct(updatedCart?.toObject())

    // Calculate shipping for cart
    const cartWithShipping = calculateCartShipping(mergedCart)

    return res.status(200).json({
      success: true,
      message: `All items ${selected ? 'selected' : 'deselected'}`,
      data: cartWithShipping,
    })
  } catch (error: any) {
    console.error('Toggle all selection error:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    })
  }
}
