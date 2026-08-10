# Credit Note Generation for Sellers - Business Logic Analysis

## Critical Business Rule

**Credit notes are ONLY for POST-INVOICE corrections where GST has already been reported.**

- ✅ **Generate Credit Note:** Post-invoice corrections (settlement invoice already generated)
- ❌ **Do NOT Generate Credit Note:** Pre-invoice movements (ledger-only, no invoice generated yet)

## Current Implementation

### Credit Notes Currently Generated (For Buyers Only)
1. **Return Refund Completed** (`return.controller.ts:2292-2394`)
   - Generated when: Return status changes to `REFUND_COMPLETED`
   - Audience: `'buyer'` (customer)
   - Purpose: Document refund to customer

2. **Manual Refund** (`adminOrder.controller.ts:824-929`)
   - Generated when: Admin issues manual refund
   - Audience: `'buyer'` (customer)
   - Purpose: Document refund to customer

### Credit Notes Currently Generated for Sellers ✅
1. **Credit-Type Manual Adjustments (After Invoice)** (`settlement.controller.ts`)
   - Generated when: Admin adds credit adjustment to batch that has invoice
   - Audience: `'seller'`
   - Purpose: Document correction to settlement invoice
   - Status: ✅ **IMPLEMENTED**

2. **Commission Reversals (After Invoice)** (`return.controller.ts`)
   - Generated when: Commission reversed after settlement invoice generated
   - Audience: `'seller'`
   - Purpose: GST-compliant reversal of taxed commission service
   - Status: ✅ **IMPLEMENTED**

---

## When Credit Notes SHOULD Be Generated for Sellers

**CRITICAL RULE:** Credit notes are ONLY for **post-invoice corrections** where GST has already been reported. Pre-invoice movements are ledger-only and do NOT require credit notes.

### ✅ **SHOULD Generate Credit Notes for Sellers When:**

**These are POST-INVOICE corrections (GST already reported):**

1. **Commission Reversals** ⚠️ **MANDATORY GST COMPLIANCE - ✅ IMPLEMENTED**
   - **Why:** Commission is a taxed service (SAC code 998314) billed to the seller
   - **When:** Commission charged → Seller invoice/settlement invoice generated → Commission later reversed (dispute, cancellation, return, system error)
   - **Requirement:** Once commission is invoiced/reported, reversing it legally requires a Credit Note
   - **Implementation:**
     - ✅ Generate Seller Credit Note for commission reversal amount
     - ✅ Reference seller settlement invoice (if available)
     - ✅ Use SAC code 998314 (commission service)
     - ✅ Adjust in next settlement
   - **Example:** Commission charged on order → Settlement invoice generated → Order returned → Commission reversed → Credit Note generated
   - **Status:** ✅ **IMPLEMENTED** - Credit notes automatically generated for all commission reversals

2. **Penalty Reversals** ⚠️ **MANDATORY GST COMPLIANCE - REQUIRED**
   - **Why:** Penalties are typically invoiced (taxable or non-taxable service)
   - **When:** Penalty charged → Settlement invoice generated → Penalty later reversed (dispute, error correction)
   - **Requirement:** Once included in a seller invoice/settlement invoice, GST impact is locked. Reversing later = post-invoice correction
   - **Implementation Required:**
     - ✅ Generate Seller Credit Note for penalty reversal amount
     - ✅ Reference seller settlement invoice (if available)
     - ✅ Use appropriate SAC/HSN code for penalty service
     - ✅ Adjust in next settlement
   - **Status:** ⚠️ **MANDATORY** - To be implemented when penalty system is in place

3. **Platform Error Corrections (After Invoice)** ⚠️ **MANDATORY GST COMPLIANCE**
   - **When:** Platform error occurred → Settlement invoice generated → Error corrected after invoice
   - **Examples:**
     - Wrong commission calculation (already in invoice)
     - Incorrect penalty charged (already in invoice)
     - System error that affected invoice amounts
   - **Requirement:** Corrections to already-invoiced amounts require credit notes
   - **Status:** ⏳ **TODO** - To be implemented

4. **Manual Credit-Type Settlement Adjustments (After Invoice)** ✅ **IMPLEMENTED**
   - **When:** Settlement invoice generated → Admin adds credit adjustment after invoice
   - **Scenario:** Settlement invoice ₹50,000 generated → Admin realizes error → Adds ₹2,000 credit
   - **Result:**
     - ✅ Generate Seller Credit Note for ₹2,000
     - ✅ Credit note references the original settlement invoice
     - ❌ Do NOT regenerate old settlement invoice
     - ✅ Adjustment will be reflected in next settlement batch
   - **Status:** ✅ **IMPLEMENTED** - Credit notes automatically generated for credit-type adjustments to batches with invoices

5. **Any Increase to Seller's Taxable Value After Invoice** ⚠️ **MANDATORY GST COMPLIANCE - CORE DEFINITION**
   - **Why:** This is actually the **core definition of a Credit Note** - correcting understated taxable value
   - **When:** Settlement invoice generated → Seller's taxable value increased (correction, adjustment, missed order added)
   - **Requirement:** If taxable value was understated in invoice, correction requires credit note
   - **Examples:**
     - Order's taxable value corrected upward after invoice
     - Missed order added to batch that already has invoice
     - Any adjustment that increases seller's taxable value after invoice generation
   - **Implementation Required:**
     - ✅ Generate Seller Credit Note for the increase amount
     - ✅ Reference seller settlement invoice
     - ✅ Use appropriate HSN/SAC codes from the order/adjustment
     - ✅ Calculate GST on the increased taxable value
     - ✅ Adjust in next settlement
   - **Status:** ⚠️ **MANDATORY** - Core credit note use case, to be implemented

**Key Principle:** All credit notes must:
- ➡️ Reference seller invoice / settlement invoice
- ➡️ Adjust in next settlement
- ➡️ Be GST-compliant (proper SAC/HSN codes, tax calculations)

### ❌ **SHOULD NOT Generate Credit Notes for Sellers When:**

**These are PRE-INVOICE / LEDGER-ONLY movements (GST not yet reported):**

1. **Normal Returns & Refunds**
   - These are ledger entries only (earnings reversals)
   - No invoice has been generated yet
   - Seller's earnings are adjusted via ledger entries
   - **Note:** Returns generate credit notes for BUYERS, not sellers

2. **Return Rejection Before Settlement Invoice**
   - Return was rejected before settlement invoice generation
   - Earnings restoration is ledger-only
   - No invoice to correct, so no credit note needed

3. **Platform Errors Fixed Before Invoice**
   - Error occurred but was fixed before settlement invoice generation
   - Correction is reflected in ledger entries
   - No invoice to correct, so no credit note needed

4. **Regular Settlement Payouts**
   - Settlement payments are documented via invoices, not credit notes
   - Credit notes are for corrections/adjustments, not regular payments
   - Payouts are payments, not corrections

5. **Earnings Restorations Before Invoice Generation**
   - Earnings restored before settlement invoice is generated
   - Restoration is reflected in ledger entries
   - No invoice to correct, so no credit note needed

**Key Principle:** If no invoice has been generated yet, all movements are ledger-only and do NOT require credit notes.

---

## Recommended Implementation

### 1. Add Credit Note Generation for Seller-Facing Scenarios

**Location:** `backend/src/controllers/settlement.controller.ts` (manual adjustments)

**Current Behavior:**
- Debit-type manual adjustments generate DEBIT notes ✅
- Credit-type manual adjustments generate CREDIT notes ✅
- **Corrections after invoice:** Credit/debit notes generated referencing settlement invoice ✅

**Recommended Fix:**
```typescript
// In createManualAdjustment function
if (type === 'credit') {
  // Generate credit note for seller
  // CRITICAL: Must reference seller invoice, NOT buyer invoice
  const creditNote = await generateInvoice(invoiceData, 'CREDIT_NOTE', adjustmentDate)
  entry.creditNote = {
    credit_note_id: creditNote.invoice_id,
    credit_note_url: creditNote.invoice_url,
    credit_note_number: creditNote.invoice_number,
    generated_at: adjustmentDate,
    hsnSummary: creditNote.hsnSummary,
  }
}
```

### ⚠️ **CRITICAL FIX REQUIRED in `invoiceGenerator.ts`**

**Current Issue (Lines 223-237):**
- Credit/debit notes currently reference `order.invoice?.invoice_number` which is the **buyer's invoice**
- This is WRONG for seller credit notes - will cause GST filing mismatches

**Required Fix:**
```typescript
// For credit notes and debit notes, include invoice references
if (invoiceType === 'CREDIT_NOTE' || invoiceType === 'DEBIT_NOTE') {
  if (order._id) {
    invoiceNumberOptions.orderId = order._id
  }
  if (order.orderNumber) {
    invoiceNumberOptions.orderNumber = order.orderNumber
  }
  
  // CRITICAL: For seller credit/debit notes, reference SELLER invoice, NOT buyer invoice
  if (audience === 'seller') {
    // Reference seller settlement invoice if available
    if (settlement?.invoiceNumber) {
      invoiceNumberOptions.invoiceNumber = settlement.invoiceNumber
      // Settlement invoice date would be from settlement batch
    }
    // OR reference seller tax invoice if available (needs to be stored/retrieved)
    // For now, if no seller invoice exists, don't reference any invoice
    // (standalone credit note is acceptable for GST compliance)
  } else {
    // For buyer credit notes, reference buyer invoice (current behavior is correct)
    if (order.invoice?.invoice_number) {
      invoiceNumberOptions.invoiceNumber = order.invoice.invoice_number
    }
    if (order.invoice?.generated_at) {
      invoiceNumberOptions.invoiceDate = new Date(order.invoice.generated_at)
    }
  }
}
```

### 2. Add Credit Note Generation for Commission Reversals

**Location:** New endpoint or modify existing commission reversal logic

**When:** Commission is reversed for seller

### 3. Add Credit Note Generation for Return Rejection Reversals

**Location:** `backend/src/controllers/return.controller.ts`

**When:** Return is rejected after seller's earnings were already deducted

### 4. Add Credit Note Generation for Platform Error Corrections

**Location:** New endpoint for platform corrections

**When:** Platform needs to credit seller due to platform error

---

## GST Compliance Considerations

### Credit Notes for Sellers Must Include:
1. **Seller's GST Information**
   - Seller's GSTIN
   - Seller's state code
   - Proper HSN/SAC codes

2. **Reference to Original Invoice** ⚠️ **CRITICAL GST COMPLIANCE - MUST BE EXPLICIT**
   
   **✅ CORRECT - MUST Reference:**
   - **Seller Tax Invoice** (if generated for the order)
   - **Seller Settlement Invoice** (from settlement batch)
   
   **❌ WRONG - MUST NEVER Reference:**
   - ❌ Buyer Invoice (`order.invoice` - this is the customer's invoice)
   - ❌ Order Invoice (this refers to buyer invoice)
   - ❌ Customer Invoice (this is the buyer's invoice)
   
   **Why This Matters:**
   - GST filings require credit notes to reference the **seller's own invoices**
   - Referencing buyer invoices causes GST filing mismatches
   - Seller credit notes must be linked to seller's tax invoices or settlement invoices
   - This ensures proper GST reconciliation and compliance
   
   **Implementation Rules:**
   - For order-related credit notes: Reference seller's tax invoice (if generated for that order)
   - For settlement-related credit notes: Reference seller's settlement invoice (from settlement batch)
   - If no seller invoice exists, credit note should be **standalone** (no reference) - this is acceptable for GST
   - **NEVER** use `order.invoice.invoice_number` for seller credit notes (this is buyer invoice)

3. **Proper Numbering**
   - Sequential credit note numbers per seller GSTIN+State
   - Format: `{creditNotePrefix}-{stateCode}-{sequence}`

4. **Audience Setting**
   - Must use `audience: 'seller'` when generating credit notes for sellers
   - This ensures proper seller-facing invoice format

---

## Summary

**Current State:**
- ✅ Credit notes generated for buyers (returns, refunds)
- ✅ Debit notes generated for sellers (debit adjustments)
- ✅ **IMPLEMENTED (4/5):** Credit notes for sellers (post-invoice corrections):
  - ✅ Credit-type manual adjustments (after invoice) - **WORKING**
  - ✅ Commission reversals (after invoice) - **WORKING**
  - ✅ Platform error corrections (after invoice) - **WORKING** (via manual adjustments)
  - ✅ Increases to seller's taxable value (after invoice) - **CORE DEFINITION** - **WORKING**
- ❌ **MANDATORY BUT NOT IMPLEMENTED (1/5):** Credit notes for sellers (post-invoice corrections):
  - ❌ Penalty reversals (after invoice) - **MISSING** (no penalty system found)

**GST Compliance Status:** ✅ **MOSTLY COMPLIANT** - 4 out of 5 mandatory scenarios implemented

**Key Principle:**
- ✅ **Generate Credit Notes:** Post-invoice corrections (GST already reported)
- ❌ **Do NOT Generate Credit Notes:** Pre-invoice movements (ledger-only, GST not yet reported)

**Priority Implementation:**
1. ✅ **COMPLETED:** Credit notes for credit-type manual adjustments (after invoice)
2. ✅ **COMPLETED:** Credit notes for corrections after settlement invoice generation
3. ✅ **COMPLETED:** Credit notes for commission reversals (MANDATORY GST compliance)
4. ✅ **COMPLETED:** Credit notes for platform error corrections (after invoice) - via manual adjustments
5. ✅ **COMPLETED:** Credit notes for increases to seller's taxable value (after invoice) - **CORE DEFINITION**
6. ⚠️ **MANDATORY:** Credit notes for penalty reversals (after invoice) - To be implemented when penalty system exists

**Note:** Return rejection reversals are pre-invoice movements and do NOT require credit notes (ledger-only).

## Implementation Details

### Corrections After Settlement Invoice

**Business Rule:**
- When a settlement invoice has been generated and sent to seller
- If admin later needs to make corrections (wrong commission, missed credit, etc.)
- Generate a credit/debit note referencing the original settlement invoice
- Do NOT regenerate the old settlement invoice
- Adjustment will be reflected in the next settlement batch

**Technical Implementation:**
- Adjustments are linked to the batch even if it's PAID (for tracking)
- Credit/debit notes automatically reference settlement invoice if batch has one
- Batch totals are NOT recomputed if batch is PAID (preserves original invoice)
- Adjustment description includes "Correction to settlement invoice" prefix

### Commission Reversal Credit Notes

**Business Rule:**
- Commission is a taxed service (SAC 998314) - reversing it requires a credit note
- This is MANDATORY for GST compliance - not optional
- When commission is reversed (due to return, cancellation, dispute, etc.), a credit note must be generated

**Technical Implementation:**
- Credit notes are automatically generated when `COMMISSION_REVERSAL` ledger entries are created
- Credit notes reference seller settlement invoice if the order's batch has an invoice
- Uses SAC code 998314 (marketplace commission services)
- GST rate: 18% (IGST for inter-state, CGST+SGST for intra-state)
- Credit note is stored in the ledger entry for audit trail
- Adjustment is reflected in the next settlement batch

## Business Rules Summary

### ✅ Generate Credit Note When:
- **Post-invoice correction** (settlement invoice already generated)
- **GST already reported** (amount was included in invoice)
- **Correction needed** (commission reversal, penalty reversal, error correction, adjustment)

### ❌ Do NOT Generate Credit Note When:
- **Pre-invoice movement** (no settlement invoice generated yet)
- **Ledger-only entry** (normal returns, refunds, earnings adjustments)
- **Regular payment** (settlement payout - uses invoice, not credit note)
- **Error fixed before invoice** (correction reflected in ledger before invoice generation)

**Critical Rule:** Credit notes are ONLY for post-invoice corrections. Pre-invoice movements are ledger-only and do NOT require credit notes.

## Mandatory Credit Note Scenarios

### ⚠️ **MUST Generate Credit Notes (Post-Invoice Corrections):**

1. **Penalty Reversals (After Invoice)** - **MANDATORY**
   - **Why:** Penalties are typically invoiced (taxable or non-taxable service)
   - **When:** Penalty charged → Settlement invoice generated → Penalty later reversed (dispute, error correction)
   - **Requirement:** Once included in settlement invoice, GST impact is locked. Reversing later = post-invoice correction → **MUST** generate credit note
   - **Status:** ⚠️ **MANDATORY** - To be implemented when penalty system is in place

2. **Increases to Seller's Taxable Value (After Invoice)** - **CORE DEFINITION**
   - **Why:** This is actually the **core definition of a Credit Note** - correcting understated taxable value
   - **When:** Settlement invoice generated → Seller's taxable value increased (correction, adjustment, missed order added)
   - **Examples:**
     - Order's taxable value corrected upward after invoice
     - Missed order added to batch that already has invoice
     - Any adjustment that increases seller's taxable value after invoice generation
   - **Requirement:** If taxable value was understated in invoice, correction requires credit note
   - **Status:** ⚠️ **MANDATORY** - Core credit note use case, to be implemented

3. **Commission Reversals (After Invoice)** - ✅ **IMPLEMENTED**
   - Commission is a taxed service - reversing after invoice requires credit note
   - Location: `return.controller.ts` - automatically generates credit notes

4. **Platform Error Corrections (After Invoice)** - ✅ **IMPLEMENTED**
   - Any correction to already-invoiced amounts requires credit note
   - Implemented via manual adjustments - all credit-type adjustments to batches with invoices generate credit notes
   - Location: `settlement.controller.ts` (manual adjustments)

5. **Manual Credit Adjustments (After Invoice)** - ✅ **IMPLEMENTED**
   - Credit-type adjustments to batches with invoices require credit notes
   - Location: `settlement.controller.ts` - automatically generates credit notes

6. **Increases to Seller's Taxable Value (After Invoice)** - ✅ **IMPLEMENTED** - **CORE DEFINITION**
   - This is the core definition of a Credit Note
   - When orders are added to batches with invoices, credit notes are automatically generated
   - Location: `settlement.controller.ts` (`importSettlementOrders` function)

**All credit notes must:**
- ➡️ Reference seller invoice / settlement invoice
- ➡️ Adjust in next settlement
- ➡️ Be GST-compliant (proper SAC/HSN codes, tax calculations)

