import { useBuyerDeactivationStatus, useRequestBuyerDeactivation } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { AlertCircle, AlertTriangle, CheckCircle2, Lock, Shield } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const AccountSettings = () => {
  const { data: deactivationStatus } = useBuyerDeactivationStatus()
  const deactivateAccount = useRequestBuyerDeactivation()
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)

  const isDeactivated = deactivationStatus?.status === 'DEACTIVATED'

  const handleDeactivateClick = () => {
    setShowDeactivateDialog(true)
    setPassword('')
    setReason('')
  }

  const handleConfirmDeactivation = () => {
    if (!password.trim()) {
      toast.error('Please enter your password to confirm deactivation')
      return
    }

    setIsConfirming(true)
    deactivateAccount.mutate(
      { password: password.trim(), reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setIsConfirming(false)
          setShowDeactivateDialog(false)
        },
        onError: () => {
          setIsConfirming(false)
        },
      },
    )
  }

  const handleCancelDeactivation = () => {
    setShowDeactivateDialog(false)
    setPassword('')
    setReason('')
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="mt-2 text-gray-600">Manage your account settings and preferences</p>
      </div>

      {/* Account Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <CardTitle>Account Status</CardTitle>
                <CardDescription>Your current account status and information</CardDescription>
              </div>
            </div>
            {isDeactivated ? (
              <div className="flex items-center gap-2 rounded-full bg-red-100 px-4 py-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-700">Deactivated</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-green-100 px-4 py-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Active</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isDeactivated ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-2">Account Deactivated</h3>
                    <p className="text-sm text-red-800 mb-3">
                      Your account has been deactivated. You cannot log in or place new orders.
                    </p>
                    {deactivationStatus?.deactivatedAt && (
                      <p className="text-xs text-red-700">
                        Deactivated on:{' '}
                        {new Date(deactivationStatus.deactivatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                If you wish to reactivate your account, please contact our support team.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Your account is currently active. You can shop, place orders, and access all
                features.
              </p>
              {deactivationStatus?.deactivationRequestedAt && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-yellow-900 mb-1">Deactivation Requested</h3>
                      <p className="text-sm text-yellow-800">
                        You have a pending deactivation request. Your account will be deactivated
                        after confirmation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Deactivation Card */}
      {!isDeactivated && (
        <Card className="border-red-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-red-600" />
              <div>
                <CardTitle className="text-red-900">Deactivate Account</CardTitle>
                <CardDescription>Permanently deactivate your buyer account</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <h3 className="font-semibold text-red-900 mb-3">⚠️ Important Information</h3>
                <ul className="space-y-2 text-sm text-red-800">
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>
                      <strong>You will not be able to log in</strong> to your account after
                      deactivation
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>
                      <strong>Your order history and invoices will remain accessible</strong> for
                      record-keeping purposes
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>
                      <strong>Refunds and returns will still be processed</strong> if applicable to
                      your orders
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>
                      <strong>Support tickets related to your orders</strong> will still be handled
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span>
                      <strong>Your personal information will be masked</strong> for privacy while
                      maintaining order history integrity
                    </span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  onClick={handleDeactivateClick}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Deactivate My Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deactivation Confirmation Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <AlertTriangle className="h-5 w-5" />
              Confirm Account Deactivation
            </DialogTitle>
            <DialogDescription className="pt-2">
              Please confirm that you want to deactivate your account. This action cannot be undone
              without contacting support.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-medium text-red-900 mb-2">What happens next?</p>
              <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                <li>Your account will be immediately deactivated</li>
                <li>You will be logged out and cannot log in again</li>
                <li>Your order history and invoices will be preserved</li>
                <li>Your personal information will be masked for privacy</li>
              </ul>
            </div>

            <div>
              <FieldLabel htmlFor="password" className="text-sm font-medium">
                Enter your password to confirm <span className="text-red-600">*</span>
              </FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1"
                disabled={isConfirming}
              />
              <FieldError className="mt-1 text-xs">
                {password.trim() === '' && 'Password is required to confirm deactivation'}
              </FieldError>
            </div>

            <div>
              <FieldLabel htmlFor="reason" className="text-sm font-medium">
                Reason for deactivation (optional)
              </FieldLabel>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Let us know why you're deactivating your account (optional)"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]"
                disabled={isConfirming}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDeactivation} disabled={isConfirming}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeactivation}
              disabled={isConfirming || !password.trim()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isConfirming ? 'Deactivating...' : 'Yes, Deactivate My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AccountSettings
