import type { NamePath } from 'antd/es/form/interface'
import { useEffect, useState } from 'react'
import type { FormInstance } from 'antd/es/form'
import type { UploadFile } from 'antd'

/** Tab key -> field names (for error grouping). Variant-level fields (e.g. variants.0.price) go to pricing-inventory. */
export const TAB_FIELD_GROUPS: Record<
  string,
  Array<string | { startsWith: string }>
> = {
  'basic-info': ['name', 'description', 'shortDescription', 'sku', 'category', 'brand', 'countryOfOrigin', 'manufacturerName', 'manufacturerAddress'],
  variants: ['hasVariants', 'variantAttributes'],
  'size-chart': [],
  'pricing-inventory': [
    'price',
    'comparePrice',
    'costPrice',
    'discountPercent',
    'discountStartDate',
    'discountEndDate',
    'stock',
    'lowStockThreshold',
    'trackInventory',
    'minOrderQuantity',
    'maxOrderQuantity',
    'taxClass',
    'taxRate',
    'status',
    'isFeatured',
    { startsWith: 'warehouseInventory' },
    { startsWith: 'variants' },
  ],
  media: ['mainImage', 'images', 'existingMainImage', 'existingImages'],
  'shipping-policies': [
    'freeShipping',
    'shippingCharge',
    'shippingWeight',
    { startsWith: 'shippingDimensions' },
    'payOnDelivery',
    'returnable',
    'returnDays',
    'warranty',
    'warrantyPeriod',
    'warrantyPeriodUnit',
  ],
  'seo-attributes': [
    'metaTitle',
    'seoKeywords',
    'metaDescription',
    'specifications',
    'filterMetadata',
    'tags',
  ],
}

export const TAB_LABELS: Record<string, string> = {
  'basic-info': 'Basic Info',
  variants: 'Variants',
  'size-chart': 'Size Chart',
  'pricing-inventory': 'Pricing & Inventory',
  media: 'Media',
  'shipping-policies': 'Shipping & Policies',
  'seo-attributes': 'SEO & Attributes',
}

const normalizeName = (n: (string | number)[]) => n.join('.')
const isNameInGroup = (
  name: (string | number)[],
  group: Array<string | { startsWith: string }>,
) => {
  const path = normalizeName(name)
  return group.some((g) =>
    typeof g === 'string' ? path === g : path.startsWith(g.startsWith),
  )
}

function getTabForField(name: NamePath): string | null {
  for (const [tabKey, group] of Object.entries(TAB_FIELD_GROUPS)) {
    if (isNameInGroup(Array.isArray(name) ? name : [name], group)) return tabKey
  }
  return null
}

/**
 * Group Ant Design form errorFields by tab for the validation error modal.
 */
export function getTabErrors(
  errorFields: { name: NamePath; errors: string[] }[],
): { tabKey: string; tabLabel: string; errors: { message: string }[] }[] {
  const byTab: Record<string, { message: string }[]> = {}
  for (const field of errorFields) {
    const tabKey = getTabForField(field.name) || 'basic-info'
    if (!byTab[tabKey]) byTab[tabKey] = []
    const messages = field.errors || []
    messages.forEach((msg) => byTab[tabKey].push({ message: msg }))
  }
  return Object.entries(byTab).map(([tabKey, errors]) => ({
    tabKey,
    tabLabel: TAB_LABELS[tabKey] ?? tabKey,
    errors,
  }))
}

/**
 * Tracks which tabs have validation errors by grouping form fields.
 */
const useTabErrorHighlight = (
  form: FormInstance,
  mainImageList: UploadFile[],
  imagesList: UploadFile[],
) => {
  const [tabHasError, setTabHasError] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const errors = form.getFieldsError()
    const map: Record<string, boolean> = {}
    Object.keys(TAB_FIELD_GROUPS).forEach((tabKey) => {
      map[tabKey] = errors.some(
        (e) =>
          e.errors.length > 0 &&
          isNameInGroup(e.name, TAB_FIELD_GROUPS[tabKey]),
      )
    })
    setTabHasError(map)
  }, [form, mainImageList, imagesList])

  return tabHasError
}

export default useTabErrorHighlight















