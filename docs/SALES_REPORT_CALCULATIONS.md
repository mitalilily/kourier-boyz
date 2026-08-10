# Sales Report - Detailed Calculation Breakdown

## Overview
This document explains the exact calculations performed in the Sales Report for each metric.

## Data Sources

### Order Items
Each order item contains:
- `quantity`: Number of units ordered
- `subtotal`: Line total after discounts, **excluding GST** (preferred)
- `priceWithoutTax`: Price per unit excluding GST (fallback if subtotal unavailable)
- `igst`: IGST amount per unit (for inter-state transactions)
- `cgst`: CGST amount per unit (for intra-state transactions)
- `sgst`: SGST amount per unit (for intra-state transactions)

### Returns
Each return contains:
- `refundAmount`: Total refund amount (includes GST)
- `orderItem`: Reference to the original order item
- `order`: Reference to the original order

---

## Calculation Formulas

### 1. Gross Sales (Excluding GST)

**Formula:**
```
For each order item:
  grossSales = item.subtotal OR (item.priceWithoutTax * item.quantity)
  
Total Gross Sales = Sum of all order item grossSales
```

**Explanation:**
- Uses `subtotal` if available (line total after discounts, excluding GST)
- Falls back to `priceWithoutTax * quantity` if subtotal is missing
- This represents the total sales value **before GST** and **after discounts**

**Example:**
```
Item 1: subtotal = ₹1,000, quantity = 2
  → grossSales = ₹1,000 (uses subtotal)

Item 2: subtotal = null, priceWithoutTax = ₹500, quantity = 3
  → grossSales = ₹500 × 3 = ₹1,500 (fallback calculation)
```

---

### 2. GST Amount

**Formula:**
```
For each order item:
  gstPerUnit = item.igst + item.cgst + item.sgst
  totalGst = gstPerUnit × item.quantity
  
Total GST = Sum of all order item totalGst
```

**Explanation:**
- Sums all GST components (IGST + CGST + SGST) per unit
- Multiplies by quantity to get total GST for the line item
- For returns: proportionally reduces GST based on refund ratio

**Example:**
```
Item 1: igst = ₹90, cgst = ₹0, sgst = ₹0, quantity = 2
  → gstPerUnit = ₹90 + ₹0 + ₹0 = ₹90
  → totalGst = ₹90 × 2 = ₹180

Item 2: igst = ₹0, cgst = ₹45, sgst = ₹45, quantity = 1
  → gstPerUnit = ₹0 + ₹45 + ₹45 = ₹90
  → totalGst = ₹90 × 1 = ₹90

Total GST = ₹180 + ₹90 = ₹270
```

---

### 3. Returns Amount

**Formula:**
```
For each return:
  returnsAmount = -refundGross  (gross portion only, excluding GST)
  
Total Returns = Sum of all return gross amounts (negative values)
```

**Explanation:**
- Returns are stored as **negative values**
- `refundAmount` (from return record) includes both gross and GST portions (total customer refund including GST)
- **`returnsAmount` in the report contains only the gross portion (`refundGross`) to avoid double-counting**
- **GST impact is adjusted separately in the GST calculation (`gstAmount -= refundGst`)**
- This ensures: `netSales = grossSales - refundGross` (only gross portion reduces net sales)
- Used in Net Sales calculation: `netSales = grossSales + returnsAmount`
- **Why not use full `refundAmount`?** Because `refundAmount` includes GST, and GST is already subtracted separately from `gstAmount`. Using full `refundAmount` would deduct GST twice.

**Example:**
```
Return 1: refundAmount = ₹1,180 (includes ₹180 GST)
  refundGross = ₹1,000 (gross portion)
  refundGst = ₹180 (GST portion)
  → returnsAmount = -₹1,000  (only gross portion)
  → gstAmount -= ₹180        (GST handled separately)

Return 2: refundAmount = ₹500 (includes ₹90 GST)
  refundGross = ₹410 (gross portion)
  refundGst = ₹90 (GST portion)
  → returnsAmount = -₹410  (only gross portion)
  → gstAmount -= ₹90       (GST handled separately)

Total Returns = -₹1,000 + (-₹410) = -₹1,410
Total GST Reduction = ₹180 + ₹90 = ₹270
```

---

### 4. Returns GST Calculation

**Formula:**
```
For each return:
  1. Find original order item
  2. Calculate original item values:
     itemGrossSales = item.subtotal OR (item.priceWithoutTax × item.quantity)
     itemGstPerUnit = item.igst + item.cgst + item.sgst
     itemTotalGst = itemGstPerUnit × item.quantity
     itemTotalWithTax = itemGrossSales + itemTotalGst
  
  3. Calculate refund ratio:
     refundRatio = refundAmount / itemTotalWithTax
     ⚠️ NOTE: refundAmount is AUTHORITATIVE - it represents the actual processed refund
     For partial quantity returns, refundAmount may NOT equal (returnedQuantity / totalQuantity) × itemTotalWithTax
  
  4. Calculate GST portion of refund:
     refundGst = itemTotalGst × refundRatio
  
  5. Reduce total GST:
     totalGst -= refundGst
```

**Explanation:**
- **`refundAmount` is the source of truth** - it represents the actual processed refund amount
- Uses actual GST data from the original order item
- Calculates the proportion of the refund that represents GST
- **Reduces the total GST by this amount separately** - this prevents double-counting since `refundAmount` (used in Returns Amount) already includes GST
- **For partial quantity returns**: The refund ratio is calculated from `refundAmount`, not from quantity ratios
- **Important**: The GST portion (`refundGst`) is deducted from `gstAmount` separately, while the full `refundAmount` (including GST) is used in `returnsAmount`. This ensures accurate accounting without double-counting.

**Example:**
```
Original Order Item:
  subtotal = ₹1,000
  igst = ₹180, cgst = ₹0, sgst = ₹0
  quantity = 1
  
  itemGrossSales = ₹1,000
  itemTotalGst = ₹180 × 1 = ₹180
  itemTotalWithTax = ₹1,000 + ₹180 = ₹1,180

Return:
  refundAmount = ₹1,180 (full refund)
  
  refundRatio = ₹1,180 / ₹1,180 = 1.0
  refundGst = ₹180 × 1.0 = ₹180
  
  → GST reduced by ₹180
```

---

### 5. Net Sales

**Formula:**
```
For each group:
  netSales = grossSales + returnsAmount
  
Total Net Sales = Sum of all group netSales
```

**Explanation:**
- Gross Sales remains unchanged (total sales before returns)
- Returns Amount is added (as negative value, **gross portion only, excluding GST**)
- **Note**: `returnsAmount` contains only `refundGross` (gross portion), NOT the full `refundAmount`
- GST portion of refund is handled separately in `gstAmount` calculation
- Result: Net sales after accounting for returns (gross portion only)
- **This reduces Net Sales by the gross portion of refunds only (GST handled separately)**

**Example:**
```
Gross Sales = ₹120,940
Returns Amount = -₹0 (no returns)

Net Sales = ₹120,940 + (-₹0) = ₹120,940
```

---

### 6. Total Value

**Formula:**
```
For each group:
  totalValue = netSales + gstAmount
  
Total Value = Sum of all group totalValue
```

**Explanation:**
- Net Sales (after returns)
- Plus GST Amount (after return adjustments)
- Result: Total value including GST

**Example:**
```
Net Sales = ₹120,940
GST Amount = ₹19,916

Total Value = ₹120,940 + ₹19,916 = ₹140,856
```

---

### 7. Order Count

**Formula:**
```
For each group:
  Track unique order IDs in a Set
  orderCount = number of unique orders
  
Total Order Count = Sum of all group orderCount
```

**Explanation:**
- Each order is counted only once per group
- Even if an order has multiple items, it's counted once

**Example:**
```
Order 1: 3 items → counted as 1 order
Order 2: 1 item → counted as 1 order
Order 3: 2 items → counted as 1 order

Total Order Count = 3 (not 6)
```

---

### 8. Return Count

**Formula:**
```
For each return:
  returnCount += 1
  
Total Return Count = Sum of all returnCount
```

**Explanation:**
- Simple count of return records
- Each return is counted once

---

## Verification Example

Based on your data:
- **Gross Sales**: ₹120,940
- **GST Amount**: ₹19,916
- **Net Sales**: ₹120,940
- **Total Value**: ₹140,856
- **Order Count**: 23
- **Return Count**: 0

### Verification Steps:

1. **Gross Sales = ₹120,940**
   - Sum of all `subtotal` (or `priceWithoutTax × quantity`) from 23 orders
   - ✅ This is the total sales excluding GST

2. **GST Amount = ₹19,916**
   - Sum of all `(igst + cgst + sgst) × quantity` from 23 orders
   - ✅ This is the total GST collected

3. **Net Sales = ₹120,940**
   - Formula: `₹120,940 + ₹0` (no returns)
   - ✅ Matches Gross Sales since there are no returns

4. **Total Value = ₹140,856**
   - Formula: `₹120,940 + ₹19,916 = ₹140,856`
   - ✅ Net Sales + GST = Total Value

5. **Order Count = 23**
   - Count of unique orders
   - ✅ 23 distinct orders

6. **Return Count = 0**
   - No returns in the date range
   - ✅ Correct

---

## Calculation Flow Diagram

```
For each Order:
  ├─ For each Order Item:
  │   ├─ Calculate Gross Sales = subtotal OR (priceWithoutTax × quantity)
  │   ├─ Calculate GST = (igst + cgst + sgst) × quantity
  │   └─ Add to group totals
  │
  └─ Count order once per group

For each Return:
  ├─ Find original order item
  ├─ Calculate refund ratio
  ├─ Calculate refund GST portion
  ├─ Subtract from GST total
  └─ Add negative refund to returnsAmount

Final Calculations:
  ├─ Net Sales = Gross Sales + Returns Amount
  └─ Total Value = Net Sales + GST Amount
```

---

## Important Notes

1. **Gross Sales does NOT include GST** - it's the base amount before tax
2. **Returns are negative values** - they reduce net sales
3. **GST is calculated from actual order item data** - not estimated
4. **Order count is unique** - each order counted once per group
5. **Subtotal is preferred** - it includes discounts already applied
6. **Returns GST is proportional** - based on original item's GST breakdown

---

## Accounting Logic: Returns and GST

### How Returns Affect Calculations

**Returns Amount:**
- `returnsAmount = -refundGross` (gross portion only, excluding GST)
- Represents only the gross portion of customer refunds (product value, excluding GST)
- GST portion of refund is handled separately in `gstAmount`
- Reduces Net Sales: `netSales = grossSales + returnsAmount` (only gross portion reduces net sales)
- **Why not use full `refundAmount`?** Because `refundAmount` includes GST, and GST is already subtracted separately from `gstAmount`. Using full `refundAmount` would deduct GST twice.

**GST Adjustment:**
- `gstAmount` is reduced separately by `refundGst` (GST portion of refund)
- This ensures GST is tracked independently from sales

**Why This Approach:**
- `refundAmount` is authoritative and includes GST (total refund to customer)
- `returnsAmount` shows the full refund impact on Net Sales
- `gstAmount` tracks tax separately, allowing independent GST reporting
- Both adjustments are necessary for accurate financial reporting

**Example:**
```
Original Sale: ₹1,000 (gross) + ₹180 (GST) = ₹1,180 total
Return: refundAmount = ₹1,180 (full refund including GST)

Calculations:
- returnsAmount = -₹1,180 (reduces Net Sales)
- refundGst = ₹180 (GST portion)
- gstAmount = originalGst - ₹180 (GST reduced separately)
- netSales = grossSales - ₹1,180 (reduced by full refund)
- totalValue = netSales + gstAmount (accounts for both adjustments)
```

This approach ensures:
- Returns Amount accurately reflects total customer refunds
- GST is properly tracked and adjusted
- Net Sales shows sales after returns
- Total Value correctly represents final value including GST

---

## Partial Item Returns

### Current Implementation

The system supports two types of returns:

1. **Full Item Refunds**: The entire order item is returned
2. **Partial Refunds**: A portion of the order item is returned (represented by `refundAmount`)

### Key Assumption: `refundAmount` is Authoritative

**For partial quantity returns (e.g., return 1 out of 3 units), `refundAmount` is treated as the source of truth and GST is reversed proportionally.**

This means:
- The `refundAmount` field contains the exact refund amount (including GST) that was processed
- The GST portion is calculated proportionally based on the original item's GST breakdown
- The calculation does NOT assume equal distribution across quantities
- If a customer returns 1 unit out of 3, the refund amount may not be exactly 1/3 of the total (due to discounts, promotions, etc.)

### Calculation Logic for Partial Returns

```
1. Get original order item values:
   - itemGrossSales = subtotal OR (priceWithoutTax × quantity)
   - itemTotalGst = (igst + cgst + sgst) × quantity
   - itemTotalWithTax = itemGrossSales + itemTotalGst

2. Calculate refund ratio:
   refundRatio = refundAmount / itemTotalWithTax
   
   Note: This ratio may NOT equal (returnedQuantity / totalQuantity)
   because refundAmount is the actual processed refund amount.

3. Calculate GST portion:
   refundGst = itemTotalGst × refundRatio
   refundGross = itemGrossSales × refundRatio

4. Apply to totals:
   - returnsAmount -= refundGross (gross portion only, GST handled separately)
   - gstAmount -= refundGst (GST portion, proportionally calculated)
   - **Note**: We use `refundGross` (not full `refundAmount`) to avoid double-counting GST
```

### Example: Partial Return

```
Original Order Item:
  quantity = 3
  subtotal = ₹3,000 (₹1,000 per unit excluding GST)
  igst = ₹180 per unit
  itemTotalGst = ₹180 × 3 = ₹540
  itemTotalWithTax = ₹3,000 + ₹540 = ₹3,540

Return:
  refundAmount = ₹1,200 (actual refund processed)
  Note: This is NOT ₹1,180 (1/3 of ₹3,540) - may include adjustments
  
  refundRatio = ₹1,200 / ₹3,540 = 0.3390
  
  refundGross = ₹3,000 × 0.3390 = ₹1,017
  refundGst = ₹540 × 0.3390 = ₹183
  
  Applied:
    returnsAmount = -₹1,200 (authoritative)
    gstAmount -= ₹183 (proportional)
```

### Future Considerations

If quantity-based returns are introduced in the future:
- The `refundAmount` field remains authoritative
- GST reversal continues to use proportional calculation
- The system does NOT assume `refundAmount = (returnedQuantity / totalQuantity) × itemTotalWithTax`
- This allows for flexible refund scenarios (partial refunds, restocking fees, etc.)

