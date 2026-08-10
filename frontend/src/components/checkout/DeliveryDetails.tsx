import { useCart } from '@/api/cart'
import { useServiceability } from '@/api/products'
import { getDeliveryDateLabel } from '@/components/product-detail/utils'
import type { Address } from '@/types/address'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2, Truck, XCircle } from 'lucide-react'
import { useMemo } from 'react'

interface DeliveryDetailsProps {
  selectedAddress: Address | null
  productIds?: string[]
}

export const DeliveryDetails: React.FC<DeliveryDetailsProps> = ({
  selectedAddress,
  productIds,
}) => {
  const { data: cartData } = useCart()
  const cart = cartData?.data || cartData?.cart
  const cartItems = cart?.items || []

  // Get all unique product IDs from cart items
  const allProductIds = useMemo(() => {
    if (productIds && productIds.length > 0) {
      return productIds
    }
    if (cart?.items) {
      return cart.items.map((item) => item?.product?._id).filter((id): id is string => Boolean(id))
    }
    return []
  }, [productIds, cart?.items])

  const pincode = selectedAddress?.postalCode
  const shouldCheck = !!pincode && pincode.length >= 5 && allProductIds.length > 0

  // Check serviceability for the first product (or we could aggregate multiple)
  const firstProductId = allProductIds[0]
  const firstProduct =
    cartItems.find((item) => item?.product?._id === firstProductId)?.product || null
  const productDeliveryFlags = firstProduct as {
    freeShipping?: boolean
    payOnDelivery?: boolean
  } | null
  const { data: serviceabilityData, isLoading: isCheckingServiceability } = useServiceability(
    firstProductId,
    shouldCheck ? pincode : undefined,
    {
      enabled: shouldCheck && !!firstProductId,
    },
  )

  if (!selectedAddress || !pincode) {
    return null
  }

  if (isCheckingServiceability) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-blue-200 bg-blue-50/50 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-blue-700">Checking delivery availability...</p>
        </div>
      </motion.div>
    )
  }

  // If query completed but no data or not successful, show error (not "please wait")
  if (!serviceabilityData || !serviceabilityData.success) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-gray-100 p-1.5 shrink-0 mt-0.5">
            <XCircle className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900 mb-1">
              Delivery not available to this location
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              We're sorry, but we currently don't deliver to this pincode. You can try entering a
              different delivery address, or reach out to our customer support team who can help you
              find alternative delivery options.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  const serviceabilityPayload = serviceabilityData.data

  if (!serviceabilityPayload) {
    return null
  }

  const { courier, message } = serviceabilityPayload

  // Check if delivery is available
  // Delivery is available if:
  // 1. Courier object exists
  // 2. No error message
  // 3. Courier.serviceable is not explicitly false (if property exists)
  const isDeliveryAvailable = courier && !message && (courier.serviceable !== false)
  
  // Debug logging
  console.log('[DeliveryDetails] Serviceability check:', {
    hasCourier: !!courier,
    hasMessage: !!message,
    courierServiceable: courier?.serviceable,
    isDeliveryAvailable,
    serviceabilityPayload,
  })

  if (!isDeliveryAvailable) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-gray-200 bg-gray-50/50 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-gray-100 p-1.5 shrink-0 mt-0.5">
            <XCircle className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-gray-900 mb-1">
              Delivery not available to this location
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              We're sorry, but we currently don't deliver to this pincode. You can try entering a
              different delivery address, or reach out to our customer support team who can help you
              find alternative delivery options.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  const selectedOption = courier
  const etaLabel = selectedOption
    ? getDeliveryDateLabel(
        selectedOption.estimated_delivery_date,
        selectedOption.estimated_delivery_days,
      )
    : undefined
  const showCodAvailable = Boolean(productDeliveryFlags?.payOnDelivery && courier?.cod_available)

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="rounded-lg border border-gray-200 bg-white/80 px-4 py-3 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-emerald-50 p-1.5 shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-900">
            Delivery available to <span className="font-bold">{pincode}</span>
          </p>
          {etaLabel && (
            <p className="mt-1 text-xs text-gray-600">
              Arrives by <span className="font-medium text-gray-900">{etaLabel}</span>
            </p>
          )}
          {showCodAvailable && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-700">
              <Truck className="w-3 h-3 text-emerald-600" />
              <span>Cash on Delivery available</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
