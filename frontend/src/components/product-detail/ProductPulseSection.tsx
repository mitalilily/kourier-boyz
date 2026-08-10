import React from 'react'

import SectionHeading from '@/components/product-detail/SectionHeading'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, Eye, LineChart, Users } from 'lucide-react'

import type { PersonalViewStats } from './utils'

interface ProductPulseSectionProps {
  availableStock: number
  engagementDescriptor: string
  isLowStock: boolean
  isOutOfStock: boolean
  personalViewStats: PersonalViewStats | null
  soldCount: number
  totalViewCount: number
}

const ProductPulseSection: React.FC<ProductPulseSectionProps> = ({
  availableStock,
  engagementDescriptor,
  isLowStock,
  isOutOfStock,
  personalViewStats,
  soldCount,
  totalViewCount,
}) => (
  <div className="rounded-3xl border border-gray-100 bg-white/90 shadow-sm p-6 sm:p-8 space-y-5">
    <SectionHeading title="Live product pulse" subtitle="Real-time signals" />
    <div className="grid gap-4 sm:grid-cols-2">
      <StatHighlight
        icon={<Eye className="w-4 h-4 text-emerald-500" />}
        label="Total views"
        value={totalViewCount.toLocaleString()}
        helper={engagementDescriptor}
      />
      <StatHighlight
        icon={<Users className="w-4 h-4 text-blue-500" />}
        label="Sold so far"
        value={soldCount.toLocaleString()}
        helper="Verified orders fulfilled"
      />
      <StatHighlight
        icon={<BarChart3 className="w-4 h-4 text-purple-500" />}
        label="Conversion ratio"
        value={
          soldCount
            ? `${Math.min(100, Math.round((soldCount / Math.max(totalViewCount, 1)) * 1000) / 10)}%`
            : '—'
        }
        helper="Orders vs total views"
      />
      <StatHighlight
        icon={<LineChart className="w-4 h-4 text-amber-500" />}
        label="Stock readiness"
        value={isOutOfStock ? 'Unavailable' : isLowStock ? `Only ${availableStock} left` : 'In stock'}
        helper={
          isOutOfStock ? 'Restock notified soon' : isLowStock ? 'Moving fast — reserve yours' : 'Ships immediately'
        }
      />
    </div>

    {personalViewStats ? (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Your viewing journey</p>
          <p className="text-xs text-gray-500">
            Seen {personalViewStats.count} time
            {personalViewStats.count === 1 ? '' : 's'} · Last visited {personalViewStats.lastSeenRelative}
          </p>
        </div>
        <div className="text-xs text-gray-500">
          <div>
            <span className="font-semibold text-gray-700">First view:</span> {personalViewStats.firstSeenFormatted} ·{' '}
            {personalViewStats.firstSeenRelative}
          </div>
          <div>
            <span className="font-semibold text-gray-700">Latest:</span> {personalViewStats.lastSeenFormatted} ·{' '}
            {personalViewStats.lastSeenRelative}
          </div>
        </div>
      </div>
    ) : (
      <p className="text-sm text-gray-500">Sign in to track your personal viewing history across devices.</p>
    )}
  </div>
)

interface StatHighlightProps {
  icon: React.ReactNode
  label: string
  value: string
  helper?: string
}

const StatHighlight: React.FC<StatHighlightProps> = ({ icon, label, value, helper }) => (
  <Card className="border-none shadow-sm shadow-gray-200/40 bg-white/90">
    <CardContent className="p-4 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900/5 text-gray-900">
          {icon}
        </span>
        {label}
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      {helper ? <p className="text-xs text-gray-500">{helper}</p> : null}
    </CardContent>
  </Card>
)

export default ProductPulseSection

