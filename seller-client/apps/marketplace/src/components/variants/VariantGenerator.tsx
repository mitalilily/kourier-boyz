import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Input, Radio, Table, Tag, Typography } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { generateSku } from '../../api/products'
import { formatVariantName } from '../../utils/categoryAttributes'

const { Title, Text } = Typography

interface VariantGeneratorProps {
  selectedAttributes: string[]
  attributeValues: Record<string, string[]> // Selected values for each attribute
  basePrice: number
  baseSku: string
  baseName?: string
  editMode?: boolean
  suppressMergeOnce?: boolean
  manualDefault?: boolean
  productId?: string // Product ID for edit mode
  // Default GST/HSN values to inherit
  defaultHsnSacCode?: string
  defaultIgstRatePercent?: number
  defaultCgstRatePercent?: number
  defaultSgstRatePercent?: number
  initialVariants?: Array<{
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
    mainImage?: unknown
    images?: unknown[]
    isDefault?: boolean
    status?: string
  }>
  onVariantsChange: (
    variants: Array<{
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
      mainImage?: unknown
      images?: unknown[]
      isDefault?: boolean
      status?: string
    }>,
  ) => void
}

const VariantGenerator = ({
  selectedAttributes,
  attributeValues,
  basePrice,
  baseSku,
  baseName = '',
  editMode = false,
  suppressMergeOnce = false,
  manualDefault = false,
  productId,
  defaultHsnSacCode,
  defaultIgstRatePercent,
  defaultCgstRatePercent,
  defaultSgstRatePercent,
  initialVariants = [],
  onVariantsChange,
}: VariantGeneratorProps) => {
  const [generatedVariants, setGeneratedVariants] = useState<
    Array<{
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
      mainImage?: unknown
      images?: unknown[]
      isDefault?: boolean
      status?: string
    }>
  >([])
  const [userHasDeletedVariants, setUserHasDeletedVariants] = useState(false)
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set())

  // Initialize with initial variants in edit mode (run once)
  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    if (editMode && initialVariants.length > 0) {
      // Track existing SKUs to avoid regenerating
      initialVariants.forEach((v) => {
        if (v.sku) {
          generatedSkusRef.current.add(v.sku)
        }
      })
      setGeneratedVariants(initialVariants)
      lastNotifiedVariantsRef.current = JSON.stringify(initialVariants)
      onVariantsChange(initialVariants)
      didInitRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, initialVariants])

  // Track generated SKUs to ensure uniqueness
  const generatedSkusRef = useRef<Set<string>>(new Set())

  // Helper function to generate SKU for a variant using API (max 8 characters)
  const generateVariantSku = useCallback(
    async (attributes: Record<string, string>, productId?: string, index?: number) => {
      console.log('🔄 Generating SKU for variant:', { attributes, productId, index, baseSku })

      // Validate baseSku
      if (!baseSku || baseSku.trim() === '') {
        console.error('❌ baseSku is empty or undefined!', baseSku)
        // Fallback to client-side generation
        const skuSuffix = selectedAttributes
          .map((attr) => {
            const value = attributes[attr]
            if (!value) return ''
            return `${attr.substring(0, 2).toUpperCase()}${value.substring(0, 2).toUpperCase()}`
          })
          .filter(Boolean)
          .join('')
        const baseSkuShort = 'SKU'.substring(0, 4).toUpperCase()
        let combined = `${baseSkuShort}${skuSuffix.substring(0, 4)}`.substring(0, 8)
        if (generatedSkusRef.current.has(combined)) {
          const basePart = combined.substring(0, 6)
          let counter = index !== undefined ? index : 0
          do {
            combined = `${basePart}${counter}`.substring(0, 8)
            counter++
          } while (generatedSkusRef.current.has(combined) && counter < 100)
        }
        generatedSkusRef.current.add(combined)
        return combined
      }

      try {
        const requestPayload = {
          baseSku,
          attributes,
          productId,
          maxLength: 8, // Request max 8 characters from API
        }
        console.log('📤 Calling generateSku API with:', requestPayload)
        console.log('📤 generateSku function:', typeof generateSku, generateSku)
        console.log(
          '📤 API base URL:',
          import.meta.env.VITE_API_URL || 'http://localhost:4000/api/marketplace/seller',
        )
        console.log(
          '📤 Full API endpoint will be:',
          `${
            import.meta.env.VITE_API_URL || 'http://localhost:4000/api/marketplace/seller'
          }/products/generate-sku`,
        )
        console.log('📤 Token available:', !!localStorage.getItem('seller_token'))

        const startTime = Date.now()
        console.log('⏳ About to call generateSku API...')
        const response = await generateSku(requestPayload)
        const duration = Date.now() - startTime
        console.log(`📥 API response received in ${duration}ms:`, response)
        const { sku } = response
        console.log('✅ Received SKU from API:', sku)

        if (!sku || typeof sku !== 'string') {
          throw new Error(`Invalid SKU received from API: ${sku}`)
        }

        // Ensure it's max 8 characters (in case API doesn't respect maxLength)
        let finalSku = sku.substring(0, 8)

        // Ensure uniqueness - if SKU already exists, append index
        if (generatedSkusRef.current.has(finalSku)) {
          console.log('⚠️ SKU already exists, generating unique variant:', finalSku)
          const baseSkuPart = finalSku.substring(0, 6)
          let counter = index !== undefined ? index : 0
          do {
            finalSku = `${baseSkuPart}${counter}`.substring(0, 8)
            counter++
          } while (generatedSkusRef.current.has(finalSku) && counter < 100)
        }

        generatedSkusRef.current.add(finalSku)
        console.log('✅ Final SKU:', finalSku)
        return finalSku
      } catch (error) {
        console.error('❌ Failed to generate variant SKU from API:', error)

        // Type-safe error handling
        interface AxiosErrorLike {
          response?: { status?: number; statusText?: string; data?: unknown }
          request?: unknown
          message?: string
          config?: { url?: string }
        }
        const axiosError = error as AxiosErrorLike

        console.error('Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          response: axiosError.response?.data,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          config: axiosError.config,
        })

        // Check if it's a network error or API error
        if (axiosError.response) {
          // API responded with error
          console.error('❌ API Error Response:', {
            status: axiosError.response.status,
            statusText: axiosError.response.statusText,
            data: axiosError.response.data,
            url: axiosError.config?.url,
          })
        } else if (axiosError.request) {
          // Request was made but no response
          console.error('❌ Network Error: No response from server', {
            request: axiosError.request,
          })
        } else {
          // Error setting up request
          console.error('❌ Request Setup Error:', error)
        }

        // Fallback to client-side generation if API fails
        console.warn('⚠️ Falling back to client-side SKU generation due to API failure')
        const skuSuffix = selectedAttributes
          .map((attr) => {
            const value = attributes[attr]
            if (!value) return ''
            // Use first 2 chars of attribute and first 2 chars of value to keep it short
            return `${attr.substring(0, 2).toUpperCase()}${value.substring(0, 2).toUpperCase()}`
          })
          .filter(Boolean)
          .join('')
        // Combine baseSku (max 4 chars) with suffix (max 4 chars) = 8 chars total
        const baseSkuShort = baseSku.substring(0, 4).toUpperCase()
        let combined = `${baseSkuShort}${skuSuffix.substring(0, 4)}`.substring(0, 8)

        // Ensure uniqueness in fallback case too
        if (generatedSkusRef.current.has(combined)) {
          const basePart = combined.substring(0, 6)
          let counter = index !== undefined ? index : 0
          do {
            combined = `${basePart}${counter}`.substring(0, 8)
            counter++
          } while (generatedSkusRef.current.has(combined) && counter < 100)
        }

        generatedSkusRef.current.add(combined)
        console.log('✅ Fallback SKU generated:', combined)
        return combined
      }
    },
    [selectedAttributes, baseSku],
  )

  // Track last notified variants to prevent infinite loops
  const lastNotifiedVariantsRef = useRef<string>('')

  // Helper to safely notify parent of variant changes
  const safeNotifyVariantsChange = useCallback(
    (newVariants: typeof generatedVariants) => {
      const serialized = JSON.stringify(newVariants)
      if (lastNotifiedVariantsRef.current !== serialized) {
        lastNotifiedVariantsRef.current = serialized
        onVariantsChange(newVariants)
      }
    },
    [onVariantsChange],
  )

  // Update variant name
  const updateVariantName = (variantId: string, newName: string) => {
    const updatedVariants = generatedVariants.map((variant) =>
      variant.id === variantId ? { ...variant, name: newName } : variant,
    )
    setGeneratedVariants(updatedVariants)
    safeNotifyVariantsChange(updatedVariants)
  }

  const generateVariants = useCallback(async () => {
    console.log('🚀 generateVariants called!', { selectedAttributes, attributeValues })
    // Generate combinations based on selected values for each attribute
    const attributeValueArrays = selectedAttributes.map((attr) => attributeValues[attr] || [])

    // Require at least one selected value for every selected attribute
    const hasSelectedValues = attributeValueArrays.every((values) => values.length > 0)

    console.log('📊 Has selected values?', hasSelectedValues, attributeValueArrays)

    if (!hasSelectedValues) {
      console.log('⚠️ No selected values, clearing variants')
      setGeneratedVariants([])
      lastNotifiedVariantsRef.current = JSON.stringify([])
      onVariantsChange([])
      return
    }

    const combinations: string[][] = []

    const generateCombinations = (current: string[], remaining: string[][]) => {
      if (remaining.length === 0) {
        combinations.push([...current])
        return
      }

      const [first, ...rest] = remaining
      for (const value of first) {
        generateCombinations([...current, value], rest)
      }
    }

    generateCombinations([], attributeValueArrays)

    // Reset SKU tracking for new generation
    generatedSkusRef.current.clear()
    console.log(`🔄 Generating ${combinations.length} variants with SKUs...`)

    // Generate SKUs for all variants in parallel
    const variants = await Promise.all(
      combinations.map(async (combination, index) => {
        const attributes: Record<string, string> = {}
        selectedAttributes.forEach((attr, i) => {
          attributes[attr] = combination[i]
        })

        console.log(
          `📦 Generating SKU for variant ${index + 1}/${combinations.length}:`,
          attributes,
        )
        const sku = await generateVariantSku(attributes, productId, index)
        console.log(`✅ Variant ${index + 1} SKU:`, sku)

        const variantName = baseName
          ? `${baseName} - ${formatVariantName(attributes)}`
          : formatVariantName(attributes)

        // Check if we should inherit GST/HSN values
        const shouldInheritGst =
          defaultHsnSacCode &&
          defaultIgstRatePercent !== undefined &&
          defaultCgstRatePercent !== undefined &&
          defaultSgstRatePercent !== undefined

        return {
          id: `variant-${index}`,
          name: variantName,
          sku,
          attributes,
          // No default values - let user set them in respective tabs
          price: undefined,
          costPrice: undefined,
          comparePrice: undefined,
          discountPercent: undefined,
          stock: undefined,
          lowStockThreshold: undefined,
          mainImage: null,
          images: [],
          isDefault: false,
          status: 'active',
          // GST/HSN - prefill values if defaults exist
          ...(shouldInheritGst
            ? {
                hsnSacCode: defaultHsnSacCode,
                igstRatePercent: defaultIgstRatePercent,
                cgstRatePercent: defaultCgstRatePercent,
                sgstRatePercent: defaultSgstRatePercent,
              }
            : {}),
        }
      }),
    )

    // Ensure a default variant exists unless manualDefault mode is on
    if (!manualDefault) {
      if (variants.length > 0 && !variants.some((v) => v.isDefault)) {
        variants[0].isDefault = true
      }
    }
    setGeneratedVariants(variants)
    setUserHasDeletedVariants(false) // Reset deletion flag when generating new variants
    // Notify parent in create mode (explicit sync to avoid loops)
    if (!editMode) {
      const serialized = JSON.stringify(variants)
      if (lastNotifiedVariantsRef.current !== serialized) {
        lastNotifiedVariantsRef.current = serialized
        onVariantsChange(variants)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedAttributes,
    attributeValues,
    basePrice,
    baseSku,
    baseName,
    editMode,
    manualDefault,
    generateVariantSku,
    initialVariants,
    defaultHsnSacCode,
    defaultIgstRatePercent,
    defaultCgstRatePercent,
    defaultSgstRatePercent,
  ])

  // Helper to compute a unique key for a combination
  const keyFrom = (attrs: Record<string, string>) =>
    [...selectedAttributes]
      .sort()
      .map((k) => `${k}:${attrs[k] || ''}`)
      .join('|')

  // Merge new combinations into existing variants (edit mode)
  const mergeMissingVariants = useCallback(async () => {
    console.log('🔄 mergeMissingVariants called!', { selectedAttributes, attributeValues })
    if (selectedAttributes.length === 0) {
      console.log('⚠️ No selected attributes, returning')
      return
    }
    const valueArrays = selectedAttributes.map((attr) => attributeValues[attr] || [])
    const allAttrsHaveValues = valueArrays.every((arr) => arr.length > 0)
    console.log('📊 All attrs have values?', allAttrsHaveValues, valueArrays)
    if (!allAttrsHaveValues) {
      console.log('⚠️ Not all attributes have values, returning')
      return
    }

    const combos: string[][] = []
    const build = (curr: string[], rem: string[][]) => {
      if (rem.length === 0) {
        combos.push([...curr])
        return
      }
      const [first, ...rest] = rem
      for (const v of first) build([...curr, v], rest)
    }
    build([], valueArrays)

    const existingByKey = new Map<string, (typeof generatedVariants)[number]>()
    generatedVariants.forEach((v) => existingByKey.set(keyFrom(v.attributes || {}), v))

    const merged: typeof generatedVariants = [...generatedVariants]
    let added = false

    // Process combos and generate SKUs
    const newVariants = await Promise.all(
      combos.map(async (combo, idx) => {
        const attrs: Record<string, string> = {}
        selectedAttributes.forEach((k, i) => (attrs[k] = combo[i]))
        const k = keyFrom(attrs)
        if (deletedKeys.has(k)) return null
        if (!existingByKey.has(k)) {
          console.log(`📦 Generating SKU for new variant in merge:`, attrs)
          const sku = await generateVariantSku(attrs, productId, idx)
          console.log(`✅ New variant SKU:`, sku)
          const variantName = baseName
            ? `${baseName} - ${formatVariantName(attrs)}`
            : formatVariantName(attrs)
          // Check if we should inherit GST/HSN values
          const shouldInheritGst =
            defaultHsnSacCode &&
            defaultIgstRatePercent !== undefined &&
            defaultCgstRatePercent !== undefined &&
            defaultSgstRatePercent !== undefined

          return {
            id: `variant-new-${Date.now()}-${idx}`,
            name: variantName,
            sku,
            attributes: attrs,
            price: undefined as unknown as number,
            costPrice: undefined as unknown as number,
            comparePrice: undefined as unknown as number,
            discountPercent: undefined as unknown as number,
            stock: undefined as unknown as number,
            lowStockThreshold: undefined as unknown as number,
            mainImage: null,
            images: [],
            isDefault: false,
            // GST/HSN - prefill values if defaults exist
            ...(shouldInheritGst
              ? {
                  hsnSacCode: defaultHsnSacCode,
                  igstRatePercent: defaultIgstRatePercent,
                  cgstRatePercent: defaultCgstRatePercent,
                  sgstRatePercent: defaultSgstRatePercent,
                }
              : {}),
          }
        }
        return null
      }),
    )

    // Filter out nulls and add to merged
    newVariants.forEach((variant) => {
      if (variant) {
        merged.push(variant)
        added = true
      }
    })
    // Ensure one default remains unless manualDefault mode is on
    if (!manualDefault) {
      if ((added || merged.length > 0) && !merged.some((v) => v.isDefault)) {
        merged[0].isDefault = true
      }
    }
    if (added) {
      setGeneratedVariants(merged)
      const serialized = JSON.stringify(merged)
      if (lastNotifiedVariantsRef.current !== serialized) {
        lastNotifiedVariantsRef.current = serialized
        onVariantsChange(merged)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    attributeValues,
    baseName,
    baseSku,
    deletedKeys,
    generatedVariants,
    onVariantsChange,
    selectedAttributes,
    manualDefault,
    editMode,
    initialVariants,
    generateVariantSku,
    defaultHsnSacCode,
    defaultIgstRatePercent,
    defaultCgstRatePercent,
    defaultSgstRatePercent,
  ])

  // In edit mode, auto-merge when safe
  const lastMergeSignatureRef = useRef<string>('')
  useEffect(() => {
    if (!editMode) return
    if (suppressMergeOnce) return
    if (userHasDeletedVariants) return

    // Create signature to prevent unnecessary merges
    const signature = JSON.stringify({
      attrs: selectedAttributes.slice().sort(),
      values: attributeValues,
      variants: generatedVariants.length,
    })

    if (signature !== lastMergeSignatureRef.current) {
      console.log('🔄 Merge signature changed, calling mergeMissingVariants')
      lastMergeSignatureRef.current = signature
      mergeMissingVariants().catch((error) => {
        console.error('❌ Error merging missing variants:', error)
      })
    } else {
      console.log('⏭️ Merge signature unchanged, skipping merge')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editMode,
    suppressMergeOnce,
    userHasDeletedVariants,
    selectedAttributes,
    attributeValues,
    generatedVariants.length,
  ])

  // Enforce: if only one variant remains, mark it as default
  const lastSingleVariantRef = useRef<string>('')
  const variantsLength = generatedVariants.length
  const firstVariant = variantsLength === 1 ? generatedVariants[0] : null
  const firstVariantId = firstVariant?.id || ''
  const firstVariantIsDefault = firstVariant?.isDefault === true
  useEffect(() => {
    if (!manualDefault) {
      if (variantsLength === 1 && firstVariant && !firstVariantIsDefault) {
        if (lastSingleVariantRef.current !== firstVariantId) {
          lastSingleVariantRef.current = firstVariantId
          const updated = [{ ...firstVariant, isDefault: true }]
          setGeneratedVariants(updated)
          safeNotifyVariantsChange(updated)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantsLength, firstVariantId, firstVariantIsDefault, manualDefault])

  // When attribute selections change, clear the deletion guard so future merges can happen
  const prevSigRef = useRef<string>('')
  useEffect(() => {
    if (!editMode) return
    const sig = JSON.stringify({ a: selectedAttributes.slice().sort(), v: attributeValues })
    if (sig !== prevSigRef.current) {
      prevSigRef.current = sig
      if (userHasDeletedVariants) {
        setUserHasDeletedVariants(false)
      }
      if (deletedKeys.size > 0) {
        setDeletedKeys(new Set())
      }
    }
  }, [editMode, selectedAttributes, attributeValues, userHasDeletedVariants, deletedKeys.size])

  // Auto-generate variants when attributeValues change (skip in edit mode)
  const lastGenSignatureRef = useRef<string>('')
  useEffect(() => {
    console.log('🔍 Auto-generation effect triggered', {
      editMode,
      selectedAttributes,
      attributeValues,
    })
    // Skip auto-generation in edit mode
    if (editMode) {
      console.log('⏭️ Skipping auto-generation (edit mode)')
      return
    }

    // Create signature to prevent unnecessary re-generation
    const signature = JSON.stringify({
      attrs: selectedAttributes.slice().sort(),
      values: attributeValues,
    })

    if (signature === lastGenSignatureRef.current) {
      console.log('⏭️ Signature unchanged, skipping regeneration')
      return
    }
    console.log('🔄 Signature changed, regenerating variants')
    lastGenSignatureRef.current = signature

    if (selectedAttributes.length > 0) {
      // Always regenerate variants when attributes or values change
      console.log('🚀 Calling generateVariants from auto-generation effect')
      generateVariants().catch((error) => {
        console.error('❌ Error generating variants:', error)
      })
    } else {
      // Clear variants if no attributes selected
      console.log('🧹 Clearing variants (no attributes selected)')
      setGeneratedVariants([])
      lastNotifiedVariantsRef.current = JSON.stringify([])
      onVariantsChange([])
      setUserHasDeletedVariants(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAttributes, attributeValues, editMode])

  // (Removed implicit parent sync effect to prevent update loops)

  const updateVariant = (
    variantId: string,
    updates: Partial<{
      id: string
      name: string
      sku: string
      attributes: Record<string, string>
      price: number
      costPrice: number
      comparePrice: number
      discountPercent: number
      stock: number
      lowStockThreshold: number
      mainImage?: unknown
      images?: unknown[]
    }>,
  ) => {
    const updatedVariants = generatedVariants.map((variant) =>
      variant.id === variantId ? { ...variant, ...updates } : variant,
    )
    setGeneratedVariants(updatedVariants)
    safeNotifyVariantsChange(updatedVariants)
  }

  const deleteVariant = (variantId: string) => {
    const victim = generatedVariants.find((v) => v.id === variantId)
    let updatedVariants = generatedVariants.filter((variant) => variant.id !== variantId)
    setGeneratedVariants(updatedVariants)
    safeNotifyVariantsChange(updatedVariants)
    // Block re-adding the same combination
    if (victim) {
      const key = [...selectedAttributes]
        .sort()
        .map((k) => `${k}:${(victim.attributes || {})[k] || ''}`)
        .join('|')
      setDeletedKeys((prev) => new Set(prev).add(key))
    }
    // Maintain a default if needed
    if (updatedVariants.length > 0 && !updatedVariants.some((v) => v.isDefault)) {
      updatedVariants = [{ ...updatedVariants[0], isDefault: true }, ...updatedVariants.slice(1)]
      setGeneratedVariants(updatedVariants)
      safeNotifyVariantsChange(updatedVariants)
    }
    setUserHasDeletedVariants(true) // Track that user has deleted variants
  }

  // Base columns that are always shown - only essential fields
  const baseColumns = [
    {
      title: 'Variant Name',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (name: string, record: { id: string; attributes: Record<string, string> }) => (
        <div>
          <Input
            value={name}
            onChange={(e) => updateVariantName(record.id, e.target.value)}
            placeholder="Enter variant name"
            style={{ marginBottom: 8 }}
          />
          <div style={{ fontSize: 12, color: '#666' }}>
            {Object.entries(record.attributes).map(([key, value]: [string, string]) => (
              <Tag key={key} style={{ margin: '2px' }}>
                {key}: {value}
              </Tag>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 250,
      render: (sku: string, record: { id: string }) => (
        <Input
          value={sku}
          size="small"
          onChange={(e) => updateVariant(record.id, { sku: e.target.value })}
        />
      ),
    },
  ]

  // (Removed extended edit-only columns per simplified edit UI)

  // Actions column
  const actionsColumn = {
    title: 'Actions',
    key: 'actions',
    width: 100,
    render: (_: unknown, record: { id: string }) => (
      <Button
        type="text"
        size="small"
        danger
        icon={<DeleteOutlined />}
        onClick={() => deleteVariant(record.id)}
      >
        Delete
      </Button>
    ),
  }

  // Combine columns based on edit mode
  // In edit mode, show only Variant Name, SKU, and Actions
  const defaultColumn = {
    title: 'Default',
    key: 'default',
    width: 90,
    render: (_: unknown, record: { id: string }) => (
      <Radio
        checked={generatedVariants.find((v) => v.id === record.id)?.isDefault === true}
        onChange={() => {
          const updated = generatedVariants.map((v) => ({ ...v, isDefault: v.id === record.id }))
          setGeneratedVariants(updated)
          safeNotifyVariantsChange(updated)
        }}
      />
    ),
  }

  const columns = manualDefault
    ? [...baseColumns, actionsColumn]
    : [defaultColumn, ...baseColumns, actionsColumn]

  return (
    <div>
      {!manualDefault &&
        !generatedVariants.some((v) => v.isDefault) &&
        generatedVariants.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="Select a default variant"
            description="One variant must be marked as default so it is shown first on the storefront."
            style={{ marginBottom: 12 }}
          />
        )}
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <Title level={5} style={{ margin: 0 }}>
            Generated Variants ({generatedVariants.length})
          </Title>
          <Text type="secondary">
            {selectedAttributes.length} attributes will create{' '}
            {(() => {
              const attributeValueArrays = selectedAttributes.map(
                (attr) => attributeValues[attr] || [],
              )
              const hasSelectedValues = attributeValueArrays.some((values) => values.length > 0)
              if (!hasSelectedValues) return 0
              return attributeValueArrays.reduce((total, values) => total * values.length, 1)
            })()}{' '}
            variants
          </Text>
          {/* <div style={{ marginTop: 6 }}>
            <Alert
              type="info"
              showIcon
              message="Inventory tracking"
              description="If inventory is tracked, you'll receive regular updates and notifications for low stock on this product. Manage inventory tracking from the Ordering & Inventory Policy tab."
            />
          </div> */}
        </div>
        {!editMode ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setUserHasDeletedVariants(false) // Reset deletion flag when manually generating
              generateVariants().catch((error) => {
                console.error('Error generating variants:', error)
              })
            }}
            disabled={selectedAttributes.length === 0}
          >
            Generate Variants
          </Button>
        ) : null}
      </div>

      {generatedVariants.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
          <Table
            dataSource={generatedVariants}
            columns={columns}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ minWidth: '600px' }}
          />
        </div>
      )}

      {selectedAttributes.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <Text type="secondary">Select attributes above to generate variants automatically</Text>
        </Card>
      )}
    </div>
  )
}

export default VariantGenerator
