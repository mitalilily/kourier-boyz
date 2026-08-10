import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import API from '../lib/axios'
import { useAuthStore } from '../store/authStore'
import type { Product } from './products'

export interface WishlistItem {
  product: WishlistProduct
  variantId?: string // Variant ID stored at item level
  priceAtAddition?: number
  note?: string
  addedAt: string
}

export interface WishlistProduct extends Omit<Product, 'seller'> {
  seller: {
    _id: string
    name: string
    storeName?: string
    storeDescription?: string
    storeSlug?: string
    sellerRating?: number
    sellerReviewCount?: number
    businessName?: string
  }
  // Variant data is merged into product, not sent as separate variant field
  variants?: Array<{
    _id: string
    name?: string
    price?: number
    effectivePrice?: number
    comparePrice?: number
    stock?: number
    status?: string
    isDefault?: boolean
    attributes?: Record<string, string>
    [key: string]: unknown
  }>
}

export interface Wishlist {
  _id: string
  user: string
  items: WishlistItem[]
  products?: WishlistProduct[] // For backward compatibility with old structure
  isPublic?: boolean
  shareToken?: string
  createdAt: string
  updatedAt: string
}

export interface WishlistResponse {
  wishlist: Wishlist
}

export interface SharedWishlistResponse {
  wishlist: Wishlist
}

// Get user's wishlist
export const useWishlist = <TData = WishlistResponse>(options?: {
  select?: (data: WishlistResponse) => TData
}) => {
  const { isAuthenticated } = useAuthStore()

  return useQuery<WishlistResponse, unknown, TData>({
    queryKey: ['wishlist'],
    queryFn: async () => {
      const response = await API.get('/wishlist')
      return response.data
    },
    enabled: isAuthenticated,
    select: options?.select,
  })
}

// Pagination response type for wishlist
export interface WishlistPaginatedResponse {
  wishlist: Wishlist
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
    hasMore: boolean
  }
}

// Infinite scroll hook for wishlist
export const useWishlistInfinite = (params?: { limit?: number; enabled?: boolean }) => {
  const { isAuthenticated } = useAuthStore()
  const { limit = 20, enabled = true } = params || {}

  return useInfiniteQuery<WishlistPaginatedResponse>({
    queryKey: ['wishlist', 'infinite', limit],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === 'number' ? pageParam : 1
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      const response = await API.get(`/wishlist?${queryParams.toString()}`)
      return response.data
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination?.hasMore) return undefined
      return lastPage.pagination.page + 1
    },
    enabled: isAuthenticated && enabled,
  })
}

// Add product to wishlist
export const useAddToWishlist = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (payload: { productId: string; variantId?: string; note?: string }) => {
      const response = await API.post('/wishlist', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
      toast.success('Added to wishlist!')
    },
    onError: (error: unknown) => {
      const axiosError = error as {
        response?: { status?: number; data?: { error?: string } }
      }
      if (axiosError.response?.status === 401) {
        navigate('/login')
      } else {
        toast.error(axiosError.response?.data?.error || 'Failed to add to wishlist')
      }
    },
  })
}

// Remove product from wishlist
export const useRemoveFromWishlist = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { productId: string; variantId?: string }) => {
      const params = payload.variantId ? `?variantId=${payload.variantId}` : ''
      const response = await API.delete(`/wishlist/${payload.productId}${params}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
      toast.success('Product removed from wishlist!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to remove from wishlist')
    },
  })
}

// Bulk remove products from wishlist
export const useBulkRemoveFromWishlist = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (productIds: string[]) => {
      const response = await API.delete('/wishlist/bulk/remove', {
        data: { productIds },
      })
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
      toast.success(data.message || 'Products removed from wishlist!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to remove products')
    },
  })
}

// Update wishlist item note
export const useUpdateWishlistItemNote = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { productId: string; note?: string }) => {
      const response = await API.patch(`/wishlist/item/${payload.productId}/note`, {
        note: payload.note,
      })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
      toast.success('Note updated!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to update note')
    },
  })
}

// Move all items to cart
export const useMoveAllToCart = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { removeFromWishlist?: boolean }) => {
      const response = await API.post('/wishlist/move-to-cart', payload)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      toast.success(data.message || 'Items moved to cart!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to move items to cart')
    },
  })
}

// Update wishlist visibility
export const useUpdateWishlistVisibility = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: { isPublic: boolean }) => {
      const response = await API.patch('/wishlist/visibility', payload)
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
      toast.success(data.message || 'Wishlist visibility updated!')
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to update wishlist visibility')
    },
  })
}

// Toggle product in wishlist (add if not present, remove if present)
export const useToggleWishlist = () => {
  const addMutation = useAddToWishlist()
  const removeMutation = useRemoveFromWishlist()
  const { data: wishlistData } = useWishlist()
  const { isAuthenticated } = useAuthStore()

  const toggleProduct = async (productId: string, variantId?: string) => {
    if (!isAuthenticated) {
      return
    }

    // Find the item in wishlist to get its variantId
    const wishlistItem = wishlistData?.wishlist?.items?.find(
      (item) => item?.product?._id === productId,
    )

    const isInWishlist = Boolean(wishlistItem)

    if (isInWishlist) {
      // Use variantId from wishlist item if available (stored at item level)
      const itemVariantId = wishlistItem?.variantId
      await removeMutation.mutateAsync({ productId, variantId: itemVariantId })
    } else {
      await addMutation.mutateAsync({ productId, variantId })
    }
  }

  return {
    toggleProduct,
    isLoading: addMutation.isPending || removeMutation.isPending,
  }
}

// Check if product is in wishlist without extra network calls
export const useWishlistStatus = (productId?: string | null) => {
  const { isAuthenticated } = useAuthStore()
  const wishlistQuery = useWishlist({
    select: (data) =>
      new Set(
        (data?.wishlist?.items ?? [])
          .map((item) => item.product?._id)
          .filter((id): id is string => Boolean(id))
          .map((id) => String(id)),
      ),
  })

  const itemIds = wishlistQuery.data ?? new Set<string>()
  const isInWishlist =
    Boolean(productId) && isAuthenticated ? itemIds.has(String(productId)) : false

  return {
    isInWishlist,
    isLoading: wishlistQuery.isLoading,
    isFetching: wishlistQuery.isFetching,
  }
}

// Generate share token
export const useGenerateShareToken = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await API.post('/wishlist/share/generate')
      return response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] })
      // Copy to clipboard
      if (data.shareUrl) {
        navigator.clipboard.writeText(data.shareUrl)
        toast.success('Share link copied to clipboard!')
      }
      return data
    },
    onError: (error: unknown) => {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to generate share link')
    },
  })
}

// Fetch shared wishlist by token
export const useSharedWishlist = (token?: string) => {
  return useQuery<SharedWishlistResponse>({
    queryKey: ['shared-wishlist', token],
    queryFn: async () => {
      const response = await API.get(`/wishlist/shared/${token}`)
      return response.data
    },
    enabled: Boolean(token),
  })
}
