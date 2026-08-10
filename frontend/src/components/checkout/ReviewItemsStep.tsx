import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CartItem } from '@/types/cart'
import { AnimatePresence, motion } from 'framer-motion'
import { Package, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

interface ReviewItemsStepProps {
  items: CartItem[]
  shippingAddress: {
    name: string
    addressLine1: string
    addressLine2?: string
    city: string
    state: string
    postalCode: string
    phone: string
  } | null
  paymentMethod: string | null
  productInstructions: Record<string, string>
  onInstructionChange: (itemKey: string, instructions: string) => void
}

export const ReviewItemsStep = ({
  items,
  shippingAddress,
  paymentMethod,
  productInstructions,
  onInstructionChange,
}: ReviewItemsStepProps) => {
  const [openInstructions, setOpenInstructions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    Object.entries(productInstructions || {}).forEach(([key, value]) => {
      if (value?.trim()) initial[key] = true
    })
    return initial
  })

  const toggleInstruction = (key: string, forceOpen?: boolean) => {
    setOpenInstructions((prev) => ({
      ...prev,
      [key]: forceOpen ?? !prev[key],
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Your Order</h3>

        {/* Items List */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              {items.map((item) => {
                const instructionKey = `${item.product._id}-${item.variantId || 'no-variant'}`
                const instructionValue = productInstructions[instructionKey] || ''
                const isOpen = openInstructions[instructionKey] ?? Boolean(instructionValue.trim())

                return (
                  <motion.div
                    key={instructionKey}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-4 pb-4 border-b border-gray-200 last:border-0 last:pb-0"
                  >
                    <Link
                      to={`/product/${item.product.slug || item.product._id}`}
                      className="shrink-0"
                    >
                      <img
                        src={item.product.mainImage || '/image-placeholder.svg'}
                        alt={item.product.name}
                        className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/product/${item.product.slug || item.product._id}`}
                        className="block"
                      >
                        <h4 className="font-semibold text-gray-900 hover:text-blue transition-colors">
                          {item.product.name}
                        </h4>
                      </Link>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Qty: {item.quantity}</span>
                          {item.discountedPrice && item.discountedPrice < item.priceAtAddition && (
                            <span className="text-green-600 font-medium">
                              ₹{item.discountedPrice.toLocaleString()} each
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          {item.discountedPrice && item.discountedPrice < item.priceAtAddition ? (
                            <div>
                              <p className="text-sm line-through text-gray-400">
                                ₹{(item.priceAtAddition * item.quantity).toLocaleString()}
                              </p>
                              <p className="font-semibold text-gray-900">
                                ₹{(item.discountedPrice * item.quantity).toLocaleString()}
                              </p>
                            </div>
                          ) : (
                            <p className="font-semibold text-gray-900">
                              ₹{(item.priceAtAddition * item.quantity).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Button
                          variant={isOpen ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => toggleInstruction(instructionKey)}
                          className="text-xs"
                        >
                          {isOpen ? 'Hide instructions' : 'Add special instruction for this item'}
                        </Button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              key={`instruction-${instructionKey}`}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden space-y-2"
                            >
                              <Label
                                htmlFor={`instructions-${instructionKey}`}
                                className="text-xs text-gray-700"
                              >
                                Special instructions for this item
                              </Label>
                              <Textarea
                                id={`instructions-${instructionKey}`}
                                value={instructionValue}
                                maxLength={300}
                                onChange={(event) =>
                                  onInstructionChange(instructionKey, event.target.value)
                                }
                                onFocus={() => toggleInstruction(instructionKey, true)}
                                placeholder="Add preparation, delivery, or packaging notes for the seller"
                              />
                              <div className="text-right text-xs text-gray-400">
                                {instructionValue.length}/300
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        {shippingAddress && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-blue mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">Delivery Address</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="font-medium">{shippingAddress.name}</p>
                    <p>{shippingAddress.addressLine1}</p>
                    {shippingAddress.addressLine2 && <p>{shippingAddress.addressLine2}</p>}
                    <p>
                      {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.postalCode}
                    </p>
                    <p>Phone: {shippingAddress.phone}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Method */}
        {paymentMethod && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-blue mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">Payment Method</h4>
                  <p className="text-sm text-gray-600 capitalize">{paymentMethod}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Estimated Delivery */}
      </div>
    </div>
  )
}
