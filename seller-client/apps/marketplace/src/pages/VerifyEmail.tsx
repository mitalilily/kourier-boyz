import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { App, Button, Card, Result, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useVerifyEmail } from '../api/authQueries'
import MarketplaceAuthFrame from '../components/MarketplaceAuthFrame'

const VerifyEmail = () => {
  const { token } = useParams<{ token: string }>()
  const { message } = App.useApp()
  const verifyEmailMutation = useVerifyEmail()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (token) verifyEmailMutation.mutate(token)
    else setStatus('error')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (verifyEmailMutation.isSuccess) {
      setStatus('success')
      message.success('Email verified successfully')
    }
  }, [verifyEmailMutation.isSuccess, message])

  useEffect(() => {
    if (verifyEmailMutation.isError) {
      setStatus('error')
      const error = verifyEmailMutation.error as { response?: { data?: { error?: string } } }
      message.error(error.response?.data?.error || 'Email verification failed')
    }
  }, [verifyEmailMutation.isError, verifyEmailMutation.error, message])

  return (
    <MarketplaceAuthFrame
      eyebrow="Seller verification"
      title="One verified identity across selling and shipping."
      description="Your marketplace account uses the same trusted Kourier Boyz workspace; courier KYC remains managed in the courier console."
    >
      <Card className="kb-seller-auth-card kb-seller-auth-result">
        {status === 'loading' && <Result icon={<Spin indicator={<LoadingOutlined spin />} />} title="Verifying your email" subTitle="This usually takes only a moment." />}
        {status === 'success' && <Result status="success" icon={<CheckCircleOutlined />} title="Email verified" subTitle="Your seller email is confirmed. Continue to your connected workspace." extra={<Link to="/login"><Button type="primary">Continue to sign in</Button></Link>} />}
        {status === 'error' && <Result status="error" icon={<CloseCircleOutlined />} title="Verification link unavailable" subTitle="This link is invalid or has expired. Return to sign in to request a new one." extra={<Link to="/login"><Button type="primary">Back to sign in</Button></Link>} />}
      </Card>
    </MarketplaceAuthFrame>
  )
}

export default VerifyEmail
