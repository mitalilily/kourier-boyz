import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminLayout from './layout/AdminLayout'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import RouteErrorPage from './pages/RouteErrorPage'
import VerifyDevicePasswordChange from './pages/VerifyDevicePasswordChange'

const AdminGuide = lazy(() => import('./pages/AdminGuide'))
const AgreementsPage = lazy(() => import('./pages/Agreements'))
const AnnouncementsPage = lazy(() => import('./pages/Announcements'))
const AuditLogs = lazy(() => import('./pages/AuditLogs'))
const BannersPage = lazy(() => import('./pages/Banners'))
const BlogsPage = lazy(() => import('./pages/Blogs'))
const BrandApprovals = lazy(() => import('./pages/BrandApprovals'))
const Calculations = lazy(() => import('./pages/Calculations'))
const CategoriesPage = lazy(() => import('./pages/Categories'))
const CategoryExtensionRequests = lazy(() => import('./pages/CategoryExtensionRequests'))
const ContactForms = lazy(() => import('./pages/ContactForms'))
const CouponsPage = lazy(() => import('./pages/Coupons'))
const CreditNotesPage = lazy(() => import('./pages/CreditNotes'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'))
const Customers = lazy(() => import('./pages/Customers'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const FeedbackPage = lazy(() => import('./pages/Feedback'))
const NotificationsPage = lazy(() => import('./pages/Notifications'))
const AdminOrderDetail = lazy(() => import('./pages/Orders/OrderDetail'))
const OrdersList = lazy(() => import('./pages/Orders/OrdersList'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const ProductsPage = lazy(() => import('./pages/Products'))
const PromotionalEmailsPage = lazy(() => import('./pages/PromotionalEmails'))
const Requests = lazy(() => import('./pages/Requests'))
const ReturnsPage = lazy(() => import('./pages/Returns'))
const ReviewsPage = lazy(() => import('./pages/Reviews'))
const Roles = lazy(() => import('./pages/Roles'))
const SellerCouponsPage = lazy(() => import('./pages/SellerCoupons'))
const Settings = lazy(() => import('./pages/Settings'))
const SettlementBatchDetail = lazy(() => import('./pages/SettlementBatchDetail'))
const SettlementInvoicesPage = lazy(() => import('./pages/SettlementInvoices'))
const SettlementsPage = lazy(() => import('./pages/Settlements'))
const SettlementSettingsPage = lazy(() => import('./pages/SettlementSettings'))
const SuperAdminProfile = lazy(() => import('./pages/SuperAdminProfile'))
const SupportArticles = lazy(() => import('./pages/SupportArticles'))
const CourierChargesReport = lazy(() => import('./pages/Reports/CourierChargesReport'))
const NewSellerRegistrationReport = lazy(
  () => import('./pages/Reports/NewSellerRegistrationReport'),
)
const PortalIncomeReport = lazy(() => import('./pages/Reports/PortalIncomeReport'))
const SalesPendingStatusReport = lazy(() => import('./pages/Reports/SalesPendingStatusReport'))
const SalesReport = lazy(() => import('./pages/Reports/SalesReport'))
const SettlementDueReport = lazy(() => import('./pages/Reports/SettlementDueReport'))
const TcsReport = lazy(() => import('./pages/Reports/TcsReport'))
const TdsReport = lazy(() => import('./pages/Reports/TdsReport'))
const TicketSystemReport = lazy(() => import('./pages/Reports/TicketSystemReport'))
const SellerDeactivationRequests = lazy(() => import('./pages/SellerDeactivationRequests'))
const SellerReports = lazy(() => import('./pages/SellerReports'))
const Tickets = lazy(() => import('./pages/Tickets'))
const UserDetail = lazy(() => import('./pages/UserDetail'))
const UserManagement = lazy(() => import('./pages/UserManagement'))
const Users = lazy(() => import('./pages/Users'))
const WebhookEvents = lazy(() => import('./pages/WebhookEvents'))

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
          <Calculations />
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
