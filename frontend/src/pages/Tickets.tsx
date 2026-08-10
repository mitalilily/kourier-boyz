'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Clock, Info, MessageSquare, Plus, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCloseTicket, useMyTickets, type Ticket } from '../api/support'
import { useAuthStore } from '../store/authStore'

const Tickets = () => {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { data: tickets = [], isLoading, isError } = useMyTickets(
    statusFilter === 'all' ? undefined : statusFilter,
    {
      enabled: isAuthenticated, // Only fetch if authenticated
    },
  )
  const closeTicketMutation = useCloseTicket()

  const getStatusBadge = (status: Ticket['status']) => {
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

  const getPriorityBadge = (priority: Ticket['priority']) => {
    const variants: Record<string, { label: string; className: string }> = {
      low: { label: 'Low', className: 'bg-gray-100 text-gray-800' },
      medium: { label: 'Medium', className: 'bg-blue-100 text-blue-800' },
      high: { label: 'High', className: 'bg-orange-100 text-orange-800' },
      urgent: { label: 'Urgent', className: 'bg-red-100 text-red-800' },
    }
    const variant = variants[priority] || variants.medium
    return <Badge className={variant.className}>{variant.label}</Badge>
  }

  const handleCloseTicket = async (ticketId: string) => {
    try {
      await closeTicketMutation.mutateAsync(ticketId)
      toast.success('Ticket closed successfully')
    } catch {
      toast.error('Failed to close ticket')
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    'in-progress': tickets.filter((t) => t.status === 'in-progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
    closed: tickets.filter((t) => t.status === 'closed').length,
  }

  return (
    <div className="container mx-auto px-4 mt-0 md:mt-28 py-6 sm:py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Support Tickets</h1>
          <p className="text-gray-600">Manage and track your support requests</p>
        </div>
        <Button onClick={() => navigate('/help/tickets/new')} className="gap-2">
          <Plus className="w-4 h-4" />
          Create New Ticket
        </Button>
      </div>

      {/* Response Time Notice */}
      <Alert className="mb-6 border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-900 font-semibold mb-1">
          Response Time Expectation
        </AlertTitle>
        <AlertDescription className="text-blue-900">
          Our support team typically responds to tickets within <strong>24-48 hours</strong> during
          business days. You will receive updates via email when your ticket receives a response or
          status change.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-gray-500 text-sm mb-1">Total Tickets</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-gray-500 text-sm mb-1">Open</div>
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-gray-500 text-sm mb-1">In Progress</div>
            <div className="text-2xl font-bold text-yellow-600">{stats['in-progress']}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-gray-500 text-sm mb-1">Resolved</div>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-gray-500 text-sm mb-1">Closed</div>
            <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isAuthenticated ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Please log in to view your tickets</h3>
            <p className="text-gray-600 mb-4">
              You need to be logged in to view and manage your support tickets.
            </p>
            <div className="flex gap-4">
              <Button onClick={() => navigate('/login?redirect=/help/tickets')} className="gap-2">
                Log In
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/help/tickets/new')}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Ticket
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No tickets found</h3>
            <p className="text-gray-600 mb-4">
              {statusFilter !== 'all'
                ? 'No tickets match your filter criteria.'
                : "You haven't created any support tickets yet."}
            </p>
            <Button onClick={() => navigate('/help/tickets/new')} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card
              key={ticket._id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/help/tickets/${ticket._id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <CardDescription className="flex items-center gap-4 mt-2">
                      <span className="font-mono text-sm">#{ticket.ticketNumber}</span>
                      <span className="capitalize">{ticket.category}</span>
                      {ticket.assignedTo && (
                        <span className="text-sm">Assigned to: {ticket.assignedTo.name}</span>
                      )}
                    </CardDescription>
                  </div>
                  {ticket.status !== 'closed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCloseTicket(ticket._id)
                      }}
                      disabled={closeTicketMutation.isPending}
                      className="gap-2"
                    >
                      {closeTicketMutation.isPending ? (
                        <Clock className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Close
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4 line-clamp-2">{ticket.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Created: {formatDate(ticket.createdAt)}
                  </div>
                  {ticket.lastActivityAt && (
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      Last activity: {formatDate(ticket.lastActivityAt)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default Tickets
