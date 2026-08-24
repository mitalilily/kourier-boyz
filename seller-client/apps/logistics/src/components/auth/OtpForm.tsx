import { Box, Stack, TextField, Typography } from '@mui/material'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { FiEdit2, FiRefreshCcw } from 'react-icons/fi'
import { useAuth } from '../../context/auth/AuthContext'
import { useRequestOtp, useVerifyOtp } from '../../hooks/useOTP'
import CustomIconLoadingButton from '../UI/button/CustomLoadingButton'
import { toast } from '../UI/Toast'

const OTP_LENGTH = 6
const OTP_RESEND_DELAY_MS = 30000
const BRAND_BLUE = '#8F650F'
const BRAND_DARK = '#141414'

const primaryButtonStyles = {
  width: '100%',
  borderRadius: 1.5,
  background: BRAND_BLUE,
  boxShadow: 'none',
  minHeight: 52,
  '&:hover': {
    background: '#202321',
    transform: 'translateY(-1px)',
  },
}

const ghostButtonStyles = {
  width: '100%',
  border: '1px solid #CED2D0',
  color: '#202321',
  backgroundColor: '#ffffff',
  borderRadius: 1.5,
  minHeight: 48,
  '&:hover': {
    borderColor: BRAND_BLUE,
    backgroundColor: '#F8FBFF',
  },
}

type Props = {
  email: string
  demoOtp?: string | null
  onEditEmail: () => void
}

export default function OtpForm({ email, demoOtp: initialDemoOtp, onEditEmail }: Props) {
  const { setTokens, setUserId } = useAuth()
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [resendEnabled, setResendEnabled] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(OTP_RESEND_DELAY_MS / 1000)
  const [demoOtp, setDemoOtp] = useState(initialDemoOtp ?? null)

  const { mutate: verifyOtp, isPending: verifying } = useVerifyOtp()
  const { mutate: resendOtp, isPending: resending } = useRequestOtp()

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setDemoOtp(initialDemoOtp ?? null)
    setResendEnabled(false)
    setSecondsLeft(OTP_RESEND_DELAY_MS / 1000)

    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

    countdownIntervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    timerRef.current = setTimeout(() => {
      setResendEnabled(true)
      setSecondsLeft(0)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }, OTP_RESEND_DELAY_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  }, [email, initialDemoOtp])

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const nextDigits = [...otpDigits]
    nextDigits[index] = value.slice(-1)
    setOtpDigits(nextDigits)
    setError('')

    if (value && index < OTP_LENGTH - 1) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const otp = otpDigits.join('')
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the full ${OTP_LENGTH}-digit verification code.`)
      return
    }

    setError('')

    verifyOtp(
      { email, otp },
      {
        onSuccess: ({ token, refreshToken, user }) => {
          sessionStorage.setItem('activeEmail', email)
          setUserId(user?.id)
          setTokens(token, refreshToken)
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || 'OTP verification failed'
          setError(msg)

          if (msg.toLowerCase().includes('otp expired')) {
            setResendEnabled(true)
            setSecondsLeft(0)
            if (timerRef.current) clearTimeout(timerRef.current)
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
          }
        },
      },
    )
  }

  const handleResendOtp = useCallback(() => {
    if (!resendEnabled || resending) return

    resendOtp(email.toLowerCase().trim(), {
      onSuccess: (response) => {
        setOtpDigits(Array(OTP_LENGTH).fill(''))
        setDemoOtp(response.demoOtp ?? null)
        setError('')
        setResendEnabled(false)
        setSecondsLeft(OTP_RESEND_DELAY_MS / 1000)

        if (timerRef.current) clearTimeout(timerRef.current)
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)

        countdownIntervalRef.current = setInterval(() => {
          setSecondsLeft((prev) => {
            if (prev <= 1) {
              clearInterval(countdownIntervalRef.current!)
              return 0
            }
            return prev - 1
          })
        }, 1000)

        timerRef.current = setTimeout(() => {
          setResendEnabled(true)
          setSecondsLeft(0)
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
        }, OTP_RESEND_DELAY_MS)

        toast.open({ message: 'Verification code sent again.', severity: 'success' })
      },
      onError: (err: any) => {
        setError(err?.response?.data?.error || 'Failed to resend OTP')
      },
    })
  }, [email, resendOtp, resendEnabled, resending])

  return (
    <Stack component="form" onSubmit={handleSubmit} width="100%" mt={1} gap={2}>
      <Box
        sx={{
          p: 1.8,
          borderRadius: 1.5,
          backgroundColor: '#F1F2F0',
          border: '1px solid #CED2D0',
        }}
      >
        <Typography variant="body2" sx={{ color: '#5F5A57', lineHeight: 1.7 }}>
          We sent a 6-digit sign-in code to <strong>{email}</strong>.
          <Box
            component="span"
            sx={{
              ml: 0.7,
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              color: BRAND_BLUE,
              fontWeight: 800,
            }}
            onClick={onEditEmail}
          >
            <FiEdit2 size={13} style={{ marginRight: 4 }} />
            Edit
          </Box>
        </Typography>
      </Box>

      {demoOtp && (
        <Box
          role="status"
          aria-label={`Demo access code ${demoOtp}`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            px: 2,
            py: 1.5,
            border: '1px solid #CDB56E',
            borderLeft: `4px solid ${BRAND_BLUE}`,
            borderRadius: 1.5,
            backgroundColor: '#FBFAF7',
          }}
        >
          <Box>
            <Typography sx={{ color: BRAND_DARK, fontSize: '0.82rem', fontWeight: 800 }}>
              Demo access code
            </Typography>
            <Typography sx={{ color: '#626966', fontSize: '0.74rem', mt: 0.2 }}>
              Enter this code below to continue.
            </Typography>
          </Box>
          <Typography
            sx={{
              color: BRAND_BLUE,
              fontFamily: 'monospace',
              fontSize: { xs: '1.25rem', sm: '1.45rem' },
              fontWeight: 900,
              letterSpacing: 0,
              whiteSpace: 'nowrap',
            }}
          >
            {demoOtp}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: { xs: 0.55, sm: 1 },
          width: '100%',
          maxWidth: 380,
          mx: 'auto',
        }}
      >
        {otpDigits.map((digit, idx) => (
          <TextField
            key={idx}
            id={`otp-${idx}`}
            type="text"
            inputMode="numeric"
            value={digit}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e as KeyboardEvent<HTMLInputElement>)}
            slotProps={{
              htmlInput: {
                maxLength: 1,
                style: {
                  textAlign: 'center',
                  fontSize: '1.15rem',
                  padding: 0,
                  height: 46,
                  fontWeight: 700,
                },
              },
            }}
            sx={{
              width: '100%',
              '& .MuiOutlinedInput-root': {
                height: 52,
                borderRadius: 1.5,
                backgroundColor: '#FFFFFF',
                color: BRAND_DARK,
                '& fieldset': {
                  borderColor: '#CED2D0',
                },
                '&:hover fieldset': {
                  borderColor: '#DFB743',
                },
                '&.Mui-focused': {
                  boxShadow: '0 0 0 3px rgba(49,2,118,0.12)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: BRAND_BLUE,
                  borderWidth: 1,
                },
              },
            }}
            error={!!error}
            autoComplete="one-time-code"
            aria-label={`OTP digit ${idx + 1}`}
          />
        ))}
      </Box>

      {error && (
        <Typography variant="caption" color="error" textAlign="center" sx={{ userSelect: 'none' }}>
          {error}
        </Typography>
      )}

      <Typography variant="caption" color="#626966" textAlign="center" sx={{ userSelect: 'none' }}>
        {demoOtp
          ? 'Use the demo code shown above to continue to Kourier Boyz.'
          : 'Enter the code from your inbox to continue to Kourier Boyz.'}
      </Typography>

      <CustomIconLoadingButton
        type="submit"
        text="Verify and continue"
        styles={primaryButtonStyles}
        disabled={otpDigits.join('').length !== OTP_LENGTH}
        loading={verifying}
        loadingText="Verifying..."
        textColor="#fff"
      />

      <CustomIconLoadingButton
        type="button"
        onClick={handleResendOtp}
        text={resendEnabled ? 'Resend verification code' : `Resend in ${secondsLeft}s`}
        styles={ghostButtonStyles}
        disabled={!resendEnabled || resending}
        loading={resending}
        loadingText="Resending..."
        icon={<FiRefreshCcw size={14} />}
      />
    </Stack>
  )
}
