'use client'

import { useGoogleOAuth, useRegister } from '@/api/auth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { BackgroundBeams } from '@/components/ui/shadcn-io/background-beams'
import { guestCartUtils } from '@/utils/guestCart'
import { useGoogleLogin } from '@react-oauth/google'
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from 'lucide-react'
import { GOOGLE_REDIRECT_URI } from '@/config/googleAuth'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

interface RegisterFormData {
  name: string
  email: string
  phone: string
  password: string
  confirmPassword: string
}

const Register = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const registerMutation = useRegister()
  const googleOAuthMutation = useGoogleOAuth()
  const [searchParams] = useSearchParams()

  const form = useForm<RegisterFormData>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  })

  const password = form.watch('password')

  const onSubmit = async (data: RegisterFormData) => {
    try {
      // Preserve checkout intent if user came from checkout
      const redirectUrl = searchParams.get('redirect')
      const hasCheckoutIntent = sessionStorage.getItem('checkout_intent') === 'true'
      
      if (redirectUrl || hasCheckoutIntent) {
        sessionStorage.setItem('checkout_intent', 'true')
        if (redirectUrl) {
          sessionStorage.setItem('checkout_redirect', redirectUrl)
        }
        
        // Store guest cart items for filtering in review page after login
        const guestCart = guestCartUtils.getCart()
        if (guestCart.length > 0) {
          const guestCartItems = guestCart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
          }))
          sessionStorage.setItem('guest_cart_items', JSON.stringify(guestCartItems))
        }
      }
      
      await registerMutation.mutateAsync({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: 'customer',
      })
    } catch (error: unknown) {
      console.error('Register error:', error)
    }
  }

  const handleGoogleSignUp = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        // Preserve checkout intent if user came from checkout
        const redirectUrl = searchParams.get('redirect')
        if (redirectUrl) {
          sessionStorage.setItem('checkout_intent', 'true')
          sessionStorage.setItem('checkout_redirect', redirectUrl)
          // Store guest cart items for filtering in review page
          const guestCart = guestCartUtils.getCart()
          const guestCartItems = guestCart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
          }))
          sessionStorage.setItem('guest_cart_items', JSON.stringify(guestCartItems))
        }

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
            window.location.href = checkoutRedirect
          } else {
            // Redirect to profile page for phone verification
            window.location.href = '/profile/info?verify_phone=true'
          }
        }
      } catch (error) {
        console.error('Google sign-up error:', error)
      }
    },
    onError: () => {
      toast.error('Google sign-up was cancelled or failed')
    },
    flow: 'auth-code',
    redirect_uri: GOOGLE_REDIRECT_URI, // Explicitly set redirect URI to match backend
  })

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

      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-white/95 backdrop-blur-sm shadow-xl border border-slate-200/50 rounded-2xl">
          <CardHeader className="text-center space-y-1 px-5 pt-5 pb-3">
            <img
              src="/brand/kourier-boyz-logo.png"
              alt="Kourier Boyz"
              className="w-20 h-12 object-contain mb-2 mx-auto drop-shadow-lg"
            />
            <CardTitle className="text-xl font-bold text-slate-900">Create Account</CardTitle>
            <CardDescription className="text-xs text-slate-600">
              Sign up to get started with Kourier Boyz
            </CardDescription>
          </CardHeader>

          <CardContent className="px-5 pb-5">
            <form id="register-form" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup className="space-y-2.5">
                {/* Name Field */}
                <Controller
                  name="name"
                  control={form.control}
                  rules={{
                    required: 'Name is required',
                    minLength: {
                      value: 2,
                      message: 'Name must be at least 2 characters',
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="register-name" className="text-sm">
                        Full Name
                      </FieldLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-4 w-4 text-slate-400" />
                        </div>
                        <Input
                          {...field}
                          id="register-name"
                          type="text"
                          className={`pl-9 h-9 rounded-xl transition-colors text-sm ${
                            fieldState.invalid
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                          placeholder="John Doe"
                          aria-invalid={fieldState.invalid}
                          autoComplete="name"
                        />
                      </div>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />

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
                      <FieldLabel htmlFor="register-email" className="text-sm">
                        Email Address
                      </FieldLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-4 w-4 text-slate-400" />
                        </div>
                        <Input
                          {...field}
                          id="register-email"
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

                {/* Phone Field */}
                <Controller
                  name="phone"
                  control={form.control}
                  rules={{
                    required: 'Phone number is required',
                    pattern: {
                      value: /^[6-9]\d{9}$/,
                      message: 'Invalid phone number (10 digits starting with 6-9)',
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="register-phone" className="text-sm">
                        Phone Number
                      </FieldLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Phone className="h-4 w-4 text-slate-400" />
                        </div>
                        <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none">
                          <span className="text-slate-600 font-medium">+91</span>
                        </div>
                        <Input
                          {...field}
                          id="register-phone"
                          type="tel"
                          className={`pl-14 h-9 rounded-xl transition-colors text-sm ${
                            fieldState.invalid
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                          placeholder="9876543210"
                          aria-invalid={fieldState.invalid}
                          autoComplete="tel"
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
                      value: 8,
                      message: 'Password must be at least 8 characters',
                    },
                    validate: {
                      hasUppercase: (value) =>
                        /[A-Z]/.test(value) ||
                        'Password must include at least one uppercase letter',
                      hasLowercase: (value) =>
                        /[a-z]/.test(value) ||
                        'Password must include at least one lowercase letter',
                      hasNumber: (value) =>
                        /\d/.test(value) || 'Password must include at least one number',
                      hasSpecial: (value) =>
                        /[^A-Za-z0-9]/.test(value) ||
                        'Password must include at least one special character',
                    },
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="register-password" className="text-sm">
                        Password
                      </FieldLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-4 w-4 text-slate-400" />
                        </div>
                        <Input
                          {...field}
                          id="register-password"
                          type={showPassword ? 'text' : 'password'}
                          className={`pl-9 pr-9 h-9 rounded-xl transition-colors text-sm ${
                            fieldState.invalid
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                          placeholder="••••••••"
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
                    validate: (value) => value === password || "Passwords don't match",
                  }}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="register-confirm-password" className="text-sm">
                        Confirm Password
                      </FieldLabel>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-4 w-4 text-slate-400" />
                        </div>
                        <Input
                          {...field}
                          id="register-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className={`pl-9 pr-9 h-9 rounded-xl transition-colors text-sm ${
                            fieldState.invalid
                              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-slate-200 focus:border-purple-500 focus:ring-purple-500/20'
                          }`}
                          placeholder="••••••••"
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
              {registerMutation.isError && (
                <Alert variant="destructive" className="border-red-200 bg-red-50 mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {(
                      registerMutation.error as {
                        response?: { data?: { error?: string } }
                      }
                    )?.response?.data?.error || 'Registration failed. Please try again.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                form="register-form"
                variant="blue"
                disabled={registerMutation.isPending || form.formState.isSubmitting}
                className="w-full h-9 rounded-xl font-semibold shadow-md transition-all duration-200 transform hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none cursor-pointer mt-3 text-sm"
                size="lg"
              >
                {registerMutation.isPending || form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </Button>
            </form>

            {/* Google Sign-Up Button */}
            <div className="mt-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or continue with</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="group relative w-full mt-3 h-9 rounded-xl border border-slate-200/80 bg-white text-slate-700 font-medium shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/20 focus-visible:ring-offset-2 focus-visible:border-purple-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm disabled:hover:bg-white disabled:hover:border-slate-200/80 transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] text-sm"
                onClick={handleGoogleSignUp}
                disabled={googleOAuthMutation.isPending}
                aria-label="Sign up with Google"
                aria-busy={googleOAuthMutation.isPending}
              >
                {googleOAuthMutation.isPending ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-600" />
                    <span className="text-xs font-medium">Signing up...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg
                      className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110"
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
                    <span className="text-xs font-semibold">Sign up with Google</span>
                  </span>
                )}
              </Button>
            </div>

            <Separator className="my-3 bg-slate-200" />

            {/* Footer Links */}
            <div className="flex items-center justify-between text-xs">
              <Link to="/" className="text-slate-500 hover:text-slate-700 transition-colors">
                ← Home
              </Link>
              <span className="text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="text-purple-600 hover:text-purple-700 font-bold">
                  Sign in
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Register
