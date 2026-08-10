import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Box,
  Calculator,
  Check,
  ChevronDown,
  Clock3,
  Headphones,
  Instagram,
  MapPin,
  PackageCheck,
  PackagePlus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
  Warehouse,
  WalletCards,
  Zap,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const categories = ['Fashion', 'Electronics', 'Home & Living', 'Beauty', 'Gifts', 'Travel']

const products = [
  { name: 'Street Flex Sneakers', price: 'Rs. 1,499', image: '/home-banner.png', slug: 'street-flex-sneakers' },
  { name: 'PulseFit Smart Watch', price: 'Rs. 2,999', image: '/products/watch.webp', slug: 'smart-watch-series-5' },
  { name: 'Modern Accent Chair', price: 'Rs. 5,799', image: '/products/chair.jpg', slug: 'modern-accent-chair' },
  { name: 'Everyday Cotton Tee', price: 'Rs. 499', image: '/products/tshirt.jpg', slug: 'classic-everyday-cotton-t-shirt' },
]

const capabilities = [
  [Truck, 'Courier choice', 'Compare service, price, and delivery speed before every booking.'],
  [MapPin, 'One tracking view', 'Follow marketplace and external shipments from a single dashboard.'],
  [WalletCards, 'COD visibility', 'See remittances, charges, and shipment-level reconciliation clearly.'],
  [Box, 'Inventory control', 'Manage stock, variants, pricing, and fulfilment for marketplace orders.'],
  [BarChart3, 'Business reporting', 'Understand orders, shipping spend, returns, and product performance.'],
  [Headphones, 'Human support', 'Get practical help when a pickup, order, or delivery needs attention.'],
]

const sellingScenarios = [
  [Building2, 'Your own D2C website', 'Keep your existing storefront. Bring orders into one shipping workflow and choose the right courier for every route.', 'Website orders'],
  [Instagram, 'Social commerce', 'Turn WhatsApp and Instagram sales into trackable shipments with labels, pickup records, and COD visibility.', 'Social orders'],
  [Warehouse, 'Offline and wholesale', 'Dispatch samples, replacements, retail replenishment, and B2B parcels without needing an online product listing.', 'Business dispatch'],
  [Store, 'Kourier marketplace', 'Build a branded catalogue, receive buyer orders, manage inventory, and connect fulfilment when it suits your business.', 'Marketplace sales'],
]

const scenarioHoverStyles = ['kb-hover-shine', 'kb-hover-border', 'kb-hover-reveal', 'kb-hover-tilt']

const testimonials = [
  {
    quote: 'We started with shipping for Instagram orders. Opening a marketplace store later took the same team and the same workflow.',
    name: 'Neha Arora',
    role: 'Founder, Everyday Loom',
  },
  {
    quote: 'The rate view and COD reconciliation save us hours every week. We can choose what works for each parcel without changing panels.',
    name: 'Rohit Mehta',
    role: 'Operations, House of Utility',
  },
  {
    quote: 'Customers get a proper shopping experience, while fulfilment stays connected behind the scenes. That is the useful part for us.',
    name: 'Ayesha Khan',
    role: 'Owner, Studio Kind',
  },
]

const faqs = [
  ['Do I need to sell on the marketplace to use shipping?', 'No. You can use Kourier Boyz only for orders from your website, social channels, marketplaces, retail counter, or any other source.'],
  ['Can I open a store without using the courier aggregator?', 'Yes. Marketplace selling and courier aggregation are independent tools. Use either one, or connect both when it helps your operation.'],
  ['Can buyers track marketplace orders?', 'Yes. Buyers receive order updates and can use the public tracking experience for supported shipments.'],
  ['What happens when my business grows?', 'Your seller account can add catalogue, inventory, marketplace orders, shipping, COD, and reporting without moving to a separate system.'],
]

const PlatformLanding = () => {
  const navigate = useNavigate()
  const sellerUrl = import.meta.env.VITE_SELLER_URL || 'http://localhost:5175'
  const [trackingNumber, setTrackingNumber] = useState('')
  const [activeJourney, setActiveJourney] = useState<'buyer' | 'shipper' | 'seller'>('buyer')

  const submitTracking = (event: FormEvent) => {
    event.preventDefault()
    const value = trackingNumber.trim()
    navigate(value ? `/track?awb=${encodeURIComponent(value)}` : '/track')
  }

  const journeys = {
    buyer: {
      eyebrow: 'For shoppers',
      title: 'Find useful products without losing sight of the order.',
      copy: 'Discover growing brands, check out securely, follow delivery, and get help from one connected experience.',
      points: ['Curated multi-category marketplace', 'Secure checkout and order history', 'Tracking from dispatch to doorstep'],
      cta: 'Browse marketplace',
      href: '/shop',
    },
    shipper: {
      eyebrow: 'For every seller',
      title: 'Ship orders from wherever you make the sale.',
      copy: 'Bring orders from your website, social media, another marketplace, retail store, or spreadsheets. Selling here is never compulsory.',
      points: ['Compare courier options', 'Generate AWB and labels', 'Track COD and delivery exceptions'],
      cta: 'Start shipping',
      href: '/ship',
    },
    seller: {
      eyebrow: 'For marketplace brands',
      title: 'Run your storefront and fulfilment from one account.',
      copy: 'Unlock catalogue, inventory, marketplace orders, promotions, and connected shipping when your brand is ready.',
      points: ['Product and inventory management', 'Marketplace order operations', 'Integrated pickup and tracking'],
      cta: 'Open seller panel',
      href: sellerUrl,
    },
  }

  const journey = journeys[activeJourney]

  return (
    <main className="kb-site min-h-screen text-[#171717]">
      <section className="kb-hero relative min-h-[720px] overflow-hidden bg-[#f4f3ef] pt-32 lg:min-h-[780px] lg:pt-28">
        <img
          src="/brand/kourier-boyz-commerce-hero.webp"
          alt="Kourier Boyz marketplace products and delivery network"
          className="absolute inset-0 h-full w-full object-cover object-[68%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#f7f6f2_0%,rgba(247,246,242,0.98)_36%,rgba(247,246,242,0.72)_54%,rgba(247,246,242,0.08)_82%)]" />
        <div className="relative z-10 mx-auto flex min-h-[610px] max-w-7xl items-center px-5 py-12 sm:px-8 lg:px-10">
          <div className="max-w-[650px]">
            <div className="kb-eyebrow"><BadgeCheck className="h-4 w-4" /> Marketplace and shipping, together</div>
            <h1 className="mt-6 max-w-[630px] text-[43px] font-semibold leading-[1.08] tracking-normal sm:text-6xl lg:text-[68px]">
              Sell it here. Ship it from anywhere.
            </h1>
            <p className="mt-6 max-w-[590px] text-lg leading-8 text-[#4e4e4a] sm:text-xl">
              One platform for people who shop, businesses that sell, and every parcel that needs to reach a doorstep.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/shop" className="kb-button kb-button-gold"><ShoppingBag className="h-5 w-5" /> Shop products</Link>
              <Link to="/ship" className="kb-button kb-button-ink"><Truck className="h-5 w-5" /> Ship an order</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium text-[#333]">
              {['29,000+ pincodes', 'Multiple courier options', 'Independent tools for every seller'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#a9730c]" />{item}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="relative z-10 border-y border-black/10 bg-white/94">
          <div className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:grid-cols-4 sm:px-8 lg:px-10">
            {[['10L+', 'Customers served'], ['50L+', 'Deliveries completed'], ['29K+', 'Pincodes covered'], ['24/7', 'Shipment visibility']].map(([value, label]) => (
              <div key={label} className="border-r border-black/10 px-3 py-5 first:border-l sm:py-6">
                <div className="text-2xl font-semibold text-[#9a6b0d]">{value}</div>
                <div className="mt-1 text-xs font-semibold uppercase text-[#686864]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="kb-section bg-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-3xl">
            <span className="kb-kicker">Choose your way in</span>
            <h2 className="kb-title mt-3">One platform. Three complete experiences.</h2>
            <p className="kb-copy mt-4">Start with the job you need to do. The rest stays available without getting in your way.</p>
          </div>
          <div className="mt-9 flex gap-2 overflow-x-auto border-b border-black/10 pb-3">
            {(['buyer', 'shipper', 'seller'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setActiveJourney(item)}
                className={`kb-journey-tab ${activeJourney === item ? 'is-active' : ''}`}
              >
                {item === 'buyer' ? <ShoppingBag /> : item === 'shipper' ? <Truck /> : <Store />}
                {item === 'buyer' ? 'I want to shop' : item === 'shipper' ? 'I want to ship' : 'I want to sell here'}
              </button>
            ))}
          </div>
          <div className="grid gap-8 border-b border-black/10 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <span className="kb-kicker">{journey.eyebrow}</span>
              <h3 className="mt-3 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">{journey.title}</h3>
              <p className="mt-4 max-w-xl text-lg leading-8 text-[#62625d]">{journey.copy}</p>
              <div className="mt-6 grid gap-3">
                {journey.points.map((point) => <span key={point} className="inline-flex items-center gap-3 font-medium"><BadgeCheck className="h-5 w-5 text-[#a9730c]" />{point}</span>)}
              </div>
              {journey.href.startsWith('http') ? (
                <a href={journey.href} className="kb-button kb-button-gold mt-8">{journey.cta}<ArrowRight className="h-4 w-4" /></a>
              ) : (
                <Link to={journey.href} className="kb-button kb-button-gold mt-8">{journey.cta}<ArrowRight className="h-4 w-4" /></Link>
              )}
            </div>
            <div className="kb-operation-rail">
              {[['Discover', Search], ['Sell', Store], ['Pack', PackageCheck], ['Deliver', Truck]].map(([label, Icon], index) => (
                <div key={label as string} className="kb-operation-step">
                  <span>{index + 1}</span>
                  <Icon className="h-6 w-6" />
                  <strong>{label as string}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="kb-section bg-[#f4f3ef]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <span className="kb-kicker">Built for how business really happens</span>
              <h2 className="kb-title mt-3">Every selling channel belongs in the same operational picture.</h2>
            </div>
            <p className="kb-copy lg:justify-self-end">Kourier Boyz does not ask a seller to rebuild the business around a tool. It connects the orders, parcels, and storefronts already in motion.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sellingScenarios.map(([Icon, title, copy, label], index) => (
              <article key={title as string} className={`kb-lift-card ${scenarioHoverStyles[index]} group flex min-h-[310px] flex-col border border-black/10 bg-white p-6 shadow-[0_10px_30px_rgba(25,25,25,0.055)]`}>
                <div className="flex items-start justify-between gap-5">
                  <span className="flex h-12 w-12 items-center justify-center bg-[#1d1d1c] text-[#dfb743]"><Icon className="h-5 w-5" /></span>
                  <span className="text-xs font-semibold text-[#9a6b0d]">0{index + 1}</span>
                </div>
                <div className="mt-auto pt-10">
                  <span className="text-xs font-semibold uppercase text-[#8a620d]">{label as string}</span>
                  <h3 className="mt-3 text-xl font-semibold">{title as string}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#686864]">{copy as string}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="kb-section kb-shop-pattern">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <span className="kb-kicker">Kourier Boyz Marketplace</span>
              <h2 className="kb-title mt-3">A useful store, built around dependable delivery.</h2>
              <p className="kb-copy mt-4">Browse everyday products from growing brands with clear prices, order history, returns, and shipment updates.</p>
            </div>
            <Link to="/shop" className="kb-text-link">Enter the marketplace <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <Link to="/shop" className="mt-8 flex h-14 max-w-3xl items-center gap-3 border border-black/15 bg-white px-5 shadow-sm">
            <Search className="h-5 w-5 text-[#9a6b0d]" /><span className="text-[#686864]">Search products, categories, and stores</span><ArrowRight className="ml-auto h-5 w-5" />
          </Link>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {categories.map((category) => <Link key={category} to={`/products/search?q=${encodeURIComponent(category)}`} className="kb-chip">{category}</Link>)}
          </div>
          <div className="mt-9 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {products.map((product) => (
              <Link key={product.name} to={`/product/${product.slug}`} className="kb-product kb-hover-image group">
                <div className="aspect-[4/3] overflow-hidden bg-[#ecece8]"><img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]" /></div>
                <div className="p-4"><p className="min-h-10 text-sm font-semibold sm:text-base">{product.name}</p><div className="mt-3 flex items-end justify-between gap-2"><span className="text-lg font-semibold">{product.price}</span><span className="text-xs font-semibold text-[#8a620d]">Easy returns</span></div></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="kb-section bg-[#1d1d1c] text-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <span className="kb-kicker text-[#dfb743]">Operations, connected</span>
              <h2 className="kb-title mt-3 text-white">The practical tools behind every order.</h2>
              <p className="mt-5 text-lg leading-8 text-white/65">Marketplace or not, your team gets a clear path from order to delivery without stitching together separate systems.</p>
              <Link to="/rates" className="kb-button kb-button-gold mt-8"><Calculator className="h-5 w-5" /> Compare rates</Link>
            </div>
            <div className="grid border-l border-t border-white/15 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(([Icon, title, copy]) => (
                <div key={title as string} className="kb-lift-card kb-hover-icon border-b border-r border-white/15 bg-[#1d1d1c] p-6">
                  <Icon className="h-7 w-7 text-[#dfb743]" /><h3 className="mt-5 text-lg font-semibold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-white/60">{copy as string}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="kb-section bg-[#f4f3ef]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="max-w-3xl"><span className="kb-kicker">Quick actions</span><h2 className="kb-title mt-3">Get an answer before you open a panel.</h2></div>
          <div className="mt-9 grid border border-black/10 bg-white lg:grid-cols-2">
            <form onSubmit={submitTracking} className="kb-lift-card p-7 lg:border-r lg:border-black/10 lg:p-10">
              <MapPin className="h-8 w-8 text-[#9a6b0d]" /><h3 className="mt-5 text-2xl font-semibold">Track a shipment</h3><p className="mt-2 text-[#686864]">Enter an AWB or order number to open the tracking timeline.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row"><input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} className="kb-field" placeholder="AWB or order number" aria-label="AWB or order number" /><button className="kb-button kb-button-ink shrink-0" type="submit">Track now <ArrowRight className="h-4 w-4" /></button></div>
            </form>
            <div className="kb-lift-card border-t border-black/10 p-7 lg:border-t-0 lg:p-10">
              <Calculator className="h-8 w-8 text-[#9a6b0d]" /><h3 className="mt-5 text-2xl font-semibold">Estimate a shipping rate</h3><p className="mt-2 text-[#686864]">Use origin, destination, weight, and dimensions to compare service options.</p>
              <Link to="/rates" className="kb-button kb-button-gold mt-6">Open rate calculator <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="kb-section bg-white">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div><span className="kb-kicker">Designed for seller choice</span><h2 className="kb-title mt-3">Use the platform your way.</h2><p className="kb-copy mt-4">No forced bundle. Start with courier aggregation, marketplace selling, or both. Your operations remain useful at every stage.</p></div>
            <div className="divide-y divide-black/10 border-y border-black/10">
              {[
                [PackagePlus, 'Courier tools only', 'Ship orders from any sales channel, with rate comparison, labels, tracking, and COD visibility.'],
                [Store, 'Marketplace only', 'List products, manage stock, receive orders, and use your preferred fulfilment setup.'],
                [Zap, 'Marketplace + shipping', 'Connect catalogue, buyer orders, pickup booking, tracking, returns, and reporting end to end.'],
              ].map(([Icon, title, copy]) => (
                <div key={title as string} className="grid gap-4 py-7 sm:grid-cols-[48px_1fr]"><span className="flex h-11 w-11 items-center justify-center bg-[#1d1d1c] text-[#dfb743]"><Icon className="h-5 w-5" /></span><div><h3 className="text-xl font-semibold">{title as string}</h3><p className="mt-2 leading-7 text-[#686864]">{copy as string}</p></div></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="kb-section kb-metal-pattern">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="flex items-end justify-between gap-6"><div><span className="kb-kicker">Used in real operations</span><h2 className="kb-title mt-3">What sellers value after the launch.</h2></div><Users className="hidden h-10 w-10 text-[#9a6b0d] sm:block" /></div>
          <div className="mt-9 grid border-l border-t border-black/10 md:grid-cols-3">
            {testimonials.map((item) => (
              <figure key={item.name} className="kb-lift-card kb-hover-quote border-b border-r border-black/10 bg-white/75 p-7"><Sparkles className="h-5 w-5 text-[#9a6b0d]" /><blockquote className="mt-5 text-lg leading-8 text-[#343431]">“{item.quote}”</blockquote><figcaption className="mt-8 border-t border-black/10 pt-5"><strong className="block font-semibold">{item.name}</strong><span className="text-sm text-[#74746e]">{item.role}</span></figcaption></figure>
            ))}
          </div>
        </div>
      </section>

      <section className="kb-section bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.65fr_1.35fr] lg:px-10">
          <div><span className="kb-kicker">Straight answers</span><h2 className="kb-title mt-3">Before you get started.</h2><p className="kb-copy mt-4">The marketplace and courier aggregator are connected, but never compulsory as a bundle.</p></div>
          <div className="border-t border-black/10">
            {faqs.map(([question, answer], index) => (
              <details key={question} className="kb-hover-faq group border-b border-black/10 py-1" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-lg font-semibold"><span>{question}</span><ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" /></summary>
                <p className="max-w-2xl pb-6 leading-7 text-[#686864]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#b78115] py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div><div className="flex items-center gap-2 text-sm font-semibold uppercase"><Clock3 className="h-4 w-4" /> Ready when your business is</div><h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">Shop, ship, or build your marketplace store today.</h2></div>
          <div className="flex flex-wrap gap-3"><Link to="/ship" className="kb-button bg-white text-[#1d1d1d]">Book a pickup <ArrowRight className="h-5 w-5" /></Link><Link to="/shop" className="kb-button border border-white/50 text-white">Browse the shop <ShoppingBag className="h-5 w-5" /></Link></div>
        </div>
      </section>
    </main>
  )
}

export default PlatformLanding
