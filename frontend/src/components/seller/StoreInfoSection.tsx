import { Mail, Phone } from 'lucide-react'
import type { Seller } from '../../api/seller'
import type { ThemeConfig } from '../../utils/themes'
import { Card, CardContent } from '../ui/card'
import { Separator } from '../ui/separator'

interface StoreInfoSectionProps {
  seller: Seller
  theme: ThemeConfig | null
}

export const StoreInfoSection = ({ seller, theme }: StoreInfoSectionProps) => {
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
    <>
      {/* Contact & Shipping Info */}
      {hasContactInfo || hasShippingInfo ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Contact Information */}
          {hasContactInfo ? (
            <Card
              style={{
                backgroundColor: theme?.colors.surface || '#ffffff',
                borderColor: theme?.colors.border || '#e5e7eb',
                borderRadius: theme?.styles.borderRadius || '0.75rem',
              }}
            >
              <CardContent className="p-6">
                <h3
                  className="text-xl font-bold mb-4"
                  style={{ color: theme?.colors.text || '#111827' }}
                >
                  Contact Us
                </h3>
                <div className="space-y-3">
                  {seller?.storeEmail && (
                    <div className="flex items-center gap-3">
                      <Mail
                        className="w-5 h-5"
                        style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                      />
                      <a
                        href={`mailto:${seller.storeEmail}`}
                        className="hover:underline"
                        style={{ color: theme?.colors.text || '#111827' }}
                      >
                        {seller.storeEmail}
                      </a>
                    </div>
                  )}
                  {seller.storePhone && (
                    <div className="flex items-center gap-3">
                      <Phone
                        className="w-5 h-5"
                        style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                      />
                      <a
                        href={`tel:${seller.storePhone}`}
                        className="hover:underline"
                        style={{ color: theme?.colors.text || '#111827' }}
                      >
                        {seller.storePhone}
                      </a>
                    </div>
                  )}
                  {seller.supportEmail && (
                    <div className="flex items-center gap-3">
                      <Mail
                        className="w-5 h-5"
                        style={{ color: theme?.colors.textSecondary || '#6b7280' }}
                      />
                      <a
                        href={`mailto:${seller.supportEmail}`}
                        className="hover:underline"
                        style={{ color: theme?.colors.text || '#111827' }}
                      >
                        Support: {seller.supportEmail}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Shipping Info */}
          {hasShippingInfo ? (
            <Card
              style={{
                backgroundColor: theme?.colors.surface || '#ffffff',
                borderColor: theme?.colors.border || '#e5e7eb',
                borderRadius: theme?.styles.borderRadius || '0.75rem',
              }}
            >
              <CardContent className="p-6">
                <h3
                  className="text-xl font-bold mb-4"
                  style={{ color: theme?.colors.text || '#111827' }}
                >
                  Shipping
                </h3>
                <div className="space-y-2">
                  {seller?.defaultShippingRate ? (
                    <p style={{ color: theme?.colors.text || '#111827' }}>
                      Standard shipping: ₹{seller.defaultShippingRate.toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {/* Store Policies */}
      {hasPolicies ? (
        <Card
          className="mb-8"
          style={{
            backgroundColor: theme?.colors.surface || '#ffffff',
            borderColor: theme?.colors.border || '#e5e7eb',
            borderRadius: theme?.styles.borderRadius || '0.75rem',
          }}
        >
          <CardContent className="p-6">
            <h3
              className="text-xl font-bold mb-6"
              style={{ color: theme?.colors.text || '#111827' }}
            >
              Store Policies
            </h3>
            <div className="space-y-6">
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
                  <Separator />
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
                  <Separator />
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
                  <Separator />
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
                  <Separator />
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
                  <Separator />
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
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
