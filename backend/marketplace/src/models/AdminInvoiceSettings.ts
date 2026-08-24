import mongoose, { type Document, type Model, Schema } from 'mongoose'

export type ResetFrequency = 'FINANCIAL_YEAR' | 'CALENDAR_YEAR' | 'NEVER'
export type RoundingMode = 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN'

export interface IAdminInvoiceSettings extends Document {
  invoicePrefix: string
  creditNotePrefix: string
  debitNotePrefix: string
  financialYearFormat: string // e.g., "YY-YY"
  sequenceStart: number
  resetFrequency: ResetFrequency
  currency: string
  roundingMode: RoundingMode // For invoice total rounding (display)
  gstRoundingMode: RoundingMode // For GST amount rounding (calculation)
  dateFormat: string // e.g., "DD MMM YYYY"
  showHsnSummary: boolean
  showGstBreakup: boolean
  allowSellerLogo: boolean
  allowSellerSignature: boolean
  allowSellerFooterNote: boolean
  lockAfterIssue: boolean
  updatedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

interface IAdminInvoiceSettingsModel extends Model<IAdminInvoiceSettings> {
  getSingleton(): Promise<IAdminInvoiceSettings>
}

const AdminInvoiceSettingsSchema = new Schema<IAdminInvoiceSettings>(
  {
    invoicePrefix: {
      type: String,
      required: true,
      default: 'TAT/INV',
      trim: true,
    },
    creditNotePrefix: {
      type: String,
      required: true,
      default: 'TAT/CN',
      trim: true,
    },
    debitNotePrefix: {
      type: String,
      required: true,
      default: 'TAT/DN',
      trim: true,
    },
    financialYearFormat: {
      type: String,
      required: true,
      default: 'YY-YY',
      trim: true,
    },
    sequenceStart: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    resetFrequency: {
      type: String,
      enum: ['FINANCIAL_YEAR', 'CALENDAR_YEAR', 'NEVER'],
      required: true,
      default: 'FINANCIAL_YEAR',
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
      trim: true,
    },
    roundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },
    gstRoundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },
    dateFormat: {
      type: String,
      required: true,
      default: 'DD MMM YYYY',
      trim: true,
    },
    showHsnSummary: {
      type: Boolean,
      required: true,
      default: true,
    },
    showGstBreakup: {
      type: Boolean,
      required: true,
      default: true,
    },
    allowSellerLogo: {
      type: Boolean,
      required: true,
      default: false,
    },
    allowSellerSignature: {
      type: Boolean,
      required: true,
      default: false,
    },
    allowSellerFooterNote: {
      type: Boolean,
      required: true,
      default: false,
    },
    lockAfterIssue: {
      type: Boolean,
      required: true,
      default: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
)

// Ensure singleton - only one document can exist
AdminInvoiceSettingsSchema.index({}, { unique: true })

AdminInvoiceSettingsSchema.statics.getSingleton =
  async function (): Promise<IAdminInvoiceSettings> {
    let settings = await this.findOne()
    if (!settings) {
      settings = await this.create({
        invoicePrefix: 'TAT',
        creditNotePrefix: 'TATCN',
        debitNotePrefix: 'TATDN',
        financialYearFormat: 'YYYY',
        sequenceStart: 1,
        resetFrequency: 'FINANCIAL_YEAR',
        currency: 'INR',
        roundingMode: 'ROUND_HALF_UP',
        gstRoundingMode: 'ROUND_HALF_UP',
        dateFormat: 'DD MMM YYYY',
        showHsnSummary: true,
        showGstBreakup: true,
        allowSellerLogo: false,
        allowSellerSignature: false,
        allowSellerFooterNote: false,
        lockAfterIssue: true,
      })
    }
    return settings
  }

const AdminInvoiceSettings =
  (mongoose.models.AdminInvoiceSettings as IAdminInvoiceSettingsModel) ||
  mongoose.model<IAdminInvoiceSettings, IAdminInvoiceSettingsModel>(
    'AdminInvoiceSettings',
    AdminInvoiceSettingsSchema,
  )

export default AdminInvoiceSettings
