import type { ServiceabilityResponse } from '@/api/products'
import { getDeliveryDateLabel, sanitizePinCode } from '@/components/product-detail/utils'
import API from '@/lib/axios'
import type { CartItem } from '@/types/cart'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

interface UseCartDeliveryProps {
  selectedItems: CartItem[]
  deliveryPin: string
  paymentType?: 'cod' | 'prepaid'
}

interface AggregatedDeliveryStatus {
  status: 'success' | 'error' | 'loading' | null
  message: string
  estimatedDeliveryDate: string | null
  estimatedDeliveryDays: number | null
  allServiceable: boolean
  serviceabilityData: ServiceabilityResponse['data'][]
}

export const useCartDelivery = ({
  selectedItems,
  deliveryPin,
  paymentType = 'cod',
}: UseCartDeliveryProps) => {
  const sanitizedPin = sanitizePinCode(deliveryPin)
  const validPin = sanitizedPin.length >= 5

  // Get unique products from selected items (to avoid duplicate API calls)
  // Memoize to prevent infinite loops
  const uniqueProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          selectedItems
            .filter((item) => item.selected !== false && item.product.stock > 0)
            .map((item) => item.product._id),
        ),
      ),
    [selectedItems],
  )

  // Calculate order amount for each product
  // Memoize to prevent infinite loops
  const productAmounts = useMemo(
    () =>
      selectedItems.reduce((acc, item) => {
        if (item.selected === false || item.product.stock <= 0) return acc
        const productId = item.product._id
        const price = item.product.effectivePrice ?? item.product.price ?? 0
        const quantity = item.quantity
        acc[productId] = (acc[productId] || 0) + price * quantity
        return acc
      }, {} as Record<string, number>),
    [selectedItems],
  )

  // Memoize the sorted product IDs string for query key
  const productIdsKey = useMemo(() => uniqueProductIds.sort().join(','), [uniqueProductIds])

  // Memoize the amounts string for query key
  const amountsKey = useMemo(() => Object.values(productAmounts).join(','), [productAmounts])

  // Fetch serviceability for all products using Promise.all
  const {
    data: allServiceabilityData,
    isLoading,
    isFetching,
    error,
  } = useQuery<ServiceabilityResponse[]>({
    queryKey: ['cart', 'serviceability', productIdsKey, sanitizedPin, paymentType, amountsKey],
    queryFn: async () => {
      if (!validPin || uniqueProductIds.length === 0) {
        return []
      }

      const requests = uniqueProductIds.map(async (productId) => {
        const params = new URLSearchParams({
          destination: sanitizedPin,
        })

        if (productAmounts[productId]) {
          params.append('orderAmount', String(productAmounts[productId]))
        }

        if (paymentType) {
          params.append('paymentType', paymentType)
        }

        const response = await API.get<ServiceabilityResponse>(
          `/products/${productId}/serviceability?${params.toString()}`,
        )
        return response.data
      })

      return Promise.all(requests)
    },
    enabled: validPin && uniqueProductIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false, // Prevent refetch on window focus
    refetchOnMount: false, // Use cached data if available
  })

  // Memoize allData to prevent infinite loops
  const allData = useMemo(() => allServiceabilityData || [], [allServiceabilityData])

  // Use useMemo to compute delivery status instead of useState + useEffect to avoid infinite loops
  const deliveryStatus = useMemo<AggregatedDeliveryStatus>(() => {
    if (!validPin || uniqueProductIds.length === 0) {
      return {
        status: null,
        message: '',
        estimatedDeliveryDate: null,
        estimatedDeliveryDays: null,
        allServiceable: false,
        serviceabilityData: [],
      }
    }

    // Only show loading if we don't have data yet and are actively fetching
    if (isLoading || (isFetching && allData.length === 0)) {
      return {
        status: 'loading',
        message: 'Checking delivery availability...',
        estimatedDeliveryDate: null,
        estimatedDeliveryDays: null,
        allServiceable: false,
        serviceabilityData: [],
      }
    }

    if (error || allData.length === 0) {
      return {
        status: 'error',
        message: 'Unable to check delivery availability right now. Please try again.',
        estimatedDeliveryDate: null,
        estimatedDeliveryDays: null,
        allServiceable: false,
        serviceabilityData: [],
      }
    }

    // Check if all items are serviceable
    // A serviceable item must have: success=true, courier exists (not null), and no error message
    // If courier has a serviceable property, it should be true (or truthy)
    const allServiceable = allData.every((data) => {
      // Must have success = true
      if (!data?.success) {
        return false
      }
      // Must have courier object
      if (!data.data?.courier) {
        return false
      }
      // Must not have error message
      if (data.data.message) {
        return false
      }
      // If courier has serviceable property, it should be true
      // If serviceable property doesn't exist, assume it's serviceable (backward compatibility)
      if (data.data.courier.serviceable !== undefined && data.data.courier.serviceable === false) {
        return false
      }
      return true
    })

    if (!allServiceable) {
      const unserviceableCount = allData.filter((data) => {
        return (
          !data?.success ||
          !data.data?.courier ||
          data.data.message ||
          (data.data.courier?.serviceable !== undefined && data.data.courier.serviceable === false)
        )
      }).length
      return {
        status: 'error',
        message: `Delivery not available for ${unserviceableCount} item${
          unserviceableCount > 1 ? 's' : ''
        } to this location.`,
        estimatedDeliveryDate: null,
        estimatedDeliveryDays: null,
        allServiceable: false,
        serviceabilityData: allData.map((d) => d!.data),
      }
    }

    // Find the longest delivery date (worst case scenario)
    let maxDeliveryDays = 0
    let maxDeliveryDateLabel: string | null = null

    allData.forEach((data) => {
      if (data?.success && data.data.courier) {
        const courier = data.data.courier
        const days =
          courier.estimated_delivery_days && !isNaN(Number(courier.estimated_delivery_days))
            ? Number(courier.estimated_delivery_days)
            : 0

        if (days > maxDeliveryDays) {
          maxDeliveryDays = days
        }

        if (courier.estimated_delivery_date || courier.estimated_delivery_days) {
          const label = getDeliveryDateLabel(
            courier.estimated_delivery_date,
            courier.estimated_delivery_days,
          )
          if (label && (!maxDeliveryDateLabel || days > maxDeliveryDays)) {
            maxDeliveryDateLabel = label
          }
        }
      }
    })

    if (maxDeliveryDateLabel) {
      return {
        status: 'success',
        message: `Estimated delivery by ${maxDeliveryDateLabel}.`,
        estimatedDeliveryDate: maxDeliveryDateLabel,
        estimatedDeliveryDays: maxDeliveryDays,
        allServiceable: true,
        serviceabilityData: allData.map((d) => d!.data),
      }
    } else {
      return {
        status: 'success',
        message: `Good news! We deliver to ${sanitizedPin}.`,
        estimatedDeliveryDate: null,
        estimatedDeliveryDays: maxDeliveryDays || null,
        allServiceable: true,
        serviceabilityData: allData.map((d) => d!.data),
      }
    }
  }, [isLoading, isFetching, error, allData, validPin, sanitizedPin, uniqueProductIds.length])

  return {
    deliveryStatus,
    isCheckingServiceability: isLoading || (isFetching && allData.length === 0),
    hasValidPin: validPin,
  }
}
