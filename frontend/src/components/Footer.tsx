import { useFooterSettings } from '@/api/footer'
import { useSubscribeNewsletter } from '@/api/subscribers'
import { useAuthStore } from '@/store/authStore'
import {
  ArrowRight,
  Facebook,
  Heart,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Twitter,
  Youtube,
} from 'lucide-react'
import React, { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ParallaxProvider } from 'react-scroll-parallax'
import { toast } from 'sonner'
import SectionBanner from './Home/SectionBanner'
import { BackgroundPaths } from './ui/background-paths'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Separator } from './ui/separator'

// Types
interface SocialLinkConfig {
  icon: React.ComponentType<{ className?: string }>
  label: string
  color: string
}

interface LinkSection {
  title: string
  links: Array<{ label: string; href: string }>
}

// Platform to icon/color mapping
const PLATFORM_CONFIG: Record<string, SocialLinkConfig> = {
  facebook: {
    icon: Facebook,
    label: 'Facebook',
    color: 'hover:bg-[#1877F2] hover:border-[#1877F2]',
  },
  twitter: {
    icon: Twitter,
    label: 'Twitter',
    color: 'hover:bg-[#1DA1F2] hover:border-[#1DA1F2]',
  },
  instagram: {
    icon: Instagram,
    label: 'Instagram',
    color:
      'hover:bg-linear-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCAF45] hover:border-transparent',
  },
  youtube: {
    icon: Youtube,
    label: 'YouTube',
    color: 'hover:bg-[#FF0000] hover:border-[#FF0000]',
  },
  linkedin: {
    icon: Linkedin,
    label: 'LinkedIn',
    color: 'hover:bg-[#0077B5] hover:border-[#0077B5]',
  },
  pinterest: {
    icon: Heart, // Using Heart as placeholder for Pinterest
    label: 'Pinterest',
    color: 'hover:bg-[#E60023] hover:border-[#E60023]',
  },
  tiktok: {
    icon: Heart, // Using Heart as placeholder for TikTok
    label: 'TikTok',
    color: 'hover:bg-[#000000] hover:border-[#000000]',
  },
  snapchat: {
    icon: Heart, // Using Heart as placeholder for Snapchat
    label: 'Snapchat',
    color: 'hover:bg-[#FFFC00] hover:border-[#FFFC00] hover:text-black',
  },
}

// Social Icon Component
interface SocialIconProps {
  platform: string
  url: string
}

const SocialIcon = memo(({ platform, url }: SocialIconProps) => {
  const config = PLATFORM_CONFIG[platform.toLowerCase()]
  if (!config) return null

  const IconComponent = config.icon

  return (
    <a
      href={url}
      aria-label={config.label}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        group relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 border-border bg-background/80 backdrop-blur-sm
        flex items-center justify-center transition-all duration-300
        ${config.color}
        hover:scale-110 hover:shadow-xl hover:-translate-y-0.5
      `}
    >
      <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground group-hover:text-white transition-colors duration-300 z-10" />
    </a>
  )
})
SocialIcon.displayName = 'SocialIcon'

// Footer Link Section Component
const FooterSection = memo(({ section }: { section: LinkSection }) => (
  <div className="space-y-4 sm:space-y-5">
    <h3 className="text-sm sm:text-base font-bold text-foreground uppercase tracking-wider">
      {section.title}
    </h3>
    <ul className="space-y-2.5 sm:space-y-3">
      {section.links.map((link) => (
        <li key={link.href}>
          <Link
            to={link.href}
            className="
              text-sm sm:text-base text-muted-foreground hover:text-foreground 
              transition-all duration-200 inline-flex items-center gap-2
              group py-1
            "
          >
            <span className="group-hover:translate-x-1 transition-transform duration-200">
              {link.label}
            </span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </Link>
        </li>
      ))}
    </ul>
  </div>
))
FooterSection.displayName = 'FooterSection'

// Contact Info Component
const ContactInfo = memo(() => {
  const { t } = useTranslation()
  const { data: footerResponse } = useFooterSettings()
  const footerData = footerResponse?.data

  const contactItems = useMemo(
    () => [
      {
        icon: Phone,
        content: footerData?.phone || t('footer.contactPhoneLabel'),
        href: footerData?.phone ? `tel:${footerData.phone.replace(/\s/g, '')}` : 'tel:+1234567890',
        label: 'Phone',
      },
      {
        icon: Mail,
        content: footerData?.email || t('footer.contactEmailLabel'),
        href: footerData?.email ? `mailto:${footerData.email}` : 'mailto:support@kourierboyz.com',
        label: 'Email',
      },
      {
        icon: MapPin,
        content: footerData?.address || t('footer.contactAddress'),
        href: '#',
        label: 'Address',
      },
    ],
    [t, footerData],
  )

  return (
    <div className="space-y-3 sm:space-y-4">
      {contactItems.map((item) => {
        const Icon = item.icon
        const isLink = item.href !== '#'
        const Component = isLink ? 'a' : 'div'

        return (
          <Component
            key={item.label}
            href={isLink ? item.href : undefined}
            className={`
              flex items-start gap-3 sm:gap-4 group transition-all duration-200
              ${isLink ? 'hover:text-foreground cursor-pointer' : ''}
            `}
          >
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-200 shrink-0 mt-0.5">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <span className="text-sm sm:text-base text-muted-foreground group-hover:text-foreground transition-colors pt-1.5 sm:pt-2 leading-relaxed">
              {item.content}
            </span>
          </Component>
        )
      })}
    </div>
  )
})
ContactInfo.displayName = 'ContactInfo'

// Newsletter Component
const NewsletterSection = memo(() => {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuthStore()
  const subscribeMutation = useSubscribeNewsletter()
  const [email, setEmail] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e?.preventDefault()

    const emailToSubscribe = isAuthenticated ? user?.email : email.trim()

    if (!emailToSubscribe) {
      toast.error('Please enter your email address')
      return
    }

    if (!isAuthenticated && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToSubscribe)) {
      toast.error('Please enter a valid email address')
      return
    }

    try {
      await subscribeMutation.mutateAsync({
        email: emailToSubscribe,
        name: user?.name,
        source: 'website',
      })
      toast.success('Successfully subscribed to newsletter!')
      setIsSubscribed(true)
      if (!isAuthenticated) {
        setEmail('')
      }
    } catch (error) {
      const errorMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to subscribe. Please try again.'
      toast.error(errorMessage)
    }
  }

  if (isSubscribed && isAuthenticated) {
    return null
  }

  return (
    <Card className="border-primary/20 bg-linear-to-br from-primary/5 via-primary/5/50 to-transparent hover:shadow-xl transition-all duration-300 h-full flex flex-col">
      <CardContent className="p-5 sm:p-6 lg:p-8 flex flex-col flex-1">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">
            {t('footer.joinCommunityTitle')}
          </h2>
        </div>
        <p className="text-muted-foreground text-sm sm:text-base mb-5 sm:mb-6 lg:mb-8 leading-relaxed flex-1">
          {t('footer.joinCommunitySubtitle')}
        </p>
        {isSubscribed ? (
          <div className="text-sm sm:text-base text-muted-foreground space-y-2">
            <p className="text-foreground font-semibold">Thank you for subscribing! 🎉</p>
            <p>You'll receive our latest updates and exclusive offers.</p>
          </div>
        ) : (
          <form onSubmit={handleNewsletterSubmit} className="flex flex-col gap-3 sm:gap-4">
            {!isAuthenticated && (
              <Input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 sm:h-12 text-sm sm:text-base"
                required
              />
            )}
            <Button
              type="submit"
              disabled={subscribeMutation.isPending}
              className="w-full sm:w-fit"
              size="lg"
            >
              {subscribeMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Subscribing...
                </span>
              ) : (
                <>
                  {t('footer.subscribe')}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
            {isAuthenticated && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                Manage preferences in{' '}
                <Link
                  to="/profile/notifications"
                  className="underline hover:text-primary transition-colors"
                >
                  Notification Settings
                </Link>
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  )
})
NewsletterSection.displayName = 'NewsletterSection'

// Main Footer Component
const Footer: React.FC = () => {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()
  const { data: footerResponse } = useFooterSettings()
  const footerData = footerResponse?.data

  const linkSections = useMemo<LinkSection[]>(
    () => [
      {
        title: t('footer.sections.shop.title'),
        links: [
          {
            label: t('footer.sections.shop.links.bestSellers'),
            href: '/best-sellers',
          },
          {
            label: t('footer.sections.shop.links.sale'),
            href: '/events/deals',
          },
        ],
      },
      {
        title: t('footer.sections.company.title'),
        links: [
          {
            label: t('footer.sections.company.links.about'),
            href: '/about-us',
          },
          { label: t('footer.sections.company.links.blog'), href: '/blog' },
          { label: 'Become a Seller', href: '/become-a-seller' },
        ],
      },
      {
        title: t('footer.sections.support.title'),
        links: [
          {
            label: t('footer.sections.support.links.helpCenter'),
            href: '/help',
          },
          {
            label: t('footer.sections.support.links.contact'),
            href: '/contact',
          },
          {
            label: t('footer.sections.support.links.trackOrder'),
            href: '/profile/orders',
          },
          {
            label: t('footer.sections.support.links.returns'),
            href: '/profile/returns',
          },
        ],
      },
    ],
    [t],
  )

  const legalLinks = useMemo(
    () => [
      { label: t('footer.nav.privacyPolicy'), href: '/privacy-policy' },
      { label: t('footer.nav.terms'), href: '/terms' },
      { label: 'Return & Refund Policy', href: '/return-refund-policy' },
      { label: t('footer.nav.contact'), href: '/contact' },
    ],
    [t],
  )

  return (
    <footer className="relative mt-48 border-t border-gray-400 bg-linear-to-b from-background via-background/95 to-muted/40">
      {/* Shadcn Background Paths */}
      <BackgroundPaths className="absolute inset-0 z-0" />

      {/* Gradient background overlay */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/5 to-primary/10 opacity-30" />

      <div className="relative z-10">
        {/* Newsletter Section */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          {/* Newsletter Banner */}
          <ParallaxProvider>
            <SectionBanner
              position="newsletter"
              className="mb-6 sm:mb-8 h-64 sm:h-72 md:h-80 lg:h-96"
            />
          </ParallaxProvider>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-10 items-stretch">
            <NewsletterSection />

            {/* Social Links */}
            {footerData?.socialLinks && footerData.socialLinks.length > 0 && (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300">
                <CardContent className="p-5 sm:p-6 lg:p-8 h-full flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4 sm:mb-6">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <h3 className="text-base sm:text-lg lg:text-xl font-bold text-foreground">
                      Follow Us
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
                    Stay connected with us on social media
                  </p>
                  <div className="flex flex-wrap gap-3 sm:gap-4">
                    {footerData.socialLinks
                      .sort((a, b) => (a.order || 0) - (b.order || 0))
                      .map((link, index) => (
                        <SocialIcon
                          key={`${link.platform}-${index}`}
                          platform={link.platform}
                          url={link.url}
                        />
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* Main Footer Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-12">
            {/* Brand Section */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-4 xl:col-span-5 space-y-4 sm:space-y-5 md:space-y-6 lg:space-y-8">
              <Link to="/" className="inline-block group">
                <div className="flex items-center space-x-2 transition-transform duration-200 group-hover:scale-105">
                  <img
                    src="/logo.png"
                    alt="Kourier Boyz"
                    className="h-10 w-32 sm:h-12 sm:w-40 md:h-14 md:w-48 lg:h-16 lg:w-56 object-contain brightness-110"
                  />
                </div>
              </Link>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md lg:max-w-lg xl:max-w-xl">
                {footerData?.description || t('footer.brandDescription')}
              </p>
              <ContactInfo />
            </div>

            {/* Link Sections */}
            {linkSections.map((section, index) => (
              <div
                key={section.title}
                className={`col-span-1 ${
                  index === 0 ? 'sm:col-start-1 lg:col-start-6 xl:col-start-6' : ''
                } ${index === 1 ? 'sm:col-start-2 lg:col-start-8 xl:col-start-8' : ''} ${
                  index === 2
                    ? 'sm:col-start-1 sm:col-span-2 lg:col-start-10 lg:col-span-3 xl:col-start-10 xl:col-span-3'
                    : ''
                }`}
              >
                <FooterSection section={section} />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="border-t border-border/50 bg-muted/40 backdrop-blur-sm">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-muted-foreground">
                <p className="text-center sm:text-left">
                  {t('footer.legalNotice', { year: currentYear })}
                </p>
                <span className="hidden sm:inline text-primary">•</span>
                <span className="flex items-center gap-1.5">
                  Made with{' '}
                  <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 animate-pulse" /> for you
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
                  {legalLinks.map((link, index) => (
                    <React.Fragment key={link.href}>
                      <Link
                        to={link.href}
                        className="text-muted-foreground hover:text-foreground transition-colors duration-200 text-center whitespace-nowrap"
                      >
                        {link.label}
                      </Link>
                      {index < legalLinks.length - 1 && (
                        <span className="hidden sm:inline text-muted-foreground/50">•</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default memo(Footer)
