import { useSellerTestimonials } from '@/api/products'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { useAuthStore } from '@/store/authStore'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  HeadphonesIcon,
  Lock,
  Package,
  Quote,
  Receipt,
  Star,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react'
import { useMemo } from 'react'
import { getSellerPanelUrl } from '@/lib/sellerPanelUrl'

const BecomeASeller = () => {
  const { isAuthenticated, user } = useAuthStore()
  const { data: testimonialsData, isLoading: isLoadingTestimonials } = useSellerTestimonials(30)

  const sellerTestimonials = useMemo(() => {
    if (!testimonialsData?.testimonials?.length) {
      return []
    }

    const bestBySeller = new Map<string, (typeof testimonialsData.testimonials)[number]>()
    testimonialsData.testimonials.forEach((testimonial) => {
      const sellerId = testimonial.seller?._id
      if (!sellerId) {
        return
      }

      const existing = bestBySeller.get(sellerId)
      if (!existing) {
        bestBySeller.set(sellerId, testimonial)
        return
      }

      const ratingDiff = testimonial.rating - existing.rating
      if (ratingDiff > 0) {
        bestBySeller.set(sellerId, testimonial)
        return
      }

      if (ratingDiff === 0) {
        const existingDate = new Date(existing.createdAt).getTime()
        const candidateDate = new Date(testimonial.createdAt).getTime()
        if (candidateDate > existingDate) {
          bestBySeller.set(sellerId, testimonial)
        }
      }
    })

    return Array.from(bestBySeller.values())
      .sort((a, b) => {
        if (a.rating !== b.rating) {
          return b.rating - a.rating
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      .slice(0, 10)
  }, [testimonialsData])

  const handleStartSelling = () => {
    if (!isAuthenticated) {
      // Not logged in → redirect to seller signup
      window.location.href = getSellerPanelUrl('/register')
    } else if (user?.role !== 'seller') {
      // Logged in but not a seller → redirect to seller signup
      window.location.href = getSellerPanelUrl('/register')
    } else {
      // Logged in and is a seller → redirect to seller dashboard
      window.location.href = getSellerPanelUrl('/')
    }
  }

  const handleSellerLogin = () => {
    // Always redirect to seller login
    window.location.href = getSellerPanelUrl('/login')
  }

  const valueCards = [
    {
      icon: Wallet,
      title: 'Fast & Transparent Settlements',
      description: 'Get paid regularly with clear settlement cycles and transparent invoicing.',
    },
    {
      icon: Package,
      title: 'Easy Order & Return Management',
      description: 'Streamlined order processing and hassle-free return handling.',
    },
    {
      icon: Truck,
      title: 'Nationwide Shipping via Shipmozo',
      description: 'Access multiple courier partners for reliable nationwide delivery.',
    },
    {
      icon: HeadphonesIcon,
      title: 'Dedicated Seller Support',
      description: 'Get help when you need it with dedicated support channels.',
    },
    {
      icon: Receipt,
      title: 'Transparent Fees & Invoices',
      description: 'No hidden charges. Clear commission structure with downloadable invoices.',
    },
    {
      icon: BarChart3,
      title: 'Real-time Dashboard & Reports',
      description: 'Track sales, orders, and performance with comprehensive analytics.',
    },
  ]

  const howItWorksSteps = [
    {
      step: 1,
      title: 'Sign up as a Seller',
      description: 'Create your seller account with basic business information.',
    },
    {
      step: 2,
      title: 'Complete KYC & Bank Details',
      description: 'Verify your identity and add bank details for settlements.',
    },
    {
      step: 3,
      title: 'List Your Products',
      description: 'Add products with images, descriptions, and pricing.',
    },
    {
      step: 4,
      title: 'Receive Orders & Ship',
      description: 'Get notified of orders and ship products using our courier network.',
    },
    {
      step: 5,
      title: 'Get Paid via Regular Settlements',
      description: 'Receive payments through automated settlement cycles.',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-blue/5 py-20 md:py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Start Selling on Kourier Boyz
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 leading-relaxed">
              Reach more customers, get fast settlements, and manage your business effortlessly.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                onClick={handleStartSelling}
                size="lg"
                variant="primary"
                className="text-lg px-8 py-6 h-auto font-semibold"
              >
                Open your store
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={handleSellerLogin}
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 h-auto font-semibold border-2"
              >
                Seller Login
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Why Sell on Kourier Boyz Section */}
      <section className="py-20 md:py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why Sell on Kourier Boyz
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to grow your business online
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {valueCards.map((card, index) => {
              const Icon = card.icon
              return (
                <Card
                  key={index}
                  className="bg-gradient-to-br from-muted to-card p-8 border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 group"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">{card.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{card.description}</p>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 md:py-24 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">How It Works</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started in 5 simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {howItWorksSteps.map((step, index) => (
              <Card
                key={index}
                className="relative bg-card p-6 border-border hover:shadow-lg transition-all duration-300"
              >
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-foreground font-bold text-lg shadow-lg">
                  {step.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-3 mt-4">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                {index < howItWorksSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-6 h-6 text-primary/40" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Fees & Settlements Section */}
      <section className="py-20 md:py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Fees & Settlements
              </h2>
              <p className="text-lg text-muted-foreground">Transparent pricing with no surprises</p>
            </div>
            <Card className="bg-gradient-to-br from-primary/5 via-blue/5 to-primary/10 p-8 md:p-12 border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      No Hidden Charges
                    </h3>
                    <p className="text-muted-foreground">
                      All fees are clearly communicated upfront with no surprises.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue/20 rounded-xl flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6 text-blue" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Commission-Based Pricing
                    </h3>
                    <p className="text-muted-foreground">
                      Pay only when you sell. Simple, fair commission structure.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-yellow/20 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-yellow-dark" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Regular Settlement Cycle
                    </h3>
                    <p className="text-muted-foreground">
                      Get paid on a regular schedule with automated settlements.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center shrink-0">
                    <Download className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Downloadable Invoices & Credit Notes
                    </h3>
                    <p className="text-muted-foreground">
                      Access all your financial documents anytime, anywhere.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Shipping & Returns Section */}
      <section className="py-20 md:py-24 bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Shipping & Returns
              </h2>
              <p className="text-lg text-muted-foreground">
                Simplified logistics for your business
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="bg-card p-8 border-border">
                <div className="w-14 h-14 bg-blue/10 rounded-xl flex items-center justify-center mb-6">
                  <Truck className="w-7 h-7 text-blue" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  Shipping Powered by Shipmozo
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Access a network of multiple courier partners for reliable nationwide delivery. No
                  need to manage multiple shipping accounts.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue mt-0.5 shrink-0" />
                    <span>Multiple courier partners</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue mt-0.5 shrink-0" />
                    <span>Nationwide coverage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue mt-0.5 shrink-0" />
                    <span>Automated shipping labels</span>
                  </li>
                </ul>
              </Card>
              <Card className="bg-card p-8 border-border">
                <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                  <Package className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">
                  Easy Return & Replacement Handling
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Manage returns and replacements effortlessly. Our system handles the process, and
                  admin support is available when you need it.
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span>Streamlined return process</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span>Admin-assisted resolution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <span>Clear return policies</span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Compliance Section */}
      <section className="py-20 md:py-24 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Trust & Compliance
              </h2>
              <p className="text-lg text-muted-foreground">
                Built for businesses that value transparency and security
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-muted to-card p-6 border-border flex items-start gap-4">
                <div className="w-12 h-12 bg-blue/10 rounded-xl flex items-center justify-center shrink-0">
                  <FileCheck className="w-6 h-6 text-blue" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    GST-Compliant Invoices
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    All invoices are GST-compliant and ready for your accounting needs.
                  </p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-muted to-card p-6 border-border flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <Receipt className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Credit & Debit Notes
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Automatic generation of credit and debit notes for adjustments.
                  </p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-muted to-card p-6 border-border flex items-start gap-4">
                <div className="w-12 h-12 bg-yellow/10 rounded-xl flex items-center justify-center shrink-0">
                  <Lock className="w-6 h-6 text-yellow-dark" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Secure Payments</h3>
                  <p className="text-muted-foreground text-sm">
                    Your financial data and transactions are protected with industry-standard
                    security.
                  </p>
                </div>
              </Card>
              <Card className="bg-gradient-to-br from-muted to-card p-6 border-border flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Transparent Ledger & Settlements
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Complete visibility into all transactions, fees, and settlements.
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Seller Testimonials Section */}
      {(isLoadingTestimonials || sellerTestimonials.length > 0) && (
        <section className="py-20 md:py-24 bg-muted">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                What Our Sellers Say
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Join thousands of successful sellers growing their business on Kourier Boyz
              </p>
            </div>
            {isLoadingTestimonials ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading testimonials...</p>
              </div>
            ) : sellerTestimonials.length > 0 ? (
              <Carousel
                opts={{
                  align: 'start',
                  loop: true,
                }}
                className="w-full"
              >
                <CarouselContent className="-ml-2 md:-ml-4">
                  {sellerTestimonials.map((testimonial) => (
                    <CarouselItem
                      key={testimonial._id}
                      className="pl-2 md:pl-4 basis-full md:basis-1/2 lg:basis-1/3"
                    >
                      <Card className="relative bg-gradient-to-br from-card to-muted p-8 h-full border-border hover:border-primary/30 hover:shadow-lg transition-all duration-300 group">
                        {/* Quote icon */}
                        <div className="absolute top-6 right-6 opacity-10">
                          <Quote className="w-16 h-16 text-primary" />
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-1 mb-6">
                          {[...Array(testimonial.rating)].map((_, i) => (
                            <Star key={i} className="w-5 h-5 fill-yellow text-yellow" />
                          ))}
                        </div>

                        {/* Testimonial text */}
                        <p className="text-foreground text-base leading-relaxed mb-8 relative z-10">
                          "{testimonial.comment}"
                        </p>

                        {/* Author info */}
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary/20 group-hover:border-primary/40 transition-colors duration-300 bg-muted flex items-center justify-center">
                            {testimonial.reviewer.avatarUrl ? (
                              <img
                                src={testimonial.reviewer.avatarUrl}
                                alt={testimonial.reviewer.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                                {testimonial.reviewer.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-foreground">
                              {testimonial.reviewer.name}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {testimonial.seller.storeName ||
                                testimonial.seller.businessName ||
                                testimonial.seller.name}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden lg:flex -left-12 bg-card/80 backdrop-blur-sm border-border hover:bg-card" />
                <CarouselNext className="hidden lg:flex -right-12 bg-card/80 backdrop-blur-sm border-border hover:bg-card" />
              </Carousel>
            ) : null}
          </div>
        </section>
      )}

      {/* Final CTA Section */}
      <section className="py-20 md:py-24 bg-gradient-to-br from-primary/10 via-blue/5 to-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready to Start Selling?
          </h2>
          <p className="text-xl text-muted-foreground mb-10">
            Join thousands of sellers growing their business on Kourier Boyz
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={handleStartSelling}
              size="lg"
              variant="primary"
              className="text-lg px-8 py-6 h-auto font-semibold"
            >
              Open your store
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              onClick={handleSellerLogin}
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 h-auto font-semibold border-2"
            >
              Seller Login
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export default BecomeASeller
