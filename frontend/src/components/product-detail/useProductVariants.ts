import { useEffect, useMemo, useState } from 'react'
import { ProductVariant, normalizeVariant } from './utils'

interface UseProductVariantsProps {
  product:
    | {
        _id: string
        hasVariants?: boolean
        variants?: unknown[]
        mainImage?: string
        images?: string[]
        minOrderQuantity?: number
      }
    | null
    | undefined
  initialVariantId?: string | null
}

export const useProductVariants = ({ product, initialVariantId }: UseProductVariantsProps) => {
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({})
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    initialVariantId || null,
  )
  const [quantity, setQuantity] = useState<number>(1)

  // Normalize variants for easier handling
  const variants = useMemo<ProductVariant[]>(() => {
    if (!product?.hasVariants || !Array.isArray(product?.variants)) {
      return []
    }
    return (product.variants as Array<Record<string, unknown>>).map((variant) =>
      normalizeVariant(variant),
    )
  }, [product?.hasVariants, product?.variants])

  // Determine default variant & initial states once product loads
  useEffect(() => {
    if (!product) return

    const minOrder = Math.max(product.minOrderQuantity ?? 1, 1)
    setQuantity(minOrder)

    if (product.hasVariants && variants.length > 0) {
      // If initialVariantId is provided, try to use it
      if (initialVariantId) {
        const initialVariant = variants.find((variant) => variant._id === initialVariantId)
        if (initialVariant) {
          setSelectedVariantId(initialVariant._id)
          setSelectedAttributes(initialVariant.attributes ?? {})
          return
        }
      }

      // Otherwise, use default logic
      const defaultVariant =
        variants.find((variant) => variant.isDefault) ??
        variants.find((variant) => variant.stock && variant.stock > 0) ??
        variants[0]

      if (defaultVariant) {
        setSelectedVariantId(defaultVariant._id)
        setSelectedAttributes(defaultVariant.attributes ?? {})
      }
    } else {
      setSelectedVariantId(null)
      setSelectedAttributes({})
    }
  }, [product, variants, initialVariantId])

  // Sync selectedAttributes when selectedVariantId changes (for direct variant selection)
  useEffect(() => {
    if (!product?.hasVariants || variants.length === 0) return
    if (!selectedVariantId) return

    const variant = variants.find((v) => v._id === selectedVariantId)
    if (variant && variant.attributes) {
      // Only update if attributes are different to avoid infinite loops
      const currentAttrs = JSON.stringify(selectedAttributes)
      const newAttrs = JSON.stringify(variant.attributes)
      if (currentAttrs !== newAttrs) {
        setSelectedAttributes(variant.attributes)
      }
    }
  }, [selectedVariantId, product?.hasVariants, variants, selectedAttributes])

  const attributeOptions = useMemo(() => {
    if (!product?.hasVariants || variants.length === 0) return {}
    const options: Record<string, string[]> = {}

    variants.forEach((variant) => {
      Object.entries(variant.attributes ?? {}).forEach(([key, value]) => {
        if (!options[key]) {
          options[key] = []
        }
        if (value && !options[key].includes(value)) {
          options[key].push(value)
        }
      })
    })

    return options
  }, [product?.hasVariants, variants])

  // Get available options for each attribute based on current selection
  // For the first attribute (color): always show all options
  // For subsequent attributes (size): filter based on selected color
  const getAvailableOptionsForAttribute = useMemo(() => {
    return (targetAttribute: string): Set<string> => {
      if (!product?.hasVariants || variants.length === 0) return new Set()

      // Get the attribute keys to understand the hierarchy
      const attributeKeys = Object.keys(attributeOptions)
      const isFirstAttribute = attributeKeys.indexOf(targetAttribute) === 0

      // For the first attribute (usually color), always show all options
      if (isFirstAttribute) {
        const availableValues = new Set<string>()
        variants.forEach((variant) => {
          const value = variant.attributes?.[targetAttribute]
          if (value) {
            availableValues.add(value)
          }
        })
        return availableValues
      }

      // Get all other selected attributes except the target one
      const otherSelectedAttributes = Object.entries(selectedAttributes).filter(
        ([key]) => key !== targetAttribute,
      )

      // If no other attributes are selected, all options for this attribute are available
      if (otherSelectedAttributes.length === 0) {
        const availableValues = new Set<string>()
        variants.forEach((variant) => {
          const value = variant.attributes?.[targetAttribute]
          if (value) {
            availableValues.add(value)
          }
        })
        return availableValues
      }

      // Find variants that match all other selected attributes
      const matchingVariants = variants.filter((variant) => {
        return otherSelectedAttributes.every(([key, value]) => {
          return variant.attributes?.[key] === value
        })
      })

      // Extract available values for the target attribute from matching variants
      const availableValues = new Set<string>()
      matchingVariants.forEach((variant) => {
        const value = variant.attributes?.[targetAttribute]
        if (value) {
          availableValues.add(value)
        }
      })

      return availableValues
    }
  }, [product?.hasVariants, variants, selectedAttributes, attributeOptions])

  // Check if a specific attribute value has stock
  // For colors: check if ANY variant with that color has stock
  // For sizes (when color is selected): check if the specific color+size combo has stock
  const getVariantStockForOption = useMemo(() => {
    return (attribute: string, value: string): { hasStock: boolean; stock: number } => {
      if (!product?.hasVariants || variants.length === 0) {
        return { hasStock: false, stock: 0 }
      }

      // Get the attribute keys to understand the hierarchy
      const attributeKeys = Object.keys(attributeOptions)
      const isFirstAttribute = attributeKeys.indexOf(attribute) === 0

      // For the first attribute (usually color), check if ANY variant with this value has stock
      if (isFirstAttribute) {
        const variantsWithThisValue = variants.filter(
          (variant) => variant.attributes?.[attribute] === value,
        )
        const totalStock = variantsWithThisValue.reduce((sum, v) => sum + (v.stock ?? 0), 0)
        return { hasStock: totalStock > 0, stock: totalStock }
      }

      // For subsequent attributes (like size), check stock based on other selected attributes
      // Build the attributes to match - other selections plus this option
      const attributesToMatch: Record<string, string> = { [attribute]: value }

      // Include other selected attributes in the match
      Object.entries(selectedAttributes).forEach(([key, val]) => {
        if (key !== attribute && val) {
          attributesToMatch[key] = val
        }
      })

      // Find variant that matches all the attributes we care about
      const matchingVariant = variants.find((variant) => {
        return Object.entries(attributesToMatch).every(([key, val]) => {
          return variant.attributes?.[key] === val
        })
      })

      if (matchingVariant) {
        const stock = matchingVariant.stock ?? 0
        return { hasStock: stock > 0, stock }
      }

      return { hasStock: false, stock: 0 }
    }
  }, [product?.hasVariants, variants, selectedAttributes, attributeOptions])

  const activeVariant = useMemo(() => {
    if (!product?.hasVariants || variants.length === 0) return null
    const directMatch = variants.find((variant) => variant._id === selectedVariantId)
    if (directMatch) return directMatch

    // Attempt to find variant matching selected attributes
    const selectedKeys = Object.keys(selectedAttributes ?? {})
    if (selectedKeys.length === 0) return variants[0]

    return (
      variants.find((variant) =>
        selectedKeys.every((key) => {
          const desiredValue = selectedAttributes[key]
          if (!desiredValue) return true
          return variant.attributes?.[key] === desiredValue
        }),
      ) ?? variants[0]
    )
  }, [product?.hasVariants, variants, selectedVariantId, selectedAttributes])

  const handleAttributeSelect = (
    attribute: string,
    value: string,
    onVariantChange?: (variant: ProductVariant | null) => void,
  ) => {
    setSelectedAttributes((prev) => {
      const next = { ...prev, [attribute]: value }

      const matchingVariant = variants.find((variant) => {
        const attributes = variant.attributes ?? {}
        return Object.entries(next).every(([key, val]) => {
          if (!val) return true
          return attributes[key] === val
        })
      })

      if (matchingVariant) {
        setSelectedVariantId(matchingVariant._id)
        onVariantChange?.(matchingVariant)
      }

      return next
    })
  }

  return {
    variants,
    selectedAttributes,
    selectedVariantId,
    setSelectedVariantId,
    activeVariant,
    attributeOptions,
    getAvailableOptionsForAttribute,
    getVariantStockForOption,
    quantity,
    setQuantity,
    handleAttributeSelect,
  }
}
