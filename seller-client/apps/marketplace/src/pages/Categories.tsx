import { PlusOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tabs,
  Tag,
  Upload,
} from 'antd'
import type { RcFile, UploadFile } from 'antd/es/upload/interface'
import { useEffect, useMemo, useState } from 'react'
import { getActiveCategories, getCategories, type Category } from '../api/categories'
import { useAuthStore } from '../store/authStore'
import { getMyCategoryRequests, submitCategoryRequest } from '../api/categoryRequests'
import HierarchicalCategorySelect from '../components/HierarchicalCategorySelect'

type Cat = { _id: string; name: string; status: 'active' | 'inactive' }

const SellerCategories = () => {
  const { message } = App.useApp()
  const user = useAuthStore((state) => state.user)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Cat[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [requests, setRequests] = useState<
    Array<{
      _id: string
      name: string
      description?: string
      status: 'pending' | 'approved' | 'rejected'
      adminNote?: string
      parent?: { _id: string; name: string; slug: string } | string | null
      createdAt: string
    }>
  >([])
  const [search, setSearch] = useState('')
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()
  const [mainImageFile, setMainImageFile] = useState<UploadFile<RcFile>[]>([])
  const [hoverImageFile, setHoverImageFile] = useState<UploadFile<RcFile>[]>([])
  const [bannerFiles, setBannerFiles] = useState<UploadFile<RcFile>[]>([])

  const load = async () => {
    setLoading(true)
    try {
      const [data, allCats, reqs] = await Promise.allSettled([
        getCategories(),
        getActiveCategories(true),
        getMyCategoryRequests(),
      ])

      // Handle categories
      if (data.status === 'fulfilled') {
        setCategories(
          data.value.map((c: { _id: string; name: string; status: 'active' | 'inactive' }) => ({
            _id: c._id,
            name: c.name,
            status: c.status,
          })),
        )
      } else {
        console.error('Failed to load categories:', data.reason)
        message.error(data.reason?.message || 'Failed to load categories')
      }

      // Handle all categories for parent selector
      if (allCats.status === 'fulfilled') {
        setAllCategories(allCats.value)
      } else {
        console.error('Failed to load active categories:', allCats.reason)
        // Don't show error if it's just for parent selector
      }

      // Handle category requests
      if (reqs.status === 'fulfilled') {
        const data = reqs.value
        setRequests(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to load category requests:', reqs.reason)
        // Don't show error for requests
      }
    } catch (error) {
      console.error('Unexpected error loading data:', error)
      message.error('Failed to load categories. Please refresh the page.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columns = useMemo(
    () => [
      { title: 'Name', dataIndex: 'name', key: 'name' },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (s: Cat['status']) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag>,
      },
    ],
    [],
  )

  const filtered = useMemo(
    () =>
      categories.filter((c) =>
        search.trim() ? c.name.toLowerCase().includes(search.trim().toLowerCase()) : true,
      ),
    [categories, search],
  )

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  const beforeUpload = () => false

  const uploadButton = (label: string) => (
    <div className="flex flex-col items-center justify-center">
      <PlusOutlined className="text-2xl text-gray-400" />
      <span className="text-sm text-gray-500 mt-2">{label}</span>
    </div>
  )

  const handleModalClose = () => {
    setRequestModalOpen(false)
    form.resetFields()
    setMainImageFile([])
    setHoverImageFile([])
    setBannerFiles([])
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="Categories"
        extra={
          <Button
            data-tour="request-category-btn"
            onClick={() => {
              if (!user?.isApproved) {
                message.warning('Your KYC must be approved before requesting new categories.')
                return
              }
              setRequestModalOpen(true)
            }}
            disabled={!user?.isApproved}
          >
            Request new category
          </Button>
        }
      >
        <Tabs
          defaultActiveKey="categories"
          items={[
            {
              key: 'categories',
              label: 'Categories',
              children: (
                <div>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Input
                        placeholder="Search categories"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </Col>
                  </Row>
                  <Table
                    rowKey="_id"
                    dataSource={filtered}
                    loading={loading}
                    columns={columns}
                    pagination={{ pageSize: 10 }}
                  />
                </div>
              ),
            },
            {
              key: 'requests',
              label: 'My Requests',
              children: (
                <Table
                  rowKey="_id"
                  dataSource={requests}
                  loading={loading}
                  columns={[
                    { title: 'Name', dataIndex: 'name', key: 'name' },
                    {
                      title: 'Parent Category',
                      key: 'parent',
                      render: (
                        _: unknown,
                        r: {
                          parent?: { _id: string; name: string; slug: string } | string | null
                        },
                      ) => {
                        const parent = r.parent
                          ? typeof r.parent === 'string'
                            ? null
                            : r.parent
                          : null
                        return parent ? (
                          <Tag color="blue">
                            {parent.name} ({parent.slug})
                          </Tag>
                        ) : (
                          <Tag color="default">Root Category</Tag>
                        )
                      },
                    },
                    { title: 'Description', dataIndex: 'description', key: 'description' },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      key: 'status',
                      render: (s: 'pending' | 'approved' | 'rejected') => (
                        <Tag color={s === 'pending' ? 'gold' : s === 'approved' ? 'green' : 'red'}>
                          {s}
                        </Tag>
                      ),
                    },
                    { title: 'Admin Note', dataIndex: 'adminNote', key: 'adminNote' },
                    {
                      title: 'Created',
                      dataIndex: 'createdAt',
                      key: 'createdAt',
                      render: (d: string) => formatDateTime(d),
                    },
                  ]}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Request New Category"
        open={requestModalOpen}
        onCancel={handleModalClose}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Submit Request"
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values: {
            name: string
            description?: string
            parent?: string | null
          }) => {
            try {
              setSubmitting(true)

              const suggestedImages = {
                mainImage: mainImageFile[0]?.originFileObj,
                hoverImage: hoverImageFile[0]?.originFileObj,
                banners: bannerFiles.map((f) => f.originFileObj).filter(Boolean) as File[],
              }

              await submitCategoryRequest(
                values.name,
                values.description,
                values.parent || null,
                suggestedImages,
              )
              message.success('Request submitted to admin')
              handleModalClose()
              await load()
            } catch (e: unknown) {
              const err = e as { response?: { data?: { error?: string } } }
              message.error(err.response?.data?.error || 'Failed to submit request')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <Form.Item
            name="name"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter a category name' }]}
          >
            <Input placeholder="e.g. Smartwatches" />
          </Form.Item>
          <Form.Item
            name="parent"
            label="Parent Category (Optional)"
            tooltip="If this is a subcategory, select the parent category. Leave empty for a root category."
          >
            <HierarchicalCategorySelect
              categories={allCategories}
              placeholder="Select parent category (optional)"
              allowClear
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={3} placeholder="Brief justification or details" />
          </Form.Item>

          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Suggested Images (Optional)</h4>
            <p style={{ color: '#666', fontSize: '12px', marginBottom: 16 }}>
              Help the admin by suggesting images for this category
            </p>

            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    Main Image
                  </label>
                  <Upload
                    listType="picture-card"
                    fileList={mainImageFile}
                    onChange={({ fileList }) => setMainImageFile(fileList.slice(-1))}
                    beforeUpload={beforeUpload}
                    accept="image/*"
                  >
                    {mainImageFile.length >= 1 ? null : uploadButton('Upload')}
                  </Upload>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                    Hover Image
                  </label>
                  <Upload
                    listType="picture-card"
                    fileList={hoverImageFile}
                    onChange={({ fileList }) => setHoverImageFile(fileList.slice(-1))}
                    beforeUpload={beforeUpload}
                    accept="image/*"
                  >
                    {hoverImageFile.length >= 1 ? null : uploadButton('Upload')}
                  </Upload>
                </div>
              </Col>
            </Row>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                Banner Images (up to 5)
              </label>
              <Upload
                listType="picture-card"
                multiple
                fileList={bannerFiles}
                onChange={({ fileList }) => setBannerFiles(fileList.slice(0, 5))}
                beforeUpload={beforeUpload}
                accept="image/*"
              >
                {bannerFiles.length >= 5 ? null : uploadButton('Add Banner')}
              </Upload>
            </div>
          </div>
        </Form>
      </Modal>
    </Space>
  )
}

export default SellerCategories
