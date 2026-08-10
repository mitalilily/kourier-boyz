import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import CartItemCard from '@/components/ui/CartItemCard'
import type { CartItem } from '@/types/cart'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckSquare, Loader2, Square } from 'lucide-react'

interface CartItemsListProps {
  items: CartItem[]
  selectedCount: number
  allSelected: boolean
  onToggleAllSelection?: (selected: boolean) => void
  onQuantityChange: (item: CartItem, quantity: number) => void
  onRemove: (item: CartItem) => void
  onSaveForLater: (item: CartItem) => void
  onSelectionChange?: (item: CartItem, selected: boolean) => void
  isOutOfStock: (item: CartItem) => boolean
  isLowStock: (item: CartItem) => boolean
  isUpdatingItem: (item: CartItem) => boolean
  isRemovingItem: (item: CartItem) => boolean
  isSavingForLaterItem: (item: CartItem) => boolean
  isTogglingSelection?: boolean
}

export const CartItemsList = ({
  items,
  selectedCount,
  allSelected,
  onToggleAllSelection,
  onQuantityChange,
  onRemove,
  onSaveForLater,
  onSelectionChange,
  isOutOfStock,
  isLowStock,
  isUpdatingItem,
  isRemovingItem,
  isSavingForLaterItem,
  isTogglingSelection = false,
}: CartItemsListProps) => {
  return (
    <div className="lg:col-span-2">
      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.35)] backdrop-blur-sm">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 sm:text-xl">Cart items</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fine-tune quantities and availability before checkout.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {selectedCount} of {items.length} selected
              </div>
              {onToggleAllSelection && items.length > 0 && (
                <>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => onToggleAllSelection(checked === true)}
                    className="h-4 w-4 shrink-0 !rounded-md border-2 border-slate-300 data-[state=checked]:border-[#1353A4] data-[state=checked]:bg-[#1353A4] data-[state=checked]:text-white hover:border-[#1353A4]/50 sm:h-5 sm:w-5"
                    aria-label={allSelected ? 'Deselect all items' : 'Select all items'}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleAllSelection(!allSelected)}
                    disabled={isTogglingSelection}
                    className="h-8 rounded-full border border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {isTogglingSelection ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : allSelected ? (
                      <Square className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
          <AnimatePresence mode="popLayout">
            {items.map((item, index) => (
              <motion.div
                key={`${item.product._id}-${item.variantId || 'no-variant'}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, x: -20 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <CartItemCard
                  item={item}
                  onQuantityChange={onQuantityChange}
                  onRemove={onRemove}
                  onSaveForLater={onSaveForLater}
                  onSelectionChange={onSelectionChange}
                  isOutOfStock={isOutOfStock(item)}
                  isLowStock={isLowStock(item)}
                  isUpdating={isUpdatingItem(item)}
                  isRemoving={isRemovingItem(item)}
                  isSavingForLater={isSavingForLaterItem(item)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
