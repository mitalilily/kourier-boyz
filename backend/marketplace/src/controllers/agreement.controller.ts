import { Request, Response } from 'express'
import mongoose from 'mongoose'
import Agreement from '../models/Agreement'
import { generatePDFFromHTML } from '../utils/pdfGenerator'

// Get all agreements
export const getAgreements = async (req: Request, res: Response) => {
  try {
    const agreements = await Agreement.find()
      .sort({ type: 1, version: -1 })
      .populate('createdBy updatedBy', 'name email')
    res.json(agreements)
  } catch (err: unknown) {
    console.error('Error fetching agreements:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Get active agreement by type
export const getActiveAgreementByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params
    
    // Validate agreement type exists in enum
    const validTypes = [
      'marketplace-terms',
      'seller-agreement',
      'return-refund-policy',
      'customer-return-refund-policy',
      'prohibited-items',
      'privacy-policy',
      'seller-privacy-policy',
      'customer-terms',
    ]
    
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid agreement type: ${type}` })
    }
    
    const agreement = await Agreement.findOne({ type, isActive: true })
      .sort({ version: -1 })
      .populate('createdBy updatedBy', 'name email')

    if (!agreement) {
      return res.status(404).json({ 
        error: 'Agreement not found',
        message: `No active agreement of type "${type}" exists. Please contact an administrator to create this agreement.`
      })
    }
    res.json(agreement)
  } catch (err: unknown) {
    console.error('Error fetching agreement:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Create or update agreement
export const upsertAgreement = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { type, title, content, effectiveDate, pdfUrl } = req.body

    if (!type || !title || !content) {
      return res.status(400).json({ error: 'Type, title, and content are required' })
    }

    // Convert userId string to ObjectId
    const userIdObjectId = new mongoose.Types.ObjectId(userId)

    // Find existing agreement of this type
    const existing = await Agreement.findOne({ type }).sort({ version: -1 })

    let agreement
    if (existing && existing.isActive) {
      // Deactivate old version
      existing.isActive = false
      await existing.save()

      // Create new version
      agreement = new Agreement({
        type,
        title,
        content,
        version: existing.version + 1,
        isActive: true,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        pdfUrl,
        createdBy: userIdObjectId,
        updatedBy: userIdObjectId,
      })
    } else if (existing) {
      // Update existing inactive version
      existing.title = title
      existing.content = content
      existing.isActive = true
      existing.version = existing.version + 1
      existing.effectiveDate = effectiveDate ? new Date(effectiveDate) : new Date()
      existing.pdfUrl = pdfUrl
      existing.updatedBy = userIdObjectId
      agreement = existing
    } else {
      // Create new
      agreement = new Agreement({
        type,
        title,
        content,
        version: 1,
        isActive: true,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
        pdfUrl,
        createdBy: userIdObjectId,
        updatedBy: userIdObjectId,
      })
    }

    await agreement.save()

    // Note: PDFs are generated when sellers accept agreements, not when admin saves them

    await agreement.populate('createdBy updatedBy', 'name email')

    res.json({ message: 'Agreement saved successfully', agreement })
  } catch (err: unknown) {
    console.error('Error saving agreement:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

// Generate PDF for a specific agreement (can be called manually)
export const generateAgreementPDF = async (req: Request, res: Response) => {
  try {
    const { type } = req.params
    const agreement = await Agreement.findOne({ type, isActive: true }).sort({ version: -1 })

    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' })
    }

    // Generate PDF
    const pdfUrl = await generatePDFFromHTML(
      agreement.content,
      agreement.title,
      agreement.type,
      agreement.version,
    )

    // Update agreement with PDF URL
    agreement.pdfUrl = pdfUrl
    await agreement.save()

    await agreement.populate('createdBy updatedBy', 'name email')

    res.json({
      message: 'PDF generated successfully',
      agreement,
      pdfUrl,
    })
  } catch (err: unknown) {
    console.error('Error generating PDF:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
