import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type GalleryMedia = {
  type: 'image' | 'video'
  url: string
}

interface ProductGalleryProps {
  galleryImages: string[];
  galleryVideos?: string[];
  onImageSelect: (image: string) => void;
  productName: string;
  selectedImage: string | null;
  onZoomChange?: (zoomState: {
    isHovering: boolean;
    zoomPosition: { x: number; y: number };
    selectedImage: string | null;
  }) => void;
}

const ProductGallery: React.FC<ProductGalleryProps> = ({
  galleryImages,
  galleryVideos = [],
  onImageSelect,
  productName,
  selectedImage,
  onZoomChange,
}) => {
  // Create unified media array (images + videos)
  const galleryMedia: GalleryMedia[] = useMemo(() => {
    const media: GalleryMedia[] = []
    galleryImages.forEach((url) => media.push({ type: 'image', url }))
    galleryVideos.forEach((url) => media.push({ type: 'video', url }))
    return media
  }, [galleryImages, galleryVideos])

  const isVideo = useCallback((url: string) => {
    return galleryVideos.includes(url)
  }, [galleryVideos])

  const isMediaVideo = useMemo(() => {
    return selectedImage ? isVideo(selectedImage) : false
  }, [selectedImage, isVideo])
  const [isHovering, setIsHovering] = useState(false);
  const [lensPosition, setLensPosition] = useState({ x: 0, y: 0 });
  const [showLens, setShowLens] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [imageError, setImageError] = useState<Record<string, boolean>>({});
  const [thumbnailScrollPosition, setThumbnailScrollPosition] = useState(0);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenPan, setFullscreenPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  const mobileThumbnailRef = useRef<HTMLDivElement>(null);
  const fullscreenImageRef = useRef<HTMLDivElement>(null);
  const fullscreenThumbnailRef = useRef<HTMLDivElement>(null);

  const ZOOM_FACTOR = 2.5;
  const LENS_SIZE = 150;

  // Get current media index
  const currentMediaIndex = selectedImage
    ? galleryMedia.findIndex((media) => media.url === selectedImage)
    : -1;
  const hasNext = currentMediaIndex < galleryMedia.length - 1;
  const hasPrev = currentMediaIndex > 0;

  const handleNext = useCallback(() => {
    if (hasNext && galleryMedia[currentMediaIndex + 1]) {
      onImageSelect(galleryMedia[currentMediaIndex + 1].url);
    }
  }, [hasNext, currentMediaIndex, galleryMedia, onImageSelect]);

  const handlePrevious = useCallback(() => {
    if (hasPrev && galleryMedia[currentMediaIndex - 1]) {
      onImageSelect(galleryMedia[currentMediaIndex - 1].url);
    }
  }, [hasPrev, currentMediaIndex, galleryMedia, onImageSelect]);

  // Mobile swipe handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && hasNext) {
      handleNext();
    }
    if (isRightSwipe && hasPrev) {
      handlePrevious();
    }
  };

  // Preload images
  useEffect(() => {
    galleryImages.forEach((image) => {
      const img = new Image();
      img.src = image;
      img.onload = () => {
        setImageLoading((prev) => ({ ...prev, [image]: false }));
      };
      img.onerror = () => {
        setImageLoading((prev) => ({ ...prev, [image]: false }));
        setImageError((prev) => ({ ...prev, [image]: true }));
      };
      setImageLoading((prev) => ({ ...prev, [image]: true }));
    });
  }, [galleryImages]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isFullscreen) {
        if (e.key === "ArrowLeft" && hasPrev) {
          handlePrevious();
        } else if (e.key === "ArrowRight" && hasNext) {
          handleNext();
        } else if (e.key === "Escape") {
          setIsFullscreen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [isFullscreen, hasNext, hasPrev, handleNext, handlePrevious]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Disable zoom on mobile
    if (isMobile) return;
    if (!imageContainerRef.current || !selectedImage) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate lens position (centered on cursor, but constrained to image bounds)
    const lensX = Math.max(
      0,
      Math.min(x - LENS_SIZE / 2, rect.width - LENS_SIZE)
    );
    const lensY = Math.max(
      0,
      Math.min(y - LENS_SIZE / 2, rect.height - LENS_SIZE)
    );

    // Calculate zoom position: show the area under the lens in the zoomed view
    const zoomX = -(lensX * ZOOM_FACTOR);
    const zoomY = -(lensY * ZOOM_FACTOR);

    setLensPosition({ x: lensX, y: lensY });

    // Notify parent of zoom state change
    if (onZoomChange) {
      onZoomChange({
        isHovering: true,
        zoomPosition: { x: zoomX, y: zoomY },
        selectedImage,
      });
    }
  };

  const handleMouseEnter = () => {
    // Disable zoom on mobile
    if (isMobile) return;
    setIsHovering(true);
    setShowLens(true);
    if (onZoomChange && selectedImage) {
      onZoomChange({
        isHovering: true,
        zoomPosition: { x: 0, y: 0 },
        selectedImage,
      });
    }
  };

  const handleMouseLeave = () => {
    // Disable zoom on mobile
    if (isMobile) return;
    setIsHovering(false);
    setShowLens(false);
    if (onZoomChange) {
      onZoomChange({
        isHovering: false,
        zoomPosition: { x: 0, y: 0 },
        selectedImage: null,
      });
    }
  };

  const handleThumbnailScroll = (direction: "up" | "down") => {
    if (!thumbnailContainerRef.current) return;

    const container = thumbnailContainerRef.current;
    const scrollAmount = 200;
    const newPosition =
      direction === "up"
        ? thumbnailScrollPosition - scrollAmount
        : thumbnailScrollPosition + scrollAmount;

    container.scrollTo({
      top: newPosition,
      behavior: "smooth",
    });
    setThumbnailScrollPosition(newPosition);
  };

  const scrollToThumbnail = (index: number) => {
    if (!thumbnailContainerRef.current) return;

    const container = thumbnailContainerRef.current;
    const thumbnailHeight = 88; // w-20 + gap-3 = 80px + 8px
    const scrollPosition =
      index * thumbnailHeight -
      container.clientHeight / 2 +
      thumbnailHeight / 2;

    container.scrollTo({
      top: Math.max(0, scrollPosition),
      behavior: "smooth",
    });
  };

  // Scroll to active thumbnail when media changes
  useEffect(() => {
    if (currentMediaIndex >= 0) {
      if (!isMobile) {
        scrollToThumbnail(currentMediaIndex);
      } else if (mobileThumbnailRef.current) {
        // Scroll mobile thumbnails horizontally
        const container = mobileThumbnailRef.current;
        const thumbnailWidth = 80; // w-20 = 80px
        const gap = 12; // gap-3 = 12px
        const scrollPosition =
          currentMediaIndex * (thumbnailWidth + gap) -
          container.clientWidth / 2 +
          thumbnailWidth / 2;
        container.scrollTo({
          left: Math.max(0, scrollPosition),
          behavior: "smooth",
        });
      }
    }
  }, [currentMediaIndex, isMobile]);

  // Reset zoom when fullscreen opens or image changes
  useEffect(() => {
    if (isFullscreen) {
      setFullscreenZoom(1);
      setFullscreenPan({ x: 0, y: 0 });
    }
  }, [isFullscreen, selectedImage]);

  // Fullscreen zoom handlers
  const handleFullscreenZoom = (delta: number) => {
    setFullscreenZoom((prev) => {
      const newZoom = Math.max(1, Math.min(5, prev + delta));
      return newZoom;
    });
  };

  const handleFullscreenWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleFullscreenZoom(delta);
  };

  // Fullscreen pan handlers
  const handleFullscreenMouseDown = (e: React.MouseEvent) => {
    if (fullscreenZoom > 1) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX - fullscreenPan.x,
        y: e.clientY - fullscreenPan.y,
      });
    }
  };

  const handleFullscreenMouseMove = (e: React.MouseEvent) => {
    if (isPanning && fullscreenZoom > 1) {
      setFullscreenPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleFullscreenMouseUp = () => {
    setIsPanning(false);
  };

  // Scroll fullscreen thumbnails
  const handleFullscreenThumbnailScroll = (direction: "left" | "right") => {
    if (!fullscreenThumbnailRef.current) return;
    const container = fullscreenThumbnailRef.current;
    const scrollAmount = 200;
    const currentScroll = container.scrollLeft;
    const newPosition =
      direction === "left"
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount;

    container.scrollTo({
      left: newPosition,
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className="rounded-2xl sm:rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4 sm:p-6 lg:p-8">
          {isMobile ? (
            /* Mobile Layout: Full-width image with bottom thumbnails */
            <div className="space-y-4">
              {/* Main image - Full width, swipeable */}
              <div
                ref={imageContainerRef}
                className="relative w-full aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100/50 shadow-lg"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {selectedImage ? (
                  <>
                    {/* Loading state */}
                    {imageLoading[selectedImage] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                      </div>
                    )}

                    {/* Error state */}
                    {imageError[selectedImage] ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 p-4">
                        <AlertCircle className="w-12 h-12 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500 text-center">
                          Failed to load {isMediaVideo ? 'video' : 'image'}
                        </p>
                      </div>
                    ) : isMediaVideo ? (
                      <video
                        src={selectedImage}
                        controls
                        className="absolute inset-0 w-full h-full object-contain"
                        style={{ objectFit: "contain" }}
                        onLoadedData={() =>
                          setImageLoading((prev) => ({
                            ...prev,
                            [selectedImage]: false,
                          }))
                        }
                        onError={() => {
                          setImageLoading((prev) => ({
                            ...prev,
                            [selectedImage]: false,
                          }));
                          setImageError((prev) => ({
                            ...prev,
                            [selectedImage]: true,
                          }));
                        }}
                      />
                    ) : (
                      <img
                        src={selectedImage}
                        alt={productName}
                        className={cn(
                          "absolute inset-0 w-full h-full object-contain transition-opacity duration-300",
                          imageLoading[selectedImage]
                            ? "opacity-0"
                            : "opacity-100"
                        )}
                        style={{ objectFit: "contain" }}
                        onLoad={() =>
                          setImageLoading((prev) => ({
                            ...prev,
                            [selectedImage]: false,
                          }))
                        }
                        onError={() => {
                          setImageLoading((prev) => ({
                            ...prev,
                            [selectedImage]: false,
                          }));
                          setImageError((prev) => ({
                            ...prev,
                            [selectedImage]: true,
                          }));
                        }}
                      />
                    )}

                    {/* Mobile Navigation Arrows - Always visible */}
                    {galleryMedia.length > 1 && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className={cn(
                            "absolute left-2 top-1/2 -translate-y-1/2 z-30 bg-white/95 backdrop-blur-md shadow-xl border-gray-300 hover:bg-white h-10 w-10",
                            !hasPrev && "opacity-50 cursor-not-allowed"
                          )}
                          onClick={handlePrevious}
                          disabled={!hasPrev}
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon"
                          className={cn(
                            "absolute right-2 top-1/2 -translate-y-1/2 z-30 bg-white/95 backdrop-blur-md shadow-xl border-gray-300 hover:bg-white h-10 w-10",
                            !hasNext && "opacity-50 cursor-not-allowed"
                          )}
                          onClick={handleNext}
                          disabled={!hasNext}
                          aria-label="Next image"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </>
                    )}

                    {/* Media counter */}
                    {galleryMedia.length > 1 && (
                      <div className="absolute top-3 left-3 z-30 bg-black/70 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                        {currentMediaIndex + 1} / {galleryMedia.length}
                      </div>
                    )}

                    {/* Fullscreen button */}
                    <Button
                      variant="outline"
                      size="icon"
                      className="absolute bottom-3 right-3 z-30 bg-white/95 backdrop-blur-md shadow-xl border-gray-300 hover:bg-white h-10 w-10"
                      onClick={() => setIsFullscreen(true)}
                      aria-label="View fullscreen"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </>
                ) : null}
              </div>

              {/* Mobile Thumbnails - Horizontal scroll at bottom */}
              {galleryMedia.length > 1 && (
                <div className="w-full">
                  <div
                    ref={mobileThumbnailRef}
                    className="flex gap-3 overflow-x-auto scrollbar-hide pb-2"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {galleryMedia.map((media, index) => {
                      const isActive = selectedImage === media.url;
                      const isLoading = imageLoading[media.url];
                      const hasError = imageError[media.url];
                      const isMediaVideo = media.type === 'video';

                      return (
                        <button
                          key={media.url}
                          onClick={() => onImageSelect(media.url)}
                          className={cn(
                            "relative shrink-0 overflow-hidden rounded-lg border-2 cursor-pointer bg-white transition-all duration-300 shadow-sm",
                            isActive
                              ? "border-gray-900 ring-2 ring-gray-900/20 shadow-md scale-[1.05]"
                              : "border-gray-200 active:border-gray-400 active:shadow-md"
                          )}
                          aria-label={`View ${isMediaVideo ? 'video' : 'image'} ${index + 1}`}
                        >
                          {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                              <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                            </div>
                          )}
                          {hasError ? (
                            <div className="aspect-square w-20 h-20 flex items-center justify-center bg-gray-100">
                              <AlertCircle className="w-4 h-4 text-gray-400" />
                            </div>
                          ) : isMediaVideo ? (
                            <div className="relative aspect-square w-20 h-20">
                              <video
                                src={media.url}
                                className={cn(
                                  "aspect-square w-20 h-20 object-cover transition-opacity duration-200",
                                  isLoading ? "opacity-0" : "opacity-100"
                                )}
                                muted
                                playsInline
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <img
                              src={media.url}
                              alt={`Product thumbnail ${index + 1}`}
                              className={cn(
                                "aspect-square w-20 h-20 object-cover transition-opacity duration-200",
                                isLoading ? "opacity-0" : "opacity-100"
                              )}
                              loading="lazy"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Desktop Layout: Side thumbnails with zoom lens */
            <div className="flex gap-4 sm:gap-5">
              {/* Thumbnails on the left */}
              {galleryMedia.length > 1 && (
                <div className="relative shrink-0 flex flex-col">
                  {/* Scroll up button */}
                  {thumbnailScrollPosition > 0 && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="mx-auto mb-2 z-10 bg-white shadow-lg border-gray-300 hover:bg-gray-50 hover:shadow-xl transition-all duration-200 h-8 w-8"
                      onClick={() => handleThumbnailScroll("up")}
                      aria-label="Scroll thumbnails up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                  )}

                  <ScrollArea className="w-20 sm:w-24">
                    <div
                      ref={thumbnailContainerRef}
                      className="flex flex-col gap-3 pr-2 overflow-y-auto scrollbar-hide max-h-92 sm:max-h-112"
                      onScroll={(e) => {
                        setThumbnailScrollPosition(e.currentTarget.scrollTop);
                      }}
                    >
                      {galleryMedia.map((media, index) => {
                        const isActive = selectedImage === media.url;
                        const isLoading = imageLoading[media.url];
                        const hasError = imageError[media.url];
                        const isMediaVideo = media.type === 'video';

                        return (
                          <button
                            key={media.url}
                            onClick={() => onImageSelect(media.url)}
                            className={cn(
                              "relative shrink-0 overflow-hidden rounded-lg sm:rounded-xl border-2 cursor-pointer bg-white transition-all duration-300 shadow-sm group/thumb",
                              isActive
                                ? "border-gray-900 ring-2 ring-gray-900/20 shadow-md scale-[1.02]"
                                : "border-gray-200 hover:border-gray-400 hover:shadow-md"
                            )}
                            aria-label={`View ${isMediaVideo ? 'video' : 'image'} ${index + 1}`}
                          >
                            {isLoading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                                <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 animate-spin" />
                              </div>
                            )}
                            {hasError ? (
                              <div className="aspect-square w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-gray-100">
                                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                              </div>
                            ) : isMediaVideo ? (
                              <div className="relative aspect-square w-16 h-16 sm:w-20 sm:h-20">
                                <video
                                  src={media.url}
                                  className={cn(
                                    "aspect-square w-16 h-16 sm:w-20 sm:h-20 object-cover transition-opacity duration-200",
                                    isLoading ? "opacity-0" : "opacity-100"
                                  )}
                                  muted
                                  playsInline
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                            ) : (
                              <img
                                src={media.url}
                                alt={`Product thumbnail ${index + 1}`}
                                className={cn(
                                  "aspect-square w-16 h-16 sm:w-20 sm:h-20 object-cover transition-opacity duration-200",
                                  isLoading ? "opacity-0" : "opacity-100"
                                )}
                                loading="lazy"
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  {/* Scroll down button */}
                  {thumbnailContainerRef.current &&
                    thumbnailScrollPosition <
                      thumbnailContainerRef.current.scrollHeight -
                        thumbnailContainerRef.current.clientHeight && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="mx-auto mt-2 z-10 bg-white shadow-lg border-gray-300 hover:bg-gray-50 hover:shadow-xl transition-all duration-200 h-8 w-8"
                        onClick={() => handleThumbnailScroll("down")}
                        aria-label="Scroll thumbnails down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    )}
                </div>
              )}

              {/* Main image container */}
              <div className="flex-1 min-w-0">
                <div
                  ref={imageContainerRef}
                  className={cn(
                    "relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100/50 shadow-lg group w-full",
                    !isMediaVideo && "cursor-crosshair"
                  )}
                  onMouseMove={!isMediaVideo ? handleMouseMove : undefined}
                  onMouseEnter={!isMediaVideo ? handleMouseEnter : undefined}
                  onMouseLeave={!isMediaVideo ? handleMouseLeave : undefined}
                >
                  {selectedImage ? (
                    <>
                      {/* Loading state */}
                      {imageLoading[selectedImage] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                        </div>
                      )}

                      {/* Error state */}
                      {imageError[selectedImage] ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 p-4">
                          <AlertCircle className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500 text-center">
                            Failed to load {isMediaVideo ? 'video' : 'image'}
                          </p>
                        </div>
                      ) : isMediaVideo ? (
                        <video
                          src={selectedImage}
                          controls
                          className="absolute inset-0 w-full h-full object-contain"
                          style={{ objectFit: "contain" }}
                          onLoadedData={() =>
                            setImageLoading((prev) => ({
                              ...prev,
                              [selectedImage]: false,
                            }))
                          }
                          onError={() => {
                            setImageLoading((prev) => ({
                              ...prev,
                              [selectedImage]: false,
                            }));
                            setImageError((prev) => ({
                              ...prev,
                              [selectedImage]: true,
                            }));
                          }}
                        />
                      ) : (
                        <img
                          src={selectedImage}
                          alt={productName}
                          className={cn(
                            "absolute inset-0 w-full h-full object-contain transition-opacity duration-300",
                            imageLoading[selectedImage]
                              ? "opacity-0"
                              : "opacity-100"
                          )}
                          style={{ objectFit: "contain" }}
                          onLoad={() =>
                            setImageLoading((prev) => ({
                              ...prev,
                              [selectedImage]: false,
                            }))
                          }
                          onError={() => {
                            setImageLoading((prev) => ({
                              ...prev,
                              [selectedImage]: false,
                            }));
                            setImageError((prev) => ({
                              ...prev,
                              [selectedImage]: true,
                            }));
                          }}
                        />
                      )}

                      {/* Zoom lens indicator - Only show on desktop for images */}
                      {!isMobile &&
                        showLens &&
                        isHovering &&
                        !imageError[selectedImage] &&
                        !isMediaVideo && (
                          <div
                            ref={lensRef}
                            className="absolute pointer-events-none z-20 transition-opacity duration-150"
                            style={{
                              left: `${lensPosition.x}px`,
                              top: `${lensPosition.y}px`,
                              width: `${LENS_SIZE}px`,
                              height: `${LENS_SIZE}px`,
                              border: "2px solid rgba(59, 130, 246, 0.8)",
                              backgroundColor: "rgba(147, 197, 253, 0.2)",
                              boxShadow:
                                "0 0 0 1px rgba(59, 130, 246, 0.5), inset 0 0 0 1px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)",
                              backdropFilter: "blur(2px)",
                              borderRadius: "4px",
                            }}
                          />
                        )}

                      {/* Navigation buttons */}
                      {galleryMedia.length > 1 && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            className={cn(
                              "absolute left-3 top-1/2 -translate-y-1/2 z-30 bg-white/95 backdrop-blur-md shadow-xl border-gray-300 hover:bg-white hover:shadow-2xl transition-all duration-200",
                              !hasPrev && "opacity-0 pointer-events-none",
                              "opacity-0 group-hover:opacity-100"
                            )}
                            onClick={handlePrevious}
                            disabled={!hasPrev}
                            aria-label="Previous image"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            className={cn(
                              "absolute right-3 top-1/2 -translate-y-1/2 z-30 bg-white/95 backdrop-blur-md shadow-xl border-gray-300 hover:bg-white hover:shadow-2xl transition-all duration-200",
                              !hasNext && "opacity-0 pointer-events-none",
                              "opacity-0 group-hover:opacity-100"
                            )}
                            onClick={handleNext}
                            disabled={!hasNext}
                            aria-label="Next image"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                        </>
                      )}

                      {/* Action buttons - Fullscreen button always visible */}
                      <div className="absolute bottom-4 right-4 flex gap-2 z-30">
                        <Button
                          variant="outline"
                          size="icon"
                          className="bg-white/95 backdrop-blur-md shadow-xl border-gray-300 hover:bg-white hover:shadow-2xl transition-all duration-200"
                          onClick={() => setIsFullscreen(true)}
                          aria-label="View fullscreen"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Media counter */}
                      {galleryMedia.length > 1 && (
                        <div className="absolute top-4 left-4 z-30 bg-black/70 backdrop-blur-md text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg">
                          {currentMediaIndex + 1} / {galleryMedia.length}
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="fixed! inset-0! left-0! top-0! w-screen! h-screen! max-w-none! translate-x-0! translate-y-0! grid-cols-1! p-0 bg-black/95 border-none rounded-none">
          <div className="flex flex-col h-full">
            {/* Header with product name */}
            <DialogHeader className="px-6 py-4 border-b border-white/20 bg-black/80 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-white text-lg sm:text-xl font-semibold truncate pr-4">
                  {productName}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 rounded-full transition-all duration-200 shrink-0"
                  onClick={() => setIsFullscreen(false)}
                  aria-label="Close fullscreen"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
              </div>
            </DialogHeader>

            {/* Main content area with zoomable image */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center">
              {/* Zoom controls - Only show for images */}
              {!isMediaVideo && (
                <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-black/70 backdrop-blur-md text-white border-white/30 hover:bg-white/20 hover:border-white/40 transition-all duration-200 shadow-lg"
                    onClick={() => handleFullscreenZoom(0.5)}
                    disabled={fullscreenZoom >= 5}
                    aria-label="Zoom in"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-black/70 backdrop-blur-md text-white border-white/30 hover:bg-white/20 hover:border-white/40 transition-all duration-200 shadow-lg"
                    onClick={() => handleFullscreenZoom(-0.5)}
                    disabled={fullscreenZoom <= 1}
                    aria-label="Zoom out"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </Button>
                </div>
              )}

              {/* Navigation buttons */}
              {galleryMedia.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12",
                      !hasPrev && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={handlePrevious}
                    disabled={!hasPrev}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12",
                      !hasNext && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={handleNext}
                    disabled={!hasNext}
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>
                </>
              )}

              {/* Zoomable image container */}
              <div
                ref={fullscreenImageRef}
                className={cn(
                  "w-full h-full flex items-center justify-center overflow-hidden",
                  !isMediaVideo && "cursor-move"
                )}
                onWheel={!isMediaVideo ? handleFullscreenWheel : undefined}
                onMouseDown={!isMediaVideo ? handleFullscreenMouseDown : undefined}
                onMouseMove={!isMediaVideo ? handleFullscreenMouseMove : undefined}
                onMouseUp={!isMediaVideo ? handleFullscreenMouseUp : undefined}
                onMouseLeave={!isMediaVideo ? handleFullscreenMouseUp : undefined}
              >
                {selectedImage ? (
                  imageError[selectedImage] ? (
                    <div className="flex flex-col items-center justify-center text-white">
                      <AlertCircle className="w-16 h-16 mb-4" />
                      <p className="text-lg">Failed to load {isMediaVideo ? 'video' : 'image'}</p>
                    </div>
                  ) : isMediaVideo ? (
                    <div className="flex items-center justify-center w-full h-full">
                      {imageLoading[selectedImage] ? (
                        <div className="flex items-center justify-center w-[80vw] h-[60vh]">
                          <Loader2 className="w-12 h-12 text-white animate-spin" />
                        </div>
                      ) : (
                        <video
                          src={selectedImage}
                          controls
                          className="max-w-[90vw] max-h-[70vh] object-contain"
                          onLoadedData={() =>
                            setImageLoading((prev) => ({
                              ...prev,
                              [selectedImage]: false,
                            }))
                          }
                          onError={() => {
                            setImageLoading((prev) => ({
                              ...prev,
                              [selectedImage]: false,
                            }));
                            setImageError((prev) => ({
                              ...prev,
                              [selectedImage]: true,
                            }));
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <div
                      className="relative transition-transform duration-200"
                      style={{
                        transform: `scale(${fullscreenZoom}) translate(${
                          fullscreenPan.x / fullscreenZoom
                        }px, ${fullscreenPan.y / fullscreenZoom}px)`,
                        transformOrigin: "center center",
                      }}
                    >
                      {imageLoading[selectedImage] ? (
                        <div className="flex items-center justify-center w-[80vw] h-[60vh]">
                          <Loader2 className="w-12 h-12 text-white animate-spin" />
                        </div>
                      ) : (
                        <img
                          src={selectedImage}
                          alt={productName}
                          className="max-w-[90vw] max-h-[70vh] object-contain select-none"
                          draggable={false}
                        />
                      )}
                    </div>
                  )
                ) : null}
              </div>

              {/* Media counter */}
              {galleryMedia.length > 1 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/70 backdrop-blur-md text-white text-sm font-semibold px-4 py-2 rounded-full shadow-xl">
                  {currentMediaIndex + 1} / {galleryMedia.length}
                </div>
              )}
            </div>

            {/* Thumbnails section */}
            {galleryMedia.length > 1 && (
              <div className="border-t border-white/20 bg-black/60 backdrop-blur-md">
                <div className="relative px-4 py-4">
                  {/* Scroll left button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 rounded-full transition-all duration-200 h-8 w-8"
                    onClick={() => handleFullscreenThumbnailScroll("left")}
                    aria-label="Scroll thumbnails left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {/* Thumbnails container - shows max 5 thumbnails */}
                  <div className="max-w-md mx-auto">
                    <ScrollArea className="w-full">
                      <div
                        ref={fullscreenThumbnailRef}
                        className="flex gap-3 overflow-x-auto scrollbar-hide"
                        style={{
                          scrollbarWidth: "none",
                          msOverflowStyle: "none",
                        }}
                      >
                        {galleryMedia.map((media, index) => {
                          const isActive = selectedImage === media.url;
                          const isLoading = imageLoading[media.url];
                          const hasError = imageError[media.url];
                          const isMediaVideo = media.type === 'video';

                          return (
                            <button
                              key={media.url}
                              onClick={() => {
                                onImageSelect(media.url);
                                setFullscreenZoom(1);
                                setFullscreenPan({ x: 0, y: 0 });
                              }}
                              className={cn(
                                "relative shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300",
                                isActive
                                  ? "border-white ring-2 ring-white/60 scale-[1.05] shadow-lg"
                                  : "border-white/40 hover:border-white/70 hover:scale-[1.02] hover:shadow-md"
                              )}
                              aria-label={`View ${isMediaVideo ? 'video' : 'image'} ${index + 1}`}
                            >
                              {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                                </div>
                              )}
                              {hasError ? (
                                <div className="aspect-square w-20 h-20 flex items-center justify-center bg-gray-800">
                                  <AlertCircle className="w-5 h-5 text-white/50" />
                                </div>
                              ) : isMediaVideo ? (
                                <div className="relative aspect-square w-20 h-20">
                                  <video
                                    src={media.url}
                                    className={cn(
                                      "aspect-square w-20 h-20 object-cover transition-opacity duration-200",
                                      isLoading ? "opacity-0" : "opacity-100"
                                    )}
                                    muted
                                    playsInline
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M8 5v14l11-7z" />
                                    </svg>
                                  </div>
                                </div>
                              ) : (
                                <img
                                  src={media.url}
                                  alt={`Product thumbnail ${index + 1}`}
                                  className={cn(
                                    "aspect-square w-20 h-20 object-cover transition-opacity duration-200",
                                    isLoading ? "opacity-0" : "opacity-100"
                                  )}
                                  loading="lazy"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Scroll right button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 rounded-full transition-all duration-200 h-8 w-8"
                    onClick={() => handleFullscreenThumbnailScroll("right")}
                    aria-label="Scroll thumbnails right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Keyboard hint */}
            <div className="absolute bottom-4 right-4 z-50 text-white/60 text-xs hidden sm:block">
              Use arrow keys to navigate • {!isMediaVideo && 'Mouse wheel to zoom • '}ESC to close
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ZOOM_FACTOR = 2.5;

export default ProductGallery;
