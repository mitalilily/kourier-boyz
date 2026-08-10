import { Copy, Facebook, Linkedin, Mail, MessageCircle, Share2, Twitter } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface ShareButtonProps {
  url: string
  title: string
  description?: string
  shareText?: string // Custom text for WhatsApp/Twitter
  image?: string // Image URL for sharing (OG image)
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  iconClassName?: string
  buttonStyle?: React.CSSProperties
  iconStyle?: React.CSSProperties
  triggerButton?: React.ReactNode
  showLabel?: boolean // Show "Share Store" or "Share Product" label
}

export const ShareButton = ({
  url,
  title,
  description,
  shareText,
  image, // Image URL - used for OG tags (handled by ProductSEO component)
  variant = 'ghost',
  size = 'icon',
  className,
  iconClassName,
  buttonStyle,
  iconStyle,
  triggerButton,
  showLabel = true,
}: ShareButtonProps) => {
  // Note: image parameter is for OG tags (handled by ProductSEO)
  // Social platforms (Facebook, Twitter, LinkedIn, WhatsApp) fetch images via OG tags
  // The image is not directly used in share URLs, but ensures OG tags are set correctly
  void image // Suppress unused variable warning - image is used for OG tags via ProductSEO
  const handleShare = async (platform: string) => {
    const encodedUrl = encodeURIComponent(url)
    const defaultText = shareText || description || `${title} - Check it out on Kourier Boyz! ${url}`
    const encodedText = encodeURIComponent(defaultText)
    const emailSubject = title.includes('Store') ? title : `Check out ${title} on Kourier Boyz`
    const emailBody = description
      ? `${description}\n\n${url}`
      : `I found this on Kourier Boyz: ${title}\n\n${url}`

    switch (platform) {
      case 'whatsapp': {
        // WhatsApp supports text and URL, image is handled via OG tags
        window.open(
          `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
          '_blank',
          'noopener,noreferrer',
        )
        break
      }
      case 'facebook': {
        // Facebook uses OG tags from the page, but we can include URL
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          '_blank',
          'noopener,noreferrer',
        )
        break
      }
      case 'twitter': {
        // Twitter supports text, URL, and image (via card parameter)
        const twitterText = shareText || `${title} - Check it out!`
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          twitterText,
        )}&url=${encodedUrl}`
        window.open(twitterUrl, '_blank', 'noopener,noreferrer')
        break
      }
      case 'linkedin':
        // LinkedIn uses OG tags from the page
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
          '_blank',
          'noopener,noreferrer',
        )
        break
      case 'email':
        window.open(
          `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(
            emailBody,
          )}`,
        )
        break
      case 'copy':
        try {
          await navigator.clipboard.writeText(url)
          toast.success('Link copied to clipboard!')
        } catch {
          toast.error('Failed to copy link')
        }
        break
      case 'native': {
        if (navigator.share) {
          try {
            // Note: Web Share API uses OG tags from the shared URL for images
            // The image parameter is used for OG tags on the page itself
            const shareData: ShareData = {
              title,
              text: description || defaultText,
              url,
            }
            await navigator.share(shareData)
            toast.success('Shared successfully!')
          } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
              toast.error('Failed to share')
            }
          }
        }
        break
      }
    }
  }

  const defaultTrigger = (
    <Button
      variant={variant}
      size={size}
      className={className}
      style={buttonStyle}
      title={`Share ${title}`}
    >
      <Share2 className={iconClassName} style={iconStyle} />
    </Button>
  )

  return (
    <Popover>
      <PopoverTrigger asChild>{triggerButton || defaultTrigger}</PopoverTrigger>
      <PopoverContent className="w-72 p-3 rounded-xl" align="end">
        <div className="space-y-3">
          {showLabel && (
            <div className="pb-2 border-b">
              <h3 className="font-semibold text-base mb-0.5">Share {title}</h3>
              {description && <p className="text-xs text-gray-500">{description}</p>}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {/* WhatsApp */}
            <Button
              variant="outline"
              onClick={() => handleShare('whatsapp')}
              className="flex flex-col items-center gap-1.5 p-2.5 h-auto hover:bg-green-50 hover:border-green-300 transition-colors rounded-lg"
            >
              <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium">WhatsApp</span>
            </Button>

            {/* Facebook */}
            <Button
              variant="outline"
              onClick={() => handleShare('facebook')}
              className="flex flex-col items-center gap-1.5 p-2.5 h-auto hover:bg-blue-50 hover:border-blue-300 transition-colors rounded-lg"
            >
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
                <Facebook className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium">Facebook</span>
            </Button>

            {/* Twitter */}
            <Button
              variant="outline"
              onClick={() => handleShare('twitter')}
              className="flex flex-col items-center gap-1.5 p-2.5 h-auto hover:bg-sky-50 hover:border-sky-300 transition-colors rounded-lg"
            >
              <div className="w-9 h-9 rounded-full bg-sky-500 flex items-center justify-center">
                <Twitter className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium">Twitter</span>
            </Button>

            {/* LinkedIn */}
            <Button
              variant="outline"
              onClick={() => handleShare('linkedin')}
              className="flex flex-col items-center gap-1.5 p-2.5 h-auto hover:bg-blue-50 hover:border-blue-300 transition-colors rounded-lg"
            >
              <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center">
                <Linkedin className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium">LinkedIn</span>
            </Button>

            {/* Email */}
            <Button
              variant="outline"
              onClick={() => handleShare('email')}
              className="flex flex-col items-center gap-1.5 p-2.5 h-auto hover:bg-gray-50 hover:border-gray-300 transition-colors rounded-lg"
            >
              <div className="w-9 h-9 rounded-full bg-gray-600 flex items-center justify-center">
                <Mail className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-medium">Email</span>
            </Button>

            {/* Copy Link */}
            <Button
              variant="outline"
              onClick={() => handleShare('copy')}
              className="flex flex-col items-center gap-1.5 p-2.5 h-auto hover:bg-gray-50 hover:border-gray-300 transition-colors rounded-lg"
            >
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                <Copy className="w-4 h-4 text-gray-700" />
              </div>
              <span className="text-xs font-medium">Copy</span>
            </Button>
          </div>

          {/* Native Share (Mobile) */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <Button
              variant="outline"
              onClick={() => handleShare('native')}
              className="w-full flex items-center justify-center gap-2 p-2.5 h-auto hover:bg-purple-50 hover:border-purple-300 transition-colors rounded-lg"
            >
              <Share2 className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium">More Options</span>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
