import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getDemoProducts } from '../demo/marketplaceData'
import { isDemoSellerSession } from '../store/authStore'
import {
  adjustProductStock,
  bulkDeleteProducts,
  bulkUpdateProductStatus,
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductVariant,
  duplicateProduct,
  exportProductsCSV,
  getInventoryLogs,
  getLowStockProducts,
  getProduct,
  getProducts,
  getProductVariants,
  importProductsCSV,
  type ProductFormData,
  setProductStock,
  updateLowStockThreshold,
  updateProduct,
  updateProductVariant,
  type VariantPayload,
} from './products'

export const useProducts = (params?: {
  status?: string
  search?: string
  category?: string
  page?: number
  limit?: number
  sortBy?: string
  order?: string
  enabled?: boolean
}) => {
  const isDemo = isDemoSellerSession()
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => getProducts(params),
    enabled: !isDemo && params?.enabled !== false,
    initialData: isDemo ? getDemoProducts(params) : undefined,
  })
}

export const useLowStockProducts = (params?: {
  page?: number
  limit?: number
  threshold?: number
  enabled?: boolean
}) => {
  const isDemo = isDemoSellerSession()
  const demoData = getDemoProducts({ page: params?.page, limit: params?.limit })
  demoData.products = demoData.products.filter((product) => {
    const stock = product.hasVariants ? product.totalStock || 0 : product.stock || 0
    return stock <= (product.lowStockThreshold ?? params?.threshold ?? 5)
  })
  demoData.pagination.total = demoData.products.length
  demoData.pagination.pages = demoData.products.length ? 1 : 0

  return useQuery({
    queryKey: ['products', 'low-stock', params],
    queryFn: () => getLowStockProducts(params),
    enabled: !isDemo && params?.enabled !== false,
    initialData: isDemo ? demoData : undefined,
  })
}

export const useInventoryLogs = (id: string, params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['inventoryLogs', id, params],
    queryFn: () => getInventoryLogs(id, params),
    enabled: !!id,
  })
}

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => getProduct(id),
    enabled: !!id,
  })
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ProductFormData) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductFormData }) => updateProduct(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] })
    },
  })
}

export const useDeleteProduct = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useExportProductsCSV = () => {
  return useMutation({
    mutationFn: () => exportProductsCSV(),
  })
}

export const useImportProductsCSV = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => importProductsCSV(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useDuplicateProduct = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => duplicateProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useBulkDeleteProducts = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (productIds: string[]) => bulkDeleteProducts(productIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useBulkUpdateProductStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      productIds,
      status,
    }: {
      productIds: string[]
      status: 'active' | 'inactive' | 'draft'
    }) => bulkUpdateProductStatus(productIds, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export const useAdjustProductStock = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, delta, reason }: { id: string; delta: number; reason?: string }) =>
      adjustProductStock(id, { delta, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product'] })
    },
  })
}

export const useSetProductStock = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stock, reason }: { id: string; stock: number; reason?: string }) =>
      setProductStock(id, { stock, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product'] })
    },
  })
}

export const useUpdateLowStockThreshold = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, threshold }: { id: string; threshold: number }) =>
      updateLowStockThreshold(id, { threshold }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['product'] })
    },
  })
}

export const useProductVariants = (productId: string) => {
  return useQuery({
    queryKey: ['variants', productId],
    queryFn: () => getProductVariants(productId),
    enabled: !!productId,
  })
}

export const useCreateVariant = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, payload }: { productId: string; payload: VariantPayload }) =>
      createProductVariant(productId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['variants', variables.productId] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.productId] })
    },
  })
}

export const useUpdateVariant = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      // productId,
      variantId,
      payload,
    }: {
      productId: string
      variantId: string
      payload: Partial<VariantPayload>
    }) => updateProductVariant(variantId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['variants', variables.productId] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.productId] })
    },
  })
}

export const useDeleteVariant = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ variantId }: { productId: string; variantId: string }) =>
      deleteProductVariant(variantId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['variants', variables.productId] })
      queryClient.invalidateQueries({ queryKey: ['product', variables.productId] })
    },
  })
}
