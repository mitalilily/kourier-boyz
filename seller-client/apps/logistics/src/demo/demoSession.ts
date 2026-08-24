import type { MerchantDashboardStats } from '../api/dashboard.api'
import type { IUserProfileDB } from '../types/user.types'

export const DEMO_LOGISTICS_SESSION_KEY = 'kourier_boyz_demo_logistics'

export const isDemoLogisticsSession = () =>
  typeof window !== 'undefined' && localStorage.getItem(DEMO_LOGISTICS_SESSION_KEY) === '1'

export const DEMO_LOGISTICS_USER: IUserProfileDB = {
  id: 'demo-logistics-seller-001',
  userId: 'demo-logistics-seller-001',
  onboardingStep: 3,
  monthlyOrderCount: '1000-2500',
  onboardingComplete: true,
  profileComplete: true,
  salesChannels: { marketplace: true, shopify: true },
  companyInfo: {
    businessName: 'Northstar Living Private Limited',
    contactPerson: 'Aarav Mehta',
    profilePicture: '',
    companyAddress: '22 Commerce Park, Andheri East',
    companyContactNumber: '+91 98765 43210',
    pincode: '400069',
    POCEmailVerified: true,
    POCPhoneVerified: true,
    state: 'Maharashtra',
    city: 'Mumbai',
    contactNumber: '+91 98765 43210',
    contactEmail: 'demo.seller@kourierboyz.com',
    brandName: 'Northstar Living',
    companyEmail: 'demo.seller@kourierboyz.com',
    companyLogoUrl: '',
    website: 'https://kourierboyz.com',
  },
  domesticKyc: { status: 'verified', updatedAt: new Date('2026-08-20T10:00:00Z') },
  bankDetails: {
    count: 1,
    primaryAccount: {
      id: 'demo-bank-001',
      accountHolder: 'Northstar Living Private Limited',
      accountNumber: 'XXXXXX4821',
      ifsc: 'HDFC0001234',
      bankName: 'HDFC Bank',
      branch: 'Andheri East',
      accountType: 'Current',
      status: 'verified',
      isPrimary: true,
    },
  },
  gstDetails: {
    gstNumber: '27AABCN4821A1Z5',
    legalName: 'Northstar Living Private Limited',
    registrationDate: '2024-02-12',
    state: 'Maharashtra',
  },
  businessType: ['b2c', 'd2c'],
  approved: true,
  approvedAt: '2026-08-20T10:00:00.000Z',
  rejectionReason: null,
  currentPlanId: 'kb-growth-demo',
  currentPlanName: 'Growth',
  currentB2CPlanId: 'kb-b2c-growth-demo',
  currentB2CPlanName: 'B2C Growth',
  currentB2BPlanId: 'kb-b2b-standard-demo',
  currentB2BPlanName: 'B2B Standard',
  role: 'customer',
  employeeId: null,
  employeeRole: null,
  employeeIsActive: null,
  moduleAccess: null,
  submittedAt: '2026-08-18T09:00:00.000Z',
  updatedAt: '2026-08-22T12:30:00.000Z',
}

const weekDates = ['18 Aug', '19 Aug', '20 Aug', '21 Aug', '22 Aug', '23 Aug', '24 Aug']
const monthDates = Array.from({ length: 30 }, (_, index) => `${index + 1} Aug`)

export const DEMO_LOGISTICS_DASHBOARD: MerchantDashboardStats = {
  asOfDate: '2026-08-24',
  todayOperations: { orders: 86, pending: 14, inTransit: 47, delivered: 25 },
  financial: {
    walletBalance: 86420,
    todayRevenue: 142780,
    totalRevenue: 3286450,
    totalShippingCharges: 286340,
    totalFreightCharges: 248760,
    profit: 37580,
    codAmount: 684200,
    codRemittanceDue: 126800,
    codRemittanceCredited: 557400,
  },
  operational: {
    deliverySuccessRate: 96.4,
    ndrRate: 2.1,
    rtoRate: 1.5,
    avgDeliveryTime: 51,
    totalOrders: 2846,
    deliveredOrders: 2744,
    ndrCount: 18,
    rtoCount: 11,
  },
  actions: {
    ndrCount: 7,
    rtoCount: 3,
    weightDiscrepancyCount: 2,
    openTickets: 4,
    inProgressTickets: 2,
    pendingInvoices: 3,
    pendingInvoiceAmount: 42800,
    overdueInvoices: 0,
    overdueInvoiceAmount: 0,
  },
  couriers: {
    performance: {
      Delhivery: { count: 1160, delivered: 1128, revenue: 1284000, deliveryRate: 97.2 },
      Bluedart: { count: 920, delivered: 889, revenue: 1162000, deliveryRate: 96.6 },
      Xpressbees: { count: 766, delivered: 727, revenue: 840450, deliveryRate: 94.9 },
    },
    distribution: [
      { courier: 'Delhivery', count: 1160 },
      { courier: 'Bluedart', count: 920 },
      { courier: 'Xpressbees', count: 766 },
    ],
  },
  geographic: {
    topDestinations: [
      { city: 'Mumbai', state: 'Maharashtra', count: 486 },
      { city: 'Delhi', state: 'Delhi', count: 392 },
      { city: 'Bengaluru', state: 'Karnataka', count: 348 },
      { city: 'Hyderabad', state: 'Telangana', count: 274 },
      { city: 'Pune', state: 'Maharashtra', count: 221 },
    ],
  },
  charts: {
    ordersByDate: weekDates.map((date, index) => ({ date, orders: [312, 338, 355, 381, 402, 428, 446][index] })),
    revenueByDate: weekDates.map((date, index) => ({ date, revenue: [338000, 362000, 389000, 421000, 448000, 475000, 512000][index] })),
    ordersByDate30: monthDates.map((date, index) => ({ date, orders: 260 + ((index * 23) % 190) })),
    revenueByDate30: monthDates.map((date, index) => ({ date, revenue: 310000 + ((index * 27300) % 240000) })),
    ordersByStatus: [
      { status: 'Delivered', count: 2744 },
      { status: 'In Transit', count: 47 },
      { status: 'Pending', count: 26 },
      { status: 'NDR', count: 18 },
      { status: 'RTO', count: 11 },
    ],
    revenueByOrderType: [
      { type: 'Prepaid', revenue: 2602250 },
      { type: 'COD', revenue: 684200 },
    ],
    ordersByCourier: [
      { courier: 'Delhivery', count: 1160 },
      { courier: 'Bluedart', count: 920 },
      { courier: 'Xpressbees', count: 766 },
    ],
    revenueByCourier: [
      { courier: 'Delhivery', revenue: 1284000 },
      { courier: 'Bluedart', revenue: 1162000 },
      { courier: 'Xpressbees', revenue: 840450 },
    ],
  },
  metrics: {
    avgOrderValue: 1155,
    totalPrepaidOrders: 2162,
    totalCodOrders: 684,
    prepaidRevenue: 2602250,
    codRevenue: 684200,
    topRevenueCities: [
      { city: 'Mumbai', revenue: 612000 },
      { city: 'Delhi', revenue: 488000 },
      { city: 'Bengaluru', revenue: 436000 },
    ],
  },
  recentOrders: [],
  trends: {
    ordersGrowth: 18.6,
    revenueGrowth: 22.4,
    thisWeekOrders: 2662,
    lastWeekOrders: 2245,
    thisWeekRevenue: 2945000,
    lastWeekRevenue: 2406000,
  },
  recentActivity: {
    transactions: [
      { id: 'txn-001', type: 'credit', amount: 50000, reason: 'Wallet recharge', createdAt: new Date('2026-08-24T09:20:00Z') },
      { id: 'txn-002', type: 'debit', amount: 1840, reason: 'Shipment charges', createdAt: new Date('2026-08-24T08:45:00Z') },
      { id: 'txn-003', type: 'credit', amount: 42780, reason: 'COD settlement', createdAt: new Date('2026-08-23T16:15:00Z') },
    ],
    recentOrders: [
      { id: 'order-001', orderNumber: 'KB-28461', status: 'In Transit', amount: 2480, createdAt: '2026-08-24T10:20:00Z' },
      { id: 'order-002', orderNumber: 'KB-28460', status: 'Delivered', amount: 1890, createdAt: '2026-08-24T09:42:00Z' },
      { id: 'order-003', orderNumber: 'KB-28459', status: 'Pickup Scheduled', amount: 3260, createdAt: '2026-08-24T08:55:00Z' },
      { id: 'order-004', orderNumber: 'KB-28458', status: 'Delivered', amount: 1540, createdAt: '2026-08-23T17:30:00Z' },
    ],
  },
}
