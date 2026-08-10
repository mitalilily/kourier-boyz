# Sales Report - Complete Calculation Formulas

This document provides the **exact formulas** used in the Sales Report, using all keywords from the codebase.

---

## Data Source Fields (Order Item)

From `Order.items[]`:
- `item.quantity` - Number of units ordered
- `item.subtotal` - Line subtotal, including item-level discounts, **excluding GST**
- `item.priceWithoutTax` - Price per unit exclusive of GST
- `item.igst` - IGST amount per unit (inter-state)
- `item.cgst` - CGST amount per unit (intra-state)
- `item.sgst` - SGST amount per unit (intra-state)

From `Return`:
- `returnRecord.refundAmount` - Total refund amount (includes GST) - **authoritative source**
- `returnRecord.orderItem` - Reference to original order item
- `returnRecord.order` - Reference to original order

---

## 1. GROSS SALES (Excluding GST)

### Formula:
```javascript
// For each order item:
quantity = item.quantity || 0

IF (item.subtotal !== undefined && item.subtotal !== null && item.subtotal > 0):
    grossSales = item.subtotal
ELSE:
    grossSales = (item.priceWithoutTax || 0) × quantity

// Aggregate for group:
group.grossSales += grossSales
```

### Keywords Used:
- `item.subtotal` (priority)
- `item.priceWithoutTax` (fallback)
- `item.quantity`
- `group.grossSales`

### Explanation:
- **Priority**: Uses `subtotal` (line total after discounts, excluding GST)
- **Fallback**: Uses `priceWithoutTax × quantity` if subtotal unavailable
- **Result**: Total sales value **before GST** and **after discounts**

---

## 2. GST AMOUNT

### Formula:
```javascript
// For each order item:
gstPerUnit = (item.igst || 0) + (item.cgst || 0) + (item.sgst || 0)
totalGst = gstPerUnit × quantity

// Aggregate for group:
group.gstAmount += totalGst
```

### Keywords Used:
- `item.igst`
- `item.cgst`
- `item.sgst`
- `item.quantity`
- `gstPerUnit`
- `totalGst`
- `group.gstAmount`

### Explanation:
- Sums all GST components per unit (IGST + CGST + SGST)
- Multiplies by quantity to get total GST for the line item
- For returns: proportionally reduces GST (see Returns section)

---

## 3. RETURNS AMOUNT (Negative Value)

### Formula - Step 1: Get Original Order Item Values
```javascript
// From return record, get actualOrderItem:
actualOrderItem = returnRecord.orderItem OR find in returnRecord.order.items[]

// Calculate original item values:
itemGstPerUnit = (actualOrderItem.igst || 0) + (actualOrderItem.cgst || 0) + (actualOrderItem.sgst || 0)

IF (actualOrderItem.subtotal !== undefined && actualOrderItem.subtotal !== null && actualOrderItem.subtotal > 0):
    itemGrossSales = actualOrderItem.subtotal
ELSE:
    itemGrossSales = (actualOrderItem.priceWithoutTax || 0) × (actualOrderItem.quantity || 1)

itemTotalGst = itemGstPerUnit × (actualOrderItem.quantity || 1)
itemTotalWithTax = itemGrossSales + itemTotalGst
```

### Formula - Step 2: Calculate Refund Breakdown
```javascript
refundAmount = returnRecord.refundAmount || 0  // Authoritative source (includes GST)

IF (itemTotalWithTax > 0):
    refundRatio = refundAmount / itemTotalWithTax
    refundGross = itemGrossSales × refundRatio
    refundGst = itemTotalGst × refundRatio
ELSE:
    // Fallback: assume refund is all gross
    refundGross = refundAmount
    refundGst = 0
```

### Formula - Step 3: If Order Item Not Found (Fallback)
```javascript
// Conservative estimate using 18% GST assumption:
refundGross = refundAmount / 1.18
refundGst = refundAmount - refundGross
```

### Formula - Step 4: Apply to Group
```javascript
// Apply returns as negative values:
group.returnsAmount -= refundGross  // Only gross portion (negative value)
group.gstAmount -= refundGst        // Reduce GST separately
group.returnCount += 1
```

### Keywords Used:
- `returnRecord.refundAmount` (authoritative)
- `actualOrderItem.subtotal`
- `actualOrderItem.priceWithoutTax`
- `actualOrderItem.quantity`
- `actualOrderItem.igst`, `actualOrderItem.cgst`, `actualOrderItem.sgst`
- `itemGrossSales`
- `itemTotalGst`
- `itemTotalWithTax`
- `refundRatio`
- `refundGross`
- `refundGst`
- `group.returnsAmount`
- `group.returnCount`

### Explanation:
- `refundAmount` is **authoritative** - represents actual processed refund (includes GST)
- Calculates `refundRatio` based on original item total (including GST)
- Applies ratio to get `refundGross` (gross portion) and `refundGst` (GST portion)
- **Double-counting prevention**: Only gross portion (`refundGross`) goes to `returnsAmount`, GST adjusted separately
- **Why not use full `refundAmount`?** Because `refundAmount` includes GST. If we subtract full `refundAmount` from `returnsAmount` AND also subtract `refundGst` from `gstAmount`, GST gets deducted twice. Using only `refundGross` ensures GST is deducted exactly once (from `gstAmount` only).

---

## 4. NET SALES

### Formula:
```javascript
// For each group:
netSales = row.grossSales + row.returnsAmount
```

### Keywords Used:
- `row.grossSales`
- `row.returnsAmount` (negative value, contains only `refundGross`)
- `netSales`

### Explanation:
- Net Sales = Gross Sales + Returns Amount
- Since `returnsAmount` is negative (contains `-refundGross`), this effectively subtracts returns
- Formula: `netSales = grossSales - refundGross`
- **Note**: GST impact is NOT included here (handled separately in GST Amount)

---

## 5. TOTAL VALUE

### Formula:
```javascript
// For each group:
totalValue = netSales + row.gstAmount
```

### Expanded Formula:
```javascript
totalValue = (row.grossSales + row.returnsAmount) + row.gstAmount
          = (grossSales - refundGross) + (originalGst - refundGst)
          = grossSales + originalGst - refundGross - refundGst
```

### Keywords Used:
- `netSales`
- `row.gstAmount` (already adjusted for returns)
- `totalValue`

### Explanation:
- Total Value = Net Sales + GST Amount
- Represents final value **including GST**, after accounting for returns
- **No double-counting**: GST portion of refund is only subtracted once (from `gstAmount`)

---

## 6. ORDER COUNT

### Formula:
```javascript
// For each order item:
orderId = order._id.toString()

IF (orderId NOT IN orderCountMap[identifier]):
    orderCountMap[identifier].add(orderId)
    group.orderCount += 1
```

### Keywords Used:
- `order._id`
- `orderCountMap` (Map<string, Set<string>>)
- `group.orderCount`

### Explanation:
- Uses a Set to track unique order IDs per group
- Each order is counted **only once** per group, regardless of number of items

---

## 7. RETURN COUNT

### Formula:
```javascript
// For each return:
group.returnCount += 1
```

### Keywords Used:
- `group.returnCount`

### Explanation:
- Simple counter - increments for each return record processed

---

## Complete Calculation Flow

### For Order Items:
```
1. Calculate grossSales:
   IF subtotal exists: grossSales = subtotal
   ELSE: grossSales = priceWithoutTax × quantity

2. Calculate totalGst:
   gstPerUnit = igst + cgst + sgst
   totalGst = gstPerUnit × quantity

3. Add to group:
   group.grossSales += grossSales
   group.gstAmount += totalGst
   IF order not counted: group.orderCount += 1
```

### For Returns:
```
1. Get original item values:
   itemGrossSales = actualOrderItem.subtotal OR (priceWithoutTax × quantity)
   itemTotalGst = (igst + cgst + sgst) × quantity
   itemTotalWithTax = itemGrossSales + itemTotalGst

2. Calculate refund breakdown:
   refundRatio = refundAmount / itemTotalWithTax
   refundGross = itemGrossSales × refundRatio
   refundGst = itemTotalGst × refundRatio

3. Apply to group:
   group.returnsAmount -= refundGross  (negative value)
   group.gstAmount -= refundGst
   group.returnCount += 1
```

### Final Calculations:
```
1. netSales = grossSales + returnsAmount
            = grossSales - refundGross

2. totalValue = netSales + gstAmount
              = (grossSales - refundGross) + (originalGst - refundGst)
              = grossSales + originalGst - refundGross - refundGst
```

---

## Key Principles

1. **Gross Sales**: Always uses amounts **excluding GST** (subtotal or priceWithoutTax)
2. **GST Separate**: GST is calculated and tracked separately from gross sales
3. **Returns Handling**: 
   - `refundAmount` is authoritative (includes GST)
   - Only gross portion (`refundGross`) reduces `returnsAmount`
   - GST portion (`refundGst`) reduces `gstAmount` separately
4. **No Double-Counting**: GST from refunds is only subtracted once (from `gstAmount`)
5. **Net Sales**: Gross Sales + Returns Amount (returns are negative, so effectively subtracts)
6. **Total Value**: Net Sales + GST Amount (final value including tax, after returns)

---

## Example Calculation

### Order Item:
```
quantity = 2
subtotal = ₹1,000
igst = ₹90, cgst = ₹0, sgst = ₹0

grossSales = ₹1,000
gstPerUnit = ₹90 + ₹0 + ₹0 = ₹90
totalGst = ₹90 × 2 = ₹180

group.grossSales = ₹1,000
group.gstAmount = ₹180
```

### Return (Full Return):
```
refundAmount = ₹1,180 (includes GST) - AUTHORITATIVE SOURCE
itemGrossSales = ₹1,000
itemTotalGst = ₹180
itemTotalWithTax = ₹1,180

refundRatio = ₹1,180 / ₹1,180 = 1.0
refundGross = ₹1,000 × 1.0 = ₹1,000  (gross portion)
refundGst = ₹180 × 1.0 = ₹180        (GST portion)

// Apply to group:
group.returnsAmount -= ₹1,000  → returnsAmount = -₹1,000  (only gross portion)
group.gstAmount -= ₹180        → gstAmount = ₹0          (GST separately)

// Why not use full refundAmount (₹1,180)?
// If we did: returnsAmount -= ₹1,180 AND gstAmount -= ₹180
// Then: Net impact = -₹1,360 ❌ (GST deducted twice)
// Correct way: returnsAmount -= ₹1,000, gstAmount -= ₹180
// Then: Net impact = -₹1,180 ✅ (GST deducted once)
```

### Final Values:
```
grossSales = ₹1,000
returnsAmount = -₹1,000
gstAmount = ₹0

netSales = ₹1,000 + (-₹1,000) = ₹0
totalValue = ₹0 + ₹0 = ₹0
```

---

## All Keywords Reference

### Order Item Fields:
- `item.quantity`
- `item.subtotal`
- `item.priceWithoutTax`
- `item.igst`
- `item.cgst`
- `item.sgst`

### Return Fields:
- `returnRecord.refundAmount`
- `returnRecord.orderItem`
- `returnRecord.order`

### Calculated Variables:
- `grossSales`
- `gstPerUnit`
- `totalGst`
- `itemGrossSales`
- `itemTotalGst`
- `itemTotalWithTax`
- `refundRatio`
- `refundGross`
- `refundGst`
- `netSales`
- `totalValue`

### Group Aggregates:
- `group.grossSales`
- `group.gstAmount`
- `group.returnsAmount`
- `group.orderCount`
- `group.returnCount`

### Data Structures:
- `groupedData` (Map<string, SalesReportRow>)
- `orderCountMap` (Map<string, Set<string>>)

