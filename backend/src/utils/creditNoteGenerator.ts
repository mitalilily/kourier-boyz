/**
 * Helper utility for generating seller credit notes
 * Used for post-invoice corrections (GST compliance requirement)
 */

import mongoose from 'mongoose'
import Order from '../models/Order'
import SellerLedgerEntry from '../models/SellerLedgerEntry'
import SellerSettlementBatch from '../models/SellerSettlementBatch'
import User from '../models/User'
import { generateInvoice } from './invoiceGenerator'

interface CreditNoteGenerationOptions {
  sellerId: string | mongoose.Types.ObjectId
  amount: number
  description: string
  orderId?: string | mongoose.Types.ObjectId
  settlementBatchId?: string | mongoose.Types.ObjectId
  hsnSacCode?: string
  gstRatePercent?: number
  gstTaxType?: 'IGST' | 'CGST_SGST'
  productName?: string
}

/**
 * Generate a credit note for seller post-invoice corrections
 * This is MANDATORY for GST compliance when correcting already-invoiced amounts
 */
export const generateSellerCreditNote = async (
  options: CreditNoteGenerationOptions,
): Promise<{
  success: boolean
  creditNote?: {
    credit_note_id: string
    credit_note_url: string
    credit_note_number: string
    generated_at: Date
    hsnSummary?: any[]
  }
  error?: string
}> => {
  try {
    const {
      sellerId,
      amount,
      description,
      orderId,
      settlementBatchId,
      hsnSacCode = '998314', // Default: Services - Marketplace commission/adjustment
      gstRatePercent = 18,
      gstTaxType: gstTaxTypeRaw = 'IGST',
      productName = 'Correction Adjustment',
    } = options

    // Normalize gstTaxType to expected format ('IGST' or 'CGST_SGST')
    const gstTaxType =
      gstTaxTypeRaw === 'CGST_SGST' || String(gstTaxTypeRaw) === 'CGST+SGST' ? 'CGST_SGST' : 'IGST'

    if (amount <= 0) {
      return { success: false, error: 'Amount must be greater than 0' }
    }

    const sellerObjectId =
      typeof sellerId === 'string' ? new mongoose.Types.ObjectId(sellerId) : sellerId

    // Get seller details
    const seller = await User.findById(sellerObjectId)
      .select(
        'name email businessName storeLogo sellerAgreementSignature authorizedPersonName authorizedPersonDesignation storeDescription gstNumber state addressLine1 addressLine2 city postalCode country',
      )
      .lean()

    if (!seller) {
      return { success: false, error: 'Seller not found' }
    }

    // Check if settlement batch has invoice (post-invoice correction)
    let settlementInvoiceNumber: string | undefined = undefined
    if (settlementBatchId) {
      const batchId =
        typeof settlementBatchId === 'string' ? settlementBatchId : String(settlementBatchId)
      const batch = await SellerSettlementBatch.findById(batchId)
        .select('invoiceNumber status')
        .lean()
      if (batch?.invoiceNumber) {
        settlementInvoiceNumber = batch.invoiceNumber
      }
    } else if (orderId) {
      // Find batch from order
      const order = await Order.findById(orderId).select('settlementBatch').lean()
      if (order?.settlementBatch) {
        const batch = await SellerSettlementBatch.findById(order.settlementBatch)
          .select('invoiceNumber status')
          .lean()
        if (batch?.invoiceNumber) {
          settlementInvoiceNumber = batch.invoiceNumber
        }
      }
    }

    // If no invoice exists, this is a pre-invoice movement - no credit note needed
    // (This function is specifically for post-invoice corrections)
    if (!settlementInvoiceNumber) {
      return {
        success: false,
        error: 'No settlement invoice found - credit notes are only for post-invoice corrections',
      }
    }

    const creditNoteDate = new Date()
    let orderData: any = null
    let customerData: any = null

    // If order ID provided, fetch order details
    if (orderId) {
      const order = await Order.findById(orderId)
        .populate('user', 'name email')
        .populate('items.product', 'name')
        .populate('items.variant', 'name')
        .lean()

      if (order) {
        orderData = order
        customerData = (order as any).user
      }
    }

    // Create order structure for credit note
    const creditNoteOrder: any = orderData
      ? {
          ...orderData,
          // Remove buyer invoice - seller credit notes must reference seller invoices only
          invoice: undefined,
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
              hsnSacCode,
              gstRatePercent,
              gstTaxType,
              igst: gstTaxType === 'IGST' ? (amount * gstRatePercent) / (100 + gstRatePercent) : 0,
              cgst:
                gstTaxType === 'CGST_SGST'
                  ? (amount * gstRatePercent) / (200 + 2 * gstRatePercent)
                  : 0,
              sgst:
                gstTaxType === 'CGST_SGST'
                  ? (amount * gstRatePercent) / (200 + 2 * gstRatePercent)
                  : 0,
            },
          ],
        }
      : {
          _id: orderId || new mongoose.Types.ObjectId(),
          orderNumber: orderId
            ? `ORD-${creditNoteDate.toISOString().split('T')[0].replace(/-/g, '')}-ADJ`
            : `ADJ-${creditNoteDate.toISOString().split('T')[0].replace(/-/g, '')}-${Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase()}`,
          createdAt: creditNoteDate,
          status: 'delivered',
          total: amount,
          subtotal: amount,
          tax: 0,
          shipping: 0,
          discount: 0,
          paymentMethod: 'CORRECTION',
          paymentStatus: 'paid',
          items: [
            {
              product: null,
              variant: null,
              seller: sellerObjectId,
              quantity: 1,
              price: amount,
              effectivePrice: amount,
              priceWithoutTax: amount,
              subtotal: amount,
              hsnSacCode,
              gstRatePercent,
              gstTaxType,
              igst: gstTaxType === 'IGST' ? (amount * gstRatePercent) / (100 + gstRatePercent) : 0,
              cgst:
                gstTaxType === 'CGST_SGST'
                  ? (amount * gstRatePercent) / (200 + 2 * gstRatePercent)
                  : 0,
              sgst:
                gstTaxType === 'CGST_SGST'
                  ? (amount * gstRatePercent) / (200 + 2 * gstRatePercent)
                  : 0,
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
      order: creditNoteOrder,
      customer: customerData || (seller as any),
      seller: seller as any,
      items: [
        {
          product: orderData?.items?.[0]?.product || {
            name: productName,
          },
          variant: orderData?.items?.[0]?.variant || null,
          orderItem: creditNoteOrder.items[0],
        },
      ],
      audience: 'seller' as const,
      // CRITICAL GST COMPLIANCE: Pass settlement invoice for seller credit note reference
      settlement: settlementInvoiceNumber
        ? {
            grossAmount: amount,
            invoiceNumber: settlementInvoiceNumber,
          }
        : undefined,
    }

    // Generate credit note
    const creditNote = await generateInvoice(invoiceData, 'CREDIT_NOTE', creditNoteDate)

    return {
      success: true,
      creditNote: {
        credit_note_id: creditNote.invoice_id,
        credit_note_url: creditNote.invoice_url,
        credit_note_number: creditNote.invoice_number,
        generated_at: creditNoteDate,
        hsnSummary: creditNote.hsnSummary,
      },
    }
  } catch (error: any) {
    console.error('Error generating seller credit note:', error)
    return { success: false, error: error.message || 'Failed to generate credit note' }
  }
}

/**
 * Generate credit note and attach to ledger entry
 */
export const generateAndAttachCreditNoteToLedgerEntry = async (
  ledgerEntryId: string | mongoose.Types.ObjectId,
  options: CreditNoteGenerationOptions,
): Promise<{
  success: boolean
  creditNote?: any
  error?: string
}> => {
  try {
    const result = await generateSellerCreditNote(options)

    if (!result.success || !result.creditNote) {
      return result
    }

    // Attach credit note to ledger entry
    const entry = await SellerLedgerEntry.findById(ledgerEntryId)
    if (!entry) {
      return { success: false, error: 'Ledger entry not found' }
    }

    entry.creditNote = {
      credit_note_id: result.creditNote.credit_note_id,
      credit_note_url: result.creditNote.credit_note_url,
      credit_note_number: result.creditNote.credit_note_number,
      generated_at: result.creditNote.generated_at,
      hsnSummary: result.creditNote.hsnSummary,
    }
    await entry.save()

    console.log(
      `✅ Credit Note ${result.creditNote.credit_note_number} generated and attached to ledger entry ${entry._id}`,
    )

    return { success: true, creditNote: result.creditNote }
  } catch (error: any) {
    console.error('Error attaching credit note to ledger entry:', error)
    return { success: false, error: error.message || 'Failed to attach credit note' }
  }
}
