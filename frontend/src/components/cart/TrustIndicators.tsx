import { Lock, Shield } from 'lucide-react'

export const TrustIndicators = () => {
  return (
    <div className="mb-6 space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Shield className="w-4 h-4 text-green-600" />
        <span>Secure checkout</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Lock className="w-4 h-4 text-green-600" />
        <span>Your payment information is safe</span>
      </div>
      {/* <div className="flex items-center gap-2 text-xs text-gray-600">
        <Truck className="w-4 h-4 text-green-600" />
        <span>Free shipping on all orders</span>
      </div> */}
    </div>
  )
}
