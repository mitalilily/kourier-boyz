import { Mail, Phone } from 'lucide-react'
import type { Seller } from '../../api/seller'
import { Separator } from '../ui/separator'
import type { ThemeConfig } from '../../utils/themes'

interface StoreFooterProps {
  seller: Seller
  theme: ThemeConfig | null
}

export const StoreFooter = ({ seller, theme }: StoreFooterProps) => {
  const hasContactInfo = seller.storeEmail || seller.storePhone || seller.supportEmail
  const hasShippingInfo = seller.defaultShippingRate
  const hasPolicies =
    seller.shippingPolicy ||
    seller.returnPolicy ||
    seller.refundPolicy ||
    seller.cancellationPolicy ||
    seller.warrantyPolicy ||
    seller.replacementPolicy

  if (!hasContactInfo && !hasShippingInfo && !hasPolicies) return null

  return (
    <footer
      className="mt-auto border-t"
      style={{
        backgroundColor: theme?.colors.surface || '#f9fafb',
        borderColor: theme?.colors.border || '#e5e7eb',
        color: theme?.colors.text || '#111827',
      }}
    >
      <div className="mx-auto px-4 py-12" style={{ maxWidth: '1600px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Contact Information */}
          {hasContactInfo && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: theme?.colors.text || '#111827' }}>
                Contact Us
              </h3>
              <div className="space-y-3">
                {seller.storeEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 flex-shrink-0" style={{ color: theme?.colors.textSecondary || '#6b7280' }} />
                    <a
                      href={`mailto:${seller.storeEmail}`}
                      className="text-sm hover:underline truncate"
                      style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                    >
                      {seller.storeEmail}
                    </a>
                  </div>
                )}
                {seller.storePhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 flex-shrink-0" style={{ color: theme?.colors.textSecondary || '#6b7280' }} />
                    <a
                      href={`tel:${seller.storePhone}`}
                      className="text-sm hover:underline"
                      style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                    >
                      {seller.storePhone}
                    </a>
                  </div>
                )}
                {seller.supportEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 flex-shrink-0" style={{ color: theme?.colors.textSecondary || '#6b7280' }} />
                    <a
                      href={`mailto:${seller.supportEmail}`}
                      className="text-sm hover:underline truncate"
                      style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                    >
                      Support: {seller.supportEmail}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shipping Info */}
          {hasShippingInfo && (
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: theme?.colors.text || '#111827' }}>
                Shipping
              </h3>
              <div className="space-y-2">
                {seller.defaultShippingRate && (
                  <p className="text-sm" style={{ color: theme?.colors.textSecondary || '#6b7280' }}>
                    Standard shipping: ₹{seller.defaultShippingRate.toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Store Policies */}
          {hasPolicies && (
            <div className={hasPolicies && (hasContactInfo || hasShippingInfo) ? 'lg:col-span-2' : 'lg:col-span-4'}>
              <h3 className="text-lg font-semibold mb-4" style={{ color: theme?.colors.text || '#111827' }}>
                Store Policies
              </h3>
              <div className="space-y-4">
                {seller.shippingPolicy && (
                  <div>
                    <h4 className="text-sm font-medium mb-1" style={{ color: theme?.colors.text || '#111827' }}>
                      Shipping Policy
                    </h4>
                    <p className="text-xs line-clamp-2" style={{ color: theme?.colors.textSecondary || '#6b7280' }}>
                      {seller.shippingPolicy}
                    </p>
                  </div>
                )}
                {seller.returnPolicy && (
                  <>
                    <Separator style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }} />
                    <div>
                      <h4 className="text-sm font-medium mb-1" style={{ color: theme?.colors.text || '#111827' }}>
                        Return Policy
                      </h4>
                      <p className="text-xs line-clamp-2" style={{ color: theme?.colors.textSecondary || '#6b7280' }}>
                        {seller.returnPolicy}
                      </p>
                    </div>
                  </>
                )}
                {seller.refundPolicy && (
                  <>
                    <Separator style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }} />
                    <div>
                      <h4 className="text-sm font-medium mb-1" style={{ color: theme?.colors.text || '#111827' }}>
                        Refund Policy
                      </h4>
                      <p className="text-xs line-clamp-2" style={{ color: theme?.colors.textSecondary || '#6b7280' }}>
                        {seller.refundPolicy}
                      </p>
                    </div>
                  </>
                )}
                {seller.cancellationPolicy && (
                  <>
                    <Separator style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }} />
                    <div>
                      <h4 className="text-sm font-medium mb-1" style={{ color: theme?.colors.text || '#111827' }}>
                        Cancellation Policy
                      </h4>
                      <p className="text-xs line-clamp-2" style={{ color: theme?.colors.textSecondary || '#6b7280' }}>
                        {seller.cancellationPolicy}
                      </p>
                    </div>
                  </>
                )}
                {seller.warrantyPolicy && (
                  <>
                    <Separator style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }} />
                    <div>
                      <h4 className="text-sm font-medium mb-1" style={{ color: theme?.colors.text || '#111827' }}>
                        Warranty Policy
                      </h4>
                      <p className="text-xs line-clamp-2" style={{ color: theme?.colors.textSecondary || '#6b7280' }}>
                        {seller.warrantyPolicy}
                      </p>
                    </div>
                  </>
                )}
                {seller.replacementPolicy && (
                  <>
                    <Separator style={{ backgroundColor: theme?.colors.border || '#e5e7eb' }} />
                    <div>
                      <h4 className="text-sm font-medium mb-1" style={{ color: theme?.colors.text || '#111827' }}>
                        Replacement Policy
                      </h4>
                      <p className="text-xs line-clamp-2" style={{ color: theme?.colors.textSecondary || '#6b7280' }}>
                        {seller.replacementPolicy}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}

