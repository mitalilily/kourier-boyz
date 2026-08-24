import Cart, { ICart } from '../models/Cart'
import Product from '../models/Product'
import ProductVariant from '../models/ProductVariant'

export const getOrCreateCart = async (userId: string) => {
  let cart = await Cart.findOne({ user: userId })
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] })
  }
  return cart
}

export const findCartItemIndex = (cart: ICart, productId: string, variantId?: string) => {
  // Normalize productId to string
  const normalizedProductId = String(productId)

  // Normalize variantId: convert to string or null (treat empty string as null)
  const normalizedVariantId = variantId && variantId.trim() !== '' ? String(variantId) : null

  // First, try exact match (product + variant)
  const exactMatchIndex = cart.items.findIndex((item) => {
    const itemProductId = item.product ? String(item.product) : null
    const matchProduct = itemProductId === normalizedProductId

    if (!matchProduct) return false

    const itemVariantId = item.variant ? String(item.variant) : null

    // If both are null or both match, it's a match
    if (itemVariantId === normalizedVariantId) return true

    // If one is null and the other isn't, no match
    if (!itemVariantId || !normalizedVariantId) return false

    // Both exist, check if they match
    return itemVariantId === normalizedVariantId
  })

  if (exactMatchIndex !== -1) {
    return exactMatchIndex
  }

  // If no variantId provided in request, try to find by productId only
  // This handles cases where frontend doesn't send variantId but cart item has one
  // OR when cart item doesn't have variant but frontend might have sent one
  if (!normalizedVariantId) {
    // Find all items matching this productId (regardless of variant)
    const matchingIndices = cart.items
      .map((item, index) => {
        const itemProductId = item.product ? String(item.product) : null
        return itemProductId === normalizedProductId ? index : -1
      })
      .filter((index) => index !== -1)

    // If exactly one item matches the productId, return it (unambiguous match)
    if (matchingIndices.length === 1) {
      return matchingIndices[0]
    }
  }

  return -1
}

export const validateProductAndVariant = async (
  productId: string,
  variantId?: string,
  quantity = 1,
) => {
  const product = await Product.findById(productId)
  if (!product) throw new Error('Product not found')
  if (product.status !== 'active') throw new Error('Product is not active')

  if (product.hasVariants) {
    if (!variantId) throw new Error('Variant ID is required for this product')
    const variant = await ProductVariant.findOne({
      _id: variantId,
      product: productId,
      status: 'active',
    })
    if (!variant) throw new Error('Variant not found or inactive')
    if (variant.stock < quantity) throw new Error('Insufficient variant stock')

    return { product, variant }
  } else {
    if (variantId) throw new Error('This product does not have variants')
    if (product.stock < quantity) throw new Error('Insufficient product stock')

    return { product, variant: null }
  }
}
