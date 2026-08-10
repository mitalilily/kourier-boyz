import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Card, Col, Input, Row, Select, Space, Tag, Typography } from 'antd'
import { createFilterMetadataEntry, type FilterMetadataEntry } from './filterMetadataUtils'

const { Text } = Typography

interface FilterMetadataTabProps {
  metadata: FilterMetadataEntry[]
  setMetadata: (metadata: FilterMetadataEntry[]) => void
}

const FilterMetadataTab = ({ metadata, setMetadata }: FilterMetadataTabProps) => {
  const addMetadata = () => {
    setMetadata([...metadata, createFilterMetadataEntry()])
  }

  const removeMetadata = (id: string) => {
    setMetadata(metadata.filter((item) => item.id !== id))
  }

  const updateKey = (id: string, value: string) => {
    setMetadata(
      metadata.map((item) => (item.id === id ? { ...item, key: value } : item)),
    )
  }

  const updateValues = (id: string, values: string[]) => {
    const cleaned = Array.from(
      new Set(values.map((val) => val.trim()).filter((val) => val.length > 0)),
    )
    setMetadata(
      metadata.map((item) => (item.id === id ? { ...item, values: cleaned } : item)),
    )
  }

  const moveMetadata = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= metadata.length) return
    const next = [...metadata]
    const [item] = next.splice(index, 1)
    next.splice(newIndex, 0, item)
    setMetadata(next)
  }

  return (
    <Card
      title="Filter Metadata"
      extra={
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addMetadata}>
          Add
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      <div style={{ marginBottom: 12 }}>
        <Space size={8} wrap>
          <Text type="secondary">
            Provide optional attribute/value pairs to power storefront filters (e.g., Color,
            Material, Occasion).
          </Text>
          <Tag>Optional</Tag>
          <Tag color="blue">{metadata.length} items</Tag>
        </Space>
      </div>

      <Row gutter={8} style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
        <Col xs={8}>Attribute</Col>
        <Col xs={12}>Filter values</Col>
        <Col xs={4}>Actions</Col>
      </Row>

      {metadata.length === 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
          <Text type="secondary">
            No filter metadata yet. Use Add to create filter-friendly attributes like Color,
            Gender, Occasion, etc.
          </Text>
        </Card>
      )}

      {metadata.map((item, index) => {
        const keyStatus = (item.key.trim().length === 0 ? 'warning' : undefined) as
          | 'warning'
          | undefined
        const valuesStatus =
          (item.values.length === 0 ? 'warning' : undefined) as 'warning' | undefined

        return (
          <Row key={item.id} gutter={8} style={{ marginBottom: 8 }} align="middle">
            <Col xs={8}>
              <Input
                placeholder="e.g., Color"
                value={item.key}
                status={keyStatus}
                onChange={(e) => updateKey(item.id, e.target.value)}
              />
            </Col>
            <Col xs={12}>
              <Select
                mode="tags"
                style={{ width: '100%' }}
                placeholder="Enter filter values (press Enter to add multiple)"
                value={item.values}
                onChange={(values) => updateValues(item.id, values as string[])}
                status={valuesStatus}
                tokenSeparators={[',']}
              />
            </Col>
            <Col xs={4}>
              <Space>
                <Button
                  type="text"
                  disabled={index === 0}
                  onClick={() => moveMetadata(index, 'up')}
                >
                  ↑
                </Button>
                <Button
                  type="text"
                  disabled={index === metadata.length - 1}
                  onClick={() => moveMetadata(index, 'down')}
                >
                  ↓
                </Button>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeMetadata(item.id)}
                />
              </Space>
            </Col>
          </Row>
        )
      })}
    </Card>
  )
}

export default FilterMetadataTab



