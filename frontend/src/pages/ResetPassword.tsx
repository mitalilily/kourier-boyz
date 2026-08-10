'use client'

import { useResendPasswordResetOtp, useResetPassword } from '@/api/auth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { BackgroundBeams } from '@/components/ui/shadcn-io/background-beams'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Smartphone,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

interface ResetPasswordFormData {
  otp?: string
  password: string
  confirmPassword: string
}

const ResetPassword = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const resetPasswordMutation = useResetPassword()
  const resendOtpMutation = useResendPasswordResetOtp()

  const code = searchParams.get('code') // Phone OTP code from URL (email link flow)
  const token = searchParams.get('token') // Email reset token
  const userId = searchParams.get('userId')
  const method = searchParams.get('method') // 'phone' or null

  const form = useForm<ResetPasswordFormData>({
    defaultValues: {
      otp: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  })

  // Determine if we need OTP input (phone method without code in URL)
  const needsOtpInput = method === 'phone' && !code && userId

  useEffect(() => {
    // If we have code or token, we're good. If we have userId and method=phone, we need OTP input.
    // Otherwise, invalid.
    if (!userId) {
      toast.error('Invalid reset link. Please request a new password reset.')
      navigate('/login')
      return
    }

    // If we have code or token, we can proceed
    if (code || token) {
      return
    }

    // If method is phone but no code, we need OTP input (needsOtpInput will be true)
    if (method !== 'phone') {
      toast.error('Invalid reset link. Please request a new password reset.')
      navigate('/login')
    }
  }, [code, token, userId, method, navigate])

  useEffect(() => {
    if (resetPasswordMutation.isSuccess) {
      setResetSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    }
  }, [resetPasswordMutation.isSuccess, navigate])

  useEffect(() => {
    if (resetPasswordMutation.isError) {
      const error = resetPasswordMutation.error as {
        response?: { data?: { error?: string } }
      }
      toast.error(error.response?.data?.error || 'Failed to reset password. Please try again.')
    }
  }, [resetPasswordMutation.isError, resetPasswordMutation.error])

  // Handle resend OTP success
  useEffect(() => {
    if (resendOtpMutation.isSuccess && resendOtpMutation.data) {
      toast.success('OTP has been resent to your phone!')
      setResendCooldown(resendOtpMutation.data.retryAfter || 60)
    }
  }, [resendOtpMutation.isSuccess, resendOtpMutation.data])

  // Handle resend OTP error
  useEffect(() => {
    if (resendOtpMutation.isError) {
      const error = resendOtpMutation.error as {
        response?: { data?: { error?: string; retryAfter?: number } }
      }
      const errorMessage = error.response?.data?.error || 'Failed to resend OTP. Please try again.'
      toast.error(errorMessage)

      // Set cooldown if provided in error response
      if (error.response?.data?.retryAfter) {
        setResendCooldown(error.response.data.retryAfter)
      }
    }
  }, [resendOtpMutation.isError, resendOtpMutation.error])

  // Cooldown timer countdown
  useEffect(() => {
    if (resendCooldown <= 0) return

    const timer = setTimeout(() => {
      setResendCooldown((prev) => Math.max(prev - 1, 0))
    }, 1000)

    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleResendOtp = async () => {
    if (!userId || resendCooldown > 0) return

    try {
      await resendOtpMutation.mutateAsync({
        userId,
        role: 'customer',
      })
    } catch (error) {
      // Error is handled in useEffect
      console.error('Error resending OTP:', error)
    }
  }

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!userId) {
      toast.error('Invalid reset link')
      return
    }

    // If we need OTP input but OTP is not provided
    if (needsOtpInput && !data.otp) {
      form.setError('otp', {
        type: 'manual',
        message: 'OTP is required',
      })
      return
    }

    if (data.password !== data.confirmPassword) {
      form.setError('confirmPassword', {
        type: 'manual',
        message: 'Passwords do not match',
      })
      return
    }

    await resetPasswordMutation.mutateAsync({
      userId,
      ...(code ? { code } : {}),
      ...(data.otp ? { code: data.otp } : {}),
      ...(token ? { token } : {}),
      password: data.password,
    })
  }

  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
        {/* Shadcn Grid Pattern Background */}
        <div className="absolute inset-0 bg-grid-slate-100 mask-[linear-gradient(0deg,white,transparent)]" />

        {/* Dots Pattern Background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, rgb(0, 0, 0) 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}
        />

        {/* Background Beams */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <BackgroundBeams className="w-full h-full min-h-screen" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
          <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-3xl">
            <CardHeader className="text-center space-y-1 px-6 pt-6 pb-4">
              <div className="flex justify-center mb-4">
                <div className="w-20 h-20 bg-linear-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                Password Reset Successfully!
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Your password has been updated. Redirecting you to login page...
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    You can now log in with your new password.
                  </AlertDescription>
                </Alert>
                <Link to="/login">
                  <Button className="w-full" size="lg">
                    Go to Login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Shadcn Grid Pattern Background */}
      <div className="absolute inset-0 bg-grid-slate-100 mask-[linear-gradient(0deg,white,transparent)]" />

      {/* Dots Pattern Background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, rgb(0, 0, 0) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Background Beams */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <BackgroundBeams className="w-full h-full min-h-screen" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-3xl">
          <CardHeader className="text-center space-y-1 px-6 pt-6 pb-4">
            <img
              src="/logo-shaded.png"
              alt="Kourier Boyz"
              className="w-24 h-14 object-contain mb-3 mx-auto drop-shadow-lg"
            />
            <CardTitle className="text-2xl font-bold text-slate-900">
              {needsOtpInput ? 'Enter OTP & Create New Password' : 'Create New Password'}
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              {needsOtpInput
                ? 'Enter the OTP sent to your phone and create a new password'
                : 'Enter your new password below'}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <form
              id="reset-password-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              {/* OTP Field (only shown for phone method) */}
              {needsOtpInput && (
                <FieldGroup>
                  <Controller
                    name="otp"
                    control={form.control}
                    rules={{
                      required: 'OTP is required',
                      pattern: {
                        value: /^\d{6}$/,
                        message: 'OTP must be 6 digits',
                      },
                    }}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="reset-otp">OTP Code</FieldLabel>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Smartphone className="h-4 w-4 text-slate-400" />
                          </div>
                          <Input
                            {...field}
                            id="reset-otp"
                            type="text"
                            maxLength={6}
                            className={`pl-10 h-11 rounded-2xl transition-colors text-center text-lg tracking-widest font-mono ${
                              fieldState.invalid
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                            }`}
                            placeholder="000000"
                            aria-invalid={fieldState.invalid}
                            autoComplete="one-time-code"
                            onChange={(e) => {
                              // Only allow digits
                              const value = e.target.value.replace(/\D/g, '')
                              field.onChange(value)
                            }}
                          />
                        </div>
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-slate-500">
                            Enter the 6-digit code sent to your phone
                          </p>
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={resendCooldown > 0 || resendOtpMutation.isPending}
                            className="text-xs text-purple-600 hover:text-purple-700 font-medium disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                          >
                            {resendOtpMutation.isPending ? (
                              <>
                                <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                                Sending...
                              </>
                            ) : resendCooldown > 0 ? (
                              `Resend in ${resendCooldown}s`
                            ) : (
                              'Resend OTP'
                            )}
                          </button>
                        </div>
                      </Field>
                    )}
                  />
                </FieldGroup>
              )}

              <FieldGroup>
                {/* Password Field */}
                <Controller
                  name="password"
                  control={form.control}
                  rules={{
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="reset-password">New Password</FieldLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-4 w-4 text-slate-400" />
                        </div>
                        <Input
                          {...field}
                          id="reset-password"
                          type={showPassword ? 'text' : 'password'}
                          className={`pl-10 pr-10 h-11 rounded-2xl transition-colors ${
                            fieldState.invalid
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                          placeholder="Enter new password"
                          aria-invalid={fieldState.invalid}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

                {/* Confirm Password Field */}
                <Controller
                  name="confirmPassword"
                  control={form.control}
                  rules={{
                    required: 'Please confirm your password',
                    validate: (value) => {
                      if (value !== form.getValues('password')) {
                        return 'Passwords do not match'
                      }
                      return true
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-4 w-4 text-slate-400" />
                        </div>
                        <Input
                          {...field}
                          id="confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className={`pl-10 pr-10 h-11 rounded-2xl transition-colors ${
                            fieldState.invalid
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                          placeholder="Confirm new password"
                          aria-invalid={fieldState.invalid}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>

              {/* Error Message */}
              {resetPasswordMutation.isError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {(
                      resetPasswordMutation.error as {
                        response?: { data?: { error?: string } }
                      }
                    )?.response?.data?.error || 'Failed to reset password. Please try again.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                form="reset-password-form"
                className="w-full"
                disabled={resetPasswordMutation.isPending || form.formState.isSubmitting}
                size="lg"
              >
                {resetPasswordMutation.isPending || form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Reset Password
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/login">
                <Button
                  variant="ghost"
                  className="text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ResetPassword
