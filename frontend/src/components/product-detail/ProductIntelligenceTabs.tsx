import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { Product } from '@/api/products'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatWarrantyShort } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import {
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Package,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'

interface ProductIntelligenceTabsProps {
  product: Product
  hasSpecifications: boolean
}

const ProductIntelligenceTabs: React.FC<ProductIntelligenceTabsProps> = ({
  product,
  hasSpecifications,
}) => (
  <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white/90 shadow-sm p-4 sm:p-6 lg:p-8">
    <Tabs defaultValue="overview" className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-1.5 sm:gap-2">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 shrink-0" />
          Product intelligence
        </h2>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="specs" className="text-xs sm:text-sm">
            Specifications
          </TabsTrigger>
          <TabsTrigger value="seller" className="text-xs sm:text-sm">
            Seller
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="overview">
        <div className="space-y-4 sm:space-y-6 text-gray-700 leading-relaxed">
          {product.shortDescription ? (
            <p className="text-sm sm:text-base text-gray-800 font-medium">
              {product.shortDescription}
            </p>
          ) : null}
          <div className="prose prose-sm sm:prose-base max-w-none text-gray-600 whitespace-pre-line">
            {product.description}
          </div>

          {/* Product Stats */}

          {/* Product Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {product.brand && (
              <FeatureHighlight
                icon={<BadgeCheck className="w-5 h-5 text-indigo-500" />}
                title="Brand"
                description={product.brand}
              />
            )}
            <FeatureHighlight
              icon={<Truck className="w-5 h-5 text-blue-500" />}
              title={product.freeShipping ? 'Free Shipping' : 'Shipping'}
              description={
                product.freeShipping
                  ? 'Free doorstep delivery with optimized packaging.'
                  : 'Fast shipping with trusted logistics partners.'
              }
            />
            {product.returnable ? (
              <FeatureHighlight
                icon={<RefreshCcw className="w-5 h-5 text-amber-500" />}
                title="Returns"
                description={`Hassle-free returns within ${product.returnDays || 7} ${
                  product.returnDays === 1 ? 'day' : 'days'
                } on eligible orders.`}
              />
            ) : (
              <FeatureHighlight
                icon={<RefreshCcw className="w-5 h-5 text-gray-400" />}
                title="Non-returnable"
                description="This item cannot be returned or exchanged."
              />
            )}
            {product.warranty && (
              <FeatureHighlight
                icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
                title="Warranty"
                description={`${formatWarrantyShort(
                  product.warrantyDays || 7,
                )} warranty coverage on manufacturing defects.`}
              />
            )}
            {product.payOnDelivery && (
              <FeatureHighlight
                icon={<CheckCircle2 className="w-5 h-5 text-green-500" />}
                title="Pay on Delivery"
                description="Cash on delivery option available for your convenience."
              />
            )}
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">Tags</p>
              <div className="flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="rounded-full text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Manufacturer & Importer Information */}
          {(product.manufacturerName ||
            product.manufacturerAddress ||
            product.countryOfOrigin ||
            product.importerName ||
            product.importerAddress) && (
            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Manufacturer & Importer Details
              </p>
              <div className="space-y-2 text-sm">
                {product.manufacturerName && (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="text-gray-600 font-medium sm:w-32">Manufacturer:</span>
                    <span className="text-gray-800">{product.manufacturerName}</span>
                  </div>
                )}
                {product.manufacturerAddress && (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="text-gray-600 font-medium sm:w-32">Manufacturer Address:</span>
                    <span className="text-gray-800">{product.manufacturerAddress}</span>
                  </div>
                )}
                {product.countryOfOrigin && (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="text-gray-600 font-medium sm:w-32">Country of Origin:</span>
                    <span className="text-gray-800 font-semibold">{product.countryOfOrigin}</span>
                  </div>
                )}
                {product.importerName && (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="text-gray-600 font-medium sm:w-32">Importer:</span>
                    <span className="text-gray-800">{product.importerName}</span>
                  </div>
                )}
                {product.importerAddress && (
                  <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                    <span className="text-gray-600 font-medium sm:w-32">Importer Address:</span>
                    <span className="text-gray-800">{product.importerAddress}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="specs">
        {hasSpecifications ? (
          <SpecificationsSection specifications={product.specifications || []} />
        ) : (
          <EmptyState
            title="Specifications unavailable"
            description="The seller has not provided detailed specifications for this item yet."
          />
        )}
      </TabsContent>

      <TabsContent value="seller">
        <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-linear-to-br from-white via-slate-50 to-white p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 sm:gap-3">
            <div>
              <p className="text-sm uppercase tracking-wide text-gray-500">Sold by</p>
              {product.seller?.storeSlug && product.seller?.storeName ? (
                <Link
                  to={`/seller/${product.seller.storeSlug}`}
                  className="inline-flex items-center gap-2 group"
                >
                  <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {product.seller.storeName}
                  </h3>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              ) : (
                <h3 className="text-xl font-semibold text-gray-900">
                  {product.seller?.storeName || 'Trusted Seller'}
                </h3>
              )}
              {product.seller?.sellerRating && product.seller.sellerRating > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-semibold text-gray-900">
                      {product.seller.sellerRating.toFixed(1)}
                    </span>
                  </div>
                  {product.seller.sellerReviewCount && product.seller.sellerReviewCount > 0 && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-600">
                        {product.seller.sellerReviewCount}{' '}
                        {product.seller.sellerReviewCount === 1 ? 'Review' : 'Reviews'}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <Badge
              variant="secondary"
              className="self-start md:self-auto rounded-full bg-indigo-50 text-indigo-600 border-indigo-200"
            >
              Verified partner
            </Badge>
          </div>

          {product.seller?.storeDescription ? (
            <p className="text-gray-600 leading-relaxed">{product.seller.storeDescription}</p>
          ) : (
            <p className="text-gray-600 leading-relaxed">
              Partnered brand delivering consistent quality and customer delight across categories.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {product.seller?.sellerRating && product.seller.sellerRating >= 4.0 ? (
              <SellerHighlight
                icon={<ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />}
                title="Top-rated partner"
                description={`Maintains ${product.seller.sellerRating.toFixed(1)} rating with ${
                  product.seller.sellerReviewCount || 0
                } reviews.`}
              />
            ) : (
              <SellerHighlight
                icon={<ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500" />}
                title="Verified partner"
                description="Authenticated seller with quality assurance."
              />
            )}
            <SellerHighlight
              icon={<Package className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500" />}
              title="Secure packaging"
              description="Every order is carefully packed to avoid transit damage."
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
)

interface HighlightProps {
  icon: React.ReactNode
  title: string
  description: string
}

const FeatureHighlight: React.FC<HighlightProps> = ({ icon, title, description }) => (
  <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-white/70 p-3 sm:p-4 flex items-start gap-2 sm:gap-3 shadow-sm">
    <div className="mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-xs sm:text-sm font-semibold text-gray-800">{title}</p>
      <p className="text-xs sm:text-sm text-gray-500">{description}</p>
    </div>
  </div>
)

const SellerHighlight: React.FC<HighlightProps> = ({ icon, title, description }) => (
  <div className="flex items-start gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-gray-100 bg-white/80 p-3 sm:p-4 shadow-sm">
    <div className="mt-0.5 shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-xs sm:text-sm font-semibold text-gray-800">{title}</p>
      <p className="text-xs sm:text-sm text-gray-500">{description}</p>
    </div>
  </div>
)

const EmptyState: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="rounded-xl sm:rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 sm:p-6 text-center space-y-1.5 sm:space-y-2">
    <p className="text-xs sm:text-sm font-semibold text-gray-700">{title}</p>
    <p className="text-xs sm:text-sm text-gray-500">{description}</p>
  </div>
)

interface SpecificationsSectionProps {
  specifications: Array<{ key: string; value: string }>
}

const SpecificationsSection: React.FC<SpecificationsSectionProps> = ({ specifications }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div>
      <div
        ref={contentRef}
        className={`rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50/60 divide-y divide-gray-100 overflow-hidden transition-all duration-500 ease-in-out ${
          isExpanded ? 'max-h-none' : 'max-h-[400px]'
        }`}
      >
        {specifications.map((spec) => (
          <div
            key={spec.key}
            className="flex flex-col sm:flex-row sm:items-center"
          >
            <div className="sm:w-1/3 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide">
              {spec.key}
            </div>
            <div className="flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-800 border-t sm:border-t-0 sm:border-l border-gray-100">
              {spec.value}
            </div>
          </div>
        ))}
      </div>
      {specifications.length > 4 && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-full transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <span className={`inline-flex items-center transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 mr-2" />
            </span>
            {isExpanded ? 'Show Less' : 'Read More'}
          </Button>
        </div>
      )}
    </div>
  )
}

export default ProductIntelligenceTabs
