/**
 * Get the storefront base URL
 * Always returns https://kourierboyz.com
 */
export const getStorefrontBaseUrl = (): string => {
  // Check for custom frontend URL in environment variables (for override if needed)
  const customUrl = import.meta.env.VITE_FRONTEND_URL || import.meta.env.VITE_STOREFRONT_URL
  
  if (customUrl) {
    return customUrl.endsWith('/') ? customUrl.slice(0, -1) : customUrl
  }
  
  // Always use production URL
  return 'https://kourierboyz.com'
}

/**
 * Get the full storefront URL for a seller's store
 * @param storeSlug - The seller's store slug
 * @returns Full URL to the seller's storefront
 */
export const getStorefrontUrl = (storeSlug?: string | null): string => {
  if (!storeSlug || String(storeSlug).trim() === '' || String(storeSlug) === 'undefined') return ''
  const baseUrl = getStorefrontBaseUrl()
  return `${baseUrl}/seller/${storeSlug}`
}

/**
 * Get the storefront URL without the protocol (for display purposes)
 * @param storeSlug - The seller's store slug
 * @returns URL without protocol (e.g., "kourierboyz.com/seller/my-store")
 */
export const getStorefrontUrlDisplay = (storeSlug?: string | null): string => {
  if (!storeSlug || String(storeSlug).trim() === '' || String(storeSlug) === 'undefined') return 'Auto-generated from business name'
  const baseUrl = getStorefrontBaseUrl()
  // Remove protocol for display
  const displayUrl = baseUrl.replace(/^https?:\/\//, '')
  return `${displayUrl}/seller/${storeSlug}`
}

/**
 * Get just the domain part for display (e.g., "kourierboyz.com/seller/")
 */
export const getStorefrontDomainDisplay = (): string => {
  const baseUrl = getStorefrontBaseUrl()
  // Remove protocol for display
  const displayUrl = baseUrl.replace(/^https?:\/\//, '')
  return `${displayUrl}/seller/`
}

