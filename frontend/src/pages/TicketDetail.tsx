'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Bell,
  Download,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Paperclip,
  Send,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useCloseTicket,
  useMarkTicketMessagesAsRead,
  useSendTicketMessage,
  useTicket,
  useUploadTicketAttachments,
} from '../api/support'
import { useAuthStore } from '../store/authStore'

const TicketDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { data, isLoading } = useTicket(id || '', { enabled: isAuthenticated })
  const sendMessageMutation = useSendTicketMessage()
  const markAsReadMutation = useMarkTicketMessagesAsRead()
  const closeTicketMutation = useCloseTicket()
  const uploadAttachmentsMutation = useUploadTicketAttachments()
  const [newMessage, setNewMessage] = useState('')
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [data?.messages])

  useEffect(() => {
    if (id && data?.messages) {
      // Mark unread messages as read
      const unreadMessages = data.messages.filter(
        (msg) => !msg.read && msg.senderRole !== 'customer',
      )
      if (unreadMessages.length > 0) {
        markAsReadMutation.mutate(id)
      }
    }
  }, [id, data?.messages, markAsReadMutation])

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && attachmentFiles.length === 0) || !id) return

    if (data?.ticket.status === 'closed') {
      toast.error('Ticket is closed. Please reopen it to send messages.')
      return
    }

    try {
      let attachmentUrls: string[] = []

      // Upload attachments if any
      if (attachmentFiles.length > 0) {
        const uploadResult = await uploadAttachmentsMutation.mutateAsync(attachmentFiles)
        attachmentUrls = uploadResult.urls || []
      }

      await sendMessageMutation.mutateAsync({
        ticketId: id,
        message: newMessage.trim() || '',
        attachments: attachmentUrls,
      })
      setNewMessage('')
      setAttachmentFiles([])
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      // Note: Query invalidation is handled automatically by useSendTicketMessage mutation
    } catch (error) {
      toast.error('Failed to send message')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const validFiles = files.filter((file) => {
      const maxSize = 10 * 1024 * 1024 // 10MB
      const validTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
      ]

      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`)
        return false
      }
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name} is not a supported file type. Please upload images or PDFs.`)
        return false
      }
      return true
    })

    if (validFiles.length + attachmentFiles.length > 5) {
      toast.error('Maximum 5 attachments allowed')
      return
    }

    setAttachmentFiles((prev) => [...prev, ...validFiles])
  }

  const removeAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <ImageIcon className="w-4 h-4" />
    }
    return <FileText className="w-4 h-4" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleCloseTicket = async () => {
    if (!id) return
    try {
      await closeTicketMutation.mutateAsync(id)
      toast.success('Ticket closed successfully')
    } catch (error) {
      toast.error('Failed to close ticket')
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      open: { label: 'Open', className: 'bg-blue-100 text-blue-800' },
      'in-progress': {
        label: 'In Progress',
        className: 'bg-yellow-100 text-yellow-800',
      },
      resolved: { label: 'Resolved', className: 'bg-green-100 text-green-800' },
      closed: { label: 'Closed', className: 'bg-gray-100 text-gray-800' },
    }
    const variant = variants[status] || variants.open
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      low: { label: 'Low', className: 'bg-gray-100 text-gray-800' },
      medium: { label: 'Medium', className: 'bg-blue-100 text-blue-800' },
      high: { label: 'High', className: 'bg-orange-100 text-orange-800' },
      urgent: { label: 'Urgent', className: 'bg-red-100 text-red-800' },
    }
    const variant = variants[priority] || variants.medium
    return <Badge className={variant.className}>{variant.label}</Badge>
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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-xl font-semibold mb-2">Please log in to view this ticket</h3>
            <p className="text-gray-600 mb-4">
              You need to be logged in to view support ticket details.
            </p>
            <Button onClick={() => navigate(`/login?redirect=/help/tickets/${id}`)} className="mt-4">
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600">Ticket not found</p>
            <Button onClick={() => navigate('/help/tickets')} className="mt-4">
              Back to Tickets
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { ticket, messages } = data

  return (
    <div className="container mt-0 md:mt-28 mx-auto px-4 py-6 sm:py-8 max-w-5xl">
      <Button variant="ghost" onClick={() => navigate('/help/tickets')} className="mb-6 gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Tickets
      </Button>

      {/* Ticket Header Card */}
      <Card className="mb-6 shadow-md border-2">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl font-bold">{ticket.subject}</CardTitle>
                <div className="flex items-center gap-2">
                  {getStatusBadge(ticket.status)}
                  {getPriorityBadge(ticket.priority)}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span className="font-mono font-semibold">#{ticket.ticketNumber}</span>
                <Badge variant="outline" className="capitalize">
                  {ticket.category}
                </Badge>
                {ticket.assignedTo && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Assigned to:</span>
                    <span className="font-semibold text-gray-700">{ticket.assignedTo.name}</span>
                  </div>
                )}
              </div>
            </div>
            {ticket.status !== 'closed' && (
              <Button
                variant="outline"
                onClick={handleCloseTicket}
                disabled={closeTicketMutation.isPending}
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                {closeTicketMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Close Ticket
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Status
              </span>
              <div className="mt-1.5">{getStatusBadge(ticket.status)}</div>
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Priority
              </span>
              <div className="mt-1.5">{getPriorityBadge(ticket.priority)}</div>
            </div>
            <div className="md:col-span-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Description
              </span>
              <p className="text-gray-800 mt-1.5 leading-relaxed">{ticket.description}</p>
            </div>
            {ticket.orderId && (
              <div className="md:col-span-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Related Order
                </span>
                <div className="mt-1.5">
                  {typeof ticket.orderId === 'object' &&
                  ticket.orderId !== null &&
                  'orderNumber' in ticket.orderId ? (
                    <Link
                      to={`/profile/orders?orderId=${
                        (ticket.orderId as any)._id || ticket.orderId
                      }`}
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      <LinkIcon className="w-4 h-4" />
                      Order #{(ticket.orderId as any).orderNumber}
                    </Link>
                  ) : (
                    <span className="text-gray-600">
                      {typeof ticket.orderId === 'object' ? 'Not linked' : ticket.orderId}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="border-b">
          <CardTitle className="text-xl">Conversation</CardTitle>
          <CardDescription className="mt-1">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <div className="p-6 space-y-6">
              {messages.map((message, idx) => {
                const isCustomer = message.senderRole === 'customer'
                const isSystem = (message as any).isSystemMessage
                const isAdmin =
                  message.senderRole === 'super-admin' || message.senderRole === 'support'
                const isFirstMessage = idx === 0
                const showDateSeparator =
                  idx > 0 &&
                  new Date(message.createdAt).toDateString() !==
                    new Date(messages[idx - 1].createdAt).toDateString()

                return (
                  <div key={message._id}>
                    {showDateSeparator && (
                      <div className="flex items-center justify-center my-6">
                        <div className="flex-1 border-t border-gray-200"></div>
                        <span className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {new Date(message.createdAt).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                        <div className="flex-1 border-t border-gray-200"></div>
                      </div>
                    )}
                    <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-xl shadow-sm ${
                          isSystem
                            ? 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-300 text-gray-900'
                            : isCustomer
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md'
                            : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                        } ${isFirstMessage ? 'ring-2 ring-blue-200' : ''}`}
                      >
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              {isSystem && (
                                <div className="p-1.5 bg-yellow-200 rounded-full">
                                  <Bell className="w-3.5 h-3.5 text-yellow-800" />
                                </div>
                              )}
                              <div
                                className={`text-xs font-semibold ${
                                  isCustomer ? 'opacity-90' : ''
                                } ${isSystem ? 'text-yellow-900' : ''}`}
                              >
                                {isSystem
                                  ? 'System Notification'
                                  : `${message.senderId.name}${isAdmin ? ' (Admin)' : ''}`}
                              </div>
                            </div>
                            <div
                              className={`text-xs ${isCustomer ? 'opacity-75' : 'text-gray-500'}`}
                            >
                              {formatTime(message.createdAt)}
                            </div>
                          </div>
                          {message.message && (
                            <div
                              className={`text-sm leading-relaxed whitespace-pre-wrap ${
                                isSystem ? 'text-gray-800' : ''
                              }`}
                            >
                              {message.message}
                            </div>
                          )}
                          {isSystem && (
                            <div className="pt-2 mt-2 border-t border-yellow-300">
                              <p className="text-xs text-yellow-800 italic">
                                This is an informational system notification. You can reply to this
                                ticket using the message box below if needed.
                              </p>
                            </div>
                          )}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {message.attachments.map((url, attIdx) => {
                                const isImage = /\.(jpg|jpeg|png|gif|webp|avif)$/i.test(url)
                                return (
                                  <a
                                    key={attIdx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 rounded-lg border transition-all hover:shadow-md ${
                                      isImage
                                        ? 'p-1 border-gray-200 bg-white'
                                        : 'px-3 py-2 border-gray-200 bg-gray-50 hover:bg-gray-100'
                                    }`}
                                  >
                                    {isImage ? (
                                      <img
                                        src={url}
                                        alt={`Attachment ${attIdx + 1}`}
                                        className="h-20 w-20 object-cover rounded"
                                      />
                                    ) : (
                                      <>
                                        <FileText className="w-5 h-5 text-blue-600" />
                                        <span className="text-sm font-medium text-gray-700">
                                          Attachment {attIdx + 1}
                                        </span>
                                        <Download className="w-4 h-4 text-gray-400" />
                                      </>
                                    )}
                                  </a>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {ticket.status !== 'closed' && (
            <div className="mt-4 border-t pt-4 space-y-3">
              {attachmentFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  {attachmentFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-blue-200 shadow-sm"
                    >
                      {getFileIcon(file)}
                      <span className="text-sm font-medium text-gray-700 max-w-[150px] truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(idx)}
                        className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                    placeholder="Type your message..."
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 text-sm"
                      type="button"
                    >
                      <Paperclip className="w-4 h-4" />
                      Attach files
                      <span className="text-xs text-gray-500">(Images/PDF, max 5, 10MB each)</span>
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <span className="text-xs text-gray-500">{attachmentFiles.length}/5 files</span>
                  </div>
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={
                    (!newMessage.trim() && attachmentFiles.length === 0) ||
                    sendMessageMutation.isPending ||
                    uploadAttachmentsMutation.isPending
                  }
                  className="gap-2 self-end"
                >
                  {sendMessageMutation.isPending || uploadAttachmentsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TicketDetail
