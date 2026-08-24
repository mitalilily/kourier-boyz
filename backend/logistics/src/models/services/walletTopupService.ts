import { and, eq, or, sql } from 'drizzle-orm'
import { getRazorpay, getRazorpayMode } from '../../utils/razorpay'
import { db } from '../client'
import { wallets, walletTopups } from '../schema/wallet'
import { users } from '../schema/users'
import { createWalletTransaction } from './wallet.service'

import * as dotenv from 'dotenv'
import path from 'path'

// Load correct .env based on NODE_ENV
const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

/* helper */
export async function walletOfUser(userId: string, tx: any = db) {
  const executor = tx ?? db
  const [wallet] = await executor.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
  if (!wallet) throw new Error('Wallet not found')
  return wallet
}

export async function getOrCreateWalletOfUser(userId: string, tx: any = db) {
  const executor = tx ?? db
  const [existingWallet] = await executor
    .select()
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1)

  if (existingWallet) return existingWallet

  const [user] = await executor.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) {
    throw new Error(`User not found for wallet lookup: ${userId}`)
  }

  const [createdWallet] = await executor
    .insert(wallets)
    .values({
      userId,
      balance: sql`0`,
    })
    .returning()

  return createdWallet
}

export async function createWalletOrder(
  userId: string,
  amount: number,
  details: { name: string; email: string; phone: string },
) {
  const razorpay = getRazorpay()
  const wallet = await walletOfUser(userId)

  // Generate unique order ID
  const orderId = `wallet_${Date.now()}_${Math.floor(Math.random() * 1000)}`

  // Create Razorpay order
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(amount * 100), // Convert to paise
    currency: wallet.currency ?? 'INR',
    receipt: orderId,
    notes: {
      userId,
      walletId: wallet.id,
      type: 'wallet_recharge',
    },
  })

  // Insert into walletTopups as "created"
  await db.insert(walletTopups).values({
    walletId: wallet.id,
    amount,
    currency: wallet.currency ?? 'INR',
    gatewayOrderId: razorpayOrder.id,
    status: 'created',
  })

  // Get the correct key based on mode (same logic as razorpay.ts)
  const MODE: 'test' | 'live' = getRazorpayMode()
  const keyId =
    MODE === 'live'
      ? process.env.RAZORPAY_KEY_ID_PROD || process.env.RAZORPAY_KEY_ID
      : process.env.RAZORPAY_KEY_ID

  if (!keyId) {
    throw new Error(`[Razorpay] Missing checkout key for ${MODE.toUpperCase()} mode`)
  }

  // Return Razorpay order details for frontend
  return {
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    key: keyId,
    name: 'Kourier Boyz',
    description: 'Wallet Recharge',
    prefill: {
      name: details.name,
      email: details.email,
      contact: details.phone,
    },
    theme: {
      color: '#ff6b00',
    },
  }
}

/* 2️⃣  success */
export async function confirmSuccess(orderId: string, paymentId: string, paise: number) {
  const amount = paise / 100

  // Handle both 'created' and 'processing' statuses (frontend may mark as processing first)
  const [row] = await db
    .update(walletTopups)
    .set({
      status: 'success',
      gatewayPaymentId: paymentId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(walletTopups.gatewayOrderId, orderId),
        or(eq(walletTopups.status, 'created'), eq(walletTopups.status, 'processing')),
      ),
    )
    .returning()

  if (!row) {
    console.error('❌ Topup not found for order:', orderId)
    return
  }

  // Create wallet transaction
  await createWalletTransaction({
    walletId: row.walletId,
    amount: row.amount,
    currency: row.currency ?? 'INR',
    type: 'credit',
    ref: paymentId,
    reason: 'Wallet Recharge',
    meta: { orderId, gateway: 'razorpay' },
  })
}

/* 3️⃣  failure */
export async function confirmFailure(orderId: string, paymentId: string | null, reason: string) {
  await db
    .update(walletTopups)
    .set({
      status: 'failed',
      gatewayPaymentId: paymentId,
      meta: { reason },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(walletTopups.gatewayOrderId, orderId),
        or(eq(walletTopups.status, 'created'), eq(walletTopups.status, 'processing')),
      ),
    )
    .returning()
}

/* 4️⃣  hmac */

export async function markTopupProcessing(orderId: string, paymentId: string) {
  await db
    .update(walletTopups)
    .set({
      status: 'processing',
      gatewayPaymentId: paymentId,
      updatedAt: new Date(),
    })
    .where(and(eq(walletTopups.gatewayOrderId, orderId), eq(walletTopups.status, 'created')))
}
