import axios from 'axios'

const RAZORPAYX_KEY_ID = process.env.RAZORPAYX_KEY_ID || ''
const RAZORPAYX_KEY_SECRET = process.env.RAZORPAYX_KEY_SECRET || ''
const RAZORPAYX_ACCOUNT_NUMBER = process.env.RAZORPAYX_ACCOUNT_NUMBER || ''

if (!RAZORPAYX_KEY_ID || !RAZORPAYX_KEY_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('⚠️ RazorpayX keys are not configured. Bank verification will be disabled.')
}

export interface BankVerificationRequest {
  sellerId: string
  accountNumber: string
  ifsc: string
  accountHolderName: string
}

export interface BankVerificationResult {
  validationId: string
  status: 'pending' | 'success' | 'failed'
  bankAccountName?: string
  raw?: unknown
}

export const createBankAccountValidation = async (
  payload: BankVerificationRequest,
): Promise<BankVerificationResult> => {
  if (!RAZORPAYX_KEY_ID || !RAZORPAYX_KEY_SECRET || !RAZORPAYX_ACCOUNT_NUMBER) {
    throw new Error('RazorpayX is not configured')
  }

  const auth = Buffer.from(`${RAZORPAYX_KEY_ID}:${RAZORPAYX_KEY_SECRET}`).toString('base64')

  // Request shaped as per RazorpayX Composite Account Validation (Bank Account) docs
  const requestBody = {
    source_account_number: RAZORPAYX_ACCOUNT_NUMBER,
    validation_type: 'optimized' as const,
    reference_id: payload.sellerId,
    notes: {
      sellerId: payload.sellerId,
    },
    fund_account: {
      account_type: 'bank_account',
      bank_account: {
        name: payload.accountHolderName,
        ifsc: payload.ifsc,
        account_number: payload.accountNumber,
      },
      // Minimal contact object – can be expanded later with email/phone if needed
      contact: {
        name: payload.accountHolderName,
        type: 'vendor',
      },
    },
  }

  const response = await axios.post(
    'https://api.razorpay.com/v1/fund_accounts/validations',
    requestBody,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    },
  )

  const data = response.data as any
  const validationId = data.id as string

  // As per docs: top-level status + validation_results.account_status / registered_name
  const topStatus = (data.status as string | undefined) || ''
  const validationResults = (data.validation_results || {}) as {
    account_status?: string | null
    registered_name?: string | null
  }

  const accountStatus = (validationResults.account_status || '') as string
  const registeredName = (validationResults.registered_name || '') as string

  let status: 'pending' | 'success' | 'failed' = 'pending'

  if (topStatus.toLowerCase() === 'failed') {
    status = 'failed'
  } else if (topStatus.toLowerCase() === 'completed') {
    // Treat completed as success; you can tighten this based on account_status if desired
    status = 'success'
  }

  return {
    validationId,
    status,
    bankAccountName: registeredName,
    raw: data,
  }
}
