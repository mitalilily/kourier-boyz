import type { SellerOrderBatch, SellerOrdersResponse } from '../api/orders'
import type { Product, ProductsResponse } from '../api/products'
import type { SellerReturn, SellerReturnsResponse } from '../api/returns'
import type {
  SellerSettlementBatch,
  SellerSettlementBatchListResponse,
} from '../api/settlements'

// Demo access represents a newly opened store. Data appears only after the seller creates it.
export const DEMO_PRODUCTS: Product[] = []
export const DEMO_ORDERS: SellerOrderBatch[] = []
export const DEMO_RETURNS: SellerReturn[] = []
export const DEMO_SETTLEMENTS: SellerSettlementBatch[] = []

export const getDemoProducts = (params?: {
  status?: string
  search?: string
  page?: number
  limit?: number
}): ProductsResponse => {
  const page = params?.page || 1
  const limit = params?.limit || 10
  return {
    products: [],
    pagination: { total: 0, page, limit, pages: 0 },
  }
}

export const getDemoOrders = (params?: {
  status?: string
  paymentStatus?: string
  search?: string
  page?: number
  limit?: number
}): SellerOrdersResponse => {
  const page = params?.page || 1
  const limit = params?.limit || 10
  return {
    success: true,
    data: [],
    pagination: { total: 0, page, limit, pages: 0 },
  }
}

export const getDemoReturns = (params?: {
  status?: string
  page?: number
  limit?: number
}): SellerReturnsResponse => {
  const page = params?.page || 1
  const limit = params?.limit || 20
  return {
    success: true,
    data: [],
    pagination: { total: 0, page, limit, pages: 0 },
  }
}

export const getDemoSettlements = (params?: {
  status?: 'PENDING' | 'PAID'
  page?: number
  limit?: number
}): SellerSettlementBatchListResponse => {
  const page = params?.page || 1
  const limit = params?.limit || 20
  return {
    success: true,
    data: [],
    pagination: { total: 0, page, limit, pages: 0 },
  }
}
