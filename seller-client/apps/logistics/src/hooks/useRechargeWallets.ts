import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { confirmRecharge, createRechargeOrder } from '../api/wallet.api'

interface RechargeOptions {
  amount: number
  prefill: {
    name: string
    email: string
    contact: string
  }
}

interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill: {
    name: string
    email: string
    contact: string
  }
  theme: {
    color: string
  }
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>
  modal: {
    ondismiss: () => void
  }
  retry?: {
    enabled: boolean
  }
}

interface RazorpayPaymentResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayInstance {
  open: () => void
  on: (event: string, callback: (response?: unknown) => void) => void
  close: () => void
}

interface RazorpayConstructor {
  new (options: RazorpayCheckoutOptions): RazorpayInstance
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

const loadRazorpayCheckout = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) {
      resolve()
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_CHECKOUT_SRC}"]`,
    )

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Unable to load Razorpay checkout')),
        { once: true },
      )
      return
    }

    const script = document.createElement('script')
    script.src = RAZORPAY_CHECKOUT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Unable to load Razorpay checkout'))
    document.body.appendChild(script)
  })

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined
    return data?.error || data?.message || error.message || 'Recharge failed'
  }

  return error instanceof Error ? error.message : 'Recharge failed'
}

export const useRechargeWallet = () =>
  useMutation<void, Error, RechargeOptions>({
    mutationFn: async (options) => {
      try {
        await loadRazorpayCheckout()

        const orderData = await createRechargeOrder({
          amount: options.amount,
          name: options.prefill.name,
          email: options.prefill.email,
          phone: options.prefill.contact,
        })

        if (!orderData?.orderId || !orderData?.key) {
          throw new Error('Invalid Razorpay order response')
        }

        const razorpayOptions: RazorpayCheckoutOptions = {
          key: orderData.key,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: orderData.name || 'Kourier Boyz',
          description: orderData.description || 'Wallet Recharge',
          order_id: orderData.orderId,
          prefill: orderData.prefill,
          theme: orderData.theme || { color: '#ff6b00' },
          handler: async (response: RazorpayPaymentResponse) => {
            try {
              await confirmRecharge({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              })
              window.location.reload()
            } catch (error) {
              console.error('Payment confirmation error:', error)
              alert('Payment successful but confirmation failed. Please contact support.')
            }
          },
          modal: {
            ondismiss: () => {
              console.log('Payment cancelled by user')
            },
          },
          retry: {
            enabled: true,
          },
        }

        if (!window.Razorpay) {
          throw new Error('Razorpay checkout is not available')
        }

        const razorpay = new window.Razorpay(razorpayOptions)
        razorpay.on('payment.failed', (response) => {
          console.error('Razorpay payment failed:', response)
        })
        razorpay.open()
      } catch (error) {
        throw new Error(getErrorMessage(error))
      }
    },
  })
