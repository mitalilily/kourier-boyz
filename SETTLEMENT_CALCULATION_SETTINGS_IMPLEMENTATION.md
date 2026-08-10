# Settlement Calculation Settings Implementation Guide

## Overview

This document outlines the implementation of admin-configurable settlement calculation settings for the KOURIER_BOYZ platform. These settings allow admins to control how settlement amounts, commissions, and fees are calculated and rounded.

## What Has Been Implemented

### 1. Backend Model (`AdminSettlementSettings.ts`)
✅ Created model with the following configurable settings:

- **Commission Calculation**:
  - `defaultCommissionType`: PERCENTAGE or FIXED
  - `defaultCommissionValue`: Commission value (percentage 0-100 or fixed amount)
  - `commissionRoundingMode`: Rounding mode for commission calculations

- **Fee Calculation**:
  - `includeShippingInSaleAmount`: Whether shipping is included in commission base
  - `includeShippingInNetAmount`: Whether shipping earnings are added to net settlement

- **Rounding Settings**:
  - `settlementAmountRoundingMode`: Rounding for final settlement amounts
  - `feeRoundingMode`: Rounding for fees (courier, COD, PG)
  - `ledgerEntryRoundingMode`: Rounding for individual ledger entry amounts

- **Ledger Calculation Settings**:
  - `roundLedgerEntriesIndividually`: Whether to round each ledger entry amount when created
  - `roundLedgerAggregation`: Whether to round aggregated ledger totals
  - `ledgerAggregationRoundingMode`: Rounding mode for ledger aggregation totals

- **Calculation Order**:
  - `calculationOrder`: COMMISSION_FIRST or FEES_FIRST

- **Negative Balance Handling**:
  - `allowNegativeSettlements`: Whether to allow negative settlement amounts
  - `minimumSettlementAmount`: Minimum amount for settlement batch

### 2. Backend API Endpoints
✅ Added to `adminSettings.controller.ts`:
- `GET /admin/settings/settlement` - Get settlement settings
- `POST /admin/settings/settlement` - Update settlement settings

✅ Added routes to `adminSettingsRoutes.ts`

## What Needs to Be Completed

### 3. Update Settlement Service (`settlement.service.ts`)

The `calculateSettlementForOrder` function needs to be updated to use admin settings:

```typescript
// Current implementation (lines 45-128)
// Needs to:
// 1. Fetch AdminSettlementSettings.getSingleton()
// 2. Use admin rounding modes for:
//    - Commission amounts (commissionRoundingMode)
//    - Fee amounts (feeRoundingMode)
//    - Final settlement amounts (settlementAmountRoundingMode)
// 3. Respect includeShippingInSaleAmount when calculating commission base
// 4. Respect includeShippingInNetAmount when calculating net amount
// 5. Respect calculationOrder when applying deductions
// 6. Respect allowNegativeSettlements when calculating net amount
```

**Key Changes Needed**:

**In `calculateSettlementForOrder` function (lines 45-128)**:
1. Import `AdminSettlementSettings` and `roundAmount` from `roundingHelpers`
2. Fetch admin settings at the start of settlement calculation
3. Apply rounding to commission: `roundAmount(commissionAmount, settings.commissionRoundingMode)`
4. Apply rounding to fees: `roundAmount(feeAmount, settings.feeRoundingMode)`
5. Apply rounding to final net amount: `roundAmount(netAmount, settings.settlementAmountRoundingMode)`
6. Use `settings.includeShippingInSaleAmount` to determine commission base
7. Use `settings.includeShippingInNetAmount` to determine if shipping is added to net
8. Use `settings.allowNegativeSettlements` to determine if negative amounts are allowed

**In ledger entry creation (lines 262-322)**:
9. Round ledger entry amounts if `settings.roundLedgerEntriesIndividually` is true:
   - `roundAmount(saleAmount, settings.ledgerEntryRoundingMode)`
   - `roundAmount(shippingEarning, settings.ledgerEntryRoundingMode)`
   - `roundAmount(commissionAmount, settings.ledgerEntryRoundingMode)`
   - `roundAmount(courierForwardFee, settings.feeRoundingMode)`
   - `roundAmount(codFee, settings.feeRoundingMode)`
   - `roundAmount(pgFee, settings.feeRoundingMode)`

**In ledger aggregation (lines 567-654)**:
10. Round aggregated totals if `settings.roundLedgerAggregation` is true:
    - Round each breakdown total: `roundAmount(total, settings.ledgerAggregationRoundingMode)`
    - Apply after summing all entries of each type

### 4. Admin UI Component

**Location**: `admin/src/components/settings/SettlementCalculationSettings.tsx`

**Features Needed**:
- Form with all settlement calculation settings
- Sections for:
  - Commission Calculation (type, value, rounding)
  - Fee Calculation (shipping inclusion flags)
  - Rounding Settings (modes for settlement, commission, fees)
  - Calculation Order (dropdown)
  - Negative Balance Handling (checkbox, minimum amount input)

**Similar to**: `GSTRoundingSettings.tsx` but more comprehensive

### 5. Add to Calculations Page

**Update**: `admin/src/pages/Calculations.tsx`

Add a new tab for "Settlement Calculations":

```typescript
{
  key: 'settlement-calculations',
  label: 'Settlement Calculations',
  icon: <DollarOutlined />,
  children: (
    <Suspense fallback={<LoadingFallback />}>
      <SettlementCalculationSettings />
    </Suspense>
  ),
},
```

### 6. Frontend API Client

**Update**: `admin/src/api/settings.ts`

Add:
- `fetchSettlementSettings`
- `updateSettlementSettingsApi`
- `useSettlementSettings`
- `useUpdateSettlementSettings`
- `SettlementSettings` interface

### 7. Documentation

**Update**: `docs/KOURIER_BOYZ_CALCULATIONS_METRICS_FORMULAS.md`

Add new section 4.1.1 or expand section 4 to document:
- All settlement calculation settings
- How each setting affects calculations
- Formulas with rounding applied
- Where settings are configured

## Implementation Priority

1. ✅ **Model & API** (COMPLETED)
2. ⏳ **Update Settlement Service** (HIGH PRIORITY - Core functionality)
3. ⏳ **Admin UI** (HIGH PRIORITY - User-facing)
4. ⏳ **Documentation** (MEDIUM PRIORITY - Important for teams)

## Testing Checklist

- [ ] Test commission calculation with PERCENTAGE mode
- [ ] Test commission calculation with FIXED mode
- [ ] Test commission rounding with all 4 modes
- [ ] Test fee rounding with all 4 modes
- [ ] Test settlement amount rounding with all 4 modes
- [ ] Test includeShippingInSaleAmount flag
- [ ] Test includeShippingInNetAmount flag
- [ ] Test calculationOrder (COMMISSION_FIRST vs FEES_FIRST)
- [ ] Test allowNegativeSettlements flag
- [ ] Test minimumSettlementAmount
- [ ] Verify settings persist after update
- [ ] Verify settings are used in all settlement calculations

## Notes

- Settings are stored as singleton (only one settings document exists)
- Default values are applied on first use
- Settings changes apply immediately to new settlements
- Existing settlements are NOT recalculated automatically
- All rounding modes use the `roundAmount` function from `roundingHelpers.ts`

