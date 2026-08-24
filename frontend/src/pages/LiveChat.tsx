'use client'

import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  XCircle,
  X as XIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io } from 'socket.io-client'
import {
  useChat,
  useCloseChat,
  useCreateChat,
  useMarkMessagesAsRead,
  useMyChats,
  useSendMessage,
} from '../api/support'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { ScrollArea } from '../components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Separator } from '../components/ui/separator'
import { useAuthStore } from '../store/authStore'

interface NewChatFormData {
  subject: string
  issueType: string
}

// Predefined resolutions for each issue type (AI-like responses)
const RESOLUTIONS: Record<string, { question: string; solutions: string[] }> = {
  order: {
    question: 'How can we help with your order?',
    solutions: [
      'Check your order status in "My Orders" section',
      'Track your order using the tracking number sent to your email',
      'Orders usually ship within 2-3 business days',
      'You can cancel your order within 24 hours of placement',
      'For order modifications, please contact us within 2 hours',
    ],
  },
  refund: {
    question: 'Need help with a refund?',
    solutions: [
      'Refunds are processed within 5-7 business days after approval',
      'Check your refund status in "My Orders" → "Refunds"',
      'Refunds are credited to your original payment method',
      'For partial refunds, contact us with your order details',
      'Return window is 7 days from delivery date',
    ],
  },
  product: {
    question: 'Having issues with a product?',
    solutions: [
      'Check product description and specifications on the product page',
      'Review customer reviews and ratings for product details',
      'Verify compatibility before purchase',
      'Contact seller directly through product page for product-specific queries',
      'Report defective products within 48 hours of delivery',
    ],
  },
  account: {
    question: 'Account related help',
    solutions: [
      'Reset your password using "Forgot Password" on login page',
      'Update profile information in "My Account" settings',
      'Verify your email address to unlock all features',
      'Check notification settings to manage alerts',
      'For account security issues, change password immediately',
    ],
  },
  shipping: {
    question: 'Shipping inquiries',
    solutions: [
      'Standard shipping takes 3-5 business days',
      'Express shipping (1-2 days) available at checkout',
      'Track your shipment using tracking number in order details',
      'Delivery is attempted 2-3 times before return to sender',
      'Update delivery address before order ships by contacting support',
    ],
  },
  payment: {
    question: 'Payment issues?',
    solutions: [
      'Failed payments are automatically refunded within 24 hours',
      'Ensure payment method has sufficient funds',
      'Check if your card/bank supports online transactions',
      'Try alternative payment methods (UPI, Wallets, Net Banking)',
      'Contact your bank if payment is deducted but order not confirmed',
    ],
  },
  other: {
    question: 'How can we assist you?',
    solutions: [
      'Browse our Help Center for detailed guides',
      'Check FAQ section for common questions',
      'Use search to find specific information',
      'Review our policies (Shipping, Returns, Privacy)',
      'For specific issues, please describe your problem below',
    ],
  },
}

const LiveChat = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { isAuthenticated, user } = useAuthStore()

  // Load state from sessionStorage on mount - but only restore active chat, not issue type selection
  const loadStateFromStorage = () => {
    try {
      const savedChatId = sessionStorage.getItem('liveChat_selectedChatId')
      // Only restore chat if it exists - don't restore issue type selection
      // Issue type should start fresh each time user comes to the page
      return {
        chatId: savedChatId || null,
        issueType: '', // Always start fresh - don't restore previous selection
        showChatInterface: savedChatId ? true : false, // Only true if we have a chat to restore
        showResolutions: false, // Always start fresh
      }
    } catch {
      return {
        chatId: null,
        issueType: '',
        showChatInterface: false,
        showResolutions: false,
      }
    }
  }

  const savedState = loadStateFromStorage()

  const [selectedChatId, setSelectedChatId] = useState<string | null>(savedState.chatId)
  const [newMessage, setNewMessage] = useState('')
  const [showResolutions, setShowResolutions] = useState(savedState.showResolutions)
  const [selectedIssueType, setSelectedIssueType] = useState<string>(savedState.issueType)
  const [showChatInterface, setShowChatInterface] = useState(savedState.showChatInterface)
  const [contextOrderId, setContextOrderId] = useState<string | undefined>(undefined)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<ReturnType<typeof io> | null>(null)

  // Only save selectedChatId to sessionStorage - don't persist issue type selection
  // This allows users to start fresh each time they visit the page
  useEffect(() => {
    if (selectedChatId) {
      sessionStorage.setItem('liveChat_selectedChatId', selectedChatId)
    } else {
      sessionStorage.removeItem('liveChat_selectedChatId')
      // Clear issue type related storage when no chat is selected
      sessionStorage.removeItem('liveChat_issueType')
      sessionStorage.removeItem('liveChat_showResolutions')
      sessionStorage.removeItem('liveChat_showChatInterface')
    }
  }, [selectedChatId])

  // Don't persist issue type to sessionStorage - let it reset on page reload
  // Only keep it in memory during the current session

  const { data: chats = [] } = useMyChats()
  const { data: chatData } = useChat(selectedChatId || '')
  const createChatMutation = useCreateChat()
  const sendMessageMutation = useSendMessage()
  const markAsReadMutation = useMarkMessagesAsRead()
  const closeChatMutation = useCloseChat()

  // Get open/active chats (non-closed) for sidebar
  const openChats = chats.filter((chat) => {
    const status = chat.status as string
    return status !== 'closed'
  })

  const newChatForm = useForm<NewChatFormData>({
    defaultValues: {
      subject: '',
      issueType: '',
    },
    mode: 'onChange',
  })

  // Pre-fill from query params when coming from an orders/product context
  useEffect(() => {
    const issueTypeFromQuery = searchParams.get('issueType') || ''
    const orderIdFromQuery = searchParams.get('orderId') || undefined
    const subjectFromQuery = searchParams.get('subject') || ''

    if (orderIdFromQuery) {
      setContextOrderId(orderIdFromQuery)
    }

    if (issueTypeFromQuery) {
      setSelectedIssueType(issueTypeFromQuery)
      setShowResolutions(true)
      setShowChatInterface(false)
    }

    if (subjectFromQuery || issueTypeFromQuery) {
      newChatForm.reset({
        subject: subjectFromQuery || newChatForm.getValues('subject'),
        issueType: issueTypeFromQuery || newChatForm.getValues('issueType'),
      })
    }
  }, [searchParams, newChatForm])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/chat')
      return
    }

    // Connect to Socket.io
    const socket = io(
      import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000',
      {
        transports: ['websocket'],
      },
    )

    socket.on('connect', () => {
      socket.emit('register', { userId: user?.userId, role: 'customer' })
    })

    socket.on('supportChat:message', (data: { chatId: string }) => {
      if (data.chatId === selectedChatId) {
        // Invalidate and refetch chat data without reloading page
        queryClient.invalidateQueries({ queryKey: ['supportChat', data.chatId] })
        queryClient.invalidateQueries({ queryKey: ['supportChats', 'my'] })
      }
    })

    socket.on('supportChat:assigned', (data: { chatId: string }) => {
      if (data.chatId === selectedChatId) {
        // Invalidate and refetch chat data without reloading page
        // This updates the UI but keeps the chat interface open
        queryClient.invalidateQueries({ queryKey: ['supportChat', data.chatId] })
        queryClient.invalidateQueries({ queryKey: ['supportChats', 'my'] })
        // Ensure chat interface stays visible
        setShowChatInterface(true)
        setShowResolutions(false)
      }
    })

    socket.on('supportChat:statusUpdate', (data: { chatId: string }) => {
      if (data.chatId === selectedChatId) {
        // Invalidate chat data to show closed status
        queryClient.invalidateQueries({ queryKey: ['supportChat', data.chatId] })
        queryClient.invalidateQueries({ queryKey: ['supportChats', 'my'] })
      }
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
    }
  }, [isAuthenticated, navigate, user?.userId, selectedChatId, queryClient])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatData?.messages])

  useEffect(() => {
    if (selectedChatId && chatData?.messages) {
      const unreadMessages = chatData.messages.filter(
        (msg) => !msg.read && msg.senderId._id !== user?.userId,
      )
      if (unreadMessages.length > 0) {
        markAsReadMutation.mutate(selectedChatId)
      }
    }
  }, [selectedChatId, chatData?.messages, user?.userId, markAsReadMutation])

  const handleIssueTypeChange = (issueType: string) => {
    setSelectedIssueType(issueType)
    setShowResolutions(true)
    setShowChatInterface(false)
    setSelectedChatId(null) // Reset chat when changing issue type
  }

  const handleResolutionHelpful = (helpful: boolean) => {
    if (!helpful) {
      setShowChatInterface(true)
      setShowResolutions(false)
    } else {
      // Resolution helped - clear saved state and navigate
      sessionStorage.removeItem('liveChat_selectedChatId')
      sessionStorage.removeItem('liveChat_issueType')
      sessionStorage.removeItem('liveChat_showChatInterface')
      sessionStorage.removeItem('liveChat_showResolutions')
      navigate('/')
    }
  }

  const handleStartChat = async () => {
    if (!selectedIssueType || !newChatForm.formState.isValid) {
      return
    }

    try {
      const chat = await createChatMutation.mutateAsync({
        subject: newChatForm.getValues('subject') || `${selectedIssueType} issue`,
        issueType: selectedIssueType,
        orderId: contextOrderId,
      })
      setSelectedChatId(chat._id)
      setShowChatInterface(true)
      setShowResolutions(false)
      newChatForm.reset()
    } catch (error) {
      console.error('Error creating chat:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChatId) return
    // Check if chat is closed
    const chatStatus = chatData?.chat.status as string
    if (chatStatus === 'closed') return

    try {
      await sendMessageMutation.mutateAsync({
        chatId: selectedChatId,
        message: newMessage,
      })
      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleCloseChat = async () => {
    if (!selectedChatId) return

    try {
      await closeChatMutation.mutateAsync(selectedChatId)
    } catch (error) {
      console.error('Error closing chat:', error)
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

  if (!isAuthenticated) {
    return null
  }

  // Only show resolutions if both state and form value are set
  const activeIssueType = selectedIssueType || newChatForm.watch('issueType') || ''
  const currentResolutions =
    activeIssueType && !selectedChatId ? RESOLUTIONS[activeIssueType] || RESOLUTIONS.other : null

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-slate-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-0" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100/40 via-pink-50/30 to-orange-50/30 -z-0" />
      <div className="absolute inset-0 opacity-40 -z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-4xl pt-20 mx-auto">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-3xl">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl mb-4 shadow-lg mx-auto">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-slate-900">Live Chat Support</CardTitle>
            <CardDescription className="text-base text-slate-600">
              Get instant help with our AI assistant or chat with support
            </CardDescription>
          </CardHeader>

          <CardContent>
            {/* Layout: Active Chats List on left, AI Chat/New Chat on right */}
            {!showChatInterface && !selectedChatId ? (
              // AI Chat View - Show side by side with active chats
              <div className="grid md:grid-cols-3 gap-6">
                {/* Left Sidebar: Active Chats List - Always visible when there are open chats */}
                {openChats.length > 0 && (
                  <div className="md:col-span-1">
                    <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 sticky top-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-900">Your Active Chats</h3>
                        <span className="text-xs text-slate-600 bg-purple-100 px-2 py-1 rounded-full">
                          {openChats.length}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-[500px] overflow-y-auto">
                        {openChats.map((chat) => (
                          <motion.button
                            key={chat._id}
                            onClick={() => {
                              setSelectedChatId(chat._id)
                              setShowChatInterface(true)
                              setShowResolutions(false)
                              setSelectedIssueType(chat.issueType || '')
                            }}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              selectedChatId === chat._id
                                ? 'border-purple-500 bg-purple-100 shadow-md'
                                : 'border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/50'
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-900 truncate">
                                  {chat.subject || 'Chat'}
                                </p>
                                <p className="text-xs text-slate-600 mt-1">
                                  {chat.issueType || 'General'}
                                  {chat.assignedTo && ` • ${chat.assignedTo.name}`}
                                </p>
                                {chat.lastMessageAt && (
                                  <p className="text-xs text-slate-400 mt-1">
                                    {formatTime(chat.lastMessageAt)}
                                  </p>
                                )}
                              </div>
                              <MessageCircle
                                className={`h-4 w-4 mt-1 flex-shrink-0 ${
                                  selectedChatId === chat._id ? 'text-purple-600' : 'text-slate-400'
                                }`}
                              />
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Right Side: AI Chat Interface */}
                <div className={`${openChats.length > 0 ? 'md:col-span-2' : 'md:col-span-3'}`}>
                  {/* Initial Resolution Screen */}
                  <div className="space-y-6">
                    {!selectedIssueType && !newChatForm.watch('issueType') ? (
                      // Issue Type Selection
                      <div className="space-y-4">
                        <FieldGroup>
                          <Field>
                            <FieldLabel className="text-lg font-semibold">
                              {openChats.length > 0
                                ? 'Start a New Chat'
                                : 'What do you need help with?'}
                            </FieldLabel>
                            <Controller
                              name="issueType"
                              control={newChatForm.control}
                              rules={{ required: 'Please select an issue type' }}
                              render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                  <Select
                                    key={`select-${selectedIssueType || 'empty'}-${
                                      newChatForm.watch('issueType') || 'none'
                                    }`} // Force re-render when reset
                                    value={field.value || ''}
                                    onValueChange={(value) => {
                                      field.onChange(value)
                                      handleIssueTypeChange(value)
                                    }}
                                  >
                                    <SelectTrigger className="h-12 border-slate-200 focus:border-purple-500 focus:ring-purple-500/20">
                                      <SelectValue placeholder="Select your issue type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="order">Order</SelectItem>
                                      <SelectItem value="refund">Refund</SelectItem>
                                      <SelectItem value="product">Product</SelectItem>
                                      <SelectItem value="account">Account</SelectItem>
                                      <SelectItem value="shipping">Shipping</SelectItem>
                                      <SelectItem value="payment">Payment</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                </Field>
                              )}
                            />
                          </Field>
                        </FieldGroup>
                      </div>
                    ) : activeIssueType && showResolutions && currentResolutions ? (
                      // Show AI-like Resolutions
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        <div className="flex items-start gap-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 rounded-full flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 mb-3">
                              {currentResolutions.question}
                            </h3>
                            <div className="space-y-2">
                              {currentResolutions.solutions.map((solution, index) => (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="flex items-start gap-2 text-sm text-slate-700"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                  <span>{solution}</span>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                          <Button
                            onClick={() => handleResolutionHelpful(true)}
                            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white h-11"
                            size="lg"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            This Solved My Issue
                          </Button>
                          <Button
                            onClick={() => handleResolutionHelpful(false)}
                            variant="outline"
                            className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-50 h-11"
                            size="lg"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Need More Help
                          </Button>
                        </div>
                      </motion.div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : selectedChatId && chatData ? (
              // Chat Interface - Full width when viewing a chat
              <div className="space-y-4">
                {/* Show active chats sidebar when viewing a chat */}
                {openChats.length > 1 && (
                  <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-200">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">Switch Chat</h4>
                    <ScrollArea className="max-h-32">
                      <div className="space-y-1.5">
                        {openChats
                          .filter((chat) => chat._id !== selectedChatId)
                          .map((chat) => (
                            <motion.button
                              key={chat._id}
                              onClick={() => {
                                setSelectedChatId(chat._id)
                                setShowChatInterface(true)
                                setShowResolutions(false)
                              }}
                              className="w-full text-left p-2 rounded border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50/50 text-xs"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <p className="font-medium text-slate-900 truncate">
                                {chat.subject || 'Chat'}
                              </p>
                              <p className="text-slate-500 mt-0.5">
                                {chat.issueType} {chat.assignedTo && `• ${chat.assignedTo.name}`}
                              </p>
                            </motion.button>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex flex-col h-[600px]">
                  <div className="pb-4 border-b border-slate-200 mb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 text-lg">
                          {chatData.chat.subject || 'Chat'}
                        </h3>
                        <p className="text-sm text-slate-600 mt-1">
                          {(chatData.chat.status as string) === 'closed' ? (
                            <span className="text-red-600 font-medium">Chat has been closed</span>
                          ) : chatData.chat.assignedTo ? (
                            `Assigned to: ${chatData.chat.assignedTo.name}`
                          ) : (
                            'Waiting for assignment...'
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Complete reset of all chat-related state
                            setSelectedChatId(null)
                            setShowChatInterface(false)
                            setShowResolutions(false)
                            setSelectedIssueType('')
                            // Clear sessionStorage
                            sessionStorage.removeItem('liveChat_selectedChatId')
                            sessionStorage.removeItem('liveChat_issueType')
                            sessionStorage.removeItem('liveChat_showResolutions')
                            sessionStorage.removeItem('liveChat_showChatInterface')
                            // Reset form completely
                            newChatForm.reset({
                              subject: '',
                              issueType: '',
                            })
                            // Force form to clear issueType field
                            newChatForm.setValue('issueType', '')
                            // Clear the form's internal state
                            newChatForm.resetField('issueType')
                          }}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Back
                        </Button>
                        {(chatData?.chat.status as string) !== 'closed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCloseChat}
                            disabled={closeChatMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                          >
                            <XIcon className="mr-2 h-4 w-4" />
                            {closeChatMutation.isPending ? 'Closing...' : 'Close'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 mb-4 pr-4">
                    <div className="space-y-4">
                      {chatData.messages.map((message) => {
                        const isMe = message.senderId._id === user?.userId
                        return (
                          <motion.div
                            key={message._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl p-4 ${
                                isMe
                                  ? 'bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white'
                                  : 'bg-slate-100 text-slate-900'
                              }`}
                            >
                              <p className="text-xs font-semibold mb-1 opacity-80">
                                {message.senderId.name}
                              </p>
                              <p className="text-sm leading-relaxed">{message.message}</p>
                              <div className="flex items-center justify-end mt-2">
                                <span className="text-xs opacity-70">
                                  {formatTime(message.createdAt)}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  <div className="pt-4 border-t border-slate-200">
                    {(chatData.chat.status as string) === 'closed' ? (
                      <div className="text-center py-4">
                        <Alert>
                          <AlertDescription className="text-center">
                            This chat has been closed. Start a new chat if you need further
                            assistance.
                          </AlertDescription>
                        </Alert>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) =>
                            e.key === 'Enter' && !e.shiftKey && handleSendMessage()
                          }
                          placeholder="Type a message..."
                          className="flex-1 h-11 border-slate-200 focus:border-purple-500 focus:ring-purple-500/20"
                          disabled={(chatData.chat.status as string) === 'closed'}
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={
                            !newMessage.trim() ||
                            sendMessageMutation.isPending ||
                            (chatData.chat.status as string) === 'closed'
                          }
                          className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white h-11 px-6"
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : showChatInterface && !selectedChatId ? (
              // Chat Form (when resolutions don't help) - Full width
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    We couldn't find a solution. Let's connect you with our support team.
                  </AlertDescription>
                </Alert>
                <form onSubmit={newChatForm.handleSubmit(handleStartChat)} className="space-y-4">
                  <FieldGroup>
                    <Controller
                      name="subject"
                      control={newChatForm.control}
                      rules={{ required: 'Subject is required' }}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel>Subject</FieldLabel>
                          <Input
                            {...field}
                            placeholder="Brief description of your issue"
                            className={`h-11 ${
                              fieldState.invalid
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                            }`}
                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  </FieldGroup>

                  <Button
                    type="submit"
                    disabled={createChatMutation.isPending || !newChatForm.formState.isValid}
                    className="w-full h-11 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white"
                    size="lg"
                  >
                    {createChatMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      'Start Chat with Support'
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-slate-500">
                <div className="text-center">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 text-slate-400 animate-spin" />
                  <p>Loading chat...</p>
                </div>
              </div>
            )}

            <Separator className="my-6 bg-slate-200" />

            {/* Help Links */}
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-600">Need more help?</p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="link"
                  onClick={() => navigate('/help')}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Browse Help Center →
                </Button>
                <Button
                  variant="link"
                  onClick={() => navigate('/contact')}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Contact Us →
                </Button>
              </div>
            </div>

            {/* Back to Home */}
            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                onClick={() => navigate('/')}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default LiveChat
