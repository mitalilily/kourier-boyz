export interface ProductViewResponse {
  viewCount: number;
  userView?: {
    viewCount: number;
    firstViewedAt: string;
    lastViewedAt: string;
  };
}

export interface CustomerHighlight {
  title: string;
  description: string;
}

export interface CustomerHighlightsResponse {
  highlights: CustomerHighlight[];
  reviewCount: number;
}

export interface ProductReview {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  createdAt: string;
  updatedAt?: string;
  reviewer: {
    name: string;
    avatarUrl?: string;
    city?: string;
    state?: string;
  };
  isVerifiedPurchase?: boolean;
  likes?: number;
  dislikes?: number;
  hasLiked?: boolean;
  hasDisliked?: boolean;
  images?: string[];
  videos?: string[];
  moderationStatus?: "pending" | "approved" | "rejected";
  moderationReason?: string;
  isOwner?: boolean;
}

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import API from "../lib/axios";
import { demoProducts } from "../components/Home/demoStoreData";
import {
  getDemoFilters,
  getDemoPagination,
  getDemoProduct,
  queryDemoProducts,
} from "../lib/demoCatalog";

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price?: number;
  effectivePrice?: number; // What customer actually pays (from backend)
  comparePrice?: number;
  mainImage?: string;
  images: string[];
  videos?: string[];
  category: {
    _id: string;
    name: string;
    slug: string;
    mainImage?: string;
  };
  seller: {
    _id: string;
    name: string;
    storeName: string;
    storeDescription?: string;
    storeSlug: string;
    sellerRating?: number;
    sellerReviewCount?: number;
  };
  brand?: string;
  status: "active" | "inactive" | "out_of_stock";
  isFeatured: boolean;
  rating?: number;
  reviewCount?: number;
  soldCount: number;
  viewCount: number;
  discountPercent?: number;
  discountStart?: string;
  discountEnd?: string;
  hasVariants?: boolean;
  variants?: Array<Record<string, unknown>>;
  stock?: number;
  totalStock?: number;
  sku?: string;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  lowStockThreshold?: number;
  specifications?: Array<{ key: string; value: string }>;
  features?: string[];
  freeShipping?: boolean;
  requiresShipping?: boolean;
  taxRate?: number;
  tags?: string[];
  // Manufacturer & Importer Information
  manufacturerName?: string;
  manufacturerAddress?: string;
  importerName?: string;
  importerAddress?: string;
  countryOfOrigin?: string;
  // Seller/Product Features
  payOnDelivery?: boolean;
  returnable?: boolean;
  returnDays?: number;
  warranty?: boolean;
  warrantyDays?: number;
  nextDayDelivery?: boolean;
  securePayment?: boolean;
  filterMetadata?: Array<{ key: string; values: string[] }>;
  attributeMetadata?: Record<string, Array<{ label: string; hex?: string }>>;
  variantImages?: Array<{
    attributes: Record<string, string>;
    mainImage?: string;
    images?: string[];
  }>;
  viewInfo?: {
    viewCount: number;
    firstViewedAt: string;
    lastViewedAt: string;
  };
  reviews?: ProductReview[];
}

export interface CreateProductReviewInput {
  rating: number;
  comment: string;
  title?: string;
  postAnonymously?: boolean; // For posting anonymously
}

interface SubmitProductReviewVariables {
  productId: string;
  productQueryKey: string;
  formData: FormData;
}

export interface CreateProductReviewResponse {
  review: ProductReview;
  rating: number;
  reviewCount: number;
  message?: string;
  moderationStatus?: "pending" | "approved" | "rejected";
}

export interface CategoryHighlight {
  category: {
    _id: string;
    name: string;
    slug: string;
    mainImage?: string;
    hoverImage?: string;
  };
  products: Product[];
}

export interface CategoryHighlightsResponse {
  discount: CategoryHighlight | null;
  budget: CategoryHighlight | null;
}

export interface AdditionalCategoryHighlightsResponse {
  uptoForty: CategoryHighlight | null;
  topRated: CategoryHighlight | null;
}
export interface ProductsResponse {
  products: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasMore?: boolean;
  };
}

// Fetch all products
export const useProducts = (params?: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: "asc" | "desc";
  isFeatured?: boolean;
  minPrice?: number;
  maxPrice?: number;
}) => {
  return useQuery<ProductsResponse>({
    queryKey: ["products", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();

      if (params?.search) {
        queryParams.append("search", params.search);
      }
      if (params?.category) {
        queryParams.append("category", params.category);
      }
      if (params?.page) {
        queryParams.append("page", String(params.page));
      }
      if (params?.limit) {
        queryParams.append("limit", String(params.limit));
      }
      if (params?.sortBy) {
        queryParams.append("sortBy", params.sortBy);
      }
      if (params?.order) {
        queryParams.append("order", params.order);
      }
      if (params?.isFeatured !== undefined) {
        queryParams.append("isFeatured", String(params.isFeatured));
      }
      if (params?.minPrice) {
        queryParams.append("minPrice", String(params.minPrice));
      }
      if (params?.maxPrice) {
        queryParams.append("maxPrice", String(params.maxPrice));
      }

      const url = queryParams.toString()
        ? `/products?${queryParams}`
        : "/products";
      const response = await API.get(url);
      return response.data;
    },
  });
};

// Fetch featured products
export const useFeaturedProducts = (limit?: number) => {
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", "featured", limit],
    queryFn: async () => {
      const url = limit
        ? `/products/featured?limit=${limit}`
        : "/products/featured";
      const response = await API.get(url);
      return response.data;
    },
  });
};

// Fetch trending products
export const useTrendingProducts = (limit?: number) => {
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", "trending", limit],
    queryFn: async () => {
      const url = limit
        ? `/products/trending?limit=${limit}`
        : "/products/trending";
      const response = await API.get(url);
      return response.data;
    },
  });
};

type DealsScope = "today" | "all" | "all-deals";
export type DealsSort = "relevance" | "price_asc" | "price_desc" | "newest";
const DEFAULT_DEALS_LIMIT = 20;

export const useDealsProducts = (options?: {
  take?: number;
  scope?: DealsScope;
  skip?: number;
  sort?: DealsSort;
}) => {
  const take = options?.take;
  const scope = options?.scope ?? "today";
  const skip = options?.skip ?? 0;
  const sort = options?.sort;
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", "deals", scope, take, skip, sort],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (take !== undefined) {
        params.set("take", String(take));
      }
      if (skip > 0) {
        params.set("skip", String(skip));
      }
      if (sort) {
        params.set("sort", sort);
      }

      const queryString = params.toString();
      const basePath =
        scope === "today" ? "/products/deals" : `/products/deals/${scope}`;
      const url = queryString ? `${basePath}?${queryString}` : basePath;

      const { data } = await API.get<{ products: Product[] }>(url);
      return data;
    },
  });
};

interface DealsInfiniteOptions {
  take?: number;
  scope?: DealsScope;
  sort?: DealsSort;
}

export const useDealsProductsInfinite = (options?: DealsInfiniteOptions) => {
  const take = options?.take ?? DEFAULT_DEALS_LIMIT;
  const scope = options?.scope ?? "today";
  const sort = options?.sort ?? "relevance";
  const fallbackProducts = queryDemoProducts({ sort }).filter(
    (product) => (product.discountPercent || 0) > 0,
  );

  return useInfiniteQuery<{ products: Product[] }>({
    queryKey: ["products", "deals", "infinite", scope, take, sort],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const skip = typeof pageParam === "number" ? pageParam : 0;
      const params = new URLSearchParams();
      params.set("take", String(take));
      if (skip > 0) {
        params.set("skip", String(skip));
      }
      if (sort) {
        params.set("sort", sort);
      }

      const queryString = params.toString();
      const basePath =
        scope === "today" ? "/products/deals" : `/products/deals/${scope}`;
      const url = queryString ? `${basePath}?${queryString}` : basePath;

      try {
        const { data } = await API.get<{ products: Product[] }>(url);
        if (data && typeof data === "object" && "products" in data && data.products.length) return data;
        if (Array.isArray(data) && data.length) return { products: data };
      } catch {
        // The demo catalogue keeps storefront routes usable without the API.
      }
      return { products: skip === 0 ? fallbackProducts.slice(0, take) : [] };
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !Array.isArray(lastPage.products)) return undefined;
      if (lastPage.products.length < take) return undefined;
      return allPages.length * take;
    },
    initialData: {
      pages: [{ products: fallbackProducts.slice(0, take) }],
      pageParams: [0],
    },
  });
};

export interface ProductFiltersAttributeValue {
  value: string;
  count: number;
  hex?: string;
}

export interface ProductFiltersAttribute {
  name: string;
  values: ProductFiltersAttributeValue[];
}

export interface ProductFiltersResponse {
  meta: {
    total: number;
    price: { min: number | null; max: number | null };
    discount: { min: number | null; max: number | null };
    rating: { min: number | null; max: number | null; average: number | null };
  };
  categories: Array<{
    id: string;
    name: string;
    slug?: string;
    parent?: { id: string; name: string; slug?: string };
    count: number;
  }>;
  brands: Array<{ name: string; count: number }>;
  sellers: Array<{ id: string; name: string; count: number }>;
  tags: Array<{ value: string; count: number }>;
  attributes: ProductFiltersAttribute[];
  availability: { inStock: number; outOfStock: number };
  ratingBuckets: Array<{ label: string; minRating: number; count: number }>;
}

export type ProductFiltersParams = {
  category?: string | string[];
  categoryId?: string;
  search?: string;
  brand?: string | string[];
  tag?: string | string[];
  availability?: string | string[];
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  maxDiscount?: number;
  minRating?: number;
  event?: string;
  seller?: string | string[];
  attributes?: Record<string, string[]>;
  includeOutOfStock?: boolean;
};

export const useProductFilters = (params?: ProductFiltersParams) => {
  const fallbackProducts = queryDemoProducts({
    q: params?.search,
    categoryId:
      params?.categoryId ||
      (typeof params?.category === "string" ? params.category : undefined),
    brand: params?.brand,
    tag: params?.tag,
    minPrice: params?.minPrice,
    maxPrice: params?.maxPrice,
    minRating: params?.minRating,
    includeOutOfStock: params?.includeOutOfStock,
  });
  const fallbackFilters = getDemoFilters(fallbackProducts);
  return useQuery<ProductFiltersResponse>({
    queryKey: ["products", "filters", params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          // Skip empty strings
          if (typeof value === "string" && value.trim() === "") return;
          if (Array.isArray(value)) {
            value.forEach((item) => queryParams.append(key, item));
          } else {
            queryParams.append(key, String(value));
          }
        });
      }
      const queryString = queryParams.toString();
      const url = queryString
        ? `/products/filters?${queryString}`
        : "/products/filters";
      try {
        const response = await API.get(url);
        return response.data;
      } catch {
        return fallbackFilters;
      }
    },
    placeholderData: fallbackFilters,
  });
};

export const useNewArrivalsProducts = (limit?: number) => {
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", "new-arrivals", limit],
    queryFn: async () => {
      const url = limit
        ? `/products/new-arrivals?limit=${limit}`
        : "/products/new-arrivals";
      const response = await API.get(url);
      return response.data;
    },
  });
};

export type BestSellersSort =
  | "relevance"
  | "price_asc"
  | "price_desc"
  | "newest";

export const useBestSellersProductsInfinite = (params?: {
  limit?: number;
  sort?: BestSellersSort;
  minRating?: number;
}) => {
  const limit = params?.limit ?? 24;
  const sort = params?.sort ?? "relevance";
  const minRating = params?.minRating ?? 4;
  const fallbackProducts = queryDemoProducts({ sort, minRating });
  const fallbackPagination = getDemoPagination(fallbackProducts.length, 1, limit);

  return useInfiniteQuery<{
    products: Product[];
    pagination?: ProductsResponse["pagination"];
  }>({
    queryKey: ["products", "best-sellers", "infinite", limit, sort, minRating],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        minRating: String(minRating),
      });
      if (sort) {
        queryParams.set("sort", sort);
      }
      // Use the dedicated best-sellers endpoint
      try {
        const response = await API.get<{
          products: Product[];
          pagination?: ProductsResponse["pagination"];
        }>(`/products/best-sellers?${queryParams.toString()}`);
        if (response.data.products?.length || fallbackProducts.length === 0) {
          return {
            products: response.data.products || [],
            pagination: response.data.pagination,
          };
        }
        return {
          products: fallbackProducts.slice(0, limit),
          pagination: fallbackPagination,
        };
      } catch {
        return {
          products: page === 1 ? fallbackProducts.slice(0, limit) : [],
          pagination: { ...fallbackPagination, page },
        };
      }
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage?.pagination) return undefined;
      const { page, pages, hasMore } = lastPage.pagination;
      if (hasMore !== undefined) {
        return hasMore ? page + 1 : undefined;
      }
      return page < pages ? page + 1 : undefined;
    },
    initialData: {
      pages: [{ products: fallbackProducts.slice(0, limit), pagination: fallbackPagination }],
      pageParams: [1],
    },
  });
};

export const useCategoryHighlights = (limit?: number) => {
  return useQuery<CategoryHighlightsResponse>({
    queryKey: ["products", "category-highlights", limit],
    queryFn: async () => {
      const query = limit ? `?limit=${limit}` : "";
      const response = await API.get(`/products/category-highlights${query}`);
      return response.data;
    },
  });
};

export const useAdditionalCategoryHighlights = (params?: {
  limit?: number;
  exclude?: string[];
}) => {
  const { limit, exclude } = params || {};
  return useQuery<AdditionalCategoryHighlightsResponse>({
    queryKey: ["products", "category-highlights-additional", limit, exclude],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (limit) {
        queryParams.append("limit", String(limit));
      }
      if (exclude && exclude.length > 0) {
        queryParams.append("exclude", exclude.join(","));
      }
      const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
      const response = await API.get(
        `/products/category-highlights/additional${query}`
      );
      return response.data;
    },
  });
};

export const useRecentlyViewedProducts = (params?: {
  limit?: number;
  enabled?: boolean;
}) => {
  const { limit, enabled } = params || {};
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", "recently-viewed", limit],
    queryFn: async () => {
      const query = limit ? `?limit=${limit}` : "";
      const response = await API.get(`/products/recently-viewed${query}`);
      return response.data;
    },
    enabled: enabled !== undefined ? enabled : true,
  });
};

// Pagination response type for recently viewed products
export interface RecentlyViewedPaginatedResponse {
  products: Product[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasMore: boolean;
  };
}

// Infinite scroll hook for recently viewed products
export const useRecentlyViewedProductsInfinite = (params?: {
  limit?: number;
  enabled?: boolean;
}) => {
  const { limit = 20, enabled = true } = params || {};

  return useInfiniteQuery<RecentlyViewedPaginatedResponse>({
    queryKey: ["products", "recently-viewed", "infinite", limit],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const response = await API.get(
        `/products/recently-viewed?${queryParams.toString()}`
      );
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination?.hasMore) return undefined;
      return lastPage.pagination.page + 1;
    },
    enabled,
  });
};

export const useRecommendedProducts = (params?: {
  limit?: number;
  enabled?: boolean;
}) => {
  const { limit, enabled } = params || {};
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", "recommended", limit],
    queryFn: async () => {
      const url = limit
        ? `/products/recommended?limit=${limit}`
        : "/products/recommended";
      const response = await API.get(url);
      return response.data;
    },
    enabled: enabled !== undefined ? enabled : true,
  });
};

export const useRecommendedByShoppingTrends = (params?: {
  limit?: number;
  enabled?: boolean;
}) => {
  const { limit, enabled } = params || {};
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", "recommended", "shopping-trends", limit],
    queryFn: async () => {
      const url = limit
        ? `/products/recommended/shopping-trends?limit=${limit}`
        : "/products/recommended/shopping-trends";
      const response = await API.get(url);
      return response.data;
    },
    enabled: enabled !== undefined ? enabled : true,
  });
};

export const useRecommendedByPurchases = (params?: {
  limit?: number;
  enabled?: boolean;
}) => {
  const { limit, enabled } = params || {};
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", "recommended", "purchases", limit],
    queryFn: async () => {
      const url = limit
        ? `/products/recommended/purchases?limit=${limit}`
        : "/products/recommended/purchases";
      const response = await API.get(url);
      return response.data;
    },
    enabled: enabled !== undefined ? enabled : true,
  });
};

// Fetch products that were frequently bought together with a specific product
export const useAlsoBoughtProducts = (
  productId: string,
  params?: {
    limit?: number;
    enabled?: boolean;
  },
) => {
  const { limit = 16, enabled = true } = params || {};
  const fallbackProducts = demoProducts
    .filter((product) => product._id !== productId && product.slug !== productId)
    .slice(0, limit);
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", productId, "also-bought", limit],
    queryFn: async () => {
      const url = `/products/${productId}/also-bought?limit=${limit}`;
      try {
        const response = await API.get<{ products: Product[] }>(url);
        return response.data;
      } catch {
        return { products: fallbackProducts };
      }
    },
    enabled: enabled && !!productId,
    placeholderData: { products: fallbackProducts },
  });
};

// Fetch single product
export const useProduct = (id: string) => {
  const fallbackProduct = getDemoProduct(id);
  return useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      try {
        const response = await API.get(`/products/${id}`);
        return response.data;
      } catch {
        if (fallbackProduct) return fallbackProduct;
        throw new Error("Product not found");
      }
    },
    enabled: !!id,
    placeholderData: fallbackProduct,
  });
};

export interface ProductReviewsResponse {
  reviews: ProductReview[];
  rating: number;
  reviewCount: number;
  product: {
    _id: string;
    name: string;
    mainImage?: string;
    category?: {
      _id: string;
      name: string;
      slug: string;
    };
    slug?: string;
  };
}

// Fetch all reviews for a product
export const useProductReviews = (productId: string) => {
  return useQuery<ProductReviewsResponse>({
    queryKey: ["product", productId, "reviews"],
    queryFn: async () => {
      const response = await API.get<ProductReviewsResponse>(
        `/products/${productId}/reviews`
      );
      return response.data;
    },
    enabled: !!productId,
  });
};

export const useSubmitProductReview = () => {
  const queryClient = useQueryClient();

  return useMutation<
    CreateProductReviewResponse,
    unknown,
    SubmitProductReviewVariables
  >({
    mutationFn: async ({ productId, formData }) => {
      const response = await API.post<CreateProductReviewResponse>(
        `/products/${productId}/reviews`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.productQueryKey) {
        queryClient.invalidateQueries({
          queryKey: ["product", variables.productQueryKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["product", variables.productQueryKey, "reviews"],
        });
      }
      // Also refresh feedback so order page hides "Product review" button after first review
      queryClient.invalidateQueries({ queryKey: ["feedback", "my-feedback"] });
    },
  });
};

export interface LikeDislikeReviewResponse {
  likes: number;
  dislikes: number;
  hasLiked: boolean;
  hasDisliked: boolean;
}

interface LikeDislikeReviewVariables {
  productId: string;
  reviewId: string;
  productQueryKey: string;
}

export const useLikeReview = () => {
  const queryClient = useQueryClient();

  return useMutation<
    LikeDislikeReviewResponse,
    unknown,
    LikeDislikeReviewVariables
  >({
    mutationFn: async ({ productId, reviewId }) => {
      const response = await API.post<LikeDislikeReviewResponse>(
        `/products/${productId}/reviews/${reviewId}/like`
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.productQueryKey) {
        queryClient.invalidateQueries({
          queryKey: ["product", variables.productQueryKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["product", variables.productQueryKey, "reviews"],
        });
      }
    },
  });
};

export const useDislikeReview = () => {
  const queryClient = useQueryClient();

  return useMutation<
    LikeDislikeReviewResponse,
    unknown,
    LikeDislikeReviewVariables
  >({
    mutationFn: async ({ productId, reviewId }) => {
      const response = await API.post<LikeDislikeReviewResponse>(
        `/products/${productId}/reviews/${reviewId}/dislike`
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      if (variables.productQueryKey) {
        queryClient.invalidateQueries({
          queryKey: ["product", variables.productQueryKey],
        });
        queryClient.invalidateQueries({
          queryKey: ["product", variables.productQueryKey, "reviews"],
        });
      }
    },
  });
};

export const trackProductView = async (id: string) => {
  const response = await API.post<ProductViewResponse>(`/products/${id}/view`);
  return response.data;
};

export const useCustomerHighlights = (productId: string) => {
  return useQuery<CustomerHighlightsResponse>({
    queryKey: ["product", productId, "customer-highlights"],
    queryFn: async () => {
      const response = await API.get<CustomerHighlightsResponse>(
        `/products/${productId}/customer-highlights`
      );
      return response.data;
    },
    enabled: !!productId,
  });
};

export const useClearViewingHistory = () => {
  const queryClient = useQueryClient();
  return useMutation<{ message?: string }, unknown, void>({
    mutationFn: async () => {
      const response = await API.delete<{ message?: string }>(
        "/products/recently-viewed"
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["products", "recently-viewed"],
      });
    },
  });
};

// KourierBoyzLogistics Serviceability Types
export interface KourierBoyzLogisticsCourier {
  courier_id: number;
  courier_name: string;
  rate?: number;
  estimated_delivery_days?: string;
  estimated_delivery_date?: string;
  serviceable?: boolean;
  cod_available?: boolean;
  zone?: string;
}

export interface ServiceabilityResponse {
  success: boolean;
  data: {
    courier: KourierBoyzLogisticsCourier | null;
    couriers: KourierBoyzLogisticsCourier[];
    origin_pincode?: string;
    destination_pincode: string;
    payment_type: string;
    message?: string;
  };
}

export const useServiceability = (
  productId: string | undefined,
  destination: string | undefined,
  options?: {
    orderAmount?: number;
    paymentType?: "cod" | "prepaid";
    enabled?: boolean;
  }
) => {
  const { orderAmount, paymentType, enabled = true } = options || {};

  return useQuery<ServiceabilityResponse>({
    queryKey: [
      "product",
      productId,
      "serviceability",
      destination,
      orderAmount,
      paymentType,
    ],
    queryFn: async () => {
      if (!productId || !destination) {
        throw new Error("Product ID and destination are required");
      }

      const params = new URLSearchParams({
        destination,
      });

      if (orderAmount) {
        params.append("orderAmount", String(orderAmount));
      }

      if (paymentType) {
        params.append("paymentType", paymentType);
      }

      const response = await API.get(
        `/products/${productId}/serviceability?${params.toString()}`
      );
      return response.data;
    },
    enabled: enabled && !!productId && !!destination && destination.length >= 5,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export interface SellerTestimonial {
  _id: string;
  rating: number;
  comment: string;
  title?: string;
  reviewer: {
    name: string;
    avatarUrl?: string;
    city?: string;
    state?: string;
  };
  seller: {
    _id: string;
    name: string;
    businessName?: string;
    storeName?: string;
    profilePhoto?: string;
  };
  product?: {
    _id: string;
    name: string;
  };
  createdAt: string;
  type: 'product_review' | 'feedback';
}

export interface SellerTestimonialsResponse {
  testimonials: SellerTestimonial[];
  total: number;
}

export const useSellerTestimonials = (limit?: number) => {
  return useQuery<SellerTestimonialsResponse>({
    queryKey: ['seller-testimonials', limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (limit) {
        params.append('limit', limit.toString());
      }
      const response = await API.get(
        `/products/seller-testimonials${params.toString() ? `?${params.toString()}` : ''}`
      );
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
};
