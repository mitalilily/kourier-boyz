import { Request, Response } from 'express'
import { confirmSuccess, createWalletOrder, markTopupProcessing } from '../models/services/walletTopupService'
import { getPaymentOptions } from '../models/services/paymentOptions.service'
import { getRazorpayApi, isValidCheckoutSignature } from '../utils/razorpay'

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Top-up failed'

export const createTopup = async (req: Request, res: Response): Promise<any> => {
  const amt = Number(req.body.amount)
  const { name, email, phone } = req.body

  if (!amt || amt <= 0) {
    return res.status(400).json({ error: 'Invalid amount' })
  }
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing customer details' })
  }

  try {
    // Enforce minimum wallet recharge amount (if configured)
    const paymentSettings = await getPaymentOptions()
    const minWalletRecharge = paymentSettings.minWalletRecharge ?? 0

    if (minWalletRecharge > 0 && amt < minWalletRecharge) {
      return res.status(400).json({
        error: `Minimum wallet recharge amount is ₹${minWalletRecharge}`,
        minWalletRecharge,
      })
    }

    const userId = (req as any).user?.sub

    // Razorpay order creation
    const data = await createWalletOrder(userId, amt, { name, email, phone })

    // returns { orderId, amount, currency, key, name, description, prefill, theme }
    res.status(201).json(data)
  } catch (err) {
    console.error('Razorpay top-up error:', err)
    const message = getErrorMessage(err)
    res.status(500).json({
      error: message.startsWith('[Razorpay]') ? message : 'Top-up failed',
    })
  }
}

export const confirmFromClient = async (req: Request, res: Response) => {
  const { orderId, paymentId, signature } = req.body

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: 'Missing Razorpay payment confirmation details' })
  }

  try {
    if (!isValidCheckoutSignature(orderId, paymentId, signature)) {
      return res.status(400).json({ error: 'Invalid Razorpay payment signature' })
    }

    const razorpayApi = getRazorpayApi()
    const { data: payment } = await razorpayApi.get(`/payments/${paymentId}`)

    if (payment?.order_id !== orderId) {
      return res.status(400).json({ error: 'Razorpay payment does not belong to this order' })
    }

    if (payment?.status === 'captured') {
      await confirmSuccess(orderId, paymentId, Number(payment.amount))
      return res.json({ ok: true, status: 'success' })
    }

    await markTopupProcessing(orderId, paymentId)
    return res.json({ ok: true, status: payment?.status || 'processing' })
  } catch (error) {
    console.error('Razorpay confirmation error:', error)
    const message = getErrorMessage(error)
    return res.status(500).json({
      error: message.startsWith('[Razorpay]') ? message : 'Payment confirmation failed',
    })
  }
}
