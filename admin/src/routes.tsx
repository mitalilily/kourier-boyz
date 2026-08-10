import { Spin } from 'antd'
import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layout/AdminLayout'
import AgreementsPage from './pages/Agreements'
import AnnouncementsPage from './pages/Announcements'
import AuditLogs from './pages/AuditLogs'
import BannersPage from './pages/Banners'
import BlogsPage from './pages/Blogs'
import BrandApprovals from './pages/BrandApprovals'
import CategoriesPage from './pages/Categories'
import CategoryExtensionRequests from './pages/CategoryExtensionRequests'
import ContactForms from './pages/ContactForms'
import CouponsPage from './pages/Coupons'
import CreditNotesPage from './pages/CreditNotes'
import CustomerDetail from './pages/CustomerDetail'
import Customers from './pages/Customers'
import Dashboard from './pages/Dashboard'
import FeedbackPage from './pages/Feedback'
import Login from './pages/Login'
import NotificationsPage from './pages/Notifications'
import AdminOrderDetail from './pages/Orders/OrderDetail'
import OrdersList from './pages/Orders/OrdersList'
import ProductDetail from './pages/ProductDetail'
import ProductsPage from './pages/Products'
import PromotionalEmailsPage from './pages/PromotionalEmails'
import Requests from './pages/Requests'
import ReturnsPage from './pages/Returns'
import ReviewsPage from './pages/Reviews'
import Roles from './pages/Roles'
import SellerCouponsPage from './pages/SellerCoupons'
import Settings from './pages/Settings'
import SettlementBatchDetail from './pages/SettlementBatchDetail'
import SettlementInvoicesPage from './pages/SettlementInvoices'
import SettlementsPage from './pages/Settlements'
import SettlementSettingsPage from './pages/SettlementSettings'
import SuperAdminProfile from './pages/SuperAdminProfile'
import SupportArticles from './pages/SupportArticles'

// Lazy load Calculations page for code splitting
const Calculations = lazy(() => import('./pages/Calculations'))
// import SupportChats from './pages/SupportChats'
import AdminGuide from './pages/AdminGuide'
import NotFound from './pages/NotFound'
import RouteErrorPage from './pages/RouteErrorPage'
import CourierChargesReport from './pages/Reports/CourierChargesReport'
import NewSellerRegistrationReport from './pages/Reports/NewSellerRegistrationReport'
import PortalIncomeReport from './pages/Reports/PortalIncomeReport'
import SalesPendingStatusReport from './pages/Reports/SalesPendingStatusReport'
import SalesReport from './pages/Reports/SalesReport'
import SettlementDueReport from './pages/Reports/SettlementDueReport'
import TcsReport from './pages/Reports/TcsReport'
import TdsReport from './pages/Reports/TdsReport'
import TicketSystemReport from './pages/Reports/TicketSystemReport'
import SellerDeactivationRequests from './pages/SellerDeactivationRequests'
import SellerReports from './pages/SellerReports'
import Tickets from './pages/Tickets'
import UserDetail from './pages/UserDetail'
import UserManagement from './pages/UserManagement'
import Users from './pages/Users'
import VerifyDevicePasswordChange from './pages/VerifyDevicePasswordChange'
import WebhookEvents from './pages/WebhookEvents'

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/verify-device-password-change/:token',
    element: <VerifyDevicePasswordChange />,
  },

  // Protected admin routes
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/sellers', element: <Users /> },
      { path: '/sellers/:id', element: <UserDetail /> },
      { path: '/sellers/:id/reports', element: <SellerReports /> },
      { path: '/sellers/deactivation-requests', element: <SellerDeactivationRequests /> },
      { path: '/users', element: <UserManagement /> },
      { path: '/customers', element: <Customers /> },
      { path: '/customers/:id', element: <CustomerDetail /> },
      { path: '/categories', element: <CategoriesPage /> },
      { path: '/brand-approvals', element: <BrandApprovals /> },
      { path: '/category-extensions', element: <CategoryExtensionRequests /> },
      { path: '/coupons', element: <CouponsPage /> },
      { path: '/seller-coupons', element: <SellerCouponsPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/products', element: <ProductsPage /> },
      { path: '/products/:id', element: <ProductDetail /> },
      { path: '/reviews', element: <ReviewsPage /> },
      { path: '/orders', element: <OrdersList /> },
      { path: '/orders/:id', element: <AdminOrderDetail /> },
      { path: '/returns', element: <ReturnsPage /> },
      { path: '/settlements', element: <SettlementsPage /> },
      { path: '/settlements/:id', element: <SettlementBatchDetail /> },
      { path: '/settlements/invoices', element: <SettlementInvoicesPage /> },
      { path: '/settlements/credit-notes', element: <CreditNotesPage /> },
      { path: '/settlements/audit-logs', element: <AuditLogs /> },
      { path: '/reports/sales', element: <SalesReport /> },
      { path: '/reports/sales-pending-status', element: <SalesPendingStatusReport /> },
      { path: '/reports/settlement-due', element: <SettlementDueReport /> },
      { path: '/reports/courier-charges', element: <CourierChargesReport /> },
      { path: '/reports/portal-income', element: <PortalIncomeReport /> },
      { path: '/reports/tds', element: <TdsReport /> },
      { path: '/reports/tcs', element: <TcsReport /> },
      { path: '/reports/new-sellers', element: <NewSellerRegistrationReport /> },
      { path: '/reports/tickets', element: <TicketSystemReport /> },
      { path: '/requests', element: <Requests /> },
      { path: '/banners', element: <BannersPage /> },
      { path: '/announcements', element: <AnnouncementsPage /> },
      { path: '/blogs', element: <BlogsPage /> },
      { path: '/promotional-emails', element: <PromotionalEmailsPage /> },
      { path: '/agreements', element: <AgreementsPage /> },
      { path: '/support/articles', element: <SupportArticles /> },
      // { path: '/support/chats', element: <SupportChats /> },
      { path: '/support/tickets', element: <Tickets /> },
      { path: '/support/contact', element: <ContactForms /> },
      { path: '/feedback', element: <FeedbackPage /> },
      {
        path: '/roles',
        element: (
          <ProtectedRoute requiredModule="roleManagement" requiredPermission="view">
            <Roles />
          </ProtectedRoute>
        ),
      },
      { path: '/settings', element: <Settings /> },
      { path: '/settings/settlement', element: <SettlementSettingsPage /> },
      {
        path: '/calculations',
        element: (
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <Spin size="large" />
              </div>
            }
          >
            <Calculations />
          </Suspense>
        ),
      },
      {
        path: '/profile',
        element: (
          <ProtectedRoute requiredRole="super-admin">
            <SuperAdminProfile />
          </ProtectedRoute>
        ),
      },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/guide', element: <AdminGuide /> },
      { path: '/webhooks', element: <WebhookEvents /> },
      { path: '/', element: <Dashboard /> },
      // Catch-all route for 404
      { path: '*', element: <NotFound /> },
    ],
  },
])
