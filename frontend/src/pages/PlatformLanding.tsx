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
  Star,
  Store,
  Truck,
  Users,
  Warehouse,
  WalletCards,
  Zap,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const products = [
  { name: 'PulseFit Smart Watch', price: 'Rs. 2,999', image: '/products/watch.webp', slug: 'smart-watch-series-5', badge: 'Trending', rating: '4.8' },
  { name: 'Modern Accent Chair', price: 'Rs. 5,799', image: '/products/chair.jpg', slug: 'modern-accent-chair', badge: 'New arrival', rating: '4.7' },
  { name: 'Everyday Cotton Tee', price: 'Rs. 499', image: '/products/tshirt.jpg', slug: 'classic-everyday-cotton-t-shirt', badge: 'Everyday pick', rating: '4.9' },
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
      cta: 'Compare shipping rates',
      href: '/rates',
    },
    seller: {
      eyebrow: 'For marketplace brands',
      title: 'Run your storefront and fulfilment from one account.',
      copy: 'Unlock catalogue, inventory, marketplace orders, promotions, and connected shipping when your brand is ready.',
      points: ['Product and inventory management', 'Marketplace order operations', 'Integrated pickup and tracking'],
      cta: 'Ship your first order',
      href: '/ship',
    },
  }

  const journey = journeys[activeJourney]

  return (
    <main className="kb-site min-h-screen text-[#171717]">
      <section className="kb-hero relative min-h-[790px] overflow-hidden bg-[#f4f3ef] pt-28 sm:pt-32 lg:min-h-[860px] lg:pt-28">
        <img
          src="/brand/kourier-boyz-commerce-hero.webp"
          alt="Kourier Boyz marketplace products and delivery network"
          className="kb-hero-image absolute inset-0 h-full w-full object-cover object-[69%_center]"
        />
        <div className="kb-hero-wash absolute inset-0 bg-[linear-gradient(90deg,#f8f7f3_0%,rgba(248,247,243,0.985)_34%,rgba(248,247,243,0.78)_49%,rgba(248,247,243,0.08)_76%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(248,247,243,0.9)_0%,transparent_28%)]" />

        <div className="relative z-10 mx-auto flex min-h-[680px] max-w-7xl items-center px-5 py-12 sm:px-8 lg:min-h-[730px] lg:px-10">
          <div className="max-w-[690px]">
            <div className="kb-eyebrow kb-hero-intro"><span className="kb-live-dot" /> One platform, always in motion</div>
            <h1 className="kb-hero-heading mt-7 max-w-[680px] text-[52px] font-extrabold leading-[0.98] sm:text-[72px] lg:text-[88px]">
              <span className="block"><span className="kb-hero-editorial text-[#9a6b0d]">Shop</span> it.</span>
              <span className="block">We'll <span className="kb-hero-editorial text-[#b78115]">move</span> it.</span>
            </h1>
            <p className="mt-7 max-w-[590px] text-lg leading-8 text-[#4e4e4a] sm:text-xl">
              Discover the next thing you love, open a storefront for your brand, or ship an order made anywhere. Commerce and delivery finally move as one.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/shop" className="kb-button kb-button-gold"><ShoppingBag className="h-5 w-5" /> Enter the marketplace</Link>
              <Link to="/ship" className="kb-button kb-button-ink"><Truck className="h-5 w-5" /> Send a parcel</Link>
            </div>
            <div className="kb-hero-route mt-9 max-w-[620px]">
              <div className="kb-hero-route-line"><span /></div>
              {[
                [Store, 'Order'],
                [PackageCheck, 'Packed'],
                [Truck, 'Moving'],
                [MapPin, 'Delivered'],
              ].map(([Icon, label]) => (
                <div key={label as string} className="kb-hero-route-stop">
                  <span><Icon className="h-4 w-4" /></span>
                  <strong>{label as string}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="relative z-10 border-y border-black/10 bg-white/72 backdrop-blur-xl">
          <div className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:grid-cols-4 sm:px-8 lg:px-10">
            {[['10L+', 'Customers served'], ['50L+', 'Deliveries completed'], ['29K+', 'Pincodes covered'], ['24/7', 'Shipment visibility']].map(([value, label]) => (
              <div key={label} className="kb-hero-metric border-r border-black/10 px-3 py-5 first:border-l sm:py-6">
                <div className="text-2xl font-semibold text-[#9a6b0d]">{value}</div>
                <div className="mt-1 text-xs font-semibold uppercase text-[#686864]">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="kb-section kb-shop-pattern border-b border-black/10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="kb-store-entry overflow-hidden border border-black/10 bg-white shadow-[0_24px_70px_rgba(25,25,25,0.09)]">
            <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
              <div className="kb-silver-panel flex flex-col justify-between p-7 text-[#202224] sm:p-9 lg:p-11">
                <div>
                  <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-[#dfb743]">
                    <span className="h-2 w-2 bg-[#dfb743]" /> Marketplace now open
                  </span>
                  <h2 className="mt-5 max-w-md text-3xl font-semibold leading-tight sm:text-4xl">
                    Good products, ready to find a place in your day.
                  </h2>
                  <p className="mt-5 max-w-md text-base leading-7 text-[#565a5e]">
                    Explore useful finds from independent brands, with secure checkout, clear order updates, and delivery built into the experience.
                  </p>
                  <div className="mt-7 grid gap-3 text-sm font-medium text-[#303336] sm:grid-cols-2 lg:grid-cols-1">
                    {['Curated multi-category catalogue', 'Order tracking from dispatch to door', 'Clear prices and easy returns'].map((item) => (
                      <span key={item} className="inline-flex items-center gap-3">
                        <Check className="h-4 w-4 shrink-0 text-[#dfb743]" /> {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-9 grid gap-4">
                  <Link to="/shop" className="kb-shop-entry-cta group">
                    <span className="kb-shop-entry-cta-icon"><ShoppingBag className="h-6 w-6" /></span>
                    <span className="min-w-0 flex-1">
                      <strong>Enter the marketplace</strong>
                      <small>Shop new arrivals, useful finds, and today's best offers</small>
                    </span>
                    <span className="kb-shop-entry-cta-arrow"><ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" /></span>
                  </Link>
                  <Link to="/shop-by-category" className="kb-text-link w-fit">
                    Browse all categories <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="p-6 sm:p-8 lg:p-10">
                <div className="flex items-end justify-between gap-5 border-b border-black/10 pb-5">
                  <div>
                    <span className="kb-kicker">Fresh from the shop</span>
                    <h3 className="mt-2 text-2xl font-semibold">A quick look inside</h3>
                  </div>
                  <Link to="/shop" className="kb-button kb-shop-preview-button hidden sm:inline-flex">
                    Open full shop <ShoppingBag className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-5">
                  {products.map((product, index) => (
                    <Link
                      key={product.name}
                      to={`/product/${product.slug}`}
                      className={`kb-store-preview-product group ${index === 2 ? 'col-span-2 sm:col-span-1' : ''}`}
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-[#efefeb]">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                        />
                        <span className="absolute left-3 top-3 bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase text-[#5d450f] shadow-sm backdrop-blur-md">
                          {product.badge}
                        </span>
                      </div>
                      <div className="pt-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#806014]">
                          <Star className="h-3.5 w-3.5 fill-[#d8af3d] text-[#b78115]" /> {product.rating}
                        </span>
                        <p className="text-sm font-semibold leading-5 sm:text-base">{product.name}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="font-semibold">{product.price}</span>
                          <ArrowRight className="h-4 w-4 text-[#a9730c] transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link to="/shop" className="kb-button kb-shop-preview-button mt-7 w-full sm:hidden">
                  Open full shop <ShoppingBag className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="kb-section kb-pattern-route-grid">
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

      <section className="kb-section kb-pattern-diagonal">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div>
              <span className="kb-kicker">Built for how business really happens</span>
              <h2 className="kb-title mt-3">Every selling channel belongs in the same operational picture.</h2>
            </div>
            <p className="kb-copy lg:justify-self-end">Kourier Boyz does not ask a seller to rebuild the business around a tool. It connects the orders, parcels, and storefronts already in motion.</p>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-4 border-y border-black/10 py-5">
            <span className="text-sm font-semibold text-[#575753]">Already have orders to dispatch?</span>
            <Link to="/rates" className="kb-button kb-button-gold">Compare courier rates <ArrowRight className="h-4 w-4" /></Link>
            <span className="text-sm text-[#74746e]">No marketplace listing required.</span>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sellingScenarios.map(([Icon, title, copy, label], index) => (
              <article key={title as string} className={`kb-lift-card ${scenarioHoverStyles[index]} group flex min-h-[310px] flex-col border border-black/10 bg-white p-6 shadow-[0_10px_30px_rgba(25,25,25,0.055)]`}>
                <div className="flex items-start justify-between gap-5">
                  <span className="kb-silver-icon flex h-12 w-12 items-center justify-center text-[#8a620d]"><Icon className="h-5 w-5" /></span>
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

      <section className="kb-section kb-silver-section text-[#202224]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <span className="kb-kicker text-[#8a620d]">Operations, connected</span>
              <h2 className="kb-title mt-3 text-[#202224]">The practical tools behind every order.</h2>
              <p className="mt-5 text-lg leading-8 text-[#606469]">Marketplace or not, your team gets a clear path from order to delivery without stitching together separate systems.</p>
              <Link to="/rates" className="kb-button kb-button-gold mt-8"><Calculator className="h-5 w-5" /> Compare rates</Link>
            </div>
            <div className="grid border-l border-t border-black/12 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(([Icon, title, copy]) => (
                <div key={title as string} className="kb-lift-card kb-hover-icon border-b border-r border-black/12 bg-white/46 p-6 backdrop-blur-sm">
                  <Icon className="h-7 w-7 text-[#9a6b0d]" /><h3 className="mt-5 text-lg font-semibold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-[#64686c]">{copy as string}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="kb-section kb-pattern-rings">
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

      <section className="kb-section kb-pattern-weave">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div><span className="kb-kicker">Designed for seller choice</span><h2 className="kb-title mt-3">Use the platform your way.</h2><p className="kb-copy mt-4">No forced bundle. Start with courier aggregation, marketplace selling, or both. Your operations remain useful at every stage.</p></div>
            <div className="divide-y divide-black/10 border-y border-black/10">
              {[
                [PackagePlus, 'Courier tools only', 'Ship orders from any sales channel, with rate comparison, labels, tracking, and COD visibility.'],
                [Store, 'Marketplace only', 'List products, manage stock, receive orders, and use your preferred fulfilment setup.'],
                [Zap, 'Marketplace + shipping', 'Connect catalogue, buyer orders, pickup booking, tracking, returns, and reporting end to end.'],
              ].map(([Icon, title, copy]) => (
                <div key={title as string} className="grid gap-4 py-7 sm:grid-cols-[48px_1fr]"><span className="kb-silver-icon flex h-11 w-11 items-center justify-center text-[#8a620d]"><Icon className="h-5 w-5" /></span><div><h3 className="text-xl font-semibold">{title as string}</h3><p className="mt-2 leading-7 text-[#686864]">{copy as string}</p></div></div>
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

      <section className="kb-section kb-pattern-dot-matrix">
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

      <section className="kb-pattern-gold-finale py-14 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <div><div className="flex items-center gap-2 text-sm font-semibold uppercase"><Clock3 className="h-4 w-4" /> Ready when your business is</div><h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">Shop, ship, or build your marketplace store today.</h2></div>
          <div className="flex flex-wrap gap-3"><Link to="/ship" className="kb-button bg-white text-[#1d1d1d]">Book a pickup <ArrowRight className="h-5 w-5" /></Link><Link to="/shop" className="kb-button border border-white/50 text-white">Browse the shop <ShoppingBag className="h-5 w-5" /></Link></div>
        </div>
      </section>
    </main>
  )
}

export default PlatformLanding
