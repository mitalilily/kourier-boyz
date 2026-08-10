import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  MessageOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { App, Badge, Button, Card, Input, Modal, Select, Spin, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useAdminChat,
  useAdminMarkAsRead,
  useAdminSendMessage,
  useAssignChat,
  useSupportChats,
  useUpdateChatStatus,
  type SupportChat,
} from '../api/support'
import { useUsersWithPermission } from '../api/users'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'
import { useModulePermissions } from '../hooks/useModulePermissions'
import { useAuthStore } from '../store/authStore'

const SupportChats = () => {
  const { modal } = App.useApp()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('')
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supportChatsPermissions = useModulePermissions('supportChats')

  const currentUserId = useAuthStore((state) => state.userId)
  const currentUserRole = useAuthStore((state) => state.role)
  const isSuperAdmin = currentUserRole === 'super-admin'

  const { data: chats = [], isLoading } = useSupportChats({
    status: statusFilter,
    issueType: issueTypeFilter,
    ...(isSuperAdmin ? {} : { assignedTo: currentUserId || undefined }),
  })

  // Get users with write/update access to supportChats (for assignment dropdown)
  const usersQuery = useUsersWithPermission('supportChats', 'update')
  const { data: chatData, isLoading: isLoadingChat } = useAdminChat(selectedChatId || '')
  const sendMessageMutation = useAdminSendMessage()
  const markAsReadMutation = useAdminMarkAsRead()

  const assignChatMutation = useAssignChat()
  const updateStatusMutation = useUpdateChatStatus()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatData?.messages])

  useEffect(() => {
    if (selectedChatId && chatData?.messages) {
      // Mark unread messages as read
      const unreadMessages = chatData.messages.filter(
        (msg) => !msg.read && msg.senderRole !== 'super-admin',
      )
      if (unreadMessages.length > 0) {
        markAsReadMutation.mutate(selectedChatId)
      }
    }
  }, [selectedChatId, chatData?.messages, markAsReadMutation])

  const handleOpenChat = (chatId: string) => {
    setSelectedChatId(chatId)
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChatId) return

    if (chatData?.chat.status === 'closed') {
      toast.error('Chat is closed. Reopen it to send messages.')
      return
    }

    try {
      await sendMessageMutation.mutateAsync({
        id: selectedChatId,
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

  const handleAssign = (chat: SupportChat) => {
    if (chat.status === 'closed') {
      toast.error('Closed chats cannot be reassigned. Reopen the chat first.')
      return
    }

    // Get fresh data from query to avoid closure issues
    const currentUsers = usersQuery.data || []

    let modalInstance: ReturnType<typeof modal.confirm> | null = null

    modalInstance = modal.confirm({
      title: 'Assign Chat',
      footer: null,
      content: (
        <>
          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spin tip="Loading users..." />
            </div>
          ) : !Array.isArray(currentUsers) || currentUsers.length === 0 ? (
            <div className="py-4 text-sm text-gray-600">
              No users with write access available. Please ensure there are users with support chats
              update permission.
            </div>
          ) : (
            <Select
              placeholder="Select user"
              style={{ width: '100%', marginTop: 8 }}
              showSearch
              filterOption={(input, option) => {
                const children = option?.children
                const text = typeof children === 'string' ? children : String(children || '')
                return text.toLowerCase().includes(input.toLowerCase())
              }}
              onChange={(value) => {
                assignChatMutation.mutate(
                  { id: chat._id, assignedTo: value },
                  {
                    onSuccess: () => {
                      toast.success('Chat assigned successfully')
                      if (modalInstance) {
                        modalInstance.destroy()
                      }
                    },
                    onError: () => {
                      toast.error('Failed to assign chat')
                    },
                  },
                )
              }}
            >
              {currentUsers.map((user) => (
                <Select.Option key={user._id} value={user._id}>
                  {user.name} ({user.email})
                </Select.Option>
              ))}
            </Select>
          )}
        </>
      ),
    })
  }

  const handleStatusUpdate = (chatId: string, status: string) => {
    updateStatusMutation.mutate(
      { id: chatId, status },
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

  const columns: ColumnsType<SupportChat> = [
    {
      title: 'Customer',
      dataIndex: ['customerId', 'name'],
      key: 'customer',
      render: (_: unknown, record: SupportChat) => (
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
      ),
    },
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
      render: (text: string) => text || 'No subject',
    },
    {
      title: 'Issue Type',
      dataIndex: 'issueType',
      key: 'issueType',
      render: (type: string) => (type ? <Tag>{type}</Tag> : '-'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          open: 'default',
          active: 'processing',
          waiting: 'warning',
          closed: 'success',
        }
        return (
          <Badge
            status={colorMap[status] as 'default' | 'processing' | 'warning' | 'success'}
            text={status}
          />
        )
      },
    },
    {
      title: 'Assigned To',
      dataIndex: ['assignedTo', 'name'],
      key: 'assignedTo',
      render: (_: string, record: SupportChat) => {
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
                <PermissionGate module="supportChats" permission="assign">
                  <PermissionButton
                    module="supportChats"
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
          <PermissionGate module="supportChats" permission="assign">
            <PermissionButton
              module="supportChats"
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
      title: 'Last Message',
      dataIndex: 'lastMessageAt',
      key: 'lastMessageAt',
      render: (date: string) => (date ? new Date(date).toLocaleString() : '-'),
    },
    ...(supportChatsPermissions.canView || supportChatsPermissions.canUpdate
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 200,
            fixed: 'right' as const,
            render: (_: unknown, record: SupportChat) => (
              <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="primary"
                  size="small"
                  icon={<MessageOutlined />}
                  onClick={() => handleOpenChat(record._id)}
                >
                  Chat
                </Button>
                <PermissionGate module="supportChats" permission="update">
                  {record.status !== 'closed' && (
                    <PermissionButton
                      module="supportChats"
                      permission="update"
                      size="small"
                      icon={<CheckCircleOutlined />}
                      onClick={() => handleStatusUpdate(record._id, 'closed')}
                    >
                      Close
                    </PermissionButton>
                  )}
                  {record.status === 'closed' && (
                    <PermissionButton
                      module="supportChats"
                      permission="update"
                      size="small"
                      icon={<CloseCircleOutlined />}
                      onClick={() => handleStatusUpdate(record._id, 'active')}
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
    total: chats.length,
    open: chats.filter((c) => c.status === 'open').length,
    active: chats.filter((c) => c.status === 'active').length,
    closed: chats.filter((c) => c.status === 'closed').length,
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Support Chats</h1>
        <div className="grid grid-cols-4 gap-4 mb-4">
          <Card>
            <div className="text-gray-500 text-sm">Total Chats</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </Card>
          <Card>
            <div className="text-gray-500 text-sm">Open</div>
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          </Card>
          <Card>
            <div className="text-gray-500 text-sm">Active</div>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
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
            <Select.Option value="active">Active</Select.Option>
            <Select.Option value="waiting">Waiting</Select.Option>
            <Select.Option value="closed">Closed</Select.Option>
          </Select>
          <Select
            placeholder="Filter by Issue Type"
            style={{ width: 200 }}
            allowClear
            value={issueTypeFilter || undefined}
            onChange={setIssueTypeFilter}
          >
            <Select.Option value="order">Order</Select.Option>
            <Select.Option value="refund">Refund</Select.Option>
            <Select.Option value="product">Product</Select.Option>
            <Select.Option value="account">Account</Select.Option>
            <Select.Option value="shipping">Shipping</Select.Option>
            <Select.Option value="payment">Payment</Select.Option>
            <Select.Option value="other">Other</Select.Option>
          </Select>
        </div>

        <Table
          columns={columns}
          dataSource={chats}
          loading={isLoading}
          rowKey="_id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1000 }}
          onRow={(record) => ({
            onClick: () => handleOpenChat(record._id),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* Chat Modal */}
      <Modal
        title={
          chatData ? (
            <div>
              <div className="font-semibold">{chatData.chat.subject || 'Chat'}</div>
              <div className="text-sm text-gray-500 mt-1">
                Customer: {chatData.chat.customerId.name} ({chatData.chat.customerId.email})
              </div>
            </div>
          ) : (
            'Chat'
          )
        }
        open={!!selectedChatId}
        onCancel={() => {
          setSelectedChatId(null)
          setNewMessage('')
        }}
        footer={null}
        width={800}
        style={{ top: 20 }}
        bodyStyle={{
          height: '70vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        }}
      >
        {isLoadingChat ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading chat...</p>
            </div>
          </div>
        ) : chatData ? (
          <div className="flex flex-col h-full">
            {/* Chat Header */}
            <div className="border-b p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <Badge
                    status={
                      chatData.chat.status === 'open' || chatData.chat.status === 'active'
                        ? 'processing'
                        : 'default'
                    }
                    text={chatData.chat.status}
                  />
                  {chatData.chat.assignedTo && (
                    <span className="ml-4 text-sm text-gray-600">
                      Assigned to: {chatData.chat.assignedTo.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatData.messages.map((message) => {
                const isAdmin = message.senderRole === 'super-admin'
                const lines = message.message.split('\n')
                return (
                  <div
                    key={message._id}
                    className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        isAdmin ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="text-xs font-semibold mb-1 opacity-80">
                        {message.senderId.name}
                      </div>
                      <div className="text-sm space-y-1">
                        {lines.map((line, idx) => {
                          const trimmed = line.trim()
                          // Detect our "Admin order page" helper line and turn it into a link
                          if (trimmed.startsWith('Admin order page:')) {
                            const path = trimmed.replace('Admin order page:', '').trim()
                            return (
                              <div key={idx}>
                                <Link
                                  to={path}
                                  className={
                                    isAdmin
                                      ? 'underline text-white font-medium'
                                      : 'underline text-blue-600 font-medium'
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View order details
                                </Link>
                              </div>
                            )
                          }
                          return <div key={idx}>{trimmed}</div>
                        })}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {message.attachments.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <img
                                  src={url}
                                  alt="attachment"
                                  className="h-16 w-16 object-cover rounded border border-gray-300"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-xs mt-2 opacity-70">{formatTime(message.createdAt)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <PermissionGate module="supportChats" permission="update">
              <div className="border-t p-4 bg-gray-50">
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
                    disabled={chatData.chat.status === 'closed'}
                  />
                  <PermissionButton
                    module="supportChats"
                    permission="update"
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleSendMessage}
                    disabled={
                      !newMessage.trim() ||
                      sendMessageMutation.isPending ||
                      chatData.chat.status === 'closed'
                    }
                    loading={sendMessageMutation.isPending}
                  >
                    Send
                  </PermissionButton>
                </div>
                {chatData.chat.status === 'closed' && (
                  <p className="text-xs text-red-500 mt-2">
                    This chat is closed. Reopen it to send new messages or reassign.
                  </p>
                )}
              </div>
            </PermissionGate>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageOutlined className="text-4xl text-gray-400 mb-4" />
              <p>Chat not found</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default SupportChats
