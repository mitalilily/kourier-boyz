/**
 * Generate Kourier Boyz tracking URL for an order
 * Uses AWB number or order number as identifier
 */
export const generateTrackingUrl = (identifier: string): string => {
  const trackingDomain = process.env.TRACKING_DOMAIN || 'https://tracking.kourierboyz.com'
  return `${trackingDomain}/${identifier}`
}

/**
 * Get tracking identifier from shipment (prefers AWB, falls back to order number)
 */
export const getTrackingIdentifier = (awb?: string, orderNumber?: string): string | null => {
  return awb || orderNumber || null
}
