import type { Seller } from '../../api/seller'
import type { ThemeConfig } from '../../utils/themes'

interface StorefrontBannersSectionProps {
  seller: Seller
  theme: ThemeConfig | null
  onBannerClick: (categoryId?: string) => void
}

export const StorefrontBannersSection = ({
  seller,
  theme,
  onBannerClick,
}: StorefrontBannersSectionProps) => {
  // Get storefront banners sorted by order
  const getBanners = () => {
    if (seller?.storefrontBanners && seller.storefrontBanners.length > 0) {
      return [...seller.storefrontBanners].sort((a, b) => a.order - b.order)
    }
    return []
  }

  const banners = getBanners()

  if (banners.length === 0) return null

  return (
    <div className="mx-auto px-2 sm:px-4 mt-3" style={{ maxWidth: '1600px' }}>
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 w-full overflow-hidden">
        {banners?.map((banner, index) => {
          const colSpan = Math.min(12, Math.max(1, banner.gridSpan))
          return (
            <div
              key={index}
              className="relative overflow-hidden cursor-pointer group"
              style={{
                gridColumn: `span ${colSpan}`,
                height: '250px',
                borderRadius: theme?.styles.borderRadius || '0.5rem',
                boxShadow: `0 4px 12px ${theme?.colors.primary || '#2563eb'}15`,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onClick={() => onBannerClick(banner.category)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = `0 8px 24px ${theme?.colors.primary || '#2563eb'}30`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = `0 4px 12px ${theme?.colors.primary || '#2563eb'}15`
              }}
            >
              <img
                src={banner?.imageUrl}
                alt={`${seller.businessName || seller.name} - Banner ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: theme?.styles.borderRadius || '0.5rem',
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={index === 0 ? 'high' : 'low'}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent group-hover:from-black/70 transition-all duration-300" />
              {/* Overlay glow on hover */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at center, ${theme?.colors.primary || '#2563eb'}20 0%, transparent 70%)`,
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
