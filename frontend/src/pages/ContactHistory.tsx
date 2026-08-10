'use client'

import { useMyContactForms } from '@/api/support'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store/authStore'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const ContactHistory = () => {
  const { isAuthenticated } = useAuthStore()
  const { data: forms = [], isLoading } = useMyContactForms()

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: {
        label: 'New',
        icon: Clock,
        className: 'bg-blue-100 text-blue-700 border-blue-200',
      },
      'in-progress': {
        label: 'In Progress',
        icon: Clock,
        className: 'bg-yellow/20 text-yellow-dark border-yellow/30',
      },
      resolved: {
        label: 'Resolved',
        icon: CheckCircle2,
        className: 'bg-green-100 text-green-700 border-green-200',
      },
      closed: {
        label: 'Closed',
        icon: XCircle,
        className: 'bg-gray-100 text-gray-700 border-gray-200',
      },
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new
    const Icon = config.icon

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.className}`}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, string> = {
      general: 'General Inquiry',
      order: 'Order Issue',
      refund: 'Refund Request',
      product: 'Product Question',
      account: 'Account Issue',
      technical: 'Technical Support',
      feedback: 'Feedback',
    }
    return categoryMap[category] || category
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
            <CardDescription>Please login to view your contact history</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/login">
              <Button className="w-full">Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 py-12">
      <div className=" mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link to="/contact">
            <Button variant="ghost" className="mb-4 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Contact Form
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Contact History</h1>
          <p className="text-gray-600">View all your contact form submissions and responses</p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && forms.length === 0 && (
          <Card className="border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Contact Forms Yet</h3>
              <p className="text-gray-600 mb-6">
                You haven't submitted any contact forms yet. Submit one to get started!
              </p>
              <Link to="/contact">
                <Button>Submit Contact Form</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Contact Forms List */}
        {!isLoading && forms.length > 0 && (
          <div className="space-y-4">
            {forms.map((form) => (
              <Card
                key={form._id}
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <CardTitle className="text-xl">{form.subject}</CardTitle>
                        {getStatusBadge(form.status)}
                      </div>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-4 h-4" />
                          {getCategoryLabel(form.category)}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Mail className="w-4 h-4" />
                          {new Date(form.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Message */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Your Message</h4>
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-700 whitespace-pre-wrap">{form.message}</p>
                    </div>
                  </div>

                  {/* Response */}
                  {form.response ? (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        Admin Response
                        {form.respondedBy && (
                          <span className="text-xs font-normal text-gray-500">
                            by {form.respondedBy.name}
                          </span>
                        )}
                        {form.respondedAt && (
                          <span className="text-xs font-normal text-gray-500">
                            on{' '}
                            {new Date(form.respondedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </h4>
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-gray-700 whitespace-pre-wrap">{form.response}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-yellow/10 rounded-lg border border-yellow/30">
                      <p className="text-sm text-yellow-dark flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Waiting for admin response...
                      </p>
                    </div>
                  )}

                  {/* Additional Info */}
                  <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-200">
                    {form.phone && (
                      <div className="text-sm text-gray-600">
                        <strong>Phone:</strong> {form.phone}
                      </div>
                    )}
                    {form.email && (
                      <div className="text-sm text-gray-600">
                        <strong>Email:</strong> {form.email}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContactHistory
