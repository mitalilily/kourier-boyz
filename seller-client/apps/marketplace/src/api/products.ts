import API from './axiosInstance'

export interface Product {
  _id: string
  name: string
  slug: string
  description: string
  shortDescription?: string
  price: number
  comparePrice?: number
  costPrice?: number
  sku: string
  stock: number
  lowStockThreshold?: number
  category: {
    _id: string
    name: string
    slug?: string
    parent?: { _id: string; name: string; slug?: string } | string | null
  }
  seller: string
  images: string[]
  videos?: string[]
  mainImage: string
  specifications?: Array<{ key?: string; value: string }> // Merged: can be key-value pairs or simple features (empty key)
  brand?: string
  weight?: number
  dimensions?: { length: number; width: number; height: number }
  tags?: string[]
  // Manufacturer & Importer Information
  manufacturerName?: string
  manufacturerAddress?: string
  importerName?: string
  importerAddress?: string
  countryOfOrigin?: string
  filterMetadata?: Array<{ key: string; values: string[] }>
  status: 'draft' | 'active' | 'inactive' | 'out_of_stock' | 'pending_approval' | 'pending_category_approval'
  isFeatured: boolean
  rating?: number
  reviewCount?: number
  soldCount: number
  viewCount: number
  // Discounts
  discountPercent?: number
  discountStart?: string
  discountEnd?: string
  // GST/HSN fields
  isGstApplicable?: boolean
  hsnSacCode?: string
  cgstRatePercent?: number
  sgstRatePercent?: number
  igstRatePercent?: number
  // Default GST/HSN for variant products
  defaultHsnSacCode?: string
  defaultCgstRatePercent?: number
  defaultSgstRatePercent?: number
  defaultIgstRatePercent?: number
  // Variants
  hasVariants?: boolean
  variantAttributes?: string[]
  totalStock?: number // Sum of all variant stocks
  lowStockVariants?: number // Count of variants below threshold
  variants?: Array<{
    _id?: string
    name: string
    sku: string
    price: number
    comparePrice?: number
    costPrice?: number
    stock: number
    attributes: Record<string, string>
    isDefault?: boolean
    videos?: string[]
  }>
  createdAt: string
  updatedAt: string
  objections?: Array<{
    reason: string
    createdAt: string
    addressedBySeller?: boolean
    resolved?: boolean
  }>
}

export interface ProductsResponse {
  products: Product[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface ProductFormData {
  name: string
  description: string
  shortDescription?: string
  price: number
  comparePrice?: number
  costPrice?: number
  effectivePrice?: number // What customer actually pays (calculated on frontend)
  profit?: number // Profit per unit (calculated on frontend)
  category: string
  brand?: string
  stock: number
  sku?: string
  status: 'draft' | 'active' | 'inactive'
  isFeatured?: boolean
  specifications?: Array<{ key?: string; value: string }> // Merged: can be key-value pairs or simple features (empty key)
  tags?: string[]
  filterMetadata?: Array<{ key: string; values: string[] }>
  mainImage?: File | string
  images?: File[] | string[]
  videos?: File[] | string[]
  existingMainImage?: string
  existingImages?: string[]
  existingVideos?: string[]
  // SEO
  metaTitle?: string
  metaDescription?: string
  seoKeywords?: string[]
  // Shipping
  requiresShipping?: boolean
  freeShipping?: boolean
  shippingWeight?: number
  shippingDimensions?: {
    length: number
    width: number
    height: number
  }
  shippingCharge?: number // Product-level shipping charge (overrides seller default)
  // Fulfillment
  fulfillmentType?: 'self-ship' | 'marketplace-fulfilled' // Override seller default if set
  // Product Features & Policies
  payOnDelivery?: boolean
  returnable?: boolean
  returnDays?: number
  warranty?: boolean
  warrantyDays?: number
  nextDayDelivery?: boolean
  securePayment?: boolean
  // Manufacturer & Importer Information
  manufacturerName?: string
  manufacturerAddress?: string
  importerName?: string
  importerAddress?: string
  countryOfOrigin?: string
  // Inventory Policy
  trackInventory?: boolean
  minOrderQuantity?: number
  maxOrderQuantity?: number
  // Warehouse inventory (for simple products without variants)
  warehouseInventory?: Array<{
    warehouseId: string
    warehouseName: string
    quantity: number
    lowStockThreshold?: number
  }>
  // Discount
  discountPercent?: number
  discountStartDate?: Date | string
  discountEndDate?: Date | string
  // Tax
  taxClass?: string
  taxRate?: number
  // GST/HSN
  // For simple products (hasVariants=false): REQUIRED if seller is GST registered, null if not
  // For variant products (hasVariants=true): Optional defaults
  isGstApplicable?: boolean // Whether GST is applicable (if true, GST is included in effective price - inclusive pricing)
  hsnSacCode?: string | null // Required if hasVariants=false and seller is GST registered, null if not GST registered
  gstType?: 'inter-state' | 'intra-state' | null // GST type: inter-state (IGST) or intra-state (CGST+SGST)
  cgstRatePercent?: number | null // CGST rate for intra-state transactions
  sgstRatePercent?: number | null // SGST rate for intra-state transactions (auto-calculated as equal to CGST)
  igstRatePercent?: number | null // IGST rate for inter-state transactions
  defaultHsnSacCode?: string | null // Optional default for variants (only if hasVariants=true), null if seller is not GST registered
  defaultGstType?: 'inter-state' | 'intra-state' | null // Optional default GST type for variants
  defaultCgstRatePercent?: number | null // Optional default CGST rate for variants
  defaultSgstRatePercent?: number | null // Optional default SGST rate for variants (auto-calculated)
  defaultIgstRatePercent?: number | null // Optional default IGST rate for variants
  exclusivePrice?: number // Price without GST (for simple products)
  // Variants
  hasVariants?: boolean
  variantAttributes?: string[]
  variants?: Array<{
    id?: string | number
    name: string
    sku?: string
    price: number
    comparePrice?: number
    costPrice?: number
    discountPercent?: number
    exclusivePrice?: number // Price without GST (calculated on frontend)
    effectivePrice?: number // What customer actually pays with GST (calculated on frontend)
    profit?: number // Profit per unit (calculated on frontend)
    stock: number
    lowStockThreshold?: number
    attributes: Record<string, string>
    isDefault?: boolean
    mainImage?: File | string
    images?: File[] | string[]
    videos?: File[] | string[]
    warehouseInventory?: Array<{
      warehouseId: string
      warehouseName: string
      quantity: number
      lowStockThreshold?: number
    }>
    // GST/HSN for variants (REQUIRED if seller is GST registered, null if not)
    hsnSacCode?: string | null
    gstType?: 'inter-state' | 'intra-state' | null
    cgstRatePercent?: number | null
    sgstRatePercent?: number | null
    igstRatePercent?: number | null
  }>
}

// Custom Attributes API (seller scope)
export interface CustomAttributeDTO {
  key: string
  label: string
  type: 'color' | 'size' | 'material' | 'text' | 'select'
  required?: boolean
  description?: string
  sortOrder?: number
  options?: Array<{
    value: string
    label: string
    color?: string
    description?: string
    sortOrder?: number
  }>
}

export const getSellerCustomAttributes = async () => {
  const { data } = await API.get<CustomAttributeDTO[]>('/products/attributes')
  return data
}

export const getProductMediaPresign = async (payload: {
  fileName: string
  contentType: string
  scope?: 'product' | 'variant'
}) => {
  const { data } = await API.post<{
    uploadUrl: string
    publicUrl: string
    key: string
  }>('/products/media/presign', payload)
  return data
}

export const deleteProductMedia = async (payload: { url?: string; urls?: string[] }) => {
  const { data } = await API.post<{ success: boolean; deleted: number }>(
    '/products/media/delete',
    payload,
  )
  return data
}

export const upsertSellerCustomAttribute = async (payload: CustomAttributeDTO) => {
  const { data } = await API.post<CustomAttributeDTO>('/products/attributes', payload)
  return data
}

export const deleteSellerCustomAttribute = async (key: string) => {
  const { data } = await API.delete<{ success: boolean }>(
    `/products/attributes/${encodeURIComponent(key)}`,
  )
  return data
}

// Generate unique SKU
export interface GenerateSkuParams {
  productName?: string
  baseSku?: string
  attributes?: Record<string, string>
  productId?: string
  maxLength?: number // Maximum length for the generated SKU
}

export const generateSku = async (params: GenerateSkuParams): Promise<{ sku: string }> => {
  const { data } = await API.post<{ sku: string }>('/products/generate-sku', params)
  return data
}

// Get all products
export const getProducts = async (params?: {
  status?: string
  search?: string
  category?: string
  page?: number
  limit?: number
  sortBy?: string
  order?: string
}) => {
  const { data } = await API.get<ProductsResponse>('/products', { params })
  return data
}

// Get low stock products
export const getLowStockProducts = async (params?: {
  page?: number
  limit?: number
  threshold?: number
}) => {
  const { data } = await API.get<ProductsResponse>('/products/low-stock', { params })
  return data
}

// Get single product
export const getProduct = async (id: string) => {
  const { data } = await API.get<Product>(`/products/${id}`)
  return data
}

// Get product details by SKU (returns only relevant data for that SKU)
export interface ProductBySku {
  _id: string
  name: string
  description?: string
  shortDescription?: string
  brand?: string
  category?: {
    _id: string
    name: string
    slug: string
    parent?: {
      _id: string
      name: string
      slug: string
    }
  }
  sku: string
  variantName?: string
  variantId?: string
  price?: number
  comparePrice?: number
  costPrice?: number
  stock: number
  lowStockThreshold?: number
  shippingWeight?: number
  shippingDimensions?: {
    length?: number
    width?: number
    height?: number
  }
  mainImage?: string
  images?: string[]
  warehouseInventory: Array<{
    warehouseId: string
    warehouseName: string
    quantity: number
    lowStockThreshold?: number
    pickupId?: string | null
  }>
}

// Compact product + warehouse info for specific order items
export interface ProductWarehouseForOrderItem {
  itemId: string
  productId: string
  variantId?: string
  name: string
  sku: string
  mainImage?: string
  warehouseInventory: Array<{
    warehouseId: string
    warehouseName: string
    quantity: number
    lowStockThreshold?: number
    pickupId?: string | null
  }>
}

export const getProductsForOrderItems = async (
  orderId: string,
  itemIds: string[],
): Promise<ProductWarehouseForOrderItem[]> => {
  const { data } = await API.get<ProductWarehouseForOrderItem[]>(
    `/products/by-order-items/${orderId}`,
    {
      // For seller scope this endpoint is currently used where each order
      // effectively has a single relevant line item (variant-based).
      // We therefore send just the first itemId; backend handles variant resolution.
      params: { itemIds: itemIds[0] },
    },
  )
  return data
}

export const getProductBySku = async (sku: string): Promise<ProductBySku> => {
  const { data } = await API.get<ProductBySku>('/products/by-sku', {
    params: { sku },
  })
  return data
}

// Create product
export const createProduct = async (productData: ProductFormData) => {
  const formData = new FormData()
  const existingMainImage = (productData as { existingMainImage?: string }).existingMainImage
  const isEmptyFormValue = (value: unknown) => {
    if (value === undefined || value === null) return true
    if (typeof value === 'number') return Number.isNaN(value)
    if (typeof value !== 'string') return false

    const normalized = value.trim().toLowerCase()
    return normalized === '' || normalized === 'undefined' || normalized === 'null'
  }

  // Extract variants to handle media separately
  const variantsForUpload = productData.variants || []

  Object.entries({ ...productData, variants: undefined }).forEach(([key, value]) => {
    if (isEmptyFormValue(value)) return

    // Handle file uploads: only append mainImage binary when not sending Cloudflare URL
    if (key === 'mainImage' && value instanceof File && !existingMainImage) {
      formData.append('mainImage', value)
    } else if (key === 'images' && Array.isArray(value)) {
      value.forEach((img) => {
        if (img instanceof File) {
          formData.append('images', img)
        }
      })
    } else if (key === 'videos' && Array.isArray(value)) {
      value.forEach((vid) => {
        if (vid instanceof File) {
          formData.append('videos', vid)
        }
      })
    } else if (key === 'existingImages' && Array.isArray(value)) {
      if (value.length > 0) {
        formData.append('existingImages', JSON.stringify(value))
      }
    } else if (key === 'existingVideos' && Array.isArray(value)) {
      if (value.length > 0) {
        formData.append('existingVideos', JSON.stringify(value))
      }
    } else if (key === 'existingMainImage' && typeof value === 'string') {
      if (!isEmptyFormValue(value)) {
        formData.append('existingMainImage', value)
      }
    }
    // Map discount date fields
    else if (key === 'discountStartDate') {
      let dateValue = ''
      if (value instanceof Date) {
        dateValue = value.toISOString()
      } else if (
        value &&
        typeof value === 'object' &&
        'toDate' in value &&
        typeof value.toDate === 'function'
      ) {
        // dayjs object
        dateValue = (value.toDate() as Date).toISOString()
      } else if (value && typeof value === 'object' && '$d' in value) {
        dateValue = new Date(value.$d as string | number | Date).toISOString()
      } else if (typeof value === 'string' || typeof value === 'number') {
        dateValue = new Date(value).toISOString()
      }
      if (dateValue) formData.append('discountStart', dateValue)
    } else if (key === 'discountEndDate') {
      let dateValue = ''
      if (value instanceof Date) {
        dateValue = value.toISOString()
      } else if (
        value &&
        typeof value === 'object' &&
        'toDate' in value &&
        typeof value.toDate === 'function'
      ) {
        dateValue = (value.toDate() as Date).toISOString()
      } else if (value && typeof value === 'object' && '$d' in value) {
        dateValue = new Date(value.$d as string | number | Date).toISOString()
      } else if (typeof value === 'string' || typeof value === 'number') {
        dateValue = new Date(value).toISOString()
      }
      if (dateValue) formData.append('discountEnd', dateValue)
    }
    // Skip videos, existingVideos, existingImages, and existingMainImage as they're handled separately above
    else if (key === 'videos' || key === 'existingVideos' || key === 'existingImages' || key === 'existingMainImage') {
      // Already handled above, skip
    }
    // Handle arrays (warehouseInventory, etc.) - arrays are objects but we check explicitly for clarity
    else if (Array.isArray(value)) {
      if (value.length > 0) {
        formData.append(key, JSON.stringify(value))
      }
    }
    // Handle objects (but not Files or Dates)
    else if (typeof value === 'object' && !(value instanceof File) && !(value instanceof Date)) {
      formData.append(key, JSON.stringify(value))
    }
    // Handle booleans
    else if (typeof value === 'boolean') {
      formData.append(key, String(value))
    }
    // Handle other values
    else {
      if (!isEmptyFormValue(value)) {
        formData.append(key, String(value))
      }
    }
  })

  // Append variants JSON and per-variant media
  if (Array.isArray(variantsForUpload)) {
    const plainVariants = variantsForUpload.map((v, index) => {
      // Collect existing URLs for mainImage and images (prefer URLs already in Cloudflare)
      const existingMain =
        v.mainImage && typeof v.mainImage !== 'string' && 'url' in v.mainImage
          ? (v.mainImage.url as string)
          : typeof v.mainImage === 'string'
          ? v.mainImage
          : undefined

      const existingImgs: string[] = Array.isArray(v.images)
        ? (v.images
            .map((img) =>
              img && typeof img !== 'string' && 'url' in img
                ? img.url
                : typeof img === 'string'
                ? img
                : undefined,
            )
            .filter(Boolean) as string[])
        : []

      const existingVids: string[] = Array.isArray((v as { videos?: Array<File | string | { url?: string }> }).videos)
        ? (((v as { videos?: Array<File | string | { url?: string }> }).videos || [])
            .map((vid) =>
              vid && typeof vid !== 'string' && 'url' in vid
                ? vid.url
                : typeof vid === 'string'
                ? vid
                : undefined,
            )
            .filter(Boolean) as string[])
        : []

      // Prefer URLs over binary: only append files when we don't have a URL
      if (v.mainImage && !existingMain) {
        if (v.mainImage instanceof File) {
          formData.append(`variantMainImage_${index}`, v.mainImage)
        } else if (
          typeof v.mainImage === 'object' &&
          v.mainImage !== null &&
          'originFileObj' in v.mainImage
        ) {
          formData.append(
            `variantMainImage_${index}`,
            (v.mainImage as { originFileObj: File }).originFileObj,
          )
        }
      }
      const isHostedUrl = (u: string | undefined) =>
        u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
      if (Array.isArray(v.images)) {
        v.images.forEach((img) => {
          const url = img && typeof img === 'object' && 'url' in img ? (img as { url?: string }).url : undefined
          if (isHostedUrl(url)) return
          if (img instanceof File) {
            formData.append(`variantImages_${index}`, img)
          } else if (img && typeof img === 'object' && 'originFileObj' in img) {
            formData.append(
              `variantImages_${index}`,
              (img as { originFileObj: File }).originFileObj,
            )
          }
        })
      }
      if (Array.isArray((v as { videos?: Array<File | { originFileObj?: File }> }).videos)) {
        const variantVideos = (v as { videos?: Array<File | { originFileObj?: File }> }).videos || []
        variantVideos.forEach((vid) => {
          const url = vid && typeof vid === 'object' && 'url' in vid ? (vid as { url?: string }).url : undefined
          if (isHostedUrl(url)) return
          if (vid instanceof File) {
            formData.append(`variantVideos_${index}`, vid)
          } else if (vid && typeof vid === 'object' && 'originFileObj' in vid) {
            formData.append(
              `variantVideos_${index}`,
              (vid as { originFileObj: File }).originFileObj,
            )
          }
        })
      }

      if (existingMain && isHostedUrl(existingMain))
        formData.append(`existingVariantMainImage_${index}`, existingMain)
      const hostedImgs = existingImgs.filter((u) => isHostedUrl(u))
      if (hostedImgs.length > 0)
        formData.append(`existingVariantImages_${index}`, JSON.stringify(hostedImgs))
      const hostedVids = existingVids.filter((u) => isHostedUrl(u))
      if (hostedVids.length > 0)
        formData.append(`existingVariantVideos_${index}`, JSON.stringify(hostedVids))

      // Return plain variant without File objects
      return {
        id: v.id,
        name: v.name,
        sku: v.sku,
        price: v.price,
        comparePrice: v.comparePrice,
        costPrice: v.costPrice,
        discountPercent: v.discountPercent,
        effectivePrice: v.effectivePrice,
        profit: v.profit,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold,
        attributes: v.attributes,
        isDefault: v.isDefault,
        // Include warehouse inventory
        warehouseInventory: v.warehouseInventory,
        // GST/HSN fields
        hsnSacCode: v.hsnSacCode,
        cgstRatePercent: v.cgstRatePercent,
        sgstRatePercent: v.sgstRatePercent,
        igstRatePercent: v.igstRatePercent,
        // mainImage/images will be set by backend from uploaded/existing fields
      }
    })

    formData.append('variants', JSON.stringify(plainVariants))
  }

  const { data } = await API.post<Product>('/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// Update product
export const updateProduct = async (id: string, productData: ProductFormData) => {
  const formData = new FormData()
  const existingMainImage = (productData as { existingMainImage?: string }).existingMainImage

  // Extract variants to handle media separately
  const variantsForUpload = productData.variants || []

  Object.entries({ ...productData, variants: undefined }).forEach(([key, value]) => {
    if (value === undefined || value === null) return

    // Handle file uploads: only append mainImage binary when not sending Cloudflare URL
    if (key === 'mainImage' && value instanceof File && !existingMainImage) {
      formData.append('mainImage', value)
    } else if (key === 'images' && Array.isArray(value)) {
      value.forEach((img) => {
        if (img instanceof File) {
          formData.append('images', img)
        }
      })
    } else if (key === 'videos' && Array.isArray(value)) {
      value.forEach((vid) => {
        if (vid instanceof File) {
          formData.append('videos', vid)
        }
      })
    } else if (key === 'existingImages' && Array.isArray(value)) {
      if (value.length > 0) {
        formData.append('existingImages', JSON.stringify(value))
      }
    } else if (key === 'existingVideos' && Array.isArray(value)) {
      if (value.length > 0) {
        formData.append('existingVideos', JSON.stringify(value))
      }
    } else if (key === 'existingMainImage' && typeof value === 'string') {
      formData.append('existingMainImage', value)
    }
    // Map discount date fields (robust handling like create)
    else if (key === 'discountStartDate') {
      let dateValue = ''
      if (value instanceof Date) {
        dateValue = value.toISOString()
      } else if (
        value &&
        typeof value === 'object' &&
        'toDate' in value &&
        typeof value.toDate === 'function'
      ) {
        dateValue = (value.toDate() as Date).toISOString()
      } else if (value && typeof value === 'object' && '$d' in value) {
        dateValue = new Date(value.$d as string | number | Date).toISOString()
      } else if (typeof value === 'string' || typeof value === 'number') {
        dateValue = new Date(value).toISOString()
      }
      if (dateValue) formData.append('discountStart', dateValue)
    } else if (key === 'discountEndDate') {
      let dateValue = ''
      if (value instanceof Date) {
        dateValue = value.toISOString()
      } else if (
        value &&
        typeof value === 'object' &&
        'toDate' in value &&
        typeof value.toDate === 'function'
      ) {
        dateValue = (value.toDate() as Date).toISOString()
      } else if (value && typeof value === 'object' && '$d' in value) {
        dateValue = new Date(value.$d as string | number | Date).toISOString()
      } else if (typeof value === 'string' || typeof value === 'number') {
        dateValue = new Date(value).toISOString()
      }
      if (dateValue) formData.append('discountEnd', dateValue)
    }
    // Skip videos, existingVideos, existingImages, and existingMainImage as they're handled separately above
    else if (key === 'videos' || key === 'existingVideos' || key === 'existingImages' || key === 'existingMainImage') {
      // Already handled above, skip
    }
    // Handle arrays (warehouseInventory, etc.) - arrays are objects but we check explicitly for clarity
    else if (Array.isArray(value)) {
      formData.append(key, JSON.stringify(value))
    }
    // Handle objects (but not Files or Dates)
    else if (typeof value === 'object' && !(value instanceof File) && !(value instanceof Date)) {
      formData.append(key, JSON.stringify(value))
    }
    // Handle booleans
    else if (typeof value === 'boolean') {
      formData.append(key, String(value))
    }
    // Handle other values
    else {
      formData.append(key, String(value))
    }
  })

  // Append variants JSON and per-variant media
  if (Array.isArray(variantsForUpload)) {
    const plainVariants = variantsForUpload.map((v, index) => {
      // Collect existing URLs for mainImage and images (prefer URLs already in Cloudflare)
      const existingMain =
        v.mainImage && typeof v.mainImage !== 'string' && 'url' in v.mainImage
          ? (v.mainImage.url as string)
          : typeof v.mainImage === 'string'
          ? v.mainImage
          : undefined

      const existingImgs: string[] = Array.isArray(v.images)
        ? (v.images
            .map((img) =>
              img && typeof img !== 'string' && 'url' in img
                ? img.url
                : typeof img === 'string'
                ? img
                : undefined,
            )
            .filter(Boolean) as string[])
        : []

      const existingVids: string[] = Array.isArray((v as { videos?: Array<File | string | { url?: string }> }).videos)
        ? (((v as { videos?: Array<File | string | { url?: string }> }).videos || [])
            .map((vid) =>
              vid && typeof vid !== 'string' && 'url' in vid
                ? vid.url
                : typeof vid === 'string'
                ? vid
                : undefined,
            )
            .filter(Boolean) as string[])
        : []

      // Prefer URLs over binary: only append files when we don't have a URL
      if (v.mainImage && !existingMain) {
        if (v.mainImage instanceof File) {
          formData.append(`variantMainImage_${index}`, v.mainImage)
        } else if (
          typeof v.mainImage === 'object' &&
          v.mainImage !== null &&
          'originFileObj' in v.mainImage
        ) {
          formData.append(
            `variantMainImage_${index}`,
            (v.mainImage as { originFileObj: File }).originFileObj,
          )
        }
      }
      const isHostedUrl = (u: string | undefined) =>
        u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
      if (Array.isArray(v.images)) {
        v.images.forEach((img) => {
          const url = img && typeof img === 'object' && 'url' in img ? (img as { url?: string }).url : undefined
          if (isHostedUrl(url)) return
          if (img instanceof File) {
            formData.append(`variantImages_${index}`, img)
          } else if (img && typeof img === 'object' && 'originFileObj' in img) {
            formData.append(
              `variantImages_${index}`,
              (img as { originFileObj: File }).originFileObj,
            )
          }
        })
      }
      if (Array.isArray((v as { videos?: Array<File | { originFileObj?: File }> }).videos)) {
        const variantVideos = (v as { videos?: Array<File | { originFileObj?: File }> }).videos || []
        variantVideos.forEach((vid) => {
          const url = vid && typeof vid === 'object' && 'url' in vid ? (vid as { url?: string }).url : undefined
          if (isHostedUrl(url)) return
          if (vid instanceof File) {
            formData.append(`variantVideos_${index}`, vid)
          } else if (vid && typeof vid === 'object' && 'originFileObj' in vid) {
            formData.append(
              `variantVideos_${index}`,
              (vid as { originFileObj: File }).originFileObj,
            )
          }
        })
      }

      if (existingMain && isHostedUrl(existingMain))
        formData.append(`existingVariantMainImage_${index}`, existingMain)
      const hostedImgs = existingImgs.filter((u) => isHostedUrl(u))
      if (hostedImgs.length > 0)
        formData.append(`existingVariantImages_${index}`, JSON.stringify(hostedImgs))
      const hostedVids = existingVids.filter((u) => isHostedUrl(u))
      if (hostedVids.length > 0)
        formData.append(`existingVariantVideos_${index}`, JSON.stringify(hostedVids))

      // Return plain variant without File objects
      return {
        id: v.id,
        _id: '_id' in v ? v._id : undefined,
        name: v.name,
        sku: v.sku,
        price: v.price,
        comparePrice: v.comparePrice,
        costPrice: v.costPrice,
        discountPercent: v.discountPercent,
        effectivePrice: v.effectivePrice,
        profit: v.profit,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold,
        attributes: v.attributes,
        isDefault: v.isDefault,
        // GST/HSN fields
        hsnSacCode: v.hsnSacCode,
        cgstRatePercent: v.cgstRatePercent,
        sgstRatePercent: v.sgstRatePercent,
        igstRatePercent: v.igstRatePercent,
        // Include warehouse inventory
        warehouseInventory: v.warehouseInventory,
        // mainImage/images will be set by backend from uploaded/existing fields
      }
    })

    formData.append('variants', JSON.stringify(plainVariants))
  }

  const { data } = await API.put<Product>(`/products/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// Delete product
export const deleteProduct = async (id: string) => {
  const { data } = await API.delete(`/products/${id}`)
  return data
}

export const duplicateProduct = async (id: string) => {
  const { data } = await API.post(`/products/${id}/duplicate`, {})
  return data
}

// Bulk delete products
export const bulkDeleteProducts = async (productIds: string[]) => {
  const { data } = await API.post('/products/bulk/delete', { productIds })
  return data
}

// Bulk update product status
export const bulkUpdateProductStatus = async (
  productIds: string[],
  status: 'active' | 'inactive' | 'draft',
) => {
  const { data } = await API.post('/products/bulk/status', { productIds, status })
  return data
}

// Inventory operations
export const adjustProductStock = async (
  id: string,
  payload: { delta: number; reason?: string },
) => {
  const { data } = await API.post(`/products/${id}/inventory/adjust`, payload)
  return data
}

export const setProductStock = async (id: string, payload: { stock: number; reason?: string }) => {
  const { data } = await API.post(`/products/${id}/inventory/set`, payload)
  return data
}

export const updateLowStockThreshold = async (id: string, payload: { threshold: number }) => {
  const { data } = await API.post(`/products/${id}/inventory/threshold`, payload)
  return data
}

export const markNoticeAddressed = async (id: string) => {
  const { data } = await API.patch(`/products/${id}/objections/address`, {})
  return data as { success: boolean }
}

export const getInventoryLogs = async (id: string, params?: { page?: number; limit?: number }) => {
  const { data } = await API.get(`/products/${id}/inventory/logs`, { params })
  return data as {
    logs: Array<{
      _id: string
      type: 'adjust' | 'set'
      quantityChange: number
      previousStock: number
      newStock: number
      reason?: string
      createdAt: string
    }>
    pagination: { total: number; page: number; limit: number; pages: number }
  }
}

// CSV
export const exportProductsCSV = async () => {
  const res = await API.get(`/products/export/csv`, { responseType: 'blob' })
  return res.data as Blob
}

export const importProductsCSV = async (file: File) => {
  const form = new FormData()
  form.append('file', file)
  const { data } = await API.post(`/products/import/csv`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { created: number; skipped: number }
}

// Variants
export interface VariantPayload {
  name: string
  sku?: string
  attributes?: Record<string, string>
  price: number
  comparePrice?: number
  costPrice?: number
  stock?: number
  lowStockThreshold?: number
  warehouseInventory?: Array<{
    warehouseId: string
    warehouseName: string
    quantity: number
    lowStockThreshold?: number
  }>
  weight?: number
  dimensions?: { length?: number; width?: number; height?: number }
  isDefault?: boolean
  mainImage?: string | null | { url?: string; originFileObj?: File }
  images?: (string | { url?: string; originFileObj?: File })[]
}

export const getProductVariants = async (productId: string) => {
  const { data } = await API.get(`/products/${productId}/variants`)
  return data as Array<{
    _id: string
    product: string
    seller: string
    name: string
    sku: string
    attributes: Record<string, string>
    price: number
    comparePrice?: number
    costPrice?: number
    stock: number
    lowStockThreshold?: number
    isDefault: boolean
    createdAt: string
    updatedAt: string
  }>
}

export const createProductVariant = async (productId: string, payload: VariantPayload) => {
  const formData = new FormData()

  // Add all non-file fields
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'mainImage' && value && typeof value === 'object') {
      const isHostedUrl = (u: string | undefined) =>
        u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
      if ('url' in value && isHostedUrl(value.url as string)) {
        formData.append('existingMainImage', value.url as string)
      } else if ('originFileObj' in value) {
        formData.append('mainImage', value.originFileObj as File)
      }
    } else if (key === 'images' && Array.isArray(value)) {
      const isHostedUrl = (u: string | undefined) =>
        u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
      const newFiles: File[] = []
      const existingUrls: string[] = []

      value.forEach((img) => {
        if (img && typeof img === 'object') {
          if ('url' in img && isHostedUrl(img.url as string)) {
            existingUrls.push(img.url as string)
          } else if ('originFileObj' in img) {
            newFiles.push(img.originFileObj as File)
          }
        }
      })

      newFiles.forEach((file) => {
        formData.append('images', file)
      })
      if (existingUrls.length > 0) {
        formData.append('existingImages', JSON.stringify(existingUrls))
      }
    } else if (value !== undefined && value !== null) {
      // Handle other fields
      if (typeof value === 'object') {
        formData.append(key, JSON.stringify(value))
      } else {
        formData.append(key, String(value))
      }
    }
  })

  const { data } = await API.post(`/products/${productId}/variants`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export const updateProductVariant = async (variantId: string, payload: Partial<VariantPayload>) => {
  const formData = new FormData()

  // Add all non-file fields
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'mainImage' && value && typeof value === 'object') {
      const isHostedUrl = (u: string | undefined) =>
        u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
      if ('url' in value && isHostedUrl(value.url as string)) {
        formData.append('existingMainImage', value.url as string)
      } else if ('originFileObj' in value) {
        formData.append('mainImage', value.originFileObj as File)
      }
    } else if (key === 'images' && Array.isArray(value)) {
      const isHostedUrl = (u: string | undefined) =>
        u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
      const newFiles: File[] = []
      const existingUrls: string[] = []

      value.forEach((img) => {
        if (img && typeof img === 'object') {
          if ('url' in img && isHostedUrl(img.url as string)) {
            existingUrls.push(img.url as string)
          } else if ('originFileObj' in img) {
            newFiles.push(img.originFileObj as File)
          }
        }
      })

      newFiles.forEach((file) => {
        formData.append('images', file)
      })
      if (existingUrls.length > 0) {
        formData.append('existingImages', JSON.stringify(existingUrls))
      }
    } else if (value !== undefined) {
      // Handle other fields - include null/0 values for GST fields
      const gstFields = ['hsnSacCode', 'cgstRatePercent', 'sgstRatePercent', 'igstRatePercent']
      if (gstFields.includes(key)) {
        // Always include GST fields, even if null or 0
        if (value === null) {
          formData.append(key, '')
        } else {
          formData.append(key, String(value))
        }
      } else if (value !== null) {
        // For non-GST fields, skip null values
        if (typeof value === 'object') {
          formData.append(key, JSON.stringify(value))
        } else {
          formData.append(key, String(value))
        }
      }
    }
  })

  const { data } = await API.put(`/products/variants/${variantId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return data
}

export const deleteProductVariant = async (variantId: string) => {
  const { data } = await API.delete(`/products/variants/${variantId}`)
  return data
}
