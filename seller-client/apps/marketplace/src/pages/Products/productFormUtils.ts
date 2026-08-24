import type { UploadFile } from 'antd'
import type { FormInstance } from 'antd/es/form'
import type { ProductFormData } from '../../api/products'

// Utility functions for variant attribute operations

/**
 * Get unique attribute names and their values from variants
 * @returns Record like { Color: ["Black", "White"], Size: ["S", "M", "L"] }
 */
export const getUniqueAttributeValues = (
  variants: Array<{ attributes: Record<string, string> }>,
): Record<string, string[]> => {
  const attributeMap: Record<string, Set<string>> = {}

  variants.forEach((variant) => {
    Object.entries(variant.attributes || {}).forEach(([key, value]) => {
      if (!attributeMap[key]) {
        attributeMap[key] = new Set()
      }
      attributeMap[key].add(value)
    })
  })

  // Convert Sets to arrays
  const result: Record<string, string[]> = {}
  Object.entries(attributeMap).forEach(([key, valueSet]) => {
    result[key] = Array.from(valueSet).sort()
  })

  return result
}

/**
 * Filter variants by a specific attribute value
 * @returns Filtered variants or all variants if no filter specified
 */
export const filterVariantsByAttribute = <T extends { attributes: Record<string, string> }>(
  variants: T[],
  attribute: string | null,
  value: string | null,
): T[] => {
  if (!attribute || !value) return variants
  return variants.filter((v) => v.attributes[attribute] === value)
}

/**
 * Get variant IDs that match a specific attribute value
 */
export const getVariantIdsByAttribute = (
  variants: Array<{ id: string; attributes: Record<string, string> }>,
  attribute: string | null,
  value: string | null,
): string[] => {
  if (!attribute || !value) return variants.map((v) => v.id)
  return variants.filter((v) => v.attributes[attribute] === value).map((v) => v.id)
}

// Variant type as used in ProductForm centralized state
export type VariantState = {
  id: string
  name: string
  sku: string
  attributes: Record<string, string>
  price?: number
  costPrice?: number
  comparePrice?: number
  discountPercent?: number
  stock?: number
  lowStockThreshold?: number
  warehouseInventory?: Array<{
    warehouseId: string
    warehouseName: string
    quantity: number
    lowStockThreshold?: number
  }>
  mainImage: UploadFile | string | null
  images: Array<UploadFile | string>
  videos?: Array<UploadFile | string>
  isDefault: boolean
  status: string
  hsnSacCode?: string
  cgstRatePercent?: number
  sgstRatePercent?: number
  igstRatePercent?: number
}

const ALLOWED_GST_RATES = [0, 5, 12, 18, 28] as const
const VALID_HSN_LENGTHS = [4, 6, 8] as const

// Basic validators
export const validateHsnSacCode = (code: string | undefined | null): boolean => {
  if (!code || typeof code !== 'string') return false
  if (!/^\d+$/.test(code)) return false // Must be numeric
  return VALID_HSN_LENGTHS.includes(code.length as 4 | 6 | 8)
}

export const validateGstRate = (rate: number | undefined | null): boolean => {
  if (rate === undefined || rate === null) return false
  return ALLOWED_GST_RATES.includes(rate as (typeof ALLOWED_GST_RATES)[number])
}

export const validateGstHsn = (params: {
  form: FormInstance
  formValues: ProductFormData
  isGstRegistered: boolean
  hasVariants: boolean
  variants: VariantState[]
}): { isValid: boolean; errors: string[] } => {
  const { form, formValues, isGstRegistered, hasVariants, variants } = params
  const errors: string[] = []
  const fieldErrors: Array<{ name: string | string[]; errors: string[] }> = []

  // Skip GST/HSN validation if seller is not GST registered
  if (!isGstRegistered) {
    return {
      isValid: true,
      errors: [],
    }
  }

  // If GST is not applicable for this product, skip GST/HSN validation entirely
  const isGstApplicableFlag =
    formValues.isGstApplicable ?? form.getFieldValue('isGstApplicable') ?? false
  if (!isGstApplicableFlag) {
    return {
      isValid: true,
      errors: [],
    }
  }

  if (!hasVariants) {
    // SIMPLE PRODUCT: Product-level HSN & GST MUST be required
    const hsnSacCode = formValues.hsnSacCode || form.getFieldValue('hsnSacCode')
    const cgstRatePercent = formValues.cgstRatePercent || form.getFieldValue('cgstRatePercent')
    const sgstRatePercent = formValues.sgstRatePercent || form.getFieldValue('sgstRatePercent')
    const igstRatePercent = formValues.igstRatePercent || form.getFieldValue('igstRatePercent')

    // Validate HSN/SAC Code
    if (!hsnSacCode || typeof hsnSacCode !== 'string' || hsnSacCode.trim().length === 0) {
      const errorMsg = 'HSN Code is required for simple products.'
      errors.push(errorMsg)
      fieldErrors.push({
        name: 'hsnSacCode',
        errors: [errorMsg],
      })
    } else if (!validateHsnSacCode(hsnSacCode)) {
      const errorMsg = 'HSN Code must be 4, 6, or 8 digits.'
      errors.push(errorMsg)
      fieldErrors.push({
        name: 'hsnSacCode',
        errors: [errorMsg],
      })
    }

    // Validate IGST Rate
    if (igstRatePercent === undefined || igstRatePercent === null) {
      const errorMsg = 'IGST Rate is required when GST is applicable.'
      errors.push(errorMsg)
      fieldErrors.push({
        name: 'igstRatePercent',
        errors: [errorMsg],
      })
    } else if (!validateGstRate(igstRatePercent)) {
      const errorMsg = 'IGST Rate must be 0, 5, 12, 18, or 28.'
      errors.push(errorMsg)
      fieldErrors.push({
        name: 'igstRatePercent',
        errors: [errorMsg],
      })
    }

    // Validate CGST Rate
    if (cgstRatePercent === undefined || cgstRatePercent === null) {
      const errorMsg = 'CGST Rate is required when GST is applicable.'
      errors.push(errorMsg)
      fieldErrors.push({
        name: 'cgstRatePercent',
        errors: [errorMsg],
      })
    } else if (
      sgstRatePercent !== undefined &&
      sgstRatePercent !== null &&
      igstRatePercent !== undefined &&
      igstRatePercent !== null &&
      cgstRatePercent + sgstRatePercent !== igstRatePercent
    ) {
      const errorMsg = `CGST + SGST (${
        cgstRatePercent + sgstRatePercent
      }%) must equal IGST (${igstRatePercent}%).`
      errors.push(errorMsg)
      fieldErrors.push({
        name: 'cgstRatePercent',
        errors: [errorMsg],
      })
    }

    // Validate SGST Rate
    if (sgstRatePercent === undefined || sgstRatePercent === null) {
      const errorMsg = 'SGST Rate is required when GST is applicable.'
      errors.push(errorMsg)
      fieldErrors.push({
        name: 'sgstRatePercent',
        errors: [errorMsg],
      })
    } else if (
      cgstRatePercent !== undefined &&
      cgstRatePercent !== null &&
      igstRatePercent !== undefined &&
      igstRatePercent !== null &&
      cgstRatePercent + sgstRatePercent !== igstRatePercent
    ) {
      const errorMsg = `CGST + SGST (${
        cgstRatePercent + sgstRatePercent
      }%) must equal IGST (${igstRatePercent}%).`
      errors.push(errorMsg)
      fieldErrors.push({
        name: 'sgstRatePercent',
        errors: [errorMsg],
      })
    }
  } else {
    // VARIANT PRODUCT: Validate variant-level HSN/GST (no inheritance)
    variants.forEach((variant) => {
      const variantHsn = variant.hsnSacCode
      const variantCgst = variant.cgstRatePercent
      const variantSgst = variant.sgstRatePercent
      const variantIgst = variant.igstRatePercent

      // Validate variant-level GST/HSN fields (no inheritance)
      if (!variantHsn || typeof variantHsn !== 'string' || variantHsn.trim().length === 0) {
        errors.push(`HSN Code required for variant "${variant.name}".`)
      } else if (!validateHsnSacCode(variantHsn)) {
        errors.push(`HSN must be 4, 6, or 8 digits for variant "${variant.name}".`)
      }

      if (variantIgst === undefined || variantIgst === null) {
        errors.push(`IGST Rate required for variant "${variant.name}".`)
      } else if (!validateGstRate(variantIgst)) {
        errors.push(`IGST Rate must be 0, 5, 12, 18, or 28 for variant "${variant.name}".`)
      }

      if (variantCgst === undefined || variantCgst === null) {
        errors.push(`CGST Rate required for variant "${variant.name}".`)
      }

      if (variantSgst === undefined || variantSgst === null) {
        errors.push(`SGST Rate required for variant "${variant.name}".`)
      } else if (
        variantCgst !== undefined &&
        variantCgst !== null &&
        variantIgst !== undefined &&
        variantIgst !== null &&
        variantCgst + variantSgst !== variantIgst
      ) {
        errors.push(
          `CGST + SGST (${
            variantCgst + variantSgst
          }%) must equal IGST (${variantIgst}%) for variant "${variant.name}".`,
        )
      }
    })
  }

  // Set form field errors
  if (fieldErrors.length > 0) {
    form.setFields(fieldErrors)
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export const processVariantsForSubmission = (params: {
  form: FormInstance
  values: ProductFormData
  variants: VariantState[]
  isGstRegistered: boolean
}) => {
  console.log('processVariantsForSubmission')
  const { form, values, variants } = params

  const usedSkus = new Set<string>()

  // Validate that all variants have unique SKUs before processing
  const variantSkus = variants.map((v) => v.sku).filter(Boolean)
  const duplicateSkus = variantSkus.filter((sku, index) => variantSkus.indexOf(sku) !== index)
  if (duplicateSkus.length > 0) {
    // This will be handled by the uniqueness logic below, but we keep the behavior consistent
    // eslint-disable-next-line no-console
    console.warn('Duplicate SKUs detected:', duplicateSkus)
  }
  console.log('bhavya!', values)

  const processedVariants = variants.map((variant, index) => {
    // Ensure each variant has a unique SKU
    let variantSku = variant.sku

    // If SKU is missing or already used, generate a unique one
    if (!variantSku || usedSkus.has(variantSku)) {
      // Generate unique SKU based on base SKU, variant attributes, and index
      const baseSku = (values.sku || 'SKU').substring(0, 4).toUpperCase()
      const attrSuffix = Object.entries(variant.attributes || {})
        .map(([key, value]) => {
          // Take first 2 chars of attribute key and first 2 chars of value
          const keyPart = key.substring(0, 2).toUpperCase()
          const valuePart = value.substring(0, 2).toUpperCase()
          return `${keyPart}${valuePart}`
        })
        .join('')
        .substring(0, 4)

      // Add index to ensure uniqueness if attributes are similar
      const uniqueSuffix = `${attrSuffix}${index.toString().padStart(2, '0')}`
      variantSku = `${baseSku}${uniqueSuffix}`.substring(0, 12) // Max 12 chars

      // If still duplicate, append more characters
      let counter = 0
      while (usedSkus.has(variantSku) && counter < 100) {
        variantSku = `${baseSku}${uniqueSuffix}${counter}`.substring(0, 12)
        counter++
      }
    }

    // Mark this SKU as used
    usedSkus.add(variantSku)

    // Get default GST/HSN values from form
    const defaultHsn = form.getFieldValue('defaultHsnSacCode')
    const defaultCgst = form.getFieldValue('defaultCgstRatePercent')
    const defaultSgst = form.getFieldValue('defaultSgstRatePercent')
    const defaultIgst = form.getFieldValue('defaultIgstRatePercent')
    // Determine if variant inherits GST/HSN

    // Get variant GST/HSN values - use defaults if inheriting and variant doesn't have custom values
    const variantHsn = !variant.hsnSacCode && defaultHsn ? defaultHsn : variant.hsnSacCode
    const variantCgst =
      (variant.cgstRatePercent === undefined || variant.cgstRatePercent === null) &&
      defaultCgst !== undefined
        ? defaultCgst
        : variant.cgstRatePercent
    const variantSgst =
      (variant.sgstRatePercent === undefined || variant.sgstRatePercent === null) &&
      defaultSgst !== undefined
        ? defaultSgst
        : variant.sgstRatePercent
    const variantIgst =
      (variant.igstRatePercent === undefined || variant.igstRatePercent === null) &&
      defaultIgst !== undefined
        ? defaultIgst
        : variant.igstRatePercent

    const processedVariant = {
      id: variant.id,
      name: variant.name,
      sku: variantSku,
      attributes: variant.attributes || {},
      price: variant.price ?? 0,
      costPrice: variant.costPrice ?? 0,
      comparePrice: variant.comparePrice ?? 0,
      discountPercent: variant.discountPercent ?? 0,
      stock: variant.stock ?? 0,
      lowStockThreshold: variant.lowStockThreshold ?? 5,
      warehouseInventory: variant.warehouseInventory || undefined,
      hsnSacCode: variantHsn,
      cgstRatePercent: variantCgst,
      sgstRatePercent: variantSgst,
      igstRatePercent: variantIgst,
      mainImage: (() => {
        const raw = variant.mainImage as unknown
        const isHostedUrl = (u: string | undefined) =>
          u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
        const getCloudflareUrl = (o: { __publicUrl?: string; url?: string } | undefined) =>
          o?.__publicUrl ?? o?.url
        if (typeof raw === 'string' && isHostedUrl(raw)) return raw
        if (raw && typeof raw === 'object') {
          const possible = raw as { originFileObj?: File; url?: string; __publicUrl?: string }
          const u = getCloudflareUrl(possible)
          if (isHostedUrl(u)) return u
          if (possible.originFileObj) return possible.originFileObj
        }
        if (raw instanceof File) return raw
        return undefined
      })(),
      images:
        variant.images
          ?.map((img) => {
            const raw = img as unknown
            const isHostedUrl = (u: string | undefined) =>
              u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
            const getCloudflareUrl = (o: { __publicUrl?: string; url?: string } | undefined) =>
              o?.__publicUrl ?? o?.url
            if (typeof raw === 'string' && isHostedUrl(raw)) return raw
            if (raw && typeof raw === 'object') {
              const uploadFile = raw as { originFileObj?: File; url?: string; __publicUrl?: string }
              const u = getCloudflareUrl(uploadFile)
              if (isHostedUrl(u)) return u
              return uploadFile.originFileObj
            }
            if (raw instanceof File) return raw
            return undefined
          })
          .filter(Boolean) || [],
      videos:
        variant.videos
          ?.map((vid) => {
            const raw = vid as unknown
            const isHostedUrl = (u: string | undefined) =>
              u && typeof u === 'string' && (u.startsWith('http://') || u.startsWith('https://'))
            const getCloudflareUrl = (o: { __publicUrl?: string; url?: string } | undefined) =>
              o?.__publicUrl ?? o?.url
            if (typeof raw === 'string' && isHostedUrl(raw)) return raw
            if (raw && typeof raw === 'object') {
              const uploadFile = raw as { originFileObj?: File; url?: string; __publicUrl?: string }
              const u = getCloudflareUrl(uploadFile)
              if (isHostedUrl(u)) return u
              return uploadFile.originFileObj
            }
            if (raw instanceof File) return raw
            return undefined
          })
          .filter(Boolean) || [],
      isDefault: variant.isDefault,
      status: variant.status,
    }

    // eslint-disable-next-line no-console
    console.log('=== PROCESSING VARIANT ===')
    // eslint-disable-next-line no-console
    console.log('Original variant:', variant)
    // eslint-disable-next-line no-console
    console.log('Processed variant:', processedVariant)
    // eslint-disable-next-line no-console
    console.log('=== END PROCESSING VARIANT ===')

    return processedVariant
  })

  // Final validation: Ensure all processed variants have unique SKUs
  const finalSkus = processedVariants.map((v) => v.sku)
  const finalDuplicates = finalSkus.filter((sku, index) => finalSkus.indexOf(sku) !== index)
  if (finalDuplicates.length > 0) {
    // eslint-disable-next-line no-console
    console.error('ERROR: Duplicate SKUs after processing:', finalDuplicates)
    throw new Error(`Duplicate SKUs detected: ${finalDuplicates.join(', ')}`)
  }

  return processedVariants
}
