import API from "./axiosInstance";

export interface SizeChartMeasurement {
  name: string;
  unit: "cm" | "inch";
}

export interface SizeChartRow {
  size: string;
  measurements: Array<{
    name: string;
    value: number | string;
  }>;
}

export interface SizeChart {
  _id: string;
  title: string;
  description?: string;
  chartType: "category" | "product" | "brand";
  category?: {
    _id: string;
    name: string;
    slug: string;
  };
  product?: {
    _id: string;
    name: string;
    slug: string;
  };
  brand?: string;
  seller?: {
    _id: string;
    name: string;
    email: string;
  };
  measurementType: "US" | "UK" | "EU" | "IN" | "custom";
  measurements: SizeChartMeasurement[];
  rows: SizeChartRow[];
  image?: string;
  isActive: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SizeChartResponse {
  success: boolean;
  data: SizeChart;
}

export interface SizeChartsResponse {
  success: boolean;
  data: SizeChart[];
}

export interface ProductWithSizeChart {
  _id: string;
  name: string;
  sku?: string;
  mainImage?: string;
  slug: string;
  sizeChart: SizeChart;
}

export interface ProductsWithSizeChartsResponse {
  success: boolean;
  data: ProductWithSizeChart[];
}

// Get products with their size charts (optimized endpoint)
export const getProductsWithSizeCharts = async (params?: {
  limit?: number;
  search?: string;
}): Promise<ProductsWithSizeChartsResponse> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) {
    queryParams.append("limit", params.limit.toString());
  }
  if (params?.search) {
    queryParams.append("search", params.search);
  }
  const queryString = queryParams.toString();
  const url = `/size-charts/products-with-charts${
    queryString ? `?${queryString}` : ""
  }`;
  const response = await API.get<ProductsWithSizeChartsResponse>(url);
  return response.data;
};

// Get size charts for a product
export const getSizeCharts = async (
  productId?: string
): Promise<SizeChartsResponse> => {
  const params = productId
    ? { productId, chartType: "product" }
    : { chartType: "product" };
  const response = await API.get<SizeChartsResponse>("/size-charts", {
    params,
  });
  return response.data;
};

// Get single size chart
export const getSizeChart = async (id: string): Promise<SizeChartResponse> => {
  const response = await API.get<SizeChartResponse>(`/size-charts/${id}`);
  return response.data;
};

// Create size chart
export const createSizeChart = async (data: {
  title: string;
  description?: string;
  chartType: "product";
  product: string;
  measurementType: "US" | "UK" | "EU" | "IN" | "custom";
  measurements: SizeChartMeasurement[];
  rows: SizeChartRow[];
  image?: string;
  isActive?: boolean;
  sortOrder?: number;
  imageFile?: File | null;
}): Promise<SizeChartResponse> => {
  const formData = new FormData();
  
  // Add all fields to FormData
  formData.append("title", data.title);
  if (data.description) {
    formData.append("description", data.description);
  }
  formData.append("chartType", data.chartType);
  formData.append("product", data.product);
  formData.append("measurementType", data.measurementType);
  formData.append("measurements", JSON.stringify(data.measurements));
  formData.append("rows", JSON.stringify(data.rows));
  
  // Add image file if provided (takes priority), otherwise use image URL
  if (data.imageFile) {
    formData.append("image", data.imageFile);
  } else if (data.image) {
    formData.append("image", data.image);
  }
  
  if (data.isActive !== undefined) {
    formData.append("isActive", String(data.isActive));
  }
  if (data.sortOrder !== undefined) {
    formData.append("sortOrder", String(data.sortOrder));
  }
  
  const response = await API.post<SizeChartResponse>("/size-charts", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Update size chart
export const updateSizeChart = async (
  id: string,
  data: Partial<{
    title: string;
    description?: string;
    measurementType: "US" | "UK" | "EU" | "IN" | "custom";
    measurements: SizeChartMeasurement[];
    rows: SizeChartRow[];
    image?: string;
    isActive?: boolean;
    sortOrder?: number;
    imageFile?: File | null;
  }>
): Promise<SizeChartResponse> => {
  const formData = new FormData();
  
  // Add all fields to FormData if they exist
  if (data.title) {
    formData.append("title", data.title);
  }
  if (data.description !== undefined) {
    formData.append("description", data.description || "");
  }
  if (data.measurementType) {
    formData.append("measurementType", data.measurementType);
  }
  if (data.measurements) {
    formData.append("measurements", JSON.stringify(data.measurements));
  }
  if (data.rows) {
    formData.append("rows", JSON.stringify(data.rows));
  }
  
  // Add image file if provided (takes priority), otherwise use image URL
  if (data.imageFile) {
    formData.append("image", data.imageFile);
  } else if (data.image) {
    formData.append("image", data.image);
  }
  
  if (data.isActive !== undefined) {
    formData.append("isActive", String(data.isActive));
  }
  if (data.sortOrder !== undefined) {
    formData.append("sortOrder", String(data.sortOrder));
  }
  
  const response = await API.put<SizeChartResponse>(`/size-charts/${id}`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Delete size chart
export const deleteSizeChart = async (
  id: string
): Promise<{ success: boolean; message: string }> => {
  const response = await API.delete<{
    success: boolean;
    message: string;
  }>(`/size-charts/${id}`);
  return response.data;
};
