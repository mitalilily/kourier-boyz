import { CheckOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  ColorPicker,
  Input,
  Row,
  Segmented,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useState } from 'react'
import { upsertSellerCustomAttribute } from '../../api/products'
import type { AttributeConfig, AttributeOption } from '../../utils/categoryAttributes'

const { Text } = Typography

interface AttributeSelectorProps {
  config: AttributeConfig
  selectedValues: string[]
  onChange: (values: string[]) => void
  multiple?: boolean
}

const AttributeSelector = ({
  config,
  selectedValues,
  onChange,
  multiple = true,
}: AttributeSelectorProps) => {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null)
  const [customOptions, setCustomOptions] = useState<AttributeOption[]>([])
  const [customInput, setCustomInput] = useState<string>('')
  const [customColor, setCustomColor] = useState<string>('#1890ff')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(24)
  const [view, setView] = useState<'grid' | 'list'>(config.type === 'color' ? 'grid' : 'list')

  const persistOption = async (option: AttributeOption) => {
    if (!config.categorySpecific) return
    try {
      const options = [...config.options, ...customOptions, option].filter(
        (opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx,
      )
      await upsertSellerCustomAttribute({
        key: config.key,
        label: config.label,
        type: config.type,
        options,
      })
    } catch {
      // best-effort; UI still updates locally
    }
  }

  const handleValueToggle = (value: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value]
      onChange(newValues)
    } else {
      onChange([value])
    }
  }

  const renderColorOption = (option: AttributeOption) => {
    const isSelected = selectedValues.includes(option.value)
    const isHovered = hoveredValue === option.value

    return (
      <Col key={option.value} xs={8} sm={6} md={4} lg={3}>
        <Card
          size="small"
          hoverable
          style={{
            border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
            backgroundColor: isSelected ? '#f0f8ff' : 'white',
            position: 'relative',
            cursor: 'pointer',
            transition: 'all 0.2s',
            transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          }}
          onMouseEnter={() => setHoveredValue(option.value)}
          onMouseLeave={() => setHoveredValue(null)}
          onClick={() => handleValueToggle(option.value)}
        >
          <div
            style={{
              width: '100%',
              height: 40,
              backgroundColor: option.color,
              borderRadius: 4,
              marginBottom: 8,
              border: '1px solid #d9d9d9',
              position: 'relative',
            }}
          >
            {isSelected && (
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  color: option.color === '#FFFFFF' ? '#000' : '#fff',
                  fontSize: 16,
                }}
              >
                <CheckOutlined />
              </div>
            )}
          </div>
          <Text
            style={{
              fontSize: 12,
              textAlign: 'center',
              display: 'block',
              fontWeight: isSelected ? 600 : 400,
            }}
          >
            {option.label}
          </Text>
        </Card>
      </Col>
    )
  }

  const renderSelectOption = (option: AttributeOption) => {
    const isSelected = selectedValues.includes(option.value)

    return (
      <Col key={option.value} xs={12} sm={8} md={6} lg={4}>
        <Button
          type={isSelected ? 'primary' : 'default'}
          size="small"
          style={{
            width: '100%',
            height: 'auto',
            padding: '8px 12px',
            textAlign: 'left',
            whiteSpace: 'normal',
            minHeight: 40,
          }}
          onClick={() => handleValueToggle(option.value)}
        >
          <div>
            <div style={{ fontWeight: isSelected ? 600 : 400 }}>{option.label}</div>
            {option.description && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {option.description}
              </Text>
            )}
          </div>
        </Button>
      </Col>
    )
  }

  // Deprecated renderers (size/material) collapsed into select-style chips

  // noop

  const renderOptions = () => {
    // merge built-in and custom options; ensure unique by value
    const mergedOptions: AttributeOption[] = [...config.options, ...customOptions]
      .filter((opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx)
      .filter((opt) =>
        search.trim()
          ? opt.label.toLowerCase().includes(search.toLowerCase()) ||
            opt.value.toLowerCase().includes(search.toLowerCase())
          : true,
      )
      .slice(0, limit)

    switch (config.type) {
      case 'color':
        return mergedOptions.map(renderColorOption)
      default:
        // All non-color types treated as dropdown/text chips
        return mergedOptions.map(renderSelectOption)
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 16 }}>
          {config.label}
          {config.required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
        </Text>
        {config.description && (
          <div style={{ marginTop: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {config.description}
            </Text>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <Input.Search
          allowClear
          size="small"
          placeholder={`Search ${config.label.toLowerCase()}`}
          style={{ maxWidth: 260 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Segmented
          size="small"
          value={view}
          onChange={(v) => setView(v as 'grid' | 'list')}
          options={[
            { label: 'Grid', value: 'grid' },
            { label: 'List', value: 'list' },
          ]}
        />
        <Tag color="blue" style={{ marginLeft: 'auto' }}>
          {selectedValues.length} selected
        </Tag>
      </div>

      <Row gutter={[8, 8]}>{renderOptions()}</Row>

      {/* Show more */}
      {([...config.options, ...customOptions].length > limit || search) && (
        <div style={{ marginTop: 8 }}>
          <Button
            size="small"
            type="link"
            onClick={() => setLimit((l) => l + 24)}
            disabled={limit >= [...config.options, ...customOptions].length}
          >
            {limit >= [...config.options, ...customOptions].length ? 'All shown' : 'Show more'}
          </Button>
        </div>
      )}

      {/* Add custom value */}
      <div style={{ marginTop: 12 }}>
        {config.type === 'color' ? (
          <div>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Enter color name (e.g., Navy Blue)"
                style={{ flex: 1 }}
                onPressEnter={async () => {
                  const value = customInput.trim()
                  if (!value) return

                  const exists = [...config.options, ...customOptions].some(
                    (o) => o.value.toLowerCase() === value.toLowerCase(),
                  )
                  if (exists) {
                    message.warning('Color already exists')
                    return
                  }

                  const newOption: AttributeOption = {
                    value,
                    label: value,
                    color: customColor,
                  }
                  setCustomOptions((prev) => [...prev, newOption])
                  onChange([...selectedValues, value])
                  setCustomInput('')
                  await persistOption(newOption)
                }}
              />
              <ColorPicker
                value={customColor}
                onChange={(color) => setCustomColor(color.toHexString())}
                showText
                size="middle"
                style={{ width: '120px' }}
              />
              <Button
                type="primary"
                onClick={async () => {
                  const value = customInput.trim()
                  if (!value) return

                  const exists = [...config.options, ...customOptions].some(
                    (o) => o.value.toLowerCase() === value.toLowerCase(),
                  )
                  if (exists) {
                    message.warning('Color already exists')
                    return
                  }

                  const newOption: AttributeOption = {
                    value,
                    label: value,
                    color: customColor,
                  }
                  setCustomOptions((prev) => [...prev, newOption])
                  onChange([...selectedValues, value])
                  setCustomInput('')
                  await persistOption(newOption)
                }}
              >
                Add Color
              </Button>
            </Space.Compact>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                💡 Enter a color name and pick the exact color you want
              </Text>
            </div>
          </div>
        ) : (
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={`Add custom ${config.label.toLowerCase()}`}
              onPressEnter={async () => {
                const value = customInput.trim()
                if (!value) return

                const exists = [...config.options, ...customOptions].some(
                  (o) => o.value.toLowerCase() === value.toLowerCase(),
                )
                if (exists) {
                  message.warning('Value already exists')
                  return
                }

                const newOption: AttributeOption = {
                  value,
                  label: value,
                }
                setCustomOptions((prev) => [...prev, newOption])
                onChange([...selectedValues, value])
                setCustomInput('')
                await persistOption(newOption)
              }}
            />
            <Button
              type="dashed"
              onClick={async () => {
                const value = customInput.trim()
                if (!value) return

                const exists = [...config.options, ...customOptions].some(
                  (o) => o.value.toLowerCase() === value.toLowerCase(),
                )
                if (exists) {
                  message.warning('Value already exists')
                  return
                }

                const newOption: AttributeOption = {
                  value,
                  label: value,
                }
                setCustomOptions((prev) => [...prev, newOption])
                onChange([...selectedValues, value])
                setCustomInput('')
                await persistOption(newOption)
              }}
            >
              Add
            </Button>
          </Space.Compact>
        )}
      </div>

      {selectedValues.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Selected: {selectedValues.length} option{selectedValues.length !== 1 ? 's' : ''}
          </Text>
        </div>
      )}
    </div>
  )
}

export default AttributeSelector
