import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import AdminInvoiceSettings from '../models/AdminInvoiceSettings'
import AdminSettlementSettings from '../models/AdminSettlementSettings'
import SiteSettings from '../models/SiteSettings'
import SLASettings from '../models/SLASettings'
import { clearBrandingSettingsCache } from '../utils/brandingSettings'
import { uploadToR2 } from '../utils/r2Upload'

const uploadBrandingAsset = async (
  file?: Express.Multer.File,
  keyPrefix?: string,
): Promise<string | undefined> => {
  if (!file) return undefined
  const extension = file.mimetype.split('/')[1] || 'png'
  const key = `branding/${keyPrefix ?? 'asset'}-${Date.now()}.${extension}`
  return uploadToR2(file.buffer, key, file.mimetype, 'branding')
}

const uploadAboutUsAsset = async (
  file?: Express.Multer.File,
  keyPrefix?: string,
): Promise<string | undefined> => {
  if (!file) return undefined
  const extension = file.mimetype.split('/')[1] || 'png'
  const key = `about-us/${keyPrefix ?? 'asset'}-${Date.now()}.${extension}`
  return uploadToR2(file.buffer, key, file.mimetype, 'about-us')
}

export const getBrandingSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await SiteSettings.getSingleton()
    res.json({
      success: true,
      data: settings.branding || {},
    })
  } catch (error) {
    console.error('Failed to fetch branding settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch branding settings' })
  }
}

// Public endpoint for branding settings (for invoices, labels, etc.)
export const getPublicBranding = async (_req: Request, res: Response) => {
  try {
    const settings = await SiteSettings.getSingleton()
    res.json({
      success: true,
      data: settings.branding || {},
    })
  } catch (error) {
    console.error('Failed to fetch public branding settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch branding settings' })
  }
}

export const updateBrandingSettings = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const settings = await SiteSettings.getSingleton()
    const files = req.files as Record<string, Express.Multer.File[]>
    const branding = { ...(settings.branding || {}) }

    if (files?.invoiceLogo?.[0]) {
      branding.invoiceLogoUrl = await uploadBrandingAsset(files.invoiceLogo[0], 'invoice-logo')
    } else if (req.body.clearInvoiceLogo === 'true') {
      branding.invoiceLogoUrl = undefined
    }

    if (files?.labelLogo?.[0]) {
      branding.labelLogoUrl = await uploadBrandingAsset(files.labelLogo[0], 'label-logo')
    } else if (req.body.clearLabelLogo === 'true') {
      branding.labelLogoUrl = undefined
    }

    if (files?.authorizedSignature?.[0]) {
      branding.signatureUrl = await uploadBrandingAsset(files.authorizedSignature[0], 'signature')
    } else if (req.body.clearSignature === 'true') {
      branding.signatureUrl = undefined
    }

    if (typeof req.body.signatureName === 'string') {
      branding.signatureName = req.body.signatureName.trim() || undefined
    }

    if (typeof req.body.signatureTitle === 'string') {
      branding.signatureTitle = req.body.signatureTitle.trim() || undefined
    }

    if (typeof req.body.companyName === 'string') {
      branding.companyName = req.body.companyName.trim() || undefined
    }

    if (typeof req.body.companyTagline === 'string') {
      branding.companyTagline = req.body.companyTagline.trim() || undefined
    }

    settings.branding = branding
    settings.updatedBy = new mongoose.Types.ObjectId(adminId)
    await settings.save()
    clearBrandingSettingsCache()

    res.json({
      success: true,
      data: branding,
    })
  } catch (error) {
    console.error('Failed to update branding settings:', error)
    res.status(500).json({ success: false, message: 'Failed to update branding settings' })
  }
}

// About Us Settings
export const getAboutUsSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await SiteSettings.getSingleton()
    res.json({
      success: true,
      data: settings.aboutUs || {},
    })
  } catch (error) {
    console.error('Failed to fetch about us settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch about us settings' })
  }
}

export const updateAboutUsSettings = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const settings = await SiteSettings.getSingleton()
    const files = req.files as Record<string, Express.Multer.File[]>
    const aboutUs = { ...(settings.aboutUs || {}) }

    // Handle hero image upload
    if (files?.heroImage?.[0]) {
      aboutUs.heroImage = await uploadAboutUsAsset(files.heroImage[0], 'hero-image')
    } else if (req.body.clearHeroImage === 'true') {
      aboutUs.heroImage = undefined
    }

    // Handle text fields
    if (typeof req.body.title === 'string') {
      aboutUs.title = req.body.title.trim() || 'About Us'
    }

    if (typeof req.body.content === 'string') {
      aboutUs.content = req.body.content
    }

    if (typeof req.body.mission === 'string') {
      aboutUs.mission = req.body.mission.trim() || undefined
    }

    if (typeof req.body.vision === 'string') {
      aboutUs.vision = req.body.vision.trim() || undefined
    }

    if (typeof req.body.isPublished !== 'undefined') {
      aboutUs.isPublished = req.body.isPublished === 'true' || req.body.isPublished === true
    }

    settings.aboutUs = aboutUs
    settings.updatedBy = new mongoose.Types.ObjectId(adminId)
    await settings.save()

    res.json({
      success: true,
      data: aboutUs,
    })
  } catch (error) {
    console.error('Failed to update about us settings:', error)
    res.status(500).json({ success: false, message: 'Failed to update about us settings' })
  }
}

// Public endpoint - no auth required
export const getPublicAboutUs = async (_req: Request, res: Response) => {
  try {
    const settings = await SiteSettings.getSingleton()
    const aboutUs = settings.aboutUs || {}

    // Only return if published
    if (!aboutUs.isPublished) {
      return res.status(404).json({
        success: false,
        message: 'About Us page is not available',
      })
    }

    res.json({
      success: true,
      data: {
        title: aboutUs.title || 'About Us',
        content: aboutUs.content || '',
        heroImage: aboutUs.heroImage,
        mission: aboutUs.mission,
        vision: aboutUs.vision,
      },
    })
  } catch (error) {
    console.error('Failed to fetch public about us:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch about us content' })
  }
}

// Invoice Settings
export const getInvoiceSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await AdminInvoiceSettings.getSingleton()
    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Failed to fetch invoice settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch invoice settings' })
  }
}

// Public endpoint for invoice settings (for invoices, labels, etc.)
export const getPublicInvoiceSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await AdminInvoiceSettings.getSingleton()
    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Failed to fetch public invoice settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch invoice settings' })
  }
}

export const updateInvoiceSettings = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const settings = await AdminInvoiceSettings.getSingleton()

    // Update fields if provided
    if (typeof req.body.invoicePrefix === 'string') {
      settings.invoicePrefix = req.body.invoicePrefix.trim()
    }
    if (typeof req.body.creditNotePrefix === 'string') {
      settings.creditNotePrefix = req.body.creditNotePrefix.trim()
    }
    if (typeof req.body.debitNotePrefix === 'string') {
      settings.debitNotePrefix = req.body.debitNotePrefix.trim()
    }
    if (typeof req.body.financialYearFormat === 'string') {
      settings.financialYearFormat = req.body.financialYearFormat.trim()
    }
    if (typeof req.body.sequenceStart === 'number') {
      settings.sequenceStart = Math.max(1, req.body.sequenceStart)
    }
    if (typeof req.body.resetFrequency === 'string') {
      if (['FINANCIAL_YEAR', 'CALENDAR_YEAR', 'NEVER'].includes(req.body.resetFrequency)) {
        settings.resetFrequency = req.body.resetFrequency as any
      }
    }
    if (typeof req.body.currency === 'string') {
      settings.currency = req.body.currency.trim()
    }
    if (typeof req.body.roundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.roundingMode,
        )
      ) {
        settings.roundingMode = req.body.roundingMode as any
      }
    }
    if (typeof req.body.gstRoundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.gstRoundingMode,
        )
      ) {
        settings.gstRoundingMode = req.body.gstRoundingMode as any
      }
    }
    if (typeof req.body.dateFormat === 'string') {
      settings.dateFormat = req.body.dateFormat.trim()
    }
    if (typeof req.body.showHsnSummary === 'boolean') {
      settings.showHsnSummary = req.body.showHsnSummary
    }
    if (typeof req.body.showGstBreakup === 'boolean') {
      settings.showGstBreakup = req.body.showGstBreakup
    }
    if (typeof req.body.allowSellerLogo === 'boolean') {
      settings.allowSellerLogo = req.body.allowSellerLogo
    }
    if (typeof req.body.allowSellerSignature === 'boolean') {
      settings.allowSellerSignature = req.body.allowSellerSignature
    }
    if (typeof req.body.allowSellerFooterNote === 'boolean') {
      settings.allowSellerFooterNote = req.body.allowSellerFooterNote
    }
    if (typeof req.body.lockAfterIssue === 'boolean') {
      settings.lockAfterIssue = req.body.lockAfterIssue
    }

    settings.updatedBy = new mongoose.Types.ObjectId(adminId)
    await settings.save()

    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Failed to update invoice settings:', error)
    res.status(500).json({ success: false, message: 'Failed to update invoice settings' })
  }
}

// SLA / TAT Settings
export const getSLASettings = async (_req: Request, res: Response) => {
  try {
    const settings = await SLASettings.getSingleton()
    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Failed to fetch SLA settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch SLA settings' })
  }
}

export const updateSLASettings = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const settings = await SLASettings.getSingleton()

    // Update AWB Generation TAT
    if (typeof req.body.awbGenerationTatHours === 'number') {
      if (req.body.awbGenerationTatHours < 1) {
        return res.status(400).json({
          success: false,
          message: 'AWB Generation TAT must be at least 1 hour',
        })
      }
      settings.awbGenerationTatHours = req.body.awbGenerationTatHours
    }

    // Update Dispatch TAT
    if (typeof req.body.dispatchTatHours === 'number') {
      if (req.body.dispatchTatHours < 1) {
        return res.status(400).json({
          success: false,
          message: 'Dispatch TAT must be at least 1 hour',
        })
      }
      settings.dispatchTatHours = req.body.dispatchTatHours
    }

    // Update seller overrides if provided
    if (Array.isArray(req.body.sellerOverrides)) {
      settings.sellerOverrides = req.body.sellerOverrides.map((override: any) => ({
        sellerId: new mongoose.Types.ObjectId(override.sellerId),
        awbGenerationTatHours: override.awbGenerationTatHours,
        dispatchTatHours: override.dispatchTatHours,
      }))
    }

    settings.updatedBy = new mongoose.Types.ObjectId(adminId)
    await settings.save()

    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Failed to update SLA settings:', error)
    res.status(500).json({ success: false, message: 'Failed to update SLA settings' })
  }
}

// Footer Settings
export const getFooterSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await SiteSettings.getSingleton()
    res.json({
      success: true,
      data: settings.footer || {},
    })
  } catch (error) {
    console.error('Failed to fetch footer settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch footer settings' })
  }
}

export const updateFooterSettings = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const settings = await SiteSettings.getSingleton()
    const footer = { ...(settings.footer || {}) }

    // Update fields if provided
    if (typeof req.body.description === 'string') {
      footer.description = req.body.description.trim() || undefined
    }

    if (typeof req.body.phone === 'string') {
      footer.phone = req.body.phone.trim() || undefined
    }

    if (typeof req.body.email === 'string') {
      footer.email = req.body.email.trim() || undefined
    }

    if (typeof req.body.address === 'string') {
      footer.address = req.body.address.trim() || undefined
    }

    // Update social links if provided
    if (Array.isArray(req.body.socialLinks)) {
      footer.socialLinks = req.body.socialLinks
        .filter((link: any) => link.platform && link.url)
        .map((link: any, index: number) => ({
          platform: link.platform,
          url: link.url.trim(),
          order: typeof link.order === 'number' ? link.order : index,
        }))
    }

    settings.footer = footer
    settings.updatedBy = new mongoose.Types.ObjectId(adminId)
    await settings.save()

    res.json({
      success: true,
      data: footer,
    })
  } catch (error) {
    console.error('Failed to update footer settings:', error)
    res.status(500).json({ success: false, message: 'Failed to update footer settings' })
  }
}

// Public endpoint - no auth required
export const getPublicFooter = async (_req: Request, res: Response) => {
  try {
    const settings = await SiteSettings.getSingleton()
    const footer = settings.footer || {}

    res.json({
      success: true,
      data: {
        description: footer.description || '',
        phone: footer.phone || '',
        email: footer.email || '',
        address: footer.address || '',
        socialLinks: footer.socialLinks || [],
      },
    })
  } catch (error) {
    console.error('Failed to fetch public footer:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch footer content' })
  }
}

// Settlement Calculation Settings
export const getSettlementSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await AdminSettlementSettings.getSingleton()
    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Failed to fetch settlement settings:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch settlement settings' })
  }
}

export const updateSettlementSettings = async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const settings = await AdminSettlementSettings.getSingleton()

    // Update commission settings
    // Note: commissionType and commissionValue come from Global/Seller settings, not here
    if (typeof req.body.commissionRoundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.commissionRoundingMode,
        )
      ) {
        settings.commissionRoundingMode = req.body.commissionRoundingMode as any
      }
    }

    // Update fee calculation settings
    if (typeof req.body.includeShippingInSaleAmount === 'boolean') {
      settings.includeShippingInSaleAmount = req.body.includeShippingInSaleAmount
    }
    if (typeof req.body.includeShippingInNetAmount === 'boolean') {
      settings.includeShippingInNetAmount = req.body.includeShippingInNetAmount
    }

    // Update rounding settings
    if (typeof req.body.settlementAmountRoundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.settlementAmountRoundingMode,
        )
      ) {
        settings.settlementAmountRoundingMode = req.body.settlementAmountRoundingMode as any
      }
    }
    if (typeof req.body.feeRoundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.feeRoundingMode,
        )
      ) {
        settings.feeRoundingMode = req.body.feeRoundingMode as any
      }
    }
    if (typeof req.body.ledgerEntryRoundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.ledgerEntryRoundingMode,
        )
      ) {
        settings.ledgerEntryRoundingMode = req.body.ledgerEntryRoundingMode as any
      }
    }

    // Update ledger calculation settings
    if (typeof req.body.roundLedgerEntriesIndividually === 'boolean') {
      settings.roundLedgerEntriesIndividually = req.body.roundLedgerEntriesIndividually
    }
    if (typeof req.body.roundLedgerAggregation === 'boolean') {
      settings.roundLedgerAggregation = req.body.roundLedgerAggregation
    }
    if (typeof req.body.ledgerAggregationRoundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.ledgerAggregationRoundingMode,
        )
      ) {
        settings.ledgerAggregationRoundingMode = req.body.ledgerAggregationRoundingMode as any
      }
    }


    // Update fee calculation methods
    if (typeof req.body.courierFeeCalculationMethod === 'string') {
      if (['AWB_WISE', 'ORDER_WISE'].includes(req.body.courierFeeCalculationMethod)) {
        settings.courierFeeCalculationMethod = req.body.courierFeeCalculationMethod as any
      }
    }
    if (typeof req.body.codFeeCalculationMethod === 'string') {
      if (['AWB_WISE', 'ORDER_WISE'].includes(req.body.codFeeCalculationMethod)) {
        settings.codFeeCalculationMethod = req.body.codFeeCalculationMethod as any
      }
    }
    if (typeof req.body.pgFeeCalculationMethod === 'string') {
      if (['PERCENTAGE', 'FIXED', 'FROM_PAYMENT_META'].includes(req.body.pgFeeCalculationMethod)) {
        settings.pgFeeCalculationMethod = req.body.pgFeeCalculationMethod as any
      }
    }
    if (typeof req.body.pgFeePercentage === 'number') {
      settings.pgFeePercentage = Math.max(0, Math.min(100, req.body.pgFeePercentage))
    }
    if (typeof req.body.pgFeeFixedAmount === 'number') {
      settings.pgFeeFixedAmount = Math.max(0, req.body.pgFeeFixedAmount)
    }

    // Update calculation order and method
    if (typeof req.body.netAmountCalculationMethod === 'string') {
      if (['CREDITS_MINUS_DEBITS', 'SALE_MINUS_ALL'].includes(req.body.netAmountCalculationMethod)) {
        settings.netAmountCalculationMethod = req.body.netAmountCalculationMethod as any
      }
    }

    // Update settlement eligibility logic
    if (typeof req.body.requireOrderDelivered === 'boolean') {
      settings.requireOrderDelivered = req.body.requireOrderDelivered
    }
    if (typeof req.body.requireReturnWindowPassed === 'boolean') {
      settings.requireReturnWindowPassed = req.body.requireReturnWindowPassed
    }
    if (typeof req.body.excludeReplacementOrders === 'boolean') {
      settings.excludeReplacementOrders = req.body.excludeReplacementOrders
    }
    if (typeof req.body.excludeCancelledOrders === 'boolean') {
      settings.excludeCancelledOrders = req.body.excludeCancelledOrders
    }
    if (typeof req.body.excludeFullyReturnedOrders === 'boolean') {
      settings.excludeFullyReturnedOrders = req.body.excludeFullyReturnedOrders
    }

    // Update batch generation logic
    // Note: minimumSettlementAmount (minBatchAmount) comes from Global/Seller settings, not here
    if (typeof req.body.allowNegativeSettlements === 'boolean') {
      settings.allowNegativeSettlements = req.body.allowNegativeSettlements
    }
    if (typeof req.body.createCarryForwardOnNegativeClamp === 'boolean') {
      settings.createCarryForwardOnNegativeClamp = req.body.createCarryForwardOnNegativeClamp
    }
    if (typeof req.body.includeUnlinkedLedgerEntries === 'boolean') {
      settings.includeUnlinkedLedgerEntries = req.body.includeUnlinkedLedgerEntries
    }
    if (typeof req.body.includePreviousNegativeBalances === 'boolean') {
      settings.includePreviousNegativeBalances = req.body.includePreviousNegativeBalances
    }

    // Update ledger entry creation logic
    if (typeof req.body.createLedgerEntriesOnEligibility === 'boolean') {
      settings.createLedgerEntriesOnEligibility = req.body.createLedgerEntriesOnEligibility
    }
    if (typeof req.body.createLedgerEntriesOnBatchCreation === 'boolean') {
      settings.createLedgerEntriesOnBatchCreation = req.body.createLedgerEntriesOnBatchCreation
    }
    if (typeof req.body.roundLedgerEntriesBeforeStorage === 'boolean') {
      settings.roundLedgerEntriesBeforeStorage = req.body.roundLedgerEntriesBeforeStorage
    }

    // Update TDS/TCS calculation logic
    if (typeof req.body.calculateTdsAtBatchLevel === 'boolean') {
      settings.calculateTdsAtBatchLevel = req.body.calculateTdsAtBatchLevel
    }
    if (typeof req.body.calculateTcsAtBatchLevel === 'boolean') {
      settings.calculateTcsAtBatchLevel = req.body.calculateTcsAtBatchLevel
    }
    if (typeof req.body.tdsRoundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.tdsRoundingMode,
        )
      ) {
        settings.tdsRoundingMode = req.body.tdsRoundingMode as any
      }
    }
    if (typeof req.body.tcsRoundingMode === 'string') {
      if (
        ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'].includes(
          req.body.tcsRoundingMode,
        )
      ) {
        settings.tcsRoundingMode = req.body.tcsRoundingMode as any
      }
    }

    // Update refund & return handling
    if (typeof req.body.reverseCommissionOnReturn === 'boolean') {
      settings.reverseCommissionOnReturn = req.body.reverseCommissionOnReturn
    }
    if (typeof req.body.reverseShippingOnReturn === 'boolean') {
      settings.reverseShippingOnReturn = req.body.reverseShippingOnReturn
    }
    if (typeof req.body.reverseCourierCostOnReturn === 'boolean') {
      settings.reverseCourierCostOnReturn = req.body.reverseCourierCostOnReturn
    }
    if (typeof req.body.refundCalculationMethod === 'string') {
      if (['FULL', 'PROPORTIONAL'].includes(req.body.refundCalculationMethod)) {
        settings.refundCalculationMethod = req.body.refundCalculationMethod as any
      }
    }

    settings.updatedBy = new mongoose.Types.ObjectId(adminId)
    await settings.save()

    res.json({
      success: true,
      data: settings,
    })
  } catch (error) {
    console.error('Failed to update settlement settings:', error)
    res.status(500).json({ success: false, message: 'Failed to update settlement settings' })
  }
}
