import { useEffect } from 'react'

interface ProductSEOProps {
  product:
    | {
        _id: string
        slug?: string
        name: string
        description?: string
        shortDescription?: string
        mainImage?: string
        images?: string[]
        price?: number
      }
    | null
    | undefined
  variant?: {
    _id?: string
    mainImage?: string
    images?: string[]
  } | null
  selectedImage?: string | null
  productUrl: string
}

const ProductSEO: React.FC<ProductSEOProps> = ({ product, variant, selectedImage, productUrl }) => {
  // Helper function to get absolute image URL (defined outside useEffect for reuse)
  const getAbsoluteImageUrl = (imageUrl: string): string => {
    if (!imageUrl) return ''

    // If already absolute URL (http:// or https://), return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl
    }

    // If relative URL starting with /, make it absolute using origin
    if (imageUrl.startsWith('/')) {
      return `${window.location.origin}${imageUrl}`
    }

    // If it's a path without leading slash, it might be from API or a CDN
    // Try to construct absolute URL from API base URL
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/marketplace'
    const baseUrl = new URL(apiUrl, window.location.origin).origin

    // If baseUrl ends with /, don't add another /
    const separator = baseUrl.endsWith('/') || imageUrl.startsWith('/') ? '' : '/'
    return `${baseUrl}${separator}${imageUrl}`
  }

  useEffect(() => {
    if (!product) return

    // Get the best image for OG tags (variant-based, falls back to product image)
    const getOGImage = (): string => {
      if (selectedImage) {
        return getAbsoluteImageUrl(selectedImage)
      }
      if (variant?.mainImage) {
        return getAbsoluteImageUrl(variant.mainImage)
      }
      if (variant?.images && variant.images.length > 0) {
        return getAbsoluteImageUrl(variant.images[0])
      }
      if (product.mainImage) {
        return getAbsoluteImageUrl(product.mainImage)
      }
      if (product.images && product.images.length > 0) {
        return getAbsoluteImageUrl(product.images[0])
      }
      // Fallback to a default image if available
      return `${window.location.origin}/brand/kourier-boyz-logo.png`
    }

    // Get description for OG tags
    const getDescription = (): string => {
      const plainDescription =
        typeof product.description === 'string'
          ? product.description
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
          : ''
      const description = product.shortDescription || plainDescription || product.name
      // Limit to 200 chars for OG description
      return description.length > 200 ? `${description.slice(0, 197)}...` : description
    }

    const ogImage = getOGImage()
    const ogDescription = getDescription()
    const ogTitle = `${product.name} | Kourier Boyz`

    // Update or create meta tags
    const updateMetaTag = (property: string, content: string) => {
      let element = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement
      if (!element) {
        element = document.createElement('meta')
        element.setAttribute('property', property)
        document.head.appendChild(element)
      }
      element.setAttribute('content', content)
    }

    const updateNameMetaTag = (name: string, content: string) => {
      let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
      if (!element) {
        element = document.createElement('meta')
        element.setAttribute('name', name)
        document.head.appendChild(element)
      }
      element.setAttribute('content', content)
    }

    // Update title
    document.title = ogTitle

    // Update OG tags - CRITICAL: Set these IMMEDIATELY for social media crawlers
    updateMetaTag('og:title', ogTitle)
    updateMetaTag('og:description', ogDescription)
    updateMetaTag('og:url', productUrl)
    updateMetaTag('og:type', 'product')
    updateMetaTag('og:site_name', 'Kourier Boyz')

    // Image is CRITICAL for share previews - always set it
    if (ogImage) {
      // Ensure image URL is absolute and publicly accessible
      const absoluteImageUrl = ogImage.startsWith('http')
        ? ogImage
        : `${window.location.origin}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`

      updateMetaTag('og:image', absoluteImageUrl)
      updateMetaTag('og:image:secure_url', absoluteImageUrl)
      updateMetaTag('og:image:type', 'image/jpeg')
      updateMetaTag('og:image:width', '1200')
      updateMetaTag('og:image:height', '630')
      updateMetaTag('og:image:alt', product.name)

      // Add multiple image tags for better compatibility (some platforms prefer this)
      // Remove any existing additional og:image tags first
      const existingImages = document.querySelectorAll('meta[property="og:image"]')
      if (existingImages.length > 1) {
        // Keep first one, remove others
        for (let i = 1; i < existingImages.length; i++) {
          existingImages[i].remove()
        }
      }
    }

    // Update Twitter Card tags - Twitter uses these for image previews
    updateNameMetaTag('twitter:card', 'summary_large_image')
    updateNameMetaTag('twitter:title', ogTitle)
    updateNameMetaTag('twitter:description', ogDescription)
    if (ogImage) {
      const absoluteImageUrl = ogImage.startsWith('http')
        ? ogImage
        : `${window.location.origin}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`
      updateNameMetaTag('twitter:image', absoluteImageUrl)
      updateNameMetaTag('twitter:image:alt', product.name)
    }

    // Update standard meta tags
    updateNameMetaTag('description', ogDescription)
    updateNameMetaTag('keywords', `${product.name}, Kourier Boyz, online shopping, e-commerce`)

    // Update canonical URL
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    if (!canonicalLink) {
      canonicalLink = document.createElement('link')
      canonicalLink.setAttribute('rel', 'canonical')
      document.head.appendChild(canonicalLink)
    }
    canonicalLink.setAttribute('href', productUrl)

    // Cleanup function
    return () => {
      // Don't remove meta tags on cleanup to avoid flickering
      // They will be updated when the component mounts again
    }
  }, [product, variant, selectedImage, productUrl])

  return null // This component doesn't render anything
}

export default ProductSEO
