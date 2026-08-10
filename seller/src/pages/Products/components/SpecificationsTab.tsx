import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Card, Col, Input, Row, Space, Tag, Typography } from 'antd'

const { Text } = Typography

interface SpecificationsTabProps {
  specifications: Array<{ key: string; value: string }>
  setSpecifications: (specs: Array<{ key: string; value: string }>) => void
}

const SpecificationsTab = ({ specifications, setSpecifications }: SpecificationsTabProps) => {
  const addSpecification = () => {
    setSpecifications([...specifications, { key: '', value: '' }])
  }

  const removeSpecification = (index: number) => {
    setSpecifications(specifications.filter((_, i) => i !== index))
  }

  const updateSpecification = (index: number, field: 'key' | 'value', value: string) => {
    const updated = specifications.map((spec, i) =>
      i === index ? { ...spec, [field]: value } : spec,
    )
    setSpecifications(updated)
  }

  const moveSpecification = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= specifications.length) return
    const next = [...specifications]
    const [item] = next.splice(index, 1)
    next.splice(newIndex, 0, item)
    setSpecifications(next)
  }

  return (
    <Card
      title="Specifications"
      extra={
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addSpecification}>
          Add
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      <div style={{ marginBottom: 12 }}>
        <Space size={8} wrap>
          <Text type="secondary">
            Add detailed specs (dimensions, materials, care, compatibility, etc.)
          </Text>
          <Tag>Optional</Tag>
          <Tag color="blue">{specifications.length} items</Tag>
        </Space>
      </div>

      <Row gutter={8} style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
        <Col xs={10}>Name</Col>
        <Col xs={10}>Value</Col>
        <Col xs={4}>Actions</Col>
      </Row>

      {specifications.length === 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
          <Text type="secondary">No specifications yet. Click Add to create your first one.</Text>
        </Card>
      )}

      {specifications.map((spec, index) => {
        const nameStatus = (spec.key.trim().length === 0 ? 'warning' : undefined) as
          | 'warning'
          | undefined
        const valueStatus = (spec.value.trim().length === 0 ? 'warning' : undefined) as
          | 'warning'
          | undefined
        return (
          <Row key={index} gutter={8} style={{ marginBottom: 8 }} align="middle">
            <Col xs={10}>
              <Input
                placeholder="e.g., Material"
                value={spec.key}
                status={nameStatus}
                onChange={(e) => updateSpecification(index, 'key', e.target.value)}
              />
            </Col>
            <Col xs={10}>
              <Input
                placeholder="e.g., 100% Cotton"
                value={spec.value}
                status={valueStatus}
                onChange={(e) => updateSpecification(index, 'value', e.target.value)}
              />
            </Col>
            <Col xs={4}>
              <Space>
                <Button
                  type="text"
                  disabled={index === 0}
                  onClick={() => moveSpecification(index, 'up')}
                >
                  ↑
                </Button>
                <Button
                  type="text"
                  disabled={index === specifications.length - 1}
                  onClick={() => moveSpecification(index, 'down')}
                >
                  ↓
                </Button>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeSpecification(index)}
                />
              </Space>
            </Col>
          </Row>
        )
      })}
    </Card>
  )
}

export default SpecificationsTab
