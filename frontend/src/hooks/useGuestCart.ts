import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import API from '@/lib/axios'
import { guestCartUtils } from '@/utils/guestCart'
import type { CartItem, CartProduct } from '@/types/cart'

interface GuestCartItemWithProduct extends CartItem {
  product: CartProduct
}

export const useGuestCart = () => {
  const queryClient = useQueryClient()
  const [cartVersion, setCartVersion] = useState(0)
  
  // Get fresh cart data - this will be reactive
  const [guestCart, setGuestCart] = useState(() => guestCartUtils.getCart())
  
  // Create a stable key based on cart items and version
  const cartKey = JSON.stringify({
    items: guestCart.map(item => ({ 
      productId: item.productId, 
      variantId: item.variantId, 
      quantity: item.quantity 
    })),
    version: cartVersion
  })

  const query = useQuery({
    queryKey: ['guest-cart', cartKey],
    queryFn: async () => {
      // Get fresh cart data when query runs
      const currentCart = guestCartUtils.getCart()
      console.log('useGuestCart query running, cart items:', currentCart.length)
      if (currentCart.length === 0) {
        console.log('Guest cart is empty')
        return { 
          items: [], 
          totalQuantity: 0, 
          totalAmount: 0,
          shipping: 0,
          totalWithShipping: 0,
        }
      }

      // Call backend guest cart endpoint to get cart with shipping calculated
      try {
        const response = await API.post('/cart/guest', {
          items: currentCart.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity || 1,
            selected: item.selected !== false,
          }))
        })

        const cartData = response.data?.data || response.data
        const items = cartData.items || []
        
        // Remove items from localStorage if they're not in the response (products not found)
        const returnedProductIds = new Set(
          items.map((item: any) => ({
            productId: item.product?._id || item.product?.id,
            variantId: item.variantId,
          }))
        )
        
        currentCart.forEach((localItem) => {
          const found = items.some((item: any) => {
            const productId = item.product?._id || item.product?.id
            return productId === localItem.productId && 
                   (item.variantId || null) === (localItem.variantId || null)
          })
          if (!found) {
            console.log(`Removing item ${localItem.productId} from guest cart (not found in response)`)
            guestCartUtils.removeItem(localItem.productId, localItem.variantId)
          }
        })

        const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
        const totalAmount = items.reduce((sum: number, item: any) => sum + (item.subtotal || 0), 0)

        return {
          items: items.map((item: any) => ({
            product: item.product,
            variantId: item.variantId,
            quantity: item.quantity,
            selected: item.selected !== false,
            subtotal: item.subtotal,
            shipping: item.shipping || 0,
            priceAtAddition: item.priceAtAddition,
          })),
          totalQuantity,
          totalAmount,
          shipping: cartData.shipping || 0,
          totalWithShipping: cartData.totalWithShipping || totalAmount,
        }
      } catch (error: any) {
        console.error('Failed to fetch guest cart:', error)
        // Fallback: return empty cart
        return { 
          items: [], 
          totalQuantity: 0, 
          totalAmount: 0,
          shipping: 0,
          totalWithShipping: 0,
        }
      }
    },
    // Always enable the query - it will return empty data if cart is empty
    enabled: true,
    staleTime: 0, // Always refetch when cart changes
    refetchOnMount: 'always', // Always refetch on mount
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  // Listen for guest cart updates and update state
  useEffect(() => {
    const handleGuestCartUpdate = () => {
      // Update local state to trigger query key change
      const updatedCart = guestCartUtils.getCart()
      console.log('Guest cart updated, items:', updatedCart.length)
      setGuestCart(updatedCart)
      setCartVersion(prev => prev + 1)
      // Also invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ['guest-cart'] })
      query.refetch()
    }
    
    window.addEventListener('guest-cart-updated', handleGuestCartUpdate)
    
    // Initial sync on mount - check localStorage directly
    const currentCart = guestCartUtils.getCart()
    console.log('Initial guest cart from localStorage:', currentCart.length, 'items')
    if (currentCart.length > 0 && guestCart.length === 0) {
      setGuestCart(currentCart)
      setCartVersion(1)
    }
    
    return () => {
      window.removeEventListener('guest-cart-updated', handleGuestCartUpdate)
    }
  }, [queryClient, query, guestCart.length])

  // Debug: Log query state changes
  useEffect(() => {
    console.log('useGuestCart query state:', {
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      data: query.data,
      itemsCount: query.data?.items?.length || 0,
      cartKey
    })
  }, [query.isLoading, query.isFetching, query.data, cartKey])

  return query
}
