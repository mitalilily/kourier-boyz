import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import SellerLayout from './layout/SellerLayout'
import AgreementViewer from './pages/AgreementViewer'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsAndConditions from './pages/TermsAndConditions'
import SellerCategories from './pages/Categories'
import SellerCertificates from './pages/Certificates'
import Brands from './pages/Brands'
import Coupons from './pages/Coupons'
import CreditNotesPage from './pages/CreditNotes'
import CustomerDetail from './pages/CustomerDetail'
import Customers from './pages/Customers'
import Dashboard from './pages/Dashboard'
import ForgotPassword from './pages/ForgotPassword'
import { KYCSubmission } from './pages/KYCSubmission'
import Login from './pages/Login'
import SellerNotifications from './pages/Notifications'
import OrderDetail from './pages/Orders/OrderDetail'
import OrdersList from './pages/Orders/OrdersList'
import ProductForm from './pages/Products/ProductForm'
import ProductList from './pages/Products/ProductList'
import ProductView from './pages/Products/ProductView'
import SellerProfile from './pages/Profile/SellerProfile'
import Register from './pages/Register'
import ReportsPage from './pages/Reports'
import ResetPassword from './pages/ResetPassword'
import ReturnsPage from './pages/Returns'
import Reviews from './pages/Reviews'
import SellerLedger from './pages/SellerLedger'
import SettlementBatchDetail from './pages/SettlementBatchDetail'
import SettlementInvoicesPage from './pages/SettlementInvoices'
import SettlementsPage from './pages/Settlements'
import StoreSettings from './pages/StoreSettings'
import TcsReport from './pages/TcsReport'
import TdsReport from './pages/TdsReport'
import Tickets from './pages/Tickets'
import VerifyEmail from './pages/VerifyEmail'
import WaitingApproval from './pages/WaitingApproval'

const AppRoutes = () => {
  return (
    <BrowserRouter basename="/store">
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />

        {/* KYC Submission (Protected - must be logged in) */}
        <Route
          path="/submit-kyc"
          element={
            <ProtectedRoute>
              <KYCSubmission />
            </ProtectedRoute>
          }
        />

        {/* Waiting for Approval */}
        <Route
          path="/waiting-approval"
          element={
            <ProtectedRoute>
              <WaitingApproval />
            </ProtectedRoute>
          }
        />

        {/* Protected Routes - All pages accessible, but with conditional functionality */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <SellerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<SellerProfile />} />
          <Route path="store-settings" element={<StoreSettings />} />
          <Route path="products" element={<ProductList />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductView />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="orders" element={<OrdersList />} />
          <Route path="orders/batch/:batchId" element={<OrderDetail />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="settlements" element={<SettlementsPage />} />
          <Route path="settlements/:id" element={<SettlementBatchDetail />} />
          <Route path="invoices" element={<SettlementInvoicesPage />} />
          <Route path="credit-notes" element={<CreditNotesPage />} />
          <Route path="ledger" element={<SellerLedger />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/tds" element={<TdsReport />} />
          <Route path="reports/tcs" element={<TcsReport />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="coupons" element={<Coupons />} />
          <Route path="categories" element={<SellerCategories />} />
          <Route path="notifications" element={<SellerNotifications />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="certificates" element={<SellerCertificates />} />
          <Route path="brands" element={<Brands />} />
          <Route path="agreements/:type" element={<AgreementViewer />} />
          <Route path="terms" element={<TermsAndConditions />} />
          <Route path="privacy-policy" element={<PrivacyPolicy />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRoutes
