import { Box, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { useEffect, useState } from 'react'
import { FiEdit2, FiMail } from 'react-icons/fi'
import { useAuth } from '../../context/auth/AuthContext'
import { useVerifyEmailOtp } from '../../hooks/useRequestPasswordLogin'
import CustomIconLoadingButton from '../UI/button/CustomLoadingButton'
import CustomInput from '../UI/inputs/CustomInput'
import { toast } from '../UI/Toast'

const BRAND_NAVY = '#8F650F'
const BRAND_ORANGE = '#B78115'

const primaryButtonStyles = {
  width: '100%',
  borderRadius: 1.5,
  background: BRAND_NAVY,
  boxShadow: 'none',
  minHeight: 52,
  '&:hover': {
    background: '#202321',
    transform: 'translateY(-1px)',
  },
}

const secondaryButtonStyles = {
  width: '100%',
  border: '1px solid #CED2D0',
  color: '#202321',
  backgroundColor: '#FFFFFF',
  borderRadius: 1.5,
  minHeight: 48,
  '&:hover': {
    borderColor: BRAND_NAVY,
    backgroundColor: '#F8FBFF',
  },
}

const authInputSx = {
  '& .MuiOutlinedInput-root': {
    minHeight: 52,
    borderRadius: '6px',
    backgroundColor: '#FFFFFF',
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
      borderColor: BRAND_NAVY,
      borderWidth: 1,
    },
  },
}

interface IEmailVerificationProps {
  email: string
  onEditEmail: () => void
  password: string
  resendMail: () => void
}

export default function EmailVerificationForm({
  email,
  password,
  onEditEmail,
  resendMail,
}: IEmailVerificationProps) {
  const { setTokens, setUserId } = useAuth()

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [touched, setTouched] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(30)

  const { mutate: verifyEmailOtp, isPending } = useVerifyEmailOtp()

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleSubmit = () => {
    setTouched(true)

    if (!code) {
      setError('Verification code is required.')
      return
    }

    verifyEmailOtp(
      { email, otp: code, password },
      {
        onSuccess: ({ token, refreshToken, user }) => {
          setTokens(token, refreshToken)
          setUserId(user?.id)
          sessionStorage.setItem('activeEmail', email)
          setError('')
          toast.open({
            message: 'Email verified successfully',
            severity: 'success',
          })
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
          setError(err?.response?.data?.message || 'Invalid code. Please try again.')
        },
      },
    )
  }

  const handleResend = () => {
    resendMail()
    setResendCooldown(30)
  }

  return (
    <Stack spacing={2.2} width="100%">
      <Box
        sx={{
          p: 1.6,
          borderRadius: 1.5,
          backgroundColor: '#F1F2F0',
          border: `1px solid ${alpha(BRAND_ORANGE, 0.18)}`,
        }}
      >
        <Typography variant="body2" sx={{ color: '#5F5A57', lineHeight: 1.6 }}>
          Verification mail sent to <strong>{email}</strong>.
          <Box
            component="span"
            sx={{ ml: 0.8, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: BRAND_NAVY }}
            onClick={onEditEmail}
          >
            <FiEdit2 size={13} style={{ marginRight: 4 }} />
            Edit
          </Box>
        </Typography>
      </Box>

      <CustomInput
        label="Email Verification Code"
        type="text"
        prefix={<FiMail color={BRAND_NAVY} size={15} />}
        value={code}
        onChange={(e) => {
          setCode(e.target.value)
          if (touched) setError('')
        }}
        onBlur={() => setTouched(true)}
        required
        helperText={touched && error}
        error={touched && !!error}
        topMargin={false}
        sx={authInputSx}
      />

      <CustomIconLoadingButton
        text="Verify email and continue"
        onClick={handleSubmit}
        styles={primaryButtonStyles}
        loading={isPending}
        loadingText="Verifying..."
        textColor="#ffffff"
        variant="solid"
      />

      <CustomIconLoadingButton
        onClick={handleResend}
        textColor={BRAND_NAVY}
        text={resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
        disabled={resendCooldown > 0}
        loadingText="Please wait..."
        styles={secondaryButtonStyles}
        variant="text"
      />
    </Stack>
  )
}
