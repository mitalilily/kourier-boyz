import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { App, Button, Card, Result, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useVerifyEmail } from '../api/authQueries'

const VerifyEmail = () => {
  const { token } = useParams<{ token: string }>()
  const { message } = App.useApp()
  const verifyEmailMutation = useVerifyEmail()
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )

  useEffect(() => {
    if (token) {
      verifyEmailMutation.mutate(token)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (verifyEmailMutation.isSuccess) {
      setVerificationStatus('success')
      message.success('Email verified successfully!')
    }
  }, [verifyEmailMutation.isSuccess, message])

  useEffect(() => {
    if (verifyEmailMutation.isError) {
      setVerificationStatus('error')
      const error = verifyEmailMutation.error as { response?: { data?: { error?: string } } }
      message.error(error.response?.data?.error || 'Email verification failed')
    }
  }, [verifyEmailMutation.isError, verifyEmailMutation.error, message])

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 right-20 w-72 h-72 bg-blue-300 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-300 rounded-full blur-3xl animate-blob animation-delay-2000" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-0 animate-slide-up relative z-10">
        {verificationStatus === 'loading' && (
          <Result
            icon={<Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />}
            title="Verifying Your Email"
            subTitle="Please wait while we verify your email address..."
          />
        )}

        {verificationStatus === 'success' && (
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            status="success"
            title="Email Verified Successfully!"
            subTitle="Your email has been verified. Please wait for admin approval to access your account."
            extra={[
              <Link to="/login" key="login">
                <Button type="primary" size="large">
                  Go to Login
                </Button>
              </Link>,
            ]}
          />
        )}

        {verificationStatus === 'error' && (
          <Result
            icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
            status="error"
            title="Verification Failed"
            subTitle="The verification link is invalid or has expired. Please request a new verification email."
            extra={[
              <Link to="/login" key="login">
                <Button type="primary" size="large">
                  Back to Login
                </Button>
              </Link>,
            ]}
          />
        )}
      </Card>
    </div>
  )
}

export default VerifyEmail
