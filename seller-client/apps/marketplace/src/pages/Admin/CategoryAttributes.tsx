import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import type { AttributeConfig, CategoryAttributeSet } from '../../utils/categoryAttributes'
import { getAllCategorySets } from '../../utils/categoryAttributes'

const { Title, Text } = Typography
const { TextArea } = Input

const CategoryAttributes = () => {
  const [form] = Form.useForm()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingAttribute, setEditingAttribute] = useState<AttributeConfig | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  // This would normally come from an API
  const [categorySets] = useState<CategoryAttributeSet[]>(getAllCategorySets())

  const handleAddAttribute = () => {
    setEditingAttribute(null)
    setIsModalVisible(true)
  }

  const handleEditAttribute = (attribute: AttributeConfig) => {
    setEditingAttribute(attribute)
    setIsModalVisible(true)
  }

  const handleDeleteAttribute = (categoryId: string, attributeKey: string) => {
    // This would normally make an API call
    // categoryId and attributeKey are used for the API call
    void categoryId
    void attributeKey
    message.success('Attribute deleted successfully')
  }

  const handleModalOk = () => {
    form.validateFields().then(() => {
      // This would normally make an API call
      message.success(
        editingAttribute ? 'Attribute updated successfully' : 'Attribute added successfully',
      )
      setIsModalVisible(false)
      form.resetFields()
    })
  }

  const handleModalCancel = () => {
    setIsModalVisible(false)
    form.resetFields()
  }

  const columns = [
    {
      title: 'Attribute Name',
      dataIndex: 'label',
      key: 'label',
      render: (text: string, record: AttributeConfig) => (
        <Space>
          <Text strong>{text}</Text>
          <Tag color="blue">{record.key}</Tag>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => <Tag color="green">{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Required',
      dataIndex: 'required',
      key: 'required',
      render: (required: boolean) => (
        <Tag color={required ? 'red' : 'default'}>{required ? 'Required' : 'Optional'}</Tag>
      ),
    },
    {
      title: 'Options Count',
      dataIndex: 'options',
      key: 'options',
      render: (options: AttributeConfig['options']) => <Text>{options.length} options</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: AttributeConfig) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEditAttribute(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this attribute?"
            onConfirm={() => handleDeleteAttribute(selectedCategory, record.key)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card>
        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Category Attributes Management
            </Title>
            <Text type="secondary">Manage variant attributes for different product categories</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAttribute}>
            Add Attribute
          </Button>
        </div>

        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Form.Item label="Select Category">
              <Select
                placeholder="Choose a category"
                value={selectedCategory}
                onChange={setSelectedCategory}
                style={{ width: '100%' }}
              >
                {categorySets.map((set) => (
                  <Select.Option key={set.categoryId} value={set.categoryId}>
                    {set.categoryName}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {selectedCategory && (
          <Card
            title={`Attributes for ${
              categorySets.find((s) => s.categoryId === selectedCategory)?.categoryName
            }`}
          >
            <Table
              columns={columns}
              dataSource={
                categorySets.find((s) => s.categoryId === selectedCategory)?.attributes || []
              }
              rowKey="key"
              pagination={false}
            />
          </Card>
        )}

        {!selectedCategory && (
          <Card style={{ textAlign: 'center', padding: 48 }}>
            <Text type="secondary">Select a category to view and manage its attributes</Text>
          </Card>
        )}
      </Card>

      <Modal
        title={editingAttribute ? 'Edit Attribute' : 'Add New Attribute'}
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
                rules={[{ required: true, message: 'Please enter attribute key' }]}
              >
                <Input placeholder="e.g., size, color, material" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="label"
                label="Attribute Label"
                rules={[{ required: true, message: 'Please enter attribute label' }]}
              >
                <Input placeholder="e.g., Size, Color, Material" />
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
                  <Select.Option value="size">Size</Select.Option>
                  <Select.Option value="material">Material</Select.Option>
                  <Select.Option value="text">Text</Select.Option>
                  <Select.Option value="select">Select</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="required" label="Required" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="Describe this attribute" />
          </Form.Item>

          <Form.Item name="sortOrder" label="Sort Order">
            <Input type="number" placeholder="1" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CategoryAttributes
