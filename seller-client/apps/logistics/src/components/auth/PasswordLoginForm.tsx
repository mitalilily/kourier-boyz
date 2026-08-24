/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, FormControlLabel, Link, Stack, Tooltip, Typography } from '@mui/material'
import { useState, type Dispatch, type SetStateAction } from 'react'
import { FiMail } from 'react-icons/fi'
import { MdInfoOutline, MdPassword } from 'react-icons/md'
import { useAuth } from '../../context/auth/AuthContext'
import { useRequestPasswordLogin } from '../../hooks/useRequestPasswordLogin'
import CustomIconLoadingButton from '../UI/button/CustomLoadingButton'
import CustomCheckbox from '../UI/inputs/CustomCheckbox'
import CustomInput from '../UI/inputs/CustomInput'
import { toast } from '../UI/Toast'
import EmailVerificationForm from './EmailVerificationForm'

const BRAND_ORANGE = '#B78115'
const BRAND_BLUE = '#8F650F'

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

interface IPasswordFormProps {
  setStep: Dispatch<SetStateAction<number>>
  step: number
  setOpenTerms: Dispatch<SetStateAction<boolean>>
}

export default function PasswordLoginForm({ setStep, step, setOpenTerms }: IPasswordFormProps) {
  const { setTokens, setUserId } = useAuth()
  const { mutate: requestPasswordLogin, isPending } = useRequestPasswordLogin()

  const [emailForm, setEmailForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [touched, setTouched] = useState({ email: false, password: false })
  const [termsChecked, setTermsChecked] = useState(false)

  const validateEmail = (email: string): string => {
    if (!email) return 'Email is required.'
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return 'Enter a valid email format.'
    return ''
  }

  const validatePassword = (password: string): string => {
    if (!password) return 'Password is required.'
    if (password.length < 6) return 'Minimum 6 characters required.'
    return ''
  }

  const handleChange = (field: 'email' | 'password', value: string) => {
    setEmailForm((prev) => ({ ...prev, [field]: value }))

    if (touched[field]) {
      const error = field === 'email' ? validateEmail(value) : validatePassword(value)
      setErrors((prev) => ({ ...prev, [field]: error }))
    }
  }

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    const value = emailForm[field]
    const error = field === 'email' ? validateEmail(value) : validatePassword(value)
    setErrors((prev) => ({ ...prev, [field]: error }))
  }

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

  const isFormValid = !validateEmail(emailForm.email) && !validatePassword(emailForm.password)

  const handleSubmit = () => {
    if (!termsChecked) {
      toast.open({
        message: 'Please accept the Terms and Conditions to continue.',
        severity: 'warning',
        position: { vertical: 'top', horizontal: 'center' },
      })
      return
    }

    const emailError = validateEmail(emailForm.email)
    const passwordError = validatePassword(emailForm.password)

    setErrors({ email: emailError, password: passwordError })
    setTouched({ email: true, password: true })

    if (!emailError && !passwordError) {
      sessionStorage.setItem('preferredMethod', 'password')

      requestPasswordLogin(
        { email: emailForm.email, password: emailForm.password },
        {
          onSuccess: ({ message, token, refreshToken, user }) => {
            if (message) {
              toast.open({
                message,
                severity: 'success',
                position: { vertical: 'top', horizontal: 'center' },
              })
            }

            if (message.includes('Verification email sent')) {
              setStep(1)
              return
            }

            setUserId(user?.id)
            setTokens(token, refreshToken)
          },
          onError: (error: any) => {
            toast.open({
              message: error?.response?.data?.error || 'Something went wrong',
              severity: 'error',
              position: { vertical: 'top', horizontal: 'center' },
            })
          },
        },
      )
    }
  }

  return step === 0 ? (
    <Stack width="100%" spacing={2.4}>
      <Box
        sx={{
          p: 2,
          border: '1px solid #CED2D0',
          borderRadius: 1.5,
          backgroundColor: '#F1F2F0',
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
          Password Sign-In
        </Typography>
        <Typography sx={{ color: '#17171A', fontWeight: 700, mb: 0.35 }}>
          Login with your merchant credentials
        </Typography>
        <Typography variant="body2" sx={{ color: '#626966', lineHeight: 1.7 }}>
          Use your registered email and password. If this is your first password login, complete the
          email verification step when prompted.
        </Typography>
      </Box>

      <Box
        sx={{
          p: 0,
          border: '1px solid #CED2D0',
          borderRadius: 1.5,
          background: '#FFFFFF',
        }}
      >
        <Stack spacing={2.2} sx={{ p: 2 }}>
          <CustomInput
            prefix={<FiMail color={BRAND_BLUE} size={15} />}
            type="email"
            name="email"
            id="email"
            label="Email"
            value={emailForm.email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            required
            helperText={touched.email && errors.email}
            error={touched.email && !!errors.email}
            topMargin={false}
            sx={authInputSx}
          />

          <CustomInput
            label="Password"
            name="password"
            id="password"
            type="password"
            prefix={<MdPassword color={BRAND_BLUE} size={16} />}
            postfix={
              <Tooltip
                title={
                  <Typography fontSize="12px">
                    Existing Google users can set a password once and use both sign-in methods.
                  </Typography>
                }
                arrow
              >
                <Box sx={{ display: 'inline-flex', alignItems: 'center', color: BRAND_BLUE }}>
                  <MdInfoOutline size={17} />
                </Box>
              </Tooltip>
            }
            value={emailForm.password}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            required
            helperText={touched.password && errors.password}
            error={touched.password && !!errors.password}
            topMargin={false}
            sx={authInputSx}
          />
        </Stack>
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
          <Typography mt={0.4} variant="body2">
            {termsLabel}
          </Typography>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gap: 1,
        }}
      >
        <CustomIconLoadingButton
          type="button"
          text="Sign In With Password"
          styles={primaryButtonStyles}
          onClick={handleSubmit}
          disabled={!isFormValid}
          loading={isPending}
          loadingText="Signing in..."
          textColor="#fff"
        />

        <Typography
          variant="caption"
          sx={{ color: '#626966', fontWeight: 600, textAlign: 'center' }}
        >
          Additional verification may be applied to protect shipment, billing, and account access.
        </Typography>
      </Box>
    </Stack>
  ) : (
    <EmailVerificationForm
      onEditEmail={() => setStep(0)}
      email={emailForm.email}
      resendMail={handleSubmit}
      password={emailForm.password}
    />
  )
}
