import API from '@/lib/axios'
import { useAuthStore } from '@/store/authStore'
import type { Cart } from '@/types/cart'
import { guestCartUtils } from '@/utils/guestCart'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

export interface CartResponse {
  success?: boolean
  message?: string
  data?: Cart
  cart?: Cart
}

export const useCart = () => {
  const { isAuthenticated } = useAuthStore()
  return useQuery<CartResponse>({
    queryKey: ['cart'],
    queryFn: async () => {
      const res = await API.get('/cart')
      return res.data
    },
    select: (data) => data,
    enabled: isAuthenticated,
    placeholderData: (previousData) => previousData,
  })
}

export const useAddToCart = () => {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  
  return useMutation({
    mutationFn: async (payload: {
      productId: string
      variantId?: string
      quantity?: number
      couponId?: string
      skipNavigation?: boolean // Optional flag to skip navigation (for internal use)
    }) => {
      // If not authenticated, save to guest cart
      if (!isAuthenticated) {
        guestCartUtils.addItem({
          productId: payload.productId,
          variantId: payload.variantId,
          quantity: payload.quantity || 1,
          couponId: payload.couponId,
          selected: true,
        })
        // Trigger a custom event to update cart count in header
        window.dispatchEvent(new CustomEvent('guest-cart-updated'))
        return { message: 'Added to cart', success: true } as CartResponse
      }
      
      // If authenticated, use API
      const res = await API.post('/cart', payload)
      return res.data as CartResponse
    },
    onSuccess: (data) => {
      if (isAuthenticated) {
        qc.invalidateQueries({ queryKey: ['cart'] })
        qc.invalidateQueries({ queryKey: ['wishlist'] }) // Refresh wishlist after adding to cart
      }
      toast.success(data?.message || 'Added to cart')
      
      // Note: Regular "Add to Cart" should NOT navigate to checkout
      // Only "Buy Now" should navigate to checkout
      // Navigation to checkout is handled by the component calling this hook
    },
    onError: (error: unknown) => {
      // Only handle errors for authenticated users (guests use localStorage, no API calls)
      if (!isAuthenticated) {
        // This shouldn't happen for guests, but just in case
        console.error('Error adding to guest cart:', error)
        toast.error('Failed to add to cart')
        return
      }
      
      const axiosError = error as {
        response?: { status?: number; data?: { error?: string } }
      }
      if (axiosError.response?.status === 401) {
        navigate('/login')
      } else {
        toast.error(axiosError.response?.data?.error || 'Failed to add to cart')
      }
    },
  })
}

export const useUpdateCartItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      productId: string
      variantId?: string
      quantity?: number
      removeCoupon?: boolean
      couponId?: string
    }) => {
      const res = await API.put('/cart/item', payload)
      return res.data as CartResponse
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: ['cart'] })

      const previousCart = qc.getQueryData<CartResponse>(['cart'])
      if (!previousCart) {
        return { previousCart }
      }

      const currentCart = previousCart.data || previousCart.cart
      if (!currentCart) {
        return { previousCart }
      }

      const updatedItems = currentCart.items.map((item) => {
        const isMatchingItem =
          item.product._id === payload.productId && (item.variantId || undefined) === payload.variantId

        if (!isMatchingItem || payload.quantity === undefined) {
          return item
        }

        const currentUnitSubtotal =
          item.quantity > 0
            ? (item.subtotal ?? item.priceAtAddition * item.quantity) / item.quantity
            : item.priceAtAddition
        const recalculatedSubtotal = Number((currentUnitSubtotal * payload.quantity).toFixed(2))

        return {
          ...item,
          quantity: payload.quantity,
          subtotal: recalculatedSubtotal,
        }
      })

      const totalQuantity = updatedItems.reduce((sum, item) => sum + item.quantity, 0)
      const totalAmount = updatedItems.reduce(
        (sum, item) => sum + (item.subtotal ?? item.priceAtAddition * item.quantity),
        0,
      )

      const nextCart = {
        ...currentCart,
        items: updatedItems,
        totalQuantity,
        totalAmount,
        totalWithShipping: totalAmount + (currentCart.shipping || 0),
      }

      qc.setQueryData<CartResponse>(['cart'], {
        ...previousCart,
        data: previousCart.data ? nextCart : previousCart.data,
        cart: previousCart.cart ? nextCart : previousCart.cart,
      })

      return { previousCart }
    },
    onSuccess: (data) => {
      if (data?.message) {
        toast.success(data.message)
      }
    },
    onSettled: (_data, error, _variables, context) => {
      if (error && context?.previousCart) {
        qc.setQueryData(['cart'], context.previousCart)
      }
      qc.invalidateQueries({ queryKey: ['cart'] })
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previousCart) {
        qc.setQueryData(['cart'], context.previousCart)
      }
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to update cart item')
    },
  })
}

export const useRemoveCartItem = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { productId: string; variantId?: string }) => {
      const params = new URLSearchParams()
      params.set('productId', payload.productId)
      // Always send variantId if provided (even if empty string, convert to undefined)
      if (payload.variantId && payload.variantId.trim() !== '') {
        params.set('variantId', payload.variantId)
      }
      const res = await API.delete(`/cart/item?${params.toString()}`)
      return res.data as CartResponse
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cart'] })
      toast.success(data?.message || 'Item removed')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to remove item')
    },
  })
}

export const useClearCart = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await API.delete('/cart')
      return res.data as CartResponse
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cart'] })
      toast.success(data?.message || 'Cart cleared')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to clear cart')
    },
  })
}

export const useSaveForLater = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { productId: string; variantId?: string }) => {
      const res = await API.post('/cart/save-for-later', payload)
      return res.data as { message?: string }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['cart'] })
      qc.invalidateQueries({ queryKey: ['wishlist'] })
      toast.success(data?.message || 'Saved for later')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to save for later')
    },
  })
}

// Toggle item selection
export const useToggleItemSelection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { productId: string; variantId?: string; selected: boolean }) => {
      const res = await API.patch('/cart/item/selection', payload)
      return res.data as CartResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] })
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to update selection')
    },
  })
}

// Toggle all items selection
export const useToggleAllSelection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { selected: boolean }) => {
      const res = await API.patch('/cart/selection/all', payload)
      return res.data as CartResponse
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] })
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to update selection')
    },
  })
}

// Merge guest cart with user cart after login
export const useMergeGuestCart = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const guestCart = guestCartUtils.getCart()
      if (guestCart.length === 0) {
        return { message: 'No items to merge', success: true }
      }

      // Add all guest cart items to user cart
      const promises = guestCart.map((item) => {
        const payload: {
          productId: string
          variantId?: string
          quantity: number
          couponId?: string
        } = {
          productId: item.productId,
          quantity: item.quantity,
        }
        // Only include variantId if it's actually present (not undefined)
        if (item.variantId) {
          payload.variantId = item.variantId
        }
        // Only include couponId if it's actually present
        if (item.couponId) {
          payload.couponId = item.couponId
        }
        return API.post('/cart', payload)
      })

      await Promise.all(promises)
      
      // Clear guest cart after successful merge
      guestCartUtils.clearCart()
      window.dispatchEvent(new CustomEvent('guest-cart-updated'))
      
      return { message: 'Cart merged successfully', success: true }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] })
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to merge cart')
    },
  })
}
