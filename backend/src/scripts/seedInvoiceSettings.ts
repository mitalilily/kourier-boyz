import dotenv from 'dotenv'
import mongoose from 'mongoose'
import AdminInvoiceSettings from '../models/AdminInvoiceSettings'

dotenv.config()

const seedInvoiceSettings = async () => {
  try {
    // Connect to MongoDB
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI not defined in .env')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // Check if settings already exist
    const existingSettings = await AdminInvoiceSettings.findOne()
    if (existingSettings) {
      console.log('ℹ️  Invoice settings already exist')
      console.log('Current settings:')
      console.log({
        invoicePrefix: existingSettings.invoicePrefix,
        creditNotePrefix: existingSettings.creditNotePrefix,
        debitNotePrefix: existingSettings.debitNotePrefix,
        financialYearFormat: existingSettings.financialYearFormat,
        sequenceStart: existingSettings.sequenceStart,
        resetFrequency: existingSettings.resetFrequency,
        currency: existingSettings.currency,
        roundingMode: existingSettings.roundingMode,
        dateFormat: existingSettings.dateFormat,
        showHsnSummary: existingSettings.showHsnSummary,
        showGstBreakup: existingSettings.showGstBreakup,
        allowSellerLogo: existingSettings.allowSellerLogo,
        allowSellerSignature: existingSettings.allowSellerSignature,
        allowSellerFooterNote: existingSettings.allowSellerFooterNote,
        lockAfterIssue: existingSettings.lockAfterIssue,
      })
      process.exit(0)
    }

    // Create default invoice settings
    const defaultSettings = await AdminInvoiceSettings.create({
      invoicePrefix: 'TAT/INV',
      creditNotePrefix: 'TAT/CN',
      debitNotePrefix: 'TAT/DN',
      financialYearFormat: 'YY-YY',
      sequenceStart: 1,
      resetFrequency: 'FINANCIAL_YEAR',
      currency: 'INR',
      roundingMode: 'ROUND_HALF_UP',
      dateFormat: 'DD MMM YYYY',
      showHsnSummary: true,
      showGstBreakup: true,
      allowSellerLogo: false,
      allowSellerSignature: false,
      allowSellerFooterNote: false,
      lockAfterIssue: true,
    })

    console.log('✅ Default invoice settings created successfully!')
    console.log('Settings:')
    console.log({
      invoicePrefix: defaultSettings.invoicePrefix,
      creditNotePrefix: defaultSettings.creditNotePrefix,
      debitNotePrefix: defaultSettings.debitNotePrefix,
      financialYearFormat: defaultSettings.financialYearFormat,
      sequenceStart: defaultSettings.sequenceStart,
      resetFrequency: defaultSettings.resetFrequency,
      currency: defaultSettings.currency,
      roundingMode: defaultSettings.roundingMode,
      dateFormat: defaultSettings.dateFormat,
      showHsnSummary: defaultSettings.showHsnSummary,
      showGstBreakup: defaultSettings.showGstBreakup,
      allowSellerLogo: defaultSettings.allowSellerLogo,
      allowSellerSignature: defaultSettings.allowSellerSignature,
      allowSellerFooterNote: defaultSettings.allowSellerFooterNote,
      lockAfterIssue: defaultSettings.lockAfterIssue,
    })
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding invoice settings:', error)
    process.exit(1)
  }
}

seedInvoiceSettings()

