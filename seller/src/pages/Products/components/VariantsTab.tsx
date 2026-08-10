import {
  Card,
  Col,
  Form,
  type FormInstance,
  Row,
  Space,
  Switch,
  Typography,
  type UploadFile,
} from 'antd'
import { useEffect, useState } from 'react'
import { formatVariantName } from '../../../components/../utils/categoryAttributes'
import AttributeSelector from '../../../components/variants/AttributeSelector'
import SmartAttributeSelector from '../../../components/variants/SmartAttributeSelector'
import VariantGenerator from '../../../components/variants/VariantGenerator'
import type { AttributeConfig } from '../../../utils/categoryAttributes'
import { GENERAL_ATTRIBUTES } from '../../../utils/categoryAttributes'

const { Title } = Typography

interface VariantsTabProps {
  form: FormInstance
  isEdit?: boolean
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
    mainImage: UploadFile | string | null
    images: Array<UploadFile | string>
    isDefault: boolean
    status: string
  }>
  variantAttributes: string[]
  hasVariants: boolean
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
      mainImage: UploadFile | string | null
      images: Array<UploadFile | string>
      isDefault: boolean
      status: string
    }>,
  ) => void
  onVariantAttributesChange: (attributes: string[]) => void
  onHasVariantsChange: (hasVariants: boolean) => void
}

const VariantsTab = ({
  form,
  isEdit = false,
  variants,
  variantAttributes,
  hasVariants,
  onVariantsChange,
  onVariantAttributesChange,
  onHasVariantsChange,
}: VariantsTabProps) => {
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(variantAttributes)
  const [prevSelectedAttributes, setPrevSelectedAttributes] = useState<string[]>(variantAttributes)
  const [customAttributes, setCustomAttributes] = useState<AttributeConfig[]>([])
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({})
  const [suppressMergeOnce, setSuppressMergeOnce] = useState(false)
  // const { message } = App.useApp()

  // Initialize selectedAttributes from props
  useEffect(() => {
    setSelectedAttributes(variantAttributes)
  }, [variantAttributes])

  // Always use general attributes - no category dependency
  const availableAttributes = GENERAL_ATTRIBUTES

  // Prefill attribute values in edit mode from existing variants
  useEffect(() => {
    if (isEdit && hasVariants && selectedAttributes.length > 0 && variants.length > 0) {
      const nextValues: Record<string, string[]> = {}
      selectedAttributes.forEach((attr) => {
        const vals = Array.from(
          new Set(
            variants
              .map((v) => (v.attributes ? v.attributes[attr] : undefined))
              .filter((v): v is string => typeof v === 'string' && v.length > 0),
          ),
        )
        if (vals.length > 0) nextValues[attr] = vals
      })
      setAttributeValues(nextValues)
    }
  }, [isEdit, hasVariants, selectedAttributes, variants])

  return (
    <Card
      title={<span style={{ fontSize: '14px', fontWeight: 600 }}>Product Variants</span>}
      style={{ marginBottom: 12 }}
      bodyStyle={{ padding: '12px' }}
      size="small"
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Variant Settings */}
        <Row gutter={[12, 8]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="hasVariants"
              label={<span style={{ fontSize: '12px' }}>Enable Variants</span>}
              valuePropName="checked"
              tooltip="Enable if this product comes in different options (color, size, etc.)"
              style={{ marginBottom: 0 }}
            >
              <Switch
                size="small"
                checked={hasVariants}
                onChange={(checked) => {
                  onHasVariantsChange(checked)
                  if (!checked) {
                    setSelectedAttributes([])
                    onVariantAttributesChange([])
                    onVariantsChange([])
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Smart Attribute Selector */}
        {hasVariants && (
          <SmartAttributeSelector
            selectedAttributes={selectedAttributes}
            onAttributesChange={(attributes) => {
              const removed = prevSelectedAttributes.filter((k) => !attributes.includes(k))

              setSelectedAttributes(attributes)
              onVariantAttributesChange(attributes)

              // Prune values for removed attributes
              setAttributeValues((prev) => {
                const next: Record<string, string[]> = {}
                attributes.forEach((k) => {
                  if (prev[k]) next[k] = prev[k]
                })
                return next
              })

              if (removed.length > 0 && variants.length > 0) {
                // Transform existing variants to new attribute shape and de-duplicate
                const keyFrom = (attrs: Record<string, string>) =>
                  attributes.map((k) => `${k}:${attrs[k] || ''}`).join('|')
                const seen = new Set<string>()
                const baseName = form.getFieldValue('name') || ''
                const transformed = variants
                  .map((v) => {
                    const newAttrs: Record<string, string> = {}
                    attributes.forEach((k) => {
                      if (v.attributes && v.attributes[k]) newAttrs[k] = v.attributes[k]
                    })
                    // Keep sku stable to avoid churn; update name for clarity
                    const newName = baseName
                      ? `${baseName} - ${formatVariantName(newAttrs)}`
                      : formatVariantName(newAttrs)
                    return { ...v, attributes: newAttrs, name: newName }
                  })
                  .filter((v) => {
                    const k = keyFrom(v.attributes || {})
                    if (seen.has(k)) return false
                    seen.add(k)
                    return true
                  })
                onVariantsChange(transformed)
                // Skip merge once to avoid auto-adding after removal
                setSuppressMergeOnce(true)
              }

              setPrevSelectedAttributes(attributes)
            }}
            onCustomAttributesChange={setCustomAttributes}
            customAttributes={customAttributes}
          />
        )}

        {/* Attribute Value Selectors */}
        {hasVariants && selectedAttributes.length > 0 && (
          <div>
            <Title level={5} style={{ marginBottom: 12, fontSize: '13px' }}>
              Select Attribute Values
            </Title>
            {selectedAttributes.map((attrKey: string) => {
              const allAttributes = [...availableAttributes, ...customAttributes]
              const config = allAttributes.find((a: AttributeConfig) => a.key === attrKey)
              if (!config) return null

              return (
                <AttributeSelector
                  key={attrKey}
                  config={config}
                  selectedValues={attributeValues[attrKey] || []}
                  onChange={(values: string[]) => {
                    setAttributeValues((prev) => ({
                      ...prev,
                      [attrKey]: values,
                    }))
                  }}
                />
              )
            })}
          </div>
        )}

        {/* Variant Generator */}
        {hasVariants && selectedAttributes.length > 0 && (
          <div>
            <VariantGenerator
              selectedAttributes={selectedAttributes}
              attributeValues={attributeValues}
              basePrice={form.getFieldValue('price') || 0}
              baseSku={form.getFieldValue('sku') || 'SKU'}
              baseName={form.getFieldValue('name') || ''}
              editMode={isEdit}
              suppressMergeOnce={suppressMergeOnce}
              productId={form.getFieldValue('_id')}
              // Use default GST/HSN if set, otherwise fall back to simple product GST/HSN
              defaultHsnSacCode={
                form.getFieldValue('defaultHsnSacCode') || form.getFieldValue('hsnSacCode')
              }
              defaultIgstRatePercent={
                form.getFieldValue('defaultIgstRatePercent') ??
                form.getFieldValue('igstRatePercent')
              }
              defaultCgstRatePercent={
                form.getFieldValue('defaultCgstRatePercent') ??
                form.getFieldValue('cgstRatePercent')
              }
              defaultSgstRatePercent={
                form.getFieldValue('defaultSgstRatePercent') ??
                form.getFieldValue('sgstRatePercent')
              }
              initialVariants={variants}
              onVariantsChange={(newVariants) => {
                const normalizedForState = newVariants.map((v) => ({
                  ...v,
                  mainImage:
                    (v as unknown as { mainImage?: UploadFile | string | null }).mainImage ?? null,
                  images: ((v as unknown as { images?: Array<UploadFile | string> }).images ||
                    []) as Array<UploadFile | string>,
                  isDefault: (v as unknown as { isDefault?: boolean }).isDefault ?? false,
                  status: (v as unknown as { status?: string }).status ?? 'active',
                }))
                const prevSerialized = JSON.stringify(
                  variants.map((v) => ({
                    ...v,
                    images: v.images || [],
                    mainImage: v.mainImage ?? null,
                    isDefault: v.isDefault ?? false,
                    status: v.status ?? 'active',
                  })),
                )
                const nextSerialized = JSON.stringify(
                  normalizedForState.map((v) => ({
                    ...v,
                    images: v.images || [],
                    mainImage: v.mainImage ?? null,
                    isDefault: v.isDefault ?? false,
                    status: v.status ?? 'active',
                  })),
                )
                if (prevSerialized !== nextSerialized) {
                  onVariantsChange(normalizedForState)
                }
                // Reflect default variant SKU in product info immediately
                if (Array.isArray(normalizedForState) && normalizedForState.length > 0) {
                  const def =
                    normalizedForState.find((v) => (v as { isDefault?: boolean }).isDefault) ||
                    normalizedForState[0]
                  if (def && def.sku) {
                    form.setFieldsValue({ sku: def.sku })
                  }
                }
                // Auto-unselect attributes that are no longer present in any generated variant
                if (Array.isArray(newVariants) && newVariants.length > 0) {
                  const usedAttributeKeys = new Set<string>()
                  newVariants.forEach((v) => {
                    if (v.attributes) {
                      Object.entries(v.attributes).forEach(([k, val]) => {
                        if (typeof val === 'string' && val.length > 0) usedAttributeKeys.add(k)
                      })
                    }
                  })
                  const pruned = selectedAttributes.filter((k) => usedAttributeKeys.has(k))
                  if (pruned.length !== selectedAttributes.length) {
                    setSelectedAttributes(pruned)
                    onVariantAttributesChange(pruned)
                    setAttributeValues((prev) => {
                      const next: Record<string, string[]> = {}
                      pruned.forEach((k) => {
                        if (prev[k]) next[k] = prev[k]
                      })
                      return next
                    })
                    setPrevSelectedAttributes(pruned)
                    // Prevent merge from re-adding immediately
                    setSuppressMergeOnce(true)
                  }
                }
                if (!hasVariants) onHasVariantsChange(true)
              }}
            />
          </div>
        )}

        {!hasVariants && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: 4,
              marginBottom: 12,
              fontSize: '11px',
              color: '#1890ff',
            }}
          >
            💡 Simple product - all customers see the same price and options
          </div>
        )}

        {hasVariants && selectedAttributes.length === 0 && (
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#fff7e6',
              border: '1px solid #ffd591',
              borderRadius: 4,
              marginBottom: 12,
              fontSize: '11px',
              color: '#d46b08',
            }}
          >
            ⚠️ Select attributes (color, size, material, etc.) to create variants
          </div>
        )}
      </Space>
    </Card>
  )
}

export default VariantsTab
