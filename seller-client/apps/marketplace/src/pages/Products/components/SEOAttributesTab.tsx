import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Tag,
  Typography,
  type FormInstance,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import type { Category } from '../../../api/categories'
import { getCategoryAttributeSet, SUGGESTED_TAGS } from '../../../utils/categoryAttributes'
import { createFilterMetadataEntry, type FilterMetadataEntry } from './filterMetadataUtils'

const { Text } = Typography
const { TextArea } = Input

interface SEOAttributesTabProps {
  form: FormInstance
  categories: Category[]
  specifications: Array<{ key?: string; value: string }>
  setSpecifications: (specs: Array<{ key?: string; value: string }>) => void
  filterMetadata: FilterMetadataEntry[]
  setFilterMetadata: (metadata: FilterMetadataEntry[]) => void
  tags: string[]
  setTags: (tags: string[]) => void
}

/**
 * Safely split a spec value into multiple filter values.
 *
 * Rules:
 * - "100% cotton" => ["100% cotton"]
 * - "80/20 cotton" => ["80/20 cotton"]
 * - "cotton, polyester" => ["cotton", "polyester"]
 * - "cotton and polyester" => ["cotton", "polyester"]
 * - "cotton & polyester" => ["cotton", "polyester"]
 * - "cotton / polyester" => ["cotton", "polyester"]
 * - "cotton/polyester" => ["cotton/polyester"] (no spaces, keep intact)
 */
const splitSpecValues = (raw: string): string[] => {
  const v = raw.trim()
  if (!v) return []

  const lower = v.toLowerCase()

  // If contains percentage like 100% / 50%, keep as single
  if (/\d+\s*%/.test(v)) {
    return [v]
  }

  // If contains numeric ratios like 80/20, 70 / 30, keep as single
  if (/\d+\s*\/\s*\d+/.test(v)) {
    return [v]
  }

  const hasComma = v.includes(',')
  const hasAnd = /\sand\s/i.test(lower)
  const hasAmp = /\s&\s/.test(v)
  const hasSlash = /\s\/\s/.test(v) // only split when spaces around "/"

  if (hasComma || hasAnd || hasAmp || hasSlash) {
    return v
      .split(/,|\s+and\s+|\s+&\s+|\s+\/\s+/i)
      .map((x) => x.trim())
      .filter((x) => x.length > 0)
  }

  // Default: treat whole string as single value
  return [v]
}

/**
 * Category-based specification suggestions
 */
const getCategorySpecSuggestions = (
  categorySlug: string | undefined,
  categoryName: string | undefined,
): Array<{ key?: string; value: string }> => {
  if (!categorySlug && !categoryName) return []

  const searchText = (categorySlug || categoryName || '').toLowerCase()

  const suggestions: Record<string, Array<{ key?: string; value: string }>> = {
    clothing: [
      { key: 'Neckline', value: '' },
      { key: 'Sleeve Type', value: '' },
      { key: 'Fit', value: '' },
      { key: 'Pattern', value: '' },
      { key: 'Material', value: '' },
      { key: 'Care Instructions', value: '' },
    ],
    shoes: [
      { key: 'Closure Type', value: '' },
      { key: 'Heel Height', value: '' },
      { key: 'Sole Material', value: '' },
      { key: 'Upper Material', value: '' },
      { key: 'Insole Material', value: '' },
    ],
    electronics: [
      { key: 'Brand', value: '' },
      { key: 'Model', value: '' },
      { key: 'Display Size', value: '' },
      { key: 'Battery Capacity', value: '' },
      { key: 'Connectivity', value: '' },
      { key: 'Warranty Period', value: '' },
    ],
    jewelry: [
      { key: 'Metal Type', value: '' },
      { key: 'Gemstone', value: '' },
      { key: 'Chain Length', value: '' },
      { key: 'Ring Size', value: '' },
      { key: 'Plating', value: '' },
    ],
    home: [
      { key: 'Material', value: '' },
      { key: 'Finish', value: '' },
      { key: 'Assembly Required', value: '' },
    ],
  }

  // More precise matching - only match if category slug/name actually matches the category key
  // Avoid false matches (e.g., "health" shouldn't match "home")
  for (const [key, specs] of Object.entries(suggestions)) {
    const keyLower = key.toLowerCase()

    // Exact match
    if (searchText === keyLower || searchText === key) {
      return specs
    }

    // Category slug/name matches (for cases like "home-garden" matching "home")
    if (categorySlug) {
      const slugLower = categorySlug.toLowerCase()
      // Only match if it's a meaningful match (not just substring)
      const slugWords = slugLower.split(/[-_\s]+/)
      if (slugWords.includes(keyLower)) {
        return specs
      }
    }

    if (categoryName) {
      const nameLower = categoryName.toLowerCase()
      const nameWords = nameLower.split(/[-_\s&]+/)
      if (nameWords.includes(keyLower)) {
        return specs
      }
    }
  }

  // If no match found, return empty array (no defaults)
  return []
}

/**
 * Category-based filter metadata suggestions
 */
const getCategoryFilterSuggestions = (
  categorySlug: string | undefined,
  categoryName: string | undefined,
): FilterMetadataEntry[] => {
  if (!categorySlug && !categoryName) return []

  const searchText = (categorySlug || categoryName || '').toLowerCase()
  let categoryAttrSet = null

  if (categorySlug) {
    categoryAttrSet = getCategoryAttributeSet(categorySlug.toLowerCase())
  }

  if (!categoryAttrSet) {
    const keywordMap: Record<string, string> = {
      clothing: 'clothing',
      apparel: 'clothing',
      shoes: 'shoes',
      footwear: 'shoes',
      electronics: 'electronics',
      gadgets: 'electronics',
      jewelry: 'jewelry',
      accessories: 'jewelry',
      home: 'home-garden',
      garden: 'home-garden',
    }

    for (const [keyword, setId] of Object.entries(keywordMap)) {
      if (searchText.includes(keyword)) {
        categoryAttrSet = getCategoryAttributeSet(setId)
        break
      }
    }
  }

  if (!categoryAttrSet) return []

  const filterEntries: FilterMetadataEntry[] = categoryAttrSet.attributes
    .filter((attr) => {
      const variantAxes = ['size', 'color']
      return !variantAxes.includes(attr.key.toLowerCase())
    })
    .map((attr) => {
      const values = attr.options.map((opt) => opt.label || opt.value)
      return createFilterMetadataEntry({
        key: attr.label || attr.key,
        values,
      })
    })

  return filterEntries
}

/**
 * One-time extraction of filters from specifications + brand
 */
const extractFiltersFromFormData = (
  specifications: Array<{ key?: string; value: string }>,
  brand: string | undefined,
): FilterMetadataEntry[] => {
  const filters: FilterMetadataEntry[] = []

  const filterableKeys = [
    'material',
    'color',
    'pattern',
    'fit',
    'style',
    'occasion',
    'season',
    'brand',
    'type',
    'neckline',
    'sleeve',
    'sleeve length',
    'sleeve type',
    'closure',
    'heel',
    'sole',
    'upper',
    'metal',
    'gemstone',
    'finish',
    'dimensions',
  ]

  specifications.forEach((spec) => {
    if (!spec.key || !spec.value?.trim()) return

    const keyLower = spec.key.trim().toLowerCase()
    if (!filterableKeys.some((fk) => keyLower.includes(fk))) return

    const rawValue = spec.value.trim()
    const values = splitSpecValues(rawValue)
    if (!values.length) return

    const existing = filters.find((f) => f.key.toLowerCase() === spec.key!.toLowerCase())

    if (existing) {
      existing.values = Array.from(new Set([...existing.values, ...values]))
    } else {
      filters.push(
        createFilterMetadataEntry({
          key: spec.key.trim(),
          values,
        }),
      )
    }
  })

  // Brand as filter
  if (brand && brand.trim()) {
    const existingBrand = filters.find((f) => f.key.toLowerCase() === 'brand')
    if (existingBrand) {
      if (!existingBrand.values.includes(brand.trim())) {
        existingBrand.values.push(brand.trim())
      }
    } else {
      filters.push(
        createFilterMetadataEntry({
          key: 'Brand',
          values: [brand.trim()],
        }),
      )
    }
  }

  return filters
}

const SEOAttributesTab = ({
  form,
  categories,
  specifications,
  setSpecifications,
  filterMetadata,
  setFilterMetadata,
  tags,
  setTags,
}: SEOAttributesTabProps) => {
  const selectedCategoryId = Form.useWatch('category', form)
  const brand = Form.useWatch('brand', form)

  const selectedCategory = useMemo(
    () => categories.find((cat) => cat._id === selectedCategoryId),
    [categories, selectedCategoryId],
  )

  // One-time spec → filter autofill flag
  const [specFiltersInitialized, setSpecFiltersInitialized] = useState(false)
  // Category-based autofill tracking
  const [categoryFiltersInitializedFor, setCategoryFiltersInitializedFor] = useState<string | null>(
    null,
  )
  const [categorySpecsInitializedFor, setCategorySpecsInitializedFor] = useState<string | null>(
    null,
  )

  /**
   * STEP 1: ONE-TIME autofill filters from specs + brand
   * - Only if filterMetadata is empty
   * - Only once per product
   * - No per-keystroke re-trigger
   */
  useEffect(() => {
    if (specFiltersInitialized) return
    if (filterMetadata.length > 0) return

    const extracted = extractFiltersFromFormData(specifications, brand)
    if (extracted.length === 0) return

    setFilterMetadata(extracted)
    setSpecFiltersInitialized(true)
  }, [specifications, brand, filterMetadata.length, specFiltersInitialized, setFilterMetadata])

  /**
   * STEP 2: Category-based suggestions
   * - Specs: once per category if empty
   * - Filters: once per category if empty and spec-based autofill didn't run
   */
  useEffect(() => {
    if (!selectedCategory) return
    const categoryId = selectedCategory._id

    // Category-based specs suggestion
    if (specifications.length === 0 && categorySpecsInitializedFor !== categoryId) {
      const suggestedSpecs = getCategorySpecSuggestions(
        selectedCategory.slug,
        selectedCategory.name,
      )
      if (suggestedSpecs.length > 0) {
        setSpecifications(suggestedSpecs.map((s) => ({ key: s.key || undefined, value: s.value })))
      }
      setCategorySpecsInitializedFor(categoryId)
    }

    // Category-based filter suggestion (only if no filters & spec autofill didn't run)
    if (
      filterMetadata.length === 0 &&
      !specFiltersInitialized &&
      categoryFiltersInitializedFor !== categoryId
    ) {
      const suggestedFilters = getCategoryFilterSuggestions(
        selectedCategory.slug,
        selectedCategory.name,
      )
      if (suggestedFilters.length > 0) {
        setFilterMetadata(suggestedFilters)
      }
      setCategoryFiltersInitializedFor(categoryId)
    }
  }, [
    selectedCategory,
    specifications.length,
    filterMetadata.length,
    specFiltersInitialized,
    categoryFiltersInitializedFor,
    categorySpecsInitializedFor,
    setSpecifications,
    setFilterMetadata,
  ])

  return (
    <div>
      {/* SEO Section */}
      <Card
        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>SEO</span>}
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        <Row gutter={[12, 8]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="metaTitle"
              label={<span style={{ fontSize: '12px' }}>Meta Title</span>}
              tooltip="Recommended up to 60 characters"
              style={{ marginBottom: 12 }}
            >
              <Input size="small" placeholder="Enter SEO title" maxLength={60} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="seoKeywords"
              label={<span style={{ fontSize: '12px' }}>SEO Keywords</span>}
              style={{ marginBottom: 12 }}
            >
              <Select size="small" mode="tags" placeholder="Add SEO keywords" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item
              name="metaDescription"
              label={<span style={{ fontSize: '12px' }}>Meta Description</span>}
              tooltip="Recommended 120-160 characters"
              style={{ marginBottom: 0 }}
            >
              <TextArea rows={2} size="small" maxLength={160} placeholder="Enter SEO description" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Specifications & Features Section */}
      <Card
        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>Specifications & Features</span>}
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setSpecifications([...specifications, { key: '', value: '' }])
            }}
            style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
          >
            Add
          </Button>
        }
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        {selectedCategory && specifications.length === 0 && (
          <div
            style={{
              marginBottom: 10,
              padding: '8px 10px',
              background: '#F7F2E5',
              borderRadius: 4,
            }}
          >
            <Text type="secondary" style={{ fontSize: '11px' }}>
              💡 <strong>Tip:</strong> Select a category to auto-populate suggested specifications
              based on the product type. Leave "Name" empty for simple features (e.g.,
              'Waterproof').
            </Text>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <Space size={6} wrap>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Add specifications (key-value pairs like "Material: 100% Cotton") or simple features
              (leave Name empty, e.g., "Waterproof", "Lightweight").
            </Text>
            <Tag style={{ fontSize: '10px', padding: '0 6px', height: '20px', lineHeight: '20px' }}>
              Optional
            </Tag>
            <Tag
              color="blue"
              style={{ fontSize: '10px', padding: '0 6px', height: '20px', lineHeight: '20px' }}
            >
              {specifications.length} items
            </Tag>
          </Space>
        </div>

        <Row gutter={6} style={{ fontSize: '11px', color: '#6b7280', marginBottom: 6 }}>
          <Col xs={10}>Name (optional for features)</Col>
          <Col xs={10}>Value</Col>
          <Col xs={4}>Actions</Col>
        </Row>

        {specifications.length === 0 && (
          <Card size="small" style={{ marginBottom: 10, background: '#fafafa', fontSize: '11px' }}>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              No specifications or features yet. Click Add to create your first one.
            </Text>
          </Card>
        )}

        {specifications.map((spec, index) => {
          const hasKey = spec.key && spec.key.trim().length > 0
          const valueStatus = (spec.value.trim().length === 0 ? 'warning' : undefined) as
            | 'warning'
            | undefined

          return (
            <Row key={index} gutter={6} style={{ marginBottom: 6 }} align="middle">
              <Col xs={10}>
                <Input
                  size="small"
                  placeholder={hasKey ? 'e.g., Material' : 'Leave empty for feature'}
                  value={spec.key || ''}
                  onChange={(e) => {
                    const updated = specifications.map((s, i) =>
                      i === index ? { ...s, key: e.target.value.trim() || undefined } : s,
                    )
                    setSpecifications(updated)
                  }}
                />
              </Col>
              <Col xs={10}>
                <Input
                  size="small"
                  placeholder={hasKey ? 'e.g., 100% Cotton' : 'e.g., Waterproof, Lightweight'}
                  value={spec.value}
                  status={valueStatus}
                  onChange={(e) => {
                    const updated = specifications.map((s, i) =>
                      i === index ? { ...s, value: e.target.value } : s,
                    )
                    setSpecifications(updated)
                  }}
                />
              </Col>
              <Col xs={4}>
                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
                    disabled={index === 0}
                    onClick={() => {
                      const newIndex = index - 1
                      if (newIndex < 0) return
                      const next = [...specifications]
                      const [item] = next.splice(index, 1)
                      next.splice(newIndex, 0, item)
                      setSpecifications(next)
                    }}
                    style={{ padding: '0 4px', fontSize: '11px', height: '24px' }}
                  >
                    ↑
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    disabled={index === specifications.length - 1}
                    onClick={() => {
                      const newIndex = index + 1
                      if (newIndex >= specifications.length) return
                      const next = [...specifications]
                      const [item] = next.splice(index, 1)
                      next.splice(newIndex, 0, item)
                      setSpecifications(next)
                    }}
                    style={{ padding: '0 4px', fontSize: '11px', height: '24px' }}
                  >
                    ↓
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setSpecifications(specifications.filter((_, i) => i !== index))
                    }}
                    style={{ padding: '0 4px', fontSize: '11px', height: '24px' }}
                  />
                </Space>
              </Col>
            </Row>
          )
        })}
      </Card>

      {/* Filters / Attribute Metadata Section */}
      <Card
        title={
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Filters / Attribute Metadata</span>
        }
        extra={
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              setFilterMetadata([...filterMetadata, createFilterMetadataEntry()])
            }}
            style={{ fontSize: '11px', height: '24px', padding: '0 8px' }}
          >
            Add
          </Button>
        }
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        {selectedCategory && filterMetadata.length === 0 && (
          <div
            style={{
              marginBottom: 10,
              padding: '8px 10px',
              background: '#F7F2E5',
              borderRadius: 4,
            }}
          >
            <Text type="secondary" style={{ fontSize: '11px' }}>
              💡 <strong>Tip:</strong> Select a category to auto-populate suggested filter
              attributes based on the product type.
            </Text>
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <Space size={6} wrap>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              Provide optional attribute/value pairs to power storefront filters (e.g., Color,
              Material, Occasion).
            </Text>
            <Tag style={{ fontSize: '10px', padding: '0 6px', height: '20px', lineHeight: '20px' }}>
              Optional
            </Tag>
            <Tag
              color="blue"
              style={{ fontSize: '10px', padding: '0 6px', height: '20px', lineHeight: '20px' }}
            >
              {filterMetadata.length} items
            </Tag>
          </Space>
        </div>

        <Row gutter={6} style={{ fontSize: '11px', color: '#6b7280', marginBottom: 6 }}>
          <Col xs={8}>Attribute</Col>
          <Col xs={12}>Filter values (multiple allowed)</Col>
          <Col xs={4}>Actions</Col>
        </Row>

        {filterMetadata.length === 0 && (
          <Card size="small" style={{ marginBottom: 10, background: '#fafafa' }}>
            <Text type="secondary" style={{ fontSize: '11px' }}>
              No filter metadata yet. Use Add to create filter-friendly attributes like Color,
              Gender, Occasion, etc.
            </Text>
          </Card>
        )}

        {filterMetadata.map((item, index) => {
          const valuesArray = Array.isArray(item.values)
            ? item.values.map((v) => String(v || '').trim()).filter((v) => v.length > 0)
            : []

          return (
            <Row key={item.id} gutter={6} style={{ marginBottom: 6 }} align="middle">
              {/* ATTRIBUTE NAME */}
              <Col xs={8}>
                <Input
                  size="small"
                  placeholder="e.g., Material"
                  value={item.key}
                  status={!item.key.trim() ? 'warning' : undefined}
                  onChange={(e) => {
                    const updated = filterMetadata.map((meta) =>
                      meta.id === item.id ? { ...meta, key: e.target.value } : meta,
                    )
                    setFilterMetadata(updated)
                  }}
                />
              </Col>

              {/* MULTI-VALUE FILTER SELECT */}
              <Col xs={12}>
                <Select
                  size="small"
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="Enter values (e.g., cotton, polyester)"
                  value={valuesArray}
                  onChange={(vals) => {
                    let valuesArray: string[] = []

                    if (Array.isArray(vals)) {
                      valuesArray = vals
                        .map((v) => (typeof v === 'string' ? v.trim() : String(v || '').trim()))
                        .filter((v) => v.length > 0)
                    } else if (vals !== undefined && vals !== null && vals !== '') {
                      valuesArray = [String(vals).trim()].filter((v) => v.length > 0)
                    }

                    const cleaned = Array.from(new Set(valuesArray))

                    const currentValues = Array.isArray(item.values) ? item.values : []
                    if (
                      JSON.stringify([...currentValues].sort()) !==
                      JSON.stringify([...cleaned].sort())
                    ) {
                      setFilterMetadata(
                        filterMetadata.map((meta) =>
                          meta.id === item.id ? { ...meta, values: cleaned } : meta,
                        ),
                      )
                    }
                  }}
                  maxTagCount="responsive"
                  allowClear
                />
              </Col>

              {/* ACTIONS */}
              <Col xs={4}>
                <Space size={4}>
                  <Button
                    type="text"
                    size="small"
                    disabled={index === 0}
                    onClick={() => {
                      const arr = [...filterMetadata]
                      const [moved] = arr.splice(index, 1)
                      arr.splice(index - 1, 0, moved)
                      setFilterMetadata(arr)
                    }}
                  >
                    ↑
                  </Button>

                  <Button
                    type="text"
                    size="small"
                    disabled={index === filterMetadata.length - 1}
                    onClick={() => {
                      const arr = [...filterMetadata]
                      const [moved] = arr.splice(index, 1)
                      arr.splice(index + 1, 0, moved)
                      setFilterMetadata(arr)
                    }}
                  >
                    ↓
                  </Button>

                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setFilterMetadata(filterMetadata.filter((f) => f.id !== item.id))
                    }}
                  />
                </Space>
              </Col>
            </Row>
          )
        })}
      </Card>

      {/* Tags Section */}
      <Card
        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>Tags</span>}
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        <Form.Item
          label={<span style={{ fontSize: '12px' }}>Tags</span>}
          style={{ marginBottom: 8 }}
        >
          <Select
            size="small"
            mode="tags"
            style={{ width: '100%' }}
            placeholder="Add tags like 'eco', 'summer', 'best seller'"
            value={tags}
            onChange={setTags}
            options={SUGGESTED_TAGS.map((t: string) => ({ value: t, label: t }))}
          />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          Add concise, relevant tags. These are used for filters and search alongside your variant
          attributes (e.g., color, size), helping customers find the right products quickly.
        </Text>
      </Card>
    </div>
  )
}

export default SEOAttributesTab
