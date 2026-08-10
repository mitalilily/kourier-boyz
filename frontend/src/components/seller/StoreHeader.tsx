import { Facebook, Info, Instagram, Linkedin, Mail, Phone, Twitter, Youtube } from 'lucide-react'
import type { Seller } from '../../api/seller'
import type { ThemeConfig } from '../../utils/themes'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import { ShareButton } from '../ui/ShareButton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../ui/sheet'

interface StoreHeaderProps {
  seller: Seller
  theme: ThemeConfig | null
}

export const StoreHeader = ({ seller, theme }: StoreHeaderProps) => {
  return (
    <div className="relative w-full">
      {/* Store Banner (single banner for header) */}
      {seller.storeBanner ? (
        <div className="h-64 md:h-96 w-full overflow-hidden">
          <img
            src={seller.storeBanner}
            alt={`${seller.businessName || seller.name} - Store Banner`}
            className="w-full h-full object-cover"
            fetchPriority="high"
            decoding="async"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      ) : (
        <div
          className={`h-64 md:h-96 w-full relative overflow-hidden ${
            theme?.styles.headerStyle === 'gradient' || !theme
              ? 'theme-gradient'
              : theme.styles.headerStyle === 'solid'
              ? 'theme-bg-primary'
              : 'theme-gradient'
          }`}
        >
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full" style={{
              background: `radial-gradient(circle at 20% 50%, ${theme?.colors.secondary || '#10b981'}40 0%, transparent 50%),
                          radial-gradient(circle at 80% 80%, ${theme?.colors.accent || '#f59e0b'}40 0%, transparent 50%),
                          radial-gradient(circle at 40% 20%, ${theme?.colors.primary || '#2563eb'}40 0%, transparent 50%)`,
              animation: 'float 20s ease-in-out infinite',
            }} />
          </div>
          
          {/* Shimmer Effect */}
          <div className="absolute inset-0 opacity-30" style={{
            background: 'linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 3s infinite',
          }} />
          
          {/* Decorative Elements */}
          <div className="absolute bottom-0 left-0 right-0 h-32" style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.1) 0%, transparent 100%)',
          }} />
        </div>
      )}

      {/* Store Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-12">
        <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
          {/* Store Logo */}
          {seller.storeLogo && (
            <div className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-full border-2 sm:border-4 border-white shadow-lg overflow-hidden bg-white shrink-0">
              <img
                src={seller.storeLogo}
                alt={seller.businessName || seller.name}
                className="w-full h-full object-cover"
                fetchPriority="high"
                decoding="async"
                loading="eager"
              />
            </div>
          )}

          {/* Store Details */}
          <div className="flex-1 text-white min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-bold mb-1 sm:mb-2 break-words">
                  {seller.businessName || seller.name}
                </h1>
                {seller.storeDescription && (
                  <p className="text-xs sm:text-sm md:text-base text-white/90 max-w-2xl line-clamp-2 sm:line-clamp-3">
                    {seller.storeDescription}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {/* About Store Button */}
                {(seller.storeEmail ||
                  seller.storePhone ||
                  seller.supportEmail ||
                  seller.defaultShippingRate ||
                  seller.shippingPolicy ||
                  seller.returnPolicy ||
                  seller.refundPolicy ||
                  seller.cancellationPolicy ||
                  seller.warrantyPolicy ||
                  seller.replacementPolicy) && (
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all shadow-lg hover:scale-110 active:scale-95"
                        title="About Store"
                      >
                        <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="right"
                      className="w-full sm:max-w-lg overflow-y-auto"
                      style={{
                        backgroundColor: theme?.colors.surface || '#ffffff',
                        color: theme?.colors.text || '#111827',
                      }}
                    >
                      <SheetHeader>
                        <SheetTitle style={{ color: theme?.colors.text || '#111827' }}>
                          About {seller.businessName || seller.name}
                        </SheetTitle>
                        <SheetDescription
                          style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                        >
                          Contact information and store policies
                        </SheetDescription>
                      </SheetHeader>

                      <div className="mt-6 space-y-6">
                        {/* Contact Information */}
                        {(seller.storeEmail || seller.storePhone || seller.supportEmail) && (
                          <div>
                            <h3
                              className="text-lg font-semibold mb-4"
                              style={{ color: theme?.colors.text || '#111827' }}
                            >
                              Contact Us
                            </h3>
                            <div className="space-y-3">
                              {seller.storeEmail && (
                                <div className="flex items-center gap-3">
                                  <Mail
                                    className="w-5 h-5 shrink-0"
                                    style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                  />
                                  <a
                                    href={`mailto:${seller.storeEmail}`}
                                    className="text-sm hover:underline break-all"
                                    style={{ color: theme?.colors.text || '#111827' }}
                                  >
                                    {seller.storeEmail}
                                  </a>
                                </div>
                              )}
                              {seller.storePhone && (
                                <div className="flex items-center gap-3">
                                  <Phone
                                    className="w-5 h-5 shrink-0"
                                    style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                  />
                                  <a
                                    href={`tel:${seller.storePhone}`}
                                    className="text-sm hover:underline"
                                    style={{ color: theme?.colors.text || '#111827' }}
                                  >
                                    {seller.storePhone}
                                  </a>
                                </div>
                              )}
                              {seller.supportEmail && (
                                <div className="flex items-center gap-3">
                                  <Mail
                                    className="w-5 h-5 shrink-0"
                                    style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                  />
                                  <a
                                    href={`mailto:${seller.supportEmail}`}
                                    className="text-sm hover:underline break-all"
                                    style={{ color: theme?.colors.text || '#111827' }}
                                  >
                                    Support: {seller.supportEmail}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Shipping Info */}
                        {(seller.defaultShippingRate && seller.defaultShippingRate > 0) && (
                          <>
                            {seller.storeEmail || seller.storePhone || seller.supportEmail ? (
                              <Separator
                                style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }}
                              />
                            ) : null}
                            <div>
                              <h3
                                className="text-lg font-semibold mb-4"
                                style={{ color: theme?.colors.text || '#111827' }}
                              >
                                Shipping
                              </h3>
                              <div className="space-y-2">
                                {(seller.defaultShippingRate ?? 0) > 0 && (
                                  <p
                                    className="text-sm"
                                    style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                  >
                                    Standard shipping: ₹
                                    {seller.defaultShippingRate?.toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {/* Store Policies */}
                        {(seller.shippingPolicy ||
                          seller.returnPolicy ||
                          seller.refundPolicy ||
                          seller.cancellationPolicy ||
                          seller.warrantyPolicy ||
                          seller.replacementPolicy) && (
                          <>
                            {(seller.storeEmail ||
                              seller.storePhone ||
                              seller.supportEmail ||
                              seller.defaultShippingRate) && (
                              <Separator
                                style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }}
                              />
                            )}
                            <div>
                              <h3
                                className="text-lg font-semibold mb-4"
                                style={{ color: theme?.colors.text || '#111827' }}
                              >
                                Store Policies
                              </h3>
                              <div className="space-y-4">
                                {seller.shippingPolicy && (
                                  <div>
                                    <h4
                                      className="font-semibold mb-2"
                                      style={{ color: theme?.colors.text || '#111827' }}
                                    >
                                      Shipping Policy
                                    </h4>
                                    <p
                                      className="text-sm"
                                      style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                    >
                                      {seller.shippingPolicy}
                                    </p>
                                  </div>
                                )}
                                {seller.returnPolicy && (
                                  <>
                                    <Separator
                                      style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }}
                                    />
                                    <div>
                                      <h4
                                        className="font-semibold mb-2"
                                        style={{ color: theme?.colors.text || '#111827' }}
                                      >
                                        Return Policy
                                      </h4>
                                      <p
                                        className="text-sm"
                                        style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                      >
                                        {seller.returnPolicy}
                                      </p>
                                    </div>
                                  </>
                                )}
                                {seller.refundPolicy && (
                                  <>
                                    <Separator
                                      style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }}
                                    />
                                    <div>
                                      <h4
                                        className="font-semibold mb-2"
                                        style={{ color: theme?.colors.text || '#111827' }}
                                      >
                                        Refund Policy
                                      </h4>
                                      <p
                                        className="text-sm"
                                        style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                      >
                                        {seller.refundPolicy}
                                      </p>
                                    </div>
                                  </>
                                )}
                                {seller.cancellationPolicy && (
                                  <>
                                    <Separator
                                      style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }}
                                    />
                                    <div>
                                      <h4
                                        className="font-semibold mb-2"
                                        style={{ color: theme?.colors.text || '#111827' }}
                                      >
                                        Cancellation Policy
                                      </h4>
                                      <p
                                        className="text-sm"
                                        style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                      >
                                        {seller.cancellationPolicy}
                                      </p>
                                    </div>
                                  </>
                                )}
                                {seller.warrantyPolicy && (
                                  <>
                                    <Separator
                                      style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }}
                                    />
                                    <div>
                                      <h4
                                        className="font-semibold mb-2"
                                        style={{ color: theme?.colors.text || '#111827' }}
                                      >
                                        Warranty Policy
                                      </h4>
                                      <p
                                        className="text-sm"
                                        style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                      >
                                        {seller.warrantyPolicy}
                                      </p>
                                    </div>
                                  </>
                                )}
                                {seller.replacementPolicy && (
                                  <>
                                    <Separator
                                      style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }}
                                    />
                                    <div>
                                      <h4
                                        className="font-semibold mb-2"
                                        style={{ color: theme?.colors.text || '#111827' }}
                                      >
                                        Replacement Policy
                                      </h4>
                                      <p
                                        className="text-sm"
                                        style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                                      >
                                        {seller.replacementPolicy}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                )}

                {/* Share Button */}
                <ShareButton
                  url={window.location.href}
                  title="Store"
                  description={`Share ${seller.businessName || seller.name}'s store with others`}
                  shareText={`Check out ${seller.businessName || seller.name} on Kourier Boyz: ${
                    window.location.href
                  }`}
                  variant="ghost"
                  size="icon"
                  className="p-2 sm:p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all shadow-lg hover:scale-110 active:scale-95"
                  iconClassName="w-4 h-4 sm:w-5 sm:h-5"
                />
              </div>
            </div>

            {/* Social Links */}
            {(seller.facebook ||
              seller.instagram ||
              seller.twitter ||
              seller.youtube ||
              seller.linkedin) && (
              <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4">
                {seller.facebook && (
                  <a
                    href={seller.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all"
                  >
                    <Facebook className="w-3 h-3 sm:w-4 sm:h-4" />
                  </a>
                )}
                {seller.instagram && (
                  <a
                    href={seller.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all"
                  >
                    <Instagram className="w-3 h-3 sm:w-4 sm:h-4" />
                  </a>
                )}
                {seller.twitter && (
                  <a
                    href={seller.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all"
                  >
                    <Twitter className="w-3 h-3 sm:w-4 sm:h-4" />
                  </a>
                )}
                {seller.youtube && (
                  <a
                    href={seller.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all"
                  >
                    <Youtube className="w-3 h-3 sm:w-4 sm:h-4" />
                  </a>
                )}
                {seller.linkedin && (
                  <a
                    href={seller.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 sm:p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all"
                  >
                    <Linkedin className="w-3 h-3 sm:w-4 sm:h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
