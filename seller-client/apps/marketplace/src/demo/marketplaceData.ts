import type { SellerOrderBatch, SellerOrdersResponse } from '../api/orders'
import type { Product, ProductsResponse } from '../api/products'
import type { SellerReturn, SellerReturnsResponse } from '../api/returns'
import type {
  SellerSettlementBatch,
  SellerSettlementBatchListResponse,
} from '../api/settlements'

const category = {
  _id: 'demo-category-lifestyle',
  name: 'Everyday Essentials',
  slug: 'everyday-essentials',
  parent: null,
}

export const DEMO_PRODUCTS: Product[] = [
  {
    _id: 'demo-product-tote',
    name: 'Everyday Canvas Tote',
    slug: 'everyday-canvas-tote',
    description: 'A structured canvas carryall for work, errands, and short trips.',
    shortDescription: 'Structured everyday carryall',
    price: 799,
    comparePrice: 999,
    costPrice: 420,
    sku: 'NS-TOTE-01',
    stock: 38,
    lowStockThreshold: 8,
    category,
    seller: 'demo-seller-001',
    images: [],
    mainImage: '',
    status: 'active',
    isFeatured: true,
    rating: 4.8,
    reviewCount: 126,
    soldCount: 384,
    viewCount: 4210,
    createdAt: '2026-08-12T09:00:00.000Z',
    updatedAt: '2026-10-11T12:30:00.000Z',
  },
  {
    _id: 'demo-product-bottle',
    name: 'Insulated Travel Bottle',
    slug: 'insulated-travel-bottle',
    description: 'A double-wall steel bottle that keeps drinks cold through the day.',
    shortDescription: 'Double-wall steel bottle',
    price: 899,
    comparePrice: 1199,
    costPrice: 510,
    sku: 'NS-BTL-02',
    stock: 6,
    lowStockThreshold: 10,
    category,
    seller: 'demo-seller-001',
    images: [],
    mainImage: '',
    status: 'active',
    isFeatured: true,
    rating: 4.7,
    reviewCount: 91,
    soldCount: 271,
    viewCount: 3380,
    createdAt: '2026-08-18T09:00:00.000Z',
    updatedAt: '2026-10-12T07:15:00.000Z',
  },
  {
    _id: 'demo-product-organiser',
    name: 'Desk Organiser Set',
    slug: 'desk-organiser-set',
    description: 'Three modular trays for a cleaner, calmer desk.',
    shortDescription: 'Three modular desk trays',
    price: 899,
    comparePrice: 1099,
    costPrice: 485,
    sku: 'NS-ORG-03',
    stock: 24,
    lowStockThreshold: 6,
    category,
    seller: 'demo-seller-001',
    images: [],
    mainImage: '',
    status: 'active',
    isFeatured: false,
    rating: 4.6,
    reviewCount: 58,
    soldCount: 194,
    viewCount: 2190,
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-10-10T10:45:00.000Z',
  },
  {
    _id: 'demo-product-pouch',
    name: 'Utility Zip Pouch',
    slug: 'utility-zip-pouch',
    description: 'A compact organiser for cables, stationery, and travel essentials.',
    shortDescription: 'Compact utility organiser',
    price: 449,
    comparePrice: 599,
    costPrice: 225,
    sku: 'NS-PCH-04',
    stock: 0,
    lowStockThreshold: 5,
    category,
    seller: 'demo-seller-001',
    images: [],
    mainImage: '',
    status: 'out_of_stock',
    isFeatured: false,
    rating: 4.5,
    reviewCount: 33,
    soldCount: 117,
    viewCount: 1450,
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-10-12T06:20:00.000Z',
  },
]

const order = (
  id: string,
  number: string,
  buyer: string,
  status: 'processing' | 'shipped' | 'delivered',
  total: number,
  orderedAt: string,
): SellerOrderBatch => ({
  batchId: `demo-batch-${id}`,
  batchCode: `KB-${number}`,
  summary: {
    orderCount: 1,
    buyerNames: buyer,
    paymentStatus: 'paid',
    status,
    total,
    orderedAt,
  },
  orders: [
    {
      _id: `demo-order-${id}`,
      orderNumber: number,
      batchId: `demo-batch-${id}`,
      batchCode: `KB-${number}`,
      buyer: { name: buyer, email: `${buyer.toLowerCase().replace(/\s+/g, '.')}@example.com` },
      paymentStatus: 'paid',
      paymentMethod: 'upi',
      status,
      total,
      orderedAt,
      shippingAddress: {
        name: buyer,
        phone: '9876543210',
        addressLine1: '42 Market Road',
        city: 'New Delhi',
        state: 'Delhi',
        postalCode: '110001',
        country: 'India',
      },
      items: [
        {
          item: { productId: 'demo-product-tote', name: 'Everyday Canvas Tote', sku: 'NS-TOTE-01' },
          quantity: 1,
          price: total,
          subtotal: total,
          sellerStatus: status,
        },
      ],
      canShip: status === 'processing',
    },
  ],
})

export const DEMO_ORDERS: SellerOrderBatch[] = [
  order('1048', '1048', 'Riya Kapoor', 'processing', 1698, '2026-10-12T08:40:00.000Z'),
  order('1047', '1047', 'Kabir Shah', 'shipped', 899, '2026-10-11T14:20:00.000Z'),
  order('1046', '1046', 'Ananya Rao', 'delivered', 1248, '2026-10-10T11:10:00.000Z'),
]

export const DEMO_RETURNS: SellerReturn[] = [
  {
    _id: 'demo-return-201',
    order: { _id: 'demo-order-1044', orderNumber: '1044', status: 'delivered', total: 899 },
    customer: { _id: 'demo-customer-1', name: 'Meera Joshi', email: 'meera.joshi@example.com' },
    reason: 'Size or fit',
    description: 'The organiser is smaller than expected.',
    images: [],
    status: 'REQUESTED',
    returnType: 'return',
    refundAmount: 899,
    timeline: [
      {
        status: 'REQUESTED',
        message: 'Customer requested a return.',
        timestamp: '2026-10-11T10:15:00.000Z',
      },
    ],
    createdAt: '2026-10-11T10:15:00.000Z',
    updatedAt: '2026-10-11T10:15:00.000Z',
  },
  {
    _id: 'demo-return-198',
    order: { _id: 'demo-order-1039', orderNumber: '1039', status: 'delivered', total: 799 },
    customer: { _id: 'demo-customer-2', name: 'Dev Malhotra', email: 'dev.m@example.com' },
    reason: 'Changed mind',
    images: [],
    status: 'REFUND_COMPLETED',
    returnType: 'return',
    refundAmount: 799,
    timeline: [
      {
        status: 'REFUND_COMPLETED',
        message: 'Refund completed.',
        timestamp: '2026-10-09T16:30:00.000Z',
      },
    ],
    createdAt: '2026-10-05T09:00:00.000Z',
    updatedAt: '2026-10-09T16:30:00.000Z',
  },
]

export const DEMO_SETTLEMENTS: SellerSettlementBatch[] = [
  {
    _id: 'KB-SET-2026-041',
    fromDate: '2026-10-01T00:00:00.000Z',
    toDate: '2026-10-07T23:59:59.000Z',
    ordersCount: 38,
    totalSaleAmount: 48620,
    totalCommissionAmount: 4862,
    totalOtherCharges: 480,
    totalNetPayout: 43278,
    status: 'PAID',
    invoiceNumber: 'KB-INV-DEMO-023',
    payoutDate: '2026-10-08T10:00:00.000Z',
    payoutReference: 'DEMO-UTR-87214',
    createdAt: '2026-10-08T08:00:00.000Z',
    updatedAt: '2026-10-08T10:00:00.000Z',
  },
  {
    _id: 'KB-SET-2026-042',
    fromDate: '2026-10-08T00:00:00.000Z',
    toDate: '2026-10-14T23:59:59.000Z',
    ordersCount: 44,
    totalSaleAmount: 58340,
    totalCommissionAmount: 5834,
    totalOtherCharges: 866,
    totalNetPayout: 51640,
    status: 'PENDING',
    createdAt: '2026-10-12T08:00:00.000Z',
    updatedAt: '2026-10-12T08:00:00.000Z',
  },
]

export const getDemoProducts = (params?: {
  status?: string
  search?: string
  page?: number
  limit?: number
}): ProductsResponse => {
  const search = params?.search?.trim().toLowerCase()
  const filtered = DEMO_PRODUCTS.filter(
    (product) =>
      (!params?.status || product.status === params.status) &&
      (!search || product.name.toLowerCase().includes(search) || product.sku.toLowerCase().includes(search)),
  )
  const page = params?.page || 1
  const limit = params?.limit || 10
  const start = (page - 1) * limit
  return {
    products: filtered.slice(start, start + limit),
    pagination: { total: filtered.length, page, limit, pages: Math.ceil(filtered.length / limit) },
  }
}

export const getDemoOrders = (params?: {
  status?: string
  paymentStatus?: string
  search?: string
  page?: number
  limit?: number
}): SellerOrdersResponse => {
  const search = params?.search?.trim().toLowerCase()
  const filtered = DEMO_ORDERS.filter((batch) => {
    const order = batch.orders[0]
    return (
      (!params?.status || order?.status === params.status) &&
      (!params?.paymentStatus || order?.paymentStatus === params.paymentStatus) &&
      (!search ||
        batch.batchCode?.toLowerCase().includes(search) ||
        order?.buyer.name?.toLowerCase().includes(search))
    )
  })
  const page = params?.page || 1
  const limit = params?.limit || 10
  const start = (page - 1) * limit
  return {
    success: true,
    data: filtered.slice(start, start + limit),
    pagination: { total: filtered.length, page, limit, pages: Math.ceil(filtered.length / limit) },
  }
}

export const getDemoReturns = (params?: {
  status?: string
  page?: number
  limit?: number
}): SellerReturnsResponse => {
  const filtered = DEMO_RETURNS.filter((item) => !params?.status || item.status === params.status)
  const page = params?.page || 1
  const limit = params?.limit || 20
  const start = (page - 1) * limit
  return {
    success: true,
    data: filtered.slice(start, start + limit),
    pagination: { total: filtered.length, page, limit, pages: Math.ceil(filtered.length / limit) },
  }
}

export const getDemoSettlements = (params?: {
  status?: 'PENDING' | 'PAID'
  page?: number
  limit?: number
}): SellerSettlementBatchListResponse => {
  const filtered = DEMO_SETTLEMENTS.filter(
    (settlement) => !params?.status || settlement.status === params.status,
  )
  const page = params?.page || 1
  const limit = params?.limit || 20
  const start = (page - 1) * limit
  return {
    success: true,
    data: filtered.slice(start, start + limit),
    pagination: { total: filtered.length, page, limit, pages: Math.ceil(filtered.length / limit) },
  }
}
