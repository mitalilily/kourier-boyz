import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import Razorpay from 'razorpay'

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

type RazorpayMode = 'test' | 'live'

type RazorpayCredentials = {
  key_id: string
  key_secret: string
}

const resolveMode = (): RazorpayMode => {
  const configured = process.env.RAZORPAY_MODE
  if (configured === 'test' || configured === 'live') {
    return configured
  }
  return process.env.NODE_ENV === 'production' ? 'live' : 'test'
}

const getCredentials = (mode: RazorpayMode): RazorpayCredentials => {
  return mode === 'live'
    ? {
        key_id: process.env.RAZORPAY_KEY_ID_PROD || process.env.RAZORPAY_KEY_ID || '',
        key_secret: process.env.RAZORPAY_KEY_SECRET_PROD || process.env.RAZORPAY_KEY_SECRET || '',
      }
    : {
        key_id: process.env.RAZORPAY_KEY_ID || '',
        key_secret: process.env.RAZORPAY_KEY_SECRET || '',
      }
}

const getActiveSecret = () => {
  const mode = resolveMode()
  const { key_secret } = getCredentials(mode)
  return key_secret
}

const assertConfigured = () => {
  const mode = resolveMode()
  const credentials = getCredentials(mode)

  if (!credentials.key_id || !credentials.key_secret) {
    throw new Error(`[Razorpay] Missing env vars for ${mode.toUpperCase()} mode`)
  }

  return { mode, credentials }
}

let cachedClient: Razorpay | null = null
let cachedApi:
  | ReturnType<typeof axios.create>
  | null = null

export const getRazorpayMode = () => resolveMode()

export const isRazorpayConfigured = () => {
  try {
    const { credentials } = assertConfigured()
    return Boolean(credentials.key_id && credentials.key_secret)
  } catch {
    return false
  }
}

export const getRazorpay = () => {
  if (!cachedClient) {
    const { mode, credentials } = assertConfigured()
    cachedClient = new Razorpay(credentials)
    console.info(`[Razorpay] Initialised in ${mode.toUpperCase()} mode with key ${credentials.key_id}`)
  }

  return cachedClient
}

export const getRazorpayApi = () => {
  if (!cachedApi) {
    const { credentials } = assertConfigured()
    cachedApi = axios.create({
      baseURL: 'https://api.razorpay.com/v1',
      auth: {
        username: credentials.key_id,
        password: credentials.key_secret,
      },
    })
  }

  return cachedApi
}

export function isValidSig(body: string, sig: string) {
  const mode = resolveMode()
  const secret =
    mode === 'live'
      ? process.env.RAZORPAY_WEBHOOK_SECRET_PROD
      : process.env.RAZORPAY_WEBHOOK_SECRET

  if (!secret) {
    throw new Error(`[Razorpay] Missing webhook secret for ${mode.toUpperCase()} mode`)
  }

  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return expected === sig
}

export function isValidCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const secret = getActiveSecret()
  if (!secret) {
    throw new Error(`[Razorpay] Missing key secret for ${resolveMode().toUpperCase()} mode`)
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  return expected === signature
}
