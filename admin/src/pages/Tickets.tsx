import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MessageOutlined,
  PlusOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { AutoComplete, Badge, Button, Card, Form, Input, Modal, Select, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useAdminMarkTicketAsRead,
  useAdminSendSystemMessage,
  useAdminSendTicketMessage,
  useAdminTicket,
  useAssignTicket,
  useCreateTicketAsAdmin,
  useTickets,
  useUpdateTicketPriority,
  useUpdateTicketStatus,
  type Ticket,
} from '../api/support'
import { useUsers, useUsersWithPermission } from '../api/users'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'
import { useModulePermissions } from '../hooks/useModulePermissions'
import { useAuthStore } from '../store/authStore'

const Tickets = () => {
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>('')
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const ticketsPermissions = useModulePermissions('supportTickets')
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [selectedTicketForAssign, setSelectedTicketForAssign] = useState<Ticket | null>(null)
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null)

  const currentUserId = useAuthStore((state) => state.userId)
  const currentUserRole = useAuthStore((state) => state.role)
  const isSuperAdmin = currentUserRole === 'super-admin'

  const { data: tickets = [], isLoading } = useTickets({
    status: statusFilter,
    category: categoryFilter,
    priority: priorityFilter,
    ticketType: ticketTypeFilter || undefined,
    ...(isSuperAdmin ? {} : { assignedTo: currentUserId || undefined }),
  })

  // Get users with write/update access to tickets (for assignment dropdown)
  const usersQuery = useUsersWithPermission('supportTickets', 'update')
  const { data: ticketData, isLoading: isLoadingTicket } = useAdminTicket(selectedTicketId || '')
  const sendMessageMutation = useAdminSendTicketMessage()
  const sendSystemMessageMutation = useAdminSendSystemMessage()
  const markAsReadMutation = useAdminMarkTicketAsRead()
  const [systemMessageText, setSystemMessageText] = useState('')

  const assignTicketMutation = useAssignTicket()
  const updateStatusMutation = useUpdateTicketStatus()
  const updatePriorityMutation = useUpdateTicketPriority()
  const createTicketMutation = useCreateTicketAsAdmin()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm] = Form.useForm()
  const [ticketType, setTicketType] = useState<'customer' | 'seller'>('customer')
  const [userSearchText, setUserSearchText] = useState('')
  
  // Debounce search text
  const [debouncedSearchText, setDebouncedSearchText] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(userSearchText)
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearchText])
  
  // Fetch users with search
  const { data: sellers, isLoading: sellersLoading } = useUsers({
    role: 'seller',
    search: debouncedSearchText || undefined,
    enabled: ticketType === 'seller' && createModalOpen,
  })
  const { data: customers, isLoading: customersLoading } = useUsers({
    role: 'customer',
    search: debouncedSearchText || undefined,
    enabled: ticketType === 'customer' && createModalOpen,
  })
  
  const currentUsers = ticketType === 'seller' ? sellers : customers
  const isLoadingUsers = ticketType === 'seller' ? sellersLoading : customersLoading

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [ticketData?.messages?.length]) // Only depend on length to prevent loops

  // Track which tickets we've already marked as read to prevent loops
  const markedAsReadRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // Reset marked set when ticket changes
    markedAsReadRef.current = new Set()
  }, [selectedTicketId])

  useEffect(() => {
    if (
      selectedTicketId &&
      ticketData?.messages &&
      !markAsReadMutation.isPending &&
      !markedAsReadRef.current.has(selectedTicketId)
    ) {
      // Mark unread messages as read (only if not already marked and not pending)
      const unreadMessages = ticketData.messages.filter(
        (msg) => !msg.read && msg.senderRole !== 'super-admin' && msg.senderRole !== 'support',
      )
      if (unreadMessages.length > 0) {
        markedAsReadRef.current.add(selectedTicketId)
        markAsReadMutation.mutate(selectedTicketId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId, ticketData?.messages?.length]) // Only depend on length to prevent infinite loops

  const handleOpenTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicketId) return

    if (ticketData?.ticket.status === 'closed') {
      toast.error('Ticket is closed. Reopen it to send messages.')
      return
    }

    try {
      await sendMessageMutation.mutateAsync({
        id: selectedTicketId,
        message: newMessage,
      })
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
    return date.toLocaleDateString()
  }

  const handleAssign = (ticket: Ticket) => {
    if (ticket.status === 'closed') {
      toast.error('Closed tickets cannot be reassigned. Reopen the ticket first.')
      return
    }
    setSelectedTicketForAssign(ticket)
    setAssignModalOpen(true)
  }

  const handleAssignSubmit = (assignedTo: string) => {
    if (!selectedTicketForAssign) return

                assignTicketMutation.mutate(
      { id: selectedTicketForAssign._id, assignedTo },
                  {
                    onSuccess: () => {
                      toast.success('Ticket assigned successfully')
          setAssignModalOpen(false)
          setSelectedTicketForAssign(null)
                    },
                    onError: () => {
                      toast.error('Failed to assign ticket')
                    },
                  },
                )
  }

  const handleStatusUpdate = (ticketId: string, status: string) => {
    setUpdatingTicketId(ticketId)
    updateStatusMutation.mutate(
      { id: ticketId, status },
      {
        onSuccess: () => {
          toast.success('Status updated successfully')
          setUpdatingTicketId(null)
        },
        onError: () => {
          toast.error('Failed to update status')
          setUpdatingTicketId(null)
        },
      },
    )
  }

  const handlePriorityUpdate = (ticketId: string, priority: string) => {
    updatePriorityMutation.mutate(
      { id: ticketId, priority },
      {
        onSuccess: () => {
          toast.success('Priority updated successfully')
        },
        onError: () => {
          toast.error('Failed to update priority')
        },
      },
    )
  }

  const columns: ColumnsType<Ticket> = [
    {
      title: 'Ticket #',
      dataIndex: 'ticketNumber',
      key: 'ticketNumber',
      render: (text: string) => <span className="font-mono">{text}</span>,
    },
    {
      title: 'Type',
      key: 'ticketType',
      render: (_: unknown, record: Ticket) => {
        const ticketType = record.ticketType || 'customer'
        return (
          <div>
            <div>{ticketType === 'seller' ? 'Seller' : 'Customer'}</div>
            <div className="text-xs text-gray-500">Type: {ticketType}</div>
          </div>
        )
      },
    },
    {
      dataIndex: ['customerId', 'name'],
      key: 'owner',
      render: (_: unknown, record: Ticket) => {
        if (record.ticketType === 'seller' && record.sellerId) {
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold">
                {record.sellerId.businessName || record.sellerId.name}
              </div>
              <div className="text-xs text-gray-500">{record.sellerId.email}</div>
              <Tag color="blue" className="mt-1">
                Seller
              </Tag>
            </div>
          )
        }
        if (record.customerId) {
          return (
        <div onClick={(e) => e.stopPropagation()}>
          <div className="font-semibold">{record.customerId.name}</div>
          <div className="text-xs text-gray-500">{record.customerId.email}</div>
          <Link
            to={`/customers/${record.customerId._id}`}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <UserOutlined />
            View Customer
          </Link>
        </div>
          )
        }
        return <span className="text-gray-400">—</span>
      },
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      render: (text: string) => text || 'No subject',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (type: string) => (type ? <Tag>{type}</Tag> : '-'),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string, record: Ticket) => {
        return (
          <Select
            value={priority}
            onChange={(value) => handlePriorityUpdate(record._id, value)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 100 }}
            size="small"
          >
            <Select.Option value="low">Low</Select.Option>
            <Select.Option value="medium">Medium</Select.Option>
            <Select.Option value="high">High</Select.Option>
            <Select.Option value="urgent">Urgent</Select.Option>
          </Select>
        )
      },
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
      render: (_: string, record: Ticket) => {
        if (record.assignedTo?.name) {
          return (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-between gap-2"
            >
              <span>
                <UserOutlined className="mr-1" />
                {record.assignedTo?.name}
              </span>
              {record.status !== 'closed' && (
                <PermissionGate module="supportTickets" permission="assign">
                  <PermissionButton
                    module="supportTickets"
                    permission="assign"
                    type="link"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAssign(record)
                    }}
                  >
                    Reassign
                  </PermissionButton>
                </PermissionGate>
              )}
            </div>
          )
        }

        if (record.status === 'closed') {
          return (
            <Tag color="default" onClick={(e) => e.stopPropagation()}>
              Closed
            </Tag>
          )
        }

        return (
          <PermissionGate module="supportTickets" permission="assign">
            <PermissionButton
              module="supportTickets"
              permission="assign"
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                handleAssign(record)
              }}
            >
              Assign
            </PermissionButton>
          </PermissionGate>
        )
      },
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivityAt',
      key: 'lastActivityAt',
      render: (date: string) => (date ? new Date(date).toLocaleString() : '-'),
    },
    ...(ticketsPermissions.canView || ticketsPermissions.canUpdate
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 200,
            fixed: 'right' as const,
            render: (_: unknown, record: Ticket) => (
              <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="primary"
                  size="small"
                  icon={<MessageOutlined />}
                  onClick={() => handleOpenTicket(record._id)}
                >
                  View
                </Button>
                <PermissionGate module="supportTickets" permission="update">
                  {record.status !== 'closed' && (
                    <PermissionButton
                      module="supportTickets"
                      permission="update"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      loading={updatingTicketId === record._id}
                      onClick={() => handleStatusUpdate(record._id, 'closed')}
                    >
                      Close
                    </PermissionButton>
                  )}
                  {record.status === 'closed' && (
                    <PermissionButton
                      module="supportTickets"
                      permission="update"
                      size="small"
                      icon={<CloseCircleOutlined />}
                      loading={updatingTicketId === record._id}
                      onClick={() => handleStatusUpdate(record._id, 'open')}
                    >
                      Reopen
                    </PermissionButton>
                  )}
                </PermissionGate>
              </div>
            ),
          },
        ]
      : []),
  ]

  const stats = {
    total: tickets.length,
    open: tickets.filter((c) => c.status === 'open').length,
    'in-progress': tickets.filter((c) => c.status === 'in-progress').length,
    resolved: tickets.filter((c) => c.status === 'resolved').length,
    closed: tickets.filter((c) => c.status === 'closed').length,
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Support Tickets</h1>
          <PermissionGate module="supportTickets" permission="create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Ticket
            </Button>
          </PermissionGate>
        </div>
        <div className="grid grid-cols-5 gap-4 mb-4">
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
      </div>

      <Card>
        <div className="mb-4 flex space-x-4">
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
          <Select
            placeholder="Filter by Category"
            style={{ width: 200 }}
            allowClear
            value={categoryFilter || undefined}
            onChange={setCategoryFilter}
          >
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
          <Select
            placeholder="Filter by Priority"
            style={{ width: 200 }}
            allowClear
            value={priorityFilter || undefined}
            onChange={setPriorityFilter}
          >
            <Select.Option value="low">Low</Select.Option>
            <Select.Option value="medium">Medium</Select.Option>
            <Select.Option value="high">High</Select.Option>
            <Select.Option value="urgent">Urgent</Select.Option>
          </Select>
          <Select
            placeholder="Filter by Type"
            style={{ width: 200 }}
            allowClear
            value={ticketTypeFilter || undefined}
            onChange={setTicketTypeFilter}
          >
            <Select.Option value="customer">Customer</Select.Option>
            <Select.Option value="seller">Seller</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={tickets}
          loading={isLoading}
          rowKey="_id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1500 }}
          onRow={(record) => ({
            onClick: () => handleOpenTicket(record._id),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* Ticket Modal */}
      <Modal
        title={
          ticketData ? (
            <div>
              <div className="font-semibold">{ticketData.ticket.subject}</div>
              <div className="text-sm text-gray-500 mt-1">
                Ticket #{ticketData.ticket.ticketNumber} -{' '}
                {ticketData.ticket.ticketType === 'seller' ? 'Seller' : 'Customer'}:{' '}
                {ticketData.ticket.ticketType === 'seller'
                  ? ticketData.ticket.sellerId?.businessName || ticketData.ticket.sellerId?.name
                  : ticketData.ticket.customerId?.name}{' '}
                (
                {ticketData.ticket.ticketType === 'seller'
                  ? ticketData.ticket.sellerId?.email
                  : ticketData.ticket.customerId?.email}
                )
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
                  <Tag
                    className="ml-2"
                    color={
                      ticketData.ticket.priority === 'urgent'
                        ? 'red'
                        : ticketData.ticket.priority === 'high'
                        ? 'orange'
                        : ticketData.ticket.priority === 'medium'
                        ? 'blue'
                        : 'default'
                    }
                  >
                    {ticketData.ticket.priority}
                  </Tag>
                  {ticketData.ticket.assignedTo && (
                    <span className="ml-4 text-sm text-gray-600">
                      Assigned to: {ticketData.ticket.assignedTo.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Category:</strong> {ticketData.ticket.category || 'N/A'}
                </p>
                <p>
                  <strong>Description:</strong> {ticketData.ticket.description || 'No description'}
                </p>
                {/* Linked Entities */}
                <div className="mt-3 pt-3 border-t space-y-1">
                  <p>
                    <strong>Order:</strong>{' '}
                    {ticketData.ticket.orderId ? (
                      (() => {
                        const orderId = ticketData.ticket.orderId
                        if (typeof orderId === 'object' && orderId !== null && '_id' in orderId) {
                          const order = orderId as { _id: string; orderNumber?: string }
                          return (
                            <Link
                              to={`/orders/${order._id}`}
                              target="_blank"
                              className="text-blue-600 hover:underline"
                            >
                              {order.orderNumber || `Order ${order._id.slice(-6)}`}
                            </Link>
                          )
                        }
                        return (
                          <Link
                            to={`/orders/${orderId}`}
                            target="_blank"
                            className="text-blue-600 hover:underline"
                          >
                            View Order
                          </Link>
                        )
                      })()
                    ) : (
                      <span className="text-gray-400">Not linked</span>
                    )}
                  </p>
                  {ticketData.ticket.refundRequestId && (
                    <p>
                      <strong>Return/Refund:</strong>{' '}
                      {typeof ticketData.ticket.refundRequestId === 'object' &&
                      ticketData.ticket.refundRequestId !== null &&
                      '_id' in ticketData.ticket.refundRequestId ? (
                        <span>
                          ID: {(ticketData.ticket.refundRequestId as { _id: string })._id.slice(-8)}
                        </span>
                      ) : (
                        <span>ID: {String(ticketData.ticket.refundRequestId).slice(-8)}</span>
                      )}
                    </p>
                  )}
                  {ticketData.ticket.settlementBatchId && (
                    <p>
                      <strong>Settlement:</strong>{' '}
                      {typeof ticketData.ticket.settlementBatchId === 'object' &&
                      ticketData.ticket.settlementBatchId !== null &&
                      '_id' in ticketData.ticket.settlementBatchId ? (
                        <Link
                          to={`/settlements/${
                            (ticketData.ticket.settlementBatchId as { _id: string })._id
                          }`}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          View Settlement
                        </Link>
                      ) : (
                        <Link
                          to={`/settlements/${ticketData.ticket.settlementBatchId}`}
                          target="_blank"
                          className="text-blue-600 hover:underline"
                        >
                          View Settlement
                        </Link>
                      )}
                    </p>
                  )}
                  {ticketData.ticket.ledgerEntryId && (
                    <p>
                      <strong>Ledger Entry:</strong>{' '}
                      {typeof ticketData.ticket.ledgerEntryId === 'object' &&
                      ticketData.ticket.ledgerEntryId !== null &&
                      '_id' in ticketData.ticket.ledgerEntryId ? (
                        <span>
                          ID: {(ticketData.ticket.ledgerEntryId as { _id: string })._id.slice(-8)}
                        </span>
                      ) : (
                        <span>ID: {String(ticketData.ticket.ledgerEntryId).slice(-8)}</span>
                      )}
                    </p>
                  )}
                </div>
                {/* Statuses - Separated and clearly labeled */}
                <div className="mt-3 pt-3 border-t space-y-1">
                  <p>
                    <strong>Ticket Status:</strong>{' '}
                    <Tag
                      color={
                        ticketData.ticket.status === 'open'
                          ? 'blue'
                          : ticketData.ticket.status === 'in-progress'
                          ? 'orange'
                          : ticketData.ticket.status === 'resolved'
                          ? 'green'
                          : 'default'
                      }
                    >
                      {ticketData.ticket.status || 'N/A'}
                    </Tag>
                  </p>
                  {(() => {
                    const refundId = ticketData.ticket.refundRequestId
                    if (
                      refundId &&
                      typeof refundId === 'object' &&
                      refundId !== null &&
                      'status' in refundId
                    ) {
                      const refund = refundId as { status?: string }
                      if (refund.status) {
                        return (
                          <p>
                            <strong>Refund Status:</strong>{' '}
                            <Tag
                              color={
                                refund.status === 'REFUND_COMPLETED'
                                  ? 'green'
                                  : refund.status === 'REFUND_INITIATED'
                                  ? 'blue'
                                  : refund.status === 'REJECTED'
                                  ? 'red'
                                  : 'orange'
                              }
                            >
                              {refund.status}
                            </Tag>
                          </p>
                        )
                      }
                    }
                    return null
                  })()}
                  {(() => {
                    const orderId = ticketData.ticket.orderId
                    if (
                      orderId &&
                      typeof orderId === 'object' &&
                      orderId !== null &&
                      'status' in orderId
                    ) {
                      const order = orderId as { status?: string }
                      if (order.status) {
                        return (
                          <p>
                            <strong>Order Status:</strong> <Tag color="blue">{order.status}</Tag>
                          </p>
                        )
                      }
                    }
                    return null
                  })()}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {ticketData.messages.map((message) => {
                const isAdmin =
                  message.senderRole === 'super-admin' || message.senderRole === 'support'
                const isSeller = message.senderRole === 'seller'
                const isSystem = message.isSystemMessage
                return (
                  <div
                    key={message._id}
                    className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        isAdmin
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
                        {isSystem ? (
                          'System'
                        ) : (
                          <>
                            {message.senderId?.name || 'Unknown'}
                            {isAdmin && !isSystem && (
                              <span>
                                {' '}
                                (
                                {message.senderRole === 'super-admin'
                                  ? 'Admin'
                                  : message.senderRole === 'support'
                                  ? 'Support Team'
                                  : 'Admin'}
                                )
                              </span>
                            )}
                            {isSeller && !isSystem && ' (Seller)'}
                          </>
                        )}
                      </div>
                      {message.message && (
                        <div
                          className={`text-sm whitespace-pre-wrap ${isSystem ? 'text-gray-800' : ''}`}
                        >
                          {message.message}
                        </div>
                      )}
                      {isSystem && (
                        <div className="text-xs text-gray-600 mt-2 italic">
                          This is an informational system message. You can still reply to this
                          ticket using the message box below.
                        </div>
                      )}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.attachments.map((url, idx) => {
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
                                    <svg
                                      className="w-5 h-5 text-blue-600"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                                      />
                                    </svg>
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
                      <div className="text-xs mt-2 opacity-70">{formatTime(message.createdAt)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <PermissionGate module="supportTickets" permission="update">
              <div className="border-t p-4 bg-gray-50 space-y-3">
                <div className="flex gap-2">
                  <Input.TextArea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onPressEnter={(e) => {
                      if (e.shiftKey) return
                      e.preventDefault()
                      handleSendMessage()
                    }}
                    placeholder="Type a message..."
                    rows={2}
                    className="flex-1"
                    disabled={ticketData.ticket.status === 'closed'}
                  />
                  <PermissionButton
                    module="supportTickets"
                    permission="update"
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSendMessage}
                    disabled={
                      !newMessage.trim() ||
                      sendMessageMutation.isPending ||
                      ticketData.ticket.status === 'closed'
                    }
                    loading={sendMessageMutation.isPending}
                  >
                    Send
                  </PermissionButton>
                </div>
                <div className="border-t pt-3 mt-3">
                  <div className="mb-2">
                    <div className="text-xs font-semibold text-gray-700 mb-1">
                      🔔 System Message (Informational Only)
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      One-way notification for updates, status changes, or announcements. Seller can
                      still reply to this ticket using the regular message box below.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input.TextArea
                      value={systemMessageText}
                      onChange={(e) => setSystemMessageText(e.target.value)}
                      placeholder="Enter clear, actionable update... Examples: 'Your settlement payment of ₹5,000 has been processed and will reflect in your bank account within 2-3 business days.' | 'This ticket has been escalated to the Finance Team for review. You will receive an update within 24 hours.' | 'Your refund request has been approved. Refund amount ₹300 will be credited to your original payment method.'"
                      rows={3}
                      className="flex-1"
                      disabled={ticketData.ticket.status === 'closed'}
                    />
                    <PermissionButton
                      module="supportTickets"
                      permission="update"
                      type="default"
                      onClick={async () => {
                        if (!systemMessageText.trim() || !selectedTicketId) return
                        try {
                          await sendSystemMessageMutation.mutateAsync({
                            id: selectedTicketId,
                            message: systemMessageText,
                          })
                          setSystemMessageText('')
                          toast.success('System message sent')
                        } catch {
                          toast.error('Failed to send system message')
                        }
                      }}
                      disabled={
                        !systemMessageText.trim() ||
                        sendSystemMessageMutation.isPending ||
                        ticketData.ticket.status === 'closed'
                      }
                      loading={sendSystemMessageMutation.isPending}
                    >
                      Send System
                    </PermissionButton>
                  </div>
                </div>
                {ticketData.ticket.status === 'closed' && (
                  <p className="text-xs text-red-500 mt-2">
                    This ticket is closed. Reopen it to send new messages or reassign.
                  </p>
                )}
              </div>
            </PermissionGate>
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

      {/* Assign Ticket Modal */}
      <Modal
        title="Assign Ticket"
        open={assignModalOpen}
        onCancel={() => {
          setAssignModalOpen(false)
          setSelectedTicketForAssign(null)
        }}
        footer={null}
      >
        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spin tip="Loading users..." />
    </div>
        ) : !Array.isArray(usersQuery.data) || usersQuery.data.length === 0 ? (
          <div className="py-4 text-sm text-gray-600">
            No users with write access available. Please ensure there are users with tickets update
            permission.
          </div>
        ) : (
          <Select
            placeholder="Select user to assign ticket"
            style={{ width: '100%', marginTop: 8 }}
            showSearch
            filterOption={(input, option) => {
              const children = option?.children
              const text = typeof children === 'string' ? children : String(children || '')
              return text.toLowerCase().includes(input.toLowerCase())
            }}
            onChange={(value) => {
              handleAssignSubmit(value)
            }}
            value={selectedTicketForAssign?.assignedTo?._id}
          >
            {usersQuery.data.map((user) => (
              <Select.Option key={user._id} value={user._id}>
                {user.name} ({user.email})
              </Select.Option>
            ))}
          </Select>
        )}
      </Modal>

      {/* Create Ticket Modal */}
      <PermissionGate module="supportTickets" permission="create">
        <Modal
          title="Create Ticket"
          open={createModalOpen}
          onCancel={() => {
            setCreateModalOpen(false)
            createForm.resetFields()
            setTicketType('customer')
            setUserSearchText('')
          }}
          footer={null}
          width={600}
        >
          <Form
            form={createForm}
            layout="vertical"
            onFinish={async (values) => {
              try {
                await createTicketMutation.mutateAsync({
                  ...values,
                  ...(ticketType === 'seller' ? { sellerId: values.userId } : { customerId: values.userId }),
                })
                toast.success('Ticket created successfully')
                setCreateModalOpen(false)
                createForm.resetFields()
                setTicketType('customer')
                setUserSearchText('')
              } catch (error) {
                toast.error('Failed to create ticket')
              }
            }}
            initialValues={{ priority: 'medium', ticketType: 'customer' }}
          >
            <Form.Item
              name="ticketType"
              label="Ticket Type"
              rules={[{ required: true }]}
            >
              <Select
                value={ticketType}
                onChange={(value) => {
                  setTicketType(value)
                  createForm.setFieldsValue({ userId: undefined })
                  setUserSearchText('')
                }}
              >
                <Select.Option value="customer">Customer Ticket</Select.Option>
                <Select.Option value="seller">Seller Ticket</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="userId"
              label={ticketType === 'seller' ? 'Seller' : 'Customer'}
              rules={[{ required: true, message: `Please select a ${ticketType}` }]}
            >
              <AutoComplete
                placeholder={`Search ${ticketType} by name, email, or ${ticketType === 'seller' ? 'business name' : 'phone'}...`}
                options={currentUsers?.map((user: any) => {
                  const displayName = ticketType === 'seller' && user.businessName 
                    ? `${user.businessName} (${user.name})` 
                    : user.name
                  return {
                    value: user._id,
                    label: (
                      <div>
                        <div style={{ fontWeight: 500 }}>{displayName}</div>
                        <div style={{ fontSize: '12px', color: '#999' }}>{user.email}</div>
                      </div>
                    ),
                    displayName, // For filtering/display
                  }
                }) || []}
                onSearch={setUserSearchText}
                filterOption={false}
                notFoundContent={
                  isLoadingUsers ? (
                    <div style={{ textAlign: 'center', padding: 8 }}>
                      <Spin size="small" />
                    </div>
                  ) : debouncedSearchText && currentUsers?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 8, color: '#999' }}>
                      No {ticketType}s found
                    </div>
                  ) : null
                }
                style={{ width: '100%' }}
              />
            </Form.Item>

            <Form.Item
              name="subject"
              label="Subject"
              rules={[{ required: true, message: 'Please enter a subject' }]}
            >
              <Input placeholder="Ticket subject" />
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
              rules={[{ required: true }]}
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
              <Input.TextArea rows={6} placeholder="Ticket description" />
            </Form.Item>

            <Form.Item>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => {
                  setCreateModalOpen(false)
                  createForm.resetFields()
                  setTicketType('customer')
                }}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={createTicketMutation.isPending}>
                  Create Ticket
                </Button>
              </div>
            </Form.Item>
          </Form>
        </Modal>
      </PermissionGate>
    </div>
  )
}

export default Tickets
