import type { Seller } from '../../api/seller'
import type { ThemeConfig } from '../../utils/themes'

interface VideoSectionProps {
  seller: Seller
  theme: ThemeConfig | null
}

const getYouTubeVideoId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

const getVideoEmbedUrl = (videoUrl: string, autoplay = true) => {
  if (!videoUrl) return null
  const youtubeId = getYouTubeVideoId(videoUrl)
  if (youtubeId) {
    // For YouTube, add autoplay, mute, and loop parameters
    // Note: Mobile browsers typically don't allow autoplay with sound, so we use mute
    const params = new URLSearchParams()
    if (autoplay) {
      params.append('autoplay', '1')
      params.append('mute', '1')
      params.append('loop', '1')
      params.append('playlist', youtubeId) // Required for loop to work
      params.append('playsinline', '1') // Enable inline playback on mobile
      params.append('enablejsapi', '1') // Enable JS API for better mobile support
    }
    params.append('rel', '0') // Don't show related videos
    params.append('modestbranding', '1') // Minimal YouTube branding
    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`
  }
  // For Vimeo, extract video ID if needed
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) {
    const params = new URLSearchParams()
    if (autoplay) {
      params.append('autoplay', '1')
      params.append('muted', '1')
      params.append('loop', '1')
      params.append('playsinline', '1') // Enable inline playback on mobile
    }
    params.append('background', '0') // Better mobile support
    return `https://player.vimeo.com/video/${vimeoMatch[1]}?${params.toString()}`
  }
  return videoUrl
}

export const VideoSection = ({ seller, theme }: VideoSectionProps) => {
  if (!seller.storeVideo && !seller.storeVideoFile) return null

  return (
    <>
      <style>{`
        .video-responsive-container {
          position: relative;
          padding-bottom: 56.25%; /* 16:9 aspect ratio */
          height: 0;
          overflow: hidden;
        }
        .video-responsive-container iframe,
        .video-responsive-container video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        @media (min-width: 768px) {
          .video-responsive-container {
            padding-bottom: 35%;
          }
        }
      `}</style>
      <div className="mx-auto px-2 sm:px-4 mt-4 sm:mt-6" style={{ maxWidth: '1600px' }}>
        <div 
          className="relative w-full overflow-hidden group"
          style={{
            borderRadius: theme?.styles.borderRadius || '0.5rem',
            boxShadow: `0 8px 24px ${theme?.colors.primary || '#2563eb'}20`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = `0 12px 32px ${theme?.colors.primary || '#2563eb'}30`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = `0 8px 24px ${theme?.colors.primary || '#2563eb'}20`
          }}
        >
          {seller.storeVideoFile ? (
            // Uploaded video file
            <div className="relative w-full video-responsive-container">
              <video
                src={seller.storeVideoFile}
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                style={{
                  borderRadius: theme?.styles.borderRadius || '0.5rem',
                }}
                {...({
                  'webkit-playsinline': 'true',
                  'x5-playsinline': 'true',
                } as React.VideoHTMLAttributes<HTMLVideoElement>)}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : seller.storeVideo ? (
            // Video URL (YouTube, Vimeo, etc.)
            <div className="relative w-full video-responsive-container">
              <iframe
                src={getVideoEmbedUrl(seller.storeVideo, true) || ''}
                className="absolute top-0 left-0 w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
                style={{
                  borderRadius: theme?.styles.borderRadius || '0.5rem',
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                title="Store Introduction Video"
              />
            </div>
          ) : null}
          {/* Decorative border */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              borderRadius: theme?.styles.borderRadius || '0.5rem',
              border: `2px solid ${theme?.colors.primary || '#2563eb'}20`,
              boxShadow: `inset 0 0 20px ${theme?.colors.primary || '#2563eb'}10`,
            }}
          />
        </div>
      </div>
    </>
  )
}
