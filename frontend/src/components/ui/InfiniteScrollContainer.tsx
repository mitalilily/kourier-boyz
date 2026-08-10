import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import * as React from 'react'

export interface InfiniteScrollContainerProps {
  children: React.ReactNode
  isFetchingNextPage?: boolean
  hasNextPage?: boolean
  onLoadMore?: () => void
  threshold?: number
  height?: string
  maxHeight?: string
  /** Classes for the outer scroll container */
  className?: string
  /** Classes for the inner content wrapper (applies to children) */
  contentClassName?: string
  loadingIndicator?: React.ReactNode
  endIndicator?: React.ReactNode
  showLoadingIndicator?: boolean
  showEndIndicator?: boolean
  id?: string
  /**
   * Whether to use IntersectionObserver to auto-load more when the sentinel comes into view.
   * Disable this if it causes all pages to load immediately on mount.
   */
  useIntersectionObserver?: boolean
}

const DefaultLoadingIndicator = () => (
  <div className="flex items-center justify-center py-4 gap-2">
    <Loader2 className="h-5 w-5 animate-spin text-primary" />
    <span className="text-sm text-muted-foreground">Loading more...</span>
  </div>
)

const DefaultEndIndicator = () => (
  <div className="flex items-center justify-center py-4">
    <span className="text-sm text-muted-foreground">No more items to load</span>
  </div>
)

export const InfiniteScrollContainer = React.forwardRef<
  HTMLDivElement,
  InfiniteScrollContainerProps
>(
  (
    {
      children,
      isFetchingNextPage = false,
      hasNextPage = false,
      onLoadMore,
      threshold = 200,
      height,
      maxHeight,
      className,
      contentClassName,
      loadingIndicator,
      endIndicator,
      showLoadingIndicator = true,
      showEndIndicator = true,
      id,
      useIntersectionObserver = true,
    },
    ref,
  ) => {
    const internalRef = React.useRef<HTMLDivElement>(null)
    const scrollRef = (ref as React.RefObject<HTMLDivElement>) || internalRef

    // Handle scroll events
    const handleScroll = React.useCallback(
      (event: React.UIEvent<HTMLDivElement>) => {
        if (!onLoadMore || isFetchingNextPage || !hasNextPage) return

        const target = event.currentTarget
        const { scrollTop, scrollHeight, clientHeight } = target
        const distanceFromBottom = scrollHeight - scrollTop - clientHeight

        if (distanceFromBottom < threshold) {
          onLoadMore()
        }
      },
      [onLoadMore, isFetchingNextPage, hasNextPage, threshold],
    )

    // Intersection Observer for better performance
    const observerRef = React.useRef<IntersectionObserver | null>(null)
    const sentinelRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      if (!onLoadMore || !hasNextPage || !useIntersectionObserver) return

      const sentinel = sentinelRef.current
      if (!sentinel) return

      observerRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries
          if (entry.isIntersecting && !isFetchingNextPage && hasNextPage) {
            onLoadMore()
          }
        },
        {
          root: scrollRef.current,
          rootMargin: `0px 0px ${threshold}px 0px`,
          threshold: 0,
        },
      )

      observerRef.current.observe(sentinel)

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect()
        }
      }
    }, [onLoadMore, hasNextPage, isFetchingNextPage, threshold, scrollRef, useIntersectionObserver])

    const containerStyle: React.CSSProperties = {
      ...(height && { height }),
      ...(maxHeight && { maxHeight }),
      overflow: 'auto',
    }

    return (
      <div
        id={id}
        ref={scrollRef}
        className={cn('relative overflow-auto', className)}
        style={containerStyle}
        onScroll={handleScroll}
      >
        <div className={cn('w-full', contentClassName)}>
          {children}

          {/* Sentinel element for intersection observer */}
          <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />

          {/* Loading indicator */}
          {showLoadingIndicator &&
            isFetchingNextPage &&
            (loadingIndicator || <DefaultLoadingIndicator />)}

          {/* End of list indicator */}
          {showEndIndicator &&
            !hasNextPage &&
            !isFetchingNextPage &&
            (endIndicator || <DefaultEndIndicator />)}
        </div>
      </div>
    )
  },
)

InfiniteScrollContainer.displayName = 'InfiniteScrollContainer'

export default InfiniteScrollContainer
