import Layout from '@/components/Layout'
import PlatformLanding from '@/pages/PlatformLanding'
import React, { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/authStore'

const Home = lazy(() => import('./components/Home/Home'))
const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'))
const Unsubscribe = lazy(() => import('@/pages/Unsubscribe'))
const ShipWithUs = lazy(() => import('./pages/ShipWithUs'))
const TrackShipment = lazy(() => import('./pages/TrackShipment'))
const RateCalculator = lazy(() => import('@/pages/RateCalculator'))
const ProfileLayout = lazy(() => import('@/pages/ProfileLayout'))
const Orders = lazy(() => import('@/pages/profile/Orders'))
const ProfileWishlist = lazy(() => import('@/pages/profile/ProfileWishlist'))
const Returns = lazy(() => import('@/pages/profile/Returns'))
const ProfileHistory = lazy(() => import('./pages/profile/ProfileHistory'))
const Addresses = lazy(() => import('@/pages/profile/Addresses'))
const Payments = lazy(() => import('@/pages/profile/Payments'))
const PersonalInfo = lazy(() => import('@/pages/profile/PersonalInfo'))
const Security = lazy(() => import('@/pages/profile/Security'))
const AccountSettings = lazy(() => import('@/pages/profile/AccountSettings'))
const Notifications = lazy(() => import('@/pages/profile/Notifications'))
const Wishlist = lazy(() => import('@/pages/Wishlist'))
const SharedWishlist = lazy(() => import('@/pages/SharedWishlist'))
const OrderFeedbackPage = lazy(() => import('@/pages/OrderFeedbackPage'))
const InvoiceView = lazy(() => import('@/pages/InvoiceView'))
const Cart = lazy(() => import('./pages/Cart'))
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const ProductDetail = lazy(() => import('@/pages/ProductDetail'))
const ProductReviews = lazy(() => import('@/pages/ProductReviews'))
const SellerStorefront = lazy(() => import('@/pages/SellerStorefront'))
const SellerCategoryProducts = lazy(() => import('@/pages/SellerCategoryProducts'))
const Categories = lazy(() => import('@/pages/Categories'))
const DealsPage = lazy(() => import('./pages/DealsPage'))
const BestSellersPage = lazy(() => import('@/pages/BestSellersPage'))
const SearchResults = lazy(() => import('./pages/SearchResults'))
const HelpCenter = lazy(() => import('@/pages/HelpCenter'))
const Tickets = lazy(() => import('@/pages/Tickets'))
const CreateTicket = lazy(() => import('@/pages/CreateTicket'))
const TicketDetail = lazy(() => import('@/pages/TicketDetail'))
const ContactUs = lazy(() => import('@/pages/ContactUs'))
const ContactHistory = lazy(() => import('@/pages/ContactHistory'))
const BlogList = lazy(() => import('@/pages/BlogList'))
const BlogDetail = lazy(() => import('@/pages/BlogDetail'))
const AboutUs = lazy(() => import('@/pages/AboutUs'))
const TermsAndConditions = lazy(() => import('@/pages/TermsAndConditions'))
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'))
const ReturnRefundPolicy = lazy(() => import('@/pages/ReturnRefundPolicy'))
const BecomeASeller = lazy(() => import('@/pages/BecomeASeller'))

const RouteFallback = () => (
  <div className="min-h-[55vh] bg-[#f5f5f2] px-5 pb-16 pt-40" aria-busy="true">
    <div className="mx-auto h-2 w-40 overflow-hidden bg-black/10">
      <div className="h-full w-1/2 animate-pulse bg-[#b78115]" />
    </div>
  </div>
)

const ScrollToTop: React.FC = () => {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'auto',
    })
  }, [location.pathname, location.search])

  return null
}

const App: React.FC = () => {
  const checkAuth = useAuthStore((state) => state.checkAuth)

  useEffect(() => {
    // Check auth on mount
    checkAuth()
  }, [checkAuth])

  return (
    <Router>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/verify-user/:userId" element={<VerifyEmail />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />

        {/* Protected Routes with Layout */}
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<PlatformLanding />} />
                <Route path="/shop" element={<Home />} />
                <Route path="/store" element={<Home />} />
                <Route path="/ship" element={<ShipWithUs />} />
                <Route path="/track" element={<TrackShipment />} />
                <Route path="/rates" element={<RateCalculator />} />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <ProfileLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/profile/orders" replace />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="wishlist" element={<ProfileWishlist />} />
                  <Route path="returns" element={<Returns />} />
                  <Route path="history" element={<ProfileHistory />} />
                  <Route path="addresses" element={<Addresses />} />
                  <Route path="payments" element={<Payments />} />
                  <Route path="info" element={<PersonalInfo />} />
                  <Route path="security" element={<Security />} />
                  <Route path="account" element={<AccountSettings />} />
                  <Route path="notifications" element={<Notifications />} />
                </Route>
                <Route
                  path="/wishlist"
                  element={
                    <ProtectedRoute>
                      <Wishlist />
                    </ProtectedRoute>
                  }
                />
                <Route path="/wishlist/shared/:token" element={<SharedWishlist />} />
                <Route
                  path="/orders/:orderId/feedback/:type"
                  element={
                    <ProtectedRoute>
                      <OrderFeedbackPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/orders/:orderId/invoice"
                  element={
                    <ProtectedRoute>
                      <InvoiceView />
                    </ProtectedRoute>
                  }
                />
                <Route path="/cart" element={<Cart />} />
                <Route path="/cart/checkout" element={<CheckoutPage />} />
                <Route
                  path="/cart/checkout/review"
                  element={
                    <ProtectedRoute>
                      <ReviewPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/product/:productIdOrSlug" element={<ProductDetail />} />
                <Route path="/product/:productIdOrSlug/reviews" element={<ProductReviews />} />
                <Route
                  path="/seller/:slug"
                  element={
                    <Suspense
                      fallback={
                        <div className="container mx-auto px-4 py-8">
                          <div className="h-64 w-full bg-gray-200 animate-pulse rounded mb-8" />
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                              <div key={i} className="h-96 bg-gray-200 animate-pulse rounded" />
                            ))}
                          </div>
                        </div>
                      }
                    >
                      <SellerStorefront />
                    </Suspense>
                  }
                />
                <Route
                  path="/seller/:slug/category/:categoryId"
                  element={
                    <Suspense
                      fallback={
                        <div className="container mx-auto px-4 py-8">
                          <div className="h-64 w-full bg-gray-200 animate-pulse rounded mb-8" />
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                              <div key={i} className="h-96 bg-gray-200 animate-pulse rounded" />
                            ))}
                          </div>
                        </div>
                      }
                    >
                      <SellerCategoryProducts />
                    </Suspense>
                  }
                />
                <Route
                  path="/seller/:slug/products"
                  element={
                    <Suspense
                      fallback={
                        <div className="container mx-auto px-4 py-8">
                          <div className="h-64 w-full bg-gray-200 animate-pulse rounded mb-8" />
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(8)].map((_, i) => (
                              <div key={i} className="h-96 bg-gray-200 animate-pulse rounded" />
                            ))}
                          </div>
                        </div>
                      }
                    >
                      <SellerCategoryProducts />
                    </Suspense>
                  }
                />
                <Route path="/shop-by-category" element={<Categories />} />
                <Route path="/events/deals" element={<DealsPage />} />
                <Route path="/best-sellers" element={<BestSellersPage />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/products/search" element={<SearchResults />} />
                <Route path="/help" element={<HelpCenter />} />
                <Route path="/help/tickets" element={<Tickets />} />
                <Route path="/help/tickets/new" element={<CreateTicket />} />
                <Route path="/help/tickets/:id" element={<TicketDetail />} />
                <Route path="/contact" element={<ContactUs />} />
                <Route
                  path="/contact/history"
                  element={
                    <ProtectedRoute>
                      <ContactHistory />
                    </ProtectedRoute>
                  }
                />
                <Route path="/blog" element={<BlogList />} />
                <Route path="/blog/:slug" element={<BlogDetail />} />
                <Route path="/about-us" element={<AboutUs />} />
                <Route path="/terms" element={<TermsAndConditions />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/return-refund-policy" element={<ReturnRefundPolicy />} />
                <Route path="/become-a-seller" element={<BecomeASeller />} />
                {/* <Route path="/chat" element={<LiveChat />} /> */}
                {/* Add other protected routes here */}
                {/* Example: <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} /> */}
              </Routes>
            </Layout>
          }
        />
      </Routes>
      </Suspense>
    </Router>
  )
}

export default App
