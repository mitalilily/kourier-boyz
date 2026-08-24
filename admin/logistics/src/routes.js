import {
  IconAdjustments,
  IconAlertTriangle,
  IconArrowBackUp,
  IconBell,
  IconCoinRupee,
  IconDashboard,
  IconHelpCircle,
  IconInfoCircle,
  IconKey,
  IconLogin2,
  IconPackageExport,
  IconSettings,
  IconStar,
  IconTools,
  IconTrack,
  IconTruck,
  IconUser,
} from '@tabler/icons-react'
import { FaMoneyBill } from 'react-icons/fa'
import { MdAccountBalanceWallet } from 'react-icons/md'
import { RiScales3Line } from 'react-icons/ri'

// Components
import { lazy, Suspense } from 'react'
import { BsCreditCard2Back } from 'react-icons/bs'
import { CiCalculator1 } from 'react-icons/ci'
import { IoLocation } from 'react-icons/io5'
import { MdGavel } from 'react-icons/md'
import { AdminRoute } from 'views/Auth/AdminRoute'
import SignIn from 'views/Auth/SignIn'
import AdminBillingInvoices from 'views/Billing/AdminBillingInvoices'
import AdminBillingPreferences from 'views/Billing/AdminBillingPreferences'
import AdminCodRemittancePage from 'views/CodRemittance/AdminCodRemittancePage'
import Couriers from 'views/Couriers/Couriers'
import CourierCredentials from 'views/Couriers/CourierCredentials'
import ServiceProviders from 'views/Couriers/ServiceProviders'
import Dashboard from 'views/Dashboard/Dashboard'
import DeveloperLogs from 'views/Developer/DeveloperLogs'
import ApiIntegration from 'views/Integrations/ApiIntegration'
import AdminNdr from 'views/Ops/AdminNdr'
import AdminRto from 'views/Ops/AdminRto'
import AdminNotificationsPage from 'views/Notifications/AdminNotificationsPage'
import Orders from 'views/Orders/Orders'
import FtlRequests from 'views/FTL/FtlRequests'
import InternationalShipments from 'views/International/InternationalShipments'
import PlanManagement from 'views/PlanManagement/PlanManagement'
import ServiceabilityPage from 'views/Serviceability/ServiceabilityPage'
import PaymentOptionsSettings from 'views/Settings/PaymentOptionsSettings'
import AdminChangePassword from 'views/Settings/AdminChangePassword'
import AboutUsEditor from 'views/Support/AboutUsEditor'
import AdminTicketDashboard from 'views/Support/AdminTicketsDashboard'
import OrderTrackingPage from 'views/Tools/OrderTrackingPage'
import RateCalculatorPage from 'views/Tools/RateCalculatorPage'
import UserDetails from 'views/UsersManagement/UserDetails'
import UsersManagementPage from 'views/UsersManagement/UsersManagementPage'
import AdminWallets from 'views/Wallets/AdminWallets'
import AdminDisputeManagement from 'views/WeightReconciliation/AdminDisputeManagement'
import AdminWeightReconciliationDashboard from 'views/WeightReconciliation/AdminWeightReconciliationDashboard'
import ZoneMappingsPage from 'views/Zones/ZoneMappingsPage'
import ZonesManagement from 'views/Zones/ZonesManagement'

const HolidayManagement = lazy(() => import('views/B2B/HolidayManagement'))
const AdditionalChargeMasters = lazy(() => import('views/RateCard/AdditionalChargeMasters'))
const DieselRates = lazy(() => import('views/RateCard/DieselRates'))
const InternationalRateCalculator = lazy(() => import('views/Tools/InternationalRateCalculator'))

// ------------------ ROUTES ------------------

const dashRoutes = [
  // ========== DASHBOARD ==========
  // Dashboard (home page)
  {
    path: '/dashboard',
    name: 'Dashboard',
    icon: <IconDashboard size={20} />,
    component: () => (
      <AdminRoute>
        <Dashboard />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // ========== CORE OPERATIONS ==========
  // Orders (most frequently used)
  {
    path: '/orders',
    name: 'Orders',
    icon: <IconPackageExport />,
    component: () => (
      <AdminRoute>
        <Orders />
      </AdminRoute>
    ),
    layout: '/admin',
  },
  {
    path: '/ftl-requests',
    name: 'FTL Requests',
    icon: <IconTruck />,
    component: () => (
      <AdminRoute>
        <FtlRequests />
      </AdminRoute>
    ),
    layout: '/admin',
  },
  {
    path: '/international-shipments',
    name: 'International Shipments',
    icon: <IconTruck />,
    component: () => (
      <AdminRoute>
        <InternationalShipments />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // Operations (NDR, RTO)
  {
    category: true,
    name: 'Operations',
    state: 'opsCollapse',
    icon: <IconSettings size={20} />,
    layout: '/admin',
    views: [
      {
        path: '/ops/ndr',
        name: 'NDR',
        icon: <IconAlertTriangle />,
        component: () => (
          <AdminRoute>
            <AdminNdr />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/ops/rto',
        name: 'RTO',
        icon: <IconArrowBackUp />,
        component: () => (
          <AdminRoute>
            <AdminRto />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      // Pickups UI removed; cancellation is available from Orders or API
    ],
  },

  // ========== USER & BUSINESS MANAGEMENT ==========
  {
    path: '/users-management/:id',
    name: 'User Details',
    component: () => (
      <AdminRoute>
        <UserDetails />
      </AdminRoute>
    ),
    layout: '/admin',
    show: false,
  },
  {
    path: '/users-management',
    name: 'Users Management',
    icon: <IconUser size={20} />,
    component: () => (
      <AdminRoute>
        <UsersManagementPage />
      </AdminRoute>
    ),
    layout: '/admin',
  },
  {
    path: '/notifications',
    name: 'Notifications',
    icon: <IconBell size={20} />,
    component: () => (
      <AdminRoute>
        <AdminNotificationsPage />
      </AdminRoute>
    ),
    layout: '/admin',
    show: false,
  },

  // Unified rate card workspace
  {
    category: true,
    name: 'Rate Card',
    state: 'rateCardCollapse',
    icon: <BsCreditCard2Back size={19} />,
    layout: '/admin',
    views: [
      {
        path: '/rate-card',
        name: 'Rate Card',
        icon: <BsCreditCard2Back />,
        component: () => <AdminRoute><PlanManagement /></AdminRoute>,
        layout: '/admin',
        exact: true,
      },
      {
        path: '/rate-card/additional-charges',
        name: 'Additional Charges',
        icon: <IconAdjustments />,
        component: () => <AdminRoute><Suspense fallback={<div>Loading...</div>}><AdditionalChargeMasters /></Suspense></AdminRoute>,
        layout: '/admin',
      },
      {
        path: '/rate-card/diesel-rates',
        name: 'Diesel Rates',
        icon: <IconCoinRupee />,
        component: () => <AdminRoute><Suspense fallback={<div>Loading...</div>}><DieselRates /></Suspense></AdminRoute>,
        layout: '/admin',
      },
      {
        path: '/rate-card/holidays',
        name: 'Holidays',
        icon: <IconStar />,
        component: () => <AdminRoute><Suspense fallback={<div>Loading...</div>}><HolidayManagement /></Suspense></AdminRoute>,
        layout: '/admin',
      },
    ],
  },

  // ========== SHIPPING & LOGISTICS ==========
  // Shipping Management (Couriers + Rate Card + Serviceability + Zones)
  {
    category: true,
    name: 'Shipping Management',
    state: 'shippingCollapse',
    icon: <IconTruck size={21} />,
    views: [
      {
        path: '/couriers',
        name: 'Couriers',
        icon: <IconTruck />,
        component: () => (
          <AdminRoute>
            <Couriers />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/courier-credentials',
        name: 'Courier Credentials',
        icon: <IconKey />,
        component: () => (
          <AdminRoute>
            <CourierCredentials />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/service-providers',
        name: 'Service Providers',
        icon: <IconTruck />,
        component: () => (
          <AdminRoute>
            <ServiceProviders />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/b2b-zones',
        name: 'B2B Zones',
        icon: <IoLocation />,
        component: () => (
          <AdminRoute>
            <ZonesManagement defaultBusinessType="B2B" />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/zones-mappings/:zoneId',
        name: 'Zone Mappings',
        component: () => (
          <AdminRoute>
            <ZoneMappingsPage />
          </AdminRoute>
        ),
        layout: '/admin',
        show: false,
      },
      {
        path: '/serviceability',
        name: 'Serviceability',
        icon: <IoLocation />,
        component: () => (
          <AdminRoute>
            <ServiceabilityPage />
          </AdminRoute>
        ),
        layout: '/admin',
      },

    ],
  },

  // ========== FINANCIAL ==========
  // Billing (Invoices, COD Remittance, Wallet)
  {
    category: true,
    path: '/billing',
    name: 'Billing',
    state: 'billingCollapse',
    icon: <FaMoneyBill />,
    layout: '/admin',
    views: [
      {
        path: '/billing-invoices',
        name: 'Invoices',
        icon: <MdAccountBalanceWallet />,
        component: () => (
          <AdminRoute>
            <AdminBillingInvoices />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/billing-preferences',
        name: 'Billing Preferences',
        icon: <IconAdjustments />,
        component: () => (
          <AdminRoute>
            <AdminBillingPreferences />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/cod-remittance',
        name: 'COD Remittance',
        icon: <MdAccountBalanceWallet />,
        component: () => (
          <AdminRoute>
            <AdminCodRemittancePage />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/wallet',
        name: 'Wallet',
        icon: <IconCoinRupee />,
        component: () => (
          <AdminRoute>
            <AdminWallets />
          </AdminRoute>
        ),
        layout: '/admin',
      },
    ],
  },

  // Reconciliation (Weight Discrepancies, Disputes)
  {
    category: true,
    name: 'Reconciliation',
    state: 'reconciliationCollapse',
    icon: <RiScales3Line size={20} />,
    layout: '/admin',
    views: [
      {
        path: '/weight-reconciliation',
        name: 'Weight Discrepancies',
        icon: <RiScales3Line />,
        component: () => (
          <AdminRoute>
            <AdminWeightReconciliationDashboard />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/dispute-management',
        name: 'Dispute Management',
        icon: <MdGavel />,
        component: () => (
          <AdminRoute>
            <AdminDisputeManagement />
          </AdminRoute>
        ),
        layout: '/admin',
      },
    ],
  },

  // ========== TOOLS & UTILITIES ==========
  // Tools (Rate Calculator, Order Tracking)
  {
    category: true,
    path: '/tools',
    name: 'Tools',
    state: 'toolsCollapse',
    icon: <IconTools size={20} />,
    layout: '/admin',
    views: [
      {
        path: '/rate-calculator',
        name: 'Rate Calculator',
        icon: <CiCalculator1 />,
        component: () => (
          <AdminRoute>
            <RateCalculatorPage />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/tools/international-rate-calculator',
        name: 'Int. Rate Calculator',
        icon: <CiCalculator1 />,
        component: () => <AdminRoute><Suspense fallback={<div>Loading...</div>}><InternationalRateCalculator /></Suspense></AdminRoute>,
        layout: '/admin',
      },
      {
        path: '/order-tracking',
        name: 'Order Tracking',
        icon: <IconTrack />,
        component: () => (
          <AdminRoute>
            <OrderTrackingPage />
          </AdminRoute>
        ),
        layout: '/admin',
      },
      {
        path: '/api-integration',
        name: 'API Integration',
        icon: <IconKey size={20} />,
        component: () => (
          <AdminRoute>
            <ApiIntegration />
          </AdminRoute>
        ),
        layout: '/admin',
      },
    ],
  },

  // ========== CONTENT & SUPPORT ==========
  // Blogs
  // {
  //   category: true,
  //   name: 'Blogs',
  //   state: 'blogsCollapse',
  //   icon: <FaBlog />,
  //   views: [
  //     {
  //       path: '/blogs',
  //       name: 'All Blogs',
  //       icon: <FaBloggerB />,
  //       component: () => (
  //         <AdminRoute>
  //           <Blogs />
  //         </AdminRoute>
  //       ),
  //       layout: '/admin',
  //     },
  //     {
  //       path: '/create-blog',
  //       name: 'Create Blog',
  //       icon: <MdCreate />,
  //       component: () => (
  //         <AdminRoute>
  //           <CreateBlog />
  //         </AdminRoute>
  //       ),
  //       layout: '/admin',
  //     },
  //     {
  //       path: '/create-blog/:id',
  //       name: 'Edit Blog',
  //       component: () => (
  //         <AdminRoute>
  //           <CreateBlog />
  //         </AdminRoute>
  //       ),
  //       layout: '/admin',
  //       show: false,
  //     },
  //   ],
  // },

  // Support
  // Place the more specific route first so it doesn't get shadowed by `/support`
  {
    path: '/about-us',
    name: 'About Us Page',
    icon: <IconInfoCircle />,
    component: () => (
      <AdminRoute>
        <AboutUsEditor />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  {
    path: '/support',
    name: 'Support',
    icon: <IconHelpCircle />,
    component: () => (
      <AdminRoute>
        <AdminTicketDashboard />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // ========== SETTINGS ==========
  {
    path: '/settings/payment-options',
    name: 'Payment Options',
    icon: <IconSettings />,
    component: () => (
      <AdminRoute>
        <PaymentOptionsSettings />
      </AdminRoute>
    ),
    layout: '/admin',
  },
  {
    path: '/settings/change-password',
    name: 'Change Password',
    icon: <IconKey />,
    component: () => (
      <AdminRoute>
        <AdminChangePassword />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  {
    path: '/developer',
    name: 'Developer',
    icon: <IconTools size={20} />,
    component: () => (
      <AdminRoute>
        <DeveloperLogs />
      </AdminRoute>
    ),
    layout: '/admin',
  },

  // ========== AUTH ==========
  // Auth (hidden from sidebar)
  {
    path: '/signin',
    name: 'Sign In',
    icon: <IconLogin2 />,
    component: SignIn,
    layout: '/auth',
    show: false,
  },
]

export default dashRoutes
