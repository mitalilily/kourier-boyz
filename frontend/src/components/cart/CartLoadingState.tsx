import { Loader2 } from 'lucide-react'

export const CartLoadingState = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Loading your cart...</p>
      </div>
    </div>
  )
}

