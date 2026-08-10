# TDS & TCS Calculations & Deduction Process

## 📋 Table of Contents
1. [TDS (Tax Deducted at Source) - Section 194-O](#tds-tax-deducted-at-source---section-194-o)
2. [TCS (Tax Collected at Source) - GST Section 52](#tcs-tax-collected-at-source---gst-section-52)
3. [How TDS/TCS are Currently Deducted](#how-tdstcs-are-currently-deducted)
4. [All Parameters & Fields](#all-parameters--fields)

---

## 🟦 TDS (Tax Deducted at Source) - Section 194-O

### **Calculation Rules**

#### **1. TDS Rate**
- **Rate**: `0.1%` (fixed)
- **Applied on**: Gross Sales **INCLUDING GST**

#### **2. Base Amount (TDS Base)**
```
TDS Base = Gross Sales Including GST
         = Sum of all order totals (subtotal + tax + shipping)
         = order.total for each eligible order
```

#### **3. Exemption Rules**

**Exemption Criteria:**
- PAN 4th character = `P` (Individual) OR `H` (HUF)
- AND cumulative FY sales ≤ ₹5,00,000

**Exemption Logic:**
1. Check seller's PAN 4th character
2. If `P` or `H`:
   - Calculate cumulative sales in current Financial Year (from all PAID settlement batches)
   - If cumulative sales + current batch sales ≤ ₹5,00,000 → **NO TDS**
   - If cumulative sales < ₹5,00,000 but total will exceed → TDS only on amount **above** ₹5,00,000
3. If NOT `P` or `H` → TDS applies from first settlement

#### **4. Financial Year Calculation**
- **FY Start**: April 1st
- **FY End**: March 31st
- **Example**: FY 2024-25 = April 1, 2024 to March 31, 2025

#### **5. TDS Calculation Formula**

```javascript
// Step 1: Check PAN exemption
if (PAN 4th char === 'P' || PAN 4th char === 'H') {
  cumulativeSalesInFY = sum of all PAID batches' tdsBaseAmount in current FY
  
  if (cumulativeSalesInFY + currentBatchSales <= 500000) {
    tdsAmount = 0  // Fully exempted
  } else if (cumulativeSalesInFY < 500000) {
    // Partial exemption - only tax amount above threshold
    amountAboveThreshold = currentBatchSales - (500000 - cumulativeSalesInFY)
    tdsAmount = (amountAboveThreshold * 0.1) / 100
  } else {
    // Fully taxable
    tdsAmount = (currentBatchSales * 0.1) / 100
  }
} else {
  // No exemption - apply TDS from first settlement
  tdsAmount = (grossSalesIncludingGst * 0.1) / 100
}
```

### **TDS Parameters**

| Parameter | Type | Description | Source |
|-----------|------|-------------|--------|
| `TDS_RATE` | Constant | `0.1%` | Fixed by law (Section 194-O) |
| `TDS_EXEMPTION_THRESHOLD` | Constant | `₹5,00,000` | Fixed by law |
| `grossSalesIncludingGst` | Calculated | Sum of `order.total` for all eligible orders | Orders in batch |
| `cumulativeSalesInFy` | Calculated | Sum of `tdsBaseAmount` from all PAID batches in current FY | SellerSettlementBatch (status: PAID) |
| `panNumber` | Seller Data | Seller's PAN number | User model |
| `settlementDate` | Date | Date of settlement (used to determine FY) | Settlement batch `toDate` |

### **TDS Fields Stored in Settlement Batch**

| Field | Type | Description |
|-------|------|-------------|
| `totalTdsAmount` | Number | Final TDS amount deducted (₹) |
| `tdsRate` | Number | TDS rate applied (0.1) |
| `tdsBaseAmount` | Number | Gross sales including GST (base for TDS) |
| `tdsExempted` | Boolean | Whether TDS was exempted |
| `tdsExemptionReason` | String | Reason for exemption (if applicable) |

### **TDS Ledger Entry**

When TDS is deducted, a ledger entry is created:
- **Entry Type**: `DEBIT`
- **Reason**: `TDS_DEBIT`
- **Amount**: `tdsResult.tdsAmount`
- **Description**: `"TDS (194O) @ 0.1% on gross sales of ₹X"`

---

## 🟨 TCS (Tax Collected at Source) - GST Section 52

### **Calculation Rules**

#### **1. TCS Rates**

**Inter-State Supply** (Seller State ≠ Customer State):
- **IGST**: `1.0%` on taxable value

**Intra-State Supply** (Seller State = Customer State):
- **CGST**: `0.5%` on taxable value
- **SGST**: `0.5%` on taxable value
- **Total**: `1.0%` (CGST + SGST)

#### **2. Base Amount (TCS Base)**
```
TCS Base = Taxable Sales Value (EXCLUDING GST)
         = order.subtotal (price without tax)
         = DO NOT include order.tax or GST amount
```

**⚠️ CRITICAL**: TCS is calculated on **taxable value ONLY**, not including GST.

#### **3. Applicability**
- **Applies to**: ALL sales (both registered AND unregistered customers)
- **Customer GSTN**: Used ONLY for report segregation, NOT for eligibility
- TCS applies regardless of customer registration status

#### **4. Supply Type Determination**

```javascript
isInterState = (sellerState.toLowerCase() !== customerState.toLowerCase())
```

- **Inter-State**: Different states → IGST @ 1%
- **Intra-State**: Same state → CGST @ 0.5% + SGST @ 0.5%

#### **5. TCS Calculation Formula**

```javascript
// For each order in settlement batch:
orderTaxableValue = order.subtotal  // Excluding GST
customerState = order.shippingAddress.state || customer.state
isInterState = (sellerState !== customerState)

if (isInterState) {
  // Inter-state: IGST 1%
  tcsAmount = (orderTaxableValue * 1.0) / 100
  igstTcsAmount += tcsAmount
} else {
  // Intra-state: CGST 0.5% + SGST 0.5%
  cgstAmount = (orderTaxableValue * 0.5) / 100
  sgstAmount = (orderTaxableValue * 0.5) / 100
  intraStateCgstAmount += cgstAmount
  intraStateSgstAmount += sgstAmount
}

totalTcsAmount = igstTcsAmount + cgstAmount + sgstAmount
```

### **TCS Parameters**

| Parameter | Type | Description | Source |
|-----------|------|-------------|--------|
| `TCS_RATE_INTER_STATE` | Constant | `1.0%` (IGST) | Fixed by GST law |
| `TCS_RATE_INTRA_STATE` | Constant | `0.5%` (CGST or SGST) | Fixed by GST law |
| `orderTaxableValue` | Calculated | `order.subtotal` (excluding GST) | Order model |
| `sellerState` | Seller Data | Seller's state | User model |
| `customerState` | Order Data | Customer shipping state | Order.shippingAddress.state or User.state |
| `isCustomerRegistered` | Calculated | Whether customer has GSTIN | User.gstNumber (for reporting only) |

### **TCS Fields Stored in Settlement Batch**

| Field | Type | Description |
|-------|------|-------------|
| `totalTcsAmount` | Number | Total TCS amount (IGST + CGST + SGST) |
| `tcsIgstAmount` | Number | IGST TCS amount (inter-state) |
| `tcsCgstAmount` | Number | CGST TCS amount (intra-state) |
| `tcsSgstAmount` | Number | SGST TCS amount (intra-state) |
| `tcsBaseAmount` | Number | Taxable sales value excluding GST |
| `tcsBreakdown` | Object | Detailed breakdown (see below) |

### **TCS Breakdown Structure**

```typescript
tcsBreakdown: {
  interState: {
    salesAmount: number,    // Taxable value of inter-state sales
    tcsAmount: number       // IGST TCS amount
  },
  intraState: {
    salesAmount: number,    // Taxable value of intra-state sales
    tcsCgstAmount: number,  // CGST TCS amount
    tcsSgstAmount: number,  // SGST TCS amount
    tcsAmount: number       // Total (CGST + SGST)
  },
  registeredCustomers: {
    salesAmount: number,    // Taxable value to registered customers
    tcsAmount: number       // TCS on registered customer sales
  },
  unregisteredCustomers: {
    salesAmount: number,    // Taxable value to unregistered customers
    tcsAmount: number       // TCS on unregistered customer sales
  }
}
```

### **TCS Ledger Entry**

When TCS is collected, a ledger entry is created:
- **Entry Type**: `DEBIT`
- **Reason**: `TCS_DEBIT`
- **Amount**: `tcsResult.totalTcsAmount`
- **Description**: `"TCS (GST) on taxable value of ₹X. IGST: ₹Y, CGST: ₹Z, SGST: ₹W"`

---

## 🔄 How TDS/TCS are Currently Deducted

### **Process Flow**

#### **Step 1: Settlement Batch Generation**
When a settlement batch is created (`generateSettlementBatchesForAllSellers`):

1. **Validate Seller Tax Details**
   ```javascript
   // Validate PAN for TDS
   panValidation = validateSellerPanForTds(sellerId)
   // Validate GSTIN & State for TCS
   gstinValidation = validateSellerGstinForTcs(sellerId)
   ```

2. **Calculate Gross Sales for TDS**
   ```javascript
   grossSalesIncludingGst = 0
   for (order of eligibleOrders) {
     grossSalesIncludingGst += order.total  // Includes GST
   }
   ```

3. **Calculate TDS**
   ```javascript
   tdsResult = await calculateTds(
     sellerId,
     grossSalesIncludingGst,
     toDate  // Settlement end date
   )
   ```

4. **Calculate TCS**
   ```javascript
   tcsResult = await calculateTcs(
     sellerId,
     orderIds  // All order IDs in batch
   )
   ```

#### **Step 2: Store in Settlement Batch**

All TDS/TCS data is stored in `SellerSettlementBatch`:

```javascript
{
  // TDS fields
  totalTdsAmount: tdsResult.tdsAmount,
  tdsRate: tdsResult.tdsRate,
  tdsBaseAmount: tdsResult.tdsBaseAmount,
  tdsExempted: tdsResult.exempted,
  tdsExemptionReason: tdsResult.exemptionReason,
  
  // TCS fields
  totalTcsAmount: tcsResult.totalTcsAmount,
  tcsIgstAmount: tcsResult.tcsIgstAmount,
  tcsCgstAmount: tcsResult.tcsCgstAmount,
  tcsSgstAmount: tcsResult.tcsSgstAmount,
  tcsBaseAmount: tcsResult.tcsBaseAmount,
  tcsBreakdown: tcsResult.breakdown
}
```

#### **Step 3: Calculate Net Payout**

TDS and TCS are deducted from the net payout:

```javascript
totalNetPayout = 
  totalItemEarnings +
  totalShippingEarned +
  totalCommissionReversal -
  (
    totalCommission +
    totalCourierCost +
    totalCodFee -
    totalReverseCodFee +
    totalPgFee +
    totalReturnItemReversal +
    totalReturnShippingReversal +
    totalReverseCourierCost +
    totalManualAdjustments +
    tdsResult.tdsAmount +        // ← TDS deducted
    tcsResult.totalTcsAmount     // ← TCS deducted
  )
```

#### **Step 4: Create Ledger Entries**

**TDS Ledger Entry** (if TDS > 0):
```javascript
{
  seller: sellerId,
  settlementBatch: batchId,
  entryType: 'DEBIT',
  reason: 'TDS_DEBIT',
  amount: tdsResult.tdsAmount,
  description: `TDS (194O) @ ${tdsResult.tdsRate}% on gross sales of ₹${tdsResult.tdsBaseAmount}`
}
```

**TCS Ledger Entry** (if TCS > 0):
```javascript
{
  seller: sellerId,
  settlementBatch: batchId,
  entryType: 'DEBIT',
  reason: 'TCS_DEBIT',
  amount: tcsResult.totalTcsAmount,
  description: `TCS (GST) on taxable value of ₹${tcsResult.tcsBaseAmount}. IGST: ₹${tcsResult.tcsIgstAmount}, CGST: ₹${tcsResult.tcsCgstAmount}, SGST: ₹${tcsResult.tcsSgstAmount}`
}
```

### **Key Points**

1. **Single Source of Truth**: TDS/TCS are calculated **ONLY** at settlement batch finalization
2. **Never at Order Level**: TDS/TCS are NOT calculated at order, shipment, or delivery level
3. **Only PAID Batches**: Reports use only PAID settlement batches for compliance
4. **Financial Year Based**: TDS exemption threshold is calculated per Financial Year
5. **Automatic Deduction**: TDS/TCS are automatically deducted from seller payout

---

## 📊 All Parameters & Fields

### **TDS Parameters Summary**

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Rate** | `0.1%` | Fixed rate under Section 194-O |
| **Base** | Gross Sales (Incl. GST) | Sum of all order totals |
| **Exemption Threshold** | `₹5,00,000` | For Individual/HUF sellers per FY |
| **Exemption Criteria** | PAN 4th char = P or H | Individual or HUF |
| **Financial Year** | Apr 1 - Mar 31 | Indian FY cycle |

### **TCS Parameters Summary**

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Inter-State Rate** | `1.0%` (IGST) | When seller state ≠ customer state |
| **Intra-State Rate** | `0.5% + 0.5%` (CGST + SGST) | When seller state = customer state |
| **Base** | Taxable Value (Excl. GST) | `order.subtotal` only |
| **Applicability** | ALL sales | Registered + Unregistered customers |
| **Supply Type** | Based on state comparison | Inter-state vs Intra-state |

### **Settlement Batch Fields (TDS)**

```typescript
{
  totalTdsAmount: number,        // Final TDS deducted (₹)
  tdsRate: number,              // 0.1
  tdsBaseAmount: number,         // Gross sales incl. GST
  tdsExempted: boolean,         // Whether exempted
  tdsExemptionReason?: string    // Exemption reason if applicable
}
```

### **Settlement Batch Fields (TCS)**

```typescript
{
  totalTcsAmount: number,        // Total TCS (IGST + CGST + SGST)
  tcsIgstAmount: number,         // IGST TCS (inter-state)
  tcsCgstAmount: number,         // CGST TCS (intra-state)
  tcsSgstAmount: number,         // SGST TCS (intra-state)
  tcsBaseAmount: number,         // Taxable value excl. GST
  tcsBreakdown: {
    interState: {
      salesAmount: number,
      tcsAmount: number
    },
    intraState: {
      salesAmount: number,
      tcsCgstAmount: number,
      tcsSgstAmount: number,
      tcsAmount: number
    },
    registeredCustomers: {
      salesAmount: number,
      tcsAmount: number
    },
    unregisteredCustomers: {
      salesAmount: number,
      tcsAmount: number
    }
  }
}
```

### **Ledger Entry Reasons**

| Reason | Entry Type | Description |
|--------|------------|-------------|
| `TDS_DEBIT` | DEBIT | TDS deducted at settlement |
| `TDS_REVERSAL` | CREDIT | TDS reversal (for returns/refunds) |
| `TCS_DEBIT` | DEBIT | TCS collected at settlement |
| `TCS_REVERSAL` | CREDIT | TCS reversal (for returns/refunds) |

---

## 🔍 Example Calculations

### **TDS Example**

**Scenario**: Individual seller (PAN 4th char = P), ₹6,00,000 sales in current batch, ₹4,00,000 already settled in FY

```
Cumulative Sales in FY: ₹4,00,000
Current Batch Sales: ₹6,00,000
Total After Batch: ₹10,00,000

Threshold: ₹5,00,000
Amount Above Threshold: ₹10,00,000 - ₹5,00,000 = ₹5,00,000

TDS = (₹5,00,000 × 0.1) / 100 = ₹500
```

### **TCS Example**

**Scenario**: Inter-state sale of ₹10,000 (taxable value)

```
Taxable Value: ₹10,000
Supply Type: Inter-State (IGST)
TCS = (₹10,000 × 1.0) / 100 = ₹100 (IGST)

If Intra-State:
CGST = (₹10,000 × 0.5) / 100 = ₹50
SGST = (₹10,000 × 0.5) / 100 = ₹50
Total TCS = ₹100
```

---

## 📝 Notes

1. **TDS is deducted under Section 194-O** based on settled sales only
2. **TCS is collected as per GST Section 52** based on settled transactions only
3. Both TDS and TCS are calculated **only at settlement batch finalization**
4. Reports use **only PAID settlement batches** for compliance
5. All calculations are derived from **settlement batches**, not orders directly
6. This ensures **clean reconciliation** and **CA-ready numbers**

