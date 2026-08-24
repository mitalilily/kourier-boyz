import {
  Box,
  Button,
  FormControlLabel,
  Link,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { FiMail, FiUser } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/auth/AuthContext'
import { useRequestOtp } from '../../hooks/useOTP'
import { TERMS_AND_CONDITIONS } from '../../utils/constants'
import CustomIconLoadingButton from '../UI/button/CustomLoadingButton'
import CustomCheckbox from '../UI/inputs/CustomCheckbox'
import CustomInput from '../UI/inputs/CustomInput'
import CustomModal from '../UI/modal/CustomModal'
import { toast } from '../UI/Toast'
import OtpForm from './OtpForm'
import PasswordLoginForm from './PasswordLoginForm'

const BRAND_ORANGE = '#B78115'
const BRAND_BLUE = '#8F650F'
const DEMO_SELLER_EMAIL = 'merchant@kourier-boyz.local'

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

const secondaryButtonStyles = {
  width: '100%',
  border: '1px solid #CED2D0',
  backgroundColor: '#ffffff',
  color: '#202321',
  borderRadius: 1.5,
  minHeight: 48,
  boxShadow: 'none',
  '&:hover': {
    borderColor: BRAND_BLUE,
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
      borderColor: BRAND_BLUE,
      borderWidth: 1,
    },
  },
}

export default function PhoneForm() {
  const navigate = useNavigate()
  const { startDemo } = useAuth()
  const activeEmail = sessionStorage.getItem('activeEmail')
  const [step, setStep] = useState<number>(0)
  const [preferredLoginMethod, setPreferredLoginMethod] = useState<'phone' | 'password'>('phone')
  const [email, setEmail] = useState('')
  const [demoOtp, setDemoOtp] = useState<string | null>(null)
  const [termsChecked, setTermsChecked] = useState(false)
  const [openTerms, setOpenTerms] = useState(false)

  const { mutate: sendOtpRequest, isPending } = useRequestOtp()

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value.trim())
    setDemoOtp(null)
  }, [])

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const isValidEmail = email.length > 0 && emailRegex.test(email)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()

      if (!termsChecked) {
        toast.open({
          message: 'Please accept the Terms and Conditions to continue.',
          severity: 'warning',
          position: { vertical: 'top', horizontal: 'center' },
        })
        return
      }

      setPreferredLoginMethod('phone')
      sessionStorage.setItem('preferredMethod', 'phone')

      sendOtpRequest(email.toLowerCase().trim(), {
        onSuccess: (response) => {
          setDemoOtp(response.demoOtp ?? null)
          setStep(1)
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || 'OTP request failed'
          toast.open({
            message: msg,
            severity: 'error',
            position: { vertical: 'top', horizontal: 'center' },
          })
        },
      })
    },
    [email, termsChecked, sendOtpRequest],
  )

  useEffect(() => {
    if (activeEmail) setEmail(activeEmail)
  }, [activeEmail])

  const termsLabel = (
    <Typography fontSize="13px" display="flex" alignItems="center" gap="3px" color="#626966">
      I agree to{' '}
      <Link
        component="button"
        underline="hover"
        onClick={() => setOpenTerms(true)}
        sx={{ cursor: 'pointer', color: BRAND_ORANGE, fontWeight: 800 }}
      >
        Terms and Conditions
      </Link>
    </Typography>
  )

  const renderOtpEntry = () =>
    step === 0 ? (
      <Box component="form" onSubmit={handleSubmit} width="100%">
        <Stack spacing={2.4}>
          <Box
            sx={{
              p: 2,
              border: '1px solid #D9DCDA',
              borderRadius: 1.5,
              background: '#F1F2F0',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: BRAND_ORANGE,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                mb: 0.6,
              }}
            >
              Email Verification
            </Typography>

            <Typography sx={{ color: '#626966', fontSize: '0.88rem', lineHeight: 1.6 }}>
              We'll send a one-time code to your registered work email for secure access.
            </Typography>
          </Box>

          <CustomInput
            type="email"
            label="Work Email"
            value={email}
            name="email"
            id="email"
            onChange={handleEmailChange}
            required
            error={email.length > 0 && !isValidEmail}
            helperText={email.length > 0 && !isValidEmail ? 'Enter a valid email address.' : ''}
            autoFocus
            prefix={<FiMail color={BRAND_BLUE} size={15} />}
            topMargin={false}
            sx={authInputSx}
          />

          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.2,
              px: 1.5,
              py: 1.25,
              border: '1px solid #DED7C7',
              borderRadius: 1.5,
              backgroundColor: '#FBFAF7',
            }}
          >
            <Box>
              <Typography sx={{ color: '#202321', fontSize: '0.82rem', fontWeight: 800 }}>
                Demo seller
              </Typography>
              <Typography sx={{ color: '#626966', fontSize: '0.76rem' }}>
                {DEMO_SELLER_EMAIL} · onboarding complete
              </Typography>
            </Box>
            <Button
              type="button"
              size="small"
              startIcon={<FiUser size={14} />}
              onClick={() => {
                startDemo()
                navigate('/home', { replace: true })
              }}
              sx={{
                color: BRAND_BLUE,
                borderColor: '#CDB56E',
                fontWeight: 800,
                textTransform: 'none',
                whiteSpace: 'nowrap',
              }}
              variant="outlined"
            >
              Enter demo console
            </Button>
          </Box>

          <FormControlLabel
            sx={{
              m: 0,
              alignItems: 'flex-start',
              p: 1.2,
              borderRadius: 1.5,
              backgroundColor: '#FFFFFF',
              border: '1px solid #D9DCDA',
            }}
            control={
              <CustomCheckbox
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                color="primary"
                sx={{
                  '& .MuiBox-root': {
                    borderColor: termsChecked ? BRAND_BLUE : '#CED2D0',
                    color: BRAND_BLUE,
                  },
                }}
              />
            }
            label={
              <Typography mt={0.35} variant="body2">
                {termsLabel}
              </Typography>
            }
          />

          <CustomIconLoadingButton
            type="submit"
            styles={primaryButtonStyles}
            textColor="#ffffff"
            disabled={!email || !termsChecked || isPending || !isValidEmail}
            text="Send Verification Code"
            loading={isPending}
            loadingText="Sending..."
          />
        </Stack>
      </Box>
    ) : (
      <OtpForm
        email={email}
        demoOtp={demoOtp}
        onEditEmail={() => {
          setDemoOtp(null)
          setStep(0)
        }}
      />
    )

  return (
    <Stack spacing={2.4} alignItems="stretch">
      <Stack spacing={1.2}>
        <Typography
          sx={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: '#17171A',
            letterSpacing: '-0.01em',
          }}
        >
          Choose how you want to sign in
        </Typography>
      </Stack>

      <Box
        sx={{
          border: '1px solid #CED2D0',
          background: '#fff',
          borderRadius: 1.5,
          overflow: 'hidden',
          boxShadow: '0 18px 42px rgba(7, 19, 45, 0.06)',
        }}
      >
        <Box
          sx={{
            px: 1.2,
            py: 1.2,
            borderBottom: '1px solid #CED2D0',
            background: '#F1F2F0',
          }}
        >
          <ToggleButtonGroup
            value={preferredLoginMethod}
            exclusive
            onChange={(_, value) => {
              if (!value) return
              setPreferredLoginMethod(value)
              setDemoOtp(null)
              setStep(0)
            }}
            fullWidth
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 1,
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 800,
                border: '1px solid rgba(17,17,19,0.08) !important',
                color: '#6f6a67',
                px: 1.4,
                py: 1.15,
                borderRadius: '6px !important',
                justifyContent: 'center',
                backgroundColor: '#FFFFFF',
                '&.Mui-selected': {
                  color: '#202321',
                  backgroundColor: '#ffffff',
                  boxShadow: `inset 0 0 0 1px ${BRAND_BLUE}`,
                },
                '&:hover': {
                  backgroundColor: '#F8FBFF',
                },
              },
            }}
          >
            <ToggleButton value="phone">Email OTP</ToggleButton>
            <ToggleButton value="password">Email + Password</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ p: { xs: 2, sm: 2.4 } }}>
          {preferredLoginMethod === 'phone' ? (
            renderOtpEntry()
          ) : (
            <PasswordLoginForm step={step} setOpenTerms={setOpenTerms} setStep={setStep} />
          )}
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 1.2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Typography sx={{ fontSize: '0.8rem', color: '#626966', lineHeight: 1.6 }}>
          Need account policy details before signing in?
        </Typography>
        <CustomIconLoadingButton
          styles={secondaryButtonStyles}
          onClick={() => setOpenTerms(true)}
          variant="text"
          text="View Terms and Policies"
        />
      </Box>

      <CustomModal
        open={openTerms}
        onClose={() => setOpenTerms(false)}
        title="Terms and Conditions"
      >
        <Typography
          variant="body2"
          sx={{
            whiteSpace: 'pre-line',
            maxHeight: '60vh',
            overflowY: 'auto',
            pr: 1,
          }}
        >
          {TERMS_AND_CONDITIONS}
        </Typography>
      </CustomModal>
    </Stack>
  )
}
