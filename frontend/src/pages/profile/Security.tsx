import {
  fetchPasskeyRegistrationOptions,
  removePasskeyApi,
  useActivateTwoFactor,
  useChangePassword,
  useDisableTwoFactor,
  useInitiateTwoFactorSetup,
  useProfile,
  useRegenerateTwoFactorCodes,
  useTwoFactorStatus,
  verifyPasskeyRegistrationApi,
  type TwoFactorSetupResponse,
} from '@/api/auth'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { useMutation } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Copy, Loader2, Lock, RefreshCcw, Shield, ShieldCheck, ShieldOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

interface ChangePasswordFormData {
  currentPassword?: string
  newPassword: string
  confirmPassword: string
}

interface TwoFactorCodeForm {
  code: string
}

interface DisableTwoFactorForm {
  code: string
  recoveryCode: string
}

const Security = () => {
  const changePassword = useChangePassword()
  const twoFactorStatus = useTwoFactorStatus()
  const initiateTwoFactor = useInitiateTwoFactorSetup()
  const activateTwoFactor = useActivateTwoFactor()
  const regenerateTwoFactor = useRegenerateTwoFactorCodes()
  const disableTwoFactor = useDisableTwoFactor()
  const { data: profile, refetch: refetchProfile, isLoading: profileLoading } = useProfile()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false)
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false)
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false)
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null)
  const [activationBackupCodes, setActivationBackupCodes] = useState<string[] | null>(null)
  const [regeneratedBackupCodes, setRegeneratedBackupCodes] = useState<string[] | null>(null)
  const [disableMode, setDisableMode] = useState<'code' | 'recovery'>('code')
  const [passkeySupported, setPasskeySupported] = useState(false)
  const [isRegisteringPasskey, setIsRegisteringPasskey] = useState(false)
  const [isRemovePasskeyDialogOpen, setIsRemovePasskeyDialogOpen] = useState(false)
  const [passkeyPendingRemoval, setPasskeyPendingRemoval] = useState<{
    id: string
    nickname?: string
  } | null>(null)

  const hasPassword = profile?.hasPassword ?? false // Check if user has a password set

  const form = useForm<ChangePasswordFormData>({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    mode: 'onChange',
  })

  const setupForm = useForm<TwoFactorCodeForm>({
    defaultValues: { code: '' },
    mode: 'onChange',
  })

  const regenerateForm = useForm<TwoFactorCodeForm>({
    defaultValues: { code: '' },
    mode: 'onChange',
  })

  const disableForm = useForm<DisableTwoFactorForm>({
    defaultValues: { code: '', recoveryCode: '' },
    mode: 'onChange',
  })

  const removePasskeyMutation = useMutation({
    mutationFn: async (passkeyId: string) => removePasskeyApi(passkeyId),
    onSuccess: async () => {
      toast.success('Device removed from biometric sign-in.')
      await refetchProfile()
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(message || 'Unable to remove this device. Please try again.')
    },
  })

  useEffect(() => {
    void (async () => {
      try {
        const supported = await browserSupportsWebAuthn()
        if (supported) setPasskeySupported(true)
      } catch {
        setPasskeySupported(false)
      }
    })()
  }, [])

  const onSubmit = async (data: ChangePasswordFormData) => {
    changePassword.mutate(
      {
        currentPassword: hasPassword ? data.currentPassword : undefined,
        newPassword: data.newPassword,
      },
      {
        onSuccess: () => {
          setIsDialogOpen(false)
          form.reset()
        },
      },
    )
  }

  const validateConfirmPassword = (value: string) => {
    if (value !== form.watch('newPassword')) {
      return 'Passwords do not match'
    }
    return true
  }

  const handleSetupOpenChange = (open: boolean) => {
    setIsSetupDialogOpen(open)
    if (open) {
      setActivationBackupCodes(null)
      setSetupData(null)
      setupForm.reset({ code: '' })
      initiateTwoFactor.reset()
      void initiateTwoFactor
        .mutateAsync()
        .then((data) => setSetupData(data))
        .catch(() => {
          setIsSetupDialogOpen(false)
        })
    } else {
      setSetupData(null)
      setActivationBackupCodes(null)
      setupForm.reset({ code: '' })
      initiateTwoFactor.reset()
      activateTwoFactor.reset()
    }
  }

  const handleDisableOpenChange = (open: boolean) => {
    setIsDisableDialogOpen(open)
    if (open) {
      setDisableMode('code')
      disableForm.reset({ code: '', recoveryCode: '' })
      disableTwoFactor.reset()
    } else {
      disableForm.reset({ code: '', recoveryCode: '' })
      disableTwoFactor.reset()
      setDisableMode('code')
    }
  }

  const handleRegenerateOpenChange = (open: boolean) => {
    setIsRegenerateDialogOpen(open)
    if (open) {
      setRegeneratedBackupCodes(null)
      regenerateForm.reset({ code: '' })
      regenerateTwoFactor.reset()
    } else {
      regenerateForm.reset({ code: '' })
      regenerateTwoFactor.reset()
      setRegeneratedBackupCodes(null)
    }
  }

  const onActivateSubmit = async (data: TwoFactorCodeForm) => {
    try {
      const response = await activateTwoFactor.mutateAsync({ code: data.code.trim() })
      setActivationBackupCodes(response.backupCodes)
      await twoFactorStatus.refetch()
      setupForm.reset({ code: '' })
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      setupForm.setError('code', {
        type: 'manual',
        message: axiosError?.response?.data?.error || 'Invalid authentication code',
      })
    }
  }

  const onRegenerateSubmit = async (data: TwoFactorCodeForm) => {
    try {
      const response = await regenerateTwoFactor.mutateAsync({ code: data.code.trim() })
      setRegeneratedBackupCodes(response.backupCodes)
      await twoFactorStatus.refetch()
      regenerateForm.reset({ code: '' })
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      regenerateForm.setError('code', {
        type: 'manual',
        message: axiosError?.response?.data?.error || 'Invalid authentication code',
      })
    }
  }

  const onDisableSubmit = async (data: DisableTwoFactorForm) => {
    try {
      await disableTwoFactor.mutateAsync({
        code: disableMode === 'code' ? data.code.trim() : undefined,
        recoveryCode: disableMode === 'recovery' ? data.recoveryCode.trim() : undefined,
      })
      await twoFactorStatus.refetch()
      setIsDisableDialogOpen(false)
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      const message =
        axiosError?.response?.data?.error ||
        (disableMode === 'code'
          ? 'Unable to verify authentication code'
          : 'Unable to verify recovery code')

      if (disableMode === 'code') {
        disableForm.setError('code', { type: 'manual', message })
      } else {
        disableForm.setError('recoveryCode', { type: 'manual', message })
      }
    }
  }

  const handleCopyCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      toast.success('Backup codes copied to clipboard')
    } catch {
      toast.error('Unable to copy backup codes')
    }
  }

  const formatDateTime = (value?: string) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString()
  }

  const formatRelativeTime = (value?: string) => {
    if (!value) return 'Never used'
    try {
      return `${formatDistanceToNow(new Date(value), { addSuffix: true })}`
    } catch {
      return 'Recently'
    }
  }

  const renderBackupCodes = (codes: string[], onClose: () => void) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {codes.map((code) => (
          <div
            key={code}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center font-mono text-sm tracking-widest text-slate-900"
          >
            {code}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Store these codes somewhere safe. Each code can be used once if you lose access to your
        authenticator app.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleCopyCodes(codes)}
          className="flex items-center gap-2"
        >
          <Copy className="h-4 w-4" />
          Copy codes
        </Button>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )

  const handleRegisterPasskey = async () => {
    setIsRegisteringPasskey(true)
    try {
      const options = await fetchPasskeyRegistrationOptions()
      const credential = await startRegistration(options)
      await verifyPasskeyRegistrationApi({ credential })
      toast.success('Device registered for Face/Touch ID login!')
      await refetchProfile()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'InvalidStateError') {
        toast.info('This device is already registered for biometric sign-in.')
      } else {
        const message = (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error
        toast.error(message || 'Biometric registration failed. Please try again.')
      }
    } finally {
      setIsRegisteringPasskey(false)
    }
  }

  const handleRemovePasskey = async (passkeyId: string) => {
    await removePasskeyMutation.mutateAsync(passkeyId)
  }

  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle>Security Settings</CardTitle>
        <CardDescription>Manage your password and security preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Password
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {hasPassword
              ? 'Change your account password to keep it secure'
              : 'Set a password so you can log in with your email and password in addition to Google'}
          </p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white">
                {hasPassword ? 'Change Password' : 'Set Password'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{hasPassword ? 'Change Password' : 'Set Password'}</DialogTitle>
                <DialogDescription>
                  {hasPassword
                    ? 'Enter your current password and choose a new one'
                    : 'Set a password so you can log in with your email and password'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FieldGroup>
                  {hasPassword && (
                    <Field>
                      <FieldLabel>Current Password</FieldLabel>
                      <Input
                        type="password"
                        {...form.register('currentPassword', {
                          required: 'Current password is required',
                        })}
                      />
                      <FieldError errors={[form.formState.errors.currentPassword]} />
                    </Field>
                  )}

                  <Field>
                    <FieldLabel>New Password</FieldLabel>
                    <Input
                      type="password"
                      {...form.register('newPassword', {
                        required: 'New password is required',
                        minLength: { value: 8, message: 'Password must be at least 8 characters' },
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
                      })}
                    />
                    <FieldError errors={[form.formState.errors.newPassword]} />
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 8 characters and include uppercase, lowercase, number, and
                      special character.
                    </p>
                  </Field>

                  <Field>
                    <FieldLabel>Confirm New Password</FieldLabel>
                    <Input
                      type="password"
                      {...form.register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: validateConfirmPassword,
                      })}
                    />
                    <FieldError errors={[form.formState.errors.confirmPassword]} />
                  </Field>
                </FieldGroup>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false)
                      form.reset()
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-linear-to-br from-slate-900 via-blue-900 to-slate-800 hover:from-slate-800 hover:via-blue-800 hover:to-slate-700 text-white"
                    disabled={changePassword.isPending || !form.formState.isValid}
                  >
                    {changePassword.isPending
                      ? hasPassword
                        ? 'Changing...'
                        : 'Setting...'
                      : hasPassword
                      ? 'Change Password'
                      : 'Set Password'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="p-6  border border-slate-200 rounded-2xl shadow-sm bg-white">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Add an extra layer of security to your account
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {twoFactorStatus.data?.enabled ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
                Enabled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                <ShieldOff className="h-4 w-4" />
                Disabled
              </span>
            )}
            {twoFactorStatus.data?.hasPendingSetup && !twoFactorStatus.data?.enabled && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
                Setup pending
              </span>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">How sign-in works</p>
              <p className="text-xs text-slate-600 mt-1">
                After 2FA is enabled, you can finish login with your authenticator app or request a
                one-time SMS code that we send to your verified phone number. Backup codes are
                available if neither option is accessible.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Recommended authenticator apps</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
                <li>
                  Google Authenticator (
                  <a
                    href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    Android
                  </a>
                  ,{' '}
                  <a
                    href="https://apps.apple.com/app/google-authenticator/id388497605"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    iOS
                  </a>
                  )
                </li>
                <li>
                  Microsoft Authenticator (
                  <a
                    href="https://play.google.com/store/apps/details?id=com.azure.authenticator"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    Android
                  </a>
                  ,{' '}
                  <a
                    href="https://apps.apple.com/app/microsoft-authenticator/id983156458"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    iOS
                  </a>
                  )
                </li>
                <li>
                  Authy (
                  <a
                    href="https://play.google.com/store/apps/details?id=com.authy.authy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    Android
                  </a>
                  ,{' '}
                  <a
                    href="https://apps.apple.com/app/authy/id494168017"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:text-indigo-700"
                  >
                    iOS
                  </a>
                  )
                </li>
              </ul>
            </div>
          </div>

          {twoFactorStatus.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-40" />
            </div>
          ) : (
            <div className="space-y-4">
              {twoFactorStatus.data?.hasPendingSetup && !twoFactorStatus.data?.enabled && (
                <Alert className="border-amber-200 bg-amber-50 text-amber-700">
                  <AlertTitle>Finish setting up 2FA</AlertTitle>
                  <AlertDescription>
                    You started enabling two-factor authentication but did not complete the
                    verification step. Click &ldquo;Continue setup&rdquo; to finish.
                  </AlertDescription>
                </Alert>
              )}

              {twoFactorStatus.data?.enabled && !isSetupDialogOpen && !activationBackupCodes ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            Authenticator app enabled
                          </p>
                          <p className="text-xs text-slate-500">
                            {twoFactorStatus.data.backupCodesRemaining} backup codes remaining
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-1 text-xs text-slate-500">
                        {formatDateTime(twoFactorStatus.data.enabledAt) && (
                          <span>
                            Enabled on:{' '}
                            <span className="font-medium text-slate-700">
                              {formatDateTime(twoFactorStatus.data.enabledAt)}
                            </span>
                          </span>
                        )}
                        {formatDateTime(twoFactorStatus.data.lastVerifiedAt) && (
                          <span>
                            Last verified:{' '}
                            <span className="font-medium text-slate-700">
                              {formatDateTime(twoFactorStatus.data.lastVerifiedAt)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Dialog open={isRegenerateDialogOpen} onOpenChange={handleRegenerateOpenChange}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2">
                          <RefreshCcw className="h-4 w-4" />
                          Regenerate backup codes
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Generate new backup codes</DialogTitle>
                          <DialogDescription>
                            Enter a fresh code from your authenticator app. New backup codes will
                            replace any unused codes.
                          </DialogDescription>
                        </DialogHeader>

                        {regeneratedBackupCodes ? (
                          <>
                            <Alert>
                              <AlertTitle>Backup codes refreshed</AlertTitle>
                              <AlertDescription>
                                The codes below have replaced your previous backup codes. Save them
                                securely.
                              </AlertDescription>
                            </Alert>
                            {renderBackupCodes(regeneratedBackupCodes, () =>
                              setIsRegenerateDialogOpen(false),
                            )}
                          </>
                        ) : (
                          <form
                            onSubmit={regenerateForm.handleSubmit(onRegenerateSubmit)}
                            className="space-y-4"
                          >
                            <Field>
                              <FieldLabel>Authenticator code</FieldLabel>
                              <Input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="Enter 6-digit code"
                                {...regenerateForm.register('code', {
                                  required: 'Authentication code is required',
                                  minLength: { value: 6, message: 'Code must be 6 digits' },
                                })}
                              />
                              <FieldError errors={[regenerateForm.formState.errors.code]} />
                            </Field>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsRegenerateDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                className="flex items-center gap-2"
                                disabled={
                                  regenerateTwoFactor.isPending || !regenerateForm.formState.isValid
                                }
                              >
                                {regenerateTwoFactor.isPending && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Generate codes
                              </Button>
                            </div>
                          </form>
                        )}
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isDisableDialogOpen} onOpenChange={handleDisableOpenChange}>
                      <DialogTrigger asChild>
                        <Button
                          variant="secondary"
                          className="flex items-center gap-2 text-red-500 border-red-600 hover:bg-red-50"
                        >
                          <ShieldOff className="h-4 w-4" />
                          Disable 2FA
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Disable two-factor authentication</DialogTitle>
                          <DialogDescription>
                            Confirm disabling 2FA by entering a current authenticator code or one of
                            your backup codes. Once disabled, delete the Kourier Boyz entry from your
                            authenticator app so you don’t accidentally use an outdated code later.
                          </DialogDescription>
                        </DialogHeader>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={disableMode === 'code' ? 'default' : 'outline'}
                            onClick={() => {
                              setDisableMode('code')
                              disableForm.clearErrors()
                            }}
                            className="flex-1"
                          >
                            Authenticator code
                          </Button>
                          <Button
                            type="button"
                            variant={disableMode === 'recovery' ? 'default' : 'outline'}
                            onClick={() => {
                              setDisableMode('recovery')
                              disableForm.clearErrors()
                            }}
                            className="flex-1"
                          >
                            Recovery code
                          </Button>
                        </div>

                        <form
                          onSubmit={disableForm.handleSubmit(onDisableSubmit)}
                          className="space-y-4"
                        >
                          {disableMode === 'code' ? (
                            <Field>
                              <FieldLabel>Authenticator code</FieldLabel>
                              <Input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="Enter 6-digit code"
                                {...disableForm.register('code', {
                                  required: 'Authentication code is required',
                                  minLength: { value: 6, message: 'Code must be 6 digits' },
                                })}
                              />
                              <FieldError errors={[disableForm.formState.errors.code]} />
                            </Field>
                          ) : (
                            <Field>
                              <FieldLabel>Recovery code</FieldLabel>
                              <Input
                                type="text"
                                placeholder="Enter one of your backup codes"
                                {...disableForm.register('recoveryCode', {
                                  required: 'Recovery code is required',
                                })}
                              />
                              <FieldError errors={[disableForm.formState.errors.recoveryCode]} />
                            </Field>
                          )}

                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setIsDisableDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              variant="destructive"
                              className="flex items-center gap-2"
                              disabled={
                                disableTwoFactor.isPending ||
                                (disableMode === 'code'
                                  ? !disableForm.formState.isValid || !disableForm.watch('code')
                                  : !disableForm.formState.isValid ||
                                    !disableForm.watch('recoveryCode'))
                              }
                            >
                              {disableTwoFactor.isPending && (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              )}
                              Disable 2FA
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </>
              ) : (
                <>
                  {!isSetupDialogOpen && (
                    <Button
                      onClick={() => handleSetupOpenChange(true)}
                      disabled={initiateTwoFactor.isPending}
                    >
                      <Shield className="h-4 w-4" />
                      {twoFactorStatus.data?.hasPendingSetup ? 'Continue setup' : 'Enable 2FA'}
                    </Button>
                  )}

                  <Dialog open={isSetupDialogOpen} onOpenChange={handleSetupOpenChange}>
                    <DialogContent className="max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Set up two-factor authentication</DialogTitle>
                        <DialogDescription>
                          Scan the QR code with your authenticator app, then enter the 6-digit code
                          to confirm.
                        </DialogDescription>
                      </DialogHeader>
                      {(!setupData && initiateTwoFactor.isPending) ||
                      (!setupData && activateTwoFactor.isPending) ? (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <p className="mt-3 text-sm">Preparing your setup...</p>
                        </div>
                      ) : activationBackupCodes ? (
                        <>
                          <Alert>
                            <AlertTitle>Two-factor authentication enabled</AlertTitle>
                            <AlertDescription>
                              Save your backup codes now. You won’t be able to see them again.
                            </AlertDescription>
                          </Alert>
                          {renderBackupCodes(activationBackupCodes, () =>
                            setIsSetupDialogOpen(false),
                          )}
                        </>
                      ) : setupData ? (
                        <div className="space-y-5">
                          <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-start">
                            <div className="rounded-lg bg-white p-2 shadow-sm">
                              <img
                                src={setupData.qrCodeDataUrl}
                                alt="Two-factor authentication QR code"
                                className="h-44 w-44 rounded-lg"
                              />
                            </div>
                            <div className="space-y-3 text-sm text-slate-600">
                              <p className="font-medium text-slate-800">
                                Can&apos;t scan the QR code?
                              </p>
                              <p>Enter this key manually in your authenticator app:</p>
                              <div className="rounded-lg bg-white px-3 py-2 font-mono text-sm tracking-wide shadow-sm">
                                {setupData.secret}
                              </div>
                              <p className="text-xs text-slate-500">
                                Ensure time-based (TOTP) is selected in your authenticator app.
                              </p>
                            </div>
                          </div>

                          <form
                            onSubmit={setupForm.handleSubmit(onActivateSubmit)}
                            className="space-y-4"
                          >
                            <Field>
                              <FieldLabel>Authenticator code</FieldLabel>
                              <Input
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="Enter 6-digit code"
                                {...setupForm.register('code', {
                                  required: 'Authentication code is required',
                                  minLength: { value: 6, message: 'Code must be 6 digits' },
                                })}
                              />
                              <FieldError errors={[setupForm.formState.errors.code]} />
                            </Field>

                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setIsSetupDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                className="flex items-center gap-2"
                                disabled={
                                  activateTwoFactor.isPending || !setupForm.formState.isValid
                                }
                              >
                                {activateTwoFactor.isPending && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Confirm &amp; enable
                              </Button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <Alert variant="destructive">
                          <AlertTitle>Unable to start setup</AlertTitle>
                          <AlertDescription>
                            Please close this dialog and try again. If the issue continues, contact
                            support.
                          </AlertDescription>
                        </Alert>
                      )}
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border border-slate-200 rounded-2xl shadow-sm bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Biometric Sign-in (Passkeys)
              </h3>
              <p className="text-sm text-gray-600">
                Use Face ID, Touch ID, or Windows Hello to sign in without a password on supported
                devices.
              </p>
            </div>
            <Button
              onClick={handleRegisterPasskey}
              disabled={!passkeySupported || isRegisteringPasskey}
            >
              {isRegisteringPasskey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register this device'
              )}
            </Button>
          </div>

          {!passkeySupported && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-700">
              <AlertTitle>Device not supported</AlertTitle>
              <AlertDescription>
                Your browser or device does not support passkeys. Try using the latest version of
                Chrome, Safari, or Edge on a compatible device.
              </AlertDescription>
            </Alert>
          )}

          {profileLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : profile?.passkeys && profile.passkeys.length > 0 ? (
            <div className="space-y-3">
              {profile.passkeys.map((passkey) => (
                <div
                  key={passkey.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {passkey.nickname || 'Registered device'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Added {passkey.createdAt ? formatDateTime(passkey.createdAt) : 'recently'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-slate-500">
                      Last used {formatRelativeTime(passkey.lastUsedAt)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full border-red-200 text-red-600 hover:bg-red-50"
                      disabled={removePasskeyMutation.isPending}
                      onClick={() => {
                        setPasskeyPendingRemoval({ id: passkey.id, nickname: passkey.nickname })
                        setIsRemovePasskeyDialogOpen(true)
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">
                Register passkeys on each device you want to unlock with biometrics. Remove a device
                anytime using the remove button above.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No passkeys registered yet. Register this device to unlock your account using Face or
              Touch ID.
            </p>
          )}
        </div>

        <Dialog open={isRemovePasskeyDialogOpen} onOpenChange={setIsRemovePasskeyDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Remove this device?</DialogTitle>
              <DialogDescription>
                {passkeyPendingRemoval?.nickname
                  ? `"${passkeyPendingRemoval.nickname}" will no longer be able to sign you in.`
                  : 'This device will no longer be able to sign you in.'}{' '}
                You can re-register it later from this page.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsRemovePasskeyDialogOpen(false)}
                disabled={removePasskeyMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (passkeyPendingRemoval) {
                    await handleRemovePasskey(passkeyPendingRemoval.id)
                  }
                  setIsRemovePasskeyDialogOpen(false)
                  setPasskeyPendingRemoval(null)
                }}
                disabled={removePasskeyMutation.isPending}
              >
                {removePasskeyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  'Remove device'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export default Security
