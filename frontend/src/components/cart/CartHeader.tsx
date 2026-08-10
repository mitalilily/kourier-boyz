import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Loader2, ShieldCheck, Sparkles, Trash2 } from 'lucide-react'

interface CartHeaderProps {
  savings: number
  itemCount: number
  onClearCart: () => void
  isClearing: boolean
}

export const CartHeader = ({ savings, itemCount, onClearCart, isClearing }: CartHeaderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 sm:mb-7 md:mb-8"
    >
      <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(19,83,164,0.14),_transparent_34%),linear-gradient(135deg,_#ffffff,_#f8fbff_42%,_#f5f7fb)] shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-5 p-4 sm:p-6 md:flex-row md:items-start md:justify-between md:p-7">
          <div className="min-w-0 flex-1">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure checkout
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl md:text-[2.2rem]">
              Your cart, ready when you are
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {savings > 0 && (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm">
                  <Sparkles className="mr-1 h-3 w-3" /> You&apos;re saving ₹
                  {savings.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          {itemCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearCart}
              disabled={isClearing}
              className="h-10 w-full border-red-200 bg-white/80 px-4 text-sm text-red-600 shadow-sm hover:bg-red-50 hover:text-red-700 sm:w-auto"
            >
              {isClearing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Clear Cart
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
