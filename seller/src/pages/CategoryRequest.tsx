import { CheckCircleOutlined, ClockCircleOutlined, SendOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { isAxiosError } from 'axios'
import { useEffect, useState } from 'react'
import { getActiveCategories, type Category } from '../api/categories'
import { getMyCategoryRequests, submitCategoryRequest } from '../api/categoryRequests'
import HierarchicalCategorySelect from '../components/HierarchicalCategorySelect'
import { getAllCategorySets } from '../utils/categoryAttributes'

const { Title, Text } = Typography
const { TextArea } = Input

interface CategoryRequest {
  id: string
  categoryName: string
  categoryId: string
  description: string
  suggestedAttributes: string[]
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  adminNotes?: string
}

type CategoryRequestError = {
  error?: string
  message?: string
}

const CategoryRequest = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const cats = await getActiveCategories(true) // Include subcategories
        setCategories(cats)
      } catch (error) {
        console.error('Failed to fetch categories:', error)
      }
    }
    fetchCategories()
  }, [])

  const [requests, setRequests] = useState<CategoryRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)

  // Fetch category requests from API
  useEffect(() => {
    const fetchRequests = async () => {
      setLoadingRequests(true)
      try {
        const data = await getMyCategoryRequests()
        // Transform API data to match CategoryRequest interface
        const transformed = data.map((req) => ({
          id: req._id,
          categoryName: req.name,
          categoryId: req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          description: req.description || '',
          suggestedAttributes: [], // API doesn't return this yet
          status: req.status,
          createdAt: new Date(req.createdAt).toISOString().split('T')[0],
          adminNotes: req.adminNote,
        }))
        setRequests(transformed)
      } catch (error) {
        console.error('Failed to fetch category requests:', error)
        message.error('Failed to load category requests')
      } finally {
        setLoadingRequests(false)
      }
    }
    fetchRequests()
  }, [])

  const existingCategories = getAllCategorySets()

  const handleSubmitRequest = async (values: {
    categoryName: string
    description?: string
    parent?: string | null
    suggestedAttributes?: string[]
  }) => {
    setLoading(true)
    try {
      // Submit via API
      await submitCategoryRequest(values.categoryName, values.description, values.parent || null, {
        // Images can be added later if needed
      })

      // Refetch requests to show actual data from backend
      const data = await getMyCategoryRequests()
      const transformed = data.map((req) => ({
        id: req._id,
        categoryName: req.name,
        categoryId: req.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: req.description || '',
        suggestedAttributes: [],
        status: req.status,
        createdAt: new Date(req.createdAt).toISOString().split('T')[0],
        adminNotes: req.adminNote,
      }))
      setRequests(transformed)

      form.resetFields()
      message.success('Category request submitted successfully!')
    } catch (error: unknown) {
      console.error('Error submitting category request:', error)
      const errorMessage = isAxiosError<CategoryRequestError>(error)
        ? error.response?.data?.error ?? error.response?.data?.message ?? error.message
        : error instanceof Error
        ? error.message
        : 'Failed to submit request'
      message.error(errorMessage || 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  const requestColumns = [
    {
      title: 'Category Name',
      dataIndex: 'categoryName',
      key: 'categoryName',
      render: (text: string, record: CategoryRequest) => (
        <Space direction="vertical" size="small">
          <Space>
            <Text strong>{text}</Text>
            <Tag color="blue">{record.categoryId}</Tag>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'Suggested Attributes',
      dataIndex: 'suggestedAttributes',
      key: 'suggestedAttributes',
      render: (attributes: string[]) => (
        <Space wrap>
          {attributes.map((attr) => (
            <Tag key={attr} color="green">
              {attr}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          pending: { color: 'orange', icon: <ClockCircleOutlined />, text: 'Pending Review' },
          approved: { color: 'green', icon: <CheckCircleOutlined />, text: 'Approved' },
          rejected: { color: 'red', icon: <ClockCircleOutlined />, text: 'Rejected' },
        }
        const config = statusConfig[status as keyof typeof statusConfig]
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        )
      },
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => <Text type="secondary">{date}</Text>,
    },
  ]

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0, marginBottom: 8 }}>
            Request New Category
          </Title>
          <Text type="secondary">
            Don't see the category you need? Request a new one and we'll add it for you.
          </Text>
        </div>

        <Alert
          message="How it works"
          description="Submit a request for a new category with suggested attributes. Our admin team will review and approve it within 24-48 hours. Once approved, you can use the new category for your products."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form form={form} layout="vertical" onFinish={handleSubmitRequest}>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item
                name="categoryName"
                label="Category Name"
                rules={[{ required: true, message: 'Please enter category name' }]}
                tooltip="The display name for the category (e.g., 'Sports Equipment')"
              >
                <Input placeholder="e.g., Sports Equipment, Pet Supplies" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="parent"
            label="Parent Category (Optional)"
            tooltip="If this is a subcategory, select the parent category. Leave empty for a root category."
          >
            <HierarchicalCategorySelect
              categories={categories}
              placeholder="Select parent category (optional)"
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter description' }]}
            tooltip="Describe what products belong in this category"
          >
            <TextArea
              rows={3}
              placeholder="e.g., Equipment and accessories for various sports activities including team sports, individual sports, and fitness equipment."
            />
          </Form.Item>

          <Form.Item
            name="suggestedAttributes"
            label="Suggested Attributes"
            tooltip="What variant attributes would be useful for this category? (e.g., size, color, material)"
          >
            <Select
              mode="tags"
              placeholder="Type and press Enter to add attributes"
              style={{ width: '100%' }}
              tokenSeparators={[',']}
            >
              <Select.Option value="size">Size</Select.Option>
              <Select.Option value="color">Color</Select.Option>
              <Select.Option value="material">Material</Select.Option>
              <Select.Option value="brand">Brand</Select.Option>
              <Select.Option value="style">Style</Select.Option>
              <Select.Option value="weight">Weight</Select.Option>
              <Select.Option value="capacity">Capacity</Select.Option>
              <Select.Option value="age-group">Age Group</Select.Option>
              <Select.Option value="skill-level">Skill Level</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={loading}
              size="large"
            >
              Submit Request
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={3} style={{ marginBottom: 16 }}>
          My Category Requests
        </Title>

        {loadingRequests ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Text type="secondary">Loading...</Text>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Text type="secondary">No category requests yet</Text>
          </div>
        ) : (
          <Table
            columns={requestColumns}
            dataSource={requests}
            rowKey="id"
            loading={loadingRequests}
            pagination={false}
            expandable={{
              expandedRowRender: (record) => (
                <div>
                  {record.adminNotes && (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong>Admin Notes:</Text>
                      <br />
                      <Text type="secondary">{record.adminNotes}</Text>
                    </div>
                  )}
                  <Text type="secondary">
                    <strong>Request ID:</strong> {record.id}
                  </Text>
                </div>
              ),
            }}
          />
        )}
      </Card>

      <Card style={{ marginTop: 24 }}>
        <Title level={3} style={{ marginBottom: 16 }}>
          Available Categories
        </Title>
        <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
          These are the categories currently available for your products:
        </Text>
        <Space wrap>
          {existingCategories.map((category) => (
            <Tag key={category.categoryId} color="blue">
              {category.categoryName}
            </Tag>
          ))}
        </Space>
      </Card>
    </div>
  )
}

export default CategoryRequest
