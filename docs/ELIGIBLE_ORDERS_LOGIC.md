# Eligible Orders Logic for Settlement Batch Generation

## Overview

This document explains how orders are determined to be eligible for settlement batch generation, ensuring accuracy and preventing duplicate settlements.

## Eligibility Criteria

### 1. Settlement Status Check
**Query Filter**: `settlementStatus: 'ELIGIBLE'`

**Valid Statuses**:
- `NOT_ELIGIBLE`: Order not yet eligible (return window not passed)
- `ELIGIBLE`: Order is eligible for settlement
- `INCLUDED_IN_BATCH`: Order already included in a settlement batch (excluded)
- `SETTLED`: Order already settled (excluded)
- `REVERSED`: Order settlement reversed (excluded)

**Location**: `settlement.service.ts:445`

### 2. Positive Net Amount Check
**Query Filter**: `sellerNetAmount: { $gt: 0 }`

**Purpose**: Only include orders where the seller has a positive net payout amount.

**Calculation**: `sellerNetAmount = saleAmount + shippingEarning - commission - courierCost - codFee - pgFee`

**Location**: `settlement.service.ts:446`

### 3. Replacement Order Exclusion
**Query Filter**: `isReplacement: { $ne: true }`

**Purpose**: Replacement orders are ₹0 orders created for returns. They should never be settled as they have no financial impact.

**Location**: `settlement.service.ts:447`

### 4. Settlement Batch Safety Check
**Query Filter**: `settlementBatch: { $exists: false }`

**Purpose**: Additional safety check to ensure orders already linked to a settlement batch are excluded, even if their status wasn't updated correctly.

**Location**: `settlement.service.ts:448`

## Order Evaluation Process

### Step 1: Eligibility Sweep (`runSettlementEligibilitySweep`)
Runs periodically to evaluate orders and update their `settlementStatus`.

**Criteria for ELIGIBLE**:
1. Order status must be `'delivered'`
2. Order must not be a replacement order
3. Return window must have passed:
   - `effectiveReturnWindowDays = maxItemReturnDays + adminReturnWindowDays`
   - Order becomes eligible after: `deliveredAt + effectiveReturnWindowDays`
4. Order items must have required fields (`priceWithoutTax`, `effectivePrice`)

**Location**: `settlement.service.ts:154-330`

### Step 2: Batch Generation (`generateSettlementBatchesForAllSellers`)
Selects eligible orders and creates settlement batches.

**Query**:
```typescript
Order.find({
  settlementStatus: 'ELIGIBLE',
  sellerNetAmount: { $gt: 0 },
  isReplacement: { $ne: true },
  settlementBatch: { $exists: false }, // Safety check
})
```

**Location**: `settlement.service.ts:444-448`

## Handling Returns and Refunds

### Orders with Returns/Refunds
**Status**: Orders with returns/refunds are **still eligible** for settlement.

**Reasoning**:
1. The order was delivered and sold
2. Returns/refunds are handled through ledger entries (reversals)
3. TCS_REVERSAL and TDS_REVERSAL entries net off the tax amounts
4. The financial impact is correctly reflected in the settlement

**Example**:
- Order #123: ₹10,000 delivered
- Return processed: TCS_REVERSAL and TDS_REVERSAL created
- Order remains ELIGIBLE
- Settlement includes order but nets off reversals

### Reversal Handling
When orders are returned/refunded:
1. `TCS_REVERSAL` ledger entry created (CREDIT)
2. `TDS_REVERSAL` ledger entry created (CREDIT)
3. Reversals are linked to the **next** settlement batch
4. Settlement calculation nets off reversals from TDS/TCS amounts

**Location**: `settlement.service.ts:518-542` (ledger entries query)

## Multi-Seller Orders

### Grouping Logic
Orders are grouped by seller for batch generation:
```typescript
const ordersBySeller = new Map<string, IOrder[]>()
for (const order of orders) {
  const firstShipmentSeller = order.sellerShipments?.[0]?.seller
  if (!firstShipmentSeller) continue
  const sellerIdStr = String(firstShipmentSeller)
  const list = ordersBySeller.get(sellerIdStr) || []
  list.push(order)
  ordersBySeller.set(sellerIdStr, list)
}
```

**Key Points**:
- Each seller gets their own settlement batch
- TDS and TCS are calculated seller-wise
- Multi-seller orders are split by seller

**Location**: `settlement.service.ts:454-462`

## Minimum Batch Amount Check

After grouping orders by seller, a minimum batch amount check is performed:

```typescript
const totalNet = eligibleOrders.reduce((sum, order) => sum + toNumber(order.sellerNetAmount), 0)
if (effective.minBatchAmount && totalNet < effective.minBatchAmount) {
  // Skip settlement for this seller
  continue
}
```

**Purpose**: Prevents creating settlement batches for very small amounts.

**Location**: `settlement.service.ts:490-496`

## Order Status Updates

When orders are included in a settlement batch:

1. **Order Status Update**:
   ```typescript
   settlementStatus: 'INCLUDED_IN_BATCH'
   settlementBatch: batchId
   ```

2. **Ledger Entry Linking**:
   - All ledger entries for eligible orders are linked to the batch
   - Reversal entries (TCS_REVERSAL, TDS_REVERSAL) are also linked

**Location**: `settlement.service.ts:755-782`

## Safety Checks Summary

✅ **Excludes replacement orders** (`isReplacement: { $ne: true }`)
✅ **Excludes already settled orders** (`settlementStatus: 'ELIGIBLE'` only)
✅ **Excludes orders with zero/negative net** (`sellerNetAmount: { $gt: 0 }`)
✅ **Excludes orders already in a batch** (`settlementBatch: { $exists: false }`)
✅ **Includes orders with returns** (reversals handle financial impact)
✅ **Groups by seller** (multi-seller order safety)
✅ **Checks minimum batch amount** (prevents tiny settlements)

## Edge Cases Handled

1. **Order with settlementBatch but wrong status**: Excluded by `settlementBatch: { $exists: false }`
2. **Order with return but still delivered**: Included (reversals handle impact)
3. **Multi-seller order**: Split by seller, each gets own batch
4. **Order with zero net amount**: Excluded by `sellerNetAmount: { $gt: 0 }`
5. **Replacement order**: Excluded by `isReplacement: { $ne: true }`

## Verification Checklist

- [x] Replacement orders excluded
- [x] Already settled orders excluded
- [x] Orders with zero/negative net excluded
- [x] Orders already in a batch excluded (safety check)
- [x] Orders with returns included (reversals handle impact)
- [x] Multi-seller orders handled correctly
- [x] Minimum batch amount check implemented
- [x] Return window logic correct
- [x] Order status updates correct

