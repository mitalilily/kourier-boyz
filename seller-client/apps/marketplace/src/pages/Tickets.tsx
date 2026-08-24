import {
  ClockCircleOutlined,
  CloseCircleOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  SendOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useCreateSellerTicket,
  useMarkTicketMessagesAsRead,
  useSellerTicket,
  useSellerTickets,
  useSendTicketMessage,
  useUpdateTicketStatus,
  useUploadTicketAttachments,
  type Ticket,
} from '../api/tickets'

const { Title, Text } = Typography
const { TextArea } = Input

const Tickets = () => {
  const { message: antdMessage } = App.useApp()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [form] = Form.useForm()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { data: tickets = [], isLoading } = useSellerTickets({
    status: statusFilter || undefined,
  })

  const { data: ticketData, isLoading: isLoadingTicket } = useSellerTicket(selectedTicketId || '')
  const sendMessageMutation = useSendTicketMessage()
  const markAsReadMutation = useMarkTicketMessagesAsRead()
  const createTicketMutation = useCreateSellerTicket()
  const updateStatusMutation = useUpdateTicketStatus()
  const uploadAttachmentsMutation = useUploadTicketAttachments()
  const [attachmentFiles, setAttachmentFiles] = useState<UploadFile[]>([])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticketData?.messages])

  useEffect(() => {
    if (selectedTicketId && ticketData?.messages) {
      // Mark unread messages as read
      const unreadMessages = ticketData.messages.filter(
        (msg) => !msg.read && msg.senderRole !== 'seller',
      )
      if (unreadMessages.length > 0) {
        markAsReadMutation.mutate(selectedTicketId)
      }
    }
  }, [selectedTicketId, ticketData?.messages, markAsReadMutation])

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId)
  }

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && attachmentFiles.length === 0) || !selectedTicketId) return

    if (ticketData?.ticket.status === 'closed') {
      antdMessage.error('Ticket is closed. You cannot send messages to closed tickets.')
      return
    }

    try {
      let attachmentUrls: string[] = []

      // Upload attachments if any
      if (attachmentFiles.length > 0) {
        // Extract File objects from UploadFile array
        const files: File[] = []
        for (const uploadFile of attachmentFiles) {
          // originFileObj should contain the actual File when beforeUpload returns false
          if (uploadFile.originFileObj instanceof File) {
            files.push(uploadFile.originFileObj)
          } else if (uploadFile instanceof File) {
            // Fallback: if UploadFile itself is a File (shouldn't happen, but just in case)
            files.push(uploadFile)
          }
        }

        if (files.length === 0) {
          antdMessage.error('No valid files to upload')
          return
        }

        const uploadResult = await uploadAttachmentsMutation.mutateAsync(files)
        attachmentUrls = uploadResult.urls || []
      }

      await sendMessageMutation.mutateAsync({
        id: selectedTicketId,
        message: newMessage.trim() || '',
        attachments: attachmentUrls,
      })
      setNewMessage('')
      setAttachmentFiles([])
    } catch (error) {
      console.error('Error sending message:', error)
      antdMessage.error('Failed to send message')
    }
  }

  const handleCreateTicket = async (values: {
    subject: string
    category: string
    description: string
    priority?: string
    orderId?: string
    ledgerEntryId?: string
    settlementBatchId?: string
    refundRequestId?: string
  }) => {
    try {
      await createTicketMutation.mutateAsync(values)
      antdMessage.success('Ticket created successfully')
      setCreateModalOpen(false)
      form.resetFields()
    } catch (error) {
      console.error('Error creating ticket:', error)
      antdMessage.error('Failed to create ticket')
    }
  }

  const handleCloseTicket = (ticketId: string) => {
    updateStatusMutation.mutate(
      { id: ticketId, status: 'closed' },
      {
        onSuccess: () => {
          antdMessage.success('Ticket closed')
        },
        onError: () => {
          antdMessage.error('Failed to close ticket')
        },
      },
    )
  }

  const formatTime = (dateString: string) => {
    const date = dayjs(dateString)
    const now = dayjs()
    const diffMinutes = now.diff(date, 'minute')

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`
    return date.format('DD MMM YYYY, HH:mm')
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      order: 'blue',
      refund: 'orange',
      settlement: 'green',
      ledger: 'purple',
      payout: 'cyan',
      product: 'geekblue',
      account: 'magenta',
      shipping: 'lime',
      payment: 'gold',
      technical: 'red',
      other: 'default',
    }
    return colors[category] || 'default'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'red',
      high: 'orange',
      medium: 'blue',
      low: 'default',
    }
    return colors[priority] || 'default'
  }

  const columns: ColumnsType<Ticket> = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      render: (text: string) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color={getCategoryColor(category)}>{category.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>{priority.toUpperCase()}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          open: 'default',
          'in-progress': 'processing',
          resolved: 'success',
          closed: 'default',
        }
        return (
          <Badge status={colorMap[status] as 'default' | 'processing' | 'success'} text={status} />
        )
      },
    },
    {
      title: 'Assigned To',
      dataIndex: ['assignedTo', 'name'],
      key: 'assignedTo',
      render: (name: string) =>
        name ? <Text>{name}</Text> : <Text type="secondary">Unassigned</Text>,
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivityAt',
      key: 'lastActivityAt',
      render: (date: string) => (date ? formatTime(date) : '-'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: Ticket) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<MessageOutlined />}
            onClick={() => handleOpenTicket(record._id)}
          >
            View
          </Button>
        </Space>
      ),
    },
  ]

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    'in-progress': tickets.filter((t) => t.status === 'in-progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
  }

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between">
        <Title level={4} className="mb-0">
          <QuestionCircleOutlined style={{ marginRight: 8 }} />
          Support Tickets
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          Create Ticket
        </Button>
      </div>

      <Alert
        message="Response Time Expectation"
        description={
          <div>
            <Text>
              Our support team typically responds to tickets within <strong>24-48 hours</strong>{' '}
              during business days. You will receive updates via email when your ticket receives a
              response or status change.
            </Text>
          </div>
        }
        type="info"
        icon={<ClockCircleOutlined />}
        showIcon
        closable
      />

      <div className="grid grid-cols-5 gap-4">
        <Card>
          <div className="text-gray-500 text-sm">Total Tickets</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card>
          <div className="text-gray-500 text-sm">Open</div>
          <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
        </Card>
        <Card>
          <div className="text-gray-500 text-sm">In Progress</div>
          <div className="text-2xl font-bold text-yellow-600">{stats['in-progress']}</div>
        </Card>
        <Card>
          <div className="text-gray-500 text-sm">Resolved</div>
          <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
        </Card>
        <Card>
          <div className="text-gray-500 text-sm">Closed</div>
          <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
        </Card>
      </div>

      <Card>
        <div className="mb-4">
          <Select
            placeholder="Filter by Status"
            style={{ width: 200 }}
            allowClear
            value={statusFilter || undefined}
            onChange={setStatusFilter}
          >
            <Select.Option value="open">Open</Select.Option>
            <Select.Option value="in-progress">In Progress</Select.Option>
            <Select.Option value="resolved">Resolved</Select.Option>
            <Select.Option value="closed">Closed</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={tickets}
          loading={isLoading}
          rowKey="_id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
          onRow={(record) => ({
            onClick: () => handleOpenTicket(record._id),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* Ticket Detail Modal */}
      <Modal
        title={
          ticketData ? (
            <div>
              <div className="font-semibold">{ticketData.ticket.subject}</div>
              <div className="text-sm text-gray-500 mt-1">
                Ticket #{ticketData.ticket.ticketNumber}
              </div>
            </div>
          ) : (
            'Ticket'
          )
        }
        open={!!selectedTicketId}
        onCancel={() => {
          setSelectedTicketId(null)
          setNewMessage('')
          setAttachmentFiles([])
        }}
        footer={null}
        width={900}
        style={{ top: 20 }}
        bodyStyle={{
          height: '70vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        }}
      >
        {isLoadingTicket ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading ticket...</p>
            </div>
          </div>
        ) : ticketData ? (
          <div className="flex flex-col h-full">
            {/* Ticket Header */}
            <div className="border-b p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <Badge
                    status={
                      ticketData.ticket.status === 'open' ||
                      ticketData.ticket.status === 'in-progress'
                        ? 'processing'
                        : 'default'
                    }
                    text={ticketData.ticket.status}
                  />
                  <Tag className="ml-2" color={getPriorityColor(ticketData.ticket.priority)}>
                    {ticketData.ticket.priority}
                  </Tag>
                  <Tag className="ml-2" color={getCategoryColor(ticketData.ticket.category)}>
                    {ticketData.ticket.category}
                  </Tag>
                  {ticketData.ticket.assignedTo && (
                    <span className="ml-4 text-sm text-gray-600">
                      Assigned to: {ticketData.ticket.assignedTo.name}
                    </span>
                  )}
                </div>
                {ticketData.ticket.status !== 'closed' && (
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={() => handleCloseTicket(ticketData.ticket._id)}
                  >
                    Close Ticket
                  </Button>
                )}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <p>
                  <strong>Description:</strong> {ticketData.ticket.description}
                </p>
                {ticketData.ticket.orderId && typeof ticketData.ticket.orderId === 'object' && (
                  <p className="mt-1">
                    <strong>Related Order:</strong>{' '}
                    <Link to={`/orders/${ticketData.ticket.orderId._id}`} target="_blank">
                      {ticketData.ticket.orderId.orderNumber || ticketData.ticket.orderId._id}
                    </Link>
                  </p>
                )}
                {ticketData.ticket.settlementBatchId &&
                  typeof ticketData.ticket.settlementBatchId === 'object' && (
                    <p className="mt-1">
                      <strong>Related Settlement:</strong>{' '}
                      <Link
                        to={`/settlements/${ticketData.ticket.settlementBatchId._id}`}
                        target="_blank"
                      >
                        {dayjs(ticketData.ticket.settlementBatchId.fromDate).format('DD MMM')} -{' '}
                        {dayjs(ticketData.ticket.settlementBatchId.toDate).format('DD MMM YYYY')}
                      </Link>
                    </p>
                  )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {ticketData.messages.map((msg) => {
                const isSeller = msg.senderRole === 'seller'
                const isAdmin = msg.senderRole === 'super-admin' || msg.senderRole === 'support'
                const isSystem = msg.isSystemMessage
                return (
                  <div
                    key={msg._id}
                    className={`flex ${isSeller ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        isSeller
                          ? 'bg-blue-600 text-white'
                          : isSystem
                          ? 'bg-yellow-50 border border-yellow-200 text-gray-900'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {isSystem && (
                        <div className="text-xs font-semibold mb-1 text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                          🔔 System Message (Informational Only)
                        </div>
                      )}
                      <div className="text-xs font-semibold mb-1 opacity-80">
                        {isSystem ? 'System' : msg.senderId.name}
                        {isAdmin && !isSystem && ' (Admin)'}
                      </div>
                      {msg.message && (
                        <div
                          className={`text-sm whitespace-pre-wrap ${
                            isSystem ? 'text-gray-800' : ''
                          }`}
                        >
                          {msg.message}
                        </div>
                      )}
                      {isSystem && (
                        <div className="text-xs text-gray-600 mt-2 italic">
                          This is an informational system notification. You can reply to this ticket
                          using the message box below if needed.
                        </div>
                      )}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {msg.attachments.map((url, idx) => {
                            const isImage = /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url)
                            return (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={`flex items-center gap-2 rounded-lg border transition-all hover:shadow-md ${
                                  isImage
                                    ? 'p-1 border-gray-200 bg-white'
                                    : 'px-3 py-2 border-gray-200 bg-gray-50 hover:bg-gray-100'
                                }`}
                              >
                                {isImage ? (
                                  <img
                                    src={url}
                                    alt={`Attachment ${idx + 1}`}
                                    className="h-20 w-20 object-cover rounded"
                                  />
                                ) : (
                                  <>
                                    <PaperClipOutlined className="text-blue-600" />
                                    <span className="text-sm font-medium text-gray-700">
                                      Attachment {idx + 1}
                                    </span>
                                    <span className="text-xs text-gray-500">(PDF)</span>
                                  </>
                                )}
                              </a>
                            )
                          })}
                        </div>
                      )}
                      <div className="text-xs mt-2 opacity-70">{formatTime(msg.createdAt)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {ticketData.ticket.status !== 'closed' && (
              <div className="border-t p-4 bg-gray-50">
                {attachmentFiles.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {attachmentFiles.map((file, idx) => (
                      <div
                        key={file.uid}
                        className="flex items-center gap-2 rounded bg-blue-50 px-3 py-1.5 text-sm"
                      >
                        <PaperClipOutlined />
                        <span className="max-w-[200px] truncate">{file.name}</span>
                        <Button
                          type="text"
                          size="small"
                          danger
                          onClick={() => {
                            setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))
                          }}
                          className="h-4 w-4 p-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <TextArea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onPressEnter={(e) => {
                        if (e.shiftKey) return
                        e.preventDefault()
                        handleSendMessage()
                      }}
                      placeholder="Type a message..."
                      rows={2}
                    />
                    <Upload
                      multiple
                      maxCount={5}
                      fileList={attachmentFiles}
                      beforeUpload={(file) => {
                        // Create UploadFile with originFileObj set to the actual File
                        const uploadFile: UploadFile = {
                          uid: file.uid || `${Date.now()}-${file.name}`,
                          name: file.name,
                          status: 'done',
                          originFileObj: file,
                        }
                        setAttachmentFiles((prev) => [...prev, uploadFile])
                        return false // Prevent auto upload
                      }}
                      accept="image/*,.pdf"
                      showUploadList={false}
                      className="mt-2"
                    >
                      <Button type="link" icon={<PaperClipOutlined />} size="small">
                        Attach files (Images/PDF, max 5, 10MB each)
                      </Button>
                    </Upload>
                  </div>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSendMessage}
                    disabled={
                      (!newMessage.trim() && attachmentFiles.length === 0) ||
                      sendMessageMutation.isPending ||
                      uploadAttachmentsMutation.isPending
                    }
                    loading={sendMessageMutation.isPending || uploadAttachmentsMutation.isPending}
                  >
                    Send
                  </Button>
                </div>
              </div>
            )}
            {ticketData.ticket.status === 'closed' && (
              <div className="border-t p-4 bg-gray-50 text-center text-gray-500">
                This ticket is closed. You cannot send new messages.
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageOutlined className="text-4xl text-gray-400 mb-4" />
              <p>Ticket not found</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Ticket Modal */}
      <Modal
        title="Create Support Ticket"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTicket}
          initialValues={{ priority: 'medium' }}
        >
          <Form.Item
            name="subject"
            label="Subject"
            rules={[{ required: true, message: 'Please enter a subject' }]}
          >
            <Input placeholder="Brief description of your issue" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select a category' }]}
          >
            <Select placeholder="Select category">
              <Select.Option value="order">Order</Select.Option>
              <Select.Option value="refund">Refund</Select.Option>
              <Select.Option value="settlement">Settlement</Select.Option>
              <Select.Option value="ledger">Ledger</Select.Option>
              <Select.Option value="payout">Payout</Select.Option>
              <Select.Option value="product">Product</Select.Option>
              <Select.Option value="account">Account</Select.Option>
              <Select.Option value="shipping">Shipping</Select.Option>
              <Select.Option value="payment">Payment</Select.Option>
              <Select.Option value="technical">Technical</Select.Option>
              <Select.Option value="other">Other</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="priority"
            label="Priority"
            rules={[{ required: true, message: 'Please select a priority' }]}
          >
            <Select>
              <Select.Option value="low">Low</Select.Option>
              <Select.Option value="medium">Medium</Select.Option>
              <Select.Option value="high">High</Select.Option>
              <Select.Option value="urgent">Urgent</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter a description' }]}
          >
            <TextArea rows={6} placeholder="Please provide details about your issue..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={createTicketMutation.isPending}>
                Create Ticket
              </Button>
              <Button onClick={() => setCreateModalOpen(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default Tickets
