import { useFooterSettings } from '@/api/footer'
import { useSubscribeNewsletter } from '@/api/subscribers'
import {
  ArrowRight,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  Send,
  Twitter,
  Youtube,
} from 'lucide-react'
import { memo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

const navigation = [
  {
    title: 'Platform',
    links: [
      ['Marketplace', '/shop'],
      ['Ship an order', '/ship'],
      ['Track shipment', '/track'],
      ['Rate calculator', '/rates'],
    ],
  },
  {
    title: 'For sellers',
    links: [
      ['Start selling', '/become-a-seller'],
      ['Best sellers', '/best-sellers'],
      ['Shop by category', '/shop-by-category'],
      ['Current deals', '/events/deals'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['About us', '/about-us'],
      ['Help centre', '/help'],
      ['Contact', '/contact'],
      ['Journal', '/blog'],
    ],
  },
]

const socialIcons = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  twitter: Twitter,
  youtube: Youtube,
}

const Footer = () => {
  const { data } = useFooterSettings()
  const subscribe = useSubscribeNewsletter()
  const [email, setEmail] = useState('')
  const settings = data?.data

  const submitNewsletter = async (event: FormEvent) => {
    event.preventDefault()
    const value = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      toast.error('Enter a valid email address.')
      return
    }
    try {
      await subscribe.mutateAsync({ email: value, source: 'website' })
      setEmail('')
      toast.success('You are on the list.')
    } catch {
      toast.error('Subscription is unavailable right now. Please try again.')
    }
  }

  return (
    <footer className="relative z-10 bg-[#1b1b1a] text-white">
      <div className="border-b border-white/12 bg-[#b78115]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <p className="text-xs font-semibold uppercase text-white/75">One useful platform, whichever way you begin</p>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">Shop products. Ship orders. Grow your storefront.</h2>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link to="/shop" className="kb-button bg-white text-[#1d1d1c]">Visit marketplace <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/ship" className="kb-button border border-white/45 text-white">Start shipping <Send className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="grid gap-12 border-b border-white/12 py-14 lg:grid-cols-[1.1fr_1.4fr] lg:py-18">
          <div>
            <Link to="/" className="inline-flex" aria-label="Kourier Boyz home">
              <img src="/brand/kourier-boyz-logo-nav-cropped.png" alt="Kourier Boyz" className="h-auto w-56 object-contain sm:w-64" loading="lazy" />
            </Link>
            <p className="mt-6 max-w-md text-base leading-7 text-white/60">
              {settings?.description || 'A connected marketplace and courier platform for buyers, independent shippers, and growing Indian sellers.'}
            </p>
            <div className="mt-7 grid gap-3 text-sm text-white/70">
              <a href={`mailto:${settings?.email || 'support@kourierboyz.com'}`} className="kb-footer-contact"><Mail className="h-4 w-4" />{settings?.email || 'support@kourierboyz.com'}</a>
              {settings?.phone && <a href={`tel:${settings.phone}`} className="kb-footer-contact"><Phone className="h-4 w-4" />{settings.phone}</a>}
              {settings?.address && <span className="kb-footer-contact"><MapPin className="h-4 w-4" />{settings.address}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {navigation.map((section) => (
              <nav key={section.title} aria-label={section.title}>
                <h3 className="text-sm font-semibold text-[#dfb743]">{section.title}</h3>
                <div className="mt-5 grid gap-3">
                  {section.links.map(([label, href]) => <Link key={href} to={href} className="kb-footer-link">{label}</Link>)}
                </div>
              </nav>
            ))}
          </div>
        </div>

        <div className="grid gap-8 border-b border-white/12 py-9 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h3 className="text-xl font-semibold">Useful updates, not inbox clutter.</h3>
            <p className="mt-2 text-sm text-white/55">Product finds, seller tools, and practical shipping updates.</p>
          </div>
          <form onSubmit={submitNewsletter} className="flex w-full max-w-xl flex-col gap-2 sm:flex-row md:w-[480px]">
            <label className="sr-only" htmlFor="footer-email">Email address</label>
            <input id="footer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="h-12 min-w-0 flex-1 border border-white/20 bg-white/7 px-4 text-white outline-none placeholder:text-white/40 focus:border-[#dfb743]" />
            <button type="submit" disabled={subscribe.isPending} className="kb-button kb-button-gold min-h-12 shrink-0 disabled:opacity-60">{subscribe.isPending ? 'Joining...' : 'Join newsletter'} <ArrowRight className="h-4 w-4" /></button>
          </form>
        </div>

        <div className="flex flex-col gap-5 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Kourier Boyz. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/privacy-policy" className="hover:text-white">Privacy</Link>
            <Link to="/terms" className="hover:text-white">Terms</Link>
            <Link to="/return-refund-policy" className="hover:text-white">Returns</Link>
            {settings?.socialLinks?.map((social) => {
              const Icon = socialIcons[social.platform as keyof typeof socialIcons]
              return Icon ? <a key={social.platform} href={social.url} target="_blank" rel="noreferrer" aria-label={social.platform} className="text-white/55 transition hover:-translate-y-0.5 hover:text-[#dfb743]"><Icon className="h-4 w-4" /></a> : null
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default memo(Footer)
