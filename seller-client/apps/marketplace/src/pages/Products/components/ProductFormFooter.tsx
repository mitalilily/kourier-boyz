import { Button, Divider, Space, Tag, type FormInstance } from 'antd'
import { useNavigate } from 'react-router-dom'

interface ProductFormFooterProps {
  form: FormInstance
  isEdit: boolean
  createMutation: { isPending: boolean }
  updateMutation: { isPending: boolean }
  setSavingAsDraft: (value: boolean) => void
}

const ProductFormFooter = ({
  form,
  isEdit,
  createMutation,
  updateMutation,
  setSavingAsDraft,
}: ProductFormFooterProps) => {
  const navigate = useNavigate()

  // Check if variants are properly configured
  const hasVariants = form.getFieldValue('hasVariants') || false
  const variants = form.getFieldValue('variants') || []
  const variantAttributes = form.getFieldValue('variantAttributes') || []

  // Validate variants if enabled
  const isVariantsValid =
    !hasVariants ||
    (variantAttributes.length > 0 &&
      variants.length > 0 &&
      variants.every(
        (variant: { name: string; sku: string; attributes: Record<string, string> }) =>
          variant.name &&
          variant.sku &&
          variant.attributes &&
          Object.keys(variant.attributes).length > 0,
      ))

  // Basic validation for required fields (ensure strict booleans)
  const isBasicFieldsValid =
    !!form.getFieldValue('name') &&
    !!form.getFieldValue('description') &&
    !!form.getFieldValue('category')

  // Main image validation - temporarily disabled
  const isMainImageValid = true

  // Final validation (coerce to booleans)
  const isFormValid = Boolean(isBasicFieldsValid && isVariantsValid)
  const isPublishValid = Boolean(isFormValid && isMainImageValid)

  // Helper UI summaries
  const issues: string[] = []
  if (!isBasicFieldsValid) issues.push('Basic info')
  if (hasVariants && !isVariantsValid) issues.push('Variants')
  const variantCount = Array.isArray(variants) ? variants.length : 0

  return (
    <div
      style={{
        padding: '16px 0',
        marginBottom: 16,
        borderBottom: '1px solid #e5e7eb',
        background: '#ffffff',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}
        >
          <Tag color={isFormValid ? 'green' : 'orange'} style={{ margin: 0 }}>
            {isFormValid ? '✓ Ready' : '⚠ Incomplete'}
          </Tag>
          {hasVariants && (
            <Tag color={isVariantsValid ? 'blue' : 'red'} style={{ margin: 0 }}>
              {isVariantsValid ? `${variantCount} Variants` : 'Variants Required'}
            </Tag>
          )}
          {issues.length > 0 && (
            <>
              <Divider type="vertical" style={{ margin: '0 8px', height: '16px' }} />
              {issues.map((i) => (
                <Tag key={i} color="volcano" style={{ margin: 0, fontSize: '11px' }}>
                  {i}
                </Tag>
              ))}
            </>
          )}
        </div>

        <Space size="middle" wrap>
          <Button onClick={() => navigate('/products')} style={{ minWidth: '80px' }}>
            Cancel
          </Button>
          {!isEdit && (
            <Button
              onClick={() => {
                setSavingAsDraft(true)
                form.setFieldsValue({ status: 'draft' })
                form.submit()
              }}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!isFormValid}
              style={{ minWidth: '120px' }}
            >
              Save as Draft
            </Button>
          )}
          <Button
            type="primary"
            htmlType="submit"
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!isPublishValid}
            style={{ minWidth: '140px' }}
          >
            {isEdit ? 'Update Product' : 'Create Product'}
          </Button>
        </Space>
      </div>
    </div>
  )
}

export default ProductFormFooter
