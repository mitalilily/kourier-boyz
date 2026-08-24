import type { FormInstance } from 'antd/es/form'
import type { MessageInstance } from 'antd/es/message/interface'
import type { NavigateFunction } from 'react-router-dom'
import type { ProductFormData } from '../../api/products'
import { useAuthStore } from '../../store/authStore'
import type { VariantState } from './productFormUtils'
import { processVariantsForSubmission, validateGstHsn } from './productFormUtils'
import { calculatePricing } from './components/PricingInventoryTab/utils'

type UseProductSubmitParams = {
  form: FormInstance
  isEdit: boolean
  id?: string
  isGstRegistered: boolean
  variants: VariantState[]
  variantAttributes: string[]
  hasVariants: boolean
  filterMetadata: Array<{ key: string; values: string[] }>
  specifications: Array<{ key?: string; value: string }>
  tags: string[]
  mainImageList: Array<{ originFileObj?: File; url?: string }>
  imagesList: Array<{ originFileObj?: File; url?: string }>
  videosList?: Array<{ originFileObj?: File; url?: string }>
  product: { variants?: unknown; hasVariants?: boolean } | null | undefined
  sizeChartData?: {
    title: string;
    description?: string;
    measurementType: "US" | "UK" | "EU" | "IN" | "custom";
    measurements: Array<{ name: string; unit: "cm" | "inch" }>;
    rows: Array<{
      size: string;
      measurements: Array<{ name: string; value: number | string }>;
    }>;
    image?: string;
    isActive?: boolean;
    imageFile?: File | null;
  } | null
  savingAsDraft: boolean
  setSavingAsDraft: (val: boolean) => void
  createMutation: { mutateAsync: (data: ProductFormData) => Promise<unknown> }
  updateMutation: { mutateAsync: (args: { id: string; data: ProductFormData }) => Promise<unknown> }
  navigate: NavigateFunction
  message: MessageInstance
}

const useProductSubmit = ({
  form,
  isEdit,
  id,
  isGstRegistered,
  variants,
  variantAttributes,
  hasVariants,
  filterMetadata,
  specifications,
  tags,
  mainImageList,
  imagesList,
  videosList = [],
  product,
  sizeChartData,
  savingAsDraft,
  setSavingAsDraft,
  createMutation,
  updateMutation,
  navigate,
  message,
}: UseProductSubmitParams) => {
  const user = useAuthStore((state) => state.user)
  const defaultShippingRate = user?.defaultShippingRate || 0

  const onFinish = async (values: ProductFormData) => {
    try {
      // Ensure shippingCharge is set - use defaultShippingRate if not provided
      // This ensures that even if the seller doesn't touch the field, the default rate is saved
      // Check both form values and form field value (in case field wasn't touched)
      const formShippingCharge = form.getFieldValue('shippingCharge')
      const shippingChargeValue = 
        values.shippingCharge !== undefined && values.shippingCharge !== null
          ? values.shippingCharge
          : (formShippingCharge !== undefined && formShippingCharge !== null && typeof formShippingCharge === 'number')
          ? formShippingCharge
          : undefined
      
      // If shippingCharge is not set, use defaultShippingRate (if available)
      // Note: 0 is a valid value (free shipping), so we only use default if truly undefined/null
      const shippingCharge = 
        shippingChargeValue !== undefined && shippingChargeValue !== null
          ? shippingChargeValue
          : (defaultShippingRate > 0 ? defaultShippingRate : undefined)

      // Validate GST/HSN before proceeding (only if GST registered)
      if (isGstRegistered) {
        const gstHsnValidation = validateGstHsn({
          form,
          formValues: values,
          isGstRegistered,
          hasVariants,
          variants,
        })
        if (!gstHsnValidation.isValid) {
          const errorMessage =
            gstHsnValidation.errors.length > 0
              ? gstHsnValidation.errors[0]
              : 'Please fix GST/HSN validation errors before submitting.'
          message.error(errorMessage)
          const firstErrorField = form.getFieldsError().find((f) => f.errors.length > 0)
          if (firstErrorField) {
            form.scrollToField(firstErrorField.name)
          }
          return
        }
      }
      console.log('form', values, 'variants', variants)

      console.log('=== USING CENTRALIZED VARIANT STATE ===')
      console.log('Centralized variants:', variants)
      console.log('Centralized variantAttributes:', variantAttributes)
      console.log('Centralized hasVariants:', hasVariants)
      console.log('=== END CENTRALIZED STATE ===')

      const formVariants = form.getFieldValue('variants')
      console.log('=== FORM VARIANTS ===')
      console.log('Form variants:', formVariants)
      console.log('=== END FORM VARIANTS ===')

      // Process variants - ensure each variant has a unique SKU
      const processedVariants = processVariantsForSubmission({
        form,
        values,
        variants,
        isGstRegistered,
      })
      console.log('processedVariants BHAVYA', processedVariants)
      const cleanedFilterMetadata = filterMetadata
        .map((meta) => ({
          key: meta.key.trim(),
          values: (meta.values || []).map((val) => val.trim()).filter(Boolean),
        }))
        .filter((meta) => meta.key.length > 0 && meta.values.length > 0)

      // If seller is not GST registered, force null values for GST/HSN fields
      const productGstFields = isGstRegistered
        ? {
            isGstApplicable: values.isGstApplicable ?? false,
            hsnSacCode: values.hsnSacCode,
            cgstRatePercent: values.cgstRatePercent,
            sgstRatePercent: values.sgstRatePercent,
            igstRatePercent: values.igstRatePercent,
            defaultHsnSacCode: values.defaultHsnSacCode,
            defaultCgstRatePercent: values.defaultCgstRatePercent,
            defaultSgstRatePercent: values.defaultSgstRatePercent,
            defaultIgstRatePercent: values.defaultIgstRatePercent,
          }
        : {
            isGstApplicable: false,
            hsnSacCode: null,
            cgstRatePercent: null,
            sgstRatePercent: null,
            igstRatePercent: null,
            defaultHsnSacCode: null,
            defaultCgstRatePercent: null,
            defaultSgstRatePercent: null,
            defaultIgstRatePercent: null,
          }
      console.log('productGstFields', productGstFields)
      
      // Get warehouseInventory from form for simple products - ensure it's a valid array
      // Only get it for simple products (not variants)
      const warehouseInventoryValue = hasVariants ? undefined : form.getFieldValue('warehouseInventory')
      // Ensure warehouseInventory is always a valid array (empty array if no warehouses assigned)
      const warehouseInventory = Array.isArray(warehouseInventoryValue)
        ? warehouseInventoryValue
        : undefined
      
      // Extract warehouseInventory from values to avoid incorrect values (might be string or wrong type)
      const valuesWithoutWarehouseInventoryAndStock = (() => {
        const rest = { ...((values as unknown) as Record<string, unknown>) }
        delete rest['warehouseInventory']
        delete rest['stock']
        return rest
      })()
      
      const formData: ProductFormData = {
        name: values.name,
        description: values.description,
        price: values.price || 0,
        category: values.category,
        ...valuesWithoutWarehouseInventoryAndStock,
        // Re-add stock from form to ensure correct value
        stock: form.getFieldValue('stock'),
        ...productGstFields,
        // Set shippingCharge - use defaultShippingRate if not explicitly set
        shippingCharge: shippingCharge,
        status: savingAsDraft ? 'draft' : values.status || 'active',
        ...(hasVariants
          ? {}
          : (() => {
              const simplePrice = values.price || 0
              const simpleComparePrice = values.comparePrice || 0
              const simpleCostPrice = values.costPrice || 0
              const simpleDiscountPercent = values.discountPercent || 0
              const isGstApplicable = values.isGstApplicable || false
              const igstRatePercent = values.igstRatePercent
              const totalGstRate = igstRatePercent !== null && igstRatePercent !== undefined ? igstRatePercent : undefined

              // Use the same calculatePricing function as variants for consistency
              const { exclusivePrice, effectivePrice, profit } = calculatePricing(
                simplePrice,
                simpleCostPrice,
                simpleComparePrice,
                simpleDiscountPercent,
                isGstApplicable,
                totalGstRate,
              )

              // Calculate GST amount for exclusiveTaxAmount field
              const simpleGstAmount =
                isGstApplicable && totalGstRate !== undefined && totalGstRate !== null && exclusivePrice > 0
                  ? (exclusivePrice * totalGstRate) / 100
                  : 0

              return {
                exclusivePrice,
                exclusiveTaxAmount: simpleGstAmount,
                effectivePrice,
                profit,
                // Only include warehouseInventory if it's a valid array
                // If it's undefined (not an array), don't include it - backend will handle it
                ...(warehouseInventory !== undefined && Array.isArray(warehouseInventory) && { warehouseInventory }),
              }
            })()),
        payOnDelivery: values.payOnDelivery !== undefined ? values.payOnDelivery : true,
        returnable: values.returnable !== undefined ? values.returnable : true,
        returnDays: values.returnDays !== undefined ? values.returnDays : 10,
        warranty: values.warranty !== undefined ? values.warranty : true,
        warrantyDays: (() => {
          const formValues = form.getFieldsValue() as {
            warrantyPeriod?: number
            warrantyPeriodUnit?: 'months' | 'years'
          }
          const period = formValues.warrantyPeriod ?? 1
          const unit = formValues.warrantyPeriodUnit ?? 'months'
          if (unit === 'years') {
            return period * 365
          }
          return period * 30
        })(),
        specifications: specifications
          .filter((s) => s.value && s.value.trim())
          .map((s) => ({ key: s.key || '', value: s.value.trim() })),
        tags,
        filterMetadata: cleanedFilterMetadata,
        variants: processedVariants.map((variant) => {
          console.log('=== MAPPING VARIANT TO FORMDATA ===')
          console.log('variant:', variant)
          console.log('variant.hsnSacCode:', variant.hsnSacCode)

          let variantMainImage: File | string | undefined
          if (variant.mainImage) {
            if (variant.mainImage instanceof File) {
              variantMainImage = variant.mainImage
            } else if (typeof variant.mainImage === 'string') {
              variantMainImage = variant.mainImage
            } else if (typeof variant.mainImage === 'object') {
              const uploadFile = variant.mainImage as { originFileObj?: File; url?: string }
              if (uploadFile.originFileObj) {
                variantMainImage = uploadFile.originFileObj
              } else if (uploadFile.url) {
                variantMainImage = uploadFile.url
              }
            }
          }

          const imageFiles: File[] = []
          const imageStrings: string[] = []

          variant.images?.forEach((img) => {
            if (typeof img === 'string') {
              imageStrings.push(img)
            } else if (img instanceof File) {
              imageFiles.push(img)
            } else if (typeof img === 'object') {
              const uploadFile = img as { originFileObj?: File; url?: string }
              if (uploadFile.originFileObj) {
                imageFiles.push(uploadFile.originFileObj)
              } else if (uploadFile.url) {
                imageStrings.push(uploadFile.url)
              }
            }
          })

          const videoFiles: File[] = []
          const videoStrings: string[] = []

          ;(variant as { videos?: Array<File | string | { originFileObj?: File; url?: string }> }).videos?.forEach((vid) => {
            if (typeof vid === 'string') {
              videoStrings.push(vid)
            } else if (vid instanceof File) {
              videoFiles.push(vid)
            } else if (typeof vid === 'object') {
              const uploadFile = vid as { originFileObj?: File; url?: string }
              if (uploadFile.originFileObj) {
                videoFiles.push(uploadFile.originFileObj)
              } else if (uploadFile.url) {
                videoStrings.push(uploadFile.url)
              }
            }
          })

          // Calculate effectivePrice and profit for variant using the same logic as simple products
          const variantPrice = variant.price || 0
          const variantComparePrice = variant.comparePrice || 0
          const variantCostPrice = variant.costPrice || 0
          const variantDiscountPercent = variant.discountPercent || 0
          const isGstApplicable = form.getFieldValue('isGstApplicable') || false
          const variantIgst =
            (variant as { igstRatePercent?: number }).igstRatePercent ??
            form.getFieldValue('defaultIgstRatePercent')
          const variantTotalGst = variantIgst

          // Use the same calculatePricing function for consistency
          const { exclusivePrice: variantExclusivePrice, effectivePrice: variantEffectivePrice, profit: variantProfit } = calculatePricing(
            variantPrice,
            variantCostPrice,
            variantComparePrice,
            variantDiscountPercent,
            isGstApplicable,
            variantTotalGst,
          )

          // Calculate GST amount for exclusiveTaxAmount field
          const variantGstAmount =
            isGstApplicable && variantTotalGst !== undefined && variantTotalGst !== null && variantExclusivePrice > 0
              ? (variantExclusivePrice * variantTotalGst) / 100
              : 0

          const defaultHsn = form.getFieldValue('defaultHsnSacCode')
          const defaultCgst = form.getFieldValue('defaultCgstRatePercent')
          const defaultSgst = form.getFieldValue('defaultSgstRatePercent')
          const defaultIgst = form.getFieldValue('defaultIgstRatePercent')

          const finalHsn =
            (!variant.hsnSacCode || variant.hsnSacCode === '') && defaultHsn
              ? defaultHsn
              : variant.hsnSacCode
          const finalCgst =
            ((variant as { cgstRatePercent?: number }).cgstRatePercent === undefined ||
              (variant as { cgstRatePercent?: number }).cgstRatePercent === null) &&
            defaultCgst !== undefined
              ? defaultCgst
              : (variant as { cgstRatePercent?: number }).cgstRatePercent
          const finalSgst =
            ((variant as { sgstRatePercent?: number }).sgstRatePercent === undefined ||
              (variant as { sgstRatePercent?: number }).sgstRatePercent === null) &&
            defaultSgst !== undefined
              ? defaultSgst
              : (variant as { sgstRatePercent?: number }).sgstRatePercent
          const finalIgst =
            ((variant as { igstRatePercent?: number }).igstRatePercent === undefined ||
              (variant as { igstRatePercent?: number }).igstRatePercent === null) &&
            defaultIgst !== undefined
              ? defaultIgst
              : (variant as { igstRatePercent?: number }).igstRatePercent

          const mappedVariant = {
            _id: variant.id,
            name: variant.name,
            sku: variant.sku,
            price: variant.price,
            comparePrice: variant.comparePrice,
            costPrice: variant.costPrice,
            discountPercent: variant.discountPercent,
            exclusivePrice: variantExclusivePrice,
            exclusiveTaxAmount: variantGstAmount,
            effectivePrice: variantEffectivePrice,
            profit: variantProfit,
            stock: variant.stock,
            lowStockThreshold: variant.lowStockThreshold,
            attributes: variant.attributes,
            isDefault: variant.isDefault,
            status: variant.status,
            mainImage: variantMainImage,
            images: imageFiles.length > 0 ? imageFiles : imageStrings,
            videos: videoFiles.length > 0 ? videoFiles : videoStrings,
            warehouseInventory: variant.warehouseInventory || undefined,
            hsnSacCode: isGstRegistered ? finalHsn : null,
            cgstRatePercent: isGstRegistered ? finalCgst : null,
            sgstRatePercent: isGstRegistered ? finalSgst : null,
            igstRatePercent: isGstRegistered ? finalIgst : null,
          }

          console.log('Mapped variant:', mappedVariant)

          return mappedVariant
        }),
        variantAttributes,
        hasVariants,
      }

      console.log('=== FINAL FORMDATA BEFORE SUBMISSION ===')
      console.log('Complete formData:', JSON.stringify(formData, null, 2))

      // Strong normalization: ensure variant images are strictly Files or string URLs
      if (Array.isArray(formData.variants)) {
        formData.variants = (formData.variants as Array<Record<string, unknown>>).map((v) => {
          const imagesField = v['images'] as unknown
          const normalizedImages: Array<File | string> = Array.isArray(imagesField)
            ? ((imagesField as Array<unknown>)
                .map((img) => {
                  if (img instanceof File) return img
                  if (typeof img === 'string') return img
                  if (img && typeof img === 'object') {
                    const maybe = img as { originFileObj?: File; url?: string }
                    return maybe.originFileObj || maybe.url || undefined
                  }
                  return undefined
                })
                .filter(Boolean) as Array<File | string>)
            : []
          return {
            ...v,
            images: normalizedImages,
            hsnSacCode: v['hsnSacCode'],
            cgstRatePercent: v['cgstRatePercent'],
            sgstRatePercent: v['sgstRatePercent'],
            igstRatePercent: v['igstRatePercent'],
          }
        }) as unknown as ProductFormData['variants']
      }

      // Only treat http(s) URLs as hosted (Cloudflare R2); ignore blob/data preview URLs
      const isHostedUrl = (u: string | undefined) =>
        u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))

      // If variants exist, mirror default variant SKU and media to main product fields
      if (Array.isArray(processedVariants) && processedVariants.length > 0) {
        const defaultVariant = processedVariants.find((v) => v.isDefault) || processedVariants[0]
        if (defaultVariant) {
          formData.sku = defaultVariant.sku

          const getVariantCloudflareUrl = (o: unknown) =>
            o && typeof o === 'object' && '__publicUrl' in o
              ? (o as { __publicUrl?: string }).__publicUrl
              : o && typeof o === 'object' && 'url' in o
                ? (o as { url?: string }).url
                : undefined
          if (!formData.mainImage && !formData.existingMainImage) {
            const dvMain = defaultVariant.mainImage as unknown
            if (typeof dvMain === 'string' && isHostedUrl(dvMain)) {
              formData.existingMainImage = dvMain
            } else if (dvMain && typeof dvMain === 'object') {
              const u = getVariantCloudflareUrl(dvMain)
              if (isHostedUrl(u)) formData.existingMainImage = u!
              else if (dvMain instanceof File) formData.mainImage = dvMain
            } else if (dvMain instanceof File) {
              formData.mainImage = dvMain
            }
          }

          if (Array.isArray(defaultVariant.images) && defaultVariant.images.length > 0) {
            const dvImageFiles: File[] = []
            const dvImageUrls: string[] = []
            ;(defaultVariant.images as Array<unknown>).forEach((img) => {
              if (typeof img === 'string' && isHostedUrl(img)) dvImageUrls.push(img)
              else if (img && typeof img === 'object') {
                const u = getVariantCloudflareUrl(img)
                if (isHostedUrl(u)) dvImageUrls.push(u!)
                else if (img instanceof File) dvImageFiles.push(img)
              } else if (img instanceof File) dvImageFiles.push(img)
            })
            const currentNewImages: File[] = Array.isArray(formData.images)
              ? (formData.images as File[])
              : []
            const currentExisting: string[] = Array.isArray(formData.existingImages)
              ? (formData.existingImages as string[])
              : []
            formData.images = [...currentNewImages, ...dvImageFiles]
            formData.existingImages = [...currentExisting, ...dvImageUrls]
          }
        }
      }

      // Use __publicUrl (Cloudflare URL set after presign) so we don't rely on .url (can be overwritten by preview)
      const getCloudflareUrl = (file: { url?: string; __publicUrl?: string } | undefined) =>
        (file as { __publicUrl?: string } | undefined)?.__publicUrl ?? file?.url

      // Handle main image: prefer Cloudflare URL over binary
      const mainCloudflareUrl = getCloudflareUrl(mainImageList[0])
      if (isHostedUrl(mainCloudflareUrl)) {
        formData.existingMainImage = mainCloudflareUrl!
      } else if (mainImageList[0]?.originFileObj) {
        formData.mainImage = mainImageList[0].originFileObj as File
      }

      // Handle additional images: use Cloudflare URL from __publicUrl when available
      const newImages: File[] = []
      const existingImageUrls: string[] = []

      imagesList.forEach((file) => {
        const cloudflareUrl = getCloudflareUrl(file)
        if (isHostedUrl(cloudflareUrl)) {
          existingImageUrls.push(cloudflareUrl!)
        } else if (file.originFileObj) {
          newImages.push(file.originFileObj as File)
        }
      })

      formData.images = newImages
      formData.existingImages = existingImageUrls

      // Handle videos - only for simple products (not variant products)
      if (!hasVariants) {
        const newVideos: File[] = []
        const existingVideoUrls: string[] = []

        videosList.forEach((file) => {
          const cloudflareUrl = getCloudflareUrl(file)
          if (isHostedUrl(cloudflareUrl)) {
            existingVideoUrls.push(cloudflareUrl!)
          } else if (file.originFileObj) {
            newVideos.push(file.originFileObj as File)
          }
        })

        formData.videos = newVideos
        formData.existingVideos = existingVideoUrls
      }
      // For variant products, product-level videos are not included

      // Detect if variants actually changed (including media)
      const productVariants = (product?.variants as unknown as Array<unknown>) || []
      const simpleNormalize = (v: unknown) => (v === undefined || v === null ? '' : v)
      const areVariantListsEqual = () => {
        const hasNewFiles = processedVariants.some((v) => {
          const mainIsFile = v.mainImage instanceof File
          const imagesHaveFile = Array.isArray(v.images)
            ? v.images.some((img) => img instanceof File)
            : false
          const videosHaveFile = Array.isArray((v as { videos?: unknown[] }).videos)
            ? (v as { videos?: unknown[] }).videos?.some((vid) => vid instanceof File)
            : false
          return mainIsFile || imagesHaveFile || videosHaveFile
        })
        console.log('hasNewFiles BHAVYA', hasNewFiles, processedVariants, productVariants)

        if (hasNewFiles) return false

        if (!product?.hasVariants) return false
        if (processedVariants.length !== productVariants.length) return false
        const byKey = (list: Array<unknown>) =>
          list
            .map((v) => {
              const vv = v as Record<string, unknown>
              return {
                name: String(vv['name'] ?? ''),
                sku: String(vv['sku'] ?? ''),
                price: simpleNormalize(vv['price']),
                comparePrice: simpleNormalize(vv['comparePrice']),
                costPrice: simpleNormalize(vv['costPrice']),
                stock: simpleNormalize(vv['stock']),
                lowStockThreshold: simpleNormalize(vv['lowStockThreshold']),
                discountPercent: simpleNormalize(vv['discountPercent']),
                attributes: JSON.stringify((vv['attributes'] as Record<string, string>) || {}),
                isDefault: Boolean(vv['isDefault']),
                warehouseInventory: JSON.stringify(
                  Array.isArray(vv['warehouseInventory'])
                    ? (vv['warehouseInventory'] as Array<Record<string, unknown>>)
                        .map((wi) => ({
                          warehouseId: String(wi['warehouseId'] ?? ''),
                          warehouseName: String(wi['warehouseName'] ?? ''),
                          quantity: simpleNormalize(wi['quantity']),
                          lowStockThreshold: simpleNormalize(wi['lowStockThreshold']),
                        }))
                        .sort((a, b) => a.warehouseId.localeCompare(b.warehouseId))
                    : [],
                ),
                mainImage: typeof vv['mainImage'] === 'string' ? (vv['mainImage'] as string) : '',
                images: JSON.stringify(
                  ((vv['images'] as unknown[]) || []).filter((i) => typeof i === 'string'),
                ),
                videos: JSON.stringify(
                  ((vv['videos'] as unknown[]) || []).filter((v) => typeof v === 'string'),
                ),
              }
            })
            .sort((a, b) => a.sku.localeCompare(b.sku))

        const current = byKey(processedVariants)
        const existing = byKey(productVariants)
        return JSON.stringify(current) === JSON.stringify(existing)
      }

      const variantsChanged = hasVariants && !areVariantListsEqual()

      if (!variantsChanged) {
        delete (formData as unknown as Record<string, unknown>)['variants']
        delete (formData as unknown as Record<string, unknown>)['variantAttributes']
        delete (formData as unknown as Record<string, unknown>)['hasVariants']
      }

      const isPublishingActive = formData.status === 'active'
      const publishIssues: string[] = []
      if (!formData.name || !formData.name.trim()) publishIssues.push('Product name')
      if (!formData.description || !formData.description.trim()) publishIssues.push('Description')
      if (formData.price === undefined || formData.price === null) publishIssues.push('Price')
      if (!formData.category) publishIssues.push('Category')

      if (isPublishingActive) {
        const hasMainImage = !!formData.mainImage || !!formData.existingMainImage
        if (!hasMainImage) publishIssues.push('Main image')
      }

      if (hasVariants) {
        if (!variantAttributes || variantAttributes.length === 0) {
          message.error('Please select variant attributes before enabling variants.')
          return
        }
        if (!variants || variants.length === 0) {
          message.error('Please generate at least one variant or disable variants.')
          return
        }

        const variantsMissingPrice = variants.filter(
          (v) => v.price === undefined || v.price === null || Number.isNaN(Number(v.price)),
        )
        if (variantsMissingPrice.length > 0) {
          message.error('Please set a price for each variant.')
          return
        }
      }

      if (!hasVariants && values.status === 'active') {
        const priceValid = typeof values.price === 'number' && values.price > 0
        if (!priceValid) {
          message.error('Active simple products must have a positive price.')
          return
        }
      }

      let createdProductId: string | undefined = id;

      if (isEdit && id) {
        const updateResult = await updateMutation.mutateAsync({ id, data: formData }) as { message?: string; categoryApprovalPending?: boolean }
        if (updateResult?.categoryApprovalPending) {
          message.warning(updateResult.message || 'This brand is not approved for the selected category. Awaiting admin approval.')
        } else {
          message.success(savingAsDraft ? 'Product saved as draft' : 'Product updated successfully')
        }
      } else {
        const result = await createMutation.mutateAsync(formData) as { _id?: string; id?: string; message?: string; categoryApprovalPending?: boolean }
        createdProductId = result?._id || result?.id || id
        if (result?.categoryApprovalPending) {
          message.warning(result.message || 'This brand is not approved for the selected category. Awaiting admin approval.')
        } else {
          message.success(savingAsDraft ? 'Product saved as draft' : 'Product created successfully')
        }
      }

      // Create or update size chart if data exists
      if (sizeChartData && createdProductId) {
        try {
          const { createSizeChart, updateSizeChart } = await import('../../api/sizeCharts')
          const { getSizeCharts } = await import('../../api/sizeCharts')
          
          // Check if size chart already exists
          const existingCharts = await getSizeCharts(createdProductId)
          const existingChart = existingCharts.data?.[0]

          if (existingChart) {
            // Update existing size chart
            await updateSizeChart(existingChart._id, {
              ...sizeChartData,
              imageFile: sizeChartData.imageFile || null,
            })
          } else {
            // Create new size chart
            await createSizeChart({
              ...sizeChartData,
              chartType: 'product',
              product: createdProductId,
              imageFile: sizeChartData.imageFile || null,
            })
          }
        } catch (error: unknown) {
          console.error('Failed to save size chart:', error)
          // Don't block product save if size chart fails
          message.warning('Product saved but size chart could not be saved. Please try again.')
        }
      }

      setSavingAsDraft(false)
      navigate('/products')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      message.error(
        err.response?.data?.error || `Failed to ${isEdit ? 'update' : 'create'} product`,
      )
      setSavingAsDraft(false)
    }
  }

  return onFinish
}

export default useProductSubmit
