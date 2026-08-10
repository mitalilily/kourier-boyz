'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { OrderAutocomplete } from '@/components/ui/OrderAutocomplete'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useCreateTicket } from '../api/support'
import { useAuthStore } from '../store/authStore'

interface TicketFormData {
  subject: string
  category: string
  description: string
  priority: string
  orderId?: string
}

const CreateTicket = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()
  const createTicketMutation = useCreateTicket()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<TicketFormData>({
    defaultValues: {
      priority: 'medium',
    },
  })

  // Pre-fill form if coming from order/return page
  useEffect(() => {
    if (location.state) {
      const state = location.state as {
        category?: string
        subject?: string
        description?: string
        orderId?: string
      }
      if (state.category) setValue('category', state.category)
      if (state.subject) setValue('subject', state.subject)
      if (state.description) setValue('description', state.description)
      if (state.orderId) setValue('orderId', state.orderId)
    }
  }, [location.state, setValue])

  const onSubmit = async (data: TicketFormData) => {
    try {
      await createTicketMutation.mutateAsync({
        subject: data.subject,
        category: data.category,
        description: data.description,
        priority: data.priority,
        orderId: data.orderId || undefined,
      })
      toast.success('Ticket created successfully!')
      navigate('/help/tickets')
    } catch (error: unknown) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } })?.response?.data?.error
          : undefined
      toast.error(errorMessage || 'Failed to create ticket')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="container mt-0 md:mt-28 mx-auto px-4 py-6 sm:py-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate('/help')} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Help Center
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-xl font-semibold mb-2">Please log in to create a ticket</h3>
            <p className="text-gray-600 mb-4">
              You need to be logged in to create a support ticket.
            </p>
            <Button onClick={() => navigate('/login?redirect=/help/tickets/new')} className="gap-2">
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mt-0 md:mt-28 mx-auto px-4 py-6 sm:py-8 max-w-3xl">
      <Button variant="ghost" onClick={() => navigate('/help/tickets')} className="mb-6 gap-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Tickets
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create Support Ticket</CardTitle>
          <CardDescription>
            Fill out the form below to create a new support ticket. Our team will get back to you as
            soon as possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FieldGroup>
              <FieldLabel htmlFor="subject">Subject *</FieldLabel>
              <Input
                id="subject"
                {...register('subject', { required: 'Subject is required' })}
                placeholder="Brief description of your issue"
              />
              {errors.subject && <FieldError>{errors.subject.message}</FieldError>}
            </FieldGroup>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldGroup>
                <FieldLabel htmlFor="category">Category *</FieldLabel>
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: 'Category is required' }}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order">Order</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="account">Account</SelectItem>
                        <SelectItem value="shipping">Shipping</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.category && <FieldError>{errors.category.message}</FieldError>}
              </FieldGroup>

              <FieldGroup>
                <FieldLabel htmlFor="priority">Priority</FieldLabel>
                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger id="priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldGroup>
            </div>

            <FieldGroup>
              <FieldLabel htmlFor="orderId">Related Order (Optional)</FieldLabel>
              <Controller
                name="orderId"
                control={control}
                render={({ field }) => (
                  <OrderAutocomplete
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search for an order by number, product, or status..."
                  />
                )}
              />
              <p className="text-xs text-gray-500 mt-1">
                Search for orders by order number, product name, or status. You can also return
                orders for products in this ticket.
              </p>
            </FieldGroup>

            <FieldGroup>
              <FieldLabel htmlFor="description">Description *</FieldLabel>
              <Textarea
                id="description"
                {...register('description', {
                  required: 'Description is required',
                  minLength: {
                    value: 10,
                    message: 'Description must be at least 10 characters',
                  },
                })}
                placeholder="Please provide detailed information about your issue..."
                rows={6}
              />
              {errors.description && <FieldError>{errors.description.message}</FieldError>}
            </FieldGroup>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/help/tickets')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createTicketMutation.isPending} className="flex-1">
                {createTicketMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Ticket'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default CreateTicket
