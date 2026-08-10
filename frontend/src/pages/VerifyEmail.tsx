'use client'

import { useResendPhoneCode, useVerifyPhone } from '@/api/auth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import API from '@/lib/axios'
import { guestCartUtils } from '@/utils/guestCart'
import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'

interface PhoneVerifyFormData {
  code: string
}

const VerifyEmail = () => {
  const { token } = useParams()
  const navigate = useNavigate()

  const [status, setStatus] = useState<
    'loading' | 'email-success' | 'phone-verify' | 'success' | 'error'
  >('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [hasVerified, setHasVerified] = useState<boolean>(false)

  const verifyPhoneMutation = useVerifyPhone()
  const resendPhoneCodeMutation = useResendPhoneCode()

  const phoneForm = useForm<PhoneVerifyFormData>({
    defaultValues: {
      code: '',
    },
  })

  useEffect(() => {
    if (token && !hasVerified) {
      const verifyEmail = async () => {
        try {
          setHasVerified(true)
          const response = await API.get(`/auth/verify-email/${token}`)

          if (response.data.message) {
            setUserId(response.data.userId)
            setPhoneNumber(response.data.phoneNumber || '')

            // Store guest cart items if checkout intent exists (for after login)
            // Account is created now (email verified), so preserve guest cart items
            const hasCheckoutIntent = sessionStorage.getItem('checkout_intent') === 'true'
            if (hasCheckoutIntent) {
              const guestCart = guestCartUtils.getCart()
              if (guestCart.length > 0) {
                const guestCartItems = guestCart.map((item) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                }))
                sessionStorage.setItem('guest_cart_items', JSON.stringify(guestCartItems))
              }
            }

            if (response.data.needsPhoneVerification && response.data.phoneNumber) {
              setStatus('phone-verify')
            } else {
              setStatus('success')
            }
          } else {
            setStatus('error')
            setErrorMessage('Email verification failed. Please try again.')
          }
        } catch (error: unknown) {
          setStatus('error')
          const err = error as { response?: { data?: { error?: string } } }
          setErrorMessage(
            err?.response?.data?.error || 'Email verification failed. Please try again.',
          )
        }
      }
      void verifyEmail()
    } else if (!token) {
      setStatus('error')
      setErrorMessage('Invalid or missing verification link.')
    }
  }, [token, hasVerified])

  const onVerifyPhone = async (data: PhoneVerifyFormData) => {
    try {
      await verifyPhoneMutation.mutateAsync({ userId, code: data.code })
      setStatus('success')
      
      // Store guest cart items if checkout intent exists (after phone verification)
      const hasCheckoutIntent = sessionStorage.getItem('checkout_intent') === 'true'
      if (hasCheckoutIntent) {
        const guestCart = guestCartUtils.getCart()
        if (guestCart.length > 0) {
          const guestCartItems = guestCart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
          }))
          sessionStorage.setItem('guest_cart_items', JSON.stringify(guestCartItems))
        }
      }
    } catch (error: unknown) {
      // Surface a friendly error message
      const err = error as { response?: { data?: { error?: string } } }
      setErrorMessage(err?.response?.data?.error || 'Phone verification failed. Please try again.')
      setStatus('error')
      // Keep the form so user can retry
    }
  }

  const onResendPhoneCode = async () => {
    try {
      await resendPhoneCodeMutation.mutateAsync({ userId })
    } catch (error) {
      // Log but don't break the UI
      console.error('Resend phone code error:', error)
    }
  }

  // Auto-redirect after 3 seconds if checkout intent exists
  useEffect(() => {
    if (status === 'success') {
      const checkoutIntent = sessionStorage.getItem('checkout_intent')
      const checkoutRedirect = sessionStorage.getItem('checkout_redirect')
      
      if (checkoutIntent === 'true' && checkoutRedirect) {
        const timer = setTimeout(() => {
          // Redirect to login with checkout redirect
          // Login will handle merging guest cart and redirecting to review page
          navigate(`/login?redirect=${encodeURIComponent(checkoutRedirect)}`, { replace: true })
        }, 3000) // 3 seconds

        return () => clearTimeout(timer)
      }
    }
  }, [status, navigate])

  // TEMPORARILY COMMENTED OUT - Email verification flow
  // useEffect(() => {
  //   // If userId from URL and verification status loaded
  //   if (urlUserId && verificationStatus) {
  //     setUserId(verificationStatus.userId)
  //     setPhoneNumber(verificationStatus.phone || '')

  //     if (!verificationStatus.isEmailVerified && !verificationStatus.isPhoneVerified) {
  //       setStatus('error')
  //       setErrorMessage('Email not verified. Please check your email for verification link.')
  //     } else if (
  //       verificationStatus.isEmailVerified &&
  //       !verificationStatus.isPhoneVerified &&
  //       verificationStatus.phone
  //     ) {
  //       setStatus('phone-verify')
  //     } else {
  //       setStatus('success')
  //     }
  //     return
  //   }

  //   // If token exists, verify email (original flow)
  //   if (token && !hasVerified) {
  //     const verifyEmail = async () => {
  //       try {
  //         setHasVerified(true)
  //         const response = await API.get(`/auth/verify-email/${token}`)

  //         if (response.data.message) {
  //           setUserId(response.data.userId)
  //           setPhoneNumber(response.data.phoneNumber || '')

  //           // If phone verification is needed, show phone verification form
  //           if (response.data.needsPhoneVerification) {
  //             setStatus('phone-verify')
  //           } else {
  //             // If no phone or phone already verified, show success
  //             setStatus('success')
  //           }
  //         }
  //       } catch (error: unknown) {
  //         setStatus('error')
  //         const err = error as { response?: { data?: { error?: string } } }
  //         setErrorMessage(
  //           err?.response?.data?.error || 'Email verification failed. Please try again.',
  //         )
  //       }
  //     }
  //     verifyEmail()
  //   }
  // }, [token, urlUserId, verificationStatus, hasVerified])

  // TEMPORARILY COMMENTED OUT - Email verification flow
  // const onVerifyPhone = async (data: PhoneVerifyFormData) => {
  //   await verifyPhoneMutation
  //     .mutateAsync({ userId, code: data.code })
  //     .then(() => {
  //       setStatus('success')
  //     })
  //     .catch((error: unknown) => {
  //       console.error('Verify phone error:', error)
  //     })
  // }

  // const onResendPhoneCode = async () => {
  //   await resendPhoneCodeMutation.mutateAsync({ userId }).catch((error: unknown) => {
  //     console.error('Resend phone code error:', error)
  //   })
  // }

  // Decide what to show based on status
  const showSuccess = status === 'success' || status === 'email-success'
  const showPhoneVerify = status === 'phone-verify'
  const showError = status === 'error'

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Professional Grid Pattern Background */}
      <div className="absolute inset-0 bg-grid-slate-100/50 mask-[linear-gradient(0deg,white,rgba(255,255,255,0.6))] z-0" />

      {/* Subtle Gradient Overlay */}
      <div className="absolute inset-0 bg-linear-to-br from-purple-100/40 via-pink-50/30 to-orange-50/30 z-0" />

      {/* Subtle Pattern */}
      <div className="absolute inset-0 opacity-40 z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-3xl">
          <CardHeader className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 rounded-xl mb-4 shadow-lg mx-auto">
              <span className="text-2xl font-bold text-white">T</span>
            </div>
            <CardTitle className="text-3xl font-bold text-slate-900">
              Account Verification
            </CardTitle>
            <CardDescription className="text-base text-slate-600">
              Verify your email and phone to activate your Kourier Boyz account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Loading State */}
            {status === 'loading' && (
              <div className="space-y-4 text-center">
                <Alert className="border-slate-200 bg-slate-50">
                  <AlertDescription className="text-slate-700">
                    Verifying your email link… please wait a moment.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Phone Verification Form */}
            {showPhoneVerify && (
              <div className="space-y-6">
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertDescription className="text-blue-800">
                    A verification code has been sent to your phone {phoneNumber || ''}. Enter it
                    below to complete phone verification.
                  </AlertDescription>
                </Alert>
                <form
                  onSubmit={phoneForm.handleSubmit(onVerifyPhone)}
                  className="space-y-4"
                  noValidate
                >
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Verification Code</FieldLabel>
                      <Input
                        type="text"
                        maxLength={6}
                        pattern="\d*"
                        placeholder="Enter 6-digit code"
                        {...phoneForm.register('code', {
                          required: 'Code is required',
                          minLength: { value: 4, message: 'Code seems too short' },
                        })}
                      />
                      {phoneForm.formState.errors.code && (
                        <FieldError>{phoneForm.formState.errors.code.message}</FieldError>
                      )}
                    </Field>
                  </FieldGroup>
                  <div className="flex items-center justify-between gap-2">
                    <Button type="submit" disabled={verifyPhoneMutation.isPending}>
                      Verify Phone
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={resendPhoneCodeMutation.isPending}
                      onClick={onResendPhoneCode}
                    >
                      Resend Code
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Success State */}
            {showSuccess && (
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <div className="rounded-full bg-green-100 p-4">
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    All verifications complete! Your account is fully activated.
                    {(() => {
                      const checkoutIntent = sessionStorage.getItem('checkout_intent')
                      if (checkoutIntent === 'true') {
                        return ' Redirecting to checkout in 3 seconds...'
                      }
                      return ' You can now sign in to your account.'
                    })()}
                  </AlertDescription>
                </Alert>
                <Link
                  to={(() => {
                    // Check if user has checkout intent
                    const checkoutIntent = sessionStorage.getItem('checkout_intent')
                    const checkoutRedirect = sessionStorage.getItem('checkout_redirect')
                    if (checkoutIntent === 'true' && checkoutRedirect) {
                      return `/login?redirect=${encodeURIComponent(checkoutRedirect)}`
                    }
                    return '/login'
                  })()}
                >
                  <Button>Go to Sign In</Button>
                </Link>
              </div>
            )}

            {/* Error State */}
            {showError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-800">
                  {errorMessage ||
                    'Verification failed. Please check your link or request a new verification email.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="text-center">
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

export default VerifyEmail
