import type { Request, Response } from 'express'
import User from '../models/User'

export const saveKYCDraft = async (req: Request, res: Response) => {
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
      return res.status(400).json({ error: 'Only sellers can update KYC draft' })
    }

    const {
      // Business
      businessName,
      businessType,
      businessRegistrationNumber,
      dateOfEstablishment,
      storeDescription,
      // Address
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      // Bank
      bankAccountNumber,
      accountHolderName,
      bankName,
      ifscCode,
      // Tax & Legal
      panNumber,
      gstNumber,
      aadhaarNumber,
      // Authorized person
      authorizedPersonName,
      authorizedPersonDesignation,
    } = req.body as Record<string, unknown>

    // Update only provided fields
    if (businessName !== undefined) user.businessName = businessName as string
    if (businessType !== undefined) user.businessType = businessType as any
    if (businessRegistrationNumber !== undefined)
      user.businessRegistrationNumber = businessRegistrationNumber as string
    if (dateOfEstablishment !== undefined) {
      user.dateOfEstablishment = dateOfEstablishment
        ? new Date(dateOfEstablishment as string)
        : undefined
    }
    if (storeDescription !== undefined) user.storeDescription = storeDescription as string

    if (addressLine1 !== undefined) user.addressLine1 = addressLine1 as string
    if (addressLine2 !== undefined) user.addressLine2 = addressLine2 as string
    if (city !== undefined) user.city = city as string
    if (state !== undefined) user.state = state as string
    if (postalCode !== undefined) user.postalCode = postalCode as string
    if (country !== undefined) user.country = country as string

    if (bankAccountNumber !== undefined) user.bankAccountNumber = bankAccountNumber as string
    if (accountHolderName !== undefined) user.accountHolderName = accountHolderName as string
    if (bankName !== undefined) user.bankName = bankName as string
    if (ifscCode !== undefined) user.ifscCode = ifscCode as string

    if (panNumber !== undefined) user.panNumber = panNumber as string
    if (gstNumber !== undefined) user.gstNumber = gstNumber as string
    if (aadhaarNumber !== undefined) user.aadhaarNumber = aadhaarNumber as string

    if (authorizedPersonName !== undefined)
      user.authorizedPersonName = authorizedPersonName as string
    if (authorizedPersonDesignation !== undefined)
      user.authorizedPersonDesignation = authorizedPersonDesignation as string

    await user.save()

    const userResponse = user.toObject() as { password?: string }
    delete userResponse.password

    return res.json({
      message: 'KYC draft saved successfully',
      user: userResponse,
    })
  } catch (error) {
    console.error('Error saving KYC draft:', error)
    return res.status(500).json({ error: 'Failed to save KYC draft' })
  }
}
