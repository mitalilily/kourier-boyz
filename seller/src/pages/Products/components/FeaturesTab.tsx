import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Card, Col, Input, Row, Space, Tag, Typography } from 'antd'

const { Text } = Typography

interface FeaturesTabProps {
  features: string[]
  setFeatures: (features: string[]) => void
}

const FeaturesTab = ({ features, setFeatures }: FeaturesTabProps) => {
  const addFeature = () => {
    setFeatures([...features, ''])
  }

  const removeFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index))
  }

  const updateFeature = (index: number, value: string) => {
    const updated = features.map((feature, i) => (i === index ? value : feature))
    setFeatures(updated)
  }

  const moveFeature = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= features.length) return
    const next = [...features]
    const [item] = next.splice(index, 1)
    next.splice(newIndex, 0, item)
    setFeatures(next)
  }

  return (
    <Card
      title="Features"
      extra={
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addFeature}>
          Add
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      <div style={{ marginBottom: 12 }}>
        <Space size={8} wrap>
          <Text type="secondary">List key product highlights and benefits.</Text>
          <Tag color="blue">{features.filter((f) => f.trim()).length} items</Tag>
        </Space>
      </div>

      {features.length === 0 && (
        <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
          <Text type="secondary">No features yet. Click Add to create your first one.</Text>
        </Card>
      )}

      {features.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Space size={[6, 6]} wrap>
            {features
              .map((f) => f.trim())
              .filter(Boolean)
              .slice(0, 8)
              .map((f, i) => (
                <Tag key={`${f}-${i}`} color="processing">
                  {f}
                </Tag>
              ))}
          </Space>
        </div>
      )}

      <Row gutter={8} style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
        <Col span={20}>Feature</Col>
        <Col span={4}>Actions</Col>
      </Row>

      {features.map((feature, index) => {
        const status = feature.trim().length === 0 ? 'warning' : undefined
        return (
          <Row key={index} gutter={8} style={{ marginBottom: 8 }} align="middle">
            <Col span={20}>
              <Input
                placeholder="e.g., Waterproof, Lightweight, 2-year warranty"
                value={feature}
                maxLength={120}
                showCount
                status={status as 'warning' | undefined}
                onChange={(e) => updateFeature(index, e.target.value)}
              />
            </Col>
            <Col span={4}>
              <Space>
                <Button type="text" disabled={index === 0} onClick={() => moveFeature(index, 'up')}>
                  ↑
                </Button>
                <Button
                  type="text"
                  disabled={index === features.length - 1}
                  onClick={() => moveFeature(index, 'down')}
                >
                  ↓
                </Button>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeFeature(index)}
                />
              </Space>
            </Col>
          </Row>
        )
      })}
    </Card>
  )
}

export default FeaturesTab
