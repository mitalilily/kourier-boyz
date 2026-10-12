import { LoadingOutlined } from '@ant-design/icons'
import { Spin } from 'antd'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  resumeMarketplaceFromCourier,
  saveRegistrationProfile,
} from '../api/logisticsSession'
import { useAuthStore } from '../store/authStore'

type CourierSessionBridgeProps = { children: ReactNode }

const CourierSessionBridge = ({ children }: CourierSessionBridgeProps) => {
  const token = useAuthStore((state) => state.token)
  const setAuth = useAuthStore((state) => state.setAuth)
  const [checking, setChecking] = useState(!token)
  const attempted = useRef(false)

  useEffect(() => {
    if (token || attempted.current) {
      setChecking(false)
      return
    }

    attempted.current = true
    void resumeMarketplaceFromCourier()
      .then((session) => {
        if (session.status === 'linked') {
          setAuth(session.token, session.seller)
          saveRegistrationProfile(undefined)
        } else if (session.status === 'registration_required') {
          saveRegistrationProfile(session.profile)
        }
      })
      .catch((error) => {
        console.error('Courier marketplace session bridge failed:', error)
      })
      .finally(() => setChecking(false))
  }, [setAuth, token])

  if (!checking) return <>{children}</>

  return (
    <div className="kb-session-bridge" role="status" aria-live="polite">
      <img src="/store/brand/kourier-boyz-mark.png" alt="" />
      <Spin indicator={<LoadingOutlined spin />} />
      <strong>Opening your marketplace workspace</strong>
      <span>Confirming your Kourier Boyz seller session.</span>
    </div>
  )
}

export default CourierSessionBridge
