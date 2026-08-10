import type { Request, Response } from 'express'
import User from '../models/User'
import { createBankAccountValidation } from '../services/bankVerification.service'

export const verifySellerBankAccount = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const user = await User.findById(sellerId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (user.role !== 'seller') {
      return res.status(400).json({ error: 'Only sellers can verify bank account' })
    }

    const {
      bankAccountNumber: bodyAccountNumber,
      ifscCode: bodyIfsc,
      accountHolderName: bodyAccountHolderName,
      bankName: bodyBankName,
    } = req.body as {
      bankAccountNumber?: string
      ifscCode?: string
      accountHolderName?: string
      bankName?: string
    }

    const bankAccountNumber = bodyAccountNumber || user.bankAccountNumber
    const ifscCode = bodyIfsc || user.ifscCode
    const accountHolderName = bodyAccountHolderName || user.accountHolderName
    const bankName = bodyBankName || user.bankName

    if (!bankAccountNumber || !ifscCode || !accountHolderName) {
      return res.status(400).json({
        error: 'Bank account number, IFSC code and account holder name are required for verification',
      })
    }

    // Persist latest bank details on user
    user.bankAccountNumber = bankAccountNumber
    user.ifscCode = ifscCode
    user.accountHolderName = accountHolderName
    if (bankName) {
      user.bankName = bankName
    }

    // Mark verification as pending before calling provider
    user.bankVerified = false
    user.bankVerificationStatus = 'pending'
    await user.save()

    const result = await createBankAccountValidation({
      sellerId: user._id.toString(),
      accountNumber: bankAccountNumber,
      ifsc: ifscCode,
      accountHolderName,
    })

    // Update user based on validation result
    user.bankVerificationReference = result.validationId
    user.bankVerificationName = result.bankAccountName
    user.bankVerificationStatus = result.status
    user.bankVerified = result.status === 'success'
    await user.save()

    const userResponse = user.toObject() as { password?: string }
    delete userResponse.password

    return res.json({
      message:
        result.status === 'success'
          ? 'Bank account verified successfully'
          : result.status === 'failed'
          ? 'Bank account verification failed. Please check the details and try again.'
          : 'Bank account verification initiated',
      status: result.status,
      user: userResponse,
    })
  } catch (error) {
    console.error('Error verifying bank account:', error)
    return res.status(500).json({ error: 'Failed to verify bank account' })
  }
}


