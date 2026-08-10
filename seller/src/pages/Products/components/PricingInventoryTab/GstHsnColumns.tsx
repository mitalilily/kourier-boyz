import { InfoCircleOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import { Input, Select, Space, Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { VariantType } from './types'
import { ALLOWED_GST_RATES } from './utils'

const { Option } = Select

interface GstHsnColumnsProps {
  form: FormInstance
  variants: Array<VariantType>
  onVariantsChange: (variants: Array<VariantType>) => void
}

export function createGstHsnColumns({
  variants,
  onVariantsChange,
}: Omit<GstHsnColumnsProps, 'form'>): ColumnsType<VariantType> {
  return [
    {
      title: (
        <Space size={4}>
          HSN/SAC Code
          <Tooltip title="Harmonized System of Nomenclature (HSN) or Service Accounting Code (SAC). Must be 4, 6, or 8 digits.">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      key: 'hsnSacCode',
      width: 120,
      render: (_: unknown, record: VariantType) => {
        const currentVariant = variants.find((v) => v.id === record.id)
        const variantHsn = currentVariant?.hsnSacCode ?? record.hsnSacCode ?? ''

        const displayValue = variantHsn

        const isValid = displayValue && /^\d{4}$|^\d{6}$|^\d{8}$/.test(displayValue)
        const showError = displayValue && !isValid

        const isDisabled = false

        return (
          <div>
            <Input
              value={displayValue}
              placeholder="e.g., 8517"
              size="small"
              maxLength={8}
              disabled={isDisabled}
              status={showError ? 'error' : undefined}
              onChange={(e) => {
                const rawValue = e.target.value
                const newValue = rawValue.replace(/\D/g, '')

                const updatedVariants = variants.map((variant) => {
                  if (variant.id === record.id) {
                    return { ...variant, hsnSacCode: newValue }
                  }
                  return variant
                })
                onVariantsChange(updatedVariants)
              }}
              onKeyPress={(e) => {
                if (!/[0-9]/.test(e.key)) {
                  e.preventDefault()
                }
              }}
            />
            {showError && (
              <div style={{ fontSize: '11px', color: '#ff4d4f', marginTop: 2 }}>
                Must be 4, 6, or 8 digits
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: (
        <Space size={4}>
          IGST Rate (%)
          <Tooltip title="Integrated GST rate for inter-state transactions">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      key: 'igstRatePercent',
      width: 120,
      render: (_: unknown, record: VariantType) => {
        // Read directly from record - it's the variant from the table's dataSource
        // The record should have all the values loaded from the API
        const variantIgstRaw = record.igstRatePercent
        
        // Convert to number if present and not null, undefined otherwise
        const variantIgst =
          variantIgstRaw === null || variantIgstRaw === undefined
            ? undefined
            : typeof variantIgstRaw === 'number'
            ? variantIgstRaw
            : Number(variantIgstRaw)

        const displayValue = variantIgst

        const isValid =
          variantIgst !== undefined &&
          variantIgst !== null &&
          ALLOWED_GST_RATES.includes(variantIgst)
        const showError = variantIgst !== undefined && variantIgst !== null && !isValid

        const isDisabled = false

        return (
          <div>
            <Select
              value={displayValue}
              placeholder="Select IGST"
              size="small"
              style={{ width: '100%' }}
              disabled={isDisabled}
              status={showError ? 'error' : undefined}
              onChange={(newValue) => {
                const updatedVariants = variants.map((variant) => {
                  if (variant.id === record.id) {
                    const updated = {
                      ...variant,
                      igstRatePercent: newValue,
                    } as unknown as VariantType
                    // Get current CGST and SGST to maintain ratio if they exist
                    const currentCgst = (variant as unknown as { cgstRatePercent?: number })
                      .cgstRatePercent
                    const currentSgst = (variant as unknown as { sgstRatePercent?: number })
                      .sgstRatePercent

                    // If both CGST and SGST exist and add up to current IGST, maintain ratio
                    if (
                      newValue !== undefined &&
                      newValue !== null &&
                      currentCgst !== undefined &&
                      currentSgst !== undefined &&
                      currentCgst + currentSgst === variantIgst
                    ) {
                      // Maintain the ratio
                      const total = currentCgst + currentSgst
                      if (total > 0) {
                        updated.cgstRatePercent = (currentCgst / total) * newValue
                        updated.sgstRatePercent = (currentSgst / total) * newValue
                      } else {
                        updated.cgstRatePercent = newValue / 2
                        updated.sgstRatePercent = newValue / 2
                      }
                    } else if (newValue !== undefined && newValue !== null) {
                      // Default: split IGST equally between CGST and SGST
                      updated.cgstRatePercent = newValue / 2
                      updated.sgstRatePercent = newValue / 2
                    }
                    return updated
                  }
                  return variant
                })
                onVariantsChange(updatedVariants)
              }}
            >
              {ALLOWED_GST_RATES.map((rate) => (
                <Option key={rate} value={rate}>
                  {rate}%
                </Option>
              ))}
            </Select>
            {showError && (
              <div style={{ fontSize: '11px', color: '#ff4d4f', marginTop: 2 }}>
                Must be 0, 5, 12, 18, or 28
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: (
        <Space size={4}>
          CGST Rate (%)
          <Tooltip title="Central GST rate. CGST + SGST must equal IGST">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      key: 'cgstRatePercent',
      width: 120,
      render: (_: unknown, record: VariantType) => {
        // Read directly from record - it's the variant from the table's dataSource
        const variantCgstRaw = record.cgstRatePercent
        
        // Convert to number if present, undefined if null/undefined
        const variantCgst =
          variantCgstRaw === null || variantCgstRaw === undefined
            ? undefined
            : typeof variantCgstRaw === 'number'
            ? variantCgstRaw
            : Number(variantCgstRaw)

        const displayValue = variantCgst

        const isDisabled = false

        return (
          <Input
            value={displayValue}
            placeholder="Enter CGST"
            size="small"
            type="number"
            disabled={isDisabled}
            suffix="%"
            min={0}
            step={0.01}
            onChange={(e) => {
              const newValue = e.target.value ? parseFloat(e.target.value) : undefined
              const updatedVariants = variants.map((variant) => {
                if (variant.id === record.id) {
                  const updated = {
                    ...variant,
                    cgstRatePercent: newValue,
                  } as unknown as VariantType
                  // Get current IGST
                  const variantIgst = (variant as unknown as { igstRatePercent?: number })
                    .igstRatePercent

                  if (newValue !== undefined && newValue !== null && variantIgst !== undefined) {
                    // Ensure CGST + SGST = IGST
                    updated.sgstRatePercent = variantIgst - newValue
                    // Ensure SGST is not negative
                    if (updated.sgstRatePercent < 0) {
                      updated.sgstRatePercent = 0
                    }
                  }
                  return updated
                }
                return variant
              })
              onVariantsChange(updatedVariants)
            }}
            onKeyPress={(e) => {
              if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                e.preventDefault()
              }
            }}
          />
        )
      },
    },
    {
      title: (
        <Space size={4}>
          SGST Rate (%)
          <Tooltip title="State GST rate. CGST + SGST must equal IGST">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      key: 'sgstRatePercent',
      width: 120,
      render: (_: unknown, record: VariantType) => {
        // Read directly from record - it's the variant from the table's dataSource
        const variantSgstRaw = record.sgstRatePercent
        
        // Convert to number if present, undefined if null/undefined
        const variantSgst =
          variantSgstRaw === null || variantSgstRaw === undefined
            ? undefined
            : typeof variantSgstRaw === 'number'
            ? variantSgstRaw
            : Number(variantSgstRaw)

        const displayValue = variantSgst

        const isDisabled = false

        return (
          <Input
            value={displayValue}
            placeholder="Enter SGST"
            size="small"
            type="number"
            disabled={isDisabled}
            suffix="%"
            min={0}
            step={0.01}
            onChange={(e) => {
              const newValue = e.target.value ? parseFloat(e.target.value) : undefined
              const updatedVariants = variants.map((variant) => {
                if (variant.id === record.id) {
                  const updated = {
                    ...variant,
                    sgstRatePercent: newValue,
                  } as unknown as VariantType
                  // Get current IGST
                  const variantIgst = (variant as unknown as { igstRatePercent?: number })
                    .igstRatePercent

                  if (newValue !== undefined && newValue !== null && variantIgst !== undefined) {
                    // Ensure CGST + SGST = IGST
                    updated.cgstRatePercent = variantIgst - newValue
                    // Ensure CGST is not negative
                    if (updated.cgstRatePercent < 0) {
                      updated.cgstRatePercent = 0
                    }
                  } else if (newValue !== undefined && newValue !== null) {
                    // If no IGST, calculate it from CGST + SGST
                    const currentCgstValue =
                      (variant as unknown as { cgstRatePercent?: number }).cgstRatePercent ?? 0
                    updated.igstRatePercent = currentCgstValue + newValue
                  }
                  return updated
                }
                return variant
              })
              onVariantsChange(updatedVariants)
            }}
            onKeyPress={(e) => {
              if (!/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
                e.preventDefault()
              }
            }}
          />
        )
      },
    },
  ]
}
