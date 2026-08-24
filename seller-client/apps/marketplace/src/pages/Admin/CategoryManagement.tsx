import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import {
  Alert,
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
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { updateCategorySuggestedAttributes } from '../../api/categories'
import type { AttributeConfig, CategoryAttributeSet } from '../../utils/categoryAttributes'
import { CATEGORY_ATTRIBUTE_SETS, GENERAL_ATTRIBUTES } from '../../utils/categoryAttributes'

const { Title, Text } = Typography
const { TextArea } = Input

const CategoryManagement = () => {
  const [form] = Form.useForm()
  const [attributeForm] = Form.useForm()
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false)
  const [isAttributeModalVisible, setIsAttributeModalVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryAttributeSet | null>(null)
  const [editingAttribute, setEditingAttribute] = useState<AttributeConfig | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [activeTab, setActiveTab] = useState('categories')

  // This would normally come from an API
  const [categorySets] = useState<CategoryAttributeSet[]>(CATEGORY_ATTRIBUTE_SETS)

  const handleAddCategory = () => {
    setEditingCategory(null)
    form.resetFields()
    setIsCategoryModalVisible(true)
  }

  const handleEditCategory = (category: CategoryAttributeSet) => {
    setEditingCategory(category)
    form.setFieldsValue({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
    })
    setIsCategoryModalVisible(true)
  }

  const handleDeleteCategory = (categoryId: string) => {
    // This would normally make an API call
    // categoryId is used for the API call
    void categoryId
    message.success('Category deleted successfully')
  }

  const handleAddAttribute = () => {
    if (!selectedCategory) {
      message.warning('Please select a category first')
      return
    }
    setEditingAttribute(null)
    attributeForm.resetFields()
    setIsAttributeModalVisible(true)
  }

  const handleEditAttribute = (attribute: AttributeConfig) => {
    setEditingAttribute(attribute)
    attributeForm.setFieldsValue({
      key: attribute.key,
      label: attribute.label,
      type: attribute.type,
      required: attribute.required,
      description: attribute.description,
      sortOrder: attribute.sortOrder,
    })
    setIsAttributeModalVisible(true)
  }

  const handleDeleteAttribute = (categoryId: string, attributeKey: string) => {
    // This would normally make an API call
    // categoryId and attributeKey are used for the API call
    void categoryId
    void attributeKey
    message.success('Attribute deleted successfully')
  }

  const handleCategoryModalOk = () => {
    form.validateFields().then(async (values) => {
      try {
        // Persist suggestedAttributes only when editing an existing category
        if (editingCategory && values.suggestedAttributes) {
          await updateCategorySuggestedAttributes(
            editingCategory.categoryId,
            values.suggestedAttributes,
          )
        }
        message.success(
          editingCategory ? 'Category updated successfully' : 'Category created successfully',
        )
        setIsCategoryModalVisible(false)
        form.resetFields()
      } catch {
        message.error('Failed to save category suggestions')
      }
    })
  }

  const handleAttributeModalOk = () => {
    attributeForm.validateFields().then(() => {
      // This would normally make an API call
      message.success(
        editingAttribute ? 'Attribute updated successfully' : 'Attribute added successfully',
      )
      setIsAttributeModalVisible(false)
      attributeForm.resetFields()
    })
  }

  const categoryColumns = [
    {
      title: 'Category Name',
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (text: string, record: CategoryAttributeSet) => (
        <Space>
          <Text strong>{text}</Text>
          <Tag color="blue">{record.categoryId}</Tag>
        </Space>
      ),
    },
    {
      title: 'Attributes Count',
      dataIndex: 'attributes',
      key: 'attributes',
      render: (attributes: AttributeConfig[]) => <Text>{attributes.length} attributes</Text>,
    },
    {
      title: 'Required Attributes',
      dataIndex: 'attributes',
      key: 'required',
      render: (attributes: AttributeConfig[]) => {
        const requiredCount = attributes.filter((attr) => attr.required).length
        return <Tag color="red">{requiredCount} required</Tag>
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: CategoryAttributeSet) => (
        <Space>
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => {
              setSelectedCategory(record.categoryId)
              setActiveTab('attributes')
            }}
          >
            Manage Attributes
          </Button>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEditCategory(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Are you sure you want to delete this category?"
            onConfirm={() => handleDeleteCategory(record.categoryId)}
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

  const attributeColumns = [
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

  const selectedCategoryData = categorySets.find((s) => s.categoryId === selectedCategory)

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
              Category & Attributes Management
            </Title>
            <Text type="secondary">Manage product categories and their variant attributes</Text>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory}>
            Add Category
          </Button>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <Tabs.TabPane tab="Categories" key="categories">
            <Table
              columns={categoryColumns}
              dataSource={categorySets}
              rowKey="categoryId"
              pagination={false}
            />
          </Tabs.TabPane>

          <Tabs.TabPane tab="Attributes" key="attributes">
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
              <Col span={8}>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={handleAddAttribute}
                  disabled={!selectedCategory}
                >
                  Add Attribute
                </Button>
              </Col>
            </Row>

            {selectedCategory && selectedCategoryData && (
              <Card title={`Attributes for ${selectedCategoryData.categoryName}`}>
                <Table
                  columns={attributeColumns}
                  dataSource={selectedCategoryData.attributes}
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
          </Tabs.TabPane>
        </Tabs>
      </Card>

      {/* Add/Edit Category Modal */}
      <Modal
        title={editingCategory ? 'Edit Category' : 'Add New Category'}
        open={isCategoryModalVisible}
        onOk={handleCategoryModalOk}
        onCancel={() => setIsCategoryModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="categoryId"
                label="Category ID"
                rules={[
                  { required: true, message: 'Please enter category ID' },
                  {
                    pattern: /^[a-z0-9-]+$/,
                    message: 'Only lowercase letters, numbers, and hyphens allowed',
                  },
                ]}
                tooltip="Used internally (e.g., 'clothing', 'electronics')"
              >
                <Input placeholder="e.g., clothing, electronics" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="categoryName"
                label="Category Name"
                rules={[{ required: true, message: 'Please enter category name' }]}
                tooltip="Display name for users (e.g., 'Clothing & Apparel', 'Electronics')"
              >
                <Input placeholder="e.g., Clothing & Apparel" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="suggestedAttributes"
            label="Suggested Attributes"
            tooltip="Recommend attributes for this category (e.g., size, color, material)"
          >
            <Select
              mode="tags"
              placeholder="Type to add or pick from suggestions"
              style={{ width: '100%' }}
              tokenSeparators={[',']}
              options={GENERAL_ATTRIBUTES.map((a) => ({ label: a.label, value: a.key }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Add/Edit Attribute Modal */}
      <Modal
        title={editingAttribute ? 'Edit Attribute' : 'Add New Attribute'}
        open={isAttributeModalVisible}
        onOk={handleAttributeModalOk}
        onCancel={() => setIsAttributeModalVisible(false)}
        width={600}
      >
        <Form form={attributeForm} layout="vertical">
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
                tooltip="Used internally (e.g., 'size', 'color', 'material')"
              >
                <Input placeholder="e.g., size, color, material" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="label"
                label="Attribute Label"
                rules={[{ required: true, message: 'Please enter attribute label' }]}
                tooltip="Display name for users (e.g., 'Size', 'Color', 'Material')"
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
                  <Select.Option value="color">Color Picker</Select.Option>
                  <Select.Option value="size">Size Selector</Select.Option>
                  <Select.Option value="material">Material Selector</Select.Option>
                  <Select.Option value="text">Text Input</Select.Option>
                  <Select.Option value="select">Dropdown Select</Select.Option>
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
            <TextArea rows={3} placeholder="Describe this attribute (optional)" />
          </Form.Item>

          <Form.Item name="sortOrder" label="Sort Order">
            <Input type="number" placeholder="1" />
          </Form.Item>

          <Alert
            message="Next Step"
            description="After creating the attribute, you'll be able to add specific options/values for it."
            type="info"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  )
}

export default CategoryManagement
