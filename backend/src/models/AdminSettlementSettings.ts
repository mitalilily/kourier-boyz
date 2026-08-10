import mongoose, { type Document, type Model, Schema } from 'mongoose'

export type CommissionCalculationMethod = 'PERCENTAGE' | 'FIXED'
export type SettlementRoundingMode = 'ROUND_HALF_UP' | 'ROUND_HALF_DOWN' | 'ROUND_UP' | 'ROUND_DOWN'

export interface IAdminSettlementSettings extends Document {
  // Commission Calculation
  commissionRoundingMode: SettlementRoundingMode // For commission calculations
  includeShippingInSaleAmount: boolean // Whether shipping is included in sale amount for commission calculation

  // Fee Calculation
  includeShippingInNetAmount: boolean // Whether shipping earnings are added to net settlement amount
  courierFeeCalculationMethod: 'AWB_WISE' | 'ORDER_WISE'
  codFeeCalculationMethod: 'AWB_WISE' | 'ORDER_WISE'
  pgFeeCalculationMethod: 'PERCENTAGE' | 'FIXED' | 'FROM_PAYMENT_META'
  pgFeePercentage?: number
  pgFeeFixedAmount?: number

  // Rounding Settings
  settlementAmountRoundingMode: SettlementRoundingMode // For final settlement amounts
  feeRoundingMode: SettlementRoundingMode // For fees (courier, COD, PG)
  ledgerEntryRoundingMode: SettlementRoundingMode // For individual ledger entry amounts

  // Ledger Calculation Settings
  roundLedgerEntriesIndividually: boolean // Whether to round each ledger entry amount separately
  roundLedgerAggregation: boolean // Whether to round aggregated ledger totals
  ledgerAggregationRoundingMode: SettlementRoundingMode // Rounding mode for ledger aggregation totals

  // Calculation Method
  netAmountCalculationMethod: 'CREDITS_MINUS_DEBITS' | 'SALE_MINUS_ALL' // How net amount is derived

  // Settlement Eligibility Logic
  requireOrderDelivered: boolean
  requireReturnWindowPassed: boolean
  excludeReplacementOrders: boolean
  excludeCancelledOrders: boolean
  excludeFullyReturnedOrders: boolean

  // Settlement Batch Generation
  allowNegativeSettlements: boolean // Whether to allow negative settlement amounts
  createCarryForwardOnNegativeClamp: boolean // If allowNegativeSettlements is false, create carry-forward entry for negative balance before clamping to 0
  includeUnlinkedLedgerEntries: boolean
  includePreviousNegativeBalances: boolean

  // Ledger Entry Creation
  createLedgerEntriesOnEligibility: boolean
  createLedgerEntriesOnBatchCreation: boolean
  roundLedgerEntriesBeforeStorage: boolean

  // TDS/TCS Calculation
  calculateTdsAtBatchLevel: boolean
  calculateTcsAtBatchLevel: boolean
  tdsRoundingMode: SettlementRoundingMode
  tcsRoundingMode: SettlementRoundingMode

  // Refund & Return Handling
  reverseCommissionOnReturn: boolean
  reverseShippingOnReturn: boolean
  reverseCourierCostOnReturn: boolean
  refundCalculationMethod: 'FULL' | 'PROPORTIONAL'

  updatedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

interface IAdminSettlementSettingsModel extends Model<IAdminSettlementSettings> {
  getSingleton(): Promise<IAdminSettlementSettings>
}

const AdminSettlementSettingsSchema = new Schema<IAdminSettlementSettings>(
  {
    // ============================================================================
    // COMMISSION CALCULATION LOGIC
    // Note: commissionType and commissionValue come from Global/Seller settings
    // ============================================================================
    commissionRoundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },
    includeShippingInSaleAmount: {
      type: Boolean,
      required: true,
      default: false, // Commission calculated only on product sale amount, not shipping
    },

    // ============================================================================
    // FEE CALCULATION LOGIC
    // ============================================================================
    includeShippingInNetAmount: {
      type: Boolean,
      required: true,
      default: true, // Shipping earnings added to seller net amount
    },
    courierFeeCalculationMethod: {
      type: String,
      enum: ['AWB_WISE', 'ORDER_WISE'],
      required: true,
      default: 'AWB_WISE', // Sum of courierCharge from all sellerShipments
    },
    codFeeCalculationMethod: {
      type: String,
      enum: ['AWB_WISE', 'ORDER_WISE'],
      required: true,
      default: 'AWB_WISE', // Sum of codCharge from all sellerShipments
    },
    pgFeeCalculationMethod: {
      type: String,
      enum: ['PERCENTAGE', 'FIXED', 'FROM_PAYMENT_META'],
      required: true,
      default: 'FROM_PAYMENT_META', // Use paymentMeta.pgFee from order
    },
    pgFeePercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    pgFeeFixedAmount: {
      type: Number,
      min: 0,
    },

    // ============================================================================
    // ROUNDING SETTINGS
    // ============================================================================
    settlementAmountRoundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },
    feeRoundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },
    ledgerEntryRoundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },
    roundLedgerEntriesIndividually: {
      type: Boolean,
      required: true,
      default: true, // Round each ledger entry amount when created
    },
    roundLedgerAggregation: {
      type: Boolean,
      required: true,
      default: true, // Round aggregated totals from ledger entries
    },
    ledgerAggregationRoundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },

    // ============================================================================
    // CALCULATION METHOD
    // ============================================================================
    netAmountCalculationMethod: {
      type: String,
      enum: ['CREDITS_MINUS_DEBITS', 'SALE_MINUS_ALL'],
      required: true,
      default: 'CREDITS_MINUS_DEBITS', // Sum credits, sum debits, then subtract
    },

    // ============================================================================
    // SETTLEMENT ELIGIBILITY LOGIC
    // ============================================================================
    requireOrderDelivered: {
      type: Boolean,
      required: true,
      default: true, // Order must be in 'delivered' status
    },
    requireReturnWindowPassed: {
      type: Boolean,
      required: true,
      default: true, // Return window must have passed
    },
    excludeReplacementOrders: {
      type: Boolean,
      required: true,
      default: true, // Replacement orders are never eligible
    },
    excludeCancelledOrders: {
      type: Boolean,
      required: true,
      default: true, // Cancelled orders are never eligible
    },
    excludeFullyReturnedOrders: {
      type: Boolean,
      required: true,
      default: true, // Fully returned orders are never eligible
    },

    // ============================================================================
    // SETTLEMENT BATCH GENERATION LOGIC
    // Note: minimumSettlementAmount (minBatchAmount) comes from Global/Seller settings
    // ============================================================================
    allowNegativeSettlements: {
      type: Boolean,
      required: true,
      default: false, // Do not allow negative settlements (clamp to 0)
    },
    createCarryForwardOnNegativeClamp: {
      type: Boolean,
      required: true,
      default: true, // When clamping negative settlements to 0, create carry-forward entry to track the debt
    },
    includeUnlinkedLedgerEntries: {
      type: Boolean,
      required: true,
      default: true, // Include unlinked entries (refunds, adjustments) in batches
    },
    includePreviousNegativeBalances: {
      type: Boolean,
      required: true,
      default: true, // Include negative balances from previous batches
    },

    // ============================================================================
    // LEDGER ENTRY CREATION LOGIC
    // ============================================================================
    createLedgerEntriesOnEligibility: {
      type: Boolean,
      required: true,
      default: true, // Create entries when order becomes eligible
    },
    createLedgerEntriesOnBatchCreation: {
      type: Boolean,
      required: true,
      default: false, // Create entries when batch is created (alternative to onEligibility)
    },
    roundLedgerEntriesBeforeStorage: {
      type: Boolean,
      required: true,
      default: true, // Round amounts before storing in ledger
    },

    // ============================================================================
    // TDS/TCS CALCULATION LOGIC
    // ============================================================================
    calculateTdsAtBatchLevel: {
      type: Boolean,
      required: true,
      default: true, // TDS calculated only at batch level (not at order level)
    },
    calculateTcsAtBatchLevel: {
      type: Boolean,
      required: true,
      default: true, // TCS calculated only at batch level (not at order level)
    },
    tdsRoundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },
    tcsRoundingMode: {
      type: String,
      enum: ['ROUND_HALF_UP', 'ROUND_HALF_DOWN', 'ROUND_UP', 'ROUND_DOWN'],
      required: true,
      default: 'ROUND_HALF_UP',
    },

    // ============================================================================
    // REFUND & RETURN HANDLING LOGIC
    // ============================================================================
    reverseCommissionOnReturn: {
      type: Boolean,
      required: true,
      default: true, // Reverse commission when order is returned
    },
    reverseShippingOnReturn: {
      type: Boolean,
      required: true,
      default: true, // Reverse shipping earnings on return
    },
    reverseCourierCostOnReturn: {
      type: Boolean,
      required: true,
      default: false, // Do not reverse courier cost on return (seller already paid)
    },
    refundCalculationMethod: {
      type: String,
      enum: ['FULL', 'PROPORTIONAL'],
      required: true,
      default: 'PROPORTIONAL', // Refund proportional to returned quantity
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
)

// Ensure singleton - only one document can exist
AdminSettlementSettingsSchema.index({}, { unique: true })

AdminSettlementSettingsSchema.statics.getSingleton =
  async function (): Promise<IAdminSettlementSettings> {
    let settings = await this.findOne()
    if (!settings) {
      settings = await this.create({
        // ============================================================================
        // COMMISSION CALCULATION (Based on current calculateSettlementForOrder logic)
        // Note: commissionType and commissionValue come from Global/Seller settings
        // ============================================================================
        commissionRoundingMode: 'ROUND_HALF_UP', // Currently no rounding, but default to standard
        includeShippingInSaleAmount: false, // CURRENT: saleAmount = order.subtotal (shipping excluded)

        // ============================================================================
        // FEE CALCULATION (Based on current calculateSettlementForOrder logic)
        // ============================================================================
        includeShippingInNetAmount: true, // CURRENT: netAmount = saleAmount + shippingEarning - fees
        courierFeeCalculationMethod: 'AWB_WISE', // CURRENT: Sum of courierCharge from all sellerShipments
        codFeeCalculationMethod: 'AWB_WISE', // CURRENT: Sum of codCharge from all sellerShipments
        pgFeeCalculationMethod: 'FROM_PAYMENT_META', // CURRENT: from paymentMeta.pgFee

        // ============================================================================
        // ROUNDING SETTINGS (Currently no rounding is applied, but defaults set for future)
        // ============================================================================
        settlementAmountRoundingMode: 'ROUND_HALF_UP', // CURRENT: Math.max(0, netAmount) - no rounding
        feeRoundingMode: 'ROUND_HALF_UP', // CURRENT: No rounding applied to fees
        ledgerEntryRoundingMode: 'ROUND_HALF_UP', // CURRENT: No rounding applied to ledger entries
        roundLedgerEntriesIndividually: false, // CURRENT: No rounding applied
        roundLedgerAggregation: false, // CURRENT: No rounding applied to aggregations
        ledgerAggregationRoundingMode: 'ROUND_HALF_UP',

        // ============================================================================
        // CALCULATION METHOD (Based on current calculateSettlementForOrder logic)
        // ============================================================================
        netAmountCalculationMethod: 'CREDITS_MINUS_DEBITS', // CURRENT: saleAmount + shipping - commission - fees
        // Note: Current method is actually: saleAmount + shippingEarning - commissionAmount - courierForwardFee - codFee - pgFee
        // This is effectively CREDITS_MINUS_DEBITS where credits = saleAmount + shipping, debits = commission + fees

        // ============================================================================
        // SETTLEMENT ELIGIBILITY (Based on current evaluateOrderSettlementEligibility logic)
        // ============================================================================
        requireOrderDelivered: true, // CURRENT: isOrderDeliveredForSettlement checks order.status === 'delivered'
        requireReturnWindowPassed: true, // CURRENT: Checks if now >= eligibleFrom (deliveredAt + returnWindowDays from Global/Seller settings)
        excludeReplacementOrders: true, // CURRENT: Hard-coded check for (order as any).isReplacement
        excludeCancelledOrders: true, // CURRENT: Implicitly excluded (not 'delivered' status)
        excludeFullyReturnedOrders: true, // CURRENT: Implicitly excluded (not 'delivered' status or handled separately)

        // ============================================================================
        // SETTLEMENT BATCH GENERATION (Based on current generateSettlementBatchForSeller logic)
        // Note: minimumSettlementAmount (minBatchAmount) comes from Global/Seller settings
        // ============================================================================
        allowNegativeSettlements: false, // CURRENT: Math.max(0, netAmount) clamps to 0
        includeUnlinkedLedgerEntries: true, // CURRENT: Includes { order: null, settlementBatch: null } entries
        includePreviousNegativeBalances: true, // CURRENT: Includes SETTLEMENT_CARRY_FORWARD entries

        // ============================================================================
        // LEDGER ENTRY CREATION (Based on current evaluateOrderSettlementEligibility logic)
        // ============================================================================
        createLedgerEntriesOnEligibility: true, // CURRENT: Created when order becomes ELIGIBLE (line 257-322)
        createLedgerEntriesOnBatchCreation: false, // CURRENT: Not created on batch creation
        roundLedgerEntriesBeforeStorage: false, // CURRENT: No rounding applied before storage

        // ============================================================================
        // TDS/TCS CALCULATION (Based on current generateSettlementBatchForSeller logic)
        // ============================================================================
        calculateTdsAtBatchLevel: true, // CURRENT: calculateTds called at batch level (line 715)
        calculateTcsAtBatchLevel: true, // CURRENT: calculateTcs called at batch level (line 720)
        tdsRoundingMode: 'ROUND_HALF_UP', // Currently no explicit rounding, but default to standard
        tcsRoundingMode: 'ROUND_HALF_UP', // Currently no explicit rounding, but default to standard

        // ============================================================================
        // REFUND & RETURN HANDLING (Based on common return/refund patterns)
        // ============================================================================
        reverseCommissionOnReturn: true, // CURRENT: COMMISSION_REVERSAL entries are created on returns
        reverseShippingOnReturn: true, // CURRENT: RETURN_SHIPPING_REVERSAL entries are created
        reverseCourierCostOnReturn: false, // CURRENT: RETURN_REVERSE_COURIER_COST may be created, but typically not reversed
        refundCalculationMethod: 'PROPORTIONAL', // CURRENT: Refunds are proportional to returned quantity
      })
    }
    return settings
  }

const AdminSettlementSettings =
  (mongoose.models.AdminSettlementSettings as IAdminSettlementSettingsModel) ||
  mongoose.model<IAdminSettlementSettings, IAdminSettlementSettingsModel>(
    'AdminSettlementSettings',
    AdminSettlementSettingsSchema,
  )

export default AdminSettlementSettings
