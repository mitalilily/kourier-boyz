import { useMemo } from 'react'
import { toast } from 'sonner'

interface UseProductShareProps {
  product: {
    _id: string
    slug?: string
    name: string
    description?: string
    shortDescription?: string
    mainImage?: string
    images?: string[]
  } | null | undefined
  variant?: {
    _id?: string
    mainImage?: string
    images?: string[]
  } | null
  selectedImage?: string | null
}

export const useProductShare = ({ product, variant, selectedImage }: UseProductShareProps) => {
  const productUrl = useMemo(() => {
    if (!product) return ''
    const baseUrl = window.location.origin
    const productPath = `/product/${product.slug ?? product._id}`
    // Add variant to URL if available for better tracking
    const variantParam = variant?._id ? `?variant=${variant._id}` : ''
    return `${baseUrl}${productPath}${variantParam}`
  }, [product, variant])

  // Get the best image for sharing (variant-based, falls back to product image)
  const shareImage = useMemo(() => {
    if (!product) return ''
    
    // Priority: selectedImage > variant image > product image
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
    
    return ''
  }, [product, variant, selectedImage])

  const shareSummary = useMemo(() => {
    if (!product) return 'Check out this amazing product on Kourier Boyz!'
    const plainDescription =
      typeof product.description === 'string'
        ? product.description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''
    const description = product.shortDescription || plainDescription
    
    if (description) {
      // Limit to 120 chars for better sharing experience
      const truncated = description.slice(0, 120)
      return truncated.length < description.length ? `${truncated}...` : truncated
    }
    
    return `Check out ${product.name} on Kourier Boyz - Shop now!`
  }, [product])

  const sharePayload = useMemo(() => {
    if (!product) return 'Check out this amazing product on Kourier Boyz!'
    return `${product.name}\n\n${shareSummary}\n\nShop now: ${productUrl}`
  }, [product, shareSummary, productUrl])
  
  // Helper function to get absolute image URL
  function getAbsoluteImageUrl(imageUrl: string): string {
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

  const handleQuickShare = (platform: 'whatsapp' | 'twitter' | 'facebook') => {
    const encodedUrl = encodeURIComponent(productUrl)
    const encodedText = encodeURIComponent(sharePayload)
    const windowFeatures = 'noopener,noreferrer'

    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodedText}%20${encodedUrl}`, '_blank', windowFeatures)
        break
      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
          '_blank',
          windowFeatures,
        )
        break
      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          '_blank',
          windowFeatures,
        )
        break
    }
  }

  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(productUrl)
        toast.success('Link copied to clipboard!')
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = productUrl
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        toast.success('Link copied to clipboard!')
      }
    } catch {
      toast.error('Unable to copy link right now')
    }
  }

  return {
    productUrl,
    shareSummary,
    sharePayload,
    shareImage,
    handleQuickShare,
    handleCopyLink,
  }
}


