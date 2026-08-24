import { Request, Response } from 'express'
import { eq } from 'drizzle-orm'
import { db } from '../models/client'
import { users } from '../models/schema/users'
import { wallets } from '../models/schema/wallet'
import { getUserWalletTransactions } from '../models/services/wallet.service'
import { getOrCreateWalletOfUser } from '../models/services/walletTopupService'

export const getUserWalletBalance = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as any).user?.sub
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })

    const [userRecord] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    const [walletRecord] = await db
      .select({ id: wallets.id, userId: wallets.userId, balance: wallets.balance })
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1)

    if (!userRecord) {
      return res.status(401).json({ error: 'User not found for this session. Please log in again.' })
    }

    console.log('Wallet balance lookup debug:', {
      tokenSub: userId,
      userExists: Boolean(userRecord),
      walletExistsForTokenSub: Boolean(walletRecord),
      walletId: walletRecord?.id ?? null,
    })

    const balance = await getOrCreateWalletOfUser(userId)

    res.status(200).json({ message: 'success', data: { ...balance } })
  } catch (error: any) {
    if (String(error?.message || '').includes('User not found for wallet lookup')) {
      return res.status(401).json({ error: 'User not found for this session. Please log in again.' })
    }

    console.error('Wallet balance error:', error)
    res.status(404).json({ error: 'Wallet not found' })
  }
}

export const getWalletTransactionsController = async (req: any, res: Response) => {
  try {
    const userId = req.user?.sub // assuming you set user in middleware
    if (!userId) return res.status(401).json({ message: 'Unauthorized' })

    const {
      limit = 50,
      page = 1,
      type, // 'credit' | 'debit'
      dateFrom, // ISO string
      dateTo, // ISO string
    } = req.query

    const offset = (Number(page) - 1) * Number(limit)

    const transactions = await getUserWalletTransactions({
      userId,
      limit: Number(limit),
      offset,
      type: type as 'credit' | 'debit' | undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    })

    return res.status(200).json(transactions)
  } catch (err: any) {
    console.error('Error fetching wallet transactions:', err)
    return res.status(500).json({ message: 'Something went wrong', error: err.message })
  }
}
