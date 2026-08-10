'use client'

import { useSubmitContactForm } from '@/api/support'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/store/authStore'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Loader2, Mail, MessageSquare, Phone, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'

interface ContactFormData {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  category?: string
}

const ContactUs = () => {
  const [submitted, setSubmitted] = useState(false)
  const submitMutation = useSubmitContactForm()
  const { isAuthenticated, user } = useAuthStore()

  const form = useForm<ContactFormData>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      category: 'general',
    },
    mode: 'onChange',
  })

  // Pre-fill form with user data if logged in
  useEffect(() => {
    if (isAuthenticated && user) {
      form.setValue('name', user.name || '', { shouldValidate: false })
      form.setValue('email', user.email || '', { shouldValidate: false })
      form.trigger(['name', 'email'])
    }
  }, [isAuthenticated, user, form])

  const onSubmit = async (data: ContactFormData) => {
    try {
      // Use user data if authenticated
      const submitData =
        isAuthenticated && user
          ? {
              ...data,
              name: user.name || data.name,
              email: user.email || data.email,
            }
          : data

      await submitMutation.mutateAsync(submitData)
      setSubmitted(true)
      form.reset()
    } catch (error: unknown) {
      console.error('Contact form error:', error)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        {/* Professional Grid Pattern Background */}
        <div className="absolute inset-0 bg-grid-slate-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-0" />

        {/* Subtle Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100/40 via-purple-50/30 to-blue-50/30 -z-0" />

        {/* Subtle Dots Pattern */}
        <div className="absolute inset-0 opacity-30 -z-0 bg-[radial-gradient(circle_at_1px_1px,rgb(156,146,172)_0.5px,transparent_0)] [background-size:20px_20px]" />

        {/* Animated Background Elements */}
        <motion.div
          className="absolute top-20 left-20 w-72 h-72 bg-purple-300/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, 30, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-72 h-72 bg-pink-300/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -40, 0],
            y: [0, -50, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative z-10 w-full max-w-xl"
        >
          <Card className="bg-white/95 backdrop-blur-sm shadow-2xl border border-slate-200/50 rounded-3xl overflow-hidden">
            {/* Success Header with Gradient */}
            <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 px-8 py-6 text-center relative overflow-hidden">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 200,
                  damping: 15,
                }}
                className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4 shadow-lg mx-auto"
              >
                <CheckCircle2 className="w-10 h-10 text-white" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-white mb-2"
              >
                Thank You!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-white/90 text-sm"
              >
                Your message has been sent successfully
              </motion.p>
            </div>

            <CardContent className="pt-8 pb-8 px-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-center mb-8"
              >
                <p className="text-slate-700 text-base leading-relaxed mb-4">
                  We've received your message and our team will get back to you within{' '}
                  <span className="font-semibold text-purple-600">24 hours</span>.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Mail className="w-4 h-4" />
                  <span>We'll send a response to your email</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-3 justify-center"
              >
                <Button
                  onClick={() => setSubmitted(false)}
                  variant="outline"
                  className="border-slate-300 hover:bg-slate-50 transition-all"
                  size="lg"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Send Another
                </Button>
                {isAuthenticated && (
                  <Link to="/contact/history" className="flex-1 sm:flex-initial">
                    <Button
                      variant="default"
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl transition-all"
                      size="lg"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      View History
                    </Button>
                  </Link>
                )}
                <Link to="/" className="flex-1 sm:flex-initial">
                  <Button
                    className="w-full sm:w-auto bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white shadow-lg hover:shadow-xl transition-all"
                    size="lg"
                  >
                    Back to Home
                  </Button>
                </Link>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden mt-20 py-12">
      {/* Professional Grid Pattern Background */}
      <div className="absolute inset-0 bg-grid-slate-100/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-0" />

      {/* Subtle Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100/40 via-pink-50/30 to-orange-50/30 -z-0" />

      {/* Subtle Dots Pattern */}
      <div className="absolute inset-0 opacity-30 -z-0 bg-[radial-gradient(circle_at_1px_1px,rgb(156,146,172)_0.5px,transparent_0)] [background-size:20px_20px]" />

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header with View History Link */}
        {isAuthenticated && (
          <div className="mb-6 flex justify-end">
            <Link to="/contact/history">
              <Button variant="outline" className="border-slate-200">
                <MessageSquare className="mr-2 h-4 w-4" />
                View History
              </Button>
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Contact Cards */}
          <Card className="bg-white/95 backdrop-blur-sm shadow-lg border border-slate-200/50 hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Email Us</h3>
                  <p className="text-sm text-slate-600">support@kourierboyz.com</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/95 backdrop-blur-sm shadow-lg border border-slate-200/50 hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Call Us</h3>
                  <p className="text-sm text-slate-600">+91 1234567890</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* <Card className="bg-white/95 backdrop-blur-sm shadow-lg border border-slate-200/50 hover:shadow-xl transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Live Chat</h3>
                  <p className="text-sm text-slate-600">Available 24/7</p>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>

        <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-3xl">
          <CardHeader className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl mb-4 shadow-lg mx-auto">
              <MessageSquare className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold text-slate-900">Contact Us</CardTitle>
            <CardDescription className="text-base text-slate-600">
              We're here to help! Send us a message and we'll get back to you soon.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form id="contact-form" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                {isAuthenticated && user && (
                  <Alert className="border-blue-200 bg-blue-50 mb-4">
                    <User className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <strong>Logged in as:</strong> {user.name} ({user.email})
                      <span className="block mt-1 text-sm text-blue-700">
                        Your contact information will be used automatically.
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Name Field */}
                <Controller
                  name="name"
                  control={form.control}
                  rules={{
                    required: !isAuthenticated ? 'Name is required' : false,
                    minLength: !isAuthenticated
                      ? {
                          value: 2,
                          message: 'Name must be at least 2 characters',
                        }
                      : undefined,
                  }}
                  render={({ field, fieldState }) =>
                    !isAuthenticated ? (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="contact-name">Full Name *</FieldLabel>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-5 w-5 text-slate-400" />
                          </div>
                          <Input
                            {...field}
                            id="contact-name"
                            type="text"
                            className={`pl-10 h-11 transition-colors ${
                              fieldState.invalid
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                            }`}
                            placeholder="Your full name"
                            aria-invalid={fieldState.invalid}
                            autoComplete="name"
                          />
                        </div>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    ) : (
                      <input type="hidden" {...field} />
                    )
                  }
                />

                {/* Email Field */}
                <Controller
                  name="email"
                  control={form.control}
                  rules={{
                    required: !isAuthenticated ? 'Email is required' : false,
                    pattern: !isAuthenticated
                      ? {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        }
                      : undefined,
                  }}
                  render={({ field, fieldState }) =>
                    !isAuthenticated ? (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="contact-email">Email Address *</FieldLabel>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-slate-400" />
                          </div>
                          <Input
                            {...field}
                            id="contact-email"
                            type="email"
                            className={`pl-10 h-11 transition-colors ${
                              fieldState.invalid
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                            }`}
                            placeholder="your.email@example.com"
                            aria-invalid={fieldState.invalid}
                            autoComplete="email"
                          />
                        </div>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    ) : (
                      <input type="hidden" {...field} />
                    )
                  }
                />

                {/* Phone Field - shown for everyone */}
                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="contact-phone">Phone Number (Optional)</FieldLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-5 w-5 text-slate-400" />
                        </div>
                        <Input
                          {...field}
                          id="contact-phone"
                          type="tel"
                          className={`pl-10 h-11 transition-colors ${
                            fieldState.invalid
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                          placeholder="+91 9876543210"
                          aria-invalid={fieldState.invalid}
                          autoComplete="tel"
                        />
                      </div>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                {/* Subject Field */}
                <Controller
                  name="subject"
                  control={form.control}
                  rules={{
                    required: 'Subject is required',
                    minLength: {
                      value: 3,
                      message: 'Subject must be at least 3 characters',
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="contact-subject">Subject *</FieldLabel>
                      <Input
                        {...field}
                        id="contact-subject"
                        type="text"
                        className={`h-11 transition-colors ${
                          fieldState.invalid
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                        }`}
                        placeholder="What is this regarding?"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                {/* Category Field - Optional */}
                <Controller
                  name="category"
                  control={form.control}
                  render={({ field }) => (
                    <Field>
                      <FieldLabel htmlFor="contact-category">Inquiry Type (Optional)</FieldLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id="contact-category"
                          className="h-11 border-slate-200 focus:border-purple-500 focus:ring-purple-500/20"
                        >
                          <SelectValue placeholder="Select inquiry type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General Inquiry</SelectItem>
                          <SelectItem value="order">Order Issue</SelectItem>
                          <SelectItem value="refund">Refund Request</SelectItem>
                          <SelectItem value="product">Product Question</SelectItem>
                          <SelectItem value="account">Account Issue</SelectItem>
                          <SelectItem value="technical">Technical Support</SelectItem>
                          <SelectItem value="feedback">Feedback</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />

                {/* Message Field */}
                <Controller
                  name="message"
                  control={form.control}
                  rules={{
                    required: 'Message is required',
                    minLength: {
                      value: 10,
                      message: 'Message must be at least 10 characters',
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="contact-message">Message *</FieldLabel>
                      <Textarea
                        {...field}
                        id="contact-message"
                        rows={6}
                        className={`transition-colors ${
                          fieldState.invalid
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                        }`}
                        placeholder="Please provide details about your inquiry..."
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>

              {/* Error Message */}
              {submitMutation.isError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50 mt-5">
                  <AlertDescription>
                    {(
                      submitMutation.error as {
                        response?: { data?: { error?: string } }
                      }
                    )?.response?.data?.error || 'Failed to send message. Please try again.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                form="contact-form"
                disabled={submitMutation.isPending || form.formState.isSubmitting}
                className="w-full h-11 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white font-semibold shadow-md transition-all duration-200 transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none mt-5"
                size="lg"
              >
                {submitMutation.isPending || form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </form>

            <Separator className="my-6 bg-slate-200" />

            {/* Help Links */}
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-600">Need immediate help?</p>
              <div className="flex gap-3 justify-center">
                <Link to="/help">
                  <Button
                    variant="link"
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Browse Help Center →
                  </Button>
                </Link>
                {/* <Link to="/chat">
                  <Button
                    variant="link"
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Start Live Chat →
                  </Button>
                </Link> */}
              </div>
            </div>

            {/* Back to Home Link */}
            <div className="mt-6 text-center">
              <Link to="/">
                <Button variant="ghost" className="text-sm text-slate-600 hover:text-slate-900">
                  ← Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ContactUs
