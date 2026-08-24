/**
 * Seed Script: Populate AdminSettlementSettings with Current Calculation Logic
 * 
 * This script seeds the AdminSettlementSettings collection with values that match
 * the current settlement calculation logic used in settlement.service.ts
 * 
 * Run this script after deploying AdminSettlementSettings model to ensure
 * existing behavior is preserved.
 * 
 * Usage: 
 *   - Import and run in migration script
 *   - Or run manually: node -e "require('./scripts/seedSettlementCalculationSettings.ts')"
 */

import '../database/postgresMongoose'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import AdminSettlementSettings from '../models/AdminSettlementSettings'

dotenv.config()

export const seedSettlementCalculationSettings = async () => {
  try {
    console.log('Seeding AdminSettlementSettings with current calculation logic...')

    const existing = await AdminSettlementSettings.findOne()
    if (existing) {
      console.log('AdminSettlementSettings already exists. Skipping seed.')
      console.log('To update existing settings, use the admin UI or update manually.')
      return existing
    }

    const settings = await AdminSettlementSettings.create({
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
      createCarryForwardOnNegativeClamp: true, // When clamping negative settlements to 0, create carry-forward entry to track the debt
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

    console.log('✅ AdminSettlementSettings seeded successfully!')
    console.log('Settings ID:', settings._id)
    return settings
  } catch (error) {
    console.error('❌ Error seeding AdminSettlementSettings:', error)
    throw error
  }
}

// If run directly (not imported), execute the seed function
if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')
  void mongoose
    .connect(databaseUrl)
    .then(seedSettlementCalculationSettings)
    .then(() => mongoose.disconnect())
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}

