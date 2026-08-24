import { PlusOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import {
  deleteSellerCustomAttribute,
  getSellerCustomAttributes,
  upsertSellerCustomAttribute,
} from '../../api/products'
import type { AttributeConfig } from '../../utils/categoryAttributes'
import { GENERAL_ATTRIBUTES } from '../../utils/categoryAttributes'

const { Title, Text } = Typography

interface SmartAttributeSelectorProps {
  selectedCategory?: string
  selectedAttributes: string[]
  onAttributesChange: (attributes: string[]) => void
  onCustomAttributesChange: (customAttributes: AttributeConfig[]) => void
  customAttributes: AttributeConfig[]
}

const SmartAttributeSelector = ({
  selectedAttributes,
  onAttributesChange,
  onCustomAttributesChange,
  customAttributes,
}: SmartAttributeSelectorProps) => {
  const [form] = Form.useForm()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingAttribute, setEditingAttribute] = useState<AttributeConfig | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Always use general attributes - no category dependency
  const suggested = GENERAL_ATTRIBUTES

  // Load from backend
  useEffect(() => {
    ;(async () => {
      try {
        const items = await getSellerCustomAttributes()
        const mapped: AttributeConfig[] = items.map((i) => ({
          key: i.key,
          label: i.label,
          type: i.type,
          required: !!i.required,
          description: i.description,
          sortOrder: i.sortOrder ?? 999,
          options: Array.isArray(i.options) ? i.options : [],
          categorySpecific: true,
        }))
        onCustomAttributesChange(mapped)
      } catch {
        // silent
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddCustomAttribute = () => {
    setEditingAttribute(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleEditCustomAttribute = (attribute: AttributeConfig) => {
    setEditingAttribute(attribute)
    form.setFieldsValue({
      key: attribute.key,
      label: attribute.label,
      type: attribute.type,
    })
    setIsModalVisible(true)
  }

  const handleDeleteCustomAttribute = async (attributeKey: string) => {
    try {
      await deleteSellerCustomAttribute(attributeKey)
      const updated = customAttributes.filter((attr) => attr.key !== attributeKey)
      onCustomAttributesChange(updated)
      if (selectedAttributes.includes(attributeKey)) {
        onAttributesChange(selectedAttributes.filter((attr) => attr !== attributeKey))
      }
      message.success('Custom attribute deleted')
    } catch {
      message.error('Failed to delete custom attribute')
    }
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        key: values.key,
        label: values.label,
        type: values.type,
      } as const
      const saved = await upsertSellerCustomAttribute(payload)

      const newAttribute: AttributeConfig = {
        key: saved.key,
        label: saved.label,
        type: saved.type,
        required: !!saved.required,
        description: saved.description,
        sortOrder: saved.sortOrder ?? 999,
        options: Array.isArray(saved.options) ? saved.options : [],
        categorySpecific: true,
      }

      const exists = customAttributes.find((c) => c.key === newAttribute.key)
      const updated = exists
        ? customAttributes.map((c) => (c.key === newAttribute.key ? newAttribute : c))
        : [...customAttributes, newAttribute]
      onCustomAttributesChange(updated)
      message.success(exists ? 'Custom attribute updated' : 'Custom attribute added')
      setIsModalVisible(false)
      form.resetFields()
    } catch (errorInfo: unknown) {
      if ((errorInfo as { errorFields?: unknown[] })?.errorFields) return
      message.error('Failed to save custom attribute')
    }
  }

  const handleModalCancel = () => {
    setIsModalVisible(false)
    form.resetFields()
  }

  const allAvailableAttributes = [...suggested, ...customAttributes]
  const getTypeColors = (type?: string) => {
    switch (type) {
      case 'color':
        return { bar: '#eb2f96', tag: 'magenta' as const, headBg: '#fff0f6', headBorder: '#ffadd2' }
      case 'select':
        return {
          bar: '#2f54eb',
          tag: 'geekblue' as const,
          headBg: '#f0f5ff',
          headBorder: '#adc6ff',
        }
      case 'text':
        return { bar: '#faad14', tag: 'gold' as const, headBg: '#fffbe6', headBorder: '#ffe58f' }
      default:
        return { bar: '#d9d9d9', tag: 'default' as const, headBg: '#fafafa', headBorder: '#f0f0f0' }
    }
  }

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
            Variant Attributes
          </Title>
          <Text type="secondary">Choose attributes to create product variants</Text>
        </div>

        <Row gutter={[16, 16]}>
          {/* Suggested Attributes */}
          <Col span={12}>
            <Card
              size="small"
              title={
                <Text strong style={{ color: '#1f1f1f' }}>
                  Suggested Attributes
                </Text>
              }
              headStyle={{ background: '#f5f8ff', borderBottom: '1px solid #adc6ff' }}
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Segmented
                    size="small"
                    value={typeFilter || 'all'}
                    onChange={(val) => setTypeFilter(val === 'all' ? null : (val as string))}
                    options={['all', 'color', 'select', 'text']}
                  />
                  <Input.Search
                    allowClear
                    placeholder="Search attributes"
                    size="small"
                    style={{ width: 180 }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </Space>
                <Row gutter={[8, 8]}>
                  {(typeFilter ? suggested.filter((a) => a.type === typeFilter) : suggested)
                    .filter((a) =>
                      search.trim()
                        ? a.label.toLowerCase().includes(search.toLowerCase()) ||
                          a.key.toLowerCase().includes(search.toLowerCase())
                        : true,
                    )
                    .map((attr) => (
                      <Col span={12} key={attr.key}>
                        <Card
                          size="small"
                          hoverable
                          onClick={() => {
                            if (selectedAttributes.includes(attr.key)) {
                              onAttributesChange(selectedAttributes.filter((a) => a !== attr.key))
                            } else {
                              onAttributesChange([...selectedAttributes, attr.key])
                            }
                          }}
                          style={{
                            borderColor: selectedAttributes.includes(attr.key)
                              ? '#B78115'
                              : '#f0f0f0',
                            background: selectedAttributes.includes(attr.key) ? '#e6f7ff' : '#fff',
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 4,
                              borderTopLeftRadius: 6,
                              borderBottomLeftRadius: 6,
                              background: getTypeColors(attr.type).bar,
                            }}
                          />
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <div>
                              <Text strong>{attr.label}</Text>
                              <Tag color={getTypeColors(attr.type).tag} style={{ marginLeft: 8 }}>
                                {attr.type === 'select' ? 'dropdown' : attr.type}
                              </Tag>
                            </div>
                            <Text type="secondary">{attr.options.length} options</Text>
                          </Space>
                          {attr.description && (
                            <div style={{ marginTop: 4 }}>
                              <Text
                                type="secondary"
                                style={{ fontSize: 12 }}
                                ellipsis={{ tooltip: attr.description }}
                              >
                                {attr.description}
                              </Text>
                            </div>
                          )}
                        </Card>
                      </Col>
                    ))}
                </Row>
              </Space>
            </Card>
          </Col>

          {/* Custom Attributes */}
          <Col span={12}>
            <Card
              size="small"
              title={
                <Text strong style={{ color: '#1f1f1f' }}>
                  Custom Attributes
                </Text>
              }
              headStyle={{ background: '#fff7f0', borderBottom: '1px solid #ffd591' }}
              extra={
                <Button
                  type="dashed"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={handleAddCustomAttribute}
                >
                  Add Custom
                </Button>
              }
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {customAttributes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Text type="secondary">No custom attributes yet</Text>
                    <br />
                    <Button type="link" size="small" onClick={handleAddCustomAttribute}>
                      Add your first custom attribute
                    </Button>
                  </div>
                ) : (
                  customAttributes.map((attr) => (
                    <div
                      key={attr.key}
                      style={{
                        padding: 8,
                        border: '1px solid #f0f0f0',
                        borderRadius: 6,
                        cursor: 'pointer',
                        backgroundColor: selectedAttributes.includes(attr.key)
                          ? '#e6f7ff'
                          : 'white',
                        borderColor: selectedAttributes.includes(attr.key) ? '#B78115' : '#f0f0f0',
                        position: 'relative',
                      }}
                      onClick={() => {
                        if (selectedAttributes.includes(attr.key)) {
                          onAttributesChange(selectedAttributes.filter((a) => a !== attr.key))
                        } else {
                          onAttributesChange([...selectedAttributes, attr.key])
                        }
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          borderTopLeftRadius: 6,
                          borderBottomLeftRadius: 6,
                          background: getTypeColors(attr.type).bar,
                        }}
                      />
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <div>
                          <Text strong>{attr.label}</Text>
                          <Tag color={getTypeColors(attr.type).tag} style={{ marginLeft: 8 }}>
                            {attr.type === 'select' ? 'dropdown' : attr.type}
                          </Tag>
                        </div>
                        <Space>
                          <Button
                            type="text"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCustomAttribute(attr)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="text"
                            danger
                            size="small"
                            onClick={async (e) => {
                              e.stopPropagation()
                              await handleDeleteCustomAttribute(attr.key)
                            }}
                          >
                            Delete
                          </Button>
                        </Space>
                      </Space>
                    </div>
                  ))
                )}
              </Space>
            </Card>
          </Col>
        </Row>

        {selectedAttributes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Divider />
            <Title level={5}>Selected Attributes ({selectedAttributes.length})</Title>
            <Space wrap>
              {selectedAttributes.map((attrKey) => {
                const attr = allAvailableAttributes.find((a) => a.key === attrKey)
                return (
                  <Tag
                    key={attrKey}
                    closable
                    onClose={() =>
                      onAttributesChange(selectedAttributes.filter((a) => a !== attrKey))
                    }
                    color="blue"
                  >
                    {attr?.label || attrKey}
                  </Tag>
                )
              })}
            </Space>
          </div>
        )}
      </Card>

      {/* Add/Edit Custom Attribute Modal */}
      <Modal
        title={editingAttribute ? 'Edit Custom Attribute' : 'Add Custom Attribute'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="key"
                label="Attribute Key"
                rules={[
                  { required: true, message: 'Please enter attribute key' },
                  {
                    pattern: /^[a-z0-9-]+$/,
                    message: 'Only lowercase letters, numbers, and hyphens allowed',
                  },
                ]}
                tooltip="Used internally (e.g., 'custom-size', 'special-color')"
              >
                <Input placeholder="e.g., custom-size, special-color" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="label"
                label="Attribute Label"
                rules={[{ required: true, message: 'Please enter attribute label' }]}
                tooltip="Display name for users (e.g., 'Custom Size', 'Special Color')"
              >
                <Input placeholder="e.g., Custom Size, Special Color" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Attribute Type"
                rules={[{ required: true, message: 'Please select attribute type' }]}
              >
                <Select placeholder="Select type">
                  <Select.Option value="color">Color</Select.Option>
                  <Select.Option value="select">Dropdown</Select.Option>
                  <Select.Option value="text">Text</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12} />
          </Row>

          <Alert
            message="Tip"
            description="After adding the attribute, pick its values below in the Variant Values section."
            type="info"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  )
}

export default SmartAttributeSelector
