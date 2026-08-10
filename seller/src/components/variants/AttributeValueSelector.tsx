import { Select, Space, Typography } from 'antd'
import { useMemo, useState } from 'react'
import { getUniqueAttributeValues } from '../../pages/Products/productFormUtils'

const { Text } = Typography

interface AttributeValueSelectorProps {
  variants: Array<{ attributes: Record<string, string> }>
  onSelect: (attribute: string | null, value: string | null) => void
  placeholder?: string
  size?: 'small' | 'middle' | 'large'
  style?: React.CSSProperties
  showAllOption?: boolean
  allOptionLabel?: string
}

/**
 * Reusable component for selecting attribute + value from variants
 * Used for bulk operations like "apply to all Black variants"
 */
export default function AttributeValueSelector({
  variants,
  onSelect,
  placeholder = 'Select attribute',
  size = 'small',
  style,
  showAllOption = true,
  allOptionLabel = 'All Variants',
}: AttributeValueSelectorProps) {
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null)
  const [selectedValue, setSelectedValue] = useState<string | null>(null)

  // Get unique attributes and their values from variants
  const attributeValues = useMemo(() => getUniqueAttributeValues(variants), [variants])

  const attributeOptions = useMemo(() => {
    const options = Object.keys(attributeValues).map((attr) => ({
      label: attr,
      value: attr,
    }))
    return options
  }, [attributeValues])

  const valueOptions = useMemo(() => {
    if (!selectedAttribute || !attributeValues[selectedAttribute]) return []
    return attributeValues[selectedAttribute].map((val) => ({
      label: val,
      value: val,
    }))
  }, [selectedAttribute, attributeValues])

  const handleAttributeChange = (attribute: string | null) => {
    setSelectedAttribute(attribute)
    setSelectedValue(null)
    if (!attribute) {
      onSelect(null, null)
    }
  }

  const handleValueChange = (value: string | null) => {
    setSelectedValue(value)
    onSelect(selectedAttribute, value)
  }

  // Count variants matching selection
  const matchingCount = useMemo(() => {
    if (!selectedAttribute || !selectedValue) return variants.length
    return variants.filter((v) => v.attributes[selectedAttribute] === selectedValue).length
  }, [variants, selectedAttribute, selectedValue])

  if (Object.keys(attributeValues).length === 0) {
    return (
      <Text type="secondary" style={{ fontSize: 11 }}>
        No attributes available
      </Text>
    )
  }

  return (
    <Space size={8} style={style}>
      {showAllOption && (
        <Select
          size={size}
          style={{ minWidth: 140 }}
          placeholder={placeholder}
          allowClear
          value={selectedAttribute}
          onChange={handleAttributeChange}
          options={[
            { label: allOptionLabel, value: '__all__' },
            ...attributeOptions.map((opt) => ({
              ...opt,
              label: `By ${opt.label}`,
            })),
          ]}
        />
      )}

      {selectedAttribute && selectedAttribute !== '__all__' && (
        <Select
          size={size}
          style={{ minWidth: 120 }}
          placeholder={`Select ${selectedAttribute}`}
          value={selectedValue}
          onChange={handleValueChange}
          options={valueOptions}
        />
      )}

      {(selectedAttribute === '__all__' || (selectedAttribute && selectedValue)) && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          ({matchingCount} variant{matchingCount !== 1 ? 's' : ''})
        </Text>
      )}
    </Space>
  )
}
