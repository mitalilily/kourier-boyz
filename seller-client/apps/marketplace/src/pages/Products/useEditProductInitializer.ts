import type { UploadFile } from 'antd'
import type { FormInstance } from 'antd/es/form'
import dayjs from 'dayjs'
import { useEffect } from 'react'
import type { Product } from '../../api/products'
import { createFilterMetadataEntry, type FilterMetadataEntry } from './components/filterMetadataUtils'
import type { VariantState } from './productFormUtils'

// Extended Product type that includes variants when loaded
type ProductWithVariants = Product & {
  variants?: Array<{
    _id?: string
    name: string
    sku: string
    price?: number
    comparePrice?: number
    costPrice?: number
    discountPercent?: number
    stock?: number
    lowStockThreshold?: number
    warehouseInventory?: Array<{
      warehouseId: string
      warehouseName: string
      quantity: number
      lowStockThreshold?: number
    }>
    attributes?: Record<string, string>
    isDefault?: boolean
    mainImage?: string | null
    images?: string[]
    videos?: string[]
    status?: string
    hsnSacCode?: string | null
    cgstRatePercent?: number | null
    sgstRatePercent?: number | null
    igstRatePercent?: number | null
    gstRatePercent?: number | null
  }>
}

const normalizeFilterMetadata = (input: unknown): Array<{ key: string; values: string[] }> => {
  if (!input) return []

  let data = input
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return []
    }
  }

  if (!Array.isArray(data)) return []

  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const key =
        typeof (item as { key?: unknown }).key === 'string'
          ? ((item as { key?: string }).key || '').trim()
          : ''

      let values: unknown = (item as { values?: unknown }).values
      if (!values) {
        values = (item as { value?: unknown }).value
      }

      if (typeof values === 'string') {
        values = [values]
      }

      if (!Array.isArray(values)) return null

      const cleaned = (values as unknown[])
        .map((val) => (typeof val === 'string' ? val.trim() : ''))
        .filter((val) => val.length > 0)

      if (!key || cleaned.length === 0) return null
      return { key, values: cleaned }
    })
    .filter((item): item is { key: string; values: string[] } => item !== null)
}

type UseEditProductInitializerParams = {
  product: ProductWithVariants | null
  isEdit: boolean
  form: FormInstance
  setMainImageList: (files: UploadFile[]) => void
  setImagesList: (files: UploadFile[]) => void
  setVideosList?: (files: UploadFile[]) => void
  setSpecifications: (specs: Array<{ key?: string; value: string }>) => void
  setTags: (tags: string[]) => void
  setFilterMetadata: (meta: FilterMetadataEntry[]) => void
  setVariantsData: (variants: VariantState[]) => void
  setVariantAttributesData: (attrs: string[]) => void
  setHasVariantsData: (has: boolean) => void
}

const useEditProductInitializer = ({
  product,
  isEdit,
  form,
  setMainImageList,
  setImagesList,
  setVideosList,
  setSpecifications,
  setTags,
  setFilterMetadata,
  setVariantsData,
  setVariantAttributesData,
  setHasVariantsData,
}: UseEditProductInitializerParams) => {
  console.log('product in useEditProductInitializer', product)
  console.log('form in useEditProductInitializer', form)
  useEffect(() => {
    if (product && isEdit) {
      form.setFieldsValue({
        _id: product._id,
        name: product.name,
        description: product.description,
        shortDescription: product.shortDescription,
        price: product.price,
        comparePrice: product.comparePrice,
        costPrice: product.costPrice,
        category: typeof product.category === 'object' ? product.category?._id : product.category,
        brand: product.brand,
        stock: product.stock,
        sku: product.sku,
        status: product.status,
        isFeatured: product.isFeatured,
        lowStockThreshold: product.lowStockThreshold ?? 5,
        // Manufacturer & Importer Information
        manufacturerName: (product as unknown as { manufacturerName?: string }).manufacturerName,
        manufacturerAddress: (product as unknown as { manufacturerAddress?: string })
          .manufacturerAddress,
        countryOfOrigin: (product as unknown as { countryOfOrigin?: string }).countryOfOrigin,
        importerName: (product as unknown as { importerName?: string }).importerName,
        importerAddress: (product as unknown as { importerAddress?: string }).importerAddress,
        // Warehouse inventory - ensure it's always an array
        warehouseInventory: (() => {
          const whInventory = (
            product as unknown as {
              warehouseInventory?: Array<{
                warehouseId: string
                warehouseName: string
                quantity: number
                lowStockThreshold?: number
              }> | string | number
            }
          ).warehouseInventory
          // Validate that warehouseInventory is an array, otherwise default to empty array
          return Array.isArray(whInventory) ? whInventory : []
        })(),
        // Inventory policy
        trackInventory: (product as unknown as { trackInventory?: boolean }).trackInventory,
        minOrderQuantity: (product as unknown as { minOrderQuantity?: number }).minOrderQuantity,
        maxOrderQuantity: (product as unknown as { maxOrderQuantity?: number }).maxOrderQuantity,
        taxClass: (product as unknown as { taxClass?: string }).taxClass,
        taxRate: (product as unknown as { taxRate?: number }).taxRate,
        // GST/HSN
        hsnSacCode: product.hsnSacCode,
        cgstRatePercent: product.cgstRatePercent,
        sgstRatePercent: product.sgstRatePercent,
        igstRatePercent: product.igstRatePercent,
        defaultHsnSacCode: product.defaultHsnSacCode,
        defaultCgstRatePercent: product.defaultCgstRatePercent,
        defaultSgstRatePercent: product.defaultSgstRatePercent,
        defaultIgstRatePercent: product.defaultIgstRatePercent,
        isGstApplicable: product.isGstApplicable ?? false,
        // Shipping
        freeShipping: (product as unknown as { freeShipping?: boolean }).freeShipping,
        shippingCharge: (product as unknown as { shippingCharge?: number }).shippingCharge,
        requiresShipping:
          (product as unknown as { requiresShipping?: boolean }).requiresShipping ?? true,
        fulfillmentType: (
          product as unknown as { fulfillmentType?: 'self-ship' | 'marketplace-fulfilled' }
        ).fulfillmentType,
        shippingWeight: (product as unknown as { shippingWeight?: number }).shippingWeight,
        shippingDimensions: (
          product as unknown as {
            shippingDimensions?: { length?: number; width?: number; height?: number }
          }
        ).shippingDimensions
          ? {
              length: (
                product as unknown as {
                  shippingDimensions?: { length?: number; width?: number; height?: number }
                }
              ).shippingDimensions!.length,
              width: (
                product as unknown as {
                  shippingDimensions?: { length?: number; width?: number; height?: number }
                }
              ).shippingDimensions!.width,
              height: (
                product as unknown as {
                  shippingDimensions?: { length?: number; width?: number; height?: number }
                }
              ).shippingDimensions!.height,
            }
          : undefined,
        // Product Features & Policies
        payOnDelivery: (product as unknown as { payOnDelivery?: boolean }).payOnDelivery ?? true,
        returnable: (product as unknown as { returnable?: boolean }).returnable ?? true,
        returnDays: (product as unknown as { returnDays?: number }).returnDays ?? 10,
        warranty: (product as unknown as { warranty?: boolean }).warranty ?? true,
        // Convert warrantyDays to warrantyPeriod and warrantyPeriodUnit
        warrantyPeriod: (() => {
          const warrantyDays = (product as unknown as { warrantyDays?: number }).warrantyDays ?? 10
          // Convert days to months (default) or years
          if (warrantyDays >= 365) {
            const years = Math.round(warrantyDays / 365)
            return years
          } else {
            const months = Math.round(warrantyDays / 30)
            return months || 1
          }
        })(),
        warrantyPeriodUnit: (() => {
          const warrantyDays = (product as unknown as { warrantyDays?: number }).warrantyDays ?? 10
          return warrantyDays >= 365 ? 'years' : 'months'
        })(),
        // SEO
        metaTitle: (product as unknown as { metaTitle?: string }).metaTitle,
        metaDescription: (product as unknown as { metaDescription?: string }).metaDescription,
        seoKeywords: (product as unknown as { seoKeywords?: string[] }).seoKeywords,
        discountPercent: (product as unknown as { discountPercent?: number }).discountPercent,
        discountStartDate: (product as unknown as { discountStart?: string | Date }).discountStart
          ? dayjs((product as unknown as { discountStart?: string | Date }).discountStart as string)
          : undefined,
        discountEndDate: (product as unknown as { discountEnd?: string | Date }).discountEnd
          ? dayjs((product as unknown as { discountEnd?: string | Date }).discountEnd as string)
          : undefined,
      })

      // Load existing images
      if (product.mainImage) {
        setMainImageList([
          {
            uid: '-1',
            name: 'main-image',
            status: 'done',
            url: product.mainImage,
          },
        ])
      }

      if (product.images?.length) {
        setImagesList(
          product.images.map((url: string, index: number) => ({
            uid: `-${index + 2}`,
            name: `image-${index}`,
            status: 'done',
            url,
          })),
        )
      }

      // Load existing videos
      const productVideos = (product as { videos?: string[] }).videos
      if (productVideos?.length && setVideosList) {
        setVideosList(
          productVideos.map((url: string, index: number) => ({
            uid: `-video-${index + 1}`,
            name: `video-${index}`,
            status: 'done',
            url,
          })),
        )
      }

      // Merge old features into specifications (for backward compatibility)
      const oldSpecs = product.specifications || []
      const oldFeatures = (product as { features?: string[] }).features || []
      const mergedSpecs: Array<{ key?: string; value: string }> = [
        ...oldSpecs.map((s: { key?: string; value: string }) => ({
          key: s.key || '',
          value: s.value,
        })),
        ...oldFeatures.map((f: string) => ({ key: '', value: f })), // Empty key for simple features
      ]
      setSpecifications(mergedSpecs)
      setTags(product.tags || [])
      const normalizedFilterMetadata = normalizeFilterMetadata(
        (product as { filterMetadata?: unknown }).filterMetadata,
      )
      setFilterMetadata(
        normalizedFilterMetadata.map((entry) =>
          createFilterMetadataEntry({ key: entry.key, values: entry.values }),
        ),
      )

      // Load variants if they exist
      if (product.hasVariants && product.variants?.length) {
        const loadedVariants: VariantState[] = product.variants.map(
          (variant: NonNullable<ProductWithVariants['variants']>[number], variantIndex: number) => {
            // Convert variant mainImage to UploadFile format if it's a string
            let variantMainImage: UploadFile | string | null = null
            const variantMainImageData = (variant as { mainImage?: string | null }).mainImage
            if (variantMainImageData) {
              variantMainImage = {
                uid: `variant-main-${variantIndex}`,
                name: `variant-main-image-${variantIndex}`,
                status: 'done',
                url: variantMainImageData,
              }
            }

            // Convert variant images to UploadFile format if they're strings
            const variantImagesData = (variant as { images?: string[] }).images || []
            const variantImages: Array<UploadFile | string> = variantImagesData.map(
              (url: string, imgIndex: number) => ({
                uid: `variant-${variantIndex}-img-${imgIndex}`,
                name: `variant-image-${variantIndex}-${imgIndex}`,
                status: 'done',
                url,
              }),
            )

            // Convert variant videos to UploadFile format if they're strings
            const variantVideosData = (variant as { videos?: string[] }).videos || []
            const variantVideos: Array<UploadFile | string> = variantVideosData.map(
              (url: string, vidIndex: number) => ({
                uid: `variant-${variantIndex}-vid-${vidIndex}`,
                name: `variant-video-${variantIndex}-${vidIndex}`,
                status: 'done',
                url,
              }),
            )
            console.log('VALUE', variant)
            return {
              id: variant._id || Date.now().toString(),
              name: variant.name,
              sku: variant.sku,
              price: variant.price || 0,
              comparePrice: variant.comparePrice || 0,
              costPrice: variant.costPrice || 0,
              discountPercent: (variant as { discountPercent?: number }).discountPercent || 0,
              stock: variant.stock || 0,
              lowStockThreshold: (variant as { lowStockThreshold?: number }).lowStockThreshold || 5,
              warehouseInventory:
                (
                  variant as {
                    warehouseInventory?: Array<{
                      warehouseId: string
                      warehouseName: string
                      quantity: number
                      lowStockThreshold?: number
                    }>
                  }
                ).warehouseInventory || [],
              attributes: variant.attributes || {},
              isDefault: variant.isDefault || false,
              mainImage: variantMainImage,
              images: variantImages,
              videos: variantVideos,
              status: (variant as { status?: string }).status || 'active',
              // GST/HSN fields
              // Handle null values - convert null to undefined for optional fields
              hsnSacCode: (() => {
                const value = (variant as { hsnSacCode?: string | null }).hsnSacCode
                return value === null || value === undefined ? undefined : value
              })(),
              // CGST and SGST - handle null/undefined properly
              cgstRatePercent: (() => {
                const value = (variant as { cgstRatePercent?: number | null }).cgstRatePercent
                return value === null || value === undefined ? undefined : value
              })(),
              sgstRatePercent: (() => {
                const value = (variant as { sgstRatePercent?: number | null }).sgstRatePercent
                return value === null || value === undefined ? undefined : value
              })(),
              // IGST - check both igstRatePercent and gstRatePercent (legacy field)
              igstRatePercent: (() => {
                const igst = (variant as { igstRatePercent?: number | null }).igstRatePercent
                const gst = (variant as { gstRatePercent?: number | null }).gstRatePercent
                // Prefer igstRatePercent, fallback to gstRatePercent
                const value = igst !== undefined && igst !== null ? igst : gst
                return value === null || value === undefined ? undefined : value
              })(),
            }
          },
        )

        // Update centralized state
        setVariantsData(loadedVariants)
        setVariantAttributesData(product.variantAttributes || [])
        setHasVariantsData(product.hasVariants)
      }
    }
  }, [
    form,
    isEdit,
    product,
    setFilterMetadata,
    setHasVariantsData,
    setImagesList,
    setMainImageList,
    setVideosList,
    setSpecifications,
    setTags,
    setVariantAttributesData,
    setVariantsData,
  ])
}

export default useEditProductInitializer
