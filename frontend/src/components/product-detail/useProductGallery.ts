import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FALLBACK_IMAGE, ProductVariant } from './utils'

interface UseProductGalleryProps {
  product: {
    mainImage?: string
    images?: string[]
    videos?: string[]
  } | null | undefined
  activeVariant: ProductVariant | null
}

export const useProductGallery = ({ product, activeVariant }: UseProductGalleryProps) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const galleryImages = useMemo(() => {
    const images = new Set<string>()

    // If variant is selected, only show variant images
    if (activeVariant) {
      if (activeVariant.mainImage) images.add(activeVariant.mainImage)
      activeVariant.images?.forEach((img) => img && images.add(img))
    } else {
      // If no variant, show product images
      if (product?.mainImage) images.add(product.mainImage)
      product?.images?.forEach((img) => img && images.add(img))
    }

    if (images.size === 0) {
      images.add(FALLBACK_IMAGE)
    }

    return Array.from(images)
  }, [activeVariant, product?.images, product?.mainImage])

  const galleryVideos = useMemo(() => {
    const videos = new Set<string>()

    // If variant is selected, only show variant videos
    if (activeVariant) {
      activeVariant.videos?.forEach((vid) => vid && videos.add(vid))
    } else {
      // If no variant, show product videos
      product?.videos?.forEach((vid) => vid && videos.add(vid))
    }

    return Array.from(videos)
  }, [activeVariant, product?.videos])

  // Set initial selected image based on variant
  useEffect(() => {
    if (activeVariant) {
      const variantImage =
        activeVariant.mainImage ||
        activeVariant.images?.[0] ||
        product?.mainImage ||
        product?.images?.[0] ||
        FALLBACK_IMAGE
      setSelectedImage(variantImage)
    } else if (product) {
      setSelectedImage(product.mainImage || product.images?.[0] || FALLBACK_IMAGE)
    }
    // Only depend on variant._id and product.mainImage to avoid unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVariant?._id, product?.mainImage])

  // Ensure selected image is set if gallery images change
  useEffect(() => {
    if (!selectedImage && galleryImages.length > 0) {
      setSelectedImage(galleryImages[0])
    }
  }, [galleryImages, selectedImage])

  // Handle variant hover preview - shows variant's image temporarily
  const handleVariantHoverPreview = useCallback((variant: ProductVariant | null) => {
    // Clear any existing timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = null
    }

    if (variant) {
      // Set preview image from hovered variant
      const variantImage = variant.mainImage || variant.images?.[0] || null
      setPreviewImage(variantImage)
    } else {
      // Small delay before clearing preview to prevent flickering
      previewTimeoutRef.current = setTimeout(() => {
        setPreviewImage(null)
      }, 100)
    }
  }, [])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current)
      }
    }
  }, [])

  // The displayed image is either the preview (hover) or the selected image
  const displayedImage = previewImage || selectedImage

  return {
    galleryImages,
    galleryVideos,
    selectedImage,
    setSelectedImage,
    previewImage,
    displayedImage,
    handleVariantHoverPreview,
  }
}

