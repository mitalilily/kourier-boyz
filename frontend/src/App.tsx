import Layout from '@/components/Layout'
import AboutUs from '@/pages/AboutUs'
import BecomeASeller from '@/pages/BecomeASeller'
import PrivacyPolicy from '@/pages/PrivacyPolicy'
import ReturnRefundPolicy from '@/pages/ReturnRefundPolicy'
import TermsAndConditions from '@/pages/TermsAndConditions'
import BlogDetail from '@/pages/BlogDetail'
import BlogList from '@/pages/BlogList'
import Categories from '@/pages/Categories'
import ContactHistory from '@/pages/ContactHistory'
import ContactUs from '@/pages/ContactUs'
import HelpCenter from '@/pages/HelpCenter'
// import LiveChat from '@/pages/LiveChat'
import BestSellersPage from '@/pages/BestSellersPage'
import CreateTicket from '@/pages/CreateTicket'
import Login from '@/pages/Login'
import InvoiceView from '@/pages/InvoiceView'
import OrderFeedbackPage from '@/pages/OrderFeedbackPage'
import ProductDetail from '@/pages/ProductDetail'
import ProductReviews from '@/pages/ProductReviews'
import AccountSettings from '@/pages/profile/AccountSettings'
import Addresses from '@/pages/profile/Addresses'
import Notifications from '@/pages/profile/Notifications'
import Orders from '@/pages/profile/Orders'
import Payments from '@/pages/profile/Payments'
import PersonalInfo from '@/pages/profile/PersonalInfo'
import ProfileWishlist from '@/pages/profile/ProfileWishlist'
import Returns from '@/pages/profile/Returns'
import Security from '@/pages/profile/Security'
import ProfileLayout from '@/pages/ProfileLayout'
import Register from '@/pages/Register'
import ResetPassword from '@/pages/ResetPassword'
import SharedWishlist from '@/pages/SharedWishlist'
import TicketDetail from '@/pages/TicketDetail'
import Tickets from '@/pages/Tickets'
import VerifyEmail from '@/pages/VerifyEmail'
import Unsubscribe from '@/pages/Unsubscribe'
import Wishlist from '@/pages/Wishlist'
import React, { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom'
import Home from './components/Home/Home'
import ProtectedRoute from './components/ProtectedRoute'
import Cart from './pages/Cart'
import CheckoutPage from './pages/CheckoutPage'
import DealsPage from './pages/DealsPage'
import ProfileHistory from './pages/profile/ProfileHistory'
import ReviewPage from './pages/ReviewPage'
import SearchResults from './pages/SearchResults'
import { useAuthStore } from './store/authStore'
const SellerStorefront = lazy(() => import('@/pages/SellerStorefront'))
const SellerCategoryProducts = lazy(() => import('@/pages/SellerCategoryProducts'))

const ScrollToTop: React.FC = () => {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
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
                <Route path="/" element={<Home />} />
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
    </Router>
  )
}

export default App
