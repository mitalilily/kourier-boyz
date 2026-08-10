import { Request, Response } from 'express'
import mongoose from 'mongoose'
import AuditLog from '../models/AuditLog'
import GlobalSettlementSettings from '../models/GlobalSettlementSettings'
import Order from '../models/Order'
import Product from '../models/Product'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import SellerSettlementBatch from '../models/SellerSettlementBatch'
import SellerSettlementSettings from '../models/SellerSettlementSettings'
import User from '../models/User'
import { io } from '../server'
import {
  generateSettlementBatchesForAllSellers,
  recordSettlementPayment,
} from '../services/settlement.service'
import { generateAndAttachSettlementInvoiceToBatch } from '../services/settlementInvoice.service'
import { createAuditLog } from '../utils/auditLog'
import { emailTemplates, sendEmail } from '../utils/email'
import {
  notifySellerAdjustment,
  notifySellerLargeAdjustment,
  notifySellerNegativeBalance,
  notifySellerSettlementPaid,
} from '../utils/sellerNotifications'
import {
  calculateTcs,
  calculateTds,
  validateSellerGstinForTcs,
  validateSellerPanForTds,
} from '../utils/taxCompliance'

export const getSellerSettlementSettings = async (req: Request, res: Response) => {
  try {
    const sellerId = req.params.sellerId
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' })
    }

    const settings = await SellerSettlementSettings.findOne({ seller: sellerId }).lean()
    return res.json({ success: true, data: settings || null })
  } catch (error: any) {
    console.error('Error fetching settlement settings:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const createManualAdjustment = async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params
    const { type, amount, description, order_id, batchId } = req.body as {
      type: 'credit' | 'debit'
      amount: number
      description?: string
      order_id?: string
      batchId?: string
    }

    const adminId = req.user?.userId
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' })
    }

    if (type !== 'credit' && type !== 'debit') {
      return res.status(400).json({ success: false, message: 'Type must be credit or debit' })
    }

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Amount must be a positive number greater than 0' })
    }

    let linkedOrderId: mongoose.Types.ObjectId | undefined
    if (order_id) {
      if (!mongoose.Types.ObjectId.isValid(order_id)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID' })
      }
      const order = await Order.findById(order_id).select('sellerShipments').lean()
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' })
      }
      const firstSeller = order.sellerShipments?.[0]?.seller
      if (!firstSeller || String(firstSeller) !== String(sellerId)) {
        return res.status(400).json({
          success: false,
          message: 'Order does not belong to this seller',
        })
      }
      linkedOrderId = new mongoose.Types.ObjectId(order_id)
    }

    let targetBatch: any | null = null
    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ success: false, message: 'Invalid batch ID' })
      }
      const existingBatch = await SellerSettlementBatch.findById(batchId)
      if (!existingBatch) {
        return res.status(404).json({ success: false, message: 'Batch not found' })
      }
      if (String(existingBatch.seller) !== String(sellerId)) {
        return res.status(400).json({
          success: false,
          message: 'Batch does not belong to this seller',
        })
      }
      targetBatch = existingBatch
    }

    // Link adjustment to batch if provided (even if PAID - for tracking corrections after invoice)
    // CRITICAL: If batch has invoice, this is a correction - generate credit/debit note referencing settlement invoice
    // Do NOT regenerate old settlement invoice - adjustment will be reflected in next settlement
    const batchHasInvoice = targetBatch?.invoiceNumber ? true : false
    const adjustmentDescription =
      description?.trim() ||
      (batchHasInvoice
        ? `Correction to settlement invoice: Manual ${type} adjustment of ₹${amount.toFixed(2)}`
        : `Manual ${type} adjustment of ₹${amount.toFixed(2)}`)

    const entry = await SellerLedgerEntry.create({
      seller: new mongoose.Types.ObjectId(sellerId),
      order: linkedOrderId ?? undefined,
      settlementBatch: targetBatch ? targetBatch._id : null, // Link to batch even if PAID (for corrections)
      entryType: type === 'credit' ? 'CREDIT' : 'DEBIT',
      reason: 'MANUAL_ADJUSTMENT',
      amount,
      description: adjustmentDescription,
    })

    // Generate debit note for debit-type manual adjustments
    if (type === 'debit') {
      try {
        const { generateInvoice } = await import('../utils/invoiceGenerator')
        const seller = await User.findById(sellerId)
          .select(
            'name email businessName storeLogo sellerAgreementSignature authorizedPersonName authorizedPersonDesignation storeDescription gstNumber state',
          )
          .lean()

        if (seller) {
          const adjustmentDate = new Date()
          let orderData: any = null
          let customerData: any = null

          // If there's a linked order, use it for debit note generation
          if (linkedOrderId) {
            const order = await Order.findById(linkedOrderId)
              .populate('user', 'name email')
              .populate('items.product', 'name')
              .populate('items.variant', 'name')
              .lean()

            if (order) {
              orderData = order
              customerData = (order as any).user
            }
          }

          // Get settlement batch invoice number if available (for seller invoice reference)
          // CRITICAL: Seller debit notes must reference seller settlement invoice, NOT buyer invoice
          // If batch has invoice, this is a correction - reference the settlement invoice
          let settlementInvoiceNumber: string | undefined = undefined
          if (targetBatch) {
            const batchWithInvoice = await SellerSettlementBatch.findById(targetBatch._id)
              .select('invoiceNumber status')
              .lean()
            if (batchWithInvoice?.invoiceNumber) {
              settlementInvoiceNumber = batchWithInvoice.invoiceNumber
              console.log(
                `📝 Correction: Debit note for adjustment after settlement invoice ${settlementInvoiceNumber} generated`,
              )
            }
          }

          // Create order structure for debit note (use actual order if available, otherwise synthetic)
          // CRITICAL GST COMPLIANCE: Do NOT include buyer invoice (order.invoice) for seller debit notes
          const debitNoteOrder: any = orderData
            ? {
                ...orderData,
                // Remove buyer invoice - seller debit notes must reference seller invoices only
                invoice: undefined, // Do NOT reference buyer invoice
                subtotal: amount,
                total: amount,
                tax: 0,
                shipping: 0,
                discount: 0,
                items: [
                  {
                    ...(orderData.items?.[0] || {}),
                    quantity: 1,
                    price: amount,
                    effectivePrice: amount,
                    priceWithoutTax: amount,
                    subtotal: amount,
                    hsnSacCode: '998314', // Services - Marketplace commission/adjustment
                    gstRatePercent: 18,
                    gstTaxType: 'IGST',
                    igst: (amount * 18) / 118,
                    cgst: 0,
                    sgst: 0,
                  },
                ],
              }
            : {
                _id: linkedOrderId || new mongoose.Types.ObjectId(),
                orderNumber: linkedOrderId
                  ? `ORD-${adjustmentDate.toISOString().split('T')[0].replace(/-/g, '')}-ADJ`
                  : `ADJ-${adjustmentDate
                      .toISOString()
                      .split('T')[0]
                      .replace(/-/g, '')}-${Math.random()
                      .toString(36)
                      .substring(2, 8)
                      .toUpperCase()}`,
                createdAt: adjustmentDate,
                status: 'delivered',
                total: amount,
                subtotal: amount,
                tax: 0,
                shipping: 0,
                discount: 0,
                paymentMethod: 'ADJUSTMENT', // Default payment method for manual adjustments
                paymentStatus: 'paid', // Manual adjustments are considered paid
                items: [
                  {
                    product: null,
                    variant: null,
                    seller: new mongoose.Types.ObjectId(sellerId),
                    quantity: 1,
                    price: amount,
                    effectivePrice: amount,
                    priceWithoutTax: amount,
                    subtotal: amount,
                    hsnSacCode: '998314', // Services - Marketplace commission/adjustment
                    gstRatePercent: 18,
                    gstTaxType: 'IGST',
                    igst: (amount * 18) / 118,
                    cgst: 0,
                    sgst: 0,
                  },
                ],
                shippingAddress: seller.addressLine1
                  ? {
                      name: seller.businessName || seller.name,
                      addressLine1: seller.addressLine1,
                      addressLine2: seller.addressLine2,
                      city: seller.city,
                      state: seller.state,
                      postalCode: seller.postalCode,
                      country: seller.country || 'India',
                    }
                  : undefined,
              }

          const invoiceData = {
            order: debitNoteOrder,
            customer: customerData || (seller as any),
            seller: seller as any,
            items: [
              {
                product: orderData?.items?.[0]?.product || {
                  name: description || 'Manual Adjustment',
                },
                variant: orderData?.items?.[0]?.variant || null,
                orderItem: debitNoteOrder.items[0],
              },
            ],
            audience: 'seller' as const,
            // CRITICAL GST COMPLIANCE: Pass settlement invoice for seller debit note reference
            settlement: settlementInvoiceNumber
              ? {
                  grossAmount: amount, // Required field for SettlementSummary
                  invoiceNumber: settlementInvoiceNumber,
                }
              : undefined,
          }

          // Generate debit note
          const debitNote = await generateInvoice(invoiceData, 'DEBIT_NOTE', adjustmentDate)

          // Store debit note in ledger entry
          entry.debitNote = {
            debit_note_id: debitNote.invoice_id,
            debit_note_url: debitNote.invoice_url,
            debit_note_number: debitNote.invoice_number,
            generated_at: adjustmentDate,
            hsnSummary: debitNote.hsnSummary,
          }
          await entry.save()

          console.log(
            `✅ Debit Note ${debitNote.invoice_number} generated for Manual Adjustment ${entry._id}`,
          )
        }
      } catch (debitNoteError) {
        console.error('❌ Error generating Debit Note for manual adjustment:', debitNoteError)
        // Don't fail the adjustment operation if debit note generation fails
      }
    }

    // Generate credit note for credit-type manual adjustments
    // CRITICAL GST COMPLIANCE: Post-invoice corrections require credit notes
    if (type === 'credit') {
      try {
        const { generateSellerCreditNote } = await import('../utils/creditNoteGenerator')

        // Get settlement batch invoice number if available (for seller invoice reference)
        // If batch has invoice, this is a correction - reference the settlement invoice
        let settlementBatchId: string | undefined = undefined
        if (targetBatch) {
          const batchWithInvoice = await SellerSettlementBatch.findById(targetBatch._id)
            .select('invoiceNumber status')
            .lean()
          if (batchWithInvoice?.invoiceNumber) {
            settlementBatchId = String(targetBatch._id)
            console.log(
              `📝 Correction: Credit note for adjustment after settlement invoice ${batchWithInvoice.invoiceNumber} generated`,
            )
          }
        }

        // Only generate credit note if batch has invoice (post-invoice correction)
        if (settlementBatchId) {
          const creditNoteResult = await generateSellerCreditNote({
            sellerId,
            amount,
            description: adjustmentDescription,
            orderId: linkedOrderId,
            settlementBatchId,
            hsnSacCode: '998314', // Services - Marketplace commission/adjustment
            gstRatePercent: 18,
            gstTaxType: 'IGST',
            productName: description || 'Manual Adjustment',
          })

          if (creditNoteResult.success && creditNoteResult.creditNote) {
            // Store credit note in ledger entry
            entry.creditNote = {
              credit_note_id: creditNoteResult.creditNote.credit_note_id,
              credit_note_url: creditNoteResult.creditNote.credit_note_url,
              credit_note_number: creditNoteResult.creditNote.credit_note_number,
              generated_at: creditNoteResult.creditNote.generated_at,
              hsnSummary: creditNoteResult.creditNote.hsnSummary,
            }
            await entry.save()

            console.log(
              `✅ Credit Note ${creditNoteResult.creditNote.credit_note_number} generated for Manual Adjustment ${entry._id}`,
            )
          } else {
            console.error(
              `❌ Failed to generate credit note for manual adjustment: ${creditNoteResult.error}`,
            )
          }
        } else {
          // Pre-invoice adjustment - no credit note needed (ledger-only)
          console.log(
            `ℹ️ Credit-type adjustment made to batch without invoice - no credit note generated (ledger-only)`,
          )
        }
      } catch (creditNoteError) {
        console.error('❌ Error generating Credit Note for manual adjustment:', creditNoteError)
        // Don't fail the adjustment operation if credit note generation fails
      }
    }

    // Only recompute batch totals if batch is PENDING (not PAID)
    // CRITICAL: Do NOT regenerate settlement invoice if batch is PAID
    // Corrections after invoice generation are handled via credit/debit notes
    // Adjustments will be reflected in the next settlement batch
    if (targetBatch && targetBatch.status === 'PENDING') {
      await recomputeBatchTotalsFromLedger(targetBatch)
      await targetBatch.save()
    } else if (targetBatch && targetBatch.status === 'PAID' && targetBatch.invoiceNumber) {
      // Log that this is a correction after invoice (for audit trail)
      console.log(
        `📝 Correction adjustment made to PAID batch ${targetBatch._id} with invoice ${targetBatch.invoiceNumber}. ` +
          `Credit/Debit note generated. Adjustment will be reflected in next settlement.`,
      )
    }

    // AUDIT LOG: Record who created manual adjustment (NON-NEGOTIABLE)
    try {
      await createAuditLog({
        action: 'MANUAL_ADJUSTMENT_CREATED',
        performedBy: String(adminId),
        req,
        entityType: 'MANUAL_ADJUSTMENT',
        entityId: String(entry._id),
        metadata: {
          adjustmentId: String(entry._id),
          sellerId: String(sellerId),
          adjustmentAmount: amount,
          adjustmentType: type === 'credit' ? 'CREDIT' : 'DEBIT',
          description: description || undefined,
          orderId: linkedOrderId ? String(linkedOrderId) : undefined,
          batchId: targetBatch ? String(targetBatch._id) : undefined,
          batchStatus: targetBatch ? targetBatch.status : undefined,
        },
      })
    } catch (auditError) {
      // Log but don't fail the operation
      console.error('Failed to create audit log for manual adjustment:', auditError)
    }

    // NOTIFY SELLER: Notify about manual adjustment (in-app notification)
    try {
      await notifySellerAdjustment(sellerId, type, amount, description || undefined)
      // Also check if this is a large adjustment and send email
      await notifySellerLargeAdjustment(
        sellerId,
        amount,
        type,
        description || undefined,
        5000, // Threshold: ₹5,000
      )
    } catch (notifyError) {
      // Log but don't fail the operation
      console.error('Failed to notify seller about adjustment:', notifyError)
    }

    // Check for negative balance after adjustment
    try {
      const allEntries = await SellerLedgerEntry.find({
        seller: new mongoose.Types.ObjectId(sellerId),
        reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
      }).lean()

      let balance = 0
      allEntries.forEach((entry: any) => {
        const amount = Number(entry.amount) || 0
        if (entry.entryType === 'CREDIT') {
          balance += amount
        } else if (entry.entryType === 'DEBIT') {
          balance -= amount
        }
      })

      // Notify if balance becomes negative (only if it wasn't negative before this adjustment)
      if (balance < 0) {
        const previousBalance = balance - (type === 'credit' ? amount : -amount)
        if (previousBalance >= 0) {
          // Balance just became negative
          await notifySellerNegativeBalance(sellerId, balance)
        }
      }
    } catch (balanceError) {
      // Log but don't fail the operation
      console.error('Failed to check negative balance:', balanceError)
    }

    return res.status(201).json({
      success: true,
      data: entry,
      ...(targetBatch ? { batch: targetBatch } : {}),
    })
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error creating manual adjustment:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getSellerLedger = async (req: Request, res: Response) => {
  try {
    const { sellerId } = req.params

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' })
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId)

    // Fetch all ledger entries for this seller, excluding platform-only entries
    // Platform entries have seller: null or reason in (PLATFORM_REFUND_EXPENSE, PLATFORM_ADJUSTMENT)
    // This matches the seller-facing endpoint for consistency
    const allEntries = await SellerLedgerEntry.find({
      seller: sellerObjectId,
      reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
    })
      .sort({ createdAt: 1 })
      .populate('order', 'orderNumber')
      .populate('settlementBatch', 'fromDate toDate status')
      .lean()

    // Opening balance is 0 (starting balance for the seller)
    // In the future, this could be calculated from previous periods
    const openingBalance = 0

    // Calculate running balance sequentially from opening balance
    // Entries are sorted by createdAt ASC (oldest first)
    let runningBalance = openingBalance
    const entriesWithBalance = allEntries.map((entry: any) => {
      const amount = Number(entry.amount) || 0
      if (entry.entryType === 'CREDIT') {
        runningBalance += amount
      } else if (entry.entryType === 'DEBIT') {
        runningBalance -= amount
      }

      return {
        _id: entry._id,
        order: entry.order
          ? {
              _id: entry.order._id,
              orderNumber: (entry.order as any).orderNumber,
            }
          : null,
        settlementBatch: entry.settlementBatch
          ? {
              _id: entry.settlementBatch._id,
              fromDate: (entry.settlementBatch as any).fromDate,
              toDate: (entry.settlementBatch as any).toDate,
              status: (entry.settlementBatch as any).status,
            }
          : null,
        entryType: entry.entryType,
        reason: entry.reason,
        reasonLabel: getLedgerReasonLabel(entry.reason),
        amount: amount,
        description: entry.description || null,
        createdAt: entry.createdAt,
        runningBalance,
      }
    })

    // Calculate closing balance: Opening Balance + (sum of all CREDITS - sum of all DEBITS)
    const totalCredits = entriesWithBalance.reduce(
      (sum, entry) => sum + (entry.entryType === 'CREDIT' ? entry.amount : 0),
      0,
    )
    const totalDebits = entriesWithBalance.reduce(
      (sum, entry) => sum + (entry.entryType === 'DEBIT' ? entry.amount : 0),
      0,
    )
    const calculatedClosingBalance = openingBalance + totalCredits - totalDebits

    // Validation: Ensure calculated closing balance matches running balance
    if (Math.abs(calculatedClosingBalance - runningBalance) > 0.01) {
      console.error(
        `Ledger balance mismatch for seller ${sellerId}: calculated=${calculatedClosingBalance}, running=${runningBalance}`,
      )
      return res.status(500).json({
        success: false,
        message: 'Ledger balance calculation error. Please contact support.',
      })
    }

    const closingBalance = runningBalance

    // Get recent entries (last 100) for display
    // Since entries are in chronological order (ASC), we take the last 100 and reverse for display (DESC)
    const recentEntries = entriesWithBalance.slice(-100).reverse()

    // Calculate opening balance for the displayed entries
    // If showing all entries, opening balance is 0
    // If showing only recent entries, opening balance is the running balance before the first displayed entry
    const displayOpeningBalance =
      entriesWithBalance.length > 100
        ? entriesWithBalance[entriesWithBalance.length - 100].runningBalance -
          (entriesWithBalance[entriesWithBalance.length - 100].entryType === 'CREDIT'
            ? entriesWithBalance[entriesWithBalance.length - 100].amount
            : -entriesWithBalance[entriesWithBalance.length - 100].amount)
        : openingBalance

    return res.json({
      success: true,
      data: {
        entries: recentEntries,
        openingBalance,
        closingBalance,
        totalEntries: entriesWithBalance.length,
      },
    })
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error fetching seller ledger:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getGlobalSettlementSettings = async (_req: Request, res: Response) => {
  try {
    let settings = await GlobalSettlementSettings.findOne().lean()
    if (!settings) {
      await GlobalSettlementSettings.create({})
      settings = await GlobalSettlementSettings.findOne().lean()
    }
    return res.json({ success: true, data: settings })
  } catch (error: any) {
    console.error('Error fetching global settlement settings:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const updateGlobalSettlementSettings = async (req: Request, res: Response) => {
  try {
    const {
      settlementCycle,
      customCycleDays,
      returnWindowDays,
      commissionType,
      commissionValue,
      allowSellerOverride,
      minBatchAmount,
    } = req.body || {}

    let settings = await GlobalSettlementSettings.findOne()
    if (!settings) {
      settings = new GlobalSettlementSettings()
    }

    if (settlementCycle) settings.settlementCycle = settlementCycle
    settings.customCycleDays = customCycleDays ?? null
    if (typeof returnWindowDays === 'number') settings.returnWindowDays = returnWindowDays
    if (commissionType) settings.commissionType = commissionType
    if (typeof commissionValue === 'number') settings.commissionValue = commissionValue
    if (typeof allowSellerOverride === 'boolean') {
      settings.allowSellerOverride = allowSellerOverride
    }
    settings.minBatchAmount = minBatchAmount ?? null

    await settings.save()

    return res.json({ success: true, data: settings })
  } catch (error: any) {
    console.error('Error updating global settlement settings:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const upsertSellerSettlementSettings = async (req: Request, res: Response) => {
  try {
    const sellerId = req.params.sellerId
    const {
      settlementCycle,
      customCycleDays,
      returnWindowDays,
      commissionType,
      commissionValue,
      minBatchAmount,
    } = req.body

    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' })
    }

    if (!commissionType || typeof commissionValue !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'commissionType and commissionValue are required',
      })
    }

    const payload: any = {
      settlementCycle,
      customCycleDays: customCycleDays ?? null,
      returnWindowDays,
      commissionType,
      commissionValue,
      minBatchAmount: minBatchAmount ?? null,
    }

    const settings = await SellerSettlementSettings.findOneAndUpdate(
      { seller: sellerId },
      { $set: payload, $setOnInsert: { seller: sellerId } },
      { new: true, upsert: true },
    )

    return res.json({ success: true, data: settings })
  } catch (error: any) {
    console.error('Error saving settlement settings:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const listAdminSettlementBatches = async (req: Request, res: Response) => {
  try {
    const {
      seller,
      status,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    }: {
      seller?: string
      status?: string
      fromDate?: string
      toDate?: string
      page?: any
      limit?: any
    } = req.query as any

    const query: any = {}
    if (seller && mongoose.Types.ObjectId.isValid(seller)) {
      query.seller = new mongoose.Types.ObjectId(seller)
    }
    if (status && ['PENDING', 'PAID'].includes(status)) {
      query.status = status
    }
    if (fromDate || toDate) {
      query.createdAt = {}
      if (fromDate) query.createdAt.$gte = new Date(fromDate)
      if (toDate) query.createdAt.$lte = new Date(toDate)
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [batches, total] = await Promise.all([
      SellerSettlementBatch.find(query)
        .populate('seller', 'name businessName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      SellerSettlementBatch.countDocuments(query),
    ])

    return res.json({
      success: true,
      data: batches,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error listing settlement batches:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAdminSettlementBatchDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' })
    }

    const batch = await SellerSettlementBatch.findById(id).populate(
      'seller',
      'name businessName supportEmail email',
    )
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' })
    }

    const orders = await Order.find({ settlementBatch: batch._id })
      .select(
        '_id orderNumber createdAt total discountAmount sellerSaleAmount sellerCommissionAmount sellerNetAmount settlementStatus',
      )
      .sort({ createdAt: -1 })

    return res.json({
      success: true,
      data: {
        batch,
        orders,
      },
    })
  } catch (error: any) {
    console.error('Error fetching batch detail:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const generateAdminSettlementBatches = async (_req: Request, res: Response) => {
  try {
    const result = await generateSettlementBatchesForAllSellers()
    return res.json({
      success: true,
      data: {
        created: result.createdBatches.length,
        batches: result.createdBatches,
      },
    })
  } catch (error: any) {
    console.error('Error generating settlement batches:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const recordSettlementPaymentAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const {
      amountPaid,
      paymentMethod,
      paymentReference,
      paymentDate,
      // Legacy fields for backward compatibility (mapped to new fields)
      payoutDate,
      payoutReference: legacyPayoutReference,
      payoutNotes,
    } = req.body || {}

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' })
    }

    const adminId = req.user?.userId as string | undefined
    if (!adminId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    // Validate required field
    if (!amountPaid || typeof amountPaid !== 'number' || amountPaid <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount is required and must be greater than 0',
      })
    }

    // Map legacy fields if new fields not provided
    const finalAmountPaid = amountPaid
    const finalPaymentMethod = paymentMethod
    const finalPaymentReference = paymentReference || legacyPayoutReference
    const finalPaymentDate = paymentDate
      ? new Date(paymentDate)
      : payoutDate
      ? new Date(payoutDate)
      : new Date()

    // Record payment (ledger-based, no status change)
    const batch = await recordSettlementPayment(
      id,
      {
        amountPaid: finalAmountPaid,
        paymentMethod: finalPaymentMethod,
        paymentReference: finalPaymentReference,
        paymentDate: finalPaymentDate,
      },
      adminId,
    )

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' })
    }

    // Load fresh batch data after payment recording
    const updatedBatch = await SellerSettlementBatch.findById(id)
    if (!updatedBatch) {
      return res.status(404).json({ success: false, message: 'Batch not found after payment' })
    }

    // AUDIT LOG: Record payment (REQUIRED)
    try {
      await createAuditLog({
        action: 'SETTLEMENT_PAYMENT_RECORDED',
        performedBy: String(adminId),
        req,
        entityType: 'SETTLEMENT_BATCH',
        entityId: String(updatedBatch._id),
        metadata: {
          batchId: String(updatedBatch._id),
          sellerId: String(updatedBatch.seller),
          amountPaid: finalAmountPaid,
          totalNetPayout: updatedBatch.totalNetPayout,
          paidAmount: updatedBatch.paidAmount || 0,
          remainingAmount: updatedBatch.totalNetPayout - (updatedBatch.paidAmount || 0),
          paymentMethod: finalPaymentMethod || undefined,
          paymentReference: finalPaymentReference || undefined,
          paymentDate: finalPaymentDate.toISOString(),
        },
      })
    } catch (auditError) {
      // Log but don't fail the operation
      console.error('Failed to create audit log for settlement payment:', auditError)
    }

    // Notify seller via email & socket (only if fully paid)
    const currentPaidAmount = updatedBatch.paidAmount || 0
    const isFullyPaid = Math.abs(currentPaidAmount - updatedBatch.totalNetPayout) < 0.01

    if (isFullyPaid && updatedBatch.totalNetPayout > 0) {
      try {
        const seller = await User.findById(updatedBatch.seller).select(
          'name businessName email supportEmail newOrderNotification',
        )
        const sellerEmail = seller?.supportEmail || seller?.email
        const sellerName = seller?.businessName || seller?.name || 'Seller'

        if (sellerEmail) {
          const batchIdStr = String(updatedBatch._id)
          const subject = `Settlement payment processed - Batch ${batchIdStr}`
          const period = `${updatedBatch.fromDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })} - ${updatedBatch.toDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`
          const body = emailTemplates.sellerShipmentStatusUpdate(sellerName, {
            orderNumber: batchIdStr,
            statusLabel: 'Settlement Paid',
            message: `Your settlement payment of ₹${updatedBatch.totalNetPayout.toFixed(
              2,
            )} for the period ${period} has been processed. The funds will reflect in your bank account within 2-3 business days.${
              updatedBatch.paymentReference ? ` Reference: ${updatedBatch.paymentReference}` : ''
            }`,
          })
          void sendEmail(sellerEmail, subject, body)
        }

        try {
          const batchIdStr = String(updatedBatch._id)
          io.to(`user:${updatedBatch.seller.toString()}`).emit('settlement:payment_recorded', {
            batchId: batchIdStr,
            amountPaid: finalAmountPaid,
            totalNetPayout: updatedBatch.totalNetPayout,
            paidAmount: currentPaidAmount,
            isFullyPaid: true,
            paymentDate: finalPaymentDate.toISOString(),
            paymentReference: updatedBatch.paymentReference,
            triggeredAt: new Date().toISOString(),
          })
        } catch {
          // ignore socket errors
        }

        // NOTIFY SELLER: Create system notification for payout (includes email)
        try {
          const { notifyLinkedTickets } = await import('../utils/ticketSystemMessages')
          const period = `${updatedBatch.fromDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })} - ${updatedBatch.toDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`
          await notifyLinkedTickets(
            'settlement',
            String(updatedBatch._id),
            `Your settlement payment of ₹${updatedBatch.totalNetPayout.toFixed(
              2,
            )} for the period ${period} has been processed. The funds will reflect in your bank account within 2-3 business days.${
              updatedBatch.paymentReference ? ` Reference: ${updatedBatch.paymentReference}` : ''
            }`,
          )
        } catch (error) {
          console.error('Error sending automated system message for settlement:', error)
        }

        try {
          const period = `${updatedBatch.fromDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
          })} - ${updatedBatch.toDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}`
          await notifySellerSettlementPaid(
            updatedBatch.seller,
            String(updatedBatch._id),
            updatedBatch.totalNetPayout,
            finalPaymentDate.toISOString(),
            period,
            updatedBatch.paymentReference || undefined,
          )
        } catch (notifyError) {
          // Log but don't fail the operation
          console.error('Failed to notify seller about settlement payout:', notifyError)
        }
      } catch {
        // ignore notification failures
      }
    }

    // Prepare informative message about the payment outflow
    const paymentDetails = []
    paymentDetails.push(`✅ Payment of ₹${finalAmountPaid.toFixed(2)} recorded successfully`)
    paymentDetails.push(`💰 SETTLEMENT_PAYOUT ledger entry created (CREDIT to seller)`)
    paymentDetails.push(
      `📊 Paid Amount: ₹${(updatedBatch.paidAmount || 0).toFixed(
        2,
      )} / ₹${updatedBatch.totalNetPayout.toFixed(2)}`,
    )

    if (finalPaymentReference) {
      paymentDetails.push(`🔖 Reference: ${finalPaymentReference}`)
    }
    if (finalPaymentMethod) {
      paymentDetails.push(`💳 Method: ${finalPaymentMethod}`)
    }

    if (isFullyPaid) {
      paymentDetails.push(`✅ Settlement fully paid - seller notified`)
    } else {
      const remaining = updatedBatch.totalNetPayout - currentPaidAmount
      paymentDetails.push(
        `⚠️ Remaining amount: ₹${remaining.toFixed(2)} (partial payment recorded)`,
      )
    }

    return res.json({
      success: true,
      data: updatedBatch,
      message: isFullyPaid
        ? 'Payment recorded successfully. Settlement is fully paid. SETTLEMENT_PAYOUT ledger entry created - seller notified.'
        : `Payment recorded successfully. Settlement is partially paid (₹${currentPaidAmount.toFixed(
            2,
          )} of ₹${updatedBatch.totalNetPayout.toFixed(
            2,
          )}). SETTLEMENT_PAYOUT ledger entry created.`,
      details: {
        amountPaid: finalAmountPaid,
        paidAmount: updatedBatch.paidAmount || 0,
        totalNetPayout: updatedBatch.totalNetPayout,
        remainingAmount: updatedBatch.totalNetPayout - currentPaidAmount,
        isFullyPaid,
        ledgerEntryCreated: true,
        ledgerEntryType: 'SETTLEMENT_PAYOUT',
        ledgerEntryAmount: finalAmountPaid,
        paymentMethod: finalPaymentMethod,
        paymentReference: finalPaymentReference,
        paymentInfo: paymentDetails.join('\n'),
      },
    })
  } catch (error: any) {
    console.error('Error recording settlement payment:', error)
    // Return validation errors with appropriate status codes
    if (error.message?.includes('cannot be paid') || error.message?.includes('exceeds')) {
      return res.status(400).json({ success: false, message: error.message })
    }
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Legacy endpoint - kept for backward compatibility
// This should redirect to recordSettlementPaymentAdmin or be removed after migration
export const markAdminSettlementBatchPaid = async (req: Request, res: Response) => {
  // Redirect to new payment recording endpoint
  // This preserves backward compatibility for existing API calls
  return recordSettlementPaymentAdmin(req, res)
}

export const listSellerSettlementBatches = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const { status, fromDate, toDate, page = 1, limit = 20 } = req.query as any

    const query: any = { seller: new mongoose.Types.ObjectId(sellerId) }
    if (status && ['PENDING', 'PAID'].includes(status)) {
      query.status = status
    }
    if (fromDate || toDate) {
      query.createdAt = {}
      if (fromDate) query.createdAt.$gte = new Date(fromDate)
      if (toDate) query.createdAt.$lte = new Date(toDate)
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [batches, total] = await Promise.all([
      SellerSettlementBatch.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      SellerSettlementBatch.countDocuments(query),
    ])

    return res.json({
      success: true,
      data: batches,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error listing seller settlement batches:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getSellerSettlementBatchDetail = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' })
    }

    const batch = await SellerSettlementBatch.findOne({
      _id: id,
      seller: new mongoose.Types.ObjectId(sellerId),
    })
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' })
    }

    const orders = await Order.find({
      settlementBatch: batch._id,
    })
      .select(
        '_id orderNumber createdAt sellerSaleAmount sellerCommissionAmount sellerNetAmount settlementStatus',
      )
      .sort({ createdAt: -1 })

    return res.json({
      success: true,
      data: {
        batch,
        orders,
      },
    })
  } catch (error: any) {
    console.error('Error fetching seller batch detail:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

const parseSettlementImportCsv = async (
  buffer: Buffer,
  mimetype?: string,
): Promise<{
  orderIds: string[]
  orderNumbers: string[]
}> => {
  // Handle Excel files (.xlsx, .xls)
  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel'
  ) {
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      // ExcelJS handles both .xlsx and .xls files
      await workbook.xlsx.load(buffer as any)

      const worksheet = workbook.worksheets[0]
      if (!worksheet || worksheet.rowCount < 2) {
        return { orderIds: [], orderNumbers: [] }
      }

      // Find header row
      const headerRow = worksheet.getRow(1)
      const headerColumns: string[] = []
      headerRow.eachCell((cell, colNumber) => {
        const value = cell.value?.toString()?.trim().toLowerCase() || ''
        headerColumns[colNumber] = value
      })

      const idIndexes: number[] = []
      const numberIndexes: number[] = []

      headerColumns.forEach((col, idx) => {
        if (col && ['order_id', 'id', 'orderid'].includes(col)) {
          idIndexes.push(idx)
        }
        if (col && ['order_number', 'order_no', 'ordernumber', 'order number'].includes(col)) {
          numberIndexes.push(idx)
        }
      })

      const orderIds: string[] = []
      const orderNumbers: string[] = []

      // Process data rows
      for (let rowNum = 2; rowNum <= worksheet.rowCount; rowNum += 1) {
        const row = worksheet.getRow(rowNum)
        const rowValues: string[] = []

        row.eachCell((cell, colNumber) => {
          const value = cell.value?.toString()?.trim() || ''
          rowValues[colNumber] = value
        })

        idIndexes.forEach((idx) => {
          const val = rowValues[idx]
          if (val) orderIds.push(val)
        })
        numberIndexes.forEach((idx) => {
          const val = rowValues[idx]
          if (val) orderNumbers.push(val)
        })
      }

      return { orderIds, orderNumbers }
    } catch (excelError: any) {
      throw new Error(
        `Failed to parse Excel file: ${excelError.message || 'Invalid Excel file format'}`,
      )
    }
  }

  // Handle CSV files
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '') // Remove BOM if present
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (!lines.length) {
    return { orderIds: [], orderNumbers: [] }
  }

  // Detect delimiter
  const header = lines[0]
  const commaCount = (header.match(/,/g) || []).length
  const semicolonCount = (header.match(/;/g) || []).length
  const tabCount = (header.match(/\t/g) || []).length
  let delimiter = ','
  if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = '\t'
  } else if (semicolonCount > commaCount) {
    delimiter = ';'
  }

  // Parse CSV with proper handling of quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i += 1 // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    // Add last field
    result.push(current.trim())
    return result
  }

  const headerColumns = parseCSVLine(header).map((h) =>
    h.replace(/^"|"$/g, '').trim().toLowerCase(),
  )

  const idIndexes: number[] = []
  const numberIndexes: number[] = []

  headerColumns.forEach((col, idx) => {
    if (['order_id', 'id', 'orderid', 'order id'].includes(col)) {
      idIndexes.push(idx)
    }
    if (['order_number', 'order_no', 'ordernumber', 'order number', 'order no'].includes(col)) {
      numberIndexes.push(idx)
    }
  })

  if (idIndexes.length === 0 && numberIndexes.length === 0) {
    return { orderIds: [], orderNumbers: [] }
  }

  const orderIds: string[] = []
  const orderNumbers: string[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i]
    const cols = parseCSVLine(row).map((c) => c.replace(/^"|"$/g, '').trim())

    idIndexes.forEach((idx) => {
      const val = cols[idx]
      if (val) orderIds.push(val)
    })
    numberIndexes.forEach((idx) => {
      const val = cols[idx]
      if (val) orderNumbers.push(val)
    })
  }

  return { orderIds, orderNumbers }
}

const recomputeBatchTotalsFromLedger = async (batch: any) => {
  // CRITICAL: TDS and TCS values are IMMUTABLE once settlement batch is created
  // Do NOT recalculate TDS/TCS from ledger entries - use stored values
  // Only recompute other charges (commission, courier, etc.)

  const sellerId = batch.seller as mongoose.Types.ObjectId
  const ledgerEntries = await SellerLedgerEntry.find({
    seller: sellerId,
    settlementBatch: batch._id,
  }).lean()

  // Preserve original TDS/TCS values (immutable)
  const originalTdsAmount = batch.totalTdsAmount || 0
  const originalTcsAmount = batch.totalTcsAmount || 0

  const toNumber = (value: any, fallback = 0): number => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  const breakdown = ledgerEntries.reduce(
    (acc, entry: any) => {
      const amount = toNumber(entry.amount)
      const isCredit = entry.entryType === 'CREDIT'

      if (isCredit) {
        if (entry.reason === 'ORDER_ITEM_CREDIT' || entry.reason === 'ORDER_EARNING') {
          acc.totalItemEarnings += amount
        } else if (entry.reason === 'SHIPPING_CREDIT' || entry.reason === 'SHIPPING_EARNING') {
          acc.totalShippingEarned += amount
        } else if (entry.reason === 'COMMISSION_REVERSAL') {
          acc.totalCommissionReversal += amount
        } else if (entry.reason === 'MANUAL_ADJUSTMENT') {
          // Only MANUAL_ADJUSTMENT affects seller settlements
          // PLATFORM_ADJUSTMENT is excluded (platform-only, doesn't affect seller balance)
          acc.totalManualAdjustmentsCredit += amount
        }
      } else {
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
          // Only MANUAL_ADJUSTMENT affects seller settlements
          // PLATFORM_ADJUSTMENT is excluded (platform-only, doesn't affect seller balance)
          acc.totalManualAdjustmentsDebit += amount
        } else if (entry.reason === 'SETTLEMENT_CARRY_FORWARD') {
          // Negative balance carried forward from previous settlement batch
          // This is a debit - seller owes this amount, it reduces payout
          acc.totalManualAdjustmentsDebit += amount
        }
        // NOTE: TDS_DEBIT, TDS_REVERSAL, TCS_DEBIT, TCS_REVERSAL are EXCLUDED from breakdown
        // because TDS/TCS are IMMUTABLE after batch creation - we use stored values instead
      }

      return acc
    },
    {
      totalItemEarnings: 0,
      totalShippingEarned: 0,
      totalCommission: 0,
      totalCourierCost: 0,
      totalPgFee: 0,
      totalReturnItemReversal: 0,
      totalReturnShippingReversal: 0,
      totalCodFee: 0,
      totalReverseCodFee: 0,
      totalCommissionReversal: 0,
      totalManualAdjustmentsCredit: 0,
      totalManualAdjustmentsDebit: 0,
    },
  )

  const manualCredits = breakdown.totalManualAdjustmentsCredit
  const manualDebits = breakdown.totalManualAdjustmentsDebit

  const totalSaleAmount = breakdown.totalItemEarnings + breakdown.totalShippingEarned
  const totalCommissionAmount = breakdown.totalCommission

  // Calculate net COD fees (fees minus reversals)
  const netCodFee = breakdown.totalCodFee - breakdown.totalReverseCodFee

  // Other Charges: All charges except commission, TDS, TCS, and manual adjustments
  // Manual adjustments are handled separately as credits/debits
  // RETURN_COURIER_COST is already included in totalCourierCost (do not double-count)
  const totalOtherCharges =
    breakdown.totalCourierCost + // Includes both forward and return courier costs
    netCodFee +
    breakdown.totalPgFee +
    breakdown.totalReturnItemReversal +
    breakdown.totalReturnShippingReversal

  // Calculate total credits (money seller earns)
  const totalCredits =
    breakdown.totalItemEarnings +
    breakdown.totalShippingEarned +
    breakdown.totalCommissionReversal +
    manualCredits

  // Calculate total debits (money deducted from seller)
  const totalDebits =
    breakdown.totalCommission +
    totalOtherCharges +
    manualDebits +
    originalTdsAmount +
    originalTcsAmount

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
  const totalNetPayout = totalCredits - totalDebits

  // CRITICAL VALIDATION: Ensure accounting equation holds
  // This invariant MUST be true - if not, there's a calculation bug
  const calculatedNetPayout = totalCredits - totalDebits
  const tolerance = 0.01 // Allow 1 paisa tolerance for floating point precision
  if (Math.abs(totalNetPayout - calculatedNetPayout) > tolerance) {
    const error = new Error(
      `Settlement calculation error: totalNetPayout (${totalNetPayout}) does not equal totalCredits (${totalCredits}) - totalDebits (${totalDebits}). Difference: ${Math.abs(
        totalNetPayout - calculatedNetPayout,
      )}`,
    )
    console.error('Settlement batch recomputation error:', {
      batchId: batch._id,
      totalCredits,
      totalDebits,
      calculatedNetPayout,
      totalNetPayout,
      difference: Math.abs(totalNetPayout - calculatedNetPayout),
    })
    throw error
  }

  batch.totalSaleAmount = totalSaleAmount
  batch.totalCommissionAmount = totalCommissionAmount
  batch.totalOtherCharges = totalOtherCharges
  batch.totalNetPayout = totalNetPayout
  batch.totalItemEarnings = breakdown.totalItemEarnings
  batch.totalShippingEarned = breakdown.totalShippingEarned
  batch.totalCourierCostDeducted = breakdown.totalCourierCost
  batch.totalCodFee = breakdown.totalCodFee
  batch.totalReverseCodFee = breakdown.totalReverseCodFee
  batch.totalPgFee = breakdown.totalPgFee
  batch.totalReturnItemReversal = breakdown.totalReturnItemReversal
  batch.totalReturnShippingReversal = breakdown.totalReturnShippingReversal
  batch.totalCommissionReversal = breakdown.totalCommissionReversal
  batch.totalManualAdjustments = manualCredits - manualDebits
  batch.totalManualAdjustmentsCredit = breakdown.totalManualAdjustmentsCredit
  batch.totalManualAdjustmentsDebit = breakdown.totalManualAdjustmentsDebit

  // CRITICAL: If batch is overpaid (paidAmount > totalNetPayout), mark as PAID
  // This ensures that overpaid batches are automatically marked as PAID when totals are recomputed
  const statusTolerance = 0.01
  const isFullyPaid =
    batch.totalNetPayout > 0 &&
    Math.abs((batch.paidAmount || 0) - batch.totalNetPayout) < statusTolerance
  const isOverpaid = batch.totalNetPayout > 0 && (batch.paidAmount || 0) > batch.totalNetPayout

  if ((isFullyPaid || isOverpaid) && batch.status === 'PENDING') {
    batch.status = 'PAID'
    // Also update orders' settlement status to SETTLED
    await Order.updateMany(
      { settlementBatch: batch._id },
      {
        $set: {
          settlementStatus: 'SETTLED',
        },
      },
    )
    if (isOverpaid) {
      console.log(
        `📝 Settlement batch ${batch._id} auto-marked as PAID during recompute (overpaid: ₹${(
          batch.paidAmount || 0
        ).toFixed(2)} > ₹${batch.totalNetPayout.toFixed(2)})`,
      )
    }
  }

  // CRITICAL: TDS and TCS are IMMUTABLE after settlement batch creation
  // Always preserve original values - never recalculate from ledger
  // Ledger entries for TDS_REVERSAL and TCS_REVERSAL are for future settlements only
  batch.totalTdsAmount = originalTdsAmount
  batch.totalTcsAmount = originalTcsAmount

  // Note: TDS_REVERSAL and TCS_REVERSAL ledger entries from returns/refunds
  // will be included in the NEXT settlement batch, not this one
}

export const importSettlementOrders = async (req: Request, res: Response) => {
  try {
    const file = req.file
    const { batchId } = req.body as { batchId?: string }

    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        message:
          'No file uploaded. Please upload a CSV or Excel file containing order IDs or numbers.',
      })
    }

    let orderIds: string[] = []
    let orderNumbers: string[] = []

    try {
      const parsed = await parseSettlementImportCsv(file.buffer, file.mimetype)
      orderIds = parsed.orderIds
      orderNumbers = parsed.orderNumbers
    } catch (parseError: any) {
      return res.status(400).json({
        success: false,
        message: `Error parsing file: ${
          parseError.message ||
          'Invalid file format. Please ensure the file is a valid CSV or Excel file.'
        }`,
      })
    }

    if (!orderIds.length && !orderNumbers.length) {
      return res.status(400).json({
        success: false,
        message:
          'No order identifiers found in file. Expected headers: order_id / order_number (case-insensitive). Please check your file format.',
      })
    }

    const orderQuery: any = {}
    const orConditions: any[] = []

    const validObjectIds = orderIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
    if (validObjectIds.length) {
      orConditions.push({
        _id: { $in: validObjectIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
    }
    if (orderNumbers.length) {
      orConditions.push({ orderNumber: { $in: orderNumbers } })
    }

    if (orConditions.length === 1) {
      Object.assign(orderQuery, orConditions[0])
    } else if (orConditions.length > 1) {
      orderQuery.$or = orConditions
    }

    const orders = await Order.find(orderQuery)
      .select(
        '_id orderNumber sellerShipments settlementBatch settlementStatus createdAt settlementEligibleAt total',
      )
      .lean()

    if (!orders.length) {
      const totalIds = orderIds.length
      const totalNumbers = orderNumbers.length
      const invalidIds = orderIds.filter((id) => !mongoose.Types.ObjectId.isValid(id)).length
      return res.status(404).json({
        success: false,
        message: `No matching orders found. Processed ${totalIds} order ID(s) and ${totalNumbers} order number(s) from file.${
          invalidIds > 0 ? ` ${invalidIds} order ID(s) were invalid.` : ''
        } Please verify the order IDs and order numbers in your file.`,
      })
    }

    const sellerIds = new Set<string>()
    const alreadyInOtherBatches: string[] = []
    const eligibleOrders: any[] = []

    orders.forEach((order: any) => {
      const firstShipmentSeller = order.sellerShipments?.[0]?.seller
      if (firstShipmentSeller) {
        sellerIds.add(String(firstShipmentSeller))
      }
      if (order.settlementBatch) {
        alreadyInOtherBatches.push(order.orderNumber || String(order._id))
      } else {
        eligibleOrders.push(order)
      }
    })

    if (sellerIds.size === 0) {
      return res.status(400).json({
        success: false,
        message:
          'No seller information found in the matched orders. This may indicate an issue with the order data.',
      })
    }

    if (sellerIds.size > 1) {
      return res.status(400).json({
        success: false,
        message:
          'Orders from multiple sellers were found. Please import orders for one seller at a time.',
      })
    }

    if (!eligibleOrders.length) {
      return res.status(400).json({
        success: false,
        message:
          'All matching orders are already attached to settlement batches. Nothing to import.',
        details: {
          alreadyInBatches: alreadyInOtherBatches,
        },
      })
    }

    const sellerIdStr = Array.from(sellerIds)[0]
    const sellerObjectId = new mongoose.Types.ObjectId(sellerIdStr)

    let targetBatch: any = null
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      if (batchId) {
        if (!mongoose.Types.ObjectId.isValid(batchId)) {
          await session.abortTransaction()
          session.endSession()
          return res.status(400).json({ success: false, message: 'Invalid batch ID' })
        }

        const existingBatch = await SellerSettlementBatch.findById(batchId).session(session)
        if (!existingBatch) {
          await session.abortTransaction()
          session.endSession()
          return res.status(404).json({ success: false, message: 'Batch not found' })
        }

        if (String(existingBatch.seller) !== sellerIdStr) {
          await session.abortTransaction()
          session.endSession()
          return res.status(400).json({
            success: false,
            message:
              'Seller mismatch: imported orders belong to a different seller than the target batch.',
          })
        }

        const orderIdsToAttach = eligibleOrders.map((o) => o._id)
        await Order.updateMany(
          { _id: { $in: orderIdsToAttach } },
          {
            $set: {
              settlementBatch: existingBatch._id,
              settlementStatus: 'INCLUDED_IN_BATCH',
            },
          },
          { session },
        )

        // Link ledger entries - include entries for imported orders AND unlinked reversals
        // This matches the normal settlement generation logic
        await SellerLedgerEntry.updateMany(
          {
            seller: sellerObjectId,
            $or: [
              // Entries linked to imported orders
              { order: { $in: orderIdsToAttach }, settlementBatch: null },
              // Unlinked reversals (from returns/refunds) that need to be included
              {
                order: { $exists: true },
                settlementBatch: null,
                reason: { $in: ['TCS_REVERSAL', 'TDS_REVERSAL'] },
              },
            ],
          },
          {
            $set: {
              settlementBatch: existingBatch._id,
            },
          },
          { session },
        )

        await session.commitTransaction()
        session.endSession()

        // CRITICAL GST COMPLIANCE: If batch has invoice, adding orders increases taxable value
        // This is a post-invoice correction - MUST generate credit note for the increase
        // This is the CORE DEFINITION of a Credit Note
        const batchWithInvoice = await SellerSettlementBatch.findById(existingBatch._id)
          .select('invoiceNumber status')
          .lean()

        if (batchWithInvoice?.invoiceNumber) {
          try {
            // Calculate total taxable value increase from added orders
            // Taxable value = seller's sale amount (subtotal) for the order
            const addedOrders = await Order.find({ _id: { $in: orderIdsToAttach } })
              .select('subtotal sellerSaleAmount items shippingAddress')
              .populate('user', 'state')
              .lean()

            let totalTaxableValueIncrease = 0
            const orderItemsForCreditNote: any[] = []

            addedOrders.forEach((order: any) => {
              // Taxable value is the seller's sale amount (excluding GST)
              const orderTaxableValue = order.sellerSaleAmount || order.subtotal || 0
              totalTaxableValueIncrease += orderTaxableValue

              // Collect order items for credit note (with HSN/SAC codes and GST info)
              if (order.items && Array.isArray(order.items)) {
                order.items.forEach((item: any) => {
                  if (item.seller && String(item.seller) === sellerIdStr) {
                    orderItemsForCreditNote.push({
                      order,
                      item,
                      taxableValue:
                      item.subtotal ||
                      (item.effectivePrice ?? item.price ?? 0) * (item.quantity || 1),
                    })
                  }
                })
              }
            })

            if (totalTaxableValueIncrease > 0) {
              const { generateSellerCreditNote } = await import('../utils/creditNoteGenerator')

              // For multiple orders, we might need multiple credit notes or aggregate
              // For now, generate one credit note for the total increase
              // In the future, we could generate separate credit notes per order

              // Use the first order's HSN/SAC code, or default service code
              const firstItem = orderItemsForCreditNote[0]?.item
              const hsnSacCode = firstItem?.hsnSacCode || '998314'
              const gstRatePercent = firstItem?.gstRatePercent || 18
              // Convert gstTaxType to expected format ('IGST' or 'CGST_SGST')
              const itemGstTaxType = firstItem?.gstTaxType
              const gstTaxType =
                itemGstTaxType === 'CGST_SGST' || itemGstTaxType === 'CGST+SGST'
                  ? 'CGST_SGST'
                  : 'IGST'

              const creditNoteResult = await generateSellerCreditNote({
                sellerId: sellerObjectId,
                amount: totalTaxableValueIncrease,
                description: `Taxable value increase: ${eligibleOrders.length} order(s) added to batch after invoice`,
                settlementBatchId: String(existingBatch._id),
                hsnSacCode,
                gstRatePercent,
                gstTaxType,
                productName: `${eligibleOrders.length} Order(s) Added After Invoice`,
              })

              if (creditNoteResult.success && creditNoteResult.creditNote) {
                // Create a ledger entry to track this taxable value increase
                const taxableValueIncreaseEntry = await SellerLedgerEntry.create({
                  seller: sellerObjectId,
                  settlementBatch: existingBatch._id,
                  entryType: 'CREDIT',
                  reason: 'MANUAL_ADJUSTMENT', // Using manual adjustment for now
                  amount: totalTaxableValueIncrease,
                  description: `Taxable value increase: ${eligibleOrders.length} order(s) added to batch after invoice generation`,
                  creditNote: {
                    credit_note_id: creditNoteResult.creditNote.credit_note_id,
                    credit_note_url: creditNoteResult.creditNote.credit_note_url,
                    credit_note_number: creditNoteResult.creditNote.credit_note_number,
                    generated_at: creditNoteResult.creditNote.generated_at,
                    hsnSummary: creditNoteResult.creditNote.hsnSummary,
                  },
                })

                console.log(
                  `✅ Credit Note ${
                    creditNoteResult.creditNote.credit_note_number
                  } generated for taxable value increase (₹${totalTaxableValueIncrease.toFixed(
                    2,
                  )}) - ${eligibleOrders.length} order(s) added to batch ${
                    existingBatch._id
                  } after invoice`,
                )
              } else {
                console.error(
                  `❌ Failed to generate credit note for taxable value increase: ${creditNoteResult.error}`,
                )
              }
            }
          } catch (creditNoteError) {
            // Log but don't fail the import operation if credit note generation fails
            console.error(
              '❌ Error generating Credit Note for taxable value increase:',
              creditNoteError,
            )
          }
        }

        await recomputeBatchTotalsFromLedger(existingBatch)
        await existingBatch.save()

        targetBatch = existingBatch
      } else {
        // Create new batch - need to calculate TDS/TCS and all totals properly
        const orderIdsToAttach = eligibleOrders.map((o) => o._id) as mongoose.Types.ObjectId[]

        const fromDate = new Date(
          Math.min(
            ...eligibleOrders.map((o) =>
              o.settlementEligibleAt ? o.settlementEligibleAt.getTime() : o.createdAt.getTime(),
            ),
          ),
        )
        const toDate = new Date(
          Math.max(
            ...eligibleOrders.map((o) =>
              o.settlementEligibleAt ? o.settlementEligibleAt.getTime() : o.createdAt.getTime(),
            ),
          ),
        )

        // Get all relevant ledger entries (matches normal settlement generation logic)
        // This includes:
        // 1. Entries linked to imported orders
        // 2. Unlinked entries: negative balance carry-forwards from previous batches
        // 3. Reversals for orders in this batch
        const ledgerEntries = await SellerLedgerEntry.find({
          seller: sellerObjectId,
          $or: [
            // Entries linked to imported orders
            { order: { $in: orderIdsToAttach }, settlementBatch: null },
            // Unlinked entries (order: null, settlementBatch: null)
            // This includes negative balance carry-forwards from previous batches
            { order: null, settlementBatch: null },
            // TCS_REVERSAL and TDS_REVERSAL entries ONLY if linked to orders in this batch
            // CRITICAL: Do NOT include floating reversals - only include if they belong to orders in this batch
            {
              order: { $in: orderIdsToAttach },
              settlementBatch: null,
              reason: { $in: ['TCS_REVERSAL', 'TDS_REVERSAL'] },
            },
          ],
          reason: { $nin: ['PLATFORM_REFUND_EXPENSE'] }, // Platform expenses don't affect seller settlements
        }).lean()

        const toNumber = (value: any, fallback = 0): number => {
          const n = Number(value)
          return Number.isFinite(n) ? n : fallback
        }

        // Calculate breakdown from ledger entries (same logic as normal generation)
        const breakdown = ledgerEntries.reduce(
          (acc, entry: any) => {
            const amount = toNumber(entry.amount)

            if (entry.entryType === 'CREDIT') {
              if (entry.reason === 'ORDER_ITEM_CREDIT' || entry.reason === 'ORDER_EARNING') {
                acc.totalItemEarnings += amount
              } else if (
                entry.reason === 'SHIPPING_CREDIT' ||
                entry.reason === 'SHIPPING_EARNING'
              ) {
                acc.totalShippingEarned += amount
              } else if (entry.reason === 'COMMISSION_REVERSAL') {
                acc.totalCommissionReversal += amount
              } else if (entry.reason === 'MANUAL_ADJUSTMENT') {
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

        const manualCredits = breakdown.totalManualAdjustmentsCredit
        const manualDebits = breakdown.totalManualAdjustmentsDebit

        const totalSaleAmount = breakdown.totalItemEarnings + breakdown.totalShippingEarned
        const totalCommissionAmount = breakdown.totalCommission

        // Calculate net COD fees (fees minus reversals)
        const netCodFee = breakdown.totalCodFee - breakdown.totalReverseCodFee

        // Other Charges: All charges except commission, TDS, TCS, and manual adjustments
        // Manual adjustments are handled separately as credits/debits
        // RETURN_COURIER_COST is already included in totalCourierCost (do not double-count)
        const totalOtherCharges =
          breakdown.totalCourierCost + // Includes both forward and return courier costs
          netCodFee +
          breakdown.totalPgFee +
          breakdown.totalReturnItemReversal +
          breakdown.totalReturnShippingReversal

        // Validate seller has required tax details
        const panValidation = await validateSellerPanForTds(sellerObjectId)
        if (!panValidation.valid) {
          await session.abortTransaction()
          session.endSession()
          return res.status(400).json({
            success: false,
            message: `Cannot create settlement batch: ${panValidation.error}`,
          })
        }

        const gstinValidation = await validateSellerGstinForTcs(sellerObjectId)
        if (!gstinValidation.valid) {
          await session.abortTransaction()
          session.endSession()
          return res.status(400).json({
            success: false,
            message: `Cannot create settlement batch: ${gstinValidation.error}`,
          })
        }

        // Calculate gross sales including GST for TDS calculation
        let grossSalesIncludingGst = 0
        for (const order of eligibleOrders) {
          const orderTotal = toNumber((order as any).total, 0)
          grossSalesIncludingGst += orderTotal
        }

        // Calculate TDS and TCS (CRITICAL: only at settlement batch creation)
        const tdsResult = await calculateTds(sellerObjectId, grossSalesIncludingGst, toDate)
        const tcsResult = await calculateTcs(sellerObjectId, orderIdsToAttach)

        // Net off TDS and TCS reversals from calculated amounts
        const netTdsAmount = Math.max(0, tdsResult.tdsAmount - breakdown.totalTdsReversal)
        const netTcsAmount = Math.max(0, tcsResult.totalTcsAmount - breakdown.totalTcsReversal)

        // Calculate total credits (money seller earns)
        const totalCredits =
          breakdown.totalItemEarnings +
          breakdown.totalShippingEarned +
          breakdown.totalCommissionReversal +
          breakdown.totalManualAdjustmentsCredit

        // Calculate total debits (money deducted from seller)
        const totalDebits =
          totalCommissionAmount +
          totalOtherCharges +
          breakdown.totalManualAdjustmentsDebit +
          netTdsAmount +
          netTcsAmount

        // Calculate final net payout
        const totalNetPayout = totalCredits - totalDebits

        // CRITICAL VALIDATION: Ensure accounting equation holds
        // This invariant MUST be true - if not, there's a calculation bug
        const calculatedNetPayout = totalCredits - totalDebits
        const tolerance = 0.01 // Allow 1 paisa tolerance for floating point precision
        if (Math.abs(totalNetPayout - calculatedNetPayout) > tolerance) {
          await session.abortTransaction()
          session.endSession()
          const error = new Error(
            `Settlement calculation error: totalNetPayout (${totalNetPayout}) does not equal totalCredits (${totalCredits}) - totalDebits (${totalDebits}). Difference: ${Math.abs(
              totalNetPayout - calculatedNetPayout,
            )}`,
          )
          console.error('Settlement batch import calculation error:', {
            sellerId: sellerObjectId,
            totalCredits,
            totalDebits,
            calculatedNetPayout,
            totalNetPayout,
            difference: Math.abs(totalNetPayout - calculatedNetPayout),
          })
          return res.status(500).json({
            success: false,
            message: error.message,
          })
        }

        // Create batch with all calculated values
        const created = await SellerSettlementBatch.create(
          [
            {
              seller: sellerObjectId,
              fromDate,
              toDate,
              ordersCount: eligibleOrders.length,
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
              totalManualAdjustments: manualCredits - manualDebits,
              totalManualAdjustmentsCredit: breakdown.totalManualAdjustmentsCredit,
              totalManualAdjustmentsDebit: breakdown.totalManualAdjustmentsDebit,
              // TDS fields (net of reversals)
              totalTdsAmount: netTdsAmount,
              tdsRate: tdsResult.tdsRate,
              tdsBaseAmount: tdsResult.tdsBaseAmount,
              tdsExempted: tdsResult.exempted,
              tdsExemptionReason: tdsResult.exemptionReason,
              // TCS fields (net of reversals)
              totalTcsAmount: netTcsAmount,
              tcsIgstAmount: tcsResult.tcsIgstAmount,
              tcsCgstAmount: tcsResult.tcsCgstAmount,
              tcsSgstAmount: tcsResult.tcsSgstAmount,
              tcsBaseAmount: tcsResult.tcsBaseAmount,
              tcsBreakdown: tcsResult.breakdown,
            },
          ],
          { session },
        )

        const batchDoc = created[0]
        const batchId = batchDoc._id

        // Update orders
        await Order.updateMany(
          { _id: { $in: orderIdsToAttach } },
          {
            $set: {
              settlementBatch: batchId,
              settlementStatus: 'INCLUDED_IN_BATCH',
            },
          },
          { session },
        )

        // Link ledger entries to this batch
        // CRITICAL: Link entries that belong to orders in this batch AND unlinked carry-forward entries
        await SellerLedgerEntry.updateMany(
          {
            seller: sellerObjectId,
            $or: [
              // Entries linked to orders in this batch (including their reversals)
              { order: { $in: orderIdsToAttach }, settlementBatch: null },
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
        if (tdsResult.tdsAmount > 0) {
          await SellerLedgerEntry.create(
            [
              {
                seller: sellerObjectId,
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
        if (tcsResult.totalTcsAmount > 0) {
          await SellerLedgerEntry.create(
            [
              {
                seller: sellerObjectId,
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

        // CRITICAL: If batch has negative payout, create a carry-forward ledger entry
        // This ensures negative balances are automatically deducted in the next settlement batch
        // The ledger entry will be picked up as an unlinked entry (order: null, settlementBatch: null)
        if (batchDoc.totalNetPayout < 0) {
          const carryForwardAmount = Math.abs(batchDoc.totalNetPayout)
          await SellerLedgerEntry.create(
            [
              {
                seller: sellerObjectId,
                order: null, // Unlinked entry - represents seller's debt to platform
                settlementBatch: null, // Not linked to any batch - will be picked up in next batch
                entryType: 'DEBIT',
                reason: 'SETTLEMENT_CARRY_FORWARD',
                amount: carryForwardAmount,
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

        targetBatch = batchDoc
      }

      return res.json({
        success: true,
        data: targetBatch,
        meta: {
          importedOrders: eligibleOrders.length,
          skippedAlreadyInBatches: alreadyInOtherBatches,
          mode: batchId ? 'ATTACHED_TO_EXISTING_BATCH' : 'CREATED_NEW_BATCH',
          message: batchId
            ? 'Orders added to existing batch and totals recomputed from ledger.'
            : 'New settlement batch created for the seller using imported orders. Totals computed from ledger.',
        },
      })
    } catch (err) {
      await session.abortTransaction()
      session.endSession()
      throw err
    }
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error importing settlement orders:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const generateAdminSettlementInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' })
    }

    const batch = await SellerSettlementBatch.findById(id)
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' })
    }

    if (batch.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: 'Invoice can only be generated for PAID settlement batches',
      })
    }

    const updatedBatch = await generateAndAttachSettlementInvoiceToBatch(id, {
      forceRegenerate: true,
    })

    return res.json({ success: true, data: updatedBatch })
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error generating settlement invoice:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAdminSettlementInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' })
    }

    const batch = await SellerSettlementBatch.findById(id).select(
      'invoiceUrl invoiceNumber seller status totalNetPayout',
    )
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' })
    }

    return res.json({
      success: true,
      data: {
        batchId: batch._id,
        invoiceUrl: batch.invoiceUrl || null,
        invoiceNumber: batch.invoiceNumber || null,
        status: batch.status,
        totalNetPayout: batch.totalNetPayout,
      },
    })
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error fetching settlement invoice:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getSellerSettlementInvoice = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const { id } = req.params

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid batch ID' })
    }

    const batch = await SellerSettlementBatch.findOne({
      _id: id,
      seller: new mongoose.Types.ObjectId(sellerId),
    }).select('invoiceUrl invoiceNumber status totalNetPayout')

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' })
    }

    return res.json({
      success: true,
      data: {
        batchId: batch._id,
        invoiceUrl: batch.invoiceUrl || null,
        invoiceNumber: batch.invoiceNumber || null,
        status: batch.status,
        totalNetPayout: batch.totalNetPayout,
      },
    })
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error fetching seller settlement invoice:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Human-readable labels for ledger entry reasons
const getLedgerReasonLabel = (reason: string): string => {
  const labels: Record<string, string> = {
    ORDER_EARNING: 'Order Item Earnings',
    ORDER_ITEM_CREDIT: 'Order Item Earnings',
    SHIPPING_EARNING: 'Shipping Earnings',
    SHIPPING_CREDIT: 'Shipping Earnings',
    COMMISSION: 'Platform Commission',
    COMMISSION_DEBIT: 'Platform Commission',
    SHIPPING_COURIER_COST: 'Courier Forward Cost',
    SHIPPING_COST_DEBIT: 'Courier Forward Cost',
    PAYMENT_GATEWAY_FEE: 'Payment Gateway Fee',
    REFUND_ITEM: 'Refund - Item',
    REFUND_SHIPPING: 'Refund - Shipping',
    REFUND_COD: 'Refund - COD Fee',
    REFUND_GST: 'Refund - GST',
    RETURN_ITEM_REVERSAL: 'Return - Item Reversal',
    RETURN_SHIPPING_REVERSAL: 'Return - Shipping Reversal',
    COMMISSION_REVERSAL: 'Commission Reversal',
    RETURN_REVERSE_COURIER_COST: 'Return - Reverse Courier Cost',
    MANUAL_ADJUSTMENT: 'Manual Adjustment',
    SETTLEMENT_CARRY_FORWARD: 'Settlement Carry Forward',
    SETTLEMENT_PAYMENT: 'Settlement Payment',
    SETTLEMENT_PAYOUT: 'Settlement Payout',
    TDS_DEBIT: 'TDS Deduction',
    TDS_REVERSAL: 'TDS Reversal',
    TCS_DEBIT: 'TCS Deduction',
    TCS_REVERSAL: 'TCS Reversal',
    PLATFORM_REFUND_EXPENSE: 'Platform Refund Expense',
    PLATFORM_ADJUSTMENT: 'Platform Adjustment',
  }
  return labels[reason] || reason
}

// Get Seller Dashboard Overview
export const getSellerDashboardOverview = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId)

    // Get seller profile to check KYC and bank details
    const seller = await User.findById(sellerId)
      .select(
        'kycSubmitted isApproved bankAccountNumber accountHolderName bankName ifscCode createdAt',
      )
      .lean()

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' })
    }

    // Check if KYC and bank details are complete
    const isKycComplete = seller.kycSubmitted && seller.isApproved
    const isBankDetailsComplete =
      !!seller.bankAccountNumber &&
      !!seller.accountHolderName &&
      !!seller.bankName &&
      !!seller.ifscCode
    const isSettlementBlocked = !isKycComplete || !isBankDetailsComplete

    // Calculate available balance (earnings eligible for settlement)
    // Sum of CREDIT entries that don't have a settlementBatch (not yet settled)
    const availableBalanceEntries = await SellerLedgerEntry.aggregate([
      {
        $match: {
          seller: sellerObjectId,
          entryType: 'CREDIT',
          settlementBatch: null,
          reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
        },
      },
    ])

    const availableBalance =
      availableBalanceEntries.length > 0 ? availableBalanceEntries[0].total : 0

    // Get last paid settlement batch (most recent)
    const lastSettlementBatch = await SellerSettlementBatch.findOne({
      seller: sellerObjectId,
      status: 'PAID',
    })
      .sort({ payoutDate: -1, createdAt: -1 })
      .lean()

    let lastSettlement = null
    if (lastSettlementBatch) {
      lastSettlement = {
        amount: lastSettlementBatch.totalNetPayout || 0,
        paidDate: lastSettlementBatch.payoutDate
          ? new Date(lastSettlementBatch.payoutDate).toISOString()
          : lastSettlementBatch.updatedAt
          ? new Date(lastSettlementBatch.updatedAt).toISOString()
          : null,
        status: 'PAID' as const,
        batchId: lastSettlementBatch._id.toString(),
        invoiceUrl: lastSettlementBatch.invoiceUrl || null,
        invoiceNumber: lastSettlementBatch.invoiceNumber || null,
      }
    }

    // Get next pending settlement batch (upcoming)
    // Get all pending batches and find the one with the earliest future expected payout date
    const now = new Date()
    const pendingBatches = await SellerSettlementBatch.find({
      seller: sellerObjectId,
      status: 'PENDING',
    })
      .sort({ createdAt: 1 })
      .lean()

    let nextSettlementBatch = null
    let nextSettlement = null
    let upcomingSettlement = null

    // Find the first pending batch whose expected payout date is in the future
    for (const batch of pendingBatches) {
      // Calculate expected payout date (typically 7 days after batch creation or toDate)
      const expectedPayoutDate = batch.toDate
        ? new Date(new Date(batch.toDate).getTime() + 7 * 24 * 60 * 60 * 1000)
        : new Date(new Date(batch.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000)

      // Only include batches where the expected payout date is in the future
      if (expectedPayoutDate > now) {
        nextSettlementBatch = batch
        break
      }
    }

    if (nextSettlementBatch) {
      // Calculate expected payout date (typically 7 days after batch creation or toDate)
      const expectedPayoutDate = nextSettlementBatch.toDate
        ? new Date(new Date(nextSettlementBatch.toDate).getTime() + 7 * 24 * 60 * 60 * 1000)
        : new Date(new Date(nextSettlementBatch.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000)

      nextSettlement = {
        amount: nextSettlementBatch.totalNetPayout || 0,
        expectedDate: expectedPayoutDate.toISOString(),
        status: isSettlementBlocked ? 'BLOCKED' : 'SCHEDULED',
        batchId: nextSettlementBatch._id.toString(),
      }

      upcomingSettlement = {
        estimatedAmount: nextSettlementBatch.totalNetPayout || availableBalance,
        cutOffDate: nextSettlementBatch.toDate
          ? new Date(nextSettlementBatch.toDate).toISOString()
          : null,
        expectedPayoutDate: expectedPayoutDate.toISOString(),
      }
    } else {
      // If no pending batch with future expected payout date, estimate based on available balance
      const estimatedNow = new Date()
      const estimatedCutOffDate = new Date(estimatedNow.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      const estimatedPayoutDate = new Date(estimatedCutOffDate.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days after cut-off

      if (availableBalance > 0) {
        upcomingSettlement = {
          estimatedAmount: availableBalance,
          cutOffDate: estimatedCutOffDate.toISOString(),
          expectedPayoutDate: estimatedPayoutDate.toISOString(),
        }
      }
    }

    // Calculate current month gross sales and orders count
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Get orders for current month where seller has shipments
    const currentMonthOrders = await Order.aggregate([
      {
        $match: {
          'sellerShipments.seller': sellerObjectId,
          createdAt: {
            $gte: startOfMonth,
            $lte: endOfMonth,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalGrossSales: { $sum: { $ifNull: ['$sellerSaleAmount', 0] } },
          ordersCount: { $sum: 1 },
        },
      },
    ])

    const grossSales =
      currentMonthOrders.length > 0 ? currentMonthOrders[0].totalGrossSales || 0 : 0
    const ordersCount = currentMonthOrders.length > 0 ? currentMonthOrders[0].ordersCount || 0 : 0

    // Action Required Counts
    const pendingShipmentsCount = await Order.countDocuments({
      'sellerShipments.seller': sellerObjectId,
      'sellerShipments.status': { $in: ['pending', 'ready_to_ship', 'pickup_requested'] },
      'sellerShipments.shippedAt': null,
    })

    const Return = mongoose.model('Return')
    const returnsAwaitingActionCount = await Return.countDocuments({
      seller: sellerObjectId,
      status: 'REQUESTED',
    })

    const SLATracking = mongoose.model('SLATracking')
    const slaRiskCount = await SLATracking.countDocuments({
      sellerId: sellerObjectId,
      status: 'ACTIVE',
      $or: [
        { breachedAt: { $exists: true } },
        { dueTime: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) } },
      ],
    })

    const lowInventoryCount = await Product.countDocuments({
      seller: sellerObjectId,
      status: 'active',
      $or: [
        { stock: { $lt: 10 } },
        { $expr: { $lt: ['$stock', { $ifNull: ['$lowStockThreshold', 10] }] } },
      ],
    })

    const kycBankIncomplete = isSettlementBlocked ? 1 : 0

    // Seller Performance Metrics
    const totalOrdersCount = await Order.countDocuments({
      'sellerShipments.seller': sellerObjectId,
    })

    const cancelledOrdersCount = await Order.countDocuments({
      'sellerShipments.seller': sellerObjectId,
      'sellerShipments.status': 'cancelled',
    })
    const cancellationRate =
      totalOrdersCount > 0 ? (cancelledOrdersCount / totalOrdersCount) * 100 : 0

    const returnedOrderIds = await Return.distinct('order', {
      seller: sellerObjectId,
      status: 'REFUND_COMPLETED',
    })
    const returnedOrdersCount = returnedOrderIds.length
    const returnRate = totalOrdersCount > 0 ? (returnedOrdersCount / totalOrdersCount) * 100 : 0

    const totalSlaTracked = await SLATracking.countDocuments({
      sellerId: sellerObjectId,
    })
    const slaBreached = await SLATracking.countDocuments({
      sellerId: sellerObjectId,
      breachedAt: { $exists: true },
    })
    const slaCompliance =
      totalSlaTracked > 0 ? ((totalSlaTracked - slaBreached) / totalSlaTracked) * 100 : 100

    const productRatingAgg = await Product.aggregate([
      { $match: { seller: sellerObjectId, rating: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalReviews: { $sum: '$reviewCount' },
        },
      },
    ])
    const sellerRating = productRatingAgg.length > 0 ? productRatingAgg[0].avgRating || 0 : 0

    // Determine status for each metric
    const getPerformanceStatus = (
      cancellationRate: number,
      returnRate: number,
      slaCompliance: number,
      sellerRating: number,
    ) => {
      const cancellationStatus =
        cancellationRate < 5 ? 'good' : cancellationRate < 10 ? 'needs_attention' : 'at_risk'
      const returnStatus =
        returnRate < 10 ? 'good' : returnRate < 20 ? 'needs_attention' : 'at_risk'
      const slaStatus =
        slaCompliance >= 95 ? 'good' : slaCompliance >= 85 ? 'needs_attention' : 'at_risk'
      const ratingStatus =
        sellerRating >= 4.0 ? 'good' : sellerRating >= 3.0 ? 'needs_attention' : 'at_risk'

      return {
        cancellationRate: {
          value: cancellationRate,
          status: cancellationStatus,
        },
        returnRate: {
          value: returnRate,
          status: returnStatus,
        },
        slaCompliance: {
          value: slaCompliance,
          status: slaStatus,
        },
        sellerRating: {
          value: sellerRating,
          status: ratingStatus,
        },
      }
    }

    const performanceMetrics = getPerformanceStatus(
      cancellationRate,
      returnRate,
      slaCompliance,
      sellerRating,
    )

    // Orders & Returns Overview
    const ordersPending = await Order.countDocuments({
      'sellerShipments.seller': sellerObjectId,
      'sellerShipments.status': {
        $in: ['pending', 'processing', 'ready_to_ship', 'pickup_requested'],
      },
      'sellerShipments.shippedAt': null,
    })

    const ordersShipped = await Order.countDocuments({
      'sellerShipments.seller': sellerObjectId,
      'sellerShipments.status': { $in: ['shipped', 'in_transit', 'out_for_delivery'] },
    })

    const ordersDelivered = await Order.countDocuments({
      'sellerShipments.seller': sellerObjectId,
      'sellerShipments.status': 'delivered',
    })

    const returnedOrderIdsForOverview = await Return.distinct('order', {
      seller: sellerObjectId,
      status: { $in: ['REFUND_COMPLETED', 'RETURN_RECEIVED_BY_SELLER'] },
    })
    const ordersReturned = await Order.countDocuments({
      'sellerShipments.seller': sellerObjectId,
      $or: [
        { 'sellerShipments.status': 'cancelled' },
        ...(returnedOrderIdsForOverview.length > 0
          ? [{ _id: { $in: returnedOrderIdsForOverview } }]
          : []),
      ],
    })

    const returnsRequested = await Return.countDocuments({
      seller: sellerObjectId,
      status: 'REQUESTED',
    })

    const returnsApproved = await Return.countDocuments({
      seller: sellerObjectId,
      status: {
        $in: [
          'APPROVED_BY_SELLER',
          'APPROVED_BY_ADMIN',
          'REVERSE_PICKUP_CREATED',
          'REVERSE_PICKUP_IN_TRANSIT',
          'REVERSE_PICKUP_COMPLETED',
          'RETURN_RECEIVED_BY_SELLER',
          'REFUND_INITIATED',
        ],
      },
    })

    const returnsCompleted = await Return.countDocuments({
      seller: sellerObjectId,
      status: 'REFUND_COMPLETED',
    })

    // Top Selling Products (Last 7 and 30 days)
    const currentDate = new Date()
    const sevenDaysAgo = new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Helper function to get daily sales data
    const getDailySalesData = async (startDate: Date, endDate: Date) => {
      // Get order IDs that have non-cancelled shipments for this seller
      const validOrderIds = await Order.distinct('_id', {
        'sellerShipments.seller': sellerObjectId,
        'sellerShipments.status': { $ne: 'cancelled' },
        createdAt: { $gte: startDate, $lte: endDate },
      })

      if (validOrderIds.length === 0) {
        // Return empty array with all dates in range
        const dates: Array<{ date: string; sales: number; orders: number }> = []
        const current = new Date(startDate)
        while (current <= endDate) {
          dates.push({
            date: current.toISOString().split('T')[0],
            sales: 0,
            orders: 0,
          })
          current.setDate(current.getDate() + 1)
        }
        return dates
      }

      const dailyData = await Order.aggregate([
        {
          $match: {
            _id: { $in: validOrderIds },
            'items.seller': sellerObjectId,
          },
        },
        { $unwind: '$items' },
        {
          $match: {
            'items.seller': sellerObjectId,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            sales: {
              $sum: {
                $multiply: [
                  '$items.quantity',
                  { $ifNull: ['$items.effectivePrice', '$items.price'] },
                ],
              },
            },
            orders: { $addToSet: '$_id' },
          },
        },
        {
          $project: {
            date: '$_id',
            sales: { $round: ['$sales', 2] },
            orders: { $size: '$orders' },
          },
        },
        { $sort: { date: 1 } },
      ])

      // Fill in missing dates with zero values
      const dateMap = new Map(dailyData.map((d) => [d.date, d]))
      const filledData: Array<{ date: string; sales: number; orders: number }> = []
      const current = new Date(startDate)
      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0]
        filledData.push(
          dateMap.get(dateStr) || {
            date: dateStr,
            sales: 0,
            orders: 0,
          },
        )
        current.setDate(current.getDate() + 1)
      }

      return filledData
    }

    // Helper function to get top products for a date range
    const getTopProducts = async (startDate: Date) => {
      // First, get order IDs that have non-cancelled shipments for this seller
      const validOrderIds = await Order.distinct('_id', {
        'sellerShipments.seller': sellerObjectId,
        'sellerShipments.status': { $ne: 'cancelled' },
        createdAt: { $gte: startDate },
      })

      if (validOrderIds.length === 0) {
        return []
      }

      return await Order.aggregate([
        {
          $match: {
            _id: { $in: validOrderIds },
            'items.seller': sellerObjectId,
          },
        },
        { $unwind: '$items' },
        {
          $match: {
            'items.seller': sellerObjectId,
          },
        },
        {
          $group: {
            _id: '$items.product',
            unitsSold: { $sum: '$items.quantity' },
            revenue: {
              $sum: {
                $multiply: [
                  '$items.quantity',
                  { $ifNull: ['$items.effectivePrice', '$items.price'] },
                ],
              },
            },
          },
        },
        { $sort: { unitsSold: -1 } },
        { $limit: 3 },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            productId: { $toString: '$_id' },
            sku: { $ifNull: ['$product.sku', 'N/A'] },
            productName: { $ifNull: ['$product.name', 'Unknown Product'] },
            productImage: { $ifNull: [{ $arrayElemAt: ['$product.images', 0] }, null] },
            unitsSold: 1,
            revenue: { $round: ['$revenue', 2] },
          },
        },
      ])
    }

    // Get top 3 products for last 7 days and 30 days
    const [topProducts7Days, topProducts30Days] = await Promise.all([
      getTopProducts(sevenDaysAgo),
      getTopProducts(thirtyDaysAgo),
    ])

    // Helper function to get orders vs returns trend data
    const getOrdersReturnsTrendData = async (startDate: Date, endDate: Date) => {
      // Get daily orders count
      const dailyOrders = await Order.aggregate([
        {
          $match: {
            'sellerShipments.seller': sellerObjectId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            ordersCount: { $sum: 1 },
          },
        },
        {
          $project: {
            date: '$_id',
            ordersCount: 1,
          },
        },
        { $sort: { date: 1 } },
      ])

      // Get daily returns count with reasons
      const dailyReturns = await Return.aggregate([
        {
          $match: {
            seller: sellerObjectId,
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            returnsCount: { $sum: 1 },
            reasons: {
              $push: {
                reason: { $ifNull: ['$reason', 'Not specified'] },
                count: 1,
              },
            },
          },
        },
        {
          $project: {
            date: '$_id',
            returnsCount: 1,
            reasons: 1,
          },
        },
        { $sort: { date: 1 } },
      ])

      // Combine and fill missing dates
      const ordersMap = new Map(dailyOrders.map((d) => [d.date, d.ordersCount]))
      const returnsMap = new Map(
        dailyReturns.map((d) => [
          d.date,
          {
            count: d.returnsCount,
            reasons: d.reasons.reduce((acc: Record<string, number>, r: any) => {
              const reason = r.reason || 'Not specified'
              acc[reason] = (acc[reason] || 0) + 1
              return acc
            }, {}),
          },
        ]),
      )

      const filledData: Array<{
        date: string
        orders: number
        returns: number
        returnReasons?: Record<string, number>
      }> = []
      const current = new Date(startDate)
      while (current <= endDate) {
        const dateStr = current.toISOString().split('T')[0]
        const returnsData = returnsMap.get(dateStr)
        filledData.push({
          date: dateStr,
          orders: ordersMap.get(dateStr) || 0,
          returns: returnsData?.count || 0,
          returnReasons: returnsData?.reasons,
        })
        current.setDate(current.getDate() + 1)
      }

      return filledData
    }

    // Helper function to get return reasons breakdown
    const getReturnReasonsBreakdown = async (sellerObjId: mongoose.Types.ObjectId) => {
      // Check if seller is new (created less than 30 days ago or has less than 10 orders)
      const sellerCreatedAt = seller?.createdAt ? new Date(seller.createdAt) : new Date()
      const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000)
      const isNewSeller = sellerCreatedAt > thirtyDaysAgo

      // Get total returns count
      const totalReturns = await Return.countDocuments({
        seller: sellerObjId,
      })

      // Threshold: Only show if returns > 5
      const threshold = 5
      if (isNewSeller || totalReturns <= threshold) {
        return null
      }

      // Get top 5 return reasons
      const reasonsBreakdown = await Return.aggregate([
        {
          $match: {
            seller: sellerObjId,
            $and: [
              { reason: { $exists: true } },
              { reason: { $ne: null } },
              { reason: { $ne: '' } },
            ],
          },
        },
        {
          $group: {
            _id: '$reason',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            reason: '$_id',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])

      // Calculate percentages
      const totalWithReasons = reasonsBreakdown.reduce((sum, r) => sum + r.count, 0)
      const breakdown = reasonsBreakdown.map((r) => ({
        reason: r.reason || 'Not specified',
        count: r.count,
        percentage: totalWithReasons > 0 ? (r.count / totalWithReasons) * 100 : 0,
      }))

      return {
        totalReturns,
        breakdown,
      }
    }

    // Helper function to get inventory velocity (fastest-selling SKUs)
    const getInventoryVelocity = async (
      sellerObjId: mongoose.Types.ObjectId,
      startDate: Date,
      endDate: Date,
    ) => {
      // Calculate number of days in the period
      const daysInPeriod = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      const daysForCalculation = daysInPeriod > 0 ? daysInPeriod : 30 // Default to 30 days if calculation fails

      // Get order IDs that have non-cancelled shipments for this seller in the period
      const validOrderIds = await Order.distinct('_id', {
        'sellerShipments.seller': sellerObjId,
        'sellerShipments.status': { $ne: 'cancelled' },
        createdAt: { $gte: startDate, $lte: endDate },
      })

      if (validOrderIds.length === 0) {
        return []
      }

      // Aggregate units sold per product/SKU
      const velocityData = await Order.aggregate([
        {
          $match: {
            _id: { $in: validOrderIds },
            'items.seller': sellerObjId,
          },
        },
        { $unwind: '$items' },
        {
          $match: {
            'items.seller': sellerObjId,
          },
        },
        {
          $group: {
            _id: '$items.product',
            totalUnitsSold: { $sum: '$items.quantity' },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            productId: { $toString: '$_id' },
            sku: { $ifNull: ['$product.sku', 'N/A'] },
            productName: { $ifNull: ['$product.name', 'Unknown Product'] },
            totalUnitsSold: 1,
            unitsPerDay: {
              $round: [{ $divide: ['$totalUnitsSold', daysForCalculation] }, 2],
            },
          },
        },
        { $sort: { unitsPerDay: -1 } },
        { $limit: 5 },
      ])

      return velocityData
    }

    return res.json({
      success: true,
      data: {
        availableBalance,
        nextSettlement,
        lastSettlement,
        upcomingSettlement,
        grossSales,
        ordersCount,
        isSettlementBlocked,
        blockingReasons: isSettlementBlocked
          ? [
              ...(!isKycComplete ? ['KYC not completed or not approved'] : []),
              ...(!isBankDetailsComplete ? ['Bank details incomplete'] : []),
            ]
          : [],
        actionRequired: {
          pendingShipments: pendingShipmentsCount,
          returnsAwaitingAction: returnsAwaitingActionCount,
          slaRiskOrders: slaRiskCount,
          lowInventorySkus: lowInventoryCount,
          kycBankIncomplete,
        },
        ordersOverview: {
          pending: ordersPending,
          shipped: ordersShipped,
          delivered: ordersDelivered,
          returned: ordersReturned,
        },
        returnsOverview: {
          requested: returnsRequested,
          approved: returnsApproved,
          completed: returnsCompleted,
        },
        performance: performanceMetrics,
        topSellingProducts: {
          last7Days: topProducts7Days,
          last30Days: topProducts30Days,
        },
        salesTrend: {
          last7Days: await getDailySalesData(sevenDaysAgo, currentDate),
          last30Days: await getDailySalesData(thirtyDaysAgo, currentDate),
        },
        ordersReturnsTrend: await getOrdersReturnsTrendData(thirtyDaysAgo, currentDate),
        returnReasonsBreakdown: await getReturnReasonsBreakdown(sellerObjectId),
        inventoryVelocity: await getInventoryVelocity(sellerObjectId, thirtyDaysAgo, currentDate),
      },
    })
  } catch (error: any) {
    console.error('Error fetching seller dashboard overview:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getSellerLedgerForSeller = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId)

    // Fetch all ledger entries for this seller, excluding platform-only entries
    // Platform entries have seller: null or reason in (PLATFORM_REFUND_EXPENSE, PLATFORM_ADJUSTMENT)
    const allEntries = await SellerLedgerEntry.find({
      seller: sellerObjectId,
      reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
    })
      .sort({ createdAt: 1 })
      .populate('order', 'orderNumber')
      .populate('settlementBatch', 'fromDate toDate status')
      .lean()

    // Opening balance is 0 (starting balance for the seller)
    // In the future, this could be calculated from previous periods
    const openingBalance = 0

    // Fetch credit/debit notes for entries that have referenceId
    // Group entries by referenceId to batch fetch
    const referenceIds = allEntries
      .filter((e: any) => e.referenceId)
      .map((e: any) => e.referenceId)
      .filter((id, index, self) => self.indexOf(id) === index) // unique

    // Fetch Refunds and Returns that might have credit notes
    const Refund = mongoose.model('Refund')
    const Return = mongoose.model('Return')
    const refundsMap = new Map()
    const returnsMap = new Map()

    if (referenceIds.length > 0) {
      const [refunds, returns] = await Promise.all([
        Refund.find({ _id: { $in: referenceIds } })
          .select('_id creditNote')
          .lean(),
        Return.find({ _id: { $in: referenceIds } })
          .select('_id creditNote')
          .lean(),
      ])

      refunds.forEach((refund: any) => {
        refundsMap.set(String(refund._id), refund.creditNote || null)
      })

      returns.forEach((ret: any) => {
        returnsMap.set(String(ret._id), ret.creditNote || null)
      })
    }

    // Calculate running balance sequentially from opening balance
    // Entries are sorted by createdAt ASC (oldest first)
    let runningBalance = openingBalance
    const entriesWithBalance = allEntries.map((entry: any) => {
      const amount = Number(entry.amount) || 0
      if (entry.entryType === 'CREDIT') {
        runningBalance += amount
      } else if (entry.entryType === 'DEBIT') {
        runningBalance -= amount
      }

      // Check for credit note (for refunds/returns) or debit note (for adjustments/penalties)
      let creditNote = null
      let debitNote = null

      if (entry.referenceId) {
        const refIdStr = String(entry.referenceId)
        // Check if it's a refund with credit note
        if (refundsMap.has(refIdStr)) {
          creditNote = refundsMap.get(refIdStr)
        }
        // Check if it's a return with credit note
        if (returnsMap.has(refIdStr)) {
          creditNote = returnsMap.get(refIdStr)
        }
      }

      // Check for debit note (stored directly in ledger entry)
      const entryDebitNote = (entry as any).debitNote
      if (entryDebitNote && entryDebitNote.debit_note_url) {
        debitNote = entryDebitNote
      }

      return {
        _id: entry._id,
        order: entry.order
          ? {
              _id: entry.order._id,
              orderNumber: (entry.order as any).orderNumber,
            }
          : null,
        settlementBatch: entry.settlementBatch
          ? {
              _id: entry.settlementBatch._id,
              fromDate: (entry.settlementBatch as any).fromDate,
              toDate: (entry.settlementBatch as any).toDate,
              status: (entry.settlementBatch as any).status,
            }
          : null,
        entryType: entry.entryType,
        reason: entry.reason,
        reasonLabel: getLedgerReasonLabel(entry.reason),
        amount: amount,
        description: entry.description || null,
        createdAt: entry.createdAt,
        runningBalance,
        creditNote: creditNote
          ? {
              credit_note_id: creditNote.credit_note_id || null,
              credit_note_url: creditNote.credit_note_url || null,
              credit_note_number: creditNote.credit_note_number || null,
              generated_at: creditNote.generated_at || null,
            }
          : null,
        debitNote: debitNote
          ? {
              debit_note_id: debitNote.debit_note_id || null,
              debit_note_url: debitNote.debit_note_url || null,
              debit_note_number: debitNote.debit_note_number || null,
              generated_at: debitNote.generated_at || null,
            }
          : null,
      }
    })

    // Calculate closing balance: Opening Balance + (sum of all CREDITS - sum of all DEBITS)
    const totalCredits = entriesWithBalance.reduce(
      (sum, entry) => sum + (entry.entryType === 'CREDIT' ? entry.amount : 0),
      0,
    )
    const totalDebits = entriesWithBalance.reduce(
      (sum, entry) => sum + (entry.entryType === 'DEBIT' ? entry.amount : 0),
      0,
    )
    const calculatedClosingBalance = openingBalance + totalCredits - totalDebits

    // Validation: Ensure calculated closing balance matches running balance
    if (Math.abs(calculatedClosingBalance - runningBalance) > 0.01) {
      console.error(
        `Ledger balance mismatch for seller ${sellerId}: calculated=${calculatedClosingBalance}, running=${runningBalance}`,
      )
      return res.status(500).json({
        success: false,
        message: 'Ledger balance calculation error. Please contact support.',
      })
    }

    const closingBalance = runningBalance

    // Get recent entries (last 100) for display
    // Since entries are in chronological order (ASC), we take the last 100 and reverse for display (DESC)
    const recentEntries = entriesWithBalance.slice(-100).reverse()

    // Calculate opening balance for the displayed entries
    // If showing all entries, opening balance is 0
    // If showing only recent entries, opening balance is the running balance before the first displayed entry
    const displayOpeningBalance =
      entriesWithBalance.length > 100
        ? entriesWithBalance[entriesWithBalance.length - 100].runningBalance -
          (entriesWithBalance[entriesWithBalance.length - 100].entryType === 'CREDIT'
            ? entriesWithBalance[entriesWithBalance.length - 100].amount
            : -entriesWithBalance[entriesWithBalance.length - 100].amount)
        : openingBalance

    return res.json({
      success: true,
      data: {
        entries: recentEntries,
        openingBalance: displayOpeningBalance,
        closingBalance,
        totalEntries: entriesWithBalance.length,
      },
    })
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('Error fetching seller ledger:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Get all credit notes for seller
export const getSellerCreditNotes = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId

    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    const sellerObjectId = new mongoose.Types.ObjectId(sellerId)

    // Fetch all ledger entries for this seller (excluding platform-only entries)
    const allEntries = await SellerLedgerEntry.find({
      seller: sellerObjectId,
      reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
    })
      .sort({ createdAt: 1 })
      .populate('order', 'orderNumber')
      .populate('settlementBatch', 'fromDate toDate status invoiceNumber')
      .lean()

    // Fetch credit notes from Refund/Return documents (for entries with referenceId)
    const referenceIds = allEntries
      .filter((e: any) => e.referenceId)
      .map((e: any) => e.referenceId)
      .filter((id, index, self) => self.indexOf(id) === index) // unique

    const Refund = mongoose.model('Refund')
    const Return = mongoose.model('Return')
    const refundsMap = new Map()
    const returnsMap = new Map()

    if (referenceIds.length > 0) {
      const [refunds, returns] = await Promise.all([
        Refund.find({ _id: { $in: referenceIds } })
          .select('_id creditNote')
          .lean(),
        Return.find({ _id: { $in: referenceIds } })
          .select('_id creditNote')
          .lean(),
      ])

      refunds.forEach((refund: any) => {
        refundsMap.set(String(refund._id), refund.creditNote || null)
      })

      returns.forEach((ret: any) => {
        returnsMap.set(String(ret._id), ret.creditNote || null)
      })
    }

    // Collect all credit notes (from direct storage OR from Refund/Return documents)
    const creditNoteEntries: Array<{
      entry: any
      creditNote: any
    }> = []

    allEntries.forEach((entry: any) => {
      let creditNote = null

      // Check if credit note is directly stored in ledger entry
      if (entry.creditNote?.credit_note_url) {
        creditNote = entry.creditNote
      }
      // Check if credit note is in Refund/Return document (via referenceId)
      else if (entry.referenceId) {
        const refIdStr = String(entry.referenceId)
        if (refundsMap.has(refIdStr)) {
          creditNote = refundsMap.get(refIdStr)
        }
        if (returnsMap.has(refIdStr) && !creditNote) {
          creditNote = returnsMap.get(refIdStr)
        }
      }

      if (creditNote?.credit_note_url) {
        creditNoteEntries.push({ entry, creditNote })
      }
    })

    // Sort by credit note generation date (newest first)
    creditNoteEntries.sort((a, b) => {
      const dateA = new Date(a.creditNote.generated_at || a.entry.createdAt).getTime()
      const dateB = new Date(b.creditNote.generated_at || b.entry.createdAt).getTime()
      return dateB - dateA
    })

    // Transform to credit note format
    const creditNotes = creditNoteEntries.map(({ entry, creditNote }) => {
      // Determine reason label
      let reasonLabel = getLedgerReasonLabel(entry.reason)
      if (entry.reason === 'COMMISSION_REVERSAL') {
        reasonLabel = 'Commission Reversal'
      } else if (entry.reason === 'MANUAL_ADJUSTMENT' && entry.entryType === 'CREDIT') {
        reasonLabel = 'Adjustment'
      }

      // Get reference invoice (settlement invoice)
      let referenceInvoice: string | null = null
      if (entry.settlementBatch?.invoiceNumber) {
        referenceInvoice = entry.settlementBatch.invoiceNumber
      }

      // Extract tax breakup from HSN summary if available
      let taxBreakup: {
        hsnSacCode?: string
        gstRatePercent?: number
        taxableValue?: number
        igst?: number
        cgst?: number
        sgst?: number
      } | null = null

      if (creditNote.hsnSummary && Array.isArray(creditNote.hsnSummary)) {
        const summary = creditNote.hsnSummary[0] // Use first HSN entry
        if (summary) {
          taxBreakup = {
            hsnSacCode: summary.hsnSacCode,
            gstRatePercent: summary.gstRatePercent,
            taxableValue: summary.taxableValueTotal,
            igst: summary.igstAmountTotal,
            cgst: summary.cgstAmountTotal,
            sgst: summary.sgstAmountTotal,
          }
        }
      }

      return {
        _id: entry._id,
        creditNoteNumber: creditNote.credit_note_number,
        issueDate: creditNote.generated_at || entry.createdAt,
        reason: reasonLabel,
        referenceInvoice,
        amount: entry.amount,
        taxBreakup,
        creditNoteUrl: creditNote.credit_note_url,
        order: entry.order
          ? {
              _id: entry.order._id,
              orderNumber: entry.order.orderNumber,
            }
          : null,
        settlementBatch: entry.settlementBatch
          ? {
              _id: entry.settlementBatch._id,
              fromDate: entry.settlementBatch.fromDate,
              toDate: entry.settlementBatch.toDate,
              status: entry.settlementBatch.status,
              invoiceNumber: entry.settlementBatch.invoiceNumber,
            }
          : null,
        description: entry.description,
      }
    })

    return res.json({
      success: true,
      data: {
        creditNotes,
        total: creditNotes.length,
      },
    })
  } catch (error: any) {
    console.error('Error fetching seller credit notes:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Get all credit notes (Admin) - can filter by seller
export const getAdminCreditNotes = async (req: Request, res: Response) => {
  try {
    const {
      sellerId,
      page = 1,
      limit = 50,
    } = req.query as {
      sellerId?: string
      page?: string
      limit?: string
    }

    const pageNum = Number(page)
    const limitNum = Number(limit)

    // Build query for ledger entries
    const query: any = {
      reason: { $nin: ['PLATFORM_REFUND_EXPENSE', 'PLATFORM_ADJUSTMENT'] },
    }

    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      query.seller = new mongoose.Types.ObjectId(sellerId)
    }

    // Fetch all relevant ledger entries (we'll check for credit notes in multiple places)
    const allEntries = await SellerLedgerEntry.find(query)
      .sort({ createdAt: 1 })
      .populate('seller', 'name businessName gstNumber')
      .populate('order', 'orderNumber')
      .populate('settlementBatch', 'fromDate toDate status invoiceNumber')
      .lean()

    // Fetch credit notes from Refund/Return documents (for entries with referenceId)
    const referenceIds = allEntries
      .filter((e: any) => e.referenceId)
      .map((e: any) => e.referenceId)
      .filter((id, index, self) => self.indexOf(id) === index) // unique

    const Refund = mongoose.model('Refund')
    const Return = mongoose.model('Return')
    const refundsMap = new Map()
    const returnsMap = new Map()

    if (referenceIds.length > 0) {
      const [refunds, returns] = await Promise.all([
        Refund.find({ _id: { $in: referenceIds } })
          .select('_id creditNote')
          .lean(),
        Return.find({ _id: { $in: referenceIds } })
          .select('_id creditNote')
          .lean(),
      ])

      refunds.forEach((refund: any) => {
        refundsMap.set(String(refund._id), refund.creditNote || null)
      })

      returns.forEach((ret: any) => {
        returnsMap.set(String(ret._id), ret.creditNote || null)
      })
    }

    // Collect all credit notes (from direct storage OR from Refund/Return documents)
    const creditNoteEntries: Array<{
      entry: any
      creditNote: any
    }> = []

    allEntries.forEach((entry: any) => {
      let creditNote = null

      // Check if credit note is directly stored in ledger entry
      if (entry.creditNote?.credit_note_url) {
        creditNote = entry.creditNote
      }
      // Check if credit note is in Refund/Return document (via referenceId)
      else if (entry.referenceId) {
        const refIdStr = String(entry.referenceId)
        if (refundsMap.has(refIdStr)) {
          creditNote = refundsMap.get(refIdStr)
        }
        if (returnsMap.has(refIdStr) && !creditNote) {
          creditNote = returnsMap.get(refIdStr)
        }
      }

      if (creditNote?.credit_note_url) {
        creditNoteEntries.push({ entry, creditNote })
      }
    })

    // Sort by credit note generation date (newest first)
    creditNoteEntries.sort((a, b) => {
      const dateA = new Date(a.creditNote.generated_at || a.entry.createdAt).getTime()
      const dateB = new Date(b.creditNote.generated_at || b.entry.createdAt).getTime()
      return dateB - dateA
    })

    // Apply pagination
    const total = creditNoteEntries.length
    const paginatedEntries = creditNoteEntries.slice((pageNum - 1) * limitNum, pageNum * limitNum)

    // Transform to credit note format
    const creditNotes = paginatedEntries
      .map(({ entry, creditNote }) => {
        // Determine reason label
        let reasonLabel = getLedgerReasonLabel(entry.reason)
        if (entry.reason === 'COMMISSION_REVERSAL') {
          reasonLabel = 'Commission Reversal'
        } else if (entry.reason === 'MANUAL_ADJUSTMENT' && entry.entryType === 'CREDIT') {
          reasonLabel = 'Adjustment'
        }

        // Get reference invoice (settlement invoice)
        let referenceInvoice: string | null = null
        if (entry.settlementBatch?.invoiceNumber) {
          referenceInvoice = entry.settlementBatch.invoiceNumber
        }

        // Extract tax breakup from HSN summary if available
        let taxBreakup: {
          hsnSacCode?: string
          gstRatePercent?: number
          taxableValue?: number
          igst?: number
          cgst?: number
          sgst?: number
        } | null = null

        if (creditNote.hsnSummary && Array.isArray(creditNote.hsnSummary)) {
          const summary = creditNote.hsnSummary[0] // Use first HSN entry
          if (summary) {
            taxBreakup = {
              hsnSacCode: summary.hsnSacCode,
              gstRatePercent: summary.gstRatePercent,
              taxableValue: summary.taxableValueTotal,
              igst: summary.igstAmountTotal,
              cgst: summary.cgstAmountTotal,
              sgst: summary.sgstAmountTotal,
            }
          }
        }

        return {
          _id: entry._id,
          seller: entry.seller
            ? {
                _id: entry.seller._id,
                name: entry.seller.name,
                businessName: entry.seller.businessName,
                gstNumber: entry.seller.gstNumber,
              }
            : null,
          creditNoteNumber: creditNote.credit_note_number,
          issueDate: creditNote.generated_at || entry.createdAt,
          reason: reasonLabel,
          referenceInvoice,
          amount: entry.amount,
          taxBreakup,
          creditNoteUrl: creditNote.credit_note_url,
          order: entry.order
            ? {
                _id: entry.order._id,
                orderNumber: entry.order.orderNumber,
              }
            : null,
          settlementBatch: entry.settlementBatch
            ? {
                _id: entry.settlementBatch._id,
                fromDate: entry.settlementBatch.fromDate,
                toDate: entry.settlementBatch.toDate,
                status: entry.settlementBatch.status,
                invoiceNumber: entry.settlementBatch.invoiceNumber,
              }
            : null,
          description: entry.description,
        }
      })
      .filter((cn: any) => cn !== null)

    return res.json({
      success: true,
      data: {
        creditNotes,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    })
  } catch (error: any) {
    console.error('Error fetching admin credit notes:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Settlement Report (Seller) - Order-level details from settlement batches
export const getSettlementReport = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const isAdmin = req.user?.role === 'super-admin'
    const {
      sellerId: querySellerId,
      fromDate,
      toDate,
      financialYear,
      status,
      format = 'json',
    } = req.query as {
      sellerId?: string
      fromDate?: string
      toDate?: string
      financialYear?: string
      status?: 'PAID' | 'PENDING' | 'ALL'
      format?: 'json' | 'excel' | 'pdf'
    }

    // Sellers can only view their own data
    const targetSellerId = isAdmin && querySellerId ? querySellerId : sellerId

    if (!targetSellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!mongoose.Types.ObjectId.isValid(targetSellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' })
    }

    const query: any = {
      seller: new mongoose.Types.ObjectId(targetSellerId),
    }

    // Filter by settlement status
    if (status === 'PAID' || !status) {
      query.status = 'PAID' // Default: Only include paid settlements
    } else if (status === 'PENDING') {
      query.status = 'PENDING'
    }
    // If status === 'ALL', no status filter is applied

    // Filter by date range or financial year
    if (financialYear) {
      const year = parseInt(financialYear.split('-')[0])
      const fyStart = new Date(year, 3, 1) // April 1
      const fyEnd = new Date(year + 1, 2, 31) // March 31
      query.payoutDate = { $gte: fyStart, $lte: fyEnd }
    } else if (fromDate || toDate) {
      query.payoutDate = {}
      if (fromDate) query.payoutDate.$gte = new Date(fromDate)
      if (toDate) query.payoutDate.$lte = new Date(toDate)
    }

    // Get all paid settlement batches for this seller
    const batches = await SellerSettlementBatch.find(query).sort({ payoutDate: -1 }).lean()

    // Get all orders from these batches
    const batchIds = batches.map((b: any) => b._id)
    const orders = await Order.find({
      settlementBatch: { $in: batchIds },
      sellerShipments: {
        $elemMatch: { seller: new mongoose.Types.ObjectId(targetSellerId) },
      },
    })
      .select(
        'orderNumber createdAt subtotal tax total sellerSaleAmount sellerCommissionAmount sellerShippingEarning sellerCourierCost sellerCodFee sellerPgFee sellerNetAmount settlementBatch invoice',
      )
      .populate('invoice', 'invoice_number invoice_date')
      .lean()

    // Get seller details
    const seller = await User.findById(targetSellerId)
      .select('name businessName gstNumber panNumber')
      .lean()

    // Create a map of batch ID to batch details for quick lookup
    const batchMap = new Map()
    batches.forEach((batch: any) => {
      batchMap.set(String(batch._id), batch)
    })

    // Calculate total sales per batch for proportional allocation of TDS/TCS
    const batchSalesMap = new Map<string, number>()
    orders.forEach((order: any) => {
      const batchId = String(order.settlementBatch)
      const salesAmount = order.sellerSaleAmount || order.subtotal || 0
      batchSalesMap.set(batchId, (batchSalesMap.get(batchId) || 0) + salesAmount)
    })

    // CRITICAL: Reports use settlement batch data (single source of truth)
    // Reports do NOT recompute values from orders - they use stored settlement values
    const report = orders.map((order: any) => {
      const batch = batchMap.get(String(order.settlementBatch))
      const invoice = (order.invoice as any) || {}

      // Calculate GST amount from order
      const gstAmount = order.tax || 0
      const salesAmount = order.sellerSaleAmount || order.subtotal || 0
      const total = salesAmount + gstAmount

      // Get charges from order or batch
      const commission = order.sellerCommissionAmount || batch?.totalCommissionAmount || 0
      const courierForward = order.sellerCourierCost || 0
      const courierReturn = 0 // This would need to be calculated from returns
      const codFeeForward = order.sellerCodFee || 0
      const codFeeReverse = 0 // This would need to be calculated from returns
      const otherCharges =
        (order.sellerPgFee || 0) +
        (batch?.totalReturnItemReversal || 0) +
        (batch?.totalReturnShippingReversal || 0) +
        (batch?.totalReverseCourierCost || 0) -
        (batch?.totalCommissionReversal || 0) +
        (batch?.totalManualAdjustments || 0)

      // TDS and TCS from batch - allocate proportionally based on order's sales amount
      // TDS and TCS are batch-level charges, so we need to allocate them proportionally
      const batchTotalSales = batchSalesMap.get(String(order.settlementBatch)) || 1
      const orderProportion = batchTotalSales > 0 ? salesAmount / batchTotalSales : 0
      const tdsAmount = batch?.totalTdsAmount ? batch.totalTdsAmount * orderProportion : 0
      const tcsAmount = batch?.totalTcsAmount ? batch.totalTcsAmount * orderProportion : 0

      // Net settlement payable
      const netSettlement =
        salesAmount +
        (order.sellerShippingEarning || 0) -
        commission -
        courierForward -
        codFeeForward -
        (order.sellerPgFee || 0) -
        tdsAmount -
        tcsAmount

      return {
        orderId: order._id,
        orderNumber: order.orderNumber || `ORD-${String(order._id).slice(-8)}`,
        invoiceNumber: invoice.invoice_number || null,
        invoiceDate: invoice.invoice_date || null,
        salesAmount,
        gstAmount,
        total,
        commission,
        marketingFees: 0, // Not currently tracked separately
        courierChargesForward: courierForward,
        courierChargesReturn: courierReturn,
        codFeesForward: codFeeForward,
        codFeesReverse: codFeeReverse,
        otherCharges,
        tdsAmount,
        tcsAmount,
        netSettlementPayable: netSettlement,
        settlementBatchId: order.settlementBatch,
        settlementBatchFromDate: batch?.fromDate || null,
        settlementBatchToDate: batch?.toDate || null,
        payoutDate: batch?.payoutDate || null,
      }
    })

    // Include negative rows for returns/refunds
    // Get ledger entries for refunds/returns that are linked to orders in these batches
    const refundLedgerEntries = await SellerLedgerEntry.find({
      seller: new mongoose.Types.ObjectId(targetSellerId),
      order: { $in: orders.map((o: any) => o._id) },
      reason: {
        $in: [
          'REFUND_ITEM',
          'REFUND_SHIPPING',
          'REFUND_COD',
          'REFUND_GST',
          'RETURN_ITEM_REVERSAL',
          'RETURN_SHIPPING_REVERSAL',
          'RETURN_REVERSE_COURIER_COST',
          'COD_FEE_REVERSAL',
        ],
      },
    })
      .populate('order', 'orderNumber')
      .lean()

    const negativeRows = refundLedgerEntries.map((entry: any) => {
      const order = entry.order as any
      const batch = batchMap.get(String(entry.settlementBatch))

      return {
        orderId: entry.order ? String(entry.order) : null,
        orderNumber: order?.orderNumber || null,
        invoiceNumber: null,
        invoiceDate: null,
        salesAmount: -(entry.amount || 0), // Negative
        gstAmount: 0,
        total: -(entry.amount || 0),
        commission: 0,
        marketingFees: 0,
        courierChargesForward: 0,
        courierChargesReturn: entry.reason === 'RETURN_REVERSE_COURIER_COST' ? entry.amount : 0,
        codFeesForward: 0,
        codFeesReverse: entry.reason === 'COD_FEE_REVERSAL' ? entry.amount : 0,
        otherCharges: 0,
        tdsAmount: 0,
        tcsAmount: 0,
        netSettlementPayable: -(entry.amount || 0),
        settlementBatchId: entry.settlementBatch,
        settlementBatchFromDate: batch?.fromDate || null,
        settlementBatchToDate: batch?.toDate || null,
        payoutDate: batch?.payoutDate || null,
        isReturn: true,
      }
    })

    const allReportRows = [...report, ...negativeRows]

    const summary = {
      totalOrders: report.length,
      totalReturns: negativeRows.length,
      totalSalesAmount: allReportRows.reduce((sum, r) => sum + r.salesAmount, 0),
      totalGstAmount: allReportRows.reduce((sum, r) => sum + r.gstAmount, 0),
      totalAmount: allReportRows.reduce((sum, r) => sum + r.total, 0),
      totalCommission: allReportRows.reduce((sum, r) => sum + r.commission, 0),
      totalTdsAmount: allReportRows.reduce((sum, r) => sum + r.tdsAmount, 0),
      totalTcsAmount: allReportRows.reduce((sum, r) => sum + r.tcsAmount, 0),
      totalNetSettlementPayable: allReportRows.reduce((sum, r) => sum + r.netSettlementPayable, 0),
    }

    const sellerInfo = seller
      ? {
          name: seller.name,
          businessName: seller.businessName,
          gstNumber: seller.gstNumber,
          panNumber: seller.panNumber,
        }
      : null

    // Handle export formats
    if (format === 'excel') {
      const { exportSettlementReportToExcel } = await import('../utils/reportExporter')
      const buffer = await exportSettlementReportToExcel(
        allReportRows,
        summary,
        sellerInfo,
        'settlement-report',
      )
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="settlement-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
      )
      return res.send(buffer)
    }

    if (format === 'pdf') {
      const { exportReportToPDF } = await import('../utils/reportExporter')
      const buffer = await exportReportToPDF(
        allReportRows,
        summary,
        sellerInfo,
        'settlement',
        'settlement-report',
      )
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="settlement-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      )
      return res.send(buffer)
    }

    // Default: JSON response
    return res.json({
      success: true,
      data: {
        seller: sellerInfo,
        report: allReportRows,
        summary,
      },
    })
  } catch (error: any) {
    console.error('Error fetching settlement report:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// TDS Report (Admin & Seller)
export const getTdsReport = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const isAdmin = req.user?.role === 'super-admin'
    const {
      sellerId: querySellerId,
      fromDate,
      toDate,
      financialYear,
      format = 'json',
    } = req.query as {
      sellerId?: string
      fromDate?: string
      toDate?: string
      financialYear?: string
      format?: 'json' | 'excel' | 'pdf'
    }

    // Sellers can only view their own data
    const targetSellerId = isAdmin && querySellerId ? querySellerId : sellerId

    if (!targetSellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!mongoose.Types.ObjectId.isValid(targetSellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' })
    }

    const query: any = {
      seller: new mongoose.Types.ObjectId(targetSellerId),
      status: 'PAID', // Only include paid settlements
    }

    // Filter by date range or financial year
    if (financialYear) {
      // Financial year format: "2024-25" or "2024"
      const year = parseInt(financialYear.split('-')[0])
      const fyStart = new Date(year, 3, 1) // April 1
      const fyEnd = new Date(year + 1, 2, 31) // March 31
      query.payoutDate = { $gte: fyStart, $lte: fyEnd }
    } else if (fromDate || toDate) {
      query.payoutDate = {}
      if (fromDate) query.payoutDate.$gte = new Date(fromDate)
      if (toDate) query.payoutDate.$lte = new Date(toDate)
    }

    const batches = await SellerSettlementBatch.find(query)
      .populate('seller', 'name businessName panNumber gstNumber')
      .sort({ payoutDate: -1 })
      .lean()

    // Get seller details
    const seller = await User.findById(targetSellerId)
      .select('name businessName panNumber gstNumber')
      .lean()

    // CRITICAL: Reports use settlement batch data (single source of truth)
    // Reports do NOT recompute values from orders - they use stored settlement values
    // This ensures accuracy and immutability
    const report = batches.map((batch: any) => ({
      settlementBatchId: batch._id,
      fromDate: batch.fromDate,
      toDate: batch.toDate,
      payoutDate: batch.payoutDate,
      sellerTradeName: (batch.seller as any)?.businessName || (batch.seller as any)?.name,
      sellerGstin: (batch.seller as any)?.gstNumber,
      sellerPan: (batch.seller as any)?.panNumber,
      totalSalesInclGst: batch.tdsBaseAmount || batch.totalSaleAmount || 0,
      tdsAmount: batch.totalTdsAmount || 0,
      tdsRate: batch.tdsRate || 0.1,
      tdsExempted: batch.tdsExempted || false,
      tdsExemptionReason: batch.tdsExemptionReason,
    }))

    // Include negative entries for returns/refunds (from TDS_REVERSAL ledger entries)
    // These represent adjustments in future settlements
    const reversalEntries = await SellerLedgerEntry.find({
      seller: new mongoose.Types.ObjectId(targetSellerId),
      reason: 'TDS_REVERSAL',
      settlementBatch: null, // Unlinked reversals (will be in next settlement)
    })
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .lean()

    const negativeEntries = reversalEntries.map((entry: any) => ({
      settlementBatchId: null, // Not yet in a settlement
      fromDate: null,
      toDate: null,
      payoutDate: null,
      sellerTradeName: seller?.businessName || seller?.name,
      sellerGstin: seller?.gstNumber,
      sellerPan: seller?.panNumber,
      totalSalesInclGst: 0,
      tdsAmount: -(entry.amount || 0), // Negative amount
      tdsRate: 0.1,
      tdsExempted: false,
      tdsExemptionReason: 'TDS reversal for return/refund - will be adjusted in next settlement',
      orderNumber: (entry.order as any)?.orderNumber,
      orderId: entry.order ? String(entry.order) : null,
      isReversal: true,
    }))

    // Combine regular entries with negative reversal entries
    const allReportEntries = [...report, ...negativeEntries]

    const summary = {
      totalBatches: batches.length,
      totalSalesInclGst: allReportEntries.reduce((sum, r) => sum + r.totalSalesInclGst, 0),
      totalTdsAmount: allReportEntries.reduce((sum, r) => sum + r.tdsAmount, 0),
      exemptedBatches: report.filter((r) => r.tdsExempted).length,
      pendingReversals: negativeEntries.length,
    }

    const sellerInfo = seller
      ? {
          name: seller.name,
          businessName: seller.businessName,
          panNumber: seller.panNumber,
          gstNumber: seller.gstNumber,
        }
      : null

    // Handle export formats
    if (format === 'excel') {
      const { exportTdsReportToExcel } = await import('../utils/reportExporter')
      const buffer = await exportTdsReportToExcel(
        allReportEntries,
        summary,
        sellerInfo,
        'tds-report',
      )
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="tds-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
      )
      return res.send(buffer)
    }

    if (format === 'pdf') {
      const { exportReportToPDF } = await import('../utils/reportExporter')
      const buffer = await exportReportToPDF(
        allReportEntries,
        summary,
        sellerInfo,
        'tds',
        'tds-report',
      )
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="tds-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      )
      return res.send(buffer)
    }

    // Default: JSON response
    return res.json({
      success: true,
      data: {
        seller: sellerInfo,
        report: allReportEntries,
        summary,
      },
    })
  } catch (error: any) {
    console.error('Error fetching TDS report:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// TCS Report (Admin & Seller)
export const getTcsReport = async (req: Request, res: Response) => {
  try {
    const sellerId = req.user?.userId
    const isAdmin = req.user?.role === 'super-admin'
    const {
      sellerId: querySellerId,
      fromDate,
      toDate,
      financialYear,
      format = 'json',
    } = req.query as {
      sellerId?: string
      fromDate?: string
      toDate?: string
      financialYear?: string
      format?: 'json' | 'excel' | 'pdf'
    }

    // Sellers can only view their own data
    const targetSellerId = isAdmin && querySellerId ? querySellerId : sellerId

    if (!targetSellerId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' })
    }

    if (!mongoose.Types.ObjectId.isValid(targetSellerId)) {
      return res.status(400).json({ success: false, message: 'Invalid seller ID' })
    }

    const query: any = {
      seller: new mongoose.Types.ObjectId(targetSellerId),
      status: 'PAID', // Only include paid settlements
    }

    // Filter by date range or financial year
    if (financialYear) {
      const year = parseInt(financialYear.split('-')[0])
      const fyStart = new Date(year, 3, 1) // April 1
      const fyEnd = new Date(year + 1, 2, 31) // March 31
      query.payoutDate = { $gte: fyStart, $lte: fyEnd }
    } else if (fromDate || toDate) {
      query.payoutDate = {}
      if (fromDate) query.payoutDate.$gte = new Date(fromDate)
      if (toDate) query.payoutDate.$lte = new Date(toDate)
    }

    const batches = await SellerSettlementBatch.find(query)
      .populate('seller', 'name businessName gstNumber state')
      .sort({ payoutDate: -1 })
      .lean()

    // Get seller details
    const seller = await User.findById(targetSellerId)
      .select('name businessName gstNumber state')
      .lean()

    // CRITICAL: Reports use settlement batch data (single source of truth)
    // Reports do NOT recompute values from orders - they use stored settlement values
    // Expand each batch into separate rows for Registered and Unregistered customers
    const report: any[] = []
    batches.forEach((batch: any) => {
      const breakdown = batch.tcsBreakdown || {
        interState: { salesAmount: 0, tcsAmount: 0 },
        intraState: {
          salesAmount: 0,
          tcsCgstAmount: 0,
          tcsSgstAmount: 0,
          tcsAmount: 0,
        },
        registeredCustomers: { salesAmount: 0, tcsAmount: 0 },
        unregisteredCustomers: { salesAmount: 0, tcsAmount: 0 },
      }

      const baseRow = {
        settlementBatchId: batch._id,
        fromDate: batch.fromDate,
        toDate: batch.toDate,
        payoutDate: batch.payoutDate,
        sellerGstin: (batch.seller as any)?.gstNumber,
        sellerState: (batch.seller as any)?.state,
        breakdown,
      }

      // Registered customers row
      if (breakdown.registeredCustomers.salesAmount > 0) {
        // Use stored TCS amount from breakdown, proportionally split IGST/CGST/SGST
        const totalTcs = breakdown.registeredCustomers.tcsAmount || 0
        const totalSales = breakdown.interState.salesAmount + breakdown.intraState.salesAmount
        const regInterStateRatio =
          totalSales > 0 ? breakdown.interState.salesAmount / totalSales : 0
        const regIntraStateRatio = 1 - regInterStateRatio

        // Proportionally allocate TCS based on inter/intra state ratio
        const regTcsIgst = totalTcs * regInterStateRatio
        const regTcsCgst = (totalTcs * regIntraStateRatio) / 2
        const regTcsSgst = (totalTcs * regIntraStateRatio) / 2

        report.push({
          ...baseRow,
          customerType: 'Registered',
          salesAmountExclGst: breakdown.registeredCustomers.salesAmount,
          tcsIgstAmount: regTcsIgst,
          tcsCgstAmount: regTcsCgst,
          tcsSgstAmount: regTcsSgst,
          totalTcsAmount: totalTcs,
        })
      }

      // Unregistered customers row
      if (breakdown.unregisteredCustomers.salesAmount > 0) {
        // Use stored TCS amount from breakdown, proportionally split IGST/CGST/SGST
        const totalTcs = breakdown.unregisteredCustomers.tcsAmount || 0
        const totalSales = breakdown.interState.salesAmount + breakdown.intraState.salesAmount
        const unregInterStateRatio =
          totalSales > 0 ? breakdown.interState.salesAmount / totalSales : 0
        const unregIntraStateRatio = 1 - unregInterStateRatio

        // Proportionally allocate TCS based on inter/intra state ratio
        const unregTcsIgst = totalTcs * unregInterStateRatio
        const unregTcsCgst = (totalTcs * unregIntraStateRatio) / 2
        const unregTcsSgst = (totalTcs * unregIntraStateRatio) / 2

        report.push({
          ...baseRow,
          customerType: 'Unregistered',
          salesAmountExclGst: breakdown.unregisteredCustomers.salesAmount,
          tcsIgstAmount: unregTcsIgst,
          tcsCgstAmount: unregTcsCgst,
          tcsSgstAmount: unregTcsSgst,
          totalTcsAmount: totalTcs,
        })
      }

      // If no breakdown available, show total row
      if (
        breakdown.registeredCustomers.salesAmount === 0 &&
        breakdown.unregisteredCustomers.salesAmount === 0
      ) {
        report.push({
          ...baseRow,
          customerType: 'All',
          salesAmountExclGst: batch.tcsBaseAmount || 0,
          tcsIgstAmount: batch.tcsIgstAmount || 0,
          tcsCgstAmount: batch.tcsCgstAmount || 0,
          tcsSgstAmount: batch.tcsSgstAmount || 0,
          totalTcsAmount: batch.totalTcsAmount || 0,
        })
      }
    })

    // Include negative entries for returns/refunds (from TCS_REVERSAL ledger entries)
    // These represent adjustments in future settlements
    const tcsReversalEntries = await SellerLedgerEntry.find({
      seller: new mongoose.Types.ObjectId(targetSellerId),
      reason: 'TCS_REVERSAL',
      settlementBatch: null, // Unlinked reversals (will be in next settlement)
    })
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 })
      .lean()

    // Parse TCS reversal amounts from description or calculate from order
    const negativeTcsEntries = await Promise.all(
      tcsReversalEntries.map(async (entry: any) => {
        const order = entry.order as any
        const orderDoc = order?._id
          ? await Order.findById(order._id)
              .select('subtotal shippingAddress')
              .populate('user', 'gstNumber state')
              .lean()
          : null

        if (!orderDoc) {
          return null
        }

        const sellerState = seller?.state || ''
        const customerState = orderDoc.shippingAddress?.state || (orderDoc.user as any)?.state || ''
        const orderTaxableValue = orderDoc.subtotal || 0
        const isInterState = sellerState !== customerState

        const TCS_RATE_INTER_STATE = 1.0
        const TCS_RATE_INTRA_STATE = 0.5

        let tcsIgstReversal = 0
        let tcsCgstReversal = 0
        let tcsSgstReversal = 0

        if (isInterState) {
          tcsIgstReversal = (orderTaxableValue * TCS_RATE_INTER_STATE) / 100
        } else {
          tcsCgstReversal = (orderTaxableValue * TCS_RATE_INTRA_STATE) / 100
          tcsSgstReversal = (orderTaxableValue * TCS_RATE_INTRA_STATE) / 100
        }

        return {
          settlementBatchId: null,
          fromDate: null,
          toDate: null,
          payoutDate: null,
          sellerGstin: seller?.gstNumber,
          sellerState: seller?.state,
          salesAmountExclGst: -orderTaxableValue, // Negative
          tcsIgstAmount: -tcsIgstReversal, // Negative
          tcsCgstAmount: -tcsCgstReversal, // Negative
          tcsSgstAmount: -tcsSgstReversal, // Negative
          totalTcsAmount: -(tcsIgstReversal + tcsCgstReversal + tcsSgstReversal), // Negative
          breakdown: {
            interState: isInterState
              ? { salesAmount: -orderTaxableValue, tcsAmount: -tcsIgstReversal }
              : { salesAmount: 0, tcsAmount: 0 },
            intraState: !isInterState
              ? {
                  salesAmount: -orderTaxableValue,
                  tcsCgstAmount: -tcsCgstReversal,
                  tcsSgstAmount: -tcsSgstReversal,
                  tcsAmount: -(tcsCgstReversal + tcsSgstReversal),
                }
              : {
                  salesAmount: 0,
                  tcsCgstAmount: 0,
                  tcsSgstAmount: 0,
                  tcsAmount: 0,
                },
            registeredCustomers: { salesAmount: 0, tcsAmount: 0 },
            unregisteredCustomers: { salesAmount: 0, tcsAmount: 0 },
          },
          orderNumber: order?.orderNumber,
          orderId: order ? String(order._id) : null,
          isReversal: true,
        }
      }),
    )

    const validNegativeEntries = negativeTcsEntries.filter((e) => e !== null)
    const allTcsReportEntries = [...report, ...validNegativeEntries]

    const summary = {
      totalBatches: batches.length,
      totalSalesExclGst: allTcsReportEntries.reduce((sum, r) => sum + r.salesAmountExclGst, 0),
      totalTcsAmount: allTcsReportEntries.reduce((sum, r) => sum + r.totalTcsAmount, 0),
      totalTcsIgst: allTcsReportEntries.reduce((sum, r) => sum + r.tcsIgstAmount, 0),
      totalTcsCgst: allTcsReportEntries.reduce((sum, r) => sum + r.tcsCgstAmount, 0),
      totalTcsSgst: allTcsReportEntries.reduce((sum, r) => sum + r.tcsSgstAmount, 0),
      interStateSales: allTcsReportEntries.reduce(
        (sum, r) => sum + (r.breakdown?.interState?.salesAmount || 0),
        0,
      ),
      intraStateSales: allTcsReportEntries.reduce(
        (sum, r) => sum + (r.breakdown?.intraState?.salesAmount || 0),
        0,
      ),
      registeredCustomerSales: allTcsReportEntries.reduce(
        (sum, r) => sum + (r.breakdown?.registeredCustomers?.salesAmount || 0),
        0,
      ),
      unregisteredCustomerSales: allTcsReportEntries.reduce(
        (sum, r) => sum + (r.breakdown?.unregisteredCustomers?.salesAmount || 0),
        0,
      ),
      pendingReversals: validNegativeEntries.length,
    }

    const sellerInfo = seller
      ? {
          name: seller.name,
          businessName: seller.businessName,
          gstNumber: seller.gstNumber,
          state: seller.state,
        }
      : null

    // Handle export formats
    if (format === 'excel') {
      const { exportTcsReportToExcel } = await import('../utils/reportExporter')
      const buffer = await exportTcsReportToExcel(
        allTcsReportEntries,
        summary,
        sellerInfo,
        'tcs-report',
      )
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="tcs-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
      )
      return res.send(buffer)
    }

    if (format === 'pdf') {
      const { exportReportToPDF } = await import('../utils/reportExporter')
      const buffer = await exportReportToPDF(
        allTcsReportEntries,
        summary,
        sellerInfo,
        'tcs',
        'tcs-report',
      )
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="tcs-report-${new Date().toISOString().split('T')[0]}.pdf"`,
      )
      return res.send(buffer)
    }

    // Default: JSON response
    return res.json({
      success: true,
      data: {
        seller: sellerInfo,
        report: allTcsReportEntries,
        summary,
      },
    })
  } catch (error: any) {
    console.error('Error fetching TCS report:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

// Settlement Due Report (Admin Only) - Shows all pending settlements
export const getSettlementDueReport = async (req: Request, res: Response) => {
  try {
    const {
      fromDate,
      toDate,
      sellerId,
      format = 'json',
    } = req.query as {
      fromDate?: string
      toDate?: string
      sellerId?: string
      format?: 'json' | 'excel' | 'pdf'
    }

    const query: any = {
      status: 'PENDING', // Only pending settlements
    }

    if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
      query.seller = new mongoose.Types.ObjectId(sellerId)
    }

    if (fromDate || toDate) {
      query.createdAt = {}
      if (fromDate) query.createdAt.$gte = new Date(fromDate)
      if (toDate) query.createdAt.$lte = new Date(toDate)
    }

    const batches = await SellerSettlementBatch.find(query)
      .populate('seller', 'name businessName gstNumber panNumber state')
      .sort({ createdAt: -1 })
      .lean()

    // Get settlement settings for all sellers to calculate due dates
    const SellerSettlementSettings = mongoose.model('SellerSettlementSettings')
    const GlobalSettlementSettings = mongoose.model('GlobalSettlementSettings')
    const globalSettings = await GlobalSettlementSettings.findOne().lean()
    const sellerIds = [
      ...new Set(
        batches.map((b: any) => {
          const seller = b.seller
          return seller?._id ? String(seller._id) : String(seller)
        }),
      ),
    ]
    const sellerSettingsMap = new Map()
    if (sellerIds.length > 0) {
      const sellerSettings = await SellerSettlementSettings.find({
        seller: { $in: sellerIds.map((id) => new mongoose.Types.ObjectId(id)) },
      }).lean()
      sellerSettings.forEach((s: any) => {
        sellerSettingsMap.set(String(s.seller), s)
      })
    }

    // Helper to calculate due date based on settlement cycle
    const calculateDueDate = (batch: any, sellerId: string): Date => {
      const settings = sellerSettingsMap.get(sellerId) || globalSettings
      const cycle = settings?.settlementCycle || 'WEEKLY'
      const cycleDays =
        cycle === 'DAILY' ? 1 : cycle === 'WEEKLY' ? 7 : settings?.customCycleDays || 7
      // Due date = batch end date + cycle days (typical settlement processing time)
      const batchEndDate = new Date(batch.toDate)
      const dueDate = new Date(batchEndDate)
      dueDate.setDate(dueDate.getDate() + cycleDays)
      return dueDate
    }

    // Group by seller and calculate totals
    const sellerMap = new Map()
    batches.forEach((batch: any) => {
      const seller = batch.seller
      const sellerIdStr = seller?._id ? String(seller._id) : String(seller)
      if (!sellerMap.has(sellerIdStr)) {
        sellerMap.set(sellerIdStr, {
          seller: batch.seller,
          batches: [],
          totalBatches: 0,
          totalNetPayout: 0,
          totalSaleAmount: 0,
          totalCommissionAmount: 0,
          totalTdsAmount: 0,
          totalTcsAmount: 0,
          totalOtherCharges: 0,
          earliestDueDate: null as Date | null,
        })
      }
      const sellerData = sellerMap.get(sellerIdStr)
      const dueDate = calculateDueDate(batch, sellerIdStr)
      if (!sellerData.earliestDueDate || dueDate < sellerData.earliestDueDate) {
        sellerData.earliestDueDate = dueDate
      }
      sellerData.batches.push({ ...batch, dueDate })
      sellerData.totalBatches += 1
      sellerData.totalNetPayout += batch.totalNetPayout || 0
      sellerData.totalSaleAmount += batch.totalSaleAmount || 0
      sellerData.totalCommissionAmount += batch.totalCommissionAmount || 0
      sellerData.totalTdsAmount += batch.totalTdsAmount || 0
      sellerData.totalTcsAmount += batch.totalTcsAmount || 0
      sellerData.totalOtherCharges += batch.totalOtherCharges || 0
    })

    const report = Array.from(sellerMap.values()).map((sellerData: any) => ({
      sellerId: String(sellerData.seller._id),
      sellerName: sellerData.seller.businessName || sellerData.seller.name,
      sellerGstin: sellerData.seller.gstNumber,
      sellerPan: sellerData.seller.panNumber,
      sellerState: sellerData.seller.state,
      totalBatches: sellerData.totalBatches,
      totalNetPayout: sellerData.totalNetPayout,
      totalSaleAmount: sellerData.totalSaleAmount,
      totalCommissionAmount: sellerData.totalCommissionAmount,
      totalTdsAmount: sellerData.totalTdsAmount,
      totalTcsAmount: sellerData.totalTcsAmount,
      totalOtherCharges: sellerData.totalOtherCharges,
      earliestDueDate: sellerData.earliestDueDate,
      batches: sellerData.batches.map((b: any) => ({
        batchId: b._id,
        fromDate: b.fromDate,
        toDate: b.toDate,
        dueDate: b.dueDate,
        ordersCount: b.ordersCount,
        netPayout: b.totalNetPayout,
        createdAt: b.createdAt,
      })),
    }))

    const summary = {
      totalSellers: report.length,
      totalBatches: batches.length,
      totalNetPayout: report.reduce((sum, r) => sum + r.totalNetPayout, 0),
      totalSaleAmount: report.reduce((sum, r) => sum + r.totalSaleAmount, 0),
      totalCommissionAmount: report.reduce((sum, r) => sum + r.totalCommissionAmount, 0),
      totalTdsAmount: report.reduce((sum, r) => sum + r.totalTdsAmount, 0),
      totalTcsAmount: report.reduce((sum, r) => sum + r.totalTcsAmount, 0),
    }

    // Handle export formats
    if (format === 'excel') {
      const { exportSettlementDueReportToExcel } = await import('../utils/reportExporter')
      const buffer = await exportSettlementDueReportToExcel(
        report,
        summary,
        'settlement-due-report',
      )
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="settlement-due-report-${
          new Date().toISOString().split('T')[0]
        }.xlsx"`,
      )
      return res.send(buffer)
    }

    if (format === 'pdf') {
      const { exportSettlementDueReportToPDF } = await import('../utils/reportExporter')
      const buffer = await exportSettlementDueReportToPDF(report, summary, 'settlement-due-report')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="settlement-due-report-${
          new Date().toISOString().split('T')[0]
        }.pdf"`,
      )
      return res.send(buffer)
    }

    // Default: JSON response
    return res.json({
      success: true,
      data: {
        report,
        summary,
      },
    })
  } catch (error: any) {
    console.error('Error fetching settlement due report:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const {
      action,
      entityType,
      entityId,
      performedBy,
      fromDate,
      toDate,
      page = 1,
      limit = 50,
    } = req.query as {
      action?: string
      entityType?: string
      entityId?: string
      performedBy?: string
      fromDate?: string
      toDate?: string
      page?: string
      limit?: string
    }

    const query: any = {}

    // Exclude seller deactivation and refund actions from settlement audit logs
    const excludedActions = [
      'SELLER_DEACTIVATION_REQUESTED',
      'SELLER_DEACTIVATION_APPROVED',
      'SELLER_DEACTIVATION_REJECTED',
      'SELLER_REACTIVATED',
      'REFUND_ISSUED',
    ]

    // Always exclude these actions from settlement audit logs
    if (action) {
      // If user filters by action, only apply if it's not excluded
      if (!excludedActions.includes(action)) {
        query.action = action
      } else {
        // Return empty results if trying to filter by excluded action
        query.action = '__NONEXISTENT__'
      }
    } else {
      // Exclude all these actions when no specific action filter is provided
      query.action = { $nin: excludedActions }
    }
    if (entityType) {
      query.entityType = entityType
    }
    if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
      query.entityId = new mongoose.Types.ObjectId(entityId)
    }
    if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
      query.performedBy = new mongoose.Types.ObjectId(performedBy)
    }
    if (fromDate || toDate) {
      query.createdAt = {}
      if (fromDate) query.createdAt.$gte = new Date(fromDate)
      if (toDate) query.createdAt.$lte = new Date(toDate)
    }

    const skip = (Number(page) - 1) * Number(limit)

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      AuditLog.countDocuments(query),
    ])

    return res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    return res.status(500).json({ success: false, message: error.message || 'Server error' })
  }
}
