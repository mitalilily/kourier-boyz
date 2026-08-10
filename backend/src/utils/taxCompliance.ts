import mongoose from 'mongoose'
import Order from '../models/Order'
import SellerSettlementBatch from '../models/SellerSettlementBatch'
import User from '../models/User'

/**
 * Get financial year start date (April 1st) for a given date
 */
export const getFinancialYearStart = (date: Date): Date => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12

  // Financial year starts on April 1st
  if (month >= 4) {
    // April to December: FY starts in current year
    return new Date(year, 3, 1) // Month is 0-indexed, so 3 = April
  } else {
    // January to March: FY starts in previous year
    return new Date(year - 1, 3, 1)
  }
}

/**
 * Get financial year end date (March 31st) for a given date
 */
export const getFinancialYearEnd = (date: Date): Date => {
  const fyStart = getFinancialYearStart(date)
  return new Date(fyStart.getFullYear() + 1, 2, 31) // March 31st of next year
}

/**
 * Calculate cumulative sales for a seller in a financial year
 */
export const getCumulativeSalesInFinancialYear = async (
  sellerId: mongoose.Types.ObjectId,
  date: Date,
): Promise<number> => {
  const fyStart = getFinancialYearStart(date)
  const fyEnd = getFinancialYearEnd(date)

  // Get all PAID settlement batches in this financial year
  const batches = await SellerSettlementBatch.find({
    seller: sellerId,
    status: 'PAID',
    payoutDate: {
      $gte: fyStart,
      $lte: fyEnd,
    },
  }).lean()

  // Sum up total sale amounts (including GST) from all batches
  const cumulativeSales = batches.reduce((sum, batch) => {
    // Use tdsBaseAmount if available (gross sales including GST), otherwise use totalSaleAmount
    const grossSales = batch.tdsBaseAmount || batch.totalSaleAmount || 0
    return sum + grossSales
  }, 0)

  return cumulativeSales
}

/**
 * Check if seller is exempt from TDS based on PAN 4th character
 * P = Individual, H = HUF
 */
export const isTdsExemptedByPan = (panNumber?: string): boolean => {
  if (!panNumber || panNumber.length < 4) {
    return false
  }

  const fourthChar = panNumber.charAt(3).toUpperCase()
  return fourthChar === 'P' || fourthChar === 'H'
}

/**
 * Validate seller has PAN for TDS calculation
 * TDS cannot be calculated without PAN
 */
export const validateSellerPanForTds = async (
  sellerId: mongoose.Types.ObjectId,
): Promise<{ valid: boolean; error?: string }> => {
  const seller = await User.findById(sellerId).select('panNumber').lean()
  if (!seller?.panNumber || seller.panNumber.trim().length === 0) {
    return {
      valid: false,
      error: 'Seller PAN number is required for TDS calculation. Please update seller KYC details.',
    }
  }
  return { valid: true }
}

/**
 * Validate seller has GSTIN for TCS calculation
 * TCS cannot be calculated without GSTIN
 */
export const validateSellerGstinForTcs = async (
  sellerId: mongoose.Types.ObjectId,
): Promise<{ valid: boolean; error?: string }> => {
  const seller = await User.findById(sellerId).select('gstNumber state').lean()
  if (!seller?.gstNumber || seller.gstNumber.trim().length === 0) {
    return {
      valid: false,
      error: 'Seller GSTIN is required for TCS calculation. Please update seller KYC details.',
    }
  }
  if (!seller?.state || seller.state.trim().length === 0) {
    return {
      valid: false,
      error: 'Seller state is required for TCS calculation. Please update seller KYC details.',
    }
  }
  return { valid: true }
}

/**
 * Calculate TDS (194O) for a settlement batch
 * Rate: 0.1% on gross sales including GST
 * Exemption: If PAN 4th char is P or H, no TDS until ₹5,00,000 cumulative sales in FY
 *
 * CRITICAL: This function should ONLY be called at settlement batch finalization.
 * TDS must NOT be calculated at order, shipment, or delivery level.
 */
export interface TdsCalculationResult {
  tdsAmount: number
  tdsRate: number
  tdsBaseAmount: number
  exempted: boolean
  exemptionReason?: string
  cumulativeSalesInFy: number
}

export const calculateTds = async (
  sellerId: mongoose.Types.ObjectId,
  grossSalesIncludingGst: number,
  settlementDate: Date,
): Promise<TdsCalculationResult> => {
  const TDS_RATE = 0.1 // 0.1%
  const TDS_EXEMPTION_THRESHOLD = 500000 // ₹5,00,000

  // Get seller PAN
  const seller = await User.findById(sellerId).select('panNumber').lean()
  const panNumber = seller?.panNumber

  if (!panNumber) {
    // No PAN: Apply TDS from first settlement
    const tdsAmount = (grossSalesIncludingGst * TDS_RATE) / 100
    return {
      tdsAmount,
      tdsRate: TDS_RATE,
      tdsBaseAmount: grossSalesIncludingGst,
      exempted: false,
      cumulativeSalesInFy: 0,
    }
  }

  const isExemptedByPan = isTdsExemptedByPan(panNumber)

  if (!isExemptedByPan) {
    // Not exempted by PAN: Apply TDS from first settlement
    const tdsAmount = (grossSalesIncludingGst * TDS_RATE) / 100
    return {
      tdsAmount,
      tdsRate: TDS_RATE,
      tdsBaseAmount: grossSalesIncludingGst,
      exempted: false,
      cumulativeSalesInFy: 0,
    }
  }

  // PAN 4th char is P or H: Check cumulative sales threshold
  const cumulativeSalesInFy = await getCumulativeSalesInFinancialYear(sellerId, settlementDate)
  const totalSalesAfterThisSettlement = cumulativeSalesInFy + grossSalesIncludingGst

  if (totalSalesAfterThisSettlement <= TDS_EXEMPTION_THRESHOLD) {
    // Below threshold: No TDS
    return {
      tdsAmount: 0,
      tdsRate: TDS_RATE,
      tdsBaseAmount: grossSalesIncludingGst,
      exempted: true,
      exemptionReason: `PAN 4th character is ${panNumber
        .charAt(3)
        .toUpperCase()} (Individual/HUF). Cumulative sales in FY: ₹${cumulativeSalesInFy.toFixed(
        2,
      )}. Threshold: ₹${TDS_EXEMPTION_THRESHOLD.toFixed(2)}`,
      cumulativeSalesInFy,
    }
  }

  // Above threshold: Calculate TDS
  // If previous sales were below threshold, only apply TDS on amount above threshold
  let taxableAmount = grossSalesIncludingGst
  if (cumulativeSalesInFy < TDS_EXEMPTION_THRESHOLD) {
    // Part of this settlement is below threshold
    const amountBelowThreshold = TDS_EXEMPTION_THRESHOLD - cumulativeSalesInFy
    taxableAmount = grossSalesIncludingGst - amountBelowThreshold
  }

  const tdsAmount = (taxableAmount * TDS_RATE) / 100

  return {
    tdsAmount,
    tdsRate: TDS_RATE,
    tdsBaseAmount: grossSalesIncludingGst,
    exempted: false,
    cumulativeSalesInFy,
  }
}

/**
 * Determine if supply is inter-state or intra-state
 * Inter-state: Seller state ≠ Customer state
 * Intra-state: Seller state = Customer state
 */
export const isInterStateSupply = (sellerState: string, customerState: string): boolean => {
  return sellerState?.toLowerCase().trim() !== customerState?.toLowerCase().trim()
}

/**
 * Calculate TCS (GST) for a settlement batch
 * Rate: Inter-state → IGST 1%, Intra-state → CGST 0.5% + SGST 0.5%
 * Base: Taxable value (excluding GST) - DO NOT include GST amount
 * Applies to ALL sales (registered and unregistered customers)
 *
 * CRITICAL RULES:
 * 1. TCS applies to ALL sales regardless of customer GST registration status
 * 2. Customer GSTN is used ONLY for report segregation, NOT for eligibility
 * 3. Calculate TCS on taxable value (subtotal) ONLY - exclude GST amount
 * 4. This function should ONLY be called at settlement batch finalization
 *
 * CRITICAL: This function should ONLY be called at settlement batch finalization.
 * TCS must NOT be calculated at order, shipment, or delivery level.
 */
export interface TcsCalculationResult {
  totalTcsAmount: number
  tcsIgstAmount: number
  tcsCgstAmount: number
  tcsSgstAmount: number
  tcsBaseAmount: number
  breakdown: {
    interState: {
      salesAmount: number
      tcsAmount: number
    }
    intraState: {
      salesAmount: number
      tcsCgstAmount: number
      tcsSgstAmount: number
      tcsAmount: number
    }
    registeredCustomers: {
      salesAmount: number
      tcsAmount: number
    }
    unregisteredCustomers: {
      salesAmount: number
      tcsAmount: number
    }
  }
}

export const calculateTcs = async (
  sellerId: mongoose.Types.ObjectId,
  orderIds: mongoose.Types.ObjectId[],
): Promise<TcsCalculationResult> => {
  const TCS_RATE_INTER_STATE = 1.0 // IGST 1%
  const TCS_RATE_INTRA_STATE = 0.5 // CGST 0.5% + SGST 0.5% = 1% total

  // Get seller state
  const seller = await User.findById(sellerId).select('state gstNumber').lean()
  const sellerState = seller?.state || ''

  // Get orders with customer and item details
  const orders = await Order.find({
    _id: { $in: orderIds },
  })
    .populate('user', 'gstNumber state')
    .select('items shippingAddress subtotal tax total')
    .lean()

  let totalTcsBaseAmount = 0
  let interStateSalesAmount = 0
  let intraStateSalesAmount = 0
  let registeredCustomerSalesAmount = 0
  let unregisteredCustomerSalesAmount = 0
  let interStateTcsAmount = 0
  let intraStateCgstAmount = 0
  let intraStateSgstAmount = 0
  let registeredCustomerTcsAmount = 0
  let unregisteredCustomerTcsAmount = 0

  for (const order of orders) {
    const customer = order.user as any
    const customerState = order.shippingAddress?.state || customer?.state || ''
    // CRITICAL: Customer GSTN is used ONLY for report segregation, NOT for TCS eligibility
    // TCS applies to ALL sales regardless of customer registration status
    const isCustomerRegistered = !!(customer?.gstNumber && customer.gstNumber.trim())

    // CRITICAL: Calculate TCS on taxable value ONLY (excluding GST)
    // Taxable value = subtotal (price without tax, before GST)
    // DO NOT include order.tax or any GST amount in the base
    const orderTaxableValue = order.subtotal || 0

    totalTcsBaseAmount += orderTaxableValue

    const isInterState = isInterStateSupply(sellerState, customerState)

    if (isInterState) {
      // Inter-state supply: IGST 1%
      interStateSalesAmount += orderTaxableValue
      const tcsAmount = (orderTaxableValue * TCS_RATE_INTER_STATE) / 100
      interStateTcsAmount += tcsAmount
    } else {
      // Intra-state supply: CGST 0.5% + SGST 0.5%
      intraStateSalesAmount += orderTaxableValue
      const cgstAmount = (orderTaxableValue * TCS_RATE_INTRA_STATE) / 100
      const sgstAmount = (orderTaxableValue * TCS_RATE_INTRA_STATE) / 100
      intraStateCgstAmount += cgstAmount
      intraStateSgstAmount += sgstAmount
    }

    if (isCustomerRegistered) {
      registeredCustomerSalesAmount += orderTaxableValue
      // Calculate TCS for registered customers based on supply type
      if (isInterState) {
        registeredCustomerTcsAmount += (orderTaxableValue * TCS_RATE_INTER_STATE) / 100
      } else {
        registeredCustomerTcsAmount += (orderTaxableValue * TCS_RATE_INTRA_STATE * 2) / 100 // CGST + SGST
      }
    } else {
      unregisteredCustomerSalesAmount += orderTaxableValue
      // Calculate TCS for unregistered customers based on supply type
      if (isInterState) {
        unregisteredCustomerTcsAmount += (orderTaxableValue * TCS_RATE_INTER_STATE) / 100
      } else {
        unregisteredCustomerTcsAmount += (orderTaxableValue * TCS_RATE_INTRA_STATE * 2) / 100 // CGST + SGST
      }
    }
  }

  const totalTcsAmount = interStateTcsAmount + intraStateCgstAmount + intraStateSgstAmount
  const intraStateTcsAmount = intraStateCgstAmount + intraStateSgstAmount

  return {
    totalTcsAmount,
    tcsIgstAmount: interStateTcsAmount,
    tcsCgstAmount: intraStateCgstAmount,
    tcsSgstAmount: intraStateSgstAmount,
    tcsBaseAmount: totalTcsBaseAmount,
    breakdown: {
      interState: {
        salesAmount: interStateSalesAmount,
        tcsAmount: interStateTcsAmount,
      },
      intraState: {
        salesAmount: intraStateSalesAmount,
        tcsCgstAmount: intraStateCgstAmount,
        tcsSgstAmount: intraStateSgstAmount,
        tcsAmount: intraStateTcsAmount,
      },
      registeredCustomers: {
        salesAmount: registeredCustomerSalesAmount,
        tcsAmount: registeredCustomerTcsAmount,
      },
      unregisteredCustomers: {
        salesAmount: unregisteredCustomerSalesAmount,
        tcsAmount: unregisteredCustomerTcsAmount,
      },
    },
  }
}
