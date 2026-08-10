# TDS/TCS Reversal Implementation

## Overview

When orders are returned or refunded, the original TDS and TCS amounts related to those orders must be reversed. This document explains how reversals are implemented and how they affect reports.

## Implementation Details

### 1. Reversal Creation

When an order is returned or refunded (`return.controller.ts`):

#### TCS Reversal
- **Trigger**: Order return/refund processing
- **Calculation**: Based on order's taxable value (subtotal)
  - **Inter-state**: IGST @ 1% of taxable value
  - **Intra-state**: CGST @ 0.5% + SGST @ 0.5% of taxable value
- **Ledger Entry**: `TCS_REVERSAL` with `entryType: 'CREDIT'`
- **Description**: Includes IGST, CGST, SGST breakdown

#### TDS Reversal
- **Trigger**: Order return/refund processing
- **Calculation**: Based on order's total (gross sales including GST)
  - **Rate**: 0.1% (Section 194-O)
  - **Formula**: `TDS Reversal = order.total × 0.1%`
- **Ledger Entry**: `TDS_REVERSAL` with `entryType: 'CREDIT'`
- **Description**: Includes order number and gross sales amount

### 2. Settlement Batch Linking

**Key Point**: Reversals are linked to the **NEXT** settlement batch, not the original batch.

**Implementation** (`settlement.service.ts`):
- When a settlement batch is created, it links all unlinked reversal entries:
  ```typescript
  await SellerLedgerEntry.updateMany(
    {
      seller: sellerId,
      $or: [
        { order: { $in: orderIds }, settlementBatch: null },
        {
          order: { $exists: true },
          settlementBatch: null,
          reason: { $in: ['TCS_REVERSAL', 'TDS_REVERSAL'] },
        },
      ],
    },
    { $set: { settlementBatch: batchId } }
  )
  ```

**Why Next Batch?**
- Returns/refunds happen after the original order was settled
- Reversals need to be accounted for in the settlement cycle when they occur
- This ensures accurate financial reporting and compliance

### 3. Report Netting

Both TDS and TCS reports net off reversals to show accurate amounts.

#### TDS Report Netting (`adminReport.controller.ts`)

For each settlement batch:
1. Get `batch.totalTdsAmount` (TDS on orders in batch)
2. Find all `TDS_REVERSAL` entries linked to this batch
3. Net off reversals:
   ```typescript
   netTdsAmount = batch.totalTdsAmount - sum(TDS_REVERSAL amounts)
   netGrossSales = batch.tdsBaseAmount - sum(reversed order totals)
   ```

**Reversed Order Total Calculation**:
- Since `TDS Reversal = order.total × 0.1%`
- Therefore: `order.total = TDS Reversal / 0.001`

#### TCS Report Netting (`adminReport.controller.ts`)

For each settlement batch:
1. Calculate TCS from orders (grouped by seller × state × customer type × supply type)
2. Find all `TCS_REVERSAL` entries linked to batches
3. For each reversal:
   - Get the order to determine customer type and supply type
   - Parse IGST, CGST, SGST amounts from description or recalculate
   - Net off from the appropriate row:
     ```typescript
     row.taxableSalesValue -= orderTaxableValue
     row.igstTcsAmount -= igstReversal
     row.cgstTcsAmount -= cgstReversal
     row.sgstTcsAmount -= sgstReversal
     row.totalTcsAmount -= totalReversal
     ```

**Reversal Amount Parsing**:
- Description format: `"TCS reversal for return Order #XXX. IGST: ₹X.XX, CGST: ₹X.XX, SGST: ₹X.XX"`
- If parsing fails, recalculate from order taxable value

### 4. Seller Reports

Seller reports (read-only, own data) use the same netting logic as admin reports:
- `getSellerTdsReport`: Nets off TDS reversals
- `getSellerTcsReport`: Nets off TCS reversals

## Data Flow

```
Order Return/Refund
    ↓
Create TCS_REVERSAL ledger entry (settlementBatch: null)
Create TDS_REVERSAL ledger entry (settlementBatch: null)
    ↓
Next Settlement Batch Creation
    ↓
Link reversals to new batch (settlementBatch: batchId)
    ↓
Reports Query Batches
    ↓
For each batch: Net off reversals
    ↓
Display Net Amounts
```

## Compliance

### Section 194-O (TDS)
- ✅ TDS reversed when orders are returned
- ✅ Reversal calculated on gross sales (including GST)
- ✅ Reversal rate: 0.1%
- ✅ Reports show net TDS (after reversals)

### GST Section 52 (TCS)
- ✅ TCS reversed when orders are returned
- ✅ Reversal calculated on taxable value (excluding GST)
- ✅ Reversal rates: IGST 1%, CGST 0.5%, SGST 0.5%
- ✅ Reports show net TCS (after reversals)

## Code Locations

1. **Reversal Creation**: `backend/src/controllers/return.controller.ts` (lines ~2094-2141)
2. **Settlement Linking**: `backend/src/services/settlement.service.ts` (lines ~732-750)
3. **TDS Report Netting**: `backend/src/controllers/adminReport.controller.ts` (lines ~2049-2085)
4. **TCS Report Netting**: `backend/src/controllers/adminReport.controller.ts` (lines ~2447-2525)
5. **Seller Reports**: `backend/src/controllers/adminReport.controller.ts` (lines ~2634-2670, ~2995-3040)

## Verification Checklist

- [x] TCS_REVERSAL created when orders are returned
- [x] TDS_REVERSAL created when orders are returned
- [x] Reversals linked to next settlement batch
- [x] TDS report nets off reversals
- [x] TCS report nets off reversals
- [x] Seller TDS report nets off reversals
- [x] Seller TCS report nets off reversals
- [x] Reports show accurate net amounts

## Example

**Scenario**:
1. Order #123: ₹10,000 (including GST), Taxable: ₹9,000
2. TDS: ₹10 (0.1% of ₹10,000)
3. TCS: ₹90 (1% of ₹9,000 for inter-state)
4. Order returned
5. TDS_REVERSAL: ₹10 (CREDIT)
6. TCS_REVERSAL: ₹90 (CREDIT)

**Next Settlement Batch**:
- Links both reversals
- Reports show: Net TDS = Original TDS - ₹10, Net TCS = Original TCS - ₹90

