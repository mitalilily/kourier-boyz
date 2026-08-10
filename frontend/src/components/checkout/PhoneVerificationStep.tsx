import { useProfile, useSendUpdateOTP, useUpdateProfile } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Edit, Loader2, Phone, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface PhoneVerificationStepProps {
  onVerified: () => void
  phoneNumber?: string
  selectedAddress?: { phone?: string } | null
}

export const PhoneVerificationStep: React.FC<PhoneVerificationStepProps> = ({
  onVerified,
  phoneNumber,
  selectedAddress,
}) => {
  const { data: profile } = useProfile()
  const sendOTP = useSendUpdateOTP()
  const updateProfile = useUpdateProfile()
  const [otpSent, setOtpSent] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0) // Cooldown in seconds

  // Initialize phoneInput from selectedAddress or profile
  useEffect(() => {
    if (!phoneInput && !profile?.phone) {
      // Use phone from selectedAddress if available
      if (selectedAddress?.phone) {
        setPhoneInput(selectedAddress.phone.replace(/\D/g, '').slice(0, 10))
      }
    }
  }, [selectedAddress?.phone, profile?.phone, phoneInput])

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const form = useForm<{ phoneOTP: string }>({
    defaultValues: {
      phoneOTP: '',
    },
  })

  const userPhone = phoneNumber || profile?.phone || phoneInput || ''

  useEffect(() => {
    // Auto-send OTP when component mounts if phone exists in profile
    if (profile?.phone && !otpSent && !sendOTP.isPending) {
      const sendOTPAsync = async () => {
        try {
          await sendOTP.mutateAsync({ phone: profile.phone! })
          setOtpSent(true)
          toast.success('OTP sent to your phone number')
        } catch (error) {
          console.error('Failed to send OTP:', error)
        }
      }
      void sendOTPAsync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.phone, otpSent])

  const handleAddPhone = async () => {
    if (!phoneInput || phoneInput.length < 10) {
      toast.error('Please enter a valid 10-digit phone number')
      return
    }

    try {
      // Only send OTP - don't add phone to profile yet
      // Phone will be added only after OTP verification
      await sendOTP.mutateAsync({ phone: phoneInput })
      setOtpSent(true)
      setResendCooldown(60) // 60 seconds cooldown
      // Reset form to clear any previous OTP values
      form.reset({ phoneOTP: '' })
      form.clearErrors('phoneOTP')
      toast.success('OTP sent to your phone number')
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Failed to send OTP')
    }
  }

  const handleSendOTP = async () => {
    // Priority: phoneInput > profile.phone > selectedAddress.phone
    const phoneToUse = phoneInput || profile?.phone || selectedAddress?.phone
    if (!phoneToUse) {
      toast.error('Phone number is required')
      return
    }

    try {
      await sendOTP.mutateAsync({ phone: phoneToUse })
      setOtpSent(true)
      setResendCooldown(60) // 60 seconds cooldown
      // Reset form to clear any previous OTP values and errors
      form.reset({ phoneOTP: '' })
      form.clearErrors('phoneOTP')
      toast.success('OTP sent to your phone number')
    } catch (error) {
      console.error('Failed to send OTP:', error)
    }
  }

  const onSubmit = async (data: { phoneOTP: string }) => {
    if (!data.phoneOTP || data.phoneOTP.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setIsVerifying(true)
    try {
      // Get phone number - priority: phoneInput > profile.phone > selectedAddress.phone
      const phoneToVerify = phoneInput || profile?.phone || selectedAddress?.phone
      if (!phoneToVerify) {
        toast.error('Phone number is required')
        setIsVerifying(false)
        return
      }

      // Add phone to profile AND verify it with OTP in one call
      // This ensures phone is only added after successful verification
      await updateProfile.mutateAsync({
        phone: phoneToVerify,
        phoneOTP: data.phoneOTP,
      })
      toast.success('Phone number verified and added successfully!')
      // Clear phoneInput since phone is now in profile
      setPhoneInput('')
      onVerified()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error || 'Invalid OTP. Please try again.')
      form.setError('phoneOTP', {
        type: 'manual',
        message: 'Invalid OTP',
      })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header with gradient background */}
      <div className="bg-linear-to-r from-blue-50 via-indigo-50 to-purple-50 px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 shadow-md">
            <ShieldCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Phone Verification Required</h3>
            <p className="text-sm text-gray-600 mt-0.5">
              Verify your phone number to complete your order
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {!profile?.phone || isEditingPhone ? (
          // Show phone input if phone number doesn't exist or user is editing
          !otpSent ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    type="tel"
                    placeholder="Enter 10-digit phone number"
                    value={phoneInput}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '') // Only numbers
                      setPhoneInput(value)
                    }}
                    maxLength={10}
                    className="pl-10 h-12 text-base"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  We'll send a verification code to this number
                </p>
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  This number will be added to your account after verification
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAddPhone}
                disabled={sendOTP.isPending || !phoneInput || phoneInput.length !== 10}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                {sendOTP.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-5 w-5" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Phone number display with edit option */}
              <div className="flex items-center gap-3 rounded-xl bg-blue-50/50 border border-blue-100 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Verifying
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {phoneInput || profile?.phone || selectedAddress?.phone || userPhone}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditingPhone(true)
                    setOtpSent(false)
                    form.reset({ phoneOTP: '' })
                  }}
                  className="shrink-0"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>

              {/* OTP Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                  Enter Verification Code
                </label>
                <Controller
                  name="phoneOTP"
                  control={form.control}
                  rules={{
                    required: 'OTP is required',
                    minLength: { value: 6, message: 'OTP must be 6 digits' },
                    maxLength: { value: 6, message: 'OTP must be 6 digits' },
                  }}
                  render={({ field }) => (
                    <div className="flex flex-col items-center gap-3">
                      <InputOTP maxLength={6} {...field} className="justify-center">
                        <InputOTPGroup className="gap-2">
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className="h-14 w-12 text-lg font-semibold border-2 border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                      <p className="text-xs text-gray-500">
                        Code sent to{' '}
                        <span className="font-medium text-gray-700">
                          {phoneInput || profile?.phone || selectedAddress?.phone || userPhone}
                        </span>
                      </p>
                    </div>
                  )}
                />
                {form.formState.errors.phoneOTP && (
                  <p className="text-xs text-red-500 mt-2 text-center">
                    {form.formState.errors.phoneOTP.message}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  type="submit"
                  disabled={isVerifying || updateProfile.isPending}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {isVerifying || updateProfile.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-5 w-5" />
                      Verify & Continue
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSendOTP}
                  disabled={sendOTP.isPending || resendCooldown > 0}
                  className="w-full text-sm text-gray-600 hover:text-gray-900"
                >
                  {sendOTP.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : resendCooldown > 0 ? (
                    `Resend Code in ${resendCooldown}s`
                  ) : (
                    'Resend Code'
                  )}
                </Button>
              </div>
            </form>
          )
        ) : // Show existing phone number flow
        !otpSent ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-200 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                <Phone className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Phone Number
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{profile.phone}</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={handleSendOTP}
              disabled={sendOTP.isPending}
              className="w-full h-12 text-base font-semibold"
              size="lg"
            >
              {sendOTP.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Sending Code...
                </>
              ) : (
                <>
                  <Phone className="mr-2 h-5 w-5" />
                  Send Verification Code
                </>
              )}
            </Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Phone number display */}
            <div className="flex items-center gap-3 rounded-xl bg-blue-50/50 border border-blue-100 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Phone className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Verifying
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{profile.phone}</p>
              </div>
            </div>

            {/* OTP Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Enter Verification Code
              </label>
              <Controller
                name="phoneOTP"
                control={form.control}
                rules={{
                  required: 'OTP is required',
                  minLength: { value: 6, message: 'OTP must be 6 digits' },
                  maxLength: { value: 6, message: 'OTP must be 6 digits' },
                }}
                render={({ field }) => (
                  <div className="flex flex-col items-center gap-3">
                    <InputOTP maxLength={6} {...field} className="justify-center">
                      <InputOTPGroup className="gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-14 w-12 text-lg font-semibold border-2 border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <p className="text-xs text-gray-500">
                      Code sent to <span className="font-medium text-gray-700">{userPhone}</span>
                    </p>
                  </div>
                )}
              />
              {form.formState.errors.phoneOTP && (
                <p className="text-xs text-red-500 mt-2 text-center">
                  {form.formState.errors.phoneOTP.message}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button
                type="submit"
                disabled={isVerifying || updateProfile.isPending}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                {isVerifying || updateProfile.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-5 w-5" />
                    Verify & Continue
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleSendOTP}
                disabled={sendOTP.isPending || resendCooldown > 0}
                className="w-full text-sm text-gray-600 hover:text-gray-900"
              >
                {sendOTP.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : resendCooldown > 0 ? (
                  `Resend Code in ${resendCooldown}s`
                ) : (
                  'Resend Code'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
