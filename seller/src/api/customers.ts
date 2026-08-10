import { useQuery } from "@tanstack/react-query";
import API from "./axiosInstance";

export type OrderHistoryItem = {
  _id: string;
  orderNumber?: string;
  status: string;
  total: number;
  deliveredAt?: string;
  createdAt: string;
  items: Array<{
    _id: string;
    product?: {
      _id: string;
      name: string;
      slug?: string;
      mainImage?: string;
    };
    variant?: {
      _id: string;
      name: string;
      sku?: string;
      mainImage?: string;
    };
    quantity: number;
    price: number;
    effectivePrice?: number;
    subtotal: number;
  }>;
};

export type SellerCustomer = {
  _id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  // Location
  city?: string;
  state?: string;
  // Purchase stats
  totalOrders?: number;
  totalSpent?: number;
  avgOrderValue?: number;
  lastOrderDate?: string;
  firstOrderDate?: string;
  // Order history (with pagination)
  orderHistory?: OrderHistoryItem[];
  orderHistoryPagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  // Status
  isBlocked?: boolean;
};

export type LocationCount = {
  name: string;
  count: number;
};

export interface CustomerFilters {
  search?: string;
  tab?: "all" | "top" | "repeat" | "recent" | "new";
  page?: number;
  limit?: number;
}

export interface CustomerStats {
  totalCustomers: number;
  repeatCustomers: number;
  newThisMonth: number;
  totalSpent: number;
  avgOrderValue: number;
  topCustomersCount: number;
  recentOrdersCount: number;
  repeatCustomerPercentage: number;
  topCities: LocationCount[];
  topStates: LocationCount[];
}

export interface CustomerResponse {
  customers: SellerCustomer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// Seller: Get customer stats
export const useSellerCustomerStats = () => {
  return useQuery<CustomerStats>({
    queryKey: ["seller-customer-stats"],
    queryFn: async () => {
      const res = await API.get("/customers/stats");
      return res.data;
    },
  });
};

// Seller: Get customers
export const useSellerCustomers = (filters?: CustomerFilters) => {
  return useQuery<CustomerResponse>({
    queryKey: ["seller-customers", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.tab) params.append("tab", filters.tab);
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.limit) params.append("limit", filters.limit.toString());

      const res = await API.get(`/customers?${params.toString()}`);
      return res.data;
    },
  });
};

// Seller: Get a single customer by ID with pagination for order history
export const useSellerCustomer = (
  id: string,
  page: number = 1,
  limit: number = 10
) => {
  return useQuery<SellerCustomer>({
    queryKey: ["seller-customer", id, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      return (await API.get(`/customers/${id}?${params.toString()}`)).data;
    },
    enabled: !!id,
  });
};
