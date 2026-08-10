const GUEST_CART_KEY = 'kourier_boyz_guest_cart'

export interface GuestCartItem {
  productId: string
  variantId?: string
  quantity: number
  couponId?: string
  selected?: boolean
  addedAt: number
}

export const guestCartUtils = {
  // Get guest cart from localStorage
  getCart: (): GuestCartItem[] => {
    if (typeof window === 'undefined') return []
    try {
      const cartStr = localStorage.getItem(GUEST_CART_KEY)
      if (!cartStr) return []
      return JSON.parse(cartStr) as GuestCartItem[]
    } catch {
      localStorage.removeItem(GUEST_CART_KEY)
      return []
    }
  },

  // Add item to guest cart
  addItem: (item: Omit<GuestCartItem, 'addedAt'>): void => {
    const cart = guestCartUtils.getCart()
    const existingIndex = cart.findIndex(
      (cartItem) => cartItem.productId === item.productId && cartItem.variantId === item.variantId,
    )

    if (existingIndex >= 0) {
      // Update quantity
      cart[existingIndex].quantity = (cart[existingIndex].quantity || 0) + (item.quantity || 1)
      cart[existingIndex].selected = item.selected !== false
    } else {
      // Add new item
      cart.push({
        ...item,
        selected: item.selected !== false,
        addedAt: Date.now(),
      })
    }

    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart))
  },

  // Update item in guest cart
  updateItem: (
    productId: string,
    variantId: string | undefined,
    updates: Partial<GuestCartItem>,
  ): void => {
    const cart = guestCartUtils.getCart()
    const index = cart.findIndex(
      (item) => item.productId === productId && item.variantId === variantId,
    )

    if (index >= 0) {
      // Note: Validation should be done by the caller before calling updateItem
      // This function just updates the value in localStorage
      cart[index] = { ...cart[index], ...updates }
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart))
    }
  },

  // Remove item from guest cart
  removeItem: (productId: string, variantId?: string): void => {
    const cart = guestCartUtils.getCart()
    const filtered = cart.filter(
      (item) => !(item.productId === productId && item.variantId === variantId),
    )
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(filtered))
  },

  // Clear guest cart
  clearCart: (): void => {
    localStorage.removeItem(GUEST_CART_KEY)
  },

  // Get cart count
  getCartCount: (): number => {
    const cart = guestCartUtils.getCart()
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0)
  },

  // Check if cart has items
  hasItems: (): boolean => {
    return guestCartUtils.getCart().length > 0
  },
}
