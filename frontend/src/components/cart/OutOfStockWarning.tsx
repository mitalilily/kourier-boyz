import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package } from 'lucide-react'
import { motion } from 'framer-motion'

interface OutOfStockWarningProps {
  totalOutOfStockItems: number
  selectedOutOfStockItems: number
}

export const OutOfStockWarning = ({
  totalOutOfStockItems,
  selectedOutOfStockItems,
}: OutOfStockWarningProps) => {
  if (totalOutOfStockItems === 0) return null

  const hasBlockingItems = selectedOutOfStockItems > 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="mb-4 sm:mb-6"
    >
      <Card className="overflow-hidden border-orange-200/80 bg-[linear-gradient(135deg,_rgba(255,247,237,1),_rgba(255,251,235,1))] p-3 shadow-sm sm:p-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100">
            <Package className="mt-0.5 h-4 w-4 text-orange-600 sm:h-5 sm:w-5" />
          </div>
          <div className="flex-1 space-y-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
              <p className="text-xs sm:text-sm font-semibold text-orange-900">
                {hasBlockingItems
                  ? 'Some selected items are out of stock'
                  : 'Items in your cart are currently out of stock'}
              </p>
              <Badge
                variant="outline"
                className="w-fit border-orange-300 bg-white/80 text-[10px] text-orange-800 sm:text-xs"
              >
                {selectedOutOfStockItems}/{totalOutOfStockItems} blocking checkout
              </Badge>
            </div>
            <p className="text-[10px] sm:text-xs text-orange-700">
              {hasBlockingItems
                ? 'Remove, save for later, or deselect those items to continue.'
                : 'These items are excluded from checkout until they are back in stock.'}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
