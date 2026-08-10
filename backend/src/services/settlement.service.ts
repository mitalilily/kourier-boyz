import mongoose from 'mongoose'
import AdminSettlementSettings from '../models/AdminSettlementSettings'
import GlobalSettlementSettings from '../models/GlobalSettlementSettings'
import Order, { IOrder, SettlementStatus } from '../models/Order'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import SellerSettlementBatch, { ISellerSettlementBatch } from '../models/SellerSettlementBatch'
import SellerSettlementSettings, {
  ISellerSettlementSettings,
} from '../models/SellerSettlementSettings'
import { roundAmount, type RoundingMode } from '../utils/roundingHelpers'
import {
  notifySellerNegativeBalance,
  notifySellerSettlementGenerated,
  notifySellerSettlementSkipped,
} from '../utils/sellerNotifications'
import {
  calculateTcs,
  calculateTds,
  validateSellerGstinForTcs,
  validateSellerPanForTds,
} from '../utils/taxCompliance'

export interface SettlementCalculationResult {
  saleAmount: number
  commissionAmount: number
  netAmount: number
  shippingEarning: number
  courierForwardFee: number
  codFee: number
  pgFee: number
}

export interface SettlementConfig {
  settlementCycle: string
  customCycleDays?: number | null
  returnWindowDays: number
  commissionType: string
  commissionValue: number
  minBatchAmount?: number | null
}

const toNumber = (value: any, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const calculateSettlementForOrder = async (
  order: IOrder,
  settings: SettlementConfig,
  adminSettings?: Awaited<ReturnType<typeof AdminSettlementSettings.getSingleton>>,
): Promise<SettlementCalculationResult> => {
  // Fetch admin settlement settings for calculation logic (only if not provided)
  const settingsToUse = adminSettings || (await AdminSettlementSettings.getSingleton())

  // Base seller sale amount = sum of seller item subtotals across all sellers
  // In v1 we treat the whole order as one seller settlement unit.
  const saleAmountBase = toNumber(order.subtotal)
  const shippingCharge = toNumber((order as any).shipping)

  // Determine commission base based on admin settings
  const commissionBase = settingsToUse.includeShippingInSaleAmount
    ? saleAmountBase + shippingCharge
    : saleAmountBase
  const saleAmount = saleAmountBase // Keep saleAmount as just subtotal for clarity

  // Calculate commission using admin-configured method and rounding
  // Note: commissionType and commissionValue come from Global/Seller settings
  let commissionAmount = 0
  const commissionType = settings.commissionType
  const commissionValue = toNumber(settings.commissionValue)

  if (commissionType === 'PERCENTAGE') {
    const unroundedCommission = (commissionBase * commissionValue) / 100
    commissionAmount = roundAmount(unroundedCommission, settingsToUse.commissionRoundingMode)
  } else {
    commissionAmount = roundAmount(commissionValue, settingsToUse.commissionRoundingMode)
  }

  const shippingEarning = toNumber((order as any).shipping)

  // Aggregate courier forward fees from all shipments (AWB-wise or ORDER_WISE based on admin settings)
  let courierForwardFee = 0
  const shipments: any[] = (order as any).sellerShipments || []

  if (settingsToUse.courierFeeCalculationMethod === 'AWB_WISE' && shipments.length > 0) {
    // AWB-wise: Sum up courierCharge from all sellerShipments
    const chargesFromShipments = shipments
      .map((shipment: any) => {
        // Prefer the new courierCharge field (AWB-wise)
        if (shipment.courierCharge !== null && shipment.courierCharge !== undefined) {
          return toNumber(shipment.courierCharge)
        }
        // Fallback to legacy fields for backward compatibility
        const meta = shipment.shippingMeta || {}
        return toNumber(
          (meta.totalCharge as unknown as number | undefined) ??
            (meta.charges as unknown as number | undefined) ??
            shipment.courierCart?.rate,
        )
      })
      .filter((charge) => charge > 0)
    const unroundedCourierFee = chargesFromShipments.reduce((sum, charge) => sum + charge, 0)
    courierForwardFee = roundAmount(unroundedCourierFee, settingsToUse.feeRoundingMode)
  } else if (settingsToUse.courierFeeCalculationMethod === 'ORDER_WISE') {
    // ORDER_WISE: Use order-level courier charge (if available in future)
    // For now, fall back to AWB-wise calculation
    const chargesFromShipments = shipments
      .map((shipment: any) => {
        if (shipment.courierCharge !== null && shipment.courierCharge !== undefined) {
          return toNumber(shipment.courierCharge)
        }
        const meta = shipment.shippingMeta || {}
        return toNumber(
          (meta.totalCharge as unknown as number | undefined) ??
            (meta.charges as unknown as number | undefined) ??
            shipment.courierCart?.rate,
        )
      })
      .filter((charge) => charge > 0)
    const unroundedCourierFee = chargesFromShipments.reduce((sum, charge) => sum + charge, 0)
    courierForwardFee = roundAmount(unroundedCourierFee, settingsToUse.feeRoundingMode)
  }

  // Payment gateway fee calculation based on admin settings
  let pgFee = 0
  const paymentMeta = (order as any).paymentMeta || {}

  if (settingsToUse.pgFeeCalculationMethod === 'FROM_PAYMENT_META') {
    // Use paymentMeta.pgFee (current behavior)
    const unroundedPgFee = toNumber(paymentMeta.pgFee, 0)
    pgFee = roundAmount(unroundedPgFee, settingsToUse.feeRoundingMode)
  } else if (settingsToUse.pgFeeCalculationMethod === 'PERCENTAGE') {
    // Calculate as percentage of order total
    const orderTotal = toNumber(order.total, 0)
    const pgFeePercent = settingsToUse.pgFeePercentage || 0
    const unroundedPgFee = (orderTotal * pgFeePercent) / 100
    pgFee = roundAmount(unroundedPgFee, settingsToUse.feeRoundingMode)
  } else if (settingsToUse.pgFeeCalculationMethod === 'FIXED') {
    // Use fixed amount
    const fixedPgFee = settingsToUse.pgFeeFixedAmount || 0
    pgFee = roundAmount(fixedPgFee, settingsToUse.feeRoundingMode)
  }

  // Aggregate COD fees from all shipments (AWB-wise or ORDER_WISE based on admin settings)
  let codFee = 0
  if (settingsToUse.codFeeCalculationMethod === 'AWB_WISE' && shipments.length > 0) {
    // AWB-wise: Sum up codCharge from all sellerShipments
    const codChargesFromShipments = shipments
      .map((shipment: any) => {
        // Prefer the new codCharge field (AWB-wise)
        if (shipment.codCharge !== null && shipment.codCharge !== undefined) {
          return toNumber(shipment.codCharge)
        }
        return 0
      })
      .filter((charge) => charge > 0)
    const unroundedCodFee = codChargesFromShipments.reduce((sum, charge) => sum + charge, 0)
    codFee = roundAmount(unroundedCodFee, settingsToUse.feeRoundingMode)

    // Fallback to legacy order-level sellerCodFee for backward compatibility
    if (codFee === 0) {
      const legacyCodFee = toNumber((order as any).sellerCodFee, 0)
      codFee = roundAmount(legacyCodFee, settingsToUse.feeRoundingMode)
    }
  } else if (settingsToUse.codFeeCalculationMethod === 'ORDER_WISE') {
    // ORDER_WISE: Use order-level COD fee
    const orderLevelCodFee = toNumber((order as any).sellerCodFee, 0)
    codFee = roundAmount(orderLevelCodFee, settingsToUse.feeRoundingMode)
  } else {
    // Fallback to legacy order-level sellerCodFee
    const legacyCodFee = toNumber((order as any).sellerCodFee, 0)
    codFee = roundAmount(legacyCodFee, settingsToUse.feeRoundingMode)
  }

  // Calculate net amount based on admin settings
  let netAmount = 0

  if (settingsToUse.netAmountCalculationMethod === 'CREDITS_MINUS_DEBITS') {
    // Credits: sale amount + shipping (if included)
    const totalCredits =
      saleAmount + (settingsToUse.includeShippingInNetAmount ? shippingEarning : 0)
    // Debits: commission + fees
    const totalDebits = commissionAmount + courierForwardFee + codFee + pgFee
    const unroundedNetAmount = totalCredits - totalDebits
    netAmount = roundAmount(unroundedNetAmount, settingsToUse.settlementAmountRoundingMode)
  } else {
    // SALE_MINUS_ALL: Start with sale amount, subtract all
    const unroundedNetAmount =
      saleAmount +
      (settingsToUse.includeShippingInNetAmount ? shippingEarning : 0) -
      commissionAmount -
      courierForwardFee -
      codFee -
      pgFee
    netAmount = roundAmount(unroundedNetAmount, settingsToUse.settlementAmountRoundingMode)
  }

  // Apply negative settlement handling
  if (!settingsToUse.allowNegativeSettlements) {
    netAmount = Math.max(0, netAmount)
  }

  return {
    saleAmount,
    commissionAmount,
    netAmount,
    shippingEarning,
    courierForwardFee,
    codFee,
    pgFee,
  }
}

export const isOrderDeliveredForSettlement = async (
  order: IOrder,
  adminSettings?: Awaited<ReturnType<typeof AdminSettlementSettings.getSingleton>>,
): Promise<boolean> => {
  // Fetch admin settings if not provided
  const settings = adminSettings || (await AdminSettlementSettings.getSingleton())

  // Check if order must be delivered
  if (settings.requireOrderDelivered) {
    if (order.status !== 'delivered') return false
  }
  // If requireOrderDelivered is false, we allow any status (not recommended)

  // We consider order delivered when its aggregate status is delivered.
  return true
}

// Helper function to validate order items have required fields
const validateOrderItems = (order: IOrder): boolean => {
  if (!order.items || !Array.isArray(order.items)) {
    return false
  }
  for (const item of order.items) {
    if (
      item.priceWithoutTax === undefined ||
      item.priceWithoutTax === null ||
      item.effectivePrice === undefined ||
      item.effectivePrice === null
    ) {
      return false
    }
  }
  return true
}

export const evaluateOrderSettlementEligibility = async (
  order: IOrder,
  settings: SettlementConfig,
  now: Date = new Date(),
  effectiveReturnWindowDays?: number,
  adminSettings?: Awaited<ReturnType<typeof AdminSettlementSettings.getSingleton>>,
): Promise<IOrder | null> => {
  // Fetch admin settlement settings for eligibility checks (only if not provided)
  const settingsToUse = adminSettings || (await AdminSettlementSettings.getSingleton())

  const currentStatus: SettlementStatus = order.settlementStatus || 'NOT_ELIGIBLE'

  // Validate order items have required fields before processing
  if (!validateOrderItems(order)) {
    console.warn(
      `Order ${order._id} has items missing required fields (priceWithoutTax or effectivePrice). Skipping settlement eligibility evaluation.`,
    )
    return null
  }

  // Check if replacement orders should be excluded
  if (settingsToUse.excludeReplacementOrders && (order as any).isReplacement) {
    if (currentStatus !== 'NOT_ELIGIBLE') {
      order.settlementStatus = 'NOT_ELIGIBLE'
      order.settlementEligibleAt = undefined
      order.sellerSaleAmount = undefined
      order.sellerCommissionAmount = undefined
      order.sellerShippingEarning = undefined
      order.sellerCourierCost = undefined
      order.sellerPgFee = undefined
      order.sellerNetAmount = undefined
      await order.save({ validateBeforeSave: false })
    }
    return order
  }

  // Check if order must be delivered
  const isDelivered = await isOrderDeliveredForSettlement(order, settingsToUse)
  if (!isDelivered) {
    if (currentStatus !== 'NOT_ELIGIBLE') {
      order.settlementStatus = 'NOT_ELIGIBLE'
      order.settlementEligibleAt = undefined
      order.sellerSaleAmount = undefined
      order.sellerCommissionAmount = undefined
      order.sellerShippingEarning = undefined
      order.sellerCourierCost = undefined
      order.sellerPgFee = undefined
      order.sellerNetAmount = undefined
      await order.save({ validateBeforeSave: false })
    }
    return order
  }

  // Check if cancelled orders should be excluded
  if (settingsToUse.excludeCancelledOrders && order.status === 'cancelled') {
    if (currentStatus !== 'NOT_ELIGIBLE') {
      order.settlementStatus = 'NOT_ELIGIBLE'
      order.settlementEligibleAt = undefined
      await order.save({ validateBeforeSave: false })
    }
    return order
  }

  // Check if fully returned orders should be excluded
  // Note: This is a simplified check - you may need to enhance based on your order model
  if (settingsToUse.excludeFullyReturnedOrders) {
    // Check if all items are returned (you may need to adjust this based on your order structure)
    const items: any[] = (order as any).items || []
    const allItemsReturned = items.every((item: any) => {
      const returnedQty = item.returnedQuantity || 0
      const orderedQty = item.quantity || 0
      return returnedQty >= orderedQty
    })
    if (allItemsReturned && items.length > 0) {
      if (currentStatus !== 'NOT_ELIGIBLE') {
        order.settlementStatus = 'NOT_ELIGIBLE'
        order.settlementEligibleAt = undefined
        await order.save({ validateBeforeSave: false })
      }
      return order
    }
  }

  // Determine latest deliveredAt across seller shipments for a more accurate window
  let latestDeliveredAt: Date | null = null
  if (Array.isArray(order.sellerShipments)) {
    order.sellerShipments.forEach((shipment: any) => {
      if (shipment?.deliveredAt) {
        const d = new Date(shipment.deliveredAt)
        if (!Number.isNaN(d.getTime())) {
          if (!latestDeliveredAt || d > latestDeliveredAt) {
            latestDeliveredAt = d
          }
        }
      }
    })
  }

  // Check return window based on admin settings (using returnWindowDays from Global/Seller settings)
  if (settingsToUse.requireReturnWindowPassed) {
    const baseDeliveredAt = latestDeliveredAt || (order as any).deliveredAt || order.updatedAt
    const eligibleFrom = new Date(baseDeliveredAt)
    const windowDays =
      typeof effectiveReturnWindowDays === 'number'
        ? effectiveReturnWindowDays
        : settings.returnWindowDays || 0
    eligibleFrom.setDate(eligibleFrom.getDate() + windowDays)

    if (now < eligibleFrom) {
      if (currentStatus !== 'NOT_ELIGIBLE') {
        order.settlementStatus = 'NOT_ELIGIBLE'
        order.settlementEligibleAt = undefined
        await order.save({ validateBeforeSave: false })
      }
      return order
    }
  }

  if (currentStatus === 'NOT_ELIGIBLE' || currentStatus === 'ELIGIBLE') {
    // Pass adminSettings to avoid redundant DB fetch
    const {
      saleAmount,
      commissionAmount,
      netAmount,
      shippingEarning,
      courierForwardFee,
      codFee,
      pgFee,
    } = await calculateSettlementForOrder(order, settings, adminSettings)

    order.sellerSaleAmount = saleAmount
    order.sellerCommissionAmount = commissionAmount
    order.sellerShippingEarning = shippingEarning
    order.sellerCourierCost = courierForwardFee
    order.sellerCodFee = codFee
    order.sellerPgFee = pgFee
    order.sellerNetAmount = netAmount
    order.settlementStatus = 'ELIGIBLE'
    order.settlementEligibleAt = now
    await order.save({ validateBeforeSave: false })

    // Idempotent ledger creation: if we already created entries for this order, skip
    // Check admin settings for when to create ledger entries
    const shouldCreateLedgerEntries = settingsToUse.createLedgerEntriesOnEligibility

    if (shouldCreateLedgerEntries) {
      const existingLedger = await SellerLedgerEntry.findOne({ order: order._id }).lean()
      if (!existingLedger && !(order as any).isReplacement) {
        const sellerId = order.sellerShipments?.[0]?.seller
        if (sellerId) {
          const sellerObjectId = new mongoose.Types.ObjectId(String(sellerId))

          // Apply rounding to ledger entry amounts based on admin settings
          let roundedSaleAmount = saleAmount
          let roundedShippingEarning = shippingEarning
          let roundedCommissionAmount = commissionAmount
          let roundedCourierFee = courierForwardFee
          let roundedCodFee = codFee
          let roundedPgFee = pgFee

          if (settingsToUse.roundLedgerEntriesIndividually) {
            roundedSaleAmount = roundAmount(saleAmount, settingsToUse.ledgerEntryRoundingMode)
            roundedShippingEarning = roundAmount(
              shippingEarning,
              settingsToUse.ledgerEntryRoundingMode,
            )
            roundedCommissionAmount = roundAmount(
              commissionAmount,
              settingsToUse.commissionRoundingMode,
            )
            roundedCourierFee = roundAmount(courierForwardFee, settingsToUse.feeRoundingMode)
            roundedCodFee = roundAmount(codFee, settingsToUse.feeRoundingMode)
            roundedPgFee = roundAmount(pgFee, settingsToUse.feeRoundingMode)
          }

          const entries: any[] = [
            {
              seller: sellerObjectId,
              order: order._id,
              entryType: 'CREDIT',
              reason: 'ORDER_ITEM_CREDIT',
              amount: roundedSaleAmount,
              description: `Item earnings for Order #${order.orderNumber || order._id}`,
            },
            {
              seller: sellerObjectId,
              order: order._id,
              entryType: 'CREDIT',
              reason: 'SHIPPING_CREDIT',
              amount: roundedShippingEarning,
              description: `Customer shipping earning for Order #${order.orderNumber || order._id}`,
            },
            {
              seller: sellerObjectId,
              order: order._id,
              entryType: 'DEBIT',
              reason: 'COMMISSION_DEBIT',
              amount: roundedCommissionAmount,
              description: `Commission for Order #${order.orderNumber || order._id}`,
            },
            {
              seller: sellerObjectId,
              order: order._id,
              entryType: 'DEBIT',
              reason: 'SHIPPING_COST_DEBIT',
              amount: roundedCourierFee,
              description: `Courier forward charge for Order #${order.orderNumber || order._id}`,
            },
          ]

          // COD fee debit entry (for COD orders)
          if (roundedCodFee > 0) {
            entries.push({
              seller: sellerObjectId,
              order: order._id,
              entryType: 'DEBIT',
              reason: 'COD_FEE_DEBIT',
              amount: roundedCodFee,
              description: `COD fee for Order #${order.orderNumber || order._id}`,
            })
          }

          if (roundedPgFee > 0) {
            entries.push({
              seller: sellerObjectId,
              order: order._id,
              entryType: 'DEBIT',
              reason: 'PAYMENT_GATEWAY_FEE',
              amount: roundedPgFee,
              description: `Payment gateway fee for Order #${order.orderNumber || order._id}`,
            })
          }

          if (entries.length) {
            await SellerLedgerEntry.insertMany(entries)
          }
        }
      }
    }

    return order
  }

  return order
}

export const runSettlementEligibilitySweep = async (): Promise<{
  updatedCount: number
}> => {
  const now = new Date()

  // Fetch all settings once at the beginning to avoid redundant DB calls
  const [globalSettings, adminSettings] = await Promise.all([
    GlobalSettlementSettings.findOne().lean(),
    AdminSettlementSettings.getSingleton(),
  ])

  if (!globalSettings) {
    return { updatedCount: 0 }
  }

  const sellerSettingsDocs = await SellerSettlementSettings.find({}).lean()
  const sellerSettingsBySeller = new Map<string, ISellerSettlementSettings>()
  sellerSettingsDocs.forEach((doc) => {
    sellerSettingsBySeller.set(String(doc.seller), doc as any)
  })

  // Find delivered orders that are not yet fully settled
  // Exclude replacement orders (isReplacement: true) - they should never be settled
  const orders = await Order.find({
    status: 'delivered',
    settlementStatus: { $in: ['NOT_ELIGIBLE', 'ELIGIBLE', null] },
    isReplacement: { $ne: true }, // Exclude replacement orders
  })
    .populate('items.product', 'returnable returnDays')
    .exec()

  let updatedCount = 0
  for (const order of orders) {
    const firstShipmentSeller = order.sellerShipments?.[0]?.seller
    if (!firstShipmentSeller) continue
    const sellerIdStr = String(firstShipmentSeller)
    const sellerSettings = sellerSettingsBySeller.get(sellerIdStr)

    let effective: SettlementConfig | null = null

    const allowOverride = globalSettings.allowSellerOverride
    if (allowOverride && sellerSettings?.isActiveOverride) {
      effective = {
        settlementCycle: sellerSettings.settlementCycle,
        customCycleDays: sellerSettings.customCycleDays ?? null,
        returnWindowDays: sellerSettings.returnWindowDays,
        commissionType: sellerSettings.commissionType,
        commissionValue: sellerSettings.commissionValue,
        minBatchAmount: sellerSettings.minBatchAmount ?? null,
      }
    } else {
      effective = {
        settlementCycle: globalSettings.settlementCycle,
        customCycleDays: globalSettings.customCycleDays ?? null,
        returnWindowDays: globalSettings.returnWindowDays,
        commissionType: globalSettings.commissionType,
        commissionValue: globalSettings.commissionValue,
        minBatchAmount: globalSettings.minBatchAmount ?? null,
      }
    }

    // Compute effective return window = item return period + admin/seller return window
    let maxItemReturnDays = 0
    const items: any[] = (order as any).items || []
    items.forEach((item) => {
      const product = item?.product
      if (!product) return
      if (product.returnable === true) {
        const rd =
          typeof product.returnDays === 'number' && product.returnDays > 0 ? product.returnDays : 7
        if (rd > maxItemReturnDays) {
          maxItemReturnDays = rd
        }
      }
    })
    const effectiveReturnWindowDays = maxItemReturnDays + (effective.returnWindowDays || 0)

    const beforeStatus = order.settlementStatus
    try {
      // Pass adminSettings to avoid redundant DB fetch in evaluateOrderSettlementEligibility
      // Note: evaluateOrderSettlementEligibility will still fetch if not provided (for backward compatibility)
      const result = await evaluateOrderSettlementEligibility(
        order,
        effective,
        now,
        effectiveReturnWindowDays,
        adminSettings,
      )
      if (result && beforeStatus !== result.settlementStatus) {
        updatedCount += 1
      }
    } catch (error: any) {
      // Log error but continue processing other orders
      console.error(
        `Error evaluating settlement eligibility for order ${order._id}:`,
        error.message || error,
      )
      // If it's a validation error about missing fields, log it as a warning
      if (error.name === 'ValidationError') {
        console.warn(
          `Order ${order._id} has validation errors. This may indicate missing required fields in order items.`,
        )
      }
    }
  }

  return { updatedCount }
}

export interface BatchGenerationResult {
  createdBatches: ISellerSettlementBatch[]
}

export const generateSettlementBatchesForAllSellers = async (): Promise<BatchGenerationResult> => {
  // Fetch all settings once at the beginning (parallel fetch for better performance)
  const [globalSettings, adminSettings] = await Promise.all([
    GlobalSettlementSettings.findOne().lean(),
    AdminSettlementSettings.getSingleton(),
  ])

  if (!globalSettings) {
    return { createdBatches: [] }
  }

  const sellerSettingsDocs = await SellerSettlementSettings.find({}).exec()
  const sellerSettingsBySeller = new Map<string, ISellerSettlementSettings>()
  sellerSettingsDocs.forEach((doc) => {
    sellerSettingsBySeller.set(String(doc.seller), doc)
  })

  // CRITICAL: Only select orders that are:
  // 1. ELIGIBLE status (not already included in a batch, settled, or reversed)
  // 2. Have positive seller net amount
  // 3. Are not replacement orders
  // 4. Do not already have a settlementBatch assigned (safety check)
  const orders = await Order.find({
    settlementStatus: 'ELIGIBLE',
    sellerNetAmount: { $gt: 0 },
    isReplacement: { $ne: true }, // Exclude replacement orders
    settlementBatch: { $exists: false }, // Safety: exclude orders already linked to a batch
  }).exec()

  // CRITICAL: Multi-seller order safety
  // Orders are grouped by seller - each seller gets their own settlement batch
  // TDS and TCS are calculated seller-wise, not order-wise
  // For multi-seller orders, each seller's portion is handled separately
  const ordersBySeller = new Map<string, IOrder[]>()
  for (const order of orders) {
    const firstShipmentSeller = order.sellerShipments?.[0]?.seller
    if (!firstShipmentSeller) continue
    const sellerIdStr = String(firstShipmentSeller)
    const list = ordersBySeller.get(sellerIdStr) || []
    list.push(order)
    ordersBySeller.set(sellerIdStr, list)
  }

  const createdBatches: ISellerSettlementBatch[] = []

  // AdminSettings already fetched at the beginning (singleton pattern means one fetch is enough)

  for (const [sellerIdStr, eligibleOrders] of ordersBySeller.entries()) {
    if (!eligibleOrders.length) continue

    const sellerSettings = sellerSettingsBySeller.get(sellerIdStr)
    const allowOverride = globalSettings.allowSellerOverride
    const effective: SettlementConfig =
      allowOverride && sellerSettings?.isActiveOverride
        ? {
            settlementCycle: sellerSettings.settlementCycle,
            customCycleDays: sellerSettings.customCycleDays ?? null,
            returnWindowDays: sellerSettings.returnWindowDays,
            commissionType: sellerSettings.commissionType,
            commissionValue: sellerSettings.commissionValue,
            minBatchAmount: sellerSettings.minBatchAmount ?? null,
          }
        : {
            settlementCycle: globalSettings.settlementCycle,
            customCycleDays: globalSettings.customCycleDays ?? null,
            returnWindowDays: globalSettings.returnWindowDays,
            commissionType: globalSettings.commissionType,
            commissionValue: globalSettings.commissionValue,
            minBatchAmount: globalSettings.minBatchAmount ?? null,
          }

    // Get the last settlement batch for this seller (PENDING or PAID) to determine next settlement period
    // This ensures we continue the settlement cycle from where we left off, not from today
    const lastSettlementBatch = await SellerSettlementBatch.findOne({
      seller: new mongoose.Types.ObjectId(sellerIdStr),
    })
      .sort({ toDate: -1, createdAt: -1 })
      .lean()

    // Calculate fromDate and toDate based on the settlement cycle from the last batch
    let fromDate: Date
    let toDate: Date

    if (lastSettlementBatch?.toDate) {
      // We have a previous settlement batch - calculate next period from its end date
      // fromDate = day after last batch's toDate (start of next period)
      fromDate = new Date(lastSettlementBatch.toDate)
      fromDate.setHours(0, 0, 0, 0)
      fromDate.setDate(fromDate.getDate() + 1) // Start from next day

      // Calculate toDate based on settlement cycle from fromDate
      if (effective.settlementCycle === 'DAILY') {
        // For daily, toDate is the same day as fromDate (end of day)
        toDate = new Date(fromDate)
        toDate.setHours(23, 59, 59, 999)
      } else if (effective.settlementCycle === 'WEEKLY') {
        // For weekly, toDate is fromDate + 6 days (7 days total including fromDate)
        toDate = new Date(fromDate)
        toDate.setDate(toDate.getDate() + 6)
        toDate.setHours(23, 59, 59, 999)
      } else if (effective.settlementCycle === 'CUSTOM') {
        // For custom, calculate from fromDate + (customCycleDays - 1) days
        // Example: if cycle is 15 days, fromDate to fromDate + 14 days = 15 days total
        const cycleDays = effective.customCycleDays ?? 7 // Default to 7 days if not specified
        toDate = new Date(fromDate)
        toDate.setDate(toDate.getDate() + (cycleDays - 1))
        toDate.setHours(23, 59, 59, 999)
      } else {
        // Fallback: weekly
        toDate = new Date(fromDate)
        toDate.setDate(toDate.getDate() + 6)
        toDate.setHours(23, 59, 59, 999)
      }
    } else {
      // No previous batch - start from earliest eligible order and calculate first period
      fromDate = new Date(
      Math.min(
        ...eligibleOrders.map((o) =>
          o.settlementEligibleAt ? o.settlementEligibleAt.getTime() : o.createdAt.getTime(),
        ),
      ),
    )
      fromDate.setHours(0, 0, 0, 0)

      // Calculate toDate based on settlement cycle from fromDate
      if (effective.settlementCycle === 'DAILY') {
        // For daily, toDate is the same day as fromDate (end of day)
        toDate = new Date(fromDate)
        toDate.setHours(23, 59, 59, 999)
      } else if (effective.settlementCycle === 'WEEKLY') {
        // For weekly, toDate is fromDate + 6 days (7 days total including fromDate)
        toDate = new Date(fromDate)
        toDate.setDate(toDate.getDate() + 6)
        toDate.setHours(23, 59, 59, 999)
      } else if (effective.settlementCycle === 'CUSTOM') {
        // For custom, calculate from fromDate + (customCycleDays - 1) days
        const cycleDays = effective.customCycleDays ?? 7 // Default to 7 days if not specified
        toDate = new Date(fromDate)
        toDate.setDate(toDate.getDate() + (cycleDays - 1))
        toDate.setHours(23, 59, 59, 999)
      } else {
        // Fallback: weekly
        toDate = new Date(fromDate)
        toDate.setDate(toDate.getDate() + 6)
        toDate.setHours(23, 59, 59, 999)
      }
    }

    // Don't create a batch if toDate is in the future (cycle hasn't completed yet)
    // Only create batches for completed settlement periods
    const now = new Date()
    if (toDate > now) {
      // This settlement period hasn't completed yet, skip creating a batch
      continue
    }

    // CRITICAL: Filter eligible orders to only include those within the calculated date range
    // Orders must have settlementEligibleAt (or createdAt) within fromDate to toDate
    const filteredEligibleOrders = eligibleOrders.filter((order) => {
      const orderDate = order.settlementEligibleAt
        ? new Date(order.settlementEligibleAt)
        : new Date(order.createdAt)
      // Order date must be >= fromDate (start of day) and <= toDate (end of day)
      return orderDate >= fromDate && orderDate <= toDate
    })

    // If no orders fall within the date range, skip this seller
    if (!filteredEligibleOrders.length) {
      continue
    }

    // Check minimum batch amount after filtering by date range
    const totalNet = filteredEligibleOrders.reduce(
      (sum, order) => sum + toNumber(order.sellerNetAmount),
      0,
    )
    const minBatchAmount = effective.minBatchAmount ?? 0
    if (minBatchAmount > 0 && totalNet < minBatchAmount) {
      continue
    }

    // Compute batch totals from ledger entries for these filtered orders
    const orderIds: mongoose.Types.ObjectId[] = filteredEligibleOrders.map(
      (o) => o._id as mongoose.Types.ObjectId,
    )

    // IMPORTANT: Include ledger entries for eligible orders AND unlinked entries
    // This includes:
    // 1. Entries linked to eligible orders
    // 2. Unlinked entries: refunds/adjustments created after settlement, negative balance carry-forwards (if enabled)
    // 3. Reversals for orders in this batch
    // This ensures negative balances from previous batches and refunds on paid batches are picked up
    const orConditions: any[] = [
      // Entries linked to eligible orders
      { order: { $in: orderIds }, settlementBatch: null },
    ]

    // Include unlinked entries if admin setting allows
    if (adminSettings.includeUnlinkedLedgerEntries) {
      orConditions.push(
        // Unlinked entries (refunds/adjustments created after settlement) - these adjust negative balances
        { order: null, settlementBatch: null },
        // Entries for orders that are already settled but have new refunds/adjustments
        // (order exists but not in eligibleOrders because it's already in a paid batch)
        {
          order: { $exists: true, $nin: orderIds },
          settlementBatch: null,
          reason: {
            $in: [
              'REFUND_ITEM',
              'REFUND_SHIPPING',
              'REFUND_COD',
              'REFUND_GST',
              'PLATFORM_ADJUSTMENT',
              'TCS_REVERSAL',
              'TDS_REVERSAL',
            ],
          },
        },
      )
    }

    // Include previous negative balances if admin setting allows
    if (adminSettings.includePreviousNegativeBalances) {
      orConditions.push(
        // TCS_REVERSAL and TDS_REVERSAL entries ONLY if linked to orders in this batch
        // CRITICAL: Do NOT include floating reversals - only include if they belong to orders in this batch
        {
          order: { $in: orderIds },
          settlementBatch: null,
          reason: { $in: ['TCS_REVERSAL', 'TDS_REVERSAL'] },
        },
      )
    }

    // Filter ledger entries to only include those within the date range
    // For entries linked to orders: included if order is in the date range (already filtered via orderIds)
    // For unlinked entries: include if createdAt is within fromDate to toDate
    const modifiedOrConditions = orConditions.map((condition: any) => {
      // Add date filter for unlinked entries (entries without orders)
      // Check if this condition targets unlinked entries (order is null)
      if (condition.order === null || condition.order === undefined) {
        return {
          ...condition,
          createdAt: { $gte: fromDate, $lte: toDate },
        }
      }
      // Order-linked entries: no date filter needed (orders already filtered by date range)
      return condition
    })

    const ledgerEntries = await SellerLedgerEntry.find({
      seller: new mongoose.Types.ObjectId(sellerIdStr),
      $or: modifiedOrConditions,
      reason: { $nin: ['PLATFORM_REFUND_EXPENSE'] }, // Platform expenses don't affect seller settlements
    }).lean()

    // Apply rounding to ledger entry amounts if configured
    const processedEntries = ledgerEntries.map((entry: any) => {
      const amount = toNumber(entry.amount)
      let roundedAmount = amount

      // Round individual entry amounts if configured
      if (adminSettings.roundLedgerEntriesIndividually) {
        // Use appropriate rounding mode based on entry reason
        let roundingMode: RoundingMode = adminSettings.ledgerEntryRoundingMode

        if (entry.reason === 'COMMISSION_DEBIT' || entry.reason === 'COMMISSION') {
          roundingMode = adminSettings.commissionRoundingMode
        } else if (
          entry.reason === 'SHIPPING_COST_DEBIT' ||
          entry.reason === 'COD_FEE_DEBIT' ||
          entry.reason === 'PAYMENT_GATEWAY_FEE' ||
          entry.reason === 'PG_FEE'
        ) {
          roundingMode = adminSettings.feeRoundingMode
        }

        roundedAmount = roundAmount(amount, roundingMode)
      }

      return { ...entry, amount: roundedAmount }
    })

    const breakdown = processedEntries.reduce(
      (acc, entry: any) => {
        const amount = toNumber(entry.amount)

        if (entry.entryType === 'CREDIT') {
          if (entry.reason === 'ORDER_ITEM_CREDIT' || entry.reason === 'ORDER_EARNING') {
            acc.totalItemEarnings += amount
          } else if (entry.reason === 'SHIPPING_CREDIT' || entry.reason === 'SHIPPING_EARNING') {
            acc.totalShippingEarned += amount
          } else if (entry.reason === 'COMMISSION_REVERSAL') {
            acc.totalCommissionReversal += amount
          } else if (entry.reason === 'MANUAL_ADJUSTMENT') {
            // Track manual adjustments as credits (they increase payout)
            acc.totalManualAdjustmentsCredit += amount
          } else if (entry.reason === 'TDS_REVERSAL') {
            acc.totalTdsReversal += amount
          } else if (entry.reason === 'TCS_REVERSAL') {
            acc.totalTcsReversal += amount
          }
        } else if (entry.entryType === 'DEBIT') {
          if (entry.reason === 'COMMISSION_DEBIT' || entry.reason === 'COMMISSION') {
            acc.totalCommission += amount
          } else if (
            entry.reason === 'SHIPPING_COST_DEBIT' ||
            entry.reason === 'SHIPPING_COURIER_COST'
          ) {
            acc.totalCourierCost += amount
          } else if (entry.reason === 'PAYMENT_GATEWAY_FEE' || entry.reason === 'PG_FEE') {
            acc.totalPgFee += amount
          } else if (entry.reason === 'COD_FEE_DEBIT') {
            acc.totalCodFee += amount
          } else if (
            entry.reason === 'RETURN_ITEM_EARNING_REVERSAL' ||
            entry.reason === 'RETURN_ITEM_REVERSAL'
          ) {
            acc.totalReturnItemReversal += amount
          } else if (
            entry.reason === 'RETURN_SHIPPING_EARNING_REVERSAL' ||
            entry.reason === 'RETURN_SHIPPING_REVERSAL'
          ) {
            acc.totalReturnShippingReversal += amount
          } else if (
            entry.reason === 'RETURN_COURIER_COST' ||
            entry.reason === 'RETURN_REVERSE_COURIER_COST'
          ) {
            // RETURN_COURIER_COST is a courier cost - add to totalCourierCost only
            // Do NOT track separately to avoid double-counting
            acc.totalCourierCost += amount
          } else if (entry.reason === 'COD_FEE_REVERSAL') {
            acc.totalReverseCodFee += amount
          } else if (entry.reason === 'MANUAL_ADJUSTMENT') {
            // Track manual adjustments as debits (they reduce payout)
            acc.totalManualAdjustmentsDebit += amount
          } else if (entry.reason === 'SETTLEMENT_CARRY_FORWARD') {
            // Negative balance carried forward from previous settlement batch
            // This is a debit - seller owes this amount, it reduces payout
            acc.totalManualAdjustmentsDebit += amount
          } else if (entry.reason === 'TDS_DEBIT') {
            acc.totalTdsAmount += amount
          } else if (entry.reason === 'TDS_REVERSAL') {
            acc.totalTdsReversal += amount
          } else if (entry.reason === 'TCS_DEBIT') {
            acc.totalTcsAmount += amount
          } else if (entry.reason === 'TCS_REVERSAL') {
            acc.totalTcsReversal += amount
          }
        }
        return acc
      },
      {
        totalItemEarnings: 0,
        totalShippingEarned: 0,
        totalCommission: 0,
        totalCourierCost: 0,
        totalCodFee: 0,
        totalReverseCodFee: 0,
        totalPgFee: 0,
        totalReturnItemReversal: 0,
        totalReturnShippingReversal: 0,
        totalCommissionReversal: 0,
        totalManualAdjustmentsCredit: 0,
        totalManualAdjustmentsDebit: 0,
        totalTdsAmount: 0,
        totalTdsReversal: 0,
        totalTcsAmount: 0,
        totalTcsReversal: 0,
      },
    )

    // Apply rounding to aggregated totals if configured
    let totalSaleAmount = breakdown.totalItemEarnings + breakdown.totalShippingEarned
    let totalCommissionAmount = breakdown.totalCommission

    if (adminSettings.roundLedgerAggregation) {
      totalSaleAmount = roundAmount(totalSaleAmount, adminSettings.ledgerAggregationRoundingMode)
      totalCommissionAmount = roundAmount(
        totalCommissionAmount,
        adminSettings.commissionRoundingMode,
      )
    }

    // Calculate net COD fees (fees minus reversals)
    let netCodFee = breakdown.totalCodFee - breakdown.totalReverseCodFee
    if (adminSettings.roundLedgerAggregation) {
      netCodFee = roundAmount(netCodFee, adminSettings.feeRoundingMode)
    }

    // Other Charges: All charges except commission, TDS, TCS, and manual adjustments
    // Manual adjustments are handled separately as credits/debits
    // RETURN_COURIER_COST is already included in totalCourierCost (do not double-count)
    let totalOtherCharges =
      breakdown.totalCourierCost + // Includes both forward and return courier costs
      netCodFee +
      breakdown.totalPgFee +
      breakdown.totalReturnItemReversal +
      breakdown.totalReturnShippingReversal

    if (adminSettings.roundLedgerAggregation) {
      // Round individual components
      const roundedCourierCost = roundAmount(
        breakdown.totalCourierCost,
        adminSettings.feeRoundingMode,
      )
      const roundedPgFee = roundAmount(breakdown.totalPgFee, adminSettings.feeRoundingMode)
      const roundedReturnItem = roundAmount(
        breakdown.totalReturnItemReversal,
        adminSettings.ledgerAggregationRoundingMode,
      )
      const roundedReturnShipping = roundAmount(
        breakdown.totalReturnShippingReversal,
        adminSettings.ledgerAggregationRoundingMode,
      )
      totalOtherCharges =
        roundedCourierCost + netCodFee + roundedPgFee + roundedReturnItem + roundedReturnShipping
    }

    // CRITICAL: TDS and TCS are calculated ONLY at settlement batch finalization
    // They must NEVER be calculated at order, shipment, or delivery level
    // Settlement batch is the single source of truth for TDS/TCS

    // Validate seller has required tax details
    const sellerObjectId = new mongoose.Types.ObjectId(sellerIdStr)
    const panValidation = await validateSellerPanForTds(sellerObjectId)
    if (!panValidation.valid) {
      throw new Error(
        `Cannot generate settlement batch: ${panValidation.error} Seller ID: ${sellerIdStr}`,
      )
    }

    const gstinValidation = await validateSellerGstinForTcs(sellerObjectId)
    if (!gstinValidation.valid) {
      throw new Error(
        `Cannot generate settlement batch: ${gstinValidation.error} Seller ID: ${sellerIdStr}`,
      )
    }

    // Calculate gross sales including GST for TDS calculation
    // CRITICAL: Only include orders that have ORDER_ITEM_CREDIT entries in this batch
    // This excludes cancelled/fully returned orders whose earnings were fully reversed
    const orderIdsInBatch = new Set(
      ledgerEntries
        .filter(
          (e) =>
            e.entryType === 'CREDIT' &&
            (e.reason === 'ORDER_ITEM_CREDIT' || e.reason === 'ORDER_EARNING'),
        )
        .map((e) => String(e.order)),
    )

    let grossSalesIncludingGst = 0
    for (const order of filteredEligibleOrders) {
      // Only include if order has ORDER_ITEM_CREDIT entry in this batch
      if (orderIdsInBatch.has(String(order._id))) {
        const orderTotal = toNumber(order.total, 0)
        grossSalesIncludingGst += orderTotal
      }
    }

    // Calculate TDS (194O) - ONLY at settlement finalization (if configured at batch level)
    let tdsResult: Awaited<ReturnType<typeof calculateTds>> | null = null
    let tcsResult: Awaited<ReturnType<typeof calculateTcs>> | null = null

    if (adminSettings.calculateTdsAtBatchLevel) {
      tdsResult = await calculateTds(sellerObjectId, grossSalesIncludingGst, toDate)
    }

    // Calculate TCS (GST) - ONLY at settlement finalization (if configured at batch level)
    // TCS applies to ALL sales (registered and unregistered customers)
    // Calculated on taxable value (excluding GST)
    if (adminSettings.calculateTcsAtBatchLevel) {
      tcsResult = await calculateTcs(sellerObjectId, orderIds)
    }

    // Net off TDS and TCS reversals from calculated amounts
    // Reversals are CREDIT entries that reduce the TDS/TCS debits
    const tdsAmount = tdsResult?.tdsAmount ?? 0
    const totalTcsAmount = tcsResult?.totalTcsAmount ?? 0
    let netTdsAmount = Math.max(0, tdsAmount - breakdown.totalTdsReversal)
    let netTcsAmount = Math.max(0, totalTcsAmount - breakdown.totalTcsReversal)

    // Apply rounding to TDS/TCS amounts
    netTdsAmount = roundAmount(netTdsAmount, adminSettings.tdsRoundingMode)
    netTcsAmount = roundAmount(netTcsAmount, adminSettings.tcsRoundingMode)

    // Calculate total credits (money seller earns) with rounding if configured
    let totalCredits =
      breakdown.totalItemEarnings +
      breakdown.totalShippingEarned +
      breakdown.totalCommissionReversal +
      breakdown.totalManualAdjustmentsCredit

    if (adminSettings.roundLedgerAggregation) {
      const roundedItemEarnings = roundAmount(
        breakdown.totalItemEarnings,
        adminSettings.ledgerAggregationRoundingMode,
      )
      const roundedShippingEarned = roundAmount(
        breakdown.totalShippingEarned,
        adminSettings.ledgerAggregationRoundingMode,
      )
      const roundedCommissionReversal = roundAmount(
        breakdown.totalCommissionReversal,
        adminSettings.commissionRoundingMode,
      )
      const roundedManualCredits = roundAmount(
        breakdown.totalManualAdjustmentsCredit,
        adminSettings.ledgerAggregationRoundingMode,
      )
      totalCredits =
        roundedItemEarnings +
        roundedShippingEarned +
        roundedCommissionReversal +
        roundedManualCredits
    }

    // Calculate total debits (money deducted from seller) with rounding if configured
    let totalDebits =
      totalCommissionAmount +
      totalOtherCharges +
      breakdown.totalManualAdjustmentsDebit +
      netTdsAmount +
      netTcsAmount

    if (adminSettings.roundLedgerAggregation) {
      const roundedManualDebits = roundAmount(
        breakdown.totalManualAdjustmentsDebit,
        adminSettings.ledgerAggregationRoundingMode,
      )
      totalDebits =
        totalCommissionAmount +
        totalOtherCharges +
        roundedManualDebits +
        netTdsAmount +
        netTcsAmount
    }

    // Settlement batch net payout = Credits - Debits
    //
    // NEGATIVE PAYOUT BEHAVIOR:
    // If totalNetPayout < 0, the seller owes the platform money.
    // This negative balance will be:
    // 1. Stored in the batch (totalNetPayout will be negative)
    // 2. Shown clearly in seller ledger as negative balance
    // 3. Carried forward and adjusted in the next settlement batch
    // 4. No payout is generated for negative batches (status remains PENDING)
    // 5. Seller must settle negative balance before receiving future payouts
    let totalNetPayout = totalCredits - totalDebits

    // Apply final settlement amount rounding
    totalNetPayout = roundAmount(totalNetPayout, adminSettings.settlementAmountRoundingMode)

    // Calculate actual negative amount before clamping (for carry-forward tracking)
    const actualNegativeAmount = totalNetPayout < 0 ? Math.abs(totalNetPayout) : 0

    // Apply negative settlement handling
    if (!adminSettings.allowNegativeSettlements) {
      totalNetPayout = Math.max(0, totalNetPayout)
    }

    // CRITICAL VALIDATION: Ensure accounting equation holds
    // This invariant MUST be true - if not, there's a calculation bug
    // Note: We compare rounded values since totalNetPayout is rounded before negative handling
    const calculatedNetPayout = totalCredits - totalDebits
    const calculatedNetPayoutRounded = roundAmount(
      calculatedNetPayout,
      adminSettings.settlementAmountRoundingMode,
    )
    // After rounding, apply negative settlement handling to match what we did for totalNetPayout
    const calculatedNetPayoutFinal = !adminSettings.allowNegativeSettlements
      ? Math.max(0, calculatedNetPayoutRounded)
      : calculatedNetPayoutRounded

    const tolerance = 0.01 // Allow 1 paisa tolerance for floating point precision and rounding differences
    if (Math.abs(totalNetPayout - calculatedNetPayoutFinal) > tolerance) {
      const error = new Error(
        `Settlement calculation error: totalNetPayout (${totalNetPayout}) does not equal rounded(totalCredits (${totalCredits}) - totalDebits (${totalDebits})). Calculated: ${calculatedNetPayoutFinal}, Difference: ${Math.abs(
          totalNetPayout - calculatedNetPayoutFinal,
        )}`,
      )
      console.error('Settlement batch calculation error:', {
        sellerId: sellerIdStr,
        totalCredits,
        totalDebits,
        calculatedNetPayout,
        calculatedNetPayoutRounded,
        calculatedNetPayoutFinal,
        totalNetPayout,
        difference: Math.abs(totalNetPayout - calculatedNetPayoutFinal),
      })
      throw error
    }

    const session = await mongoose.startSession()
    session.startTransaction()
    try {
      const batch = await SellerSettlementBatch.create(
        [
          {
            seller: new mongoose.Types.ObjectId(sellerIdStr),
            fromDate,
            toDate,
            ordersCount: filteredEligibleOrders.length,
            totalSaleAmount,
            totalCommissionAmount,
            totalOtherCharges,
            totalNetPayout,
            status: 'PENDING',
            totalItemEarnings: breakdown.totalItemEarnings,
            totalShippingEarned: breakdown.totalShippingEarned,
            totalCourierCostDeducted: breakdown.totalCourierCost,
            totalCodFee: breakdown.totalCodFee,
            totalReverseCodFee: breakdown.totalReverseCodFee,
            totalPgFee: breakdown.totalPgFee,
            totalReturnItemReversal: breakdown.totalReturnItemReversal,
            totalReturnShippingReversal: breakdown.totalReturnShippingReversal,
            totalCommissionReversal: breakdown.totalCommissionReversal,
            totalManualAdjustments:
              breakdown.totalManualAdjustmentsCredit - breakdown.totalManualAdjustmentsDebit,
            totalManualAdjustmentsCredit: breakdown.totalManualAdjustmentsCredit,
            totalManualAdjustmentsDebit: breakdown.totalManualAdjustmentsDebit,
            // TDS fields (net of reversals)
            totalTdsAmount: netTdsAmount,
            tdsRate: tdsResult?.tdsRate ?? 0,
            tdsBaseAmount: tdsResult?.tdsBaseAmount ?? 0,
            tdsExempted: tdsResult?.exempted ?? false,
            tdsExemptionReason: tdsResult?.exemptionReason,
            // TCS fields (net of reversals)
            // Note: TCS breakdown is calculated from orders, reversals are handled separately in reports
            totalTcsAmount: netTcsAmount,
            tcsIgstAmount: tcsResult?.tcsIgstAmount ?? 0,
            tcsCgstAmount: tcsResult?.tcsCgstAmount ?? 0,
            tcsSgstAmount: tcsResult?.tcsSgstAmount ?? 0,
            tcsBaseAmount: tcsResult?.tcsBaseAmount ?? 0,
            tcsBreakdown: tcsResult?.breakdown ?? {
              interState: { salesAmount: 0, tcsAmount: 0 },
              intraState: { salesAmount: 0, tcsCgstAmount: 0, tcsSgstAmount: 0, tcsAmount: 0 },
              registeredCustomers: { salesAmount: 0, tcsAmount: 0 },
              unregisteredCustomers: { salesAmount: 0, tcsAmount: 0 },
            },
          },
        ],
        { session },
      )

      const batchDoc = batch[0]
      const batchId = batchDoc._id

      await Order.updateMany(
        { _id: { $in: filteredEligibleOrders.map((o) => o._id) } },
        {
          $set: {
            settlementStatus: 'INCLUDED_IN_BATCH',
            settlementBatch: batchId,
          },
        },
        { session },
      )

      // Link ledger entries to this batch
      // CRITICAL: Link entries that belong to orders in this batch AND unlinked carry-forward entries
      // Carry-forward entries (SETTLEMENT_CARRY_FORWARD) represent negative balances from previous batches
      // They need to be linked to this batch so they're included in the settlement calculation
      await SellerLedgerEntry.updateMany(
        {
          seller: new mongoose.Types.ObjectId(sellerIdStr),
          $or: [
            // Entries linked to orders in this batch (including their reversals)
            { order: { $in: orderIds }, settlementBatch: null },
            // Unlinked SETTLEMENT_CARRY_FORWARD entries (negative balance from previous batches)
            {
              order: null,
              settlementBatch: null,
              reason: 'SETTLEMENT_CARRY_FORWARD',
            },
          ],
        },
        { $set: { settlementBatch: batchId } },
        { session },
      )

      // Create TDS ledger entry (if TDS is applicable)
      if (tdsResult && tdsResult.tdsAmount > 0) {
        await SellerLedgerEntry.create(
          [
            {
              seller: new mongoose.Types.ObjectId(sellerIdStr),
              settlementBatch: batchId,
              entryType: 'DEBIT',
              reason: 'TDS_DEBIT',
              amount: tdsResult.tdsAmount,
              description: `TDS (194O) @ ${
                tdsResult.tdsRate
              }% on gross sales of ₹${tdsResult.tdsBaseAmount.toFixed(2)}`,
            },
          ],
          { session },
        )
      }

      // Create TCS ledger entry (if TCS is applicable)
      if (tcsResult && tcsResult.totalTcsAmount > 0) {
        await SellerLedgerEntry.create(
          [
            {
              seller: new mongoose.Types.ObjectId(sellerIdStr),
              settlementBatch: batchId,
              entryType: 'DEBIT',
              reason: 'TCS_DEBIT',
              amount: tcsResult.totalTcsAmount,
              description: `TCS (GST) on taxable value of ₹${tcsResult.tcsBaseAmount.toFixed(
                2,
              )}. IGST: ₹${tcsResult.tcsIgstAmount.toFixed(
                2,
              )}, CGST: ₹${tcsResult.tcsCgstAmount.toFixed(
                2,
              )}, SGST: ₹${tcsResult.tcsSgstAmount.toFixed(2)}`,
            },
          ],
          { session },
        )
      }

      // CRITICAL: Handle negative balance carry-forward based on admin settings
      // If allowNegativeSettlements is true: Allow negative payouts and create carry-forward to track debt
      // If allowNegativeSettlements is false AND createCarryForwardOnNegativeClamp is true:
      //   Clamp to 0 but create carry-forward entry to track the debt
      // If allowNegativeSettlements is false AND createCarryForwardOnNegativeClamp is false:
      //   Clamp to 0 and lose the negative balance (not recommended)
      const shouldCreateCarryForward =
        actualNegativeAmount > 0 &&
        (adminSettings.allowNegativeSettlements || adminSettings.createCarryForwardOnNegativeClamp)

      if (shouldCreateCarryForward) {
        await SellerLedgerEntry.create(
          [
            {
              seller: new mongoose.Types.ObjectId(sellerIdStr),
              order: null, // Unlinked entry - represents seller's debt to platform
              settlementBatch: null, // Not linked to any batch - will be picked up in next batch
              entryType: 'DEBIT',
              reason: 'SETTLEMENT_CARRY_FORWARD',
              amount: actualNegativeAmount,
              description: `Negative balance from settlement batch #${String(batchDoc._id).slice(
                -6,
              )}. This amount will be deducted from the next settlement payout.`,
              referenceId: batchDoc._id, // Reference to the batch that created this carry-forward
            },
          ],
          { session },
        )
      }

      await session.commitTransaction()
      session.endSession()
      createdBatches.push(batchDoc)

      // NOTIFY SELLER: Notify about settlement generation
      try {
        await notifySellerSettlementGenerated(
          sellerIdStr,
          String(batchDoc._id),
          batchDoc.fromDate,
          batchDoc.toDate,
          batchDoc.totalNetPayout,
        )

        // Check for negative balance and notify if applicable
        if (batchDoc.totalNetPayout < 0) {
          await notifySellerNegativeBalance(sellerIdStr, batchDoc.totalNetPayout)
        }
      } catch (notifyError) {
        // Log but don't fail the settlement generation
        console.error('Failed to notify seller about settlement:', notifyError)
      }
    } catch (err) {
      await session.abortTransaction()
      session.endSession()
      // eslint-disable-next-line no-console
      console.error('Failed to generate settlement batch:', err)
    }
  }

  // Check for sellers with negative balances who didn't get a settlement
  // (skipped due to minBatchAmount or no eligible orders)
  try {
    const allSellers = await mongoose.model('User').distinct('_id', { role: 'seller' })
    for (const sellerId of allSellers) {
      const sellerIdStr = String(sellerId)
      // Check if seller has unlinked ledger entries (negative balance)
      const unlinkedEntries = await SellerLedgerEntry.find({
        seller: new mongoose.Types.ObjectId(sellerIdStr),
        settlementBatch: null,
        reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
      }).lean()

      if (unlinkedEntries.length > 0) {
        let balance = 0
        unlinkedEntries.forEach((entry: any) => {
          const amount = Number(entry.amount) || 0
          if (entry.entryType === 'CREDIT') {
            balance += amount
          } else if (entry.entryType === 'DEBIT') {
            balance -= amount
          }
        })

        // If negative balance and no settlement was created for this seller
        if (balance < 0 && !createdBatches.find((b) => String(b.seller) === sellerIdStr)) {
          // Check if seller had eligible orders (if not, settlement was skipped)
          const hasEligibleOrders = ordersBySeller.has(sellerIdStr)
          if (!hasEligibleOrders) {
            await notifySellerSettlementSkipped(sellerIdStr, balance)
          }
        }
      }
    }
  } catch (balanceCheckError) {
    // Log but don't fail the settlement generation
    console.error('Failed to check negative balances:', balanceCheckError)
  }

  return { createdBatches }
}

/**
 * Record a payment for a settlement batch (ledger-based, status-agnostic)
 * This function records money movement without changing batch status.
 * Payment state is derived from paidAmount + ledger entries, not from status.
 */
export const recordSettlementPayment = async (
  batchId: string,
  payload: {
    amountPaid: number
    paymentMethod?: string
    paymentReference?: string
    paymentDate?: Date
  },
  adminId: string,
): Promise<ISellerSettlementBatch | null> => {
  const batch = await SellerSettlementBatch.findById(batchId)
  if (!batch) return null

  const { amountPaid, paymentMethod, paymentReference, paymentDate } = payload
  const paymentTimestamp = paymentDate || new Date()

  // VALIDATION 1: amountPaid must be positive
  if (!amountPaid || amountPaid <= 0) {
    throw new Error('Payment amount must be greater than 0')
  }

  // VALIDATION 2: batch.totalNetPayout cannot be 0
  if (batch.totalNetPayout === 0) {
    throw new Error('Cannot record payment for settlement batch with zero net payout')
  }

  // VALIDATION 3: Negative settlements cannot receive payments
  if (batch.totalNetPayout < 0) {
    throw new Error('Negative settlement cannot be paid. Seller owes money to platform.')
  }

  // VALIDATION 4: Payment cannot exceed remaining amount (with tolerance for rounding)
  const tolerance = 0.01 // 1 paisa tolerance for floating point precision
  const currentPaidAmount = batch.paidAmount || 0
  const remainingAmount = batch.totalNetPayout - currentPaidAmount
  if (amountPaid > remainingAmount + tolerance) {
    throw new Error(
      `Payment amount (₹${amountPaid.toFixed(
        2,
      )}) exceeds remaining settlement amount (₹${remainingAmount.toFixed(2)})`,
    )
  }

  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const SellerLedgerEntry = (await import('../models/SellerLedgerEntry')).default

    // CRITICAL: Create SETTLEMENT_PAYOUT ledger entry (MANDATORY)
    // NO ledger entry = payment did not happen
    // This is a CREDIT entry from seller's perspective (seller receives money)
    await SellerLedgerEntry.create(
      [
        {
          seller: batch.seller,
          order: null, // Unlinked entry - represents payout to seller
          settlementBatch: batch._id, // Linked to the batch
          entryType: 'CREDIT', // CREDIT = money coming to seller (seller receives payment)
          reason: 'SETTLEMENT_PAYOUT',
          amount: amountPaid,
          description: `Settlement payout of ₹${amountPaid.toFixed(2)} for batch #${String(
            batch._id,
          ).slice(-6)}.${paymentReference ? ` Reference: ${paymentReference}` : ''}${
            paymentMethod ? ` Method: ${paymentMethod}` : ''
          }`,
        },
      ],
      { session },
    )

    // Update paidAmount
    batch.paidAmount = (batch.paidAmount || 0) + amountPaid
    batch.paidAt = paymentTimestamp
    if (paymentReference !== undefined) batch.paymentReference = paymentReference
    if (paymentMethod !== undefined) batch.paymentMethod = paymentMethod

    // Keep existing payoutDate and payoutReference for backward compatibility
    // (these may be used by other parts of the system)
    if (!batch.payoutDate) {
      batch.payoutDate = paymentTimestamp
    }
    if (paymentReference && !batch.payoutReference) {
      batch.payoutReference = paymentReference
    }

    // Update status to PAID when settlement is fully paid OR overpaid
    // Status is derived from paidAmount, but we update it for UI consistency
    // CRITICAL: If overpaid (paidAmount > totalNetPayout), mark as PAID since seller has been paid
    const newPaidAmount = batch.paidAmount
    const tolerance = 0.01 // Allow 1 paisa tolerance for floating point precision
    const isFullyPaid =
      batch.totalNetPayout > 0 && Math.abs(newPaidAmount - batch.totalNetPayout) < tolerance
    const isOverpaid = batch.totalNetPayout > 0 && newPaidAmount > batch.totalNetPayout

    if (isFullyPaid || isOverpaid) {
      // Fully paid or overpaid - update status to PAID
      batch.status = 'PAID'

      // Also update orders' settlement status to SETTLED
      await Order.updateMany(
        { settlementBatch: batch._id },
        {
          $set: {
            settlementStatus: 'SETTLED',
          },
        },
        { session },
      )

      if (isOverpaid) {
        console.log(
          `📝 Settlement batch ${batch._id} marked as PAID (overpaid: ₹${newPaidAmount.toFixed(
            2,
          )} > ₹${batch.totalNetPayout.toFixed(2)})`,
        )
      }
    }
    // If partially paid, keep status as PENDING (no change)

    await batch.save({ session })

    await session.commitTransaction()
    session.endSession()
    return batch
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    throw err
  }
}

/**
 * @deprecated Use recordSettlementPayment instead. This function is kept for backward compatibility
 * but should not be used for new payment recording.
 */
export const markSettlementBatchPaid = async (
  batchId: string,
  payload: { payoutDate?: Date; payoutReference?: string; payoutNotes?: string },
): Promise<ISellerSettlementBatch | null> => {
  // Legacy function - for backward compatibility, map to recordSettlementPayment
  // This should be removed once all callers are updated
  const batch = await SellerSettlementBatch.findById(batchId)
  if (!batch) return null

  // For backward compatibility: if batch has positive payout, record full payment
  if (batch.totalNetPayout > 0) {
    const currentPaidAmount = batch.paidAmount || 0
    const remainingAmount = batch.totalNetPayout - currentPaidAmount
    if (remainingAmount > 0) {
      // Use a dummy admin ID for legacy calls (should be replaced with actual admin ID)
      return recordSettlementPayment(
        batchId,
        {
          amountPaid: remainingAmount,
          paymentReference: payload.payoutReference,
          paymentDate: payload.payoutDate,
        },
        'system-legacy',
      )
    }
  }

  return batch
}
