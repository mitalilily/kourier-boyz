import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

export type CertificateType =
  | "FSSAI_LICENSE"
  | "DRUG_LICENSE"
  | "AYUSH_APPROVAL"
  | "FDA_CDSCO_APPROVAL"
  | "BIS_CERTIFICATE"
  | "WPC_ETA_APPROVAL"
  | "BIS_HALLMARK"
  | "ARAI_APPROVAL"
  | "CDSCO_REGISTRATION"
  | "MSDS"
  | "FCO_SEED_LICENSE"
  | "STATE_EXCISE_LICENSE";

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  mainImage: string;
  hoverImage: string;
  banners: string[];
  top?: boolean;
  status: "active" | "inactive";
  suggestedAttributes?: string[];
  productCount?: number;
  parent?: Category | string | null;
  subcategories?: Category[];
  requiredCertificates?: CertificateType[];
  overrideParentCertificateRule?: boolean;
  effectiveRequiredCertificates?: CertificateType[];
  inheritedRequiredCertificates?: CertificateType[];
  inheritsParentCertificateRule?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Using the main API base URL since categories are shared (not seller-specific)
const SELLER_API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:4000/api/marketplace/seller";
const API_BASE =
  import.meta.env.VITE_API_ROOT_URL || SELLER_API_BASE.replace(/\/seller\/?$/, "");

// Create axios instance for categories (public endpoint, but may need token for some operations)
const categoryApi = axios.create({
  baseURL: API_BASE.replace("/seller", ""), // Remove /seller suffix if present
  withCredentials: true,
  timeout: 10000, // 10 second timeout
});

// Add token to requests if available
categoryApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("seller_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 -> try refresh, retry on network errors
let isRefreshing = false;
let pendingQueue: Array<(token?: string) => void> = [];

type RetriableRequest = AxiosRequestConfig & {
  _retry?: boolean;
  _retryCount?: number;
};

categoryApi.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = (error.config || {}) as RetriableRequest;
    const status = error?.response?.status;
    const isNetworkError = !error.response;

    // Retry logic for network errors (max 2 retries)
    if (
      isNetworkError &&
      originalRequest &&
      (originalRequest._retryCount ?? 0) < 2
    ) {
      originalRequest._retryCount = (originalRequest._retryCount ?? 0) + 1;
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * (originalRequest._retryCount ?? 1))
      ); // Exponential backoff
      return categoryApi(originalRequest);
    }

    // Handle 401 - token refresh
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (isRefreshing) {
          await new Promise<void>((resolve) =>
            pendingQueue.push(() => resolve())
          );
          const token = localStorage.getItem("seller_token");
          if (token && originalRequest.headers) {
            (
              originalRequest.headers as Record<string, string>
            ).Authorization = `Bearer ${token}`;
          }
          return categoryApi(originalRequest);
        }

        isRefreshing = true;
        const refreshRes = await axios.post(
          `${SELLER_API_BASE}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        const newToken: string | undefined = refreshRes?.data?.token;
        if (newToken) {
          localStorage.setItem("seller_token", newToken);
          if (originalRequest.headers) {
            (
              originalRequest.headers as Record<string, string>
            ).Authorization = `Bearer ${newToken}`;
          }
          pendingQueue.forEach((cb) => cb(newToken));
          pendingQueue = [];
          isRefreshing = false;
          return categoryApi(originalRequest);
        }
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        isRefreshing = false;
        pendingQueue.forEach((cb) => cb(undefined));
        pendingQueue = [];
      }
    }

    // Log error for debugging
    if (error.response) {
      console.error("Category API Error:", {
        status: error.response.status,
        url: originalRequest?.url,
        message: error.response.data?.message || error.message,
      });
    } else {
      console.error("Category API Network Error:", {
        url: originalRequest?.url,
        message: error.message,
      });
    }

    return Promise.reject(error);
  }
);

export const getCategories = async (includeSubcategories = false) => {
  try {
    const url = includeSubcategories
      ? "/categories?includeSubcategories=true"
      : "/categories";
    const { data } = await categoryApi.get(url);
    // Backend returns { categories, stats }
    return (data.categories || []) as Category[];
  } catch (error) {
    console.error("Error fetching categories:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to load categories. Please try again or refresh the page."
    );
  }
};

export const getActiveCategories = async (includeSubcategories = false) => {
  try {
    const url = includeSubcategories
      ? "/categories?status=active&includeSubcategories=true"
      : "/categories?status=active";
    const { data } = await categoryApi.get(url);
    const categories = (data.categories || []) as Category[];
    return categories.filter((cat) => cat.status === "active");
  } catch (error) {
    console.error("Error fetching active categories:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to load active categories. Please try again or refresh the page."
    );
  }
};

export const getRootCategories = async () => {
  const { data } = await categoryApi.get("/categories/root");
  return (data || []) as Category[];
};

// Get single category by ID
export const getCategoryById = async (id: string): Promise<Category | null> => {
  try {
    const response = await categoryApi.get(`/categories/${id}`);
    const category = response.data as Category;
    return category;
  } catch (error) {
    console.error("Error fetching category:", error);
    return null;
  }
};

export const updateCategorySuggestedAttributes = async (
  id: string,
  suggestedAttributes: string[]
) => {
  const { data } = await categoryApi.put(`/categories/${id}`, {
    suggestedAttributes,
  });
  return data as Category;
};
