import React from 'react'

import { useCustomerHighlights } from '@/api/products'
import SectionHeading from '@/components/product-detail/SectionHeading'
import { Card, CardContent } from '@/components/ui/card'
import {
  Clock,
  Heart,
  MapPin,
  Package,
  ShieldCheck,
  Sparkles,
  Star,
  ThumbsUp,
  Zap,
} from 'lucide-react'

interface CustomerLoveSectionProps {
  productId: string
}

// Icon mapping for highlights
const iconMap: Record<string, React.ReactNode> = {
  'Premium Quality': <Sparkles className="w-6 h-6 text-amber-500" />,
  'Durable & Long-lasting': <Clock className="w-6 h-6 text-indigo-500" />,
  'Great Design': <MapPin className="w-6 h-6 text-rose-500" />,
  'Great Value': <ThumbsUp className="w-6 h-6 text-green-500" />,
  'Fast Delivery': <Zap className="w-6 h-6 text-yellow-500" />,
  'Easy to Use': <Package className="w-6 h-6 text-blue-500" />,
  Reliable: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
  Comfortable: <Heart className="w-6 h-6 text-pink-500" />,
  'Excellent Product': <Star className="w-6 h-6 text-purple-500" />,
}

// Default highlights when no reviews
const defaultHighlights = [
  {
    title: 'Premium Quality',
    icon: <Sparkles className="w-6 h-6 text-amber-500" />,
    description: 'Built with attention to detail and quality materials.',
  },
  {
    title: 'Durable & Long-lasting',
    icon: <Clock className="w-6 h-6 text-indigo-500" />,
    description: 'Designed to stand the test of time.',
  },
  {
    title: 'Great Design',
    icon: <MapPin className="w-6 h-6 text-rose-500" />,
    description: 'Stylish and functional design that fits your lifestyle.',
  },
]

const CustomerLoveSection: React.FC<CustomerLoveSectionProps> = ({ productId }) => {
  const { data } = useCustomerHighlights(productId)

  const customerHighlights = data?.highlights || []
  const reviewCount = data?.reviewCount || 0

  // Map highlights to include icons
  const highlightsWithIcons =
    customerHighlights.length > 0
      ? customerHighlights.map((highlight) => ({
          ...highlight,
          icon: iconMap[highlight.title] || <Sparkles className="w-6 h-6 text-amber-500" />,
        }))
      : defaultHighlights

  const subtitle =
    reviewCount > 0
      ? `Based on ${reviewCount} ${reviewCount === 1 ? 'customer review' : 'customer reviews'}`
      : 'Built for everyday excellence'

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white/90 shadow-sm p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      <SectionHeading title="Why customers love it" subtitle={subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {highlightsWithIcons.map((highlight, index) => (
          <ValueCard
            key={index}
            icon={highlight.icon}
            title={highlight.title}
            description={highlight.description}
          />
        ))}
      </div>
    </div>
  )
}

interface ValueCardProps {
  icon: React.ReactNode
  title: string
  description: string
}

const ValueCard: React.FC<ValueCardProps> = ({ icon, title, description }) => (
  <Card className="border-none shadow-md z-20 shadow-gray-200/50 bg-white">
    <CardContent className="p-4 sm:p-5 space-y-2 sm:space-y-3">
      <div className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-900/5">
        {icon}
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-xs sm:text-sm text-gray-600">{description}</p>
    </CardContent>
  </Card>
)

export default CustomerLoveSection
