import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { App, Button, Card, Result, Spin } from 'antd'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/marketplace'

const VerifyDevicePasswordChange = () => {
  const { token } = useParams<{ token: string }>()
  const { message } = App.useApp()
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const verifyDevice = async () => {
      if (!token) {
        setVerificationStatus('error')
        setErrorMessage('Verification token is missing')
        return
      }

      try {
        console.log('Attempting verification with token:', token.substring(0, 10) + '...')
        const response = await axios.post(
          `${API_BASE_URL}/admin/profile/verify-device-password-change/${token}`,
        )
        console.log('Verification response:', response.data)
        setVerificationStatus('success')
        message.success(response.data.message || 'Device verified and password changed successfully!')
      } catch (err: unknown) {
        console.error('Verification error:', err)
        setVerificationStatus('error')
        const axiosError = err as { 
          response?: { 
            data?: { 
              error?: string
              details?: string
            }
            status?: number
          }
          message?: string
        }
        
        let errorMsg = 'Verification failed'
        if (axiosError.response?.status === 400) {
          errorMsg = axiosError.response?.data?.error || 'Invalid or expired verification token'
        } else if (axiosError.response?.data?.error) {
          errorMsg = axiosError.response.data.error
          if (axiosError.response.data.details && import.meta.env.DEV) {
            errorMsg += `: ${axiosError.response.data.details}`
          }
        } else if (axiosError.message) {
          errorMsg = axiosError.message
        } else if (!axiosError.response) {
          errorMsg = 'Unable to connect to server. Please check your connection.'
        }
        
        setErrorMessage(errorMsg)
        message.error(errorMsg)
      }
    }

    verifyDevice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (verificationStatus === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Card style={{ width: 400, textAlign: 'center' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
          <p style={{ marginTop: 16, fontSize: 16 }}>Verifying device and changing password...</p>
        </Card>
      </div>
    )
  }

  if (verificationStatus === 'success') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title="Device Verified Successfully!"
          subTitle="Your password has been changed and this device has been added to your trusted devices."
          extra={
            <Link to="/login">
              <Button type="primary" size="large">
                Go to Login
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
      }}
    >
      <Result
        icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
        title="Verification Failed"
        subTitle={errorMessage || 'The verification link is invalid or has expired.'}
        extra={
          <Link to="/login">
            <Button type="primary" size="large">
              Go to Login
            </Button>
          </Link>
        }
      />
    </div>
  )
}

export default VerifyDevicePasswordChange

