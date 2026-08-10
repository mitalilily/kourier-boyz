# KOURIER_BOYZ – Calculations, Metrics & Formula Reference

**Purpose**: Document ALL formulas, metrics, and calculation logic used across the KOURIER_BOYZ platform so that product, engineering, finance, and compliance teams clearly understand how every number is derived.

**Last Updated**: Based on current codebase implementation

---

## Table of Contents

1. [ORDER & PRICING CALCULATIONS](#1-order--pricing-calculations)
2. [TAX (GST) CALCULATIONS](#2-tax-gst-calculations)
3. [INVOICE CALCULATIONS (BUYER)](#3-invoice-calculations-buyer)
4. [INVOICE & SETTLEMENT CALCULATIONS (SELLER)](#4-invoice--settlement-calculations-seller)
5. [REFUND, RETURN & CREDIT/DEBIT NOTE CALCULATIONS](#5-refund-return--creditdebit-note-calculations)
6. [SELLER LEDGER METRICS](#6-seller-ledger-metrics)
7. [ADMIN DASHBOARD METRICS](#7-admin-dashboard-metrics)
8. [REPORTING MODULES](#8-reporting-modules)
9. [TDS & TCS CALCULATIONS](#9-tds--tcs-calculations)

---

## 1. ORDER & PRICING CALCULATIONS

### 1.1 Item Base Price

**Description**: The base price per unit of an item at the time of order.

**Inputs**:
- `product.price` or `variant.price` (product-level or variant-level price)

**Formula**:
```
Item Base Price = product.price OR variant.price (if variant exists)
```

**Example**:
- Product base price: ₹1,000
- Variant price: ₹1,200 (if variant selected)
- Item Base Price = ₹1,200

**Where it is used**: Order creation, cart calculations, buyer UI

---

### 1.2 Variant Price Handling

**Description**: Variant price overrides product price when a variant is selected.

**Inputs**:
- `product.price` (base product price)
- `variant.price` (variant-specific price, if variant exists)

**Formula**:
```
IF variant exists AND variant.price is set:
    Price Per Unit = variant.price
ELSE:
    Price Per Unit = product.price
```

**Example**:
- Product price: ₹500
- Variant (Size: Large) price: ₹600
- Selected variant: Large
- Price Per Unit = ₹600

**Where it is used**: Product detail page, cart, order creation

---

### 1.3 Quantity Multiplication Logic

**Description**: Line item total before discounts is calculated by multiplying price per unit by quantity.

**Inputs**:
- `pricePerUnit` (item base price or variant price)
- `quantity` (number of units ordered)

**Formula**:
```
Line Item Subtotal (Before Discounts) = pricePerUnit × quantity
```

**Example**:
- Price per unit: ₹500
- Quantity: 3
- Line Item Subtotal = ₹500 × 3 = ₹1,500

**Where it is used**: Order creation, cart totals, invoice line items

---

### 1.4 Item-Level Discount Calculation

**Description**: Discount applied to a specific line item (e.g., seller coupons, product discounts).

**Inputs**:
- `lineItemSubtotal` (price per unit × quantity)
- `discountPercent` (discount percentage, if percentage-based)
- `discountAmount` (fixed discount amount, if fixed)

**Formula**:
```
IF percentage discount:
    Item Discount = lineItemSubtotal × (discountPercent / 100)
ELSE IF fixed discount:
    Item Discount = discountAmount
ELSE:
    Item Discount = 0
```

**Example**:
- Line item subtotal: ₹1,000
- Discount: 20% off
- Item Discount = ₹1,000 × (20 / 100) = ₹200

**Where it is used**: Order creation, cart, buyer UI (item-level savings), invoice

---

### 1.5 Order-Level Discount / Coupon Calculation

**Description**: Discount applied at order level (e.g., platform coupons, global promotions).

**Inputs**:
- `orderSubtotal` (sum of all line item subtotals after item-level discounts)
- `coupon.discountType` ('PERCENTAGE' or 'FIXED')
- `coupon.discountValue` (discount percentage or fixed amount)

**Formula**:
```
IF coupon discount type is PERCENTAGE:
    Order Discount = orderSubtotal × (discountValue / 100)
ELSE IF coupon discount type is FIXED:
    Order Discount = discountValue
ELSE:
    Order Discount = 0
```

**Example**:
- Order subtotal (after item discounts): ₹5,000
- Coupon: ₹500 off
- Order Discount = ₹500

**Where it is used**: Order creation, cart, checkout, invoice

---

### 1.6 Effective Price After Discount

**Description**: Final price per unit that customer pays after all discounts.

**Inputs**:
- `pricePerUnit` (base price)
- `itemDiscountAmount` (total discount on this line item)
- `quantity` (number of units)

**Formula**:
```
Effective Price Per Unit = (lineItemSubtotal - itemDiscountAmount) / quantity
```

**Where**:
```
lineItemSubtotal = pricePerUnit × quantity
```

**Example**:
- Price per unit: ₹500
- Quantity: 2
- Line item subtotal: ₹1,000
- Item discount: ₹200
- Effective Price Per Unit = (₹1,000 - ₹200) / 2 = ₹400

**Where it is used**: Order items (`item.effectivePrice`), invoice, buyer UI

---

### 1.7 Shipping Charge Calculation

**Description**: Shipping charge can be calculated per item or per shipment. The system uses a priority-based calculation.

**Inputs**:
- `product.freeShipping` (boolean flag)
- `product.requiresShipping` (boolean flag)
- `product.shippingCharge` (product-level shipping charge, optional)
- `seller.defaultShippingRate` (seller's default shipping rate)
- `seller.freeShippingThreshold` (order value threshold for free shipping)
- `orderSubtotal` (order subtotal after discounts)

**Priority Order (First Match Wins)**:

```
1. IF product.freeShipping = true:
       Shipping Charge = ₹0

2. ELSE IF product.requiresShipping = false:
       Shipping Charge = ₹0

3. ELSE IF seller.freeShippingThreshold > 0 AND orderSubtotal >= freeShippingThreshold:
       Shipping Charge = ₹0

4. ELSE IF product.shippingCharge is set AND product.shippingCharge > 0:
       Shipping Charge = product.shippingCharge

5. ELSE:
       Shipping Charge = seller.defaultShippingRate
```

**Formula**:
```
Shipping Charge = Apply priority logic above
```

**Example**:
- Product shipping charge: ₹50
- Seller default shipping: ₹30
- Order subtotal: ₹800
- Free shipping threshold: ₹1,000
- Result: Shipping Charge = ₹50 (Priority 4: product.shippingCharge)

**Where it is used**: Order creation (`order.shipping`), cart, checkout, invoice, settlement (seller shipping earnings)

**Important Notes**:
- Shipping charge is stored in `order.shipping`
- Shipping is included in `order.total` (used for TDS calculation)
- Shipping is NOT included in `order.subtotal` (used for TCS calculation)

---

### 1.8 COD Charge Calculation

**Description**: Cash on Delivery (COD) charge applied when payment method is COD.

**Inputs**:
- `order.paymentMethod` ('cod' or other)
- COD charge configuration (from courier/service provider)

**Formula**:
```
IF paymentMethod = 'cod':
    COD Charge = Courier COD Fee (from courier service)
ELSE:
    COD Charge = ₹0
```

**Example**:
- Payment method: COD
- Courier COD fee: ₹30
- COD Charge = ₹30

**Where it is used**: Order creation (`order.sellerCodFee`), settlement (deducted from seller payout), invoice

**Important Notes**:
- COD charge is deducted from seller settlement payout
- COD charge is stored at shipment level (`sellerShipment.codCharge`) for AWB-wise tracking

---

### 1.9 Final Payable Amount Calculation (Buyer)

**Description**: Total amount buyer needs to pay, including all items, discounts, shipping, and taxes.

**Inputs**:
- `order.subtotal` (sum of all line item subtotals after item-level discounts)
- `order.discount` (order-level discount/coupon amount)
- `order.shipping` (shipping charge)
- `order.tax` (total GST amount)

**Formula**:
```
Final Payable Amount = subtotal - discount + shipping + tax
```

**Where**:
```
subtotal = Sum of (pricePerUnit × quantity - itemDiscount) for all items
discount = Order-level coupon discount
shipping = Calculated shipping charge (see section 1.7)
tax = Total GST (see section 2.2)
```

**Example**:
- Subtotal: ₹10,000
- Order discount: ₹1,000
- Shipping: ₹50
- Tax (GST): ₹1,620 (18% on ₹9,000)
- Final Payable Amount = ₹10,000 - ₹1,000 + ₹50 + ₹1,620 = ₹9,670

**Where it is used**: Buyer UI (`order.total`), checkout, payment gateway, invoice grand total

---

## 2. TAX (GST) CALCULATIONS

### 2.1 Taxable Value Definition

**Description**: The amount on which GST is calculated. Excludes shipping charges.

**Inputs**:
- `item.priceWithoutTax` (price per unit excluding GST)
- `item.quantity` (number of units)
- `item.subtotal` (line subtotal after discounts, excluding GST)

**Formula**:
```
IF item.subtotal is available AND item.subtotal > 0:
    Taxable Value (Line Item) = item.subtotal
ELSE:
    Taxable Value (Line Item) = item.priceWithoutTax × item.quantity

Taxable Value (Order) = Sum of Taxable Value for all line items
```

**Example**:
- Price without tax: ₹1,000
- Quantity: 2
- Subtotal (after discount): ₹1,800
- Taxable Value = ₹1,800

**Where it is used**: GST calculation, invoice, TCS calculation, reports

---

### 2.2 IGST Calculation Formula

**Description**: Integrated GST (IGST) applies to inter-state transactions (seller state ≠ customer state).

**Inputs**:
- `taxableValue` (line item taxable value)
- `gstRatePercent` (GST rate percentage, e.g., 18 for 18%)

**Formula**:
```
IGST Amount = (taxableValue × gstRatePercent) / 100
```

**Example**:
- Taxable value: ₹1,000
- GST rate: 18%
- IGST Amount = (₹1,000 × 18) / 100 = ₹180

**Where it is used**: Order creation (`item.igst`), invoice, settlement, GST reports

---

### 2.3 CGST + SGST Split Calculation

**Description**: Central GST (CGST) and State GST (SGST) apply to intra-state transactions (seller state = customer state). Each is half of the total GST.

**Inputs**:
- `taxableValue` (line item taxable value)
- `gstRatePercent` (GST rate percentage, e.g., 18 for 18%)

**Formula**:
```
Total GST = (taxableValue × gstRatePercent) / 100
CGST Amount = Total GST / 2
SGST Amount = Total GST / 2
```

**Example**:
- Taxable value: ₹1,000
- GST rate: 18%
- Total GST = (₹1,000 × 18) / 100 = ₹180
- CGST Amount = ₹180 / 2 = ₹90
- SGST Amount = ₹180 / 2 = ₹90

**Where it is used**: Order creation (`item.cgst`, `item.sgst`), invoice, settlement, GST reports

---

### 2.4 Intra-State vs Inter-State Decision Logic

**Description**: Determines whether to apply IGST (inter-state) or CGST+SGST (intra-state).

**Inputs**:
- `sellerGstStateCode` (first 2 digits of seller's GSTIN, e.g., "27" for Maharashtra)
- `shippingStateCode` (GST state code of customer shipping address)

**Formula**:
```
IF sellerGstStateCode == shippingStateCode:
    Tax Type = 'CGST_SGST' (Intra-state)
ELSE:
    Tax Type = 'IGST' (Inter-state)
```

**Logic**:
```
Normalize both state codes (convert state names to codes if needed)
Compare normalized codes
If match → Intra-state → CGST + SGST
If no match → Inter-state → IGST
```

**Example**:
- Seller GST state: "27" (Maharashtra)
- Customer shipping state: "27" (Maharashtra)
- Result: Intra-state → CGST + SGST

**Example (Inter-state)**:
- Seller GST state: "27" (Maharashtra)
- Customer shipping state: "33" (Tamil Nadu)
- Result: Inter-state → IGST

**Where it is used**: Order creation, invoice generation, tax compliance reports

---

### 2.5 GST Rounding Rules

**Description**: GST amounts (IGST, CGST, SGST) are rounded according to admin-configured rounding mode. The rounding mode is configurable by admin in Settings → Calculations & Formulas → GST Rounding.

**Configuration**: 
- Admin setting: `AdminInvoiceSettings.gstRoundingMode`
- Location: Admin Panel → System Settings → Calculations & Formulas → GST Rounding
- Default: `ROUND_HALF_UP` (Standard mathematical rounding)

**Rounding Modes Available**:
- `ROUND_HALF_UP`: Standard rounding (default) - Round .5 up (e.g., 1.5 → 2, 1.4 → 1)
- `ROUND_HALF_DOWN`: Round .5 down (e.g., 1.5 → 1, 1.6 → 2)
- `ROUND_UP`: Always round up (e.g., 1.1 → 2, 1.9 → 2)
- `ROUND_DOWN`: Always round down (e.g., 1.9 → 1, 1.1 → 1)

**Formula**:
```
GST Amount (Rounded) = Round((taxableValue × gstRatePercent) / 100, gstRoundingMode)
CGST Amount (Rounded) = Round((taxableValue × gstRatePercent) / 200, gstRoundingMode)
SGST Amount (Rounded) = Round((taxableValue × gstRatePercent) / 200, gstRoundingMode)
```

**Example**:
- Taxable value: ₹999.99
- GST rate: 18%
- Rounding mode: ROUND_HALF_UP (default)
- GST Amount = Round((₹999.99 × 18) / 100) = Round(₹179.9982) = ₹180.00

**Where GST Rounding is Applied**:
1. **Order Creation**: All GST amounts (IGST, CGST, SGST) are rounded when orders are created
2. **Invoice Generation**: GST amounts displayed in invoices (buyer & seller) use the configured rounding mode
3. **Tax Calculations**: All tax-related calculations including line-item GST, order-level GST totals, HSN summary aggregations
4. **Reports & Statements**: Sales reports, tax reports, settlement calculations, and all financial statements that include GST amounts

**Important Notes**:
- GST rounding mode is separate from invoice total rounding mode (`roundingMode` used in section 3.5)
- Changes to GST rounding mode apply immediately to all new orders and invoices
- Existing orders are NOT recalculated automatically (they retain their original rounded GST amounts)
- The rounding mode is fetched once per order/invoice and reused for all items to ensure consistency

---

### 2.6 Line-Item Tax vs Order-Level Tax

**Description**: GST is calculated at line item level, then aggregated at order level.

**Formula**:
```
FOR EACH line item:
    Item Tax = IGST OR (CGST + SGST)

Order Tax = Sum of Item Tax for all line items
```

**Example**:
- Item 1 taxable value: ₹1,000, GST rate: 18%, IGST: ₹180
- Item 2 taxable value: ₹2,000, GST rate: 12%, IGST: ₹240
- Order Tax = ₹180 + ₹240 = ₹420

**Where it is used**: Order creation (`order.tax`), invoice, buyer UI

---

### 2.7 Tax Shown to Buyer vs Tax Used for Settlement

**Description**: Tax shown to buyer is the same as tax used for settlement calculations.

**Buyer Invoice Tax**:
```
Tax Shown to Buyer = order.tax (total GST for all items)
```

**Settlement**:
```
Tax is NOT separately calculated for settlement
Settlement uses order.subtotal (taxable value, excluding GST)
GST is seller's tax obligation, not a settlement component
```

**Where it is used**: 
- Buyer: Invoice, checkout, payment
- Settlement: Uses taxable value (subtotal), not tax amount

---

### 2.8 HSN/SAC Aggregation Logic

**Description**: HSN/SAC codes are aggregated at invoice level for GST compliance.

**Inputs**:
- `item.hsnSacCode` (HSN/SAC code for each line item)
- `item.gstRatePercent` (GST rate for each line item)
- `item.subtotal` (taxable value for each line item)
- `item.igst`, `item.cgst`, `item.sgst` (tax amounts)

**Formula**:
```
Group line items by HSN/SAC code and GST rate

FOR EACH unique (HSN/SAC code, GST rate) combination:
    Taxable Value Total = Sum of item.subtotal for all items with this combination
    IGST Total = Sum of item.igst × quantity for all items with this combination
    CGST Total = Sum of item.cgst × quantity for all items with this combination
    SGST Total = Sum of item.sgst × quantity for all items with this combination
```

**Example**:
- Item 1: HSN 1234, 18%, Taxable: ₹1,000, IGST: ₹180
- Item 2: HSN 1234, 18%, Taxable: ₹500, IGST: ₹90
- Item 3: HSN 5678, 12%, Taxable: ₹2,000, IGST: ₹240

**Aggregated**:
- HSN 1234 @ 18%: Taxable: ₹1,500, IGST: ₹270
- HSN 5678 @ 12%: Taxable: ₹2,000, IGST: ₹240

**Where it is used**: Invoice HSN summary (`order.invoice.hsnSummary`), GST export files, compliance reports

---

## 3. INVOICE CALCULATIONS (BUYER)

### 3.1 Line Item Totals

**Description**: Total amount for each line item on the invoice.

**Inputs**:
- `item.priceWithoutTax` (price per unit excluding GST)
- `item.quantity` (number of units)
- `item.subtotal` (line subtotal after discounts, excluding GST)
- `item.igst`, `item.cgst`, `item.sgst` (GST amounts per unit)
- `item.discountAmount` (item-level discount)

**Formula**:
```
Line Item Total (Excluding Tax) = item.subtotal
                                  OR (item.priceWithoutTax × item.quantity)

Line Item Tax = (item.igst + item.cgst + item.sgst) × item.quantity

Line Item Total (Including Tax) = Line Item Total (Excluding Tax) + Line Item Tax
```

**Example**:
- Price without tax: ₹1,000
- Quantity: 2
- Subtotal: ₹1,800 (after discount)
- IGST per unit: ₹162 (18% on ₹900 per unit)
- Line Item Tax = ₹162 × 2 = ₹324
- Line Item Total (Including Tax) = ₹1,800 + ₹324 = ₹2,124

**Where it is used**: Invoice line items, buyer invoice display

---

### 3.2 Discount Presentation vs Actual Deduction

**Description**: Discounts are shown separately on invoice but deducted from subtotal.

**Presentation**:
```
Subtotal (Before Discount): ₹10,000
Less: Discount: -₹1,000
Subtotal (After Discount): ₹9,000
```

**Actual Calculation**:
```
Subtotal (After Discount) = Subtotal (Before Discount) - Discount Amount
```

**Formula**:
```
Invoice Subtotal = Sum of all line item subtotals (already includes item discounts)
Less: Order Discount = order.discount (order-level coupon discount)
Net Subtotal = Invoice Subtotal - Order Discount
```

**Where it is used**: Invoice display, buyer UI

---

### 3.3 Tax Display Logic

**Description**: GST is shown separately on invoice and added to net subtotal.

**Formula**:
```
Net Subtotal = Sum of line item subtotals - Order discount
Tax (IGST) = Sum of (item.igst × quantity) for all items
Tax (CGST) = Sum of (item.cgst × quantity) for all items
Tax (SGST) = Sum of (item.sgst × quantity) for all items
Total Tax = Tax (IGST) + Tax (CGST) + Tax (SGST)
```

**Where it is used**: Invoice tax breakdown, buyer invoice display

---

### 3.4 Grand Total

**Description**: Final total amount payable by buyer.

**Formula**:
```
Grand Total = Net Subtotal + Shipping + Total Tax
            = (Subtotal - Order Discount) + Shipping + Tax
```

**Where**:
```
Subtotal = Sum of line item subtotals (after item discounts)
Order Discount = order.discount
Shipping = order.shipping
Tax = order.tax (total GST)
```

**Example**:
- Subtotal: ₹10,000
- Order discount: ₹1,000
- Shipping: ₹50
- Tax: ₹1,620
- Grand Total = (₹10,000 - ₹1,000) + ₹50 + ₹1,620 = ₹10,670

**Where it is used**: Invoice grand total, checkout, payment gateway

---

### 3.5 Rounded Total Logic

**Description**: Final invoice total may be rounded according to admin settings (if configured). This is separate from GST rounding (see section 2.5).

**Configuration**: 
- Admin setting: `AdminInvoiceSettings.roundingMode` (for invoice totals)
- Location: Admin Panel → Settings → Invoice Settings
- Default: `ROUND_HALF_UP` (Standard mathematical rounding)
- **Note**: This is different from `gstRoundingMode` which controls GST amount rounding (see section 2.5)

**Formula**:
```
Rounded Total = Round(Grand Total, roundingMode)
```

**Rounding Modes** (from admin invoice settings):
- `ROUND_HALF_UP`: Standard rounding (default) - Round .5 up (e.g., 1.5 → 2, 1.4 → 1)
- `ROUND_HALF_DOWN`: Round .5 down (e.g., 1.5 → 1, 1.6 → 2)
- `ROUND_UP`: Always round up (e.g., 1.1 → 2, 1.9 → 2)
- `ROUND_DOWN`: Always round down (e.g., 1.9 → 1, 1.1 → 1)

**Important Distinction**:
- **Invoice Total Rounding** (`roundingMode`): Applied to the final invoice grand total
- **GST Rounding** (`gstRoundingMode`): Applied to individual GST amounts (IGST, CGST, SGST) - see section 2.5

**Where it is used**: Invoice final total (if rounding is enabled in admin invoice settings)

---

### 3.6 Amount in Words Conversion

**Description**: Grand total converted to words (e.g., "Ten Thousand Six Hundred Seventy Rupees Only").

**Formula**:
```
Amount in Words = Convert number to Indian numbering system words
                 + "Rupees Only"
```

**Example**:
- Grand Total: ₹10,670
- Amount in Words: "Ten Thousand Six Hundred Seventy Rupees Only"

**Where it is used**: Invoice footer, buyer invoice display

---

### 3.7 Invoice Regeneration Rules

**Description**: Rules for regenerating invoices and handling invoice numbers.

**Number Reuse**:
- Invoice numbers are NOT reused
- Each invoice has a unique, sequential invoice number
- Format: `{prefix}-{stateCode}-{sequenceNumber}`

**Date Handling**:
- Invoice date = Order date (or date of invoice generation, if regenerated)
- If invoice is regenerated, new invoice date is used

**Regeneration**:
- Invoice can be regenerated if needed
- New invoice number is assigned (sequential)
- Original invoice is preserved (not deleted)

**Where it is used**: Invoice generation (`order.invoice`), invoice download

---

## 4. INVOICE & SETTLEMENT CALCULATIONS (SELLER)

### 4.1 Gross Order Value

**Description**: Total value of order including all items, before any platform deductions.

**Inputs**:
- `order.subtotal` (sum of line item subtotals, after discounts, excluding GST)
- `order.shipping` (shipping charge)

**Formula**:
```
Gross Order Value = order.subtotal + order.shipping
                  = Taxable Value + Shipping Charge
```

**Example**:
- Subtotal: ₹10,000
- Shipping: ₹50
- Gross Order Value = ₹10,000 + ₹50 = ₹10,050

**Where it is used**: Settlement calculation (`saleAmount`), seller earnings

---

### 4.2 Marketplace Commission Calculation

**Description**: Platform commission deducted from seller's gross order value. Commission calculation and rounding are configurable by admin in Settings → Calculations & Formulas → Settlement Calculations.

**Configuration**: 
- Admin setting: `AdminSettlementSettings.defaultCommissionType` (PERCENTAGE or FIXED)
- Admin setting: `AdminSettlementSettings.defaultCommissionValue` (percentage 0-100 or fixed amount)
- Admin setting: `AdminSettlementSettings.commissionRoundingMode` (rounding mode for commission amounts)
- Admin setting: `AdminSettlementSettings.includeShippingInSaleAmount` (whether shipping is included in commission base)
- Location: Admin Panel → System Settings → Calculations & Formulas → Settlement Calculations

**Inputs**:
- `saleAmount` (gross order value: subtotal + shipping, or subtotal only if `includeShippingInSaleAmount` is false)
- `commissionType` ('PERCENTAGE' or 'FIXED' from admin settlement settings or seller override)
- `commissionValue` (commission percentage or fixed amount)

**Formula**:
```
// Determine commission base
IF includeShippingInSaleAmount = true:
    Commission Base = order.subtotal + order.shipping
ELSE:
    Commission Base = order.subtotal

// Calculate commission
IF commissionType = 'PERCENTAGE':
    Commission (Unrounded) = Commission Base × (commissionValue / 100)
ELSE IF commissionType = 'FIXED':
    Commission (Unrounded) = commissionValue
ELSE:
    Commission (Unrounded) = 0

// Apply rounding
Commission = Round(Commission (Unrounded), commissionRoundingMode)
```

**Example**:
- Subtotal: ₹10,000
- Shipping: ₹50
- Commission type: PERCENTAGE
- Commission value: 15%
- Include shipping in sale amount: false
- Commission rounding mode: ROUND_HALF_UP
- Commission Base = ₹10,000 (shipping excluded)
- Commission (Unrounded) = ₹10,000 × (15 / 100) = ₹1,500.00
- Commission = Round(₹1,500.00) = ₹1,500

**Where it is used**: Settlement calculation (`sellerCommissionAmount`), seller ledger (DEBIT entry), settlement invoice

**When Credited/Debited**:
- Debited: When order becomes eligible for settlement (order delivered + return window passed)
- Credited: When commission is reversed (e.g., order return, cancellation)

**Who Bears Cost**: Seller (deducted from seller payout)

---

### 4.3 Platform Fee Calculation

**Description**: Payment gateway fee for prepaid orders (paid by seller).

**Inputs**:
- `order.paymentGateway` (payment gateway used: 'razorpay', 'stripe', etc.)
- `paymentMeta.pgFee` (payment gateway fee amount)

**Formula**:
```
Platform Fee (PG Fee) = paymentMeta.pgFee
                      = Amount charged by payment gateway
```

**Example**:
- Payment gateway: Razorpay
- PG fee: ₹50 (2% of ₹2,500)
- Platform Fee = ₹50

**Where it is used**: Settlement calculation (`sellerPgFee`), seller ledger (DEBIT entry)

**When Credited/Debited**:
- Debited: When order becomes eligible for settlement (only for prepaid orders)

**Who Bears Cost**: Seller (deducted from seller payout)

---

### 4.4 Courier Charge Deduction

**Description**: Forward courier charge deducted from seller settlement.

**Inputs**:
- `sellerShipment.courierCharge` (AWB-wise courier charge for forward shipment)
- Sum of all `courierCharge` from seller shipments in the order

**Formula**:
```
Courier Charge = Sum of sellerShipment.courierCharge for all shipments
                = Forward shipping cost charged by courier
```

**Example**:
- Shipment 1 courier charge: ₹80
- Shipment 2 courier charge: ₹100
- Courier Charge = ₹80 + ₹100 = ₹180

**Where it is used**: Settlement calculation (`sellerCourierCost`), seller ledger (DEBIT entry), settlement invoice

**When Credited/Debited**:
- Debited: When order becomes eligible for settlement

**Who Bears Cost**: Seller (deducted from seller payout)

---

### 4.5 COD Fee Deduction

**Description**: COD fee deducted from seller settlement (for COD orders).

**Inputs**:
- `sellerShipment.codCharge` (AWB-wise COD charge, if payment method is COD)
- Sum of all `codCharge` from seller shipments in the order

**Formula**:
```
IF order.paymentMethod = 'cod':
    COD Fee = Sum of sellerShipment.codCharge for all shipments
ELSE:
    COD Fee = 0
```

**Example**:
- Payment method: COD
- Shipment COD charge: ₹30
- COD Fee = ₹30

**Where it is used**: Settlement calculation (`sellerCodFee`), seller ledger (DEBIT entry), settlement invoice

**When Credited/Debited**:
- Debited: When order becomes eligible for settlement (for COD orders)
- Credited: When COD fee is reversed (e.g., order return before delivery)

**Who Bears Cost**: Seller (deducted from seller payout)

---

### 4.6 Refund Impact on Settlement

**Description**: When order is refunded, seller's earnings are reversed.

**Formula**:
```
Refund Reversals Created:
    - REFUND_ITEM: Reverses item earnings (DEBIT to seller)
    - REFUND_SHIPPING: Reverses shipping earnings (DEBIT to seller)
    - REFUND_COD: Reverses COD fee (CREDIT to seller, if applicable)
    - REFUND_GST: Reverses GST component (if applicable)

Net Impact = Sum of all refund reversal amounts
           = Negative value (reduces seller's settlement)
```

**Where it is used**: Seller ledger entries, settlement batch calculations, settlement invoice

**When Credited/Debited**:
- Debited: When refund is processed (item and shipping earnings reversed)

**Who Bears Cost**: Seller (earnings are reversed)

---

### 4.7 Replacement Impact on Settlement

**Description**: Replacement orders are ₹0 orders and do not affect settlement.

**Formula**:
```
IF order.isReplacement = true:
    Settlement Amount = ₹0
    No ledger entries created
    Not included in settlement batches
```

**Where it is used**: Settlement eligibility check, batch generation (replacement orders are excluded)

**When Credited/Debited**: Not applicable (replacement orders are not settled)

**Who Bears Cost**: Platform (replacement orders are free for buyer)

---

### 4.8 Net Settlement Amount Formula

**Description**: Final amount payable to seller after all deductions and additions. All amounts are rounded according to admin-configured rounding modes before final calculation.

**Configuration**: 
- Admin setting: `AdminSettlementSettings.settlementAmountRoundingMode` (rounding for final settlement amounts)
- Admin setting: `AdminSettlementSettings.feeRoundingMode` (rounding for fees: courier, COD, PG)
- Admin setting: `AdminSettlementSettings.commissionRoundingMode` (rounding for commission amounts)
- Admin setting: `AdminSettlementSettings.ledgerEntryRoundingMode` (rounding for ledger entry amounts)
- Admin setting: `AdminSettlementSettings.roundLedgerAggregation` (whether to round aggregated totals)
- Admin setting: `AdminSettlementSettings.ledgerAggregationRoundingMode` (rounding for ledger aggregation)
- Admin setting: `AdminSettlementSettings.calculationOrder` (COMMISSION_FIRST or FEES_FIRST)
- Admin setting: `AdminSettlementSettings.allowNegativeSettlements` (whether negative amounts are allowed)
- Location: Admin Panel → System Settings → Calculations & Formulas → Settlement Calculations

**Inputs** (from settlement batch, aggregated from ledger entries):
- `totalItemEarnings` (sum of ORDER_ITEM_CREDIT entries, rounded if configured)
- `totalShippingEarned` (sum of SHIPPING_CREDIT entries, rounded if configured)
- `totalCommission` (sum of COMMISSION_DEBIT entries, rounded using commissionRoundingMode)
- `totalCourierCost` (sum of SHIPPING_COST_DEBIT entries, rounded using feeRoundingMode)
- `totalCodFee` (sum of COD_FEE_DEBIT entries, net of reversals, rounded using feeRoundingMode)
- `totalPgFee` (sum of PAYMENT_GATEWAY_FEE entries, rounded using feeRoundingMode)
- `totalReturnItemReversal` (sum of RETURN_ITEM_REVERSAL entries, rounded if configured)
- `totalReturnShippingReversal` (sum of RETURN_SHIPPING_REVERSAL entries, rounded if configured)
- `totalCommissionReversal` (sum of COMMISSION_REVERSAL entries, rounded if configured)
- `totalManualAdjustmentsCredit` (credit adjustments, rounded if configured)
- `totalManualAdjustmentsDebit` (debit adjustments, rounded if configured)
- `totalTdsAmount` (TDS deducted, net of reversals)
- `totalTcsAmount` (TCS deducted, net of reversals)

**Formula**:
```
// Step 1: Round individual components (if ledger aggregation rounding is enabled)
IF roundLedgerAggregation = true:
    totalItemEarnings = Round(totalItemEarnings, ledgerAggregationRoundingMode)
    totalShippingEarned = Round(totalShippingEarned, ledgerAggregationRoundingMode)
    totalCommission = Round(totalCommission, commissionRoundingMode)
    totalCourierCost = Round(totalCourierCost, feeRoundingMode)
    totalCodFee = Round(totalCodFee, feeRoundingMode)
    totalPgFee = Round(totalPgFee, feeRoundingMode)
    // ... round other components similarly

// Step 2: Calculate totals
Total Credits = totalItemEarnings 
              + totalShippingEarned 
              + totalCommissionReversal 
              + totalManualAdjustmentsCredit

Total Debits = totalCommission 
             + totalCourierCost 
             + netCodFee (totalCodFee - totalReverseCodFee)
             + totalPgFee 
             + totalReturnItemReversal 
             + totalReturnShippingReversal 
             + totalManualAdjustmentsDebit 
             + totalTdsAmount 
             + totalTcsAmount

// Step 3: Calculate net amount
Net Settlement Amount (Unrounded) = Total Credits - Total Debits

// Step 4: Apply final rounding and negative balance handling
IF allowNegativeSettlements = false:
    Net Settlement Amount = Max(0, Round(Net Settlement Amount (Unrounded), settlementAmountRoundingMode))
ELSE:
    Net Settlement Amount = Round(Net Settlement Amount (Unrounded), settlementAmountRoundingMode)
```

**Example**:
- Item earnings: ₹50,000.50 (rounded to ₹50,001 if rounding enabled)
- Shipping earned: ₹500.25 (rounded to ₹500 if rounding enabled)
- Commission: ₹7,500.75 (rounded to ₹7,501 using commissionRoundingMode)
- Courier cost: ₹1,000.50 (rounded to ₹1,001 using feeRoundingMode)
- COD fee: ₹300.25 (rounded to ₹300 using feeRoundingMode)
- PG fee: ₹200.00
- TDS: ₹50.00
- TCS: ₹500.00
- Total Credits = ₹50,001 + ₹500 = ₹50,501
- Total Debits = ₹7,501 + ₹1,001 + ₹300 + ₹200 + ₹50 + ₹500 = ₹9,552
- Net Settlement Amount (Unrounded) = ₹50,501 - ₹9,552 = ₹40,949
- Net Settlement Amount = Round(₹40,949, settlementAmountRoundingMode) = ₹40,949

**Where it is used**: Settlement batch (`batch.totalNetPayout`), seller payout, settlement invoice

**When Credited/Debited**:
- Credited: When settlement batch is created (seller becomes eligible for payout)
- Debited: When payout is made (SETTLEMENT_PAYOUT ledger entry)

**Who Bears Cost**: 
- Credits: Platform pays seller
- Debits: Seller pays platform (deductions)

---

### 4.9 Settlement Invoice Total

**Description**: Total amount on seller's settlement invoice (same as net settlement amount).

**Formula**:
```
Settlement Invoice Total = Net Settlement Amount
                         = Total Credits - Total Debits
```

**Where it is used**: Seller settlement invoice, seller payout confirmation

---

## 5. REFUND, RETURN & CREDIT/DEBIT NOTE CALCULATIONS

### 5.1 Item Refund Calculation

**Description**: Refund amount for item(s) when order is returned.

**Inputs**:
- `orderItem.subtotal` (line item subtotal after discounts, excluding GST)
- `orderItem.quantity` (quantity ordered)
- `returnItem.quantity` (quantity returned)
- `orderItem.igst`, `orderItem.cgst`, `orderItem.sgst` (GST per unit)
- `orderItem.effectivePrice` (effective price per unit paid by buyer)

**Formula**:
```
Item Refund Ratio = returnItem.quantity / orderItem.quantity

Item Refund (Gross) = orderItem.subtotal × Item Refund Ratio
Item Refund (GST) = (orderItem.igst + orderItem.cgst + orderItem.sgst) × returnItem.quantity
Item Refund (Total) = Item Refund (Gross) + Item Refund (GST)
```

**Example**:
- Order item subtotal: ₹2,000
- Quantity ordered: 2
- Quantity returned: 1
- GST per unit: ₹180
- Item Refund Ratio = 1 / 2 = 0.5
- Item Refund (Gross) = ₹2,000 × 0.5 = ₹1,000
- Item Refund (GST) = ₹180 × 1 = ₹180
- Item Refund (Total) = ₹1,000 + ₹180 = ₹1,180

**Where it is used**: Return processing, refund calculation, buyer credit note, seller ledger (REFUND_ITEM entry)

---

### 5.2 Partial Refund Logic

**Description**: When only some items or partial quantity is returned.

**Formula**:
```
FOR EACH returned item:
    Partial Refund = Calculate Item Refund (see section 5.1)

Total Partial Refund = Sum of Partial Refund for all returned items
```

**Where it is used**: Partial return processing, refund calculation, credit notes

---

### 5.3 Shipping Refund Rules

**Description**: Shipping charge refund logic.

**Rules**:
1. If entire order is returned: Shipping is fully refunded
2. If partial return: Shipping refund depends on business rules (typically no shipping refund for partial returns)

**Formula**:
```
IF entire order returned:
    Shipping Refund = order.shipping
ELSE IF partial return:
    Shipping Refund = 0 (typically, check business rules)
```

**Example**:
- Order shipping: ₹50
- Entire order returned: Yes
- Shipping Refund = ₹50

**Where it is used**: Return processing, refund calculation, seller ledger (REFUND_SHIPPING entry)

---

### 5.4 Tax Reversal Logic

**Description**: GST amount that needs to be reversed when items are returned.

**Formula**:
```
Tax Reversal = Sum of (item.igst + item.cgst + item.sgst) × returnQuantity 
             for all returned items
```

**Example**:
- Item 1 returned: IGST ₹180, Quantity: 1
- Item 2 returned: CGST ₹90, SGST ₹90, Quantity: 2
- Tax Reversal = (₹180 × 1) + ((₹90 + ₹90) × 2) = ₹180 + ₹360 = ₹540

**Where it is used**: Return processing, refund calculation, seller ledger (REFUND_GST entry, if applicable)

---

### 5.5 Seller Debit Note Formula

**Description**: Debit note generated when seller owes platform money (post-invoice corrections).

**Inputs**:
- Original settlement invoice amount
- Correction/adjustment amount (debit)

**Formula**:
```
Debit Note Amount = Correction Amount (Debit to Seller)

Debit Note Total = Debit Note Amount + GST (if applicable)
```

**Example**:
- Original invoice: ₹50,000
- Correction: +₹2,000 (seller owes more)
- Debit Note Amount = ₹2,000

**Where it is used**: Post-invoice corrections, settlement adjustments, GST compliance

**When Generated**: When debit-type manual adjustment is made to a settlement batch that already has an invoice

---

### 5.6 Seller Credit Note Formula

**Description**: Credit note generated when platform owes seller money (post-invoice corrections).

**Inputs**:
- Original settlement invoice amount
- Correction/adjustment amount (credit)

**Formula**:
```
Credit Note Amount = Correction Amount (Credit to Seller)

Credit Note Total = Credit Note Amount + GST (if applicable)
```

**Example**:
- Original invoice: ₹50,000
- Correction: -₹2,000 (platform owes seller more)
- Credit Note Amount = ₹2,000

**Where it is used**: 
- Post-invoice corrections
- Commission reversals (after invoice generation)
- Settlement adjustments (credit-type)
- GST compliance

**When Generated**: 
- When credit-type manual adjustment is made to a settlement batch that already has an invoice
- When commission is reversed after settlement invoice is generated
- When any correction increases seller's taxable value after invoice generation

---

### 5.7 Impact on Seller Ledger

**Description**: How refunds, returns, and credit/debit notes affect seller ledger.

**Refund Entries (DEBIT to Seller)**:
```
REFUND_ITEM: Reverses item earnings
REFUND_SHIPPING: Reverses shipping earnings
REFUND_COD: Reverses COD fee (CREDIT, if COD order was refunded)
REFUND_GST: Reverses GST component (if applicable)
```

**Return Reversal Entries (DEBIT to Seller)**:
```
RETURN_ITEM_REVERSAL: Reverses item earnings for returned items
RETURN_SHIPPING_REVERSAL: Reverses shipping earnings (if shipping refunded)
COMMISSION_REVERSAL: Reverses commission (CREDIT to seller)
RETURN_REVERSE_COURIER_COST: Reverses courier cost (if applicable)
```

**Adjustment Entries**:
```
MANUAL_ADJUSTMENT: Credit or debit adjustment (from admin)
```

**Formula**:
```
Seller Ledger Balance = Opening Balance 
                      + Sum of CREDIT entries 
                      - Sum of DEBIT entries
```

**Where it is used**: Seller ledger reports, settlement calculations, balance tracking

---

### 5.8 Impact on Admin Ledger

**Description**: How refunds, returns, and credit/debit notes affect admin/platform ledger.

**Platform Expenses**:
```
PLATFORM_REFUND_EXPENSE: Platform-funded refunds (expense to platform)
```

**Impact**:
- Platform refunds reduce platform's net revenue
- Returns reduce platform's commission income
- Credit notes to sellers reduce platform's net revenue

**Where it is used**: Admin financial reports, platform P&L calculations

---

## 6. SELLER LEDGER METRICS

### 6.1 Opening Balance

**Description**: Seller's ledger balance at the start of a period.

**Formula**:
```
Opening Balance = Sum of all CREDIT entries (before period start)
                - Sum of all DEBIT entries (before period start)
```

**Where it is used**: Seller ledger reports, balance statements, settlement calculations

---

### 6.2 Debit Entry Logic

**Description**: Entries that reduce seller's balance (seller owes money or money is deducted). Entry amounts are rounded according to admin settings when created.

**Configuration**: 
- Admin setting: `AdminSettlementSettings.ledgerEntryRoundingMode` (rounding for individual ledger entries)
- Admin setting: `AdminSettlementSettings.roundLedgerEntriesIndividually` (whether to round each entry)
- Admin setting: `AdminSettlementSettings.feeRoundingMode` (rounding for fee entries: courier, COD, PG)
- Admin setting: `AdminSettlementSettings.commissionRoundingMode` (rounding for commission entries)
- Location: Admin Panel → System Settings → Calculations & Formulas → Settlement Calculations

**Debit Entry Reasons**:
- `COMMISSION_DEBIT`: Marketplace commission (rounded using `commissionRoundingMode`)
- `SHIPPING_COST_DEBIT`: Courier forward charges (rounded using `feeRoundingMode`)
- `COD_FEE_DEBIT`: COD fee (for COD orders, rounded using `feeRoundingMode`)
- `PAYMENT_GATEWAY_FEE`: Payment gateway fee (for prepaid orders, rounded using `feeRoundingMode`)
- `REFUND_ITEM`: Item refund (reverses earnings, rounded using `ledgerEntryRoundingMode`)
- `REFUND_SHIPPING`: Shipping refund (reverses earnings, rounded using `ledgerEntryRoundingMode`)
- `RETURN_ITEM_REVERSAL`: Return item reversal (rounded using `ledgerEntryRoundingMode`)
- `RETURN_SHIPPING_REVERSAL`: Return shipping reversal (rounded using `ledgerEntryRoundingMode`)
- `TDS_DEBIT`: TDS deduction (Section 194-O)
- `TCS_DEBIT`: TCS deduction (GST Section 52)
- `MANUAL_ADJUSTMENT`: Manual debit adjustment (from admin, rounded using `ledgerEntryRoundingMode`)
- `SETTLEMENT_CARRY_FORWARD`: Negative balance from previous settlement batch (rounded using `ledgerEntryRoundingMode`)

**Formula**:
```
// Step 1: Round entry amount (if enabled)
IF roundLedgerEntriesIndividually = true:
    Debit Entry Amount = Round(Original Amount, ledgerEntryRoundingMode)
    // For fee entries, use feeRoundingMode
    // For commission entries, use commissionRoundingMode
ELSE:
    Debit Entry Amount = Original Amount (no rounding)

// Step 2: Apply to running balance
Running Balance After Debit = Running Balance Before - Debit Entry Amount
```

**Where it is used**: Seller ledger entries, settlement calculations, balance tracking

---

### 6.3 Credit Entry Logic

**Description**: Entries that increase seller's balance (seller earns money or money is credited). Entry amounts are rounded according to admin settings when created.

**Configuration**: 
- Admin setting: `AdminSettlementSettings.ledgerEntryRoundingMode` (rounding for individual ledger entries)
- Admin setting: `AdminSettlementSettings.roundLedgerEntriesIndividually` (whether to round each entry)
- Location: Admin Panel → System Settings → Calculations & Formulas → Settlement Calculations

**Credit Entry Reasons**:
- `ORDER_ITEM_CREDIT`: Item earnings (from order subtotal, rounded using `ledgerEntryRoundingMode`)
- `SHIPPING_CREDIT`: Shipping earnings (from order shipping charge, rounded using `ledgerEntryRoundingMode`)
- `COMMISSION_REVERSAL`: Commission reversal (commission refunded, rounded using `commissionRoundingMode`)
- `COD_FEE_REVERSAL`: COD fee reversal (COD fee refunded, rounded using `feeRoundingMode`)
- `TDS_REVERSAL`: TDS reversal (TDS refunded)
- `TCS_REVERSAL`: TCS reversal (TCS refunded)
- `MANUAL_ADJUSTMENT`: Manual credit adjustment (from admin, rounded using `ledgerEntryRoundingMode`)
- `SETTLEMENT_PAYOUT`: Settlement payout (money paid to seller, rounded using `settlementAmountRoundingMode`)

**Formula**:
```
// Step 1: Round entry amount (if enabled)
IF roundLedgerEntriesIndividually = true:
    Credit Entry Amount = Round(Original Amount, ledgerEntryRoundingMode)
    // For commission reversals, use commissionRoundingMode
    // For fee reversals, use feeRoundingMode
    // For settlement payouts, use settlementAmountRoundingMode
ELSE:
    Credit Entry Amount = Original Amount (no rounding)

// Step 2: Apply to running balance
Running Balance After Credit = Running Balance Before + Credit Entry Amount
```

**Where it is used**: Seller ledger entries, settlement calculations, balance tracking

---

### 6.4 Running Balance Formula

**Description**: Seller's current balance at any point in time. Ledger entry amounts are rounded according to admin settings before being used in balance calculations.

**Configuration**: 
- Admin setting: `AdminSettlementSettings.ledgerEntryRoundingMode` (rounding for individual ledger entries)
- Admin setting: `AdminSettlementSettings.roundLedgerEntriesIndividually` (whether to round each entry)
- Admin setting: `AdminSettlementSettings.roundLedgerAggregation` (whether to round aggregated totals)
- Admin setting: `AdminSettlementSettings.ledgerAggregationRoundingMode` (rounding for aggregated totals)
- Location: Admin Panel → System Settings → Calculations & Formulas → Settlement Calculations

**Formula**:
```
// Step 1: Round individual ledger entry amounts (if enabled)
FOR EACH ledger entry:
    IF roundLedgerEntriesIndividually = true:
        entry.amount = Round(entry.amount, ledgerEntryRoundingMode)
    ELSE:
        entry.amount = entry.amount (no rounding)

// Step 2: Calculate running balance
Running Balance = Opening Balance 
                + Sum of all CREDIT entries (up to current point)
                - Sum of all DEBIT entries (up to current point)

// Step 3: Round aggregated totals (if enabled)
IF roundLedgerAggregation = true:
    Running Balance = Round(Running Balance, ledgerAggregationRoundingMode)
```

**Calculation Method**:
```
1. Start with Opening Balance (or 0 if no previous entries)
2. For each ledger entry (sorted by date/time):
   a. Round entry amount if roundLedgerEntriesIndividually is enabled
   b. IF entryType = 'CREDIT':
          Running Balance += entry.amount
      ELSE IF entryType = 'DEBIT':
          Running Balance -= entry.amount
3. Round final running balance if roundLedgerAggregation is enabled
4. Current Running Balance = Final calculated balance
```

**Example**:
- Opening Balance: ₹10,000
- Credit: ORDER_ITEM_CREDIT ₹5,000.50 (rounded to ₹5,001 if rounding enabled)
- Debit: COMMISSION_DEBIT ₹750.25 (rounded to ₹750 if rounding enabled)
- Credit: SHIPPING_CREDIT ₹50.75 (rounded to ₹51 if rounding enabled)
- Running Balance = ₹10,000 + ₹5,001 - ₹750 + ₹51 = ₹14,302 (if rounding enabled)

**Where it is used**: Seller ledger reports, balance statements, settlement eligibility, settlement batch calculations

---

### 6.5 Settlement Adjustment Logic

**Description**: How settlement batches adjust seller's ledger balance.

**When Settlement Batch is Created**:
```
Ledger entries are linked to settlement batch:
    - All CREDIT entries for orders in batch
    - All DEBIT entries for orders in batch
    - Manual adjustments linked to batch
    - TDS/TCS entries for batch

Balance Impact = Sum of batch's CREDIT entries - Sum of batch's DEBIT entries
```

**When Settlement Batch is Paid**:
```
SETTLEMENT_PAYOUT entry is created:
    - Entry Type: CREDIT
    - Amount: batch.totalNetPayout
    - Reason: SETTLEMENT_PAYOUT

Balance Impact = +batch.totalNetPayout (increases seller balance)
```

**Where it is used**: Settlement processing, balance tracking, payout reconciliation

---

### 6.6 Negative Balance Handling

**Description**: How negative balances are handled in seller ledger.

**Negative Balance Creation**:
```
IF Running Balance < 0:
    Negative Balance = Absolute value of Running Balance
    Seller owes platform money
```

**Negative Balance Carry-Forward**:
```
IF settlement batch has negative totalNetPayout:
    SETTLEMENT_CARRY_FORWARD entry is created:
        - Entry Type: DEBIT
        - Amount: Absolute value of negative payout
        - Reason: SETTLEMENT_CARRY_FORWARD
        - settlementBatch: null (unlinked, picked up in next batch)

This negative balance is deducted from next settlement batch
```

**Formula**:
```
Next Settlement Net Payout = Calculated Credits - Calculated Debits - Negative Balance Carry-Forward
```

**Example**:
- Current settlement: -₹5,000 (negative)
- SETTLEMENT_CARRY_FORWARD entry: ₹5,000 (DEBIT)
- Next settlement credits: ₹50,000
- Next settlement debits: ₹40,000
- Next settlement net payout = ₹50,000 - ₹40,000 - ₹5,000 = ₹5,000

**Where it is used**: Settlement batch generation, negative balance tracking, seller notifications

---

## 7. ADMIN DASHBOARD METRICS

### 7.1 GMV (Gross Merchandise Value)

**Description**: Total value of all orders placed on the platform (before discounts, including shipping and tax).

**Formula**:
```
GMV = Sum of order.total for all orders (regardless of status)
    = Sum of (subtotal + shipping + tax) for all orders
```

**Components Included**:
- Order subtotal (item prices)
- Shipping charges
- GST/tax
- Discounts are NOT deducted (GMV is gross)

**Components Excluded**:
- Cancelled orders (may be excluded, depending on business rules)
- Refunded orders (may be excluded, depending on business rules)

**Where it is used**: Admin dashboard, business reports, growth metrics

---

### 7.2 Net Revenue

**Description**: Platform's net revenue from marketplace operations.

**Formula**:
```
Net Revenue = Total Commission Collected 
            + Total Payment Gateway Fees (if platform keeps PG fees)
            - Total Refunds (platform-funded)
            - Total Platform Expenses
```

**Components Included**:
- Marketplace commission (from all settled orders)
- Payment gateway fees (if platform keeps them)

**Components Excluded**:
- Seller payouts
- Platform-funded refunds
- Marketing expenses
- Operational expenses

**Where it is used**: Admin dashboard, financial reports, P&L statements

---

### 7.3 Platform Earnings

**Description**: Total money earned by platform from marketplace operations.

**Formula**:
```
Platform Earnings = Total Commission Collected 
                  + Total Payment Gateway Fees (if applicable)
                  - Total Platform Expenses
```

**Components Included**:
- Commission from all sellers
- Payment gateway fees (if platform keeps them)
- Other platform fees (if any)

**Components Excluded**:
- Seller payouts
- Refunds (seller-funded)

**Where it is used**: Admin dashboard, revenue reports, financial statements

---

### 7.4 Tax Collected

**Description**: Total GST collected from buyers (for display/reporting purposes).

**Formula**:
```
Tax Collected = Sum of order.tax for all orders
               = Sum of (IGST + CGST + SGST) for all orders
```

**Where it is used**: Admin dashboard, tax reports, GST compliance reports

**Note**: This is GST collected from buyers. Platform may have its own GST obligations on commission income.

---

### 7.5 Refund Totals

**Description**: Total amount refunded to buyers.

**Formula**:
```
Refund Totals = Sum of refund.refundAmount for all refunds
```

**Where it is used**: Admin dashboard, refund reports, financial reconciliation

---

### 7.6 Pending Settlements

**Description**: Total amount pending to be paid to sellers.

**Formula**:
```
Pending Settlements = Sum of batch.totalNetPayout 
                    for all batches where status = 'PENDING'
```

**Where it is used**: Admin dashboard, settlement due reports, cash flow tracking

---

### 7.7 Completed Settlements

**Description**: Total amount already paid to sellers.

**Formula**:
```
Completed Settlements = Sum of batch.totalNetPayout 
                      for all batches where status = 'PAID'
```

**Where it is used**: Admin dashboard, settlement reports, financial reconciliation

---

### 7.8 Seller Payable Amount

**Description**: Amount that platform needs to pay to a specific seller.

**Formula**:
```
Seller Payable Amount = Sum of batch.totalNetPayout 
                      for all seller's batches where status = 'PENDING'
```

**Where it is used**: Seller settlement reports, payout processing, seller dashboard

---

## 8. REPORTING MODULES

### 8.1 Sales Report (Seller & Admin)

**What Data It Shows**:
- Gross Sales (excluding GST)
- GST Amount
- Returns Amount (negative value)
- Net Sales
- Total Value (including GST)
- Order Count
- Return Count

**Calculations Used**:
- Gross Sales: Sum of `item.subtotal` OR `item.priceWithoutTax × quantity`
- GST Amount: Sum of `(item.igst + item.cgst + item.sgst) × quantity`
- Returns Amount: Proportional refund breakdown (see SALES_REPORT_FORMULAS_COMPLETE.md)
- Net Sales: Gross Sales + Returns Amount (returns are negative)
- Total Value: Net Sales + GST Amount

**Time Period Logic**:
- Filters by date range (fromDate, toDate)
- Groups by day/week/month (configurable)

**Filters Impact**:
- Date filter: Filters orders by order date
- Seller filter: Filters orders by seller (admin report only)
- Order status filter: Filters by order status (optional)

**Source of Truth**:
- Orders collection (`Order` model)
- Returns collection (`Return` model)
- Uses `item.subtotal`, `item.priceWithoutTax`, `item.igst`, `item.cgst`, `item.sgst`, `item.quantity`
- Returns use `returnRecord.refundAmount` (authoritative source)

---

### 8.2 Settlement Due Report (Admin)

**What Data It Shows**:
- Settlement Amount
- Settlement Period (fromDate - toDate)
- Due Date (toDate + 2 days)
- Settlement Cycle (Daily/Weekly/Fortnightly/Monthly)
- Seller Information
- Status (PENDING/PAID)

**Calculations Used**:
- Settlement Amount: `batch.totalNetPayout`
- Due Date: `batch.toDate + 2 days`
- Settlement Cycle: From `SellerSettlementSettings`

**Time Period Logic**:
- Shows all settlement batches
- Filters by due date range (optional)
- Filters by amount range (optional)

**Filters Impact**:
- Status filter: PENDING/ALL
- Seller filter: Filters by seller
- Settlement cycle filter: Filters by cycle type
- Due date range: Filters by due date
- Amount range: Filters by settlement amount

**Source of Truth**:
- `SellerSettlementBatch` collection
- `SellerSettlementSettings` collection
- Uses `batch.totalNetPayout`, `batch.fromDate`, `batch.toDate`, `batch.status`

---

### 8.3 TDS Report (Admin & Seller)

**What Data It Shows**:
- Gross Sales (including GST)
- TDS Rate (0.1%)
- TDS Amount
- TDS Reversals
- Net TDS Amount

**Calculations Used**:
- Gross Sales: Sum of `order.total` for eligible orders
- TDS Amount: `grossSales × 0.1%` (with exemption rules)
- TDS Reversals: Sum of `TDS_REVERSAL` ledger entries
- Net TDS Amount: TDS Amount - TDS Reversals

**Time Period Logic**:
- Filters by Financial Year (April 1 - March 31)
- Groups by settlement batch

**Filters Impact**:
- Date filter: Filters by settlement batch date
- Seller filter: Filters by seller (admin report only)

**Source of Truth**:
- `SellerSettlementBatch` collection (`totalTdsAmount`, `tdsBaseAmount`)
- `SellerLedgerEntry` collection (`TDS_REVERSAL` entries)

---

### 8.4 TCS Report (Admin & Seller)

**What Data It Shows**:
- Taxable Sales Value (excluding GST)
- TCS Rate (1% for inter-state, 0.5%+0.5% for intra-state)
- TCS Amount (IGST/CGST/SGST breakdown)
- TCS Reversals
- Net TCS Amount

**Calculations Used**:
- Taxable Sales Value: Sum of `order.subtotal` for eligible orders
- TCS Amount: Based on supply type (inter-state: IGST 1%, intra-state: CGST 0.5% + SGST 0.5%)
- TCS Reversals: Sum of `TCS_REVERSAL` ledger entries
- Net TCS Amount: TCS Amount - TCS Reversals

**Time Period Logic**:
- Filters by Financial Year (April 1 - March 31)
- Groups by settlement batch

**Filters Impact**:
- Date filter: Filters by settlement batch date
- Seller filter: Filters by seller (admin report only)
- Supply type filter: Inter-state / Intra-state
- Customer type filter: Registered / Unregistered

**Source of Truth**:
- `SellerSettlementBatch` collection (`totalTcsAmount`, `tcsBaseAmount`, `tcsBreakdown`)
- `SellerLedgerEntry` collection (`TCS_REVERSAL` entries)

---

### 8.5 Seller Ledger Report

**What Data It Shows**:
- Opening Balance
- Credit Entries (with reasons)
- Debit Entries (with reasons)
- Running Balance
- Closing Balance

**Calculations Used**:
- Opening Balance: Sum of CREDIT entries (before period) - Sum of DEBIT entries (before period)
- Running Balance: Calculated sequentially (see section 6.4)
- Closing Balance: Final running balance at end of period

**Time Period Logic**:
- Filters by date range (fromDate, toDate)
- Shows all entries in the period

**Filters Impact**:
- Date filter: Filters entries by date
- Entry type filter: CREDIT/DEBIT/ALL
- Reason filter: Filters by ledger reason

**Source of Truth**:
- `SellerLedgerEntry` collection
- Uses `entryType`, `reason`, `amount`, `createdAt`

---

## 9. TDS & TCS CALCULATIONS

### 9.1 TDS (Tax Deducted at Source) - Section 194-O

**Rate**: 0.1% (fixed)

**Base Amount**: Gross Sales Including GST

**Formula**:
```
TDS Base = Sum of order.total for all eligible orders in settlement batch
TDS Amount = TDS Base × 0.1%
```

**Exemption Rules**:
- PAN 4th character = 'P' (Individual) OR 'H' (HUF)
- AND cumulative FY sales ≤ ₹5,00,000
- If exempted: TDS = ₹0
- If partially exempted: TDS only on amount above ₹5,00,000

**Financial Year**: April 1 - March 31

**Where it is used**: Settlement batch (`batch.totalTdsAmount`), TDS reports, seller payout (deducted)

**When Deducted**: At settlement batch finalization (when batch is created)

**Who Bears Cost**: Seller (deducted from seller payout)

---

### 9.2 TCS (Tax Collected at Source) - GST Section 52

**Rate**:
- Inter-state: IGST @ 1.0%
- Intra-state: CGST @ 0.5% + SGST @ 0.5%

**Base Amount**: Taxable Sales Value (Excluding GST)

**Formula**:
```
TCS Base = Sum of order.subtotal for all eligible orders in settlement batch
         (Excludes shipping, tax, discount)

IF inter-state (seller state ≠ customer state):
    TCS Amount = TCS Base × 1.0% (IGST)

IF intra-state (seller state = customer state):
    CGST TCS = TCS Base × 0.5%
    SGST TCS = TCS Base × 0.5%
    TCS Amount = CGST TCS + SGST TCS
```

**Applicability**: ALL sales (both registered and unregistered customers)

**Where it is used**: Settlement batch (`batch.totalTcsAmount`), TCS reports, seller payout (deducted)

**When Deducted**: At settlement batch finalization (when batch is created)

**Who Bears Cost**: Seller (deducted from seller payout)

---

### 9.3 TDS/TCS Reversal

**Description**: When orders are returned/refunded, TDS and TCS are reversed.

**TDS Reversal**:
```
TDS Reversal Amount = order.total × 0.1%
Ledger Entry: TDS_REVERSAL (CREDIT to seller)
```

**TCS Reversal**:
```
IF inter-state:
    TCS Reversal = order.subtotal × 1.0% (IGST)
ELSE:
    TCS Reversal = order.subtotal × 0.5% (CGST) + order.subtotal × 0.5% (SGST)
Ledger Entry: TCS_REVERSAL (CREDIT to seller)
```

**Where it is used**: Return processing, settlement batch calculations (reversals net off original TDS/TCS)

**When Reversed**: When order is returned/refunded

**Who Benefits**: Seller (reversals are credited to seller)

---

## Document Revision History

- **Initial Version**: Created based on current codebase implementation
- **Last Updated**: Based on codebase analysis as of documentation creation date

---

## Key Principles

1. **GST Separate**: GST is calculated and tracked separately from gross sales
2. **Settlement-Based**: TDS/TCS are calculated only at settlement batch finalization
3. **Ledger-Driven**: All financial movements are tracked via seller ledger entries
4. **Negative Balance Handling**: Negative balances are carried forward to next settlement
5. **Post-Invoice Corrections**: Credit/debit notes are only for post-invoice corrections
6. **Source of Truth**: Settlement batches are the source of truth for TDS/TCS reports
7. **No Double-Counting**: GST from refunds is only subtracted once (from `gstAmount`)
8. **Replacement Orders**: Replacement orders are ₹0 and do not affect settlement

---

## Related Documentation

- [SALES_REPORT_FORMULAS_COMPLETE.md](./SALES_REPORT_FORMULAS_COMPLETE.md)
- [SETTLEMENT_DUE_REPORT_FORMULAS.md](./SETTLEMENT_DUE_REPORT_FORMULAS.md)
- [TDS_TCS_CALCULATIONS.md](./TDS_TCS_CALCULATIONS.md)
- [TDS_TCS_REVERSAL_IMPLEMENTATION.md](./TDS_TCS_REVERSAL_IMPLEMENTATION.md)
- [CREDIT_NOTE_GENERATION_FOR_SELLERS.md](./CREDIT_NOTE_GENERATION_FOR_SELLERS.md)
- [PRODUCT_SHIPPING_CHARGE_USAGE.md](./PRODUCT_SHIPPING_CHARGE_USAGE.md)

---

**Note**: This document is intended for internal use by product, engineering, finance, and compliance teams. All formulas and calculations are based on the current codebase implementation and may be updated as the system evolves.
