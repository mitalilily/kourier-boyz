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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f3f4f2] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(rgba(101,109,105,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(101,109,105,0.08) 1px, transparent 1px), repeating-linear-gradient(135deg, transparent 0 52px, rgba(183,129,21,0.10) 52px 54px)',
          backgroundSize: '44px 44px, 44px 44px, 120px 120px',
        }}
      />

      <Card className="w-full max-w-md border border-[#d9dcda] shadow-[0_24px_70px_rgba(32,35,33,0.14)] animate-slide-up relative z-10">
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
            subTitle="Your email is verified. Continue to Seller Hub; courier verification remains managed in your courier console."
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
