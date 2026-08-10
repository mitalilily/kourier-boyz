import { EditOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Card, Input, Modal, Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  useCreateArticle,
  useDeleteArticle,
  useSupportArticles,
  useUpdateArticle,
  type SupportArticle,
} from '../api/support'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'
import { useModulePermissions } from '../hooks/useModulePermissions'
import RichTextEditor from '../components/RichTextEditor'

const SupportArticles = () => {
  const { modal } = App.useApp()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [publishedFilter, setPublishedFilter] = useState<string>('')
  const [editingArticle, setEditingArticle] = useState<SupportArticle | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const supportArticlesPermissions = useModulePermissions('supportArticles')

  const { data: articles = [], isLoading } = useSupportArticles({
    category: categoryFilter || undefined,
    published: publishedFilter || undefined,
    search: searchTerm || undefined,
  })

  const createMutation = useCreateArticle()
  const updateMutation = useUpdateArticle()
  const deleteMutation = useDeleteArticle()

  const handleSave = async (values: any) => {
    try {
      if (editingArticle) {
        await updateMutation.mutateAsync({
          id: editingArticle._id,
          ...values,
        })
        toast.success('Article updated successfully')
      } else {
        await createMutation.mutateAsync(values)
        toast.success('Article created successfully')
      }
      setIsModalOpen(false)
      setEditingArticle(null)
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save article')
    }
  }

  const handleEdit = (article: SupportArticle) => {
    setEditingArticle(article)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    modal.confirm({
      title: 'Delete Article',
      content: 'Are you sure you want to delete this article?',
      onOk: async () => {
        try {
          await deleteMutation.mutateAsync(id)
          toast.success('Article deleted successfully')
        } catch (error: any) {
          toast.error(error?.response?.data?.error || 'Failed to delete article')
        }
      },
    })
  }

  const columns: ColumnsType<SupportArticle> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: 'Views',
      dataIndex: 'views',
      key: 'views',
    },
    {
      title: 'Helpful',
      dataIndex: 'helpful',
      key: 'helpful',
    },
    {
      title: 'Published',
      dataIndex: 'published',
      key: 'published',
      render: (published: boolean) => (published ? 'Yes' : 'No'),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
    },
    ...(supportArticlesPermissions.canUpdate || supportArticlesPermissions.canDelete
      ? [
          {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: SupportArticle) => (
              <div className="flex space-x-2">
                <PermissionButton
                  module="supportArticles"
                  permission="update"
                  type="primary"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(record)}
                >
                  Edit
                </PermissionButton>
                <PermissionButton
                  module="supportArticles"
                  permission="delete"
                  danger
                  size="small"
                  onClick={() => handleDelete(record._id)}
                >
                  Delete
                </PermissionButton>
              </div>
            ),
          },
        ]
      : []),
  ]

  const categories = [
    'orders',
    'shipping',
    'returns',
    'payments',
    'account',
    'products',
    'other',
  ]

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Support Articles</h1>
        <PermissionGate module="supportArticles" permission="create">
          <PermissionButton
            module="supportArticles"
            permission="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingArticle(null)
              setIsModalOpen(true)
            }}
          >
            Create Article
          </PermissionButton>
        </PermissionGate>
      </div>

      <Card>
        <div className="mb-4 flex space-x-4">
          <Input
            placeholder="Search articles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            placeholder="Filter by Category"
            style={{ width: 200 }}
            allowClear
            value={categoryFilter || undefined}
            onChange={setCategoryFilter}
          >
            {categories.map((cat) => (
              <Select.Option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="Filter by Published"
            style={{ width: 200 }}
            allowClear
            value={publishedFilter || undefined}
            onChange={setPublishedFilter}
          >
            <Select.Option value="true">Published</Select.Option>
            <Select.Option value="false">Unpublished</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={articles}
          loading={isLoading}
          rowKey="_id"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editingArticle ? 'Edit Article' : 'Create Article'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setEditingArticle(null)
        }}
        footer={null}
        width={800}
      >
        <ArticleForm
          article={editingArticle}
          onSave={handleSave}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingArticle(null)
          }}
        />
      </Modal>
    </div>
  )
}

const ArticleForm = ({
  article,
  onSave,
  onCancel,
}: {
  article: SupportArticle | null
  onSave: (values: any) => void
  onCancel: () => void
}) => {
  const supportArticlesPermissions = useModulePermissions('supportArticles')
  const [title, setTitle] = useState(article?.title || '')
  const [content, setContent] = useState(article?.content || '')
  const [category, setCategory] = useState(article?.category || 'orders')
  const [tags, setTags] = useState(article?.tags?.join(', ') || '')
  const [published, setPublished] = useState(article?.published ?? true)
  const [priority, setPriority] = useState(article?.priority || 0)
  const isReadOnly = !supportArticlesPermissions.canUpdate && !supportArticlesPermissions.canCreate

  const handleSubmit = () => {
    if (!title || !content || !category) {
      toast.error('Please fill all required fields')
      return
    }
    onSave({
      title,
      content,
      category,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      published,
      priority: Number(priority),
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Title *</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title"
          disabled={isReadOnly}
          readOnly={isReadOnly}
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Category *</label>
        <Select
          value={category}
          onChange={setCategory}
          style={{ width: '100%' }}
          disabled={isReadOnly}
        >
          <Select.Option value="orders">Orders</Select.Option>
          <Select.Option value="shipping">Shipping</Select.Option>
          <Select.Option value="returns">Returns</Select.Option>
          <Select.Option value="payments">Payments</Select.Option>
          <Select.Option value="account">Account</Select.Option>
          <Select.Option value="products">Products</Select.Option>
          <Select.Option value="other">Other</Select.Option>
        </Select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Content *</label>
        <RichTextEditor value={content} onChange={setContent} readOnly={isReadOnly} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tag1, tag2, tag3"
          disabled={isReadOnly}
          readOnly={isReadOnly}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Priority</label>
          <Input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            disabled={isReadOnly}
            readOnly={isReadOnly}
          />
        </div>
        <div className="flex items-center pt-8">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="mr-2"
            disabled={isReadOnly}
          />
          <label>Published</label>
        </div>
      </div>
      <PermissionGate module="supportArticles" permission={['create', 'update']} requireAll={false}>
        <div className="flex justify-end space-x-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit}>
            Save
          </Button>
        </div>
      </PermissionGate>
    </div>
  )
}

export default SupportArticles

