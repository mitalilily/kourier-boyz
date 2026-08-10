import { MessageOutlined, UserOutlined } from '@ant-design/icons'
import { App, Badge, Button, Card, Input, Modal, Select, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useContactForm,
  useContactForms,
  useRespondToContactForm,
  useUpdateContactFormStatus,
  type ContactForm,
} from '../api/support'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'
import { useModulePermissions } from '../hooks/useModulePermissions'

const ContactForms = () => {
  const { modal } = App.useApp()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [selectedForm, setSelectedForm] = useState<string | null>(null)
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false)
  const [responseText, setResponseText] = useState('')
  const contactFormsPermissions = useModulePermissions('contactForms')

  const { data: forms = [], isLoading } = useContactForms({
    status: statusFilter,
    category: categoryFilter,
  })

  const { data: formDetail } = useContactForm(selectedForm || '')

  const updateStatusMutation = useUpdateContactFormStatus()
  const respondMutation = useRespondToContactForm()

  const handleStatusUpdate = (id: string, status: string) => {
    updateStatusMutation.mutate(
      { id, status },
      {
        onSuccess: () => {
          toast.success('Status updated successfully')
        },
        onError: () => {
          toast.error('Failed to update status')
        },
      },
    )
  }

  const handleRespond = (id: string) => {
    setSelectedForm(id)
    setIsResponseModalOpen(true)
  }

  const handleSubmitResponse = () => {
    if (!responseText.trim()) {
      toast.error('Response cannot be empty')
      return
    }

    respondMutation.mutate(
      { id: selectedForm!, response: responseText },
      {
        onSuccess: () => {
          toast.success('Response sent successfully')
          setIsResponseModalOpen(false)
          setResponseText('')
          setSelectedForm(null)
        },
        onError: () => {
          toast.error('Failed to send response')
        },
      },
    )
  }

  const columns: ColumnsType<ContactForm> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ContactForm) => (
        <div>
          <div className="font-semibold">{name}</div>
          {record.customerId && (
            <Link
              to={`/customers/${record.customerId._id}`}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
            >
              <UserOutlined />
              View Customer
            </Link>
          )}
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <span className="capitalize">{category}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          new: 'error',
          'in-progress': 'processing',
          resolved: 'success',
          closed: 'default',
        }
        return <Badge status={colorMap[status] as any} text={status} />
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    ...(contactFormsPermissions.canView || contactFormsPermissions.canUpdate
      ? [
          {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: ContactForm) => (
              <div className="flex space-x-2">
                <Button
                  size="small"
                  onClick={() => {
                    setSelectedForm(record._id)
                    modal.info({
                      title: 'Contact Form Details',
                      width: 600,
                      content: (
                        <div className="space-y-4">
                          <div>
                            <strong>Name:</strong> {record.name}
                          </div>
                          <div>
                            <strong>Email:</strong> {record.email}
                          </div>
                          {record.phone && (
                            <div>
                              <strong>Phone:</strong> {record.phone}
                            </div>
                          )}
                          {record.customerId && (
                            <div>
                              <strong>Customer:</strong>{' '}
                              <Link
                                to={`/customers/${record.customerId._id}`}
                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 inline-flex"
                              >
                                <UserOutlined />
                                {record.customerId.name} ({record.customerId.email})
                              </Link>
                            </div>
                          )}
                          <div>
                            <strong>Subject:</strong> {record.subject}
                          </div>
                          <div>
                            <strong>Category:</strong> {record.category}
                          </div>
                          <div>
                            <strong>Message:</strong>
                            <div className="mt-2 p-4 bg-gray-50 rounded">{record.message}</div>
                          </div>
                          {record.response && (
                            <div>
                              <strong>Response:</strong>
                              <div className="mt-2 p-4 bg-blue-50 rounded">{record.response}</div>
                            </div>
                          )}
                        </div>
                      ),
                    })
                  }}
                >
                  View
                </Button>
                <PermissionGate module="contactForms" permission="update">
                  {record.status !== 'resolved' && (
                    <PermissionButton
                      module="contactForms"
                      permission="update"
                      type="primary"
                      size="small"
                      icon={<MessageOutlined />}
                      onClick={() => handleRespond(record._id)}
                    >
                      Respond
                    </PermissionButton>
                  )}
                  <Select
                    size="small"
                    value={record.status}
                    onChange={(value) => handleStatusUpdate(record._id, value)}
                    style={{ width: 120 }}
                  >
                    <Select.Option value="new">New</Select.Option>
                    <Select.Option value="in-progress">In Progress</Select.Option>
                    <Select.Option value="resolved">Resolved</Select.Option>
                    <Select.Option value="closed">Closed</Select.Option>
                  </Select>
                </PermissionGate>
              </div>
            ),
          },
        ]
      : []),
  ]

  const stats = {
    total: forms.length,
    new: forms.filter((f) => f.status === 'new').length,
    inProgress: forms.filter((f) => f.status === 'in-progress').length,
    resolved: forms.filter((f) => f.status === 'resolved').length,
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Contact Forms</h1>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Card>
            <div className="text-gray-500 text-sm">Total Forms</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card>
            <div className="text-gray-500 text-sm">New</div>
            <div className="text-2xl font-bold text-red-600">{stats.new}</div>
          </Card>
          <Card>
            <div className="text-gray-500 text-sm">In Progress</div>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
          </Card>
          <Card>
            <div className="text-gray-500 text-sm">Resolved</div>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </Card>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex space-x-4">
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: 300 }}
          />
          <Select
            placeholder="Filter by Status"
            style={{ width: 200 }}
            allowClear
            value={statusFilter || undefined}
            onChange={setStatusFilter}
          >
            <Select.Option value="new">New</Select.Option>
            <Select.Option value="in-progress">In Progress</Select.Option>
            <Select.Option value="resolved">Resolved</Select.Option>
            <Select.Option value="closed">Closed</Select.Option>
          </Select>
          <Select
            placeholder="Filter by Category"
            style={{ width: 200 }}
            allowClear
            value={categoryFilter || undefined}
            onChange={setCategoryFilter}
          >
            <Select.Option value="general">General</Select.Option>
            <Select.Option value="order">Order</Select.Option>
            <Select.Option value="refund">Refund</Select.Option>
            <Select.Option value="product">Product</Select.Option>
            <Select.Option value="account">Account</Select.Option>
            <Select.Option value="technical">Technical</Select.Option>
            <Select.Option value="feedback">Feedback</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={forms}
          loading={isLoading}
          rowKey="_id"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="Respond to Contact Form"
        open={isResponseModalOpen}
        onOk={handleSubmitResponse}
        onCancel={() => {
          setIsResponseModalOpen(false)
          setResponseText('')
          setSelectedForm(null)
        }}
        width={600}
        okButtonProps={{
          style: { display: contactFormsPermissions.canUpdate ? 'block' : 'none' },
        }}
        cancelText={contactFormsPermissions.canUpdate ? 'Cancel' : 'Close'}
      >
        {formDetail && (
          <div className="space-y-4">
            <div>
              <strong>From:</strong> {formDetail.name} ({formDetail.email})
            </div>
            <div>
              <strong>Subject:</strong> {formDetail.subject}
            </div>
            <div>
              <strong>Message:</strong>
              <div className="mt-2 p-4 bg-gray-50 rounded">{formDetail.message}</div>
            </div>
            <PermissionGate module="contactForms" permission="update">
              <div>
                <label className="block text-sm font-medium mb-2">Your Response *</label>
                <Input.TextArea
                  rows={6}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response here..."
                />
              </div>
            </PermissionGate>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default ContactForms

