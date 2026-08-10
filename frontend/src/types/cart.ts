export interface CartProductSeller {
  _id: string
  businessName?: string
}

export interface CartProduct {
  _id: string
  name: string
  slug: string
  mainImage?: string
  price: number
  effectivePrice?: number // What customer actually pays (from backend)
  comparePrice?: number // Original price for comparison
  stock: number
  status: string
  discountPercent?: number
  tags?: string[]
  isFeatured?: boolean
  freeShipping?: boolean
  requiresShipping?: boolean
  shippingCharge?: number
  defaultShippingRate?: number // Seller's default shipping rate (appended when free shipping is not enabled)
  payOnDelivery?: boolean
  minOrderQuantity?: number // Minimum order quantity required
  maxOrderQuantity?: number // Maximum order quantity allowed
  seller?: CartProductSeller
  category?: {
    _id: string
    name?: string
  } | string
}

export interface CartItem {
  product: CartProduct
  // Variant data is now merged into product, not sent as separate field
  variantId?: string // Variant ID stored at item level (for operations like remove, update)
  quantity: number
  priceAtAddition: number
  subtotal?: number
  selected?: boolean // Whether this item is selected for checkout
  unavailable?: boolean // Whether product is unavailable (inactive or filtered out)
  shipping?: number // Shipping charge for this item
  // Coupon information
  appliedCoupon?: string // Coupon ID
  couponCode?: string // Coupon code for display
  discountAmount?: number // Total discount amount for allowed units only
  discountedPrice?: number // Price per unit after discount (for discounted units)
  allowedDiscountUnits?: number // How many units get discount (maxRedemptionsPerUser limit)
  fullPriceUnits?: number // How many units at full price
}

export interface Cart {
  _id: string
  user: string
  items: CartItem[]
  totalQuantity: number
  totalAmount: number
  shipping?: number // Shipping charge calculated on backend
  totalWithShipping?: number // Total including shipping
  createdAt?: string
  updatedAt?: string
}
