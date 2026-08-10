import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import type { CreateProductReviewInput, ProductReview } from '@/api/products'
import { useDislikeReview, useLikeReview, useSubmitProductReview } from '@/api/products'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Rating, RatingButton } from '@/components/ui/shadcn-io/rating'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Star,
  ThumbsDown,
  ThumbsUp,
  Video,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

interface ProductReviewsSectionProps {
  averageRating?: number
  reviewCount?: number
  reviews?: ProductReview[]
  productId: string
  productQueryKey: string
  isAuthenticated: boolean
  onRequestLogin?: () => void
  limitReviews?: number // Limit number of reviews to show (undefined = show all)
  autoOpenDialog?: boolean
}

const FILTER_OPTIONS: Array<{ label: string; value: 'all' | number }> = [
  { label: 'All', value: 'all' },
  { label: '5★', value: 5 },
  { label: '4★', value: 4 },
  { label: '3★', value: 3 },
  { label: '2★', value: 2 },
  { label: '1★', value: 1 },
]

const MAX_IMAGE_COUNT = 6
const MAX_VIDEO_COUNT = 2
const MAX_IMAGE_SIZE_MB = 8
const MAX_VIDEO_SIZE_MB = 80

type MediaPreview = {
  file?: File // Only for new files
  preview: string
  isExisting?: boolean // true if this is an existing media URL
  url?: string // URL for existing media
}

type ReviewFormValues = CreateProductReviewInput

const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  averageRating,
  reviewCount,
  reviews,
  productId,
  productQueryKey,
  isAuthenticated,
  onRequestLogin,
  limitReviews = 3,
  autoOpenDialog,
}) => {
  const navigate = useNavigate()
  const [activeFilter, setActiveFilter] = useState<'all' | number>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState<ProductReview | null>(null)
  const [selectedMediaUrl, setSelectedMediaUrl] = useState<string | null>(null)
  const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video' | null>(null)
  const hasAutoOpenedRef = useRef(false)

  // Helper to load anonymous state for a review
  const loadReviewWithAnonymousState = (review: ProductReview): ProductReview => {
    if (isAuthenticated) {
      return review
    }
    if (typeof window === 'undefined') {
      return review
    }
    const key = `review_${review._id}_anonymous`
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        const anonState = JSON.parse(stored)
        return {
          ...review,
          hasLiked: anonState.hasLiked ?? false,
          hasDisliked: anonState.hasDisliked ?? false,
        }
      } catch {
        return review
      }
    }
    return review
  }
  const [imagePreviews, setImagePreviews] = useState<MediaPreview[]>([])
  const [videoPreviews, setVideoPreviews] = useState<MediaPreview[]>([])
  const imagePreviewsRef = useRef<MediaPreview[]>([])
  const videoPreviewsRef = useRef<MediaPreview[]>([])
  const submitReview = useSubmitProductReview()
  const likeReview = useLikeReview()
  const dislikeReview = useDislikeReview()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReviewFormValues>({
    defaultValues: {
      rating: 0,
      title: '',
      comment: '',
      postAnonymously: false,
    },
  })

  const ratingValue = watch('rating') ?? 0

  const ratingDistribution = useMemo(() => {
    const base = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return base
    }
    return reviews.reduce((acc, review) => {
      const rating = Math.round(review.rating)
      if (rating >= 1 && rating <= 5) {
        acc[rating as keyof typeof acc] += 1
      }
      return acc
    }, base)
  }, [reviews])

  const filteredReviews = useMemo(() => {
    if (!Array.isArray(reviews)) return []
    if (activeFilter === 'all') return reviews
    return reviews.filter((review) => Math.round(review.rating) === activeFilter)
  }, [activeFilter, reviews])

  const hasReviews = Array.isArray(reviews) && reviews.length > 0
  const ownerReview = useMemo(
    () => (Array.isArray(reviews) ? reviews.find((review) => review.isOwner) : undefined),
    [reviews],
  )

  useEffect(() => {
    imagePreviewsRef.current = imagePreviews
  }, [imagePreviews])

  useEffect(() => {
    videoPreviewsRef.current = videoPreviews
  }, [videoPreviews])

  useEffect(() => {
    return () => {
      imagePreviewsRef.current.forEach((preview) => {
        // Only revoke blob URLs for new files
        if (!preview.isExisting && preview.file) {
          URL.revokeObjectURL(preview.preview)
        }
      })
      videoPreviewsRef.current.forEach((preview) => {
        // Only revoke blob URLs for new files
        if (!preview.isExisting && preview.file) {
          URL.revokeObjectURL(preview.preview)
        }
      })
    }
  }, [])

  const clearSelectedMedia = () => {
    imagePreviews.forEach((preview) => {
      // Only revoke URLs for new files (blob URLs)
      if (!preview.isExisting && preview.file) {
        URL.revokeObjectURL(preview.preview)
      }
    })
    videoPreviews.forEach((preview) => {
      // Only revoke URLs for new files (blob URLs)
      if (!preview.isExisting && preview.file) {
        URL.revokeObjectURL(preview.preview)
      }
    })
    setImagePreviews([])
    setVideoPreviews([])
  }

  const handleImagesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = event.target.files
    if (!filesList) return

    const nextPreviews: MediaPreview[] = []
    const existingCount = imagePreviews.length

    for (const file of Array.from(filesList)) {
      if (!file.type.startsWith('image/')) {
        toast.error('Only image files are allowed for photos.')
        continue
      }
      if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
        toast.error(`Images must be smaller than ${MAX_IMAGE_SIZE_MB}MB.`)
        continue
      }
      if (existingCount + nextPreviews.length >= MAX_IMAGE_COUNT) {
        toast.error(`You can add up to ${MAX_IMAGE_COUNT} images.`)
        break
      }
      const previewUrl = URL.createObjectURL(file)
      nextPreviews.push({ file, preview: previewUrl })
    }

    if (nextPreviews.length > 0) {
      setImagePreviews((prev) => [...prev, ...nextPreviews])
    }

    event.target.value = ''
  }

  const handleVideosChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = event.target.files
    if (!filesList) return

    const nextPreviews: MediaPreview[] = []
    const existingCount = videoPreviews.length

    for (const file of Array.from(filesList)) {
      if (!file.type.startsWith('video/')) {
        toast.error('Only video files are allowed for clips.')
        continue
      }
      if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
        toast.error(`Videos must be smaller than ${MAX_VIDEO_SIZE_MB}MB.`)
        continue
      }
      if (existingCount + nextPreviews.length >= MAX_VIDEO_COUNT) {
        toast.error(`You can add up to ${MAX_VIDEO_COUNT} videos.`)
        break
      }
      const previewUrl = URL.createObjectURL(file)
      nextPreviews.push({ file, preview: previewUrl })
    }

    if (nextPreviews.length > 0) {
      setVideoPreviews((prev) => [...prev, ...nextPreviews])
    }

    event.target.value = ''
  }

  const handleRemoveImage = (index: number) => {
    setImagePreviews((prev) => {
      const next = [...prev]
      const removed = next.splice(index, 1)[0]
      if (removed) {
        URL.revokeObjectURL(removed.preview)
      }
      return next
    })
  }

  const handleRemoveVideo = (index: number) => {
    setVideoPreviews((prev) => {
      const next = [...prev]
      const removed = next.splice(index, 1)[0]
      if (removed) {
        URL.revokeObjectURL(removed.preview)
      }
      return next
    })
  }

  const handleDialogChange = (open: boolean) => {
    if (open) {
      if (!isAuthenticated) {
        onRequestLogin?.()
        return
      }
      setIsDialogOpen(true)
      return
    }

    setIsDialogOpen(false)
    clearSelectedMedia()
    reset({
      rating: 0,
      title: '',
      comment: '',
      postAnonymously: false,
    })
  }

  // Auto-open write-review dialog once, if requested (e.g. coming from Orders page)
  useEffect(() => {
    if (!autoOpenDialog || hasAutoOpenedRef.current) return
    // Defer to next tick so initial render is complete
    const timer = setTimeout(() => {
      handleOpenDialog()
      hasAutoOpenedRef.current = true
    }, 200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenDialog, isAuthenticated])
  const handleOpenDialog = () => {
    if (!isAuthenticated) {
      onRequestLogin?.()
      return
    }
    if (ownerReview) {
      setValue('rating', ownerReview.rating, { shouldDirty: false })
      setValue('comment', ownerReview.comment ?? '', { shouldDirty: false })
      setValue('title', ownerReview.title ?? '', { shouldDirty: false })

      // Prefill existing images
      const existingImages: MediaPreview[] = (ownerReview.images || []).map((url) => ({
        preview: url,
        isExisting: true,
        url,
      }))
      setImagePreviews(existingImages)

      // Prefill existing videos
      const existingVideos: MediaPreview[] = (ownerReview.videos || []).map((url) => ({
        preview: url,
        isExisting: true,
        url,
      }))
      setVideoPreviews(existingVideos)
    } else {
      // Clear media when creating new review
      clearSelectedMedia()
    }
    setIsDialogOpen(true)
  }

  const handleRatingSelect = (value: number) => {
    setValue('rating', value, { shouldValidate: true })
  }

  const onSubmit = async (values: ReviewFormValues) => {
    if (!productId) return
    if (!values.rating || values.rating < 1) {
      toast.error('Select an overall rating before submitting.')
      return
    }

    const comment = values.comment.trim()
    if (comment.length < 10) {
      toast.error('Use at least 10 characters so others can learn from your review.')
      return
    }

    const title = values.title?.trim() ? values.title.trim() : undefined

    const formData = new FormData()
    formData.append('rating', String(values.rating))
    formData.append('comment', comment)
    if (title) {
      formData.append('title', title)
    }
    // Add postAnonymously flag if user wants to post anonymously
    if (values.postAnonymously) {
      formData.append('postAnonymously', 'true')
    }

    // Separate existing media URLs from new files
    const existingImageUrls: string[] = []
    const existingVideoUrls: string[] = []
    const newImageFiles: File[] = []
    const newVideoFiles: File[] = []

    imagePreviews.forEach((preview) => {
      if (preview.isExisting && preview.url) {
        existingImageUrls.push(preview.url)
      } else if (preview.file) {
        newImageFiles.push(preview.file)
      }
    })

    videoPreviews.forEach((preview) => {
      if (preview.isExisting && preview.url) {
        existingVideoUrls.push(preview.url)
      } else if (preview.file) {
        newVideoFiles.push(preview.file)
      }
    })

    formData.append('existingImages', JSON.stringify(existingImageUrls))
    formData.append('existingVideos', JSON.stringify(existingVideoUrls))

    newImageFiles.forEach((file) => {
      formData.append('images', file)
    })

    newVideoFiles.forEach((file) => {
      formData.append('videos', file)
    })

    try {
      const response = await submitReview.mutateAsync({
        productId,
        productQueryKey,
        formData,
      })

      // Show appropriate message based on moderation status
      if (response.moderationStatus === 'pending') {
        toast.info(
          response.message ||
            'Review submitted and pending moderation. It will be visible after approval.',
        )
      } else if (response.moderationStatus === 'rejected') {
        toast.error(response.message || 'Review was rejected due to inappropriate content.')
      } else {
        toast.success(response.message || 'Thank you! Your review is live.')
      }

      reset({
        rating: 0,
        title: '',
        comment: '',
      })
      clearSelectedMedia()
      setIsDialogOpen(false)
    } catch (error: unknown) {
      console.error('Failed to submit review', error)
      const message =
        (typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          (error as { response?: { data?: { error?: string } } }).response?.data?.error) ||
        'Unable to submit review right now'
      toast.error(message)
    }
  }

  // Collect all images and videos from all reviews into a flat array
  type MediaItem = {
    type: 'image' | 'video'
    url: string
    reviewId: string
    review: ProductReview
  }

  const allMediaItems = useMemo(() => {
    if (!Array.isArray(reviews)) return []
    const items: MediaItem[] = []

    reviews.forEach((review) => {
      // Add all images
      if (review.images && review.images.length > 0) {
        review.images.forEach((image) => {
          items.push({
            type: 'image',
            url: image,
            reviewId: review._id,
            review,
          })
        })
      }

      // Add all videos
      if (review.videos && review.videos.length > 0) {
        review.videos.forEach((video) => {
          items.push({
            type: 'video',
            url: video,
            reviewId: review._id,
            review,
          })
        })
      }
    })

    return items
  }, [reviews])

  // Calculate how many items can fit based on container width
  // Each item is 96px (w-24) + 12px gap (gap-3) = ~108px per item
  // We'll use a ref to measure the container width dynamically
  const mediaContainerRef = useRef<HTMLDivElement>(null)
  const [maxVisibleItems, setMaxVisibleItems] = useState(6)

  useEffect(() => {
    const calculateVisibleItems = () => {
      if (mediaContainerRef.current && allMediaItems.length > 0) {
        const containerWidth = mediaContainerRef.current.offsetWidth
        // Each item: 96px (w-24) + 12px gap = 108px
        // Calculate how many items can fit, reserving space for "+ count" button if needed
        const itemsPerRow = Math.floor(containerWidth / 108)
        const calculatedMax = Math.max(3, itemsPerRow) // Minimum 3 items

        // If we have more items than can fit, reserve space for the "+ count" button
        if (allMediaItems.length > calculatedMax) {
          // Recalculate with reserved space for button (108px)
          const availableWidth = containerWidth - 108
          const adjustedMax = Math.floor(availableWidth / 108)
          setMaxVisibleItems(Math.max(3, adjustedMax))
        } else {
          setMaxVisibleItems(calculatedMax)
        }
      }
    }

    // Calculate after a small delay to ensure container is rendered
    const timeoutId = setTimeout(calculateVisibleItems, 100)
    window.addEventListener('resize', calculateVisibleItems)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', calculateVisibleItems)
    }
  }, [allMediaItems.length])

  const visibleMedia = allMediaItems.slice(0, maxVisibleItems)
  const remainingCount = Math.max(0, allMediaItems.length - maxVisibleItems)

  return (
    <>
      <section className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white shadow-lg shadow-gray-200/50 p-4 sm:p-6 lg:p-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6 sm:mb-8">
          Customer reviews
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 sm:gap-8">
          {/* Left Column - Customer Reviews Summary */}
          <div className="space-y-4 sm:space-y-6">
            {/* Overall Rating */}
            <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4 space-y-2 sm:space-y-3">
              {averageRating && averageRating > 0 ? (
                <>
                  <div className="flex items-baseline gap-1.5 sm:gap-2">
                    <span className="text-3xl sm:text-4xl font-semibold text-gray-900">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-600">out of 5</span>
                  </div>
                  <Rating
                    value={averageRating}
                    readOnly
                    className="flex items-center [&>button>svg]:text-gray-300 [&>button>svg[class*='fill-current']]:text-yellow-500"
                  >
                    <RatingButton className="text-yellow-500" size={16} />
                    <RatingButton className="text-yellow-500" size={16} />
                    <RatingButton className="text-yellow-500" size={16} />
                    <RatingButton className="text-yellow-500" size={16} />
                    <RatingButton className="text-yellow-500" size={16} />
                  </Rating>
                  {reviewCount !== undefined && reviewCount > 0 && (
                    <p className="text-xs sm:text-sm text-gray-600">
                      {reviewCount} {reviewCount === 1 ? 'rating' : 'ratings'}
                    </p>
                  )}
                </>
              ) : (
                <div className="text-xs sm:text-sm text-gray-500">No ratings yet</div>
              )}
            </div>

            {/* Star Breakdown */}
            {hasReviews && (
              <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4 space-y-2 sm:space-y-2.5">
                {([5, 4, 3, 2, 1] as const).map((rating) => {
                  const count = ratingDistribution[rating]
                  const total = reviews.length
                  const percentage = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={rating} className="flex items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveFilter(rating)}
                        className="text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline min-w-[45px] sm:min-w-[50px] text-left transition-colors"
                      >
                        {rating} star{rating !== 1 ? 's' : ''}
                      </button>
                      <div className="flex-1 h-2.5 sm:h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-yellow-500 transition-all duration-500 ease-out rounded-full shadow-sm"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-[10px] sm:text-xs font-semibold text-gray-700 min-w-[35px] sm:min-w-[40px] text-right tabular-nums">
                        {percentage}%
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Review this product */}
            <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4 space-y-2 sm:space-y-3">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                Review this product
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Share your thoughts with other customers
              </p>
              <Button
                onClick={handleOpenDialog}
                variant="outline"
                className="w-full border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all text-xs sm:text-sm"
                disabled={submitReview.isPending}
              >
                Write a product review
              </Button>
            </div>
          </div>

          {/* Middle Column - Reviews */}
          <div className="space-y-4 sm:space-y-6">
            {/* Filter buttons */}
            {hasReviews && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                {FILTER_OPTIONS.map((option) => {
                  const isActive = activeFilter === option.value
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setActiveFilter(option.value)}
                      className={cn(
                        'px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg sm:rounded-xl border transition-all',
                        isActive
                          ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                          : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Reviews with images & videos section */}
            {allMediaItems.length > 0 && (
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  Reviews with images & videos
                </h3>
                <div ref={mediaContainerRef} className="flex flex-wrap gap-2 sm:gap-3">
                  {visibleMedia.map((mediaItem, idx) => {
                    if (mediaItem.type === 'image') {
                      return (
                        <div
                          key={`media-${mediaItem.reviewId}-image-${idx}`}
                          className="relative group cursor-pointer"
                          onClick={() => {
                            setSelectedReview(loadReviewWithAnonymousState(mediaItem.review))
                            setSelectedMediaUrl(mediaItem.url)
                            setSelectedMediaType(mediaItem.type)
                            setIsReviewModalOpen(true)
                          }}
                        >
                          <img
                            src={mediaItem.url}
                            alt="Review"
                            className="h-20 w-20 sm:h-24 sm:w-24 object-cover rounded-lg sm:rounded-xl border border-gray-200 cursor-pointer hover:opacity-90 hover:border-gray-300 hover:shadow-md transition-all shadow-sm"
                            onClick={() => {
                              setSelectedReview(mediaItem.review)
                              setSelectedMediaUrl(mediaItem.url)
                              setSelectedMediaType(mediaItem.type)
                              setIsReviewModalOpen(true)
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                            <ImageIcon className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      )
                    } else {
                      return (
                        <div
                          key={`media-${mediaItem.reviewId}-video-${idx}`}
                          className="relative group h-20 w-20 sm:h-24 sm:w-24 rounded-lg sm:rounded-xl border border-gray-200 cursor-pointer hover:opacity-90 hover:border-gray-300 hover:shadow-md transition-all shadow-sm overflow-hidden bg-gray-100"
                          onClick={() => {
                            setSelectedReview(loadReviewWithAnonymousState(mediaItem.review))
                            setSelectedMediaUrl(mediaItem.url)
                            setSelectedMediaType(mediaItem.type)
                            setIsReviewModalOpen(true)
                          }}
                        >
                          <video
                            src={mediaItem.url}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                            <div className="bg-black/50 rounded-full p-2">
                              <Video className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        </div>
                      )
                    }
                  })}
                  {remainingCount > 0 && (
                    <Button
                      type="button"
                      onClick={() => setIsMediaModalOpen(true)}
                      className="h-20 w-20 sm:h-24 sm:w-24 bg-white rounded-lg sm:rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 hover:shadow-md transition-all flex flex-col items-center justify-center text-gray-600 hover:text-gray-900 group"
                    >
                      <span className="text-xl sm:text-2xl font-semibold group-hover:scale-110 transition-transform">
                        +{remainingCount}
                      </span>
                      <span className="text-[10px] sm:text-xs mt-0.5 sm:mt-1">more</span>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Top reviews section */}
            <div className="space-y-4 sm:space-y-5">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Top reviews</h3>

              {hasReviews ? (
                filteredReviews.length > 0 ? (
                  <>
                    <div className="space-y-4 sm:space-y-5">
                      {filteredReviews
                        .slice(0, limitReviews ?? filteredReviews.length)
                        .map((review) => (
                          <ReviewCard
                            key={review._id}
                            review={review}
                            productId={productId}
                            productQueryKey={productQueryKey}
                            isAuthenticated={isAuthenticated}
                            onRequestLogin={onRequestLogin}
                            onImageClick={(review, imageUrl) => {
                              setSelectedReview(loadReviewWithAnonymousState(review))
                              setSelectedMediaUrl(imageUrl)
                              setSelectedMediaType('image')
                              setIsReviewModalOpen(true)
                            }}
                            onVideoClick={(review, videoUrl) => {
                              setSelectedReview(loadReviewWithAnonymousState(review))
                              setSelectedMediaUrl(videoUrl)
                              setSelectedMediaType('video')
                              setIsReviewModalOpen(true)
                            }}
                          />
                        ))}
                    </div>
                    {limitReviews !== undefined &&
                      reviewCount !== undefined &&
                      reviewCount > limitReviews && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            className="w-full border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
                            onClick={() => {
                              navigate(`/product/${productId}/reviews`)
                            }}
                          >
                            See more reviews ({reviewCount - limitReviews} more)
                          </Button>
                        </div>
                      )}
                  </>
                ) : (
                  <EmptyState
                    message="No reviews match this filter yet. Try another rating."
                    onWriteReview={handleOpenDialog}
                    disabled={submitReview.isPending}
                  />
                )
              ) : (
                <EmptyState
                  message="Be the first to review this product. Your feedback helps other shoppers."
                  onWriteReview={handleOpenDialog}
                  disabled={submitReview.isPending}
                />
              )}
            </div>
          </div>
        </div>
      </section>
      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold text-gray-900">
                Share your experience
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Tell other shoppers what you loved about this product.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-800">Overall rating</Label>
                <input
                  type="hidden"
                  {...register('rating', {
                    min: {
                      value: 1,
                      message: 'Select how many stars you would rate this product',
                    },
                  })}
                />
                <div className="flex items-center gap-2">
                  {Array.from({ length: 5 }).map((_, index) => {
                    const starValue = index + 1
                    const isActive = ratingValue >= starValue
                    return (
                      <button
                        type="button"
                        key={starValue}
                        onClick={() => handleRatingSelect(starValue)}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border transition-all',
                          isActive
                            ? 'border-yellow-400 bg-yellow-100/60 text-yellow-500 shadow-sm'
                            : 'border-gray-200 text-gray-400 hover:border-yellow-300 hover:text-yellow-400 hover:bg-yellow-50/50',
                        )}
                        aria-label={`Rate ${starValue} star${starValue > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={cn(
                            'h-5 w-5',
                            isActive ? 'fill-yellow-400 text-yellow-500' : 'fill-transparent',
                          )}
                        />
                      </button>
                    )
                  })}
                </div>
                {errors.rating?.message ? (
                  <p className="text-xs text-rose-500">{errors.rating.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-title">Headline (optional)</Label>
                <Input
                  id="review-title"
                  placeholder="What stood out?"
                  {...register('title', {
                    maxLength: {
                      value: 140,
                      message: 'Please keep the headline under 140 characters',
                    },
                  })}
                />
                {errors.title?.message ? (
                  <p className="text-xs text-rose-500">{errors.title.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-comment">Your experience</Label>
                <Textarea
                  id="review-comment"
                  rows={5}
                  placeholder="Share details about quality, comfort, delivery, or anything else fellow shoppers should know."
                  {...register('comment', {
                    required: 'Please share a few words about your experience',
                    minLength: {
                      value: 10,
                      message: 'Use at least 10 characters so others can learn from your review',
                    },
                    maxLength: {
                      value: 2000,
                      message: 'Please keep your review under 2000 characters',
                    },
                  })}
                />
                {errors.comment?.message ? (
                  <p className="text-xs text-rose-500">{errors.comment.message}</p>
                ) : null}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="post-anonymously"
                  checked={watch('postAnonymously') || false}
                  onCheckedChange={(checked) => setValue('postAnonymously', checked === true)}
                />
                <Label
                  htmlFor="post-anonymously"
                  className="text-sm font-normal text-gray-700 cursor-pointer"
                >
                  Post anonymously
                </Label>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                Your review will be displayed as "Anonymous" instead of your name.
              </p>

              <div className="space-y-2">
                <Label>Photos (optional)</Label>
                <div className="flex flex-wrap gap-3">
                  {imagePreviews.map((preview, index) => (
                    <div key={`${preview.preview}-${index}`} className="relative h-24 w-24">
                      <img
                        src={preview.preview}
                        alt={`Selected review photo ${index + 1}`}
                        className="h-full w-full rounded-xl object-cover border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute -top-1.5 -right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white shadow-sm"
                        aria-label="Remove photo"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {imagePreviews.length < MAX_IMAGE_COUNT ? (
                    <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImagesChange}
                      />
                      <ImageIcon className="h-5 w-5" />
                      <span>Add photos</span>
                    </label>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500">
                  Up to {MAX_IMAGE_COUNT} images · {MAX_IMAGE_SIZE_MB}MB each
                </p>
              </div>

              <div className="space-y-2">
                <Label>Videos (optional)</Label>
                <div className="flex flex-wrap gap-3">
                  {videoPreviews.map((preview, index) => (
                    <div key={`${preview.preview}-${index}`} className="relative h-28 w-40">
                      <video
                        src={preview.preview}
                        controls
                        className="h-full w-full rounded-xl border border-gray-200 bg-black object-cover"
                      >
                        Your browser does not support the video tag.
                      </video>
                      <button
                        type="button"
                        onClick={() => handleRemoveVideo(index)}
                        className="absolute -top-1.5 -right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-white shadow-sm"
                        aria-label="Remove video"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {videoPreviews.length < MAX_VIDEO_COUNT ? (
                    <label className="flex h-28 w-40 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700">
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        className="hidden"
                        onChange={handleVideosChange}
                      />
                      <Video className="h-5 w-5" />
                      <span>Add videos</span>
                    </label>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500">
                  Up to {MAX_VIDEO_COUNT} short clips · {MAX_VIDEO_SIZE_MB}MB each
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
                disabled={submitReview.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitReview.isPending}>
                {submitReview.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting
                  </>
                ) : (
                  'Submit review'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Media Modal - Shows all images and videos */}
      <Dialog open={isMediaModalOpen} onOpenChange={setIsMediaModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-gray-900">
              All Images & Videos
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              {allMediaItems.length} media item{allMediaItems.length !== 1 ? 's' : ''} from reviews
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
            {allMediaItems.map((mediaItem, idx) => {
              if (mediaItem.type === 'image') {
                return (
                  <div
                    key={`modal-media-${mediaItem.reviewId}-image-${idx}`}
                    className="relative group cursor-pointer"
                    onClick={() => {
                      setSelectedReview(loadReviewWithAnonymousState(mediaItem.review))
                      setSelectedMediaUrl(mediaItem.url)
                      setSelectedMediaType(mediaItem.type)
                      setIsMediaModalOpen(false)
                      setIsReviewModalOpen(true)
                    }}
                  >
                    <img
                      src={mediaItem.url}
                      alt="Review"
                      className="w-full aspect-square object-cover rounded-xl border border-gray-200 hover:opacity-80 hover:border-gray-300 transition-all shadow-sm"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <ImageIcon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                )
              } else {
                return (
                  <div
                    key={`modal-media-${mediaItem.reviewId}-video-${idx}`}
                    className="relative group cursor-pointer h-full aspect-square rounded-xl border border-gray-200 hover:opacity-80 hover:border-gray-300 transition-all shadow-sm overflow-hidden bg-gray-100"
                    onClick={() => {
                      setSelectedReview(loadReviewWithAnonymousState(mediaItem.review))
                      setSelectedMediaUrl(mediaItem.url)
                      setSelectedMediaType(mediaItem.type)
                      setIsMediaModalOpen(false)
                      setIsReviewModalOpen(true)
                    }}
                  >
                    <video
                      src={mediaItem.url}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl">
                      <div className="bg-black/50 rounded-full p-3">
                        <Video className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Modal - Shows the review with selected media */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
          {selectedReview && selectedMediaUrl && selectedMediaType && (
            <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
              {/* Left Side - Large Media View */}
              <div className="lg:w-1/2 bg-gray-50 flex items-center justify-center p-3 sm:p-4 lg:p-8 min-h-[300px] sm:min-h-[400px] lg:min-h-0">
                <div className="w-full h-full flex items-center justify-center">
                  {selectedMediaType === 'image' ? (
                    <img
                      src={selectedMediaUrl}
                      alt="Review"
                      className="w-full max-w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px] rounded-lg sm:rounded-xl shadow-lg object-contain"
                    />
                  ) : (
                    <video
                      src={selectedMediaUrl}
                      controls
                      className="w-full max-w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px] rounded-lg sm:rounded-xl shadow-lg object-contain"
                    >
                      <source src={selectedMediaUrl} />
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              </div>

              {/* Right Side - Review Details with Thumbnails */}
              <div className="lg:w-1/2 overflow-y-auto p-4 sm:p-6">
                <DialogHeader className="mb-4">
                  <DialogTitle className="text-2xl font-semibold text-gray-900">
                    Review Details
                  </DialogTitle>
                </DialogHeader>

                {/* Reviewer Info */}
                <div className="flex items-start gap-3 mb-4 pb-4 border-b border-gray-200">
                  <Avatar className="h-10 w-10 border border-gray-300 shrink-0">
                    {selectedReview.reviewer?.avatarUrl ? (
                      <AvatarImage
                        src={selectedReview.reviewer.avatarUrl}
                        alt={selectedReview.reviewer.name}
                      />
                    ) : null}
                    <AvatarFallback className="text-sm font-medium bg-gray-200 text-gray-600">
                      {selectedReview.reviewer?.name
                        ? selectedReview.reviewer.name
                            .split(' ')
                            .map((part) => part.charAt(0))
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()
                        : 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedReview.reviewer?.name ?? 'Customer'}
                      </p>
                    </div>
                    {/* Star Rating */}
                    <div className="flex items-center gap-1 mb-1">
                      <Rating
                        value={selectedReview.rating}
                        readOnly
                        className="flex items-center [&>button>svg]:text-gray-300 [&>button>svg[class*='fill-current']]:text-yellow-500"
                      >
                        <RatingButton className="text-yellow-500" size={16} />
                        <RatingButton className="text-yellow-500" size={16} />
                        <RatingButton className="text-yellow-500" size={16} />
                        <RatingButton className="text-yellow-500" size={16} />
                        <RatingButton className="text-yellow-500" size={16} />
                      </Rating>
                    </div>
                    {/* Review Title */}
                    {selectedReview.title && (
                      <h3 className="text-base font-semibold text-gray-900 mb-1">
                        {selectedReview.title}
                      </h3>
                    )}
                    {/* Date and Verified Purchase */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>
                        Reviewed in{' '}
                        {[selectedReview.reviewer?.city, selectedReview.reviewer?.state]
                          .filter(Boolean)
                          .join(', ') || 'India'}{' '}
                        on{' '}
                        {new Date(selectedReview.createdAt).toLocaleDateString('en-US', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                      {selectedReview.isVerifiedPurchase && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-emerald-600 font-medium">Verified Purchase</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Review Text */}
                <p className="text-sm leading-relaxed text-gray-700 mb-4">
                  {selectedReview.comment}
                </p>

                {/* Media Thumbnails */}
                {(selectedReview.images && selectedReview.images.length > 0) ||
                (selectedReview.videos && selectedReview.videos.length > 0) ? (
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Media</h4>
                    <div className="flex flex-wrap gap-2">
                      {/* Image Thumbnails */}
                      {selectedReview.images?.map((image, index) => (
                        <div
                          key={`thumb-image-${index}`}
                          className={cn(
                            'relative cursor-pointer rounded-lg border-2 transition-all',
                            selectedMediaUrl === image && selectedMediaType === 'image'
                              ? 'border-yellow-500 ring-2 ring-yellow-200'
                              : 'border-gray-200 hover:border-gray-300',
                          )}
                          onClick={() => {
                            setSelectedMediaUrl(image)
                            setSelectedMediaType('image')
                          }}
                        >
                          <img
                            src={image}
                            alt={`Image ${index + 1}`}
                            className="h-20 w-20 object-cover rounded-lg"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                            <ImageIcon className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      ))}
                      {/* Video Thumbnails */}
                      {selectedReview.videos?.map((video, index) => (
                        <div
                          key={`thumb-video-${index}`}
                          className={cn(
                            'relative cursor-pointer rounded-lg border-2 transition-all overflow-hidden bg-gray-100',
                            selectedMediaUrl === video && selectedMediaType === 'video'
                              ? 'border-yellow-500 ring-2 ring-yellow-200'
                              : 'border-gray-200 hover:border-gray-300',
                          )}
                          onClick={() => {
                            setSelectedMediaUrl(video)
                            setSelectedMediaType('video')
                          }}
                        >
                          <video
                            src={video}
                            className="h-20 w-20 object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                            <div className="bg-black/50 rounded-full p-2">
                              <Video className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Like/Dislike Buttons */}
                <div className="flex items-center gap-4 text-xs pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!productId || !productQueryKey) return
                      try {
                        const response = await likeReview.mutateAsync({
                          productId,
                          reviewId: selectedReview._id,
                          productQueryKey,
                        })
                        // Update the selected review state
                        setSelectedReview({
                          ...selectedReview,
                          likes: response.likes,
                          dislikes: response.dislikes,
                          hasLiked: response.hasLiked,
                          hasDisliked: response.hasDisliked,
                        })
                        // Store anonymous state in localStorage
                        if (!isAuthenticated && typeof window !== 'undefined') {
                          const key = `review_${selectedReview._id}_anonymous`
                          localStorage.setItem(
                            key,
                            JSON.stringify({
                              hasLiked: response.hasLiked,
                              hasDisliked: response.hasDisliked,
                            }),
                          )
                        }
                      } catch (error) {
                        console.error('Failed to like review:', error)
                        toast.error('Failed to update like. Please try again.')
                      }
                    }}
                    disabled={likeReview.isPending || dislikeReview.isPending}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
                      selectedReview.hasLiked
                        ? 'text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                    )}
                  >
                    <ThumbsUp
                      className={cn('w-4 h-4', selectedReview.hasLiked && 'fill-current')}
                    />
                    <span className="font-medium">{selectedReview.likes ?? 0}</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!productId || !productQueryKey) return
                      try {
                        const response = await dislikeReview.mutateAsync({
                          productId,
                          reviewId: selectedReview._id,
                          productQueryKey,
                        })
                        // Update the selected review state
                        setSelectedReview({
                          ...selectedReview,
                          likes: response.likes,
                          dislikes: response.dislikes,
                          hasLiked: response.hasLiked,
                          hasDisliked: response.hasDisliked,
                        })
                        // Store anonymous state in localStorage
                        if (!isAuthenticated && typeof window !== 'undefined') {
                          const key = `review_${selectedReview._id}_anonymous`
                          localStorage.setItem(
                            key,
                            JSON.stringify({
                              hasLiked: response.hasLiked,
                              hasDisliked: response.hasDisliked,
                            }),
                          )
                        }
                      } catch (error) {
                        console.error('Failed to dislike review:', error)
                        toast.error('Failed to update dislike. Please try again.')
                      }
                    }}
                    disabled={likeReview.isPending || dislikeReview.isPending}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
                      selectedReview.hasDisliked
                        ? 'text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
                    )}
                  >
                    <ThumbsDown
                      className={cn('w-4 h-4', selectedReview.hasDisliked && 'fill-current')}
                    />
                    <span className="font-medium">{selectedReview.dislikes ?? 0}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

const ReviewCard: React.FC<{
  review: ProductReview
  onImageClick?: (review: ProductReview, imageUrl: string) => void
  onVideoClick?: (review: ProductReview, videoUrl: string) => void
  productId?: string
  productQueryKey?: string
  isAuthenticated?: boolean
  onRequestLogin?: () => void
}> = ({
  review,
  onImageClick,
  onVideoClick,
  productId,
  productQueryKey,
  isAuthenticated,
  onRequestLogin, // Available for future use when implementing login prompt for like/dislike
}) => {
  // Note: onRequestLogin is available but not currently used in ReviewCard
  // It can be used in the future to prompt login when unauthenticated users try to like/dislike
  void onRequestLogin // Suppress unused variable warning
  const likeReview = useLikeReview()
  const dislikeReview = useDislikeReview()

  // Get anonymous like/dislike state from localStorage
  const getAnonymousState = useCallback(() => {
    if (typeof window === 'undefined') return { hasLiked: false, hasDisliked: false }
    const key = `review_${review._id}_anonymous`
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch {
        return { hasLiked: false, hasDisliked: false }
      }
    }
    return { hasLiked: false, hasDisliked: false }
  }, [review._id])

  const [localLikes, setLocalLikes] = useState(review.likes ?? 0)
  const [localDislikes, setLocalDislikes] = useState(review.dislikes ?? 0)
  const anonymousState = getAnonymousState()
  const [localHasLiked, setLocalHasLiked] = useState(
    isAuthenticated ? review.hasLiked ?? false : anonymousState.hasLiked,
  )
  const [localHasDisliked, setLocalHasDisliked] = useState(
    isAuthenticated ? review.hasDisliked ?? false : anonymousState.hasDisliked,
  )

  // Update local state when review prop changes
  useEffect(() => {
    setLocalLikes(review.likes ?? 0)
    setLocalDislikes(review.dislikes ?? 0)
    if (isAuthenticated) {
      setLocalHasLiked(review.hasLiked ?? false)
      setLocalHasDisliked(review.hasDisliked ?? false)
    } else {
      const anonState = getAnonymousState()
      setLocalHasLiked(anonState.hasLiked)
      setLocalHasDisliked(anonState.hasDisliked)
    }
  }, [
    review.likes,
    review.dislikes,
    review.hasLiked,
    review.hasDisliked,
    isAuthenticated,
    getAnonymousState,
  ])

  const handleLike = async () => {
    if (!productId || !productQueryKey) return

    try {
      const response = await likeReview.mutateAsync({
        productId,
        reviewId: review._id,
        productQueryKey,
      })
      setLocalLikes(response.likes)
      setLocalDislikes(response.dislikes)
      setLocalHasLiked(response.hasLiked)
      setLocalHasDisliked(response.hasDisliked)

      // Store anonymous state in localStorage
      if (!isAuthenticated && typeof window !== 'undefined') {
        const key = `review_${review._id}_anonymous`
        localStorage.setItem(
          key,
          JSON.stringify({
            hasLiked: response.hasLiked,
            hasDisliked: response.hasDisliked,
          }),
        )
      }
    } catch (error) {
      console.error('Failed to like review:', error)
      toast.error('Failed to update like. Please try again.')
    }
  }

  const handleDislike = async () => {
    if (!productId || !productQueryKey) return

    try {
      const response = await dislikeReview.mutateAsync({
        productId,
        reviewId: review._id,
        productQueryKey,
      })
      setLocalLikes(response.likes)
      setLocalDislikes(response.dislikes)
      setLocalHasLiked(response.hasLiked)
      setLocalHasDisliked(response.hasDisliked)

      // Store anonymous state in localStorage
      if (!isAuthenticated && typeof window !== 'undefined') {
        const key = `review_${review._id}_anonymous`
        localStorage.setItem(
          key,
          JSON.stringify({
            hasLiked: response.hasLiked,
            hasDisliked: response.hasDisliked,
          }),
        )
      }
    } catch (error) {
      console.error('Failed to dislike review:', error)
      toast.error('Failed to update dislike. Please try again.')
    }
  }
  const initials = review.reviewer?.name
    ? review.reviewer.name
        .split(' ')
        .map((part) => part.charAt(0))
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U'

  const locationLabel = [review.reviewer?.city, review.reviewer?.state].filter(Boolean).join(', ')
  const locationText = locationLabel || 'India'

  // Format date like "Reviewed in India on 17 July 2025"
  const formatReviewDate = (dateString: string) => {
    const date = new Date(dateString)
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    const day = date.getDate()
    const month = months[date.getMonth()]
    const year = date.getFullYear()
    return `Reviewed in ${locationText} on ${day} ${month} ${year}`
  }

  return (
    <div
      id={`review-${review._id}`}
      className="rounded-xl sm:rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 space-y-3 sm:space-y-4 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 border-2 border-gray-200 shrink-0 shadow-sm">
          {review.reviewer?.avatarUrl ? (
            <AvatarImage src={review.reviewer.avatarUrl} alt={review.reviewer.name} />
          ) : null}
          <AvatarFallback className="text-sm font-semibold bg-gray-100 text-gray-700">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-gray-900">
              {review.reviewer?.name ?? 'Amazon Customer'}
            </p>
          </div>
          {/* Star Rating */}
          <div className="flex items-center gap-1 mb-1">
            <Rating
              value={review.rating}
              readOnly
              className="flex items-center [&>button>svg]:text-gray-300 [&>button>svg[class*='fill-current']]:text-yellow-500"
            >
              <RatingButton className="text-yellow-500" size={16} />
              <RatingButton className="text-yellow-500" size={16} />
              <RatingButton className="text-yellow-500" size={16} />
              <RatingButton className="text-yellow-500" size={16} />
              <RatingButton className="text-yellow-500" size={16} />
            </Rating>
          </div>
          {/* Review Title */}
          {review.title && (
            <h3 className="text-base font-semibold text-gray-900 mb-1">{review.title}</h3>
          )}
          {/* Date and Verified Purchase */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-2">
            <span>{formatReviewDate(review.createdAt)}</span>
            {review.isVerifiedPurchase && (
              <>
                <span className="text-gray-400">•</span>
                <span className="text-emerald-600 font-medium">Verified Purchase</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Review Text */}
      <p className="text-sm leading-relaxed text-gray-700">{review.comment}</p>

      {/* Review Images */}
      {review.images && review.images.length > 0 && (
        <div className="flex flex-wrap gap-2 sm:gap-2.5">
          {review.images.map((image, index) => (
            <img
              key={`${review._id}-image-${index}`}
              src={image}
              alt={review.title ?? `Customer photo ${index + 1}`}
              className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg sm:rounded-xl border border-gray-200 cursor-pointer hover:opacity-90 hover:border-gray-300 hover:shadow-md transition-all shadow-sm"
              loading="lazy"
              onClick={() => onImageClick?.(review, image)}
            />
          ))}
        </div>
      )}

      {/* Review Videos */}
      {review.videos && review.videos.length > 0 && (
        <div className="flex flex-wrap gap-2 sm:gap-2.5">
          {review.videos.map((videoUrl, index) => (
            <video
              key={`${review._id}-video-${index}`}
              controls
              className="h-24 w-40 sm:h-28 sm:w-48 rounded-lg sm:rounded-xl border border-gray-200 bg-black object-cover shadow-sm cursor-pointer hover:opacity-90 hover:shadow-md transition-all"
              onClick={() => onVideoClick?.(review, videoUrl)}
            >
              <source src={videoUrl} />
              Your browser does not support the video tag.
            </video>
          ))}
        </div>
      )}

      {/* Like/Dislike Buttons */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs pt-2 sm:pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={handleLike}
          disabled={likeReview.isPending || dislikeReview.isPending}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
            localHasLiked
              ? 'text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
          )}
        >
          <ThumbsUp className={cn('w-4 h-4', localHasLiked && 'fill-current')} />
          <span className="font-medium">{localLikes}</span>
        </button>
        <button
          type="button"
          onClick={handleDislike}
          disabled={likeReview.isPending || dislikeReview.isPending}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
            localHasDisliked
              ? 'text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50',
          )}
        >
          <ThumbsDown className={cn('w-4 h-4', localHasDisliked && 'fill-current')} />
          <span className="font-medium">{localDislikes}</span>
        </button>
      </div>
    </div>
  )
}

const EmptyState: React.FC<{ message: string; onWriteReview?: () => void; disabled?: boolean }> = ({
  message,
  onWriteReview,
  disabled,
}) => (
  <div className="rounded-xl sm:rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-6 sm:p-8 text-center space-y-2 sm:space-y-3">
    <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-gray-300" />
    <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">{message}</p>
    <Button
      variant="outline"
      size="sm"
      className="rounded-full text-xs sm:text-sm"
      onClick={onWriteReview}
      disabled={disabled}
    >
      Write a review
    </Button>
  </div>
)

export default ProductReviewsSection
