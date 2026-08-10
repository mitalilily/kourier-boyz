'use client'

import {
  fetchPasskeyAuthenticationOptions,
  useForgotPassword,
  useForgotPasswordViaEmail,
  useForgotPasswordViaPhone,
  useGoogleOAuth,
  useLogin,
  useSendTwoFactorLoginCode,
  useVerifyTwoFactorLogin,
  verifyPasskeyAuthentication,
  type TwoFactorChallengeResponse,
} from '@/api/auth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { BackgroundBeams } from '@/components/ui/shadcn-io/background-beams'
import { GOOGLE_REDIRECT_URI } from '@/config/googleAuth'
import API from '@/lib/axios'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { guestCartUtils } from '@/utils/guestCart'
import { useGoogleLogin } from '@react-oauth/google'
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import React, { ReactNode, useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

interface LoginFormData {
  email: string
  password: string
}

interface TwoFactorFormData {
  code: string
  recoveryCode: string
  smsCode: string
}

const Login = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false)
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'options' | 'success'>(
    'email',
  )
  const [forgotPasswordOptions, setForgotPasswordOptions] = useState<{
    userId?: string
    phoneOtp: boolean
    emailLink: boolean
    maskedPhone?: string
  } | null>(null)
  const [passkeySupported, setPasskeySupported] = useState(false)

  const loginMutation = useLogin()
  const twoFactorMutation = useVerifyTwoFactorLogin()
  const sendTwoFactorLoginCode = useSendTwoFactorLoginCode()
  const forgotPasswordMutation = useForgotPassword()
  const forgotPasswordViaPhoneMutation = useForgotPasswordViaPhone()
  const forgotPasswordViaEmailMutation = useForgotPasswordViaEmail()
  const googleOAuthMutation = useGoogleOAuth()
  const setAuth = useAuthStore((state) => state.setAuth)
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<TwoFactorChallengeResponse | null>(
    null,
  )
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [twoFactorMode, setTwoFactorMode] = useState<'authenticator' | 'sms' | 'recovery'>(
    'authenticator',
  )
  const [smsSecondsRemaining, setSmsSecondsRemaining] = useState(0)
  const [smsExpiresIn, setSmsExpiresIn] = useState<number | null>(null)
  const [smsStatusMessage, setSmsStatusMessage] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Store redirect URL from query param or location state when component mounts
  const redirectUrlRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    // Store redirect URL when component mounts or URL changes
    const redirectParam = searchParams.get('redirect')
    if (redirectParam) {
      redirectUrlRef.current = redirectParam
      // Also store in sessionStorage for persistence across email verification
      sessionStorage.setItem('checkout_intent', 'true')
      sessionStorage.setItem('checkout_redirect', redirectParam)
    } else {
      // Check sessionStorage for checkout intent (from signup flow)
      const checkoutRedirect = sessionStorage.getItem('checkout_redirect')
      if (checkoutRedirect) {
        redirectUrlRef.current = checkoutRedirect
      } else {
        // Fallback to location state (for backward compatibility)
        const state = location.state as { returnTo?: string } | null
        if (state?.returnTo) {
          redirectUrlRef.current = state.returnTo
        } else {
          redirectUrlRef.current = '/'
        }
      }
    }
  }, [searchParams, location.state])

  useEffect(() => {
    if (isAuthenticated) {
      // Check if phone verification is required (from OAuth)
      const requiresPhoneVerification = sessionStorage.getItem('requires_phone_verification')
      if (requiresPhoneVerification === 'true') {
        sessionStorage.removeItem('requires_phone_verification')

        // If checkout intent exists, redirect to checkout/review (phone verification will be shown there)
        // Otherwise, redirect to profile page
        const checkoutIntent = sessionStorage.getItem('checkout_intent')
        const checkoutRedirect = sessionStorage.getItem('checkout_redirect')
        if (checkoutIntent === 'true' && checkoutRedirect) {
          // Redirect to review page - phone verification will be shown there
          navigate(checkoutRedirect, { replace: true })
        } else {
          // Redirect to profile page for phone verification
          navigate('/profile/info?verify_phone=true', { replace: true })
        }
        return
      }

      // Use stored redirect URL or fallback to reading from current URL
      // Priority: redirectUrlRef > URL param > sessionStorage > default
      const redirectFromUrl = searchParams.get('redirect')
      const redirectFromStorage = sessionStorage.getItem('checkout_redirect')
      const redirectUrl = redirectUrlRef.current || redirectFromUrl || redirectFromStorage || '/'

      // Only navigate if we're still on the login page
      if (location.pathname === '/login') {
        // Clear checkout redirect from sessionStorage after using it
        if (redirectFromStorage) {
          sessionStorage.removeItem('checkout_redirect')
        }
        navigate(redirectUrl, { replace: true })
      }
    }
  }, [isAuthenticated, navigate, location.pathname, searchParams])

  useEffect(() => {
    if (smsSecondsRemaining <= 0) return
    const timer = setTimeout(() => {
      setSmsSecondsRemaining((prev) => Math.max(prev - 1, 0))
    }, 1000)
    return () => clearTimeout(timer)
  }, [smsSecondsRemaining])

  useEffect(() => {
    if (smsExpiresIn === null || smsExpiresIn <= 0) return
    const timer = setTimeout(() => {
      setSmsExpiresIn((prev) => {
        if (prev === null) return null
        const next = prev - 1
        return next <= 0 ? null : next
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [smsExpiresIn])

  useEffect(() => {
    void (async () => {
      try {
        const supported = await browserSupportsWebAuthn()
        if (supported) {
          setPasskeySupported(true)
        }
      } catch {
        setPasskeySupported(false)
      }
    })()
  }, [])

  const showVerifyMessage = searchParams.get('verify') === 'true'
  const isBlocked = searchParams.get('blocked') === 'true'
  const blockedMessage = searchParams.get('message')
    ? decodeURIComponent(searchParams.get('message') || '')
    : null

  const form = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onChange',
  })

  const forgotPasswordForm = useForm<{ email: string }>({
    defaultValues: {
      email: '',
    },
    mode: 'onChange',
  })

  const twoFactorForm = useForm<TwoFactorFormData>({
    defaultValues: {
      code: '',
      recoveryCode: '',
      smsCode: '',
    },
    mode: 'onChange',
  })

  const authenticatorCodeValue = twoFactorForm.watch('code') ?? ''
  const recoveryCodeValue = twoFactorForm.watch('recoveryCode') ?? ''
  const smsCodeValue = twoFactorForm.watch('smsCode') ?? ''

  const queryClient = useQueryClient()

  const passkeyLoginMutation = useMutation({
    mutationFn: async (emailValue: string) => {
      const payload = emailValue ? { email: emailValue } : {}
      const optionsResponse = await fetchPasskeyAuthenticationOptions(payload)
      const assertion = await startAuthentication(optionsResponse.options)
      const authResponse = await verifyPasskeyAuthentication({
        credential: assertion,
        challenge: optionsResponse.options.challenge,
      })
      return authResponse
    },
    onSuccess: async (data) => {
      // Set token in axios defaults FIRST
      API.defaults.headers.common['Authorization'] = `Bearer ${data.token}`

      // Merge guest cart BEFORE setting auth state
      const guestCart = guestCartUtils.getCart()
      if (guestCart.length > 0) {
        try {
          console.log('Merging guest cart with', guestCart.length, 'items (Passkey)')
          const promises = guestCart.map((item) =>
            API.post('/cart', {
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              couponId: item.couponId,
            }),
          )
          await Promise.all(promises)
          console.log('Guest cart merge completed successfully (Passkey)')
          guestCartUtils.clearCart()
          window.dispatchEvent(new CustomEvent('guest-cart-updated'))
        } catch (error) {
          console.error('Failed to merge guest cart after login:', error)
          toast.error('Some items could not be added to your cart')
        }
      }

      // NOW set auth state
      setAuth(data.token, {
        userId: data.userId,
        name: data.name,
        email: data.email,
        role: data.role,
      })

      // Set flag for feedback trigger after login
      sessionStorage.setItem('just_logged_in', 'true')

      // Check if there's a pending wishlist product
      const pendingProductId = localStorage.getItem('pendingWishlistProduct')
      if (pendingProductId) {
        try {
          await API.post('/wishlist', { productId: pendingProductId })
          localStorage.removeItem('pendingWishlistProduct')
          toast.success('Product Added to wishlist!')
        } catch (error) {
          console.error('Failed to add product to wishlist after login:', error)
        }
      }

      // Invalidate and refetch cart after merge and auth is set
      if (guestCart.length > 0) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['cart'] })
          queryClient.refetchQueries({ queryKey: ['cart'] })
          toast.success('Cart items added to your account')
        }, 100)
      }

      // Redirect is handled by useEffect when isAuthenticated changes
      // The redirect URL is stored in redirectUrlRef when component mounts
    },
  })

  const resetTwoFactorFlow = () => {
    setTwoFactorChallenge(null)
    setTwoFactorMode('authenticator')
    twoFactorForm.reset({ code: '', recoveryCode: '', smsCode: '' })
    twoFactorMutation.reset()
    sendTwoFactorLoginCode.reset()
    setSmsSecondsRemaining(0)
    setSmsExpiresIn(null)
    setSmsStatusMessage(null)
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      const result = await loginMutation.mutateAsync(data)
      if (result && 'twoFactorRequired' in result && result.twoFactorRequired) {
        twoFactorMutation.reset()
        sendTwoFactorLoginCode.reset()
        setTwoFactorChallenge(result)
        setTwoFactorMode('authenticator')
        twoFactorForm.reset({ code: '', recoveryCode: '', smsCode: '' })
        setSmsSecondsRemaining(0)
        setSmsExpiresIn(null)
        setSmsStatusMessage(null)
      } else {
        resetTwoFactorFlow()
      }
    } catch (error: unknown) {
      console.error('Login error:', error)
      resetTwoFactorFlow()
      // ACCOUNT_BLOCKED is handled by axios interceptor
    }
  }

  const onForgotPassword = async (data: { email: string }) => {
    try {
      const response = await forgotPasswordMutation.mutateAsync({
        email: data.email,
        role: 'customer',
      })

      // Check if we got options (user exists and email verified)
      if (response.options && response.userId) {
        setForgotPasswordOptions({
          userId: response.userId,
          phoneOtp: response.options.phoneOtp,
          emailLink: response.options.emailLink,
          maskedPhone: response.maskedPhone,
        })
        setForgotPasswordStep('options')
      } else {
        // User not found or email not verified - show error
        // Error is already handled by the mutation error state
      }
    } catch (error: unknown) {
      console.error('Forgot password error:', error)
    }
  }

  const handleForgotPasswordViaPhone = async () => {
    if (!forgotPasswordOptions?.userId) return

    try {
      await forgotPasswordViaPhoneMutation.mutateAsync({
        userId: forgotPasswordOptions.userId,
        role: 'customer',
      })
      // Redirect to reset password page with userId to enter OTP
      navigate(`/reset-password?userId=${forgotPasswordOptions.userId}&method=phone`)
    } catch (error: unknown) {
      console.error('Error sending phone OTP:', error)
    }
  }

  const handleForgotPasswordViaEmail = async () => {
    if (!forgotPasswordOptions?.userId) return

    try {
      await forgotPasswordViaEmailMutation.mutateAsync({
        userId: forgotPasswordOptions.userId,
        role: 'customer',
      })
      setForgotPasswordStep('success')
      toast.success('Password reset link has been sent to your email!')
    } catch (error: unknown) {
      console.error('Error sending email link:', error)
    }
  }

  const resetForgotPasswordFlow = () => {
    setForgotPasswordStep('email')
    setForgotPasswordOptions(null)
    forgotPasswordForm.reset()
    forgotPasswordMutation.reset()
    forgotPasswordViaPhoneMutation.reset()
    forgotPasswordViaEmailMutation.reset()
  }

  const handleTwoFactorModeChange = (mode: 'authenticator' | 'sms' | 'recovery') => {
    setTwoFactorMode(mode)
    twoFactorForm.clearErrors()
    if (mode !== 'authenticator') {
      twoFactorForm.setValue('code', '')
    }
    if (mode !== 'recovery') {
      twoFactorForm.setValue('recoveryCode', '')
    }
    if (mode !== 'sms') {
      twoFactorForm.setValue('smsCode', '')
      setSmsStatusMessage(null)
      setSmsSecondsRemaining(0)
      setSmsExpiresIn(null)
    }
  }

  const handleTwoFactorCancel = () => {
    resetTwoFactorFlow()
  }

  const handleSendSmsCode = async () => {
    if (!twoFactorChallenge) return
    try {
      const response = await sendTwoFactorLoginCode.mutateAsync({
        token: twoFactorChallenge.twoFactorToken,
      })
      setSmsSecondsRemaining(response.retryAfter ?? 0)
      setSmsExpiresIn(response.expiresIn ?? null)
      setSmsStatusMessage(
        response.maskedPhone
          ? `Code sent to ${response.maskedPhone}.`
          : 'Verification code sent to your phone.',
      )
      twoFactorForm.setValue('smsCode', '')
      twoFactorForm.clearErrors('smsCode')
    } catch (error) {
      const axiosError = error as {
        response?: { data?: { retryAfter?: number } }
      }
      const retryAfter = axiosError?.response?.data?.retryAfter
      if (retryAfter) {
        setSmsSecondsRemaining(retryAfter)
      }
    }
  }

  const handlePasskeyLogin = async () => {
    const emailValue = form.getValues('email').trim()
    try {
      await passkeyLoginMutation.mutateAsync(emailValue)
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Unable to sign in with Face/Touch ID. Please try again.')
    }
  }

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        const result = await googleOAuthMutation.mutateAsync(codeResponse.code)
        // Handle phone verification redirect if needed
        if (result.requiresPhoneVerification) {
          // Store flag for phone verification
          sessionStorage.setItem('requires_phone_verification', 'true')

          // If checkout intent exists, redirect to checkout/review (phone verification will be shown there)
          // Otherwise, redirect to profile page
          const checkoutIntent = sessionStorage.getItem('checkout_intent')
          const checkoutRedirect = sessionStorage.getItem('checkout_redirect')
          if (checkoutIntent === 'true' && checkoutRedirect) {
            // Redirect to review page - phone verification will be shown there
            redirectUrlRef.current = checkoutRedirect
          } else {
            // Redirect to profile page for phone verification
            redirectUrlRef.current = '/profile/info?verify_phone=true'
          }
        }
      } catch (error) {
        // Error handling is done in the mutation
        console.error('Google OAuth login error:', error)
      }
    },
    onError: () => {
      toast.error('Google sign-in was cancelled or failed')
    },
    flow: 'auth-code',
    redirect_uri: GOOGLE_REDIRECT_URI, // Explicitly set redirect URI to match backend
  })

  const onSubmitTwoFactor = async (data: TwoFactorFormData) => {
    if (!twoFactorChallenge) return
    try {
      await twoFactorMutation.mutateAsync({
        token: twoFactorChallenge.twoFactorToken,
        code: twoFactorMode === 'authenticator' ? data.code.trim() : undefined,
        recoveryCode: twoFactorMode === 'recovery' ? data.recoveryCode.trim() : undefined,
        smsCode: twoFactorMode === 'sms' ? data.smsCode.trim() : undefined,
      })
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      const message =
        axiosError?.response?.data?.error ||
        (twoFactorMode === 'authenticator'
          ? 'Invalid authentication code'
          : twoFactorMode === 'sms'
          ? 'Invalid SMS verification code'
          : 'Invalid recovery code')

      if (twoFactorMode === 'authenticator') {
        twoFactorForm.setError('code', { type: 'manual', message })
      } else if (twoFactorMode === 'sms') {
        twoFactorForm.setError('smsCode', { type: 'manual', message })
      } else {
        twoFactorForm.setError('recoveryCode', { type: 'manual', message })
      }
    }
  }

  const isTwoFactorSubmitDisabled =
    twoFactorMutation.isPending ||
    (twoFactorMode === 'authenticator'
      ? authenticatorCodeValue.trim().length === 0 || !!twoFactorForm.formState.errors.code
      : twoFactorMode === 'sms'
      ? smsCodeValue.trim().length === 0 || !!twoFactorForm.formState.errors.smsCode
      : recoveryCodeValue.trim().length === 0 || !!twoFactorForm.formState.errors.recoveryCode)

  return (
    <div className="min-h-screen h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
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
        <BackgroundBeams />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-2xl">
          <CardHeader className="text-center space-y-1 px-5 pt-5 pb-3">
            <img
              src="/brand/kourier-boyz-logo.png"
              alt="Kourier Boyz"
              className="w-20 h-12 object-contain mb-2 mx-auto drop-shadow-lg"
            />
            <CardTitle className="text-xl font-bold text-slate-900">Welcome Back</CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Sign in to your account to continue shopping
            </CardDescription>
          </CardHeader>

          <CardContent className="px-5 pb-5">
            {!forgotPasswordMode ? (
              <div className="space-y-4">
                <form
                  id="login-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-2.5"
                >
                  <FieldGroup>
                    {/* Email Field */}
                    <Controller
                      name="email"
                      control={form.control}
                      rules={{
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address',
                        },
                      }}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="login-email" className="text-sm">
                            Email Address
                          </FieldLabel>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Mail className="h-4 w-4 text-slate-400" />
                            </div>
                            <Input
                              {...field}
                              id="login-email"
                              type="email"
                              className={`pl-9 h-9 rounded-xl transition-colors text-sm ${
                                fieldState.invalid
                                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                  : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                              }`}
                              placeholder="you@example.com"
                              aria-invalid={fieldState.invalid}
                              autoComplete="email"
                            />
                          </div>
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />

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
                          <FieldLabel htmlFor="login-password" className="text-sm">
                            Password
                          </FieldLabel>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <Lock className="h-4 w-4 text-slate-400" />
                            </div>
                            <Input
                              {...field}
                              id="login-password"
                              type={showPassword ? 'text' : 'password'}
                              className={`pl-9 pr-9 h-9 rounded-xl transition-colors text-sm ${
                                fieldState.invalid
                                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                  : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                              }`}
                              placeholder="••••••••"
                              aria-invalid={fieldState.invalid}
                              autoComplete="current-password"
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
                  </FieldGroup>

                  {/* Success Message - Email Verification */}
                  {showVerifyMessage && (
                    <Alert className="border-green-200 bg-green-50 mt-3">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 text-xs">
                        Please check your email to verify your account before signing in.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Blocked Account Message */}
                  {isBlocked && blockedMessage && (
                    <Alert variant="destructive" className="border-red-300 bg-red-50 mt-3">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800 text-xs">
                        <strong>Account Blocked</strong>
                        <p className="mt-1">{blockedMessage}</p>
                        <p className="mt-1.5 text-xs">
                          If you believe this is an error, please contact support.
                        </p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Error Message - Account Blocked from Login */}
                  {loginMutation.isError &&
                    (
                      loginMutation.error as {
                        response?: { data?: { error?: string } }
                      }
                    )?.response?.data?.error === 'ACCOUNT_BLOCKED' && (
                      <Alert variant="destructive" className="border-red-300 bg-red-50 mt-3">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800 text-xs">
                          <strong>Account Blocked</strong>
                          <p className="mt-1">
                            {(
                              loginMutation.error as {
                                response?: { data?: { message?: string } }
                              }
                            )?.response?.data?.message ||
                              'Your account has been blocked. Please contact support for more information.'}
                          </p>
                          <p className="mt-1.5 text-xs">
                            If you believe this is an error, please contact support.
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}

                  {/* Error Message - Other Login Errors */}
                  {loginMutation.isError &&
                    (
                      loginMutation.error as {
                        response?: { data?: { error?: string } }
                      }
                    )?.response?.data?.error !== 'ACCOUNT_BLOCKED' && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50 mt-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {(
                            loginMutation.error as {
                              response?: { data?: { error?: string } }
                            }
                          )?.response?.data?.error ||
                            'Invalid email or password. Please try again.'}
                        </AlertDescription>
                      </Alert>
                    )}

                  {/* Submit Button */}
                  <div className="mt-3">
                    <Button
                      type="submit"
                      form="login-form"
                      className="w-full h-9 rounded-xl text-sm"
                      disabled={loginMutation.isPending || form.formState.isSubmitting}
                      size="lg"
                    >
                      {loginMutation.isPending || form.formState.isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="text-right mt-2">
                    <button
                      type="button"
                      onClick={() => setForgotPasswordMode(true)}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium cursor-pointer"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </form>

                {/* Alternative Sign-In Methods */}
                <div className="mt-3">
                  <div className="relative mb-3">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">Or continue with</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {passkeySupported && (
                      <Button
                        type="button"
                        variant="outline"
                        className="group flex-1 h-9 rounded-xl border border-slate-200/80 bg-white text-slate-700 font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/20 focus-visible:ring-offset-2 focus-visible:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:bg-white disabled:hover:border-slate-200/80 transition-all duration-200 text-sm"
                        onClick={handlePasskeyLogin}
                        disabled={passkeyLoginMutation.isPending}
                        aria-label="Sign in with Touch ID"
                        aria-busy={passkeyLoginMutation.isPending}
                      >
                        {passkeyLoginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-slate-600" />
                            <span className="text-xs font-medium">Connecting...</span>
                          </>
                        ) : (
                          <>
                            <Fingerprint className="mr-1.5 h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">Touch ID</span>
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="group flex-1 h-9 rounded-xl border border-slate-200/80 bg-white text-slate-700 font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/20 focus-visible:ring-offset-2 focus-visible:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:bg-white disabled:hover:border-slate-200/80 transition-all duration-200 text-sm"
                      onClick={handleGoogleLogin}
                      disabled={googleOAuthMutation.isPending}
                      aria-label="Sign in with Google"
                      aria-busy={googleOAuthMutation.isPending}
                    >
                      {googleOAuthMutation.isPending ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-slate-600" />
                          <span className="text-xs font-medium">Signing in...</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center">
                          <svg
                            className="mr-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:scale-110"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              fill="#4285F4"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#EA4335"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                          <span className="text-xs font-semibold">Google</span>
                        </span>
                      )}
                    </Button>
                  </div>
                </div>

                {twoFactorChallenge &&
                  (() => {
                    const modeOptions: Array<{
                      value: 'authenticator' | 'sms' | 'recovery'
                      label: string
                      description: string
                      disabled?: boolean
                      icon: ReactNode
                      badge?: ReactNode
                    }> = [
                      {
                        value: 'authenticator',
                        label: 'Authenticator app',
                        description: 'Enter a 6-digit code from your authenticator',
                        icon: <ShieldCheck className="h-4 w-4" />,
                      },
                      {
                        value: 'sms',
                        label: 'Text message',
                        description: twoFactorChallenge.canUseSms
                          ? 'Send a one-time code to your phone'
                          : 'Verify your phone number to enable',
                        disabled: !twoFactorChallenge.canUseSms,
                        icon: <Smartphone className="h-4 w-4" />,
                        badge: !twoFactorChallenge.canUseSms ? (
                          <Badge
                            variant="outline"
                            className="w-fit border-amber-200 bg-amber-50 px-2 text-[10px] font-medium uppercase tracking-wide text-amber-700"
                          >
                            Phone required
                          </Badge>
                        ) : undefined,
                      },
                      {
                        value: 'recovery',
                        label: 'Recovery code',
                        description: 'Use one of your backup codes',
                        icon: <KeyRound className="h-4 w-4" />,
                      },
                    ]

                    return (
                      <div className="relative overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-md">
                        <div className="relative space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">
                                Two-factor authentication required
                              </p>
                              {typeof twoFactorChallenge.backupCodesRemaining === 'number' && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {twoFactorChallenge.backupCodesRemaining} backup codes remaining
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 border-b border-slate-200 pb-1.5">
                            {modeOptions.map((option) => {
                              const isActive = twoFactorMode === option.value
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={
                                    option.disabled
                                      ? undefined
                                      : () => handleTwoFactorModeChange(option.value)
                                  }
                                  disabled={option.disabled}
                                  className={cn(
                                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10',
                                    isActive
                                      ? 'bg-slate-900 text-white'
                                      : 'text-slate-600 hover:bg-slate-100',
                                    option.disabled &&
                                      'cursor-not-allowed opacity-50 hover:bg-transparent',
                                  )}
                                >
                                  <span className="h-3.5 w-3.5">{option.icon}</span>
                                  <span>{option.label}</span>
                                  {option.badge}
                                </button>
                              )
                            })}
                          </div>

                          <form
                            onSubmit={twoFactorForm.handleSubmit(onSubmitTwoFactor)}
                            className="space-y-2.5"
                          >
                            {twoFactorMode === 'authenticator' && (
                              <Field className="space-y-1.5">
                                <FieldLabel className="text-sm">Authenticator code</FieldLabel>
                                <div className="relative">
                                  <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                                  </div>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    placeholder="Enter 6-digit code"
                                    className="pl-9 h-9 rounded-xl border border-slate-200 bg-white text-sm focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900/20"
                                    {...twoFactorForm.register('code', {
                                      required: 'Authentication code is required',
                                      minLength: {
                                        value: 6,
                                        message: 'Code must be 6 digits',
                                      },
                                    })}
                                  />
                                </div>
                                <FieldError errors={[twoFactorForm.formState.errors.code]} />
                              </Field>
                            )}

                            {twoFactorMode === 'sms' && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={handleSendSmsCode}
                                    disabled={
                                      !twoFactorChallenge.canUseSms ||
                                      sendTwoFactorLoginCode.isPending ||
                                      smsSecondsRemaining > 0
                                    }
                                  >
                                    {sendTwoFactorLoginCode.isPending ? (
                                      <>
                                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                        Sending...
                                      </>
                                    ) : smsSecondsRemaining > 0 ? (
                                      `Resend in ${smsSecondsRemaining}s`
                                    ) : (
                                      'Send SMS code'
                                    )}
                                  </Button>
                                  {smsExpiresIn && (
                                    <span className="text-xs text-slate-500">
                                      Expires in {smsExpiresIn}s
                                    </span>
                                  )}
                                </div>
                                {smsStatusMessage && (
                                  <p className="text-xs text-slate-500">{smsStatusMessage}</p>
                                )}
                                <Field className="space-y-1.5">
                                  <FieldLabel className="text-sm">SMS verification code</FieldLabel>
                                  <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                      <Smartphone className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      autoComplete="one-time-code"
                                      placeholder="Enter 6-digit SMS code"
                                      className="pl-9 h-9 rounded-xl border border-slate-200 bg-white text-sm focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900/20"
                                      {...twoFactorForm.register('smsCode', {
                                        required: 'SMS verification code is required',
                                        minLength: {
                                          value: 6,
                                          message: 'Code must be 6 digits',
                                        },
                                      })}
                                    />
                                  </div>
                                  <FieldError errors={[twoFactorForm.formState.errors.smsCode]} />
                                </Field>
                              </div>
                            )}

                            {twoFactorMode === 'recovery' && (
                              <Field className="space-y-1.5">
                                <FieldLabel className="text-sm">Recovery code</FieldLabel>
                                <div className="relative">
                                  <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                                    <KeyRound className="h-4 w-4 text-slate-400" />
                                  </div>
                                  <Input
                                    type="text"
                                    placeholder="Enter one of your backup codes"
                                    className="pl-9 h-9 rounded-xl border border-slate-200 bg-white text-sm focus-visible:border-slate-300 focus-visible:ring-1 focus-visible:ring-slate-900/20"
                                    {...twoFactorForm.register('recoveryCode', {
                                      required: 'Recovery code is required',
                                    })}
                                  />
                                </div>
                                <FieldError
                                  errors={[twoFactorForm.formState.errors.recoveryCode]}
                                />
                              </Field>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleTwoFactorCancel}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                className="flex items-center gap-1.5 text-xs"
                                disabled={isTwoFactorSubmitDisabled}
                              >
                                {twoFactorMutation.isPending && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                                Verify &amp; continue
                              </Button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )
                  })()}
              </div>
            ) : (
              // Forgot Password Form
              <div className="space-y-3">
                <div className="mb-1">
                  <button
                    onClick={() => {
                      setForgotPasswordMode(false)
                      resetForgotPasswordFlow()
                    }}
                    className="flex items-center text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                    Back to login
                  </button>
                </div>

                {forgotPasswordStep === 'email' && (
                  <form
                    id="forgot-password-form"
                    onSubmit={forgotPasswordForm.handleSubmit(onForgotPassword)}
                    className="space-y-2.5"
                  >
                    <FieldGroup>
                      <Controller
                        name="email"
                        control={forgotPasswordForm.control}
                        rules={{
                          required: 'Email is required',
                          pattern: {
                            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                            message: 'Invalid email address',
                          },
                        }}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="forgot-email" className="text-sm">
                              Email Address
                            </FieldLabel>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Mail className="h-4 w-4 text-slate-400" />
                              </div>
                              <Input
                                {...field}
                                id="forgot-email"
                                type="email"
                                className={`pl-9 h-9 rounded-xl transition-colors text-sm ${
                                  fieldState.invalid
                                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                                    : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                                }`}
                                placeholder="you@example.com"
                                aria-invalid={fieldState.invalid}
                                autoComplete="email"
                              />
                            </div>
                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                          </Field>
                        )}
                      />
                    </FieldGroup>

                    {/* Error Message */}
                    {forgotPasswordMutation.isError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50 mt-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {(
                            forgotPasswordMutation.error as {
                              response?: { data?: { error?: string } }
                            }
                          )?.response?.data?.error || 'Failed to verify email. Please try again.'}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      form="forgot-password-form"
                      disabled={
                        forgotPasswordMutation.isPending ||
                        forgotPasswordForm.formState.isSubmitting
                      }
                      className="w-full h-9 rounded-xl font-semibold shadow-md transition-all duration-200 transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer mt-3 text-sm"
                      size="lg"
                    >
                      {forgotPasswordMutation.isPending ||
                      forgotPasswordForm.formState.isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Checking...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Continue
                        </>
                      )}
                    </Button>
                  </form>
                )}

                {forgotPasswordStep === 'options' && forgotPasswordOptions && (
                  <div className="space-y-3">
                    <div className="text-sm text-slate-600 mb-4">
                      Choose how you'd like to reset your password:
                    </div>

                    {/* Phone OTP Option */}
                    {forgotPasswordOptions.phoneOtp && (
                      <Button
                        type="button"
                        onClick={handleForgotPasswordViaPhone}
                        disabled={forgotPasswordViaPhoneMutation.isPending}
                        className="w-full h-auto py-3 rounded-xl font-semibold shadow-md transition-all duration-200 transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer text-sm flex items-center justify-center gap-2"
                        variant="outline"
                      >
                        {forgotPasswordViaPhoneMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Smartphone className="h-4 w-4" />
                            <div className="flex flex-col items-start">
                              <span>Send OTP to Phone</span>
                              {forgotPasswordOptions.maskedPhone && (
                                <span className="text-xs text-slate-500 font-normal">
                                  {forgotPasswordOptions.maskedPhone}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </Button>
                    )}

                    {/* Email Link Option */}
                    {forgotPasswordOptions.emailLink && (
                      <Button
                        type="button"
                        onClick={handleForgotPasswordViaEmail}
                        disabled={forgotPasswordViaEmailMutation.isPending}
                        className="w-full h-auto py-3 rounded-xl font-semibold shadow-md transition-all duration-200 transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer text-sm flex items-center justify-center gap-2"
                        variant="outline"
                      >
                        {forgotPasswordViaEmailMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4" />
                            <div className="flex flex-col items-start">
                              <span>Send Link to Email</span>
                              <span className="text-xs text-slate-500 font-normal">
                                {forgotPasswordForm.getValues('email')}
                              </span>
                            </div>
                          </>
                        )}
                      </Button>
                    )}

                    {/* Error Messages */}
                    {forgotPasswordViaPhoneMutation.isError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50 mt-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {(
                            forgotPasswordViaPhoneMutation.error as {
                              response?: { data?: { error?: string } }
                            }
                          )?.response?.data?.error || 'Failed to send OTP. Please try again.'}
                        </AlertDescription>
                      </Alert>
                    )}

                    {forgotPasswordViaEmailMutation.isError && (
                      <Alert variant="destructive" className="border-red-200 bg-red-50 mt-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {(
                            forgotPasswordViaEmailMutation.error as {
                              response?: { data?: { error?: string } }
                            }
                          )?.response?.data?.error || 'Failed to send email. Please try again.'}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {forgotPasswordStep === 'success' && (
                  <div className="space-y-3">
                    <Alert className="border-green-200 bg-green-50 mt-3">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 text-xs">
                        {forgotPasswordViaPhoneMutation.isSuccess
                          ? 'Password reset OTP has been sent to your phone! Please check your messages and use the code to reset your password.'
                          : 'Password reset link has been sent to your email! Please check your inbox and click the link to reset your password.'}
                      </AlertDescription>
                    </Alert>
                    <Button
                      type="button"
                      onClick={() => {
                        setForgotPasswordMode(false)
                        resetForgotPasswordFlow()
                      }}
                      className="w-full h-9 rounded-xl font-semibold shadow-md transition-all duration-200 transform hover:scale-[1.01] cursor-pointer text-sm"
                      size="lg"
                    >
                      Back to Login
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Separator className="my-3 bg-slate-200" />

            {/* Footer Links */}
            <div className="flex items-center justify-between text-xs">
              <Link to="/" className="text-slate-500 hover:text-slate-700 transition-colors">
                ← Home
              </Link>
              <span className="text-slate-500">
                Don't have an account?{' '}
                <Link to="/register" className="text-purple-600 hover:text-purple-700 font-bold">
                  Sign up
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Login
