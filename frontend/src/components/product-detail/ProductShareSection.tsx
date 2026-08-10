import React from 'react'

import { Button } from '@/components/ui/button'
import { ShareButton } from '@/components/ui/ShareButton'
import SectionHeading from '@/components/product-detail/SectionHeading'
import { Copy, Facebook, MessageCircle, Share2, Twitter } from 'lucide-react'

interface ProductShareSectionProps {
  onCopyLink: () => void
  onQuickShare: (platform: 'whatsapp' | 'twitter' | 'facebook') => void
  productName: string
  productUrl: string
  shareSummary: string
  shareImage?: string
}

const ProductShareSection: React.FC<ProductShareSectionProps> = ({
  onCopyLink,
  onQuickShare,
  productName,
  productUrl,
  shareSummary,
  shareImage,
}) => (
  <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white/90 shadow-sm p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5">
    <SectionHeading title="Share this product" subtitle="Spark interest in your circle" />
    <p className="text-xs sm:text-sm text-gray-600 max-w-2xl">
      Let friends and teammates know about <span className="font-semibold text-gray-900">{productName}</span>. Choose a
      quick share option or copy the link to drop it into your favourite channel.
    </p>
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <ShareButton
        url={productUrl}
        title={productName}
        description={shareSummary}
        image={shareImage}
        shareText={`${productName} - Check it out on Kourier Boyz!`}
        showLabel={false}
        triggerButton={
          <Button className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-gray-900 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-white hover:bg-gray-800 transition-colors">
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Share options</span>
            <span className="xs:hidden">Share</span>
          </Button>
        }
      />
      <Button
        variant="outline"
        onClick={() => onQuickShare('whatsapp')}
        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border-emerald-200 bg-emerald-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">WhatsApp</span>
      </Button>
      <Button
        variant="outline"
        onClick={() => onQuickShare('twitter')}
        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border-sky-200 bg-sky-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-sky-600 hover:bg-sky-100 hover:text-sky-700 transition-colors"
      >
        <Twitter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Twitter</span>
      </Button>
      <Button
        variant="outline"
        onClick={() => onQuickShare('facebook')}
        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border-blue-200 bg-blue-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors"
      >
        <Facebook className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Facebook</span>
      </Button>
      <Button
        variant="ghost"
        onClick={onCopyLink}
        className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-gray-200 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden sm:inline">Copy link</span>
      </Button>
    </div>
  </div>
)

export default ProductShareSection

