import { Truck } from 'lucide-react'

export const EstimatedDelivery = () => {
  const getEstimatedDelivery = () => {
    const today = new Date()
    const deliveryDate = new Date(today)
    deliveryDate.setDate(today.getDate() + 5)
    return deliveryDate.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-3">
        <Truck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-900 mb-1">Estimated Delivery</p>
          <p className="text-sm text-blue-700">{getEstimatedDelivery()}</p>
        </div>
      </div>
    </div>
  )
}

