import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { App, Button, Card, Result, Spin } from 'antd'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/marketplace'

const VerifyDevicePasswordChange = () => {
  const { token } = useParams<{ token: string }>()
  const { message } = App.useApp()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const verifyDevice = async () => {
      if (!token) {
        setStatus('error')
        setErrorMessage('Verification token is missing')
        return
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/admin/profile/verify-device-password-change/${token}`)
        setStatus('success')
        message.success(response.data.message || 'Device verified and password changed')
      } catch (error: unknown) {
        const requestError = error as {
          response?: { data?: { error?: string; details?: string }; status?: number }
          message?: string
        }
        let detail = requestError.response?.data?.error || requestError.message || 'Verification failed'
        if (!requestError.response) detail = 'Unable to connect to the server. Please check your connection.'
        if (requestError.response?.data?.details && import.meta.env.DEV) detail += `: ${requestError.response.data.details}`
        setStatus('error')
        setErrorMessage(detail)
        message.error(detail)
      }
    }

    void verifyDevice()
  }, [token, message])

  return (
    <main
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f5f6f4] p-5 text-[#202321]"
      style={{ backgroundImage: 'linear-gradient(rgba(101,109,105,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(101,109,105,0.08) 1px, transparent 1px)', backgroundSize: '38px 38px' }}
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#b78115]" />
      <div className="relative w-full max-w-lg">
        <img src="/brand/kourier-boyz-logo-transparent.png" alt="Kourier Boyz" className="mx-auto mb-5 h-16 w-full max-w-[310px] object-contain" />
        <Card className="rounded-lg border border-[#d9dcda] shadow-[0_24px_70px_rgba(32,35,33,0.12)]" styles={{ body: { padding: 'clamp(1rem, 3vw, 2rem)' } }}>
          {status === 'loading' && <Result icon={<Spin indicator={<LoadingOutlined spin style={{ color: '#b78115' }} />} />} title="Verifying this device" subTitle="Confirming the secure password change request." />}
          {status === 'success' && <Result icon={<CheckCircleOutlined style={{ color: '#3f7d56' }} />} status="success" title="Device verified" subTitle="Your password is updated and this browser is now a trusted device." extra={<Link to="/login"><Button type="primary" className="!bg-[#b78115] hover:!bg-[#8f650f]">Continue to sign in</Button></Link>} />}
          {status === 'error' && <Result icon={<CloseCircleOutlined style={{ color: '#b42318' }} />} status="error" title="Verification unavailable" subTitle={errorMessage || 'This verification link is invalid or has expired.'} extra={<Link to="/login"><Button type="primary" className="!bg-[#b78115] hover:!bg-[#8f650f]">Back to sign in</Button></Link>} />}
        </Card>
      </div>
    </main>
  )
}

export default VerifyDevicePasswordChange
