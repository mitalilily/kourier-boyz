# Product Shipping Charge - Storage & Usage in Calculations

## 📋 Overview

Yes, **product-level shipping charge** (`shippingCharge`) is stored in the Product model and is used throughout the system. Here's how it works:

---

## 🗄️ Storage

### **Product Model Field**

```typescript
// In Product model (backend/src/models/Product.ts)
shippingCharge?: number  // Product-level shipping charge (overrides seller default)
```

**Location**: Line 132 in Product.ts  
**Description**: Product-level shipping charge that overrides seller's default shipping rate

---

## 🔄 How It's Used

### **1. Shipping Calculation Priority**

The shipping charge is calculated using this priority order (in `backend/src/utils/shippingCalculator.ts`):

```javascript
calculateShippingCharge({ product, seller, orderSubtotal }) {
  // Priority 1: Product freeShipping = true → ₹0
  if (product.freeShipping === true) return 0
  
  // Priority 2: Product requiresShipping = false → ₹0
  if (product.requiresShipping === false) return 0
  
  // Priority 3: Seller freeShippingThreshold met → ₹0
  if (seller.freeShippingThreshold > 0 && orderSubtotal >= threshold) return 0
  
  // Priority 4: Product shippingCharge set → Use product.shippingCharge ⭐
  if (product.shippingCharge > 0) return product.shippingCharge
  
  // Priority 5: Fallback to seller defaultShippingRate
  return seller.defaultShippingRate || 0
}
```

**Key Point**: Product `shippingCharge` has **Priority 4** - it overrides seller's default shipping rate.

---

### **2. Order Creation Flow**

When an order is created (`backend/src/controllers/order.controller.ts`):

```javascript
// Step 1: Calculate shipping using product.shippingCharge
const shipping = calculateShippingCharge({
  product: productDoc,        // Includes product.shippingCharge
  seller: sellerDoc,          // Includes seller.defaultShippingRate
  orderSubtotal: itemSubtotal - itemDiscount
})

// Step 2: Calculate item total
const itemTotal = itemSubtotal - itemDiscount + shipping + tax

// Step 3: Store in order
order.shipping = shipping
order.total = subtotal + discount + shipping + tax
```

**Result**: Product `shippingCharge` becomes part of `order.shipping` and `order.total`.

---

### **3. Order Model Storage**

```typescript
// In Order model (backend/src/models/Order.ts)
{
  shipping: number,        // Final shipping charge (includes product.shippingCharge if set)
  subtotal: number,        // Item prices only (excludes shipping)
  tax: number,             // GST on items
  total: number,           // subtotal + discount + shipping + tax
}
```

**Important**: 
- `order.shipping` = Final calculated shipping (may come from product.shippingCharge)
- `order.subtotal` = Item prices only (does NOT include shipping)
- `order.total` = Includes shipping

---

## 💰 Usage in Settlement Calculations

### **TDS Calculation (Section 194-O)**

**TDS Base = Gross Sales Including GST**

```javascript
// In settlement.service.ts (line 640-646)
let grossSalesIncludingGst = 0
for (const order of eligibleOrders) {
  const orderTotal = toNumber(order.total, 0)  // ← Includes shipping!
  grossSalesIncludingGst += orderTotal
}

// TDS is calculated on this amount
tdsResult = await calculateTds(sellerId, grossSalesIncludingGst, toDate)
```

**✅ YES - Product shippingCharge IS included in TDS calculation**

**Why?**
- TDS base = `order.total`
- `order.total` = `subtotal + discount + shipping + tax`
- `order.shipping` includes product `shippingCharge` (if set)
- Therefore, product `shippingCharge` is part of TDS base

**Formula:**
```
TDS Base = Sum of all order.total
         = Sum of (subtotal + discount + shipping + tax)
         = Includes product.shippingCharge (if used)
```

---

### **TCS Calculation (GST Section 52)**

**TCS Base = Taxable Sales Value (Excluding GST)**

```javascript
// In taxCompliance.ts (line 301)
const orderTaxableValue = order.subtotal || 0  // ← Does NOT include shipping!

// TCS is calculated on this amount
tcsAmount = (orderTaxableValue * TCS_RATE) / 100
```

**❌ NO - Product shippingCharge is NOT included in TCS calculation**

**Why?**
- TCS base = `order.subtotal`
- `order.subtotal` = Item prices only (excludes shipping, tax, discount)
- Product `shippingCharge` is in `order.shipping`, not `order.subtotal`
- Therefore, product `shippingCharge` is NOT part of TCS base

**Formula:**
```
TCS Base = Sum of all order.subtotal
         = Item prices only
         = Does NOT include shipping (including product.shippingCharge)
```

---

### **Settlement Net Payout**

Product shipping charge affects seller earnings:

```javascript
// In settlement.service.ts
const shippingEarning = toNumber(order.shipping)  // Includes product.shippingCharge

// This becomes part of seller earnings
totalShippingEarned += shippingEarning

// Net payout calculation
totalNetPayout = 
  totalItemEarnings +
  totalShippingEarned +  // ← Includes product.shippingCharge
  totalCommissionReversal -
  (totalCommission + ... + TDS + TCS)
```

**✅ YES - Product shippingCharge is part of seller shipping earnings**

---

## 📊 Summary Table

| Calculation | Uses Product shippingCharge? | How? |
|-------------|------------------------------|------|
| **Order Shipping** | ✅ YES | Priority 4 in shipping calculation |
| **Order Total** | ✅ YES | `order.total = subtotal + shipping + tax` |
| **TDS Base** | ✅ YES | TDS base = `order.total` (includes shipping) |
| **TCS Base** | ❌ NO | TCS base = `order.subtotal` (excludes shipping) |
| **Seller Shipping Earnings** | ✅ YES | `totalShippingEarned` includes shipping |
| **Settlement Net Payout** | ✅ YES | Shipping earnings are added to payout |

---

## 🔍 Example Flow

### **Scenario**: Product with `shippingCharge = ₹50`

**Step 1: Order Creation**
```
Product.shippingCharge = ₹50
Seller.defaultShippingRate = ₹30

Calculated shipping = ₹50 (product overrides seller default)
order.shipping = ₹50
order.subtotal = ₹1000
order.tax = ₹180 (18% GST)
order.total = ₹1000 + ₹50 + ₹180 = ₹1230
```

**Step 2: TDS Calculation**
```
TDS Base = order.total = ₹1230 (includes ₹50 shipping)
TDS = ₹1230 × 0.1% = ₹1.23
```

**Step 3: TCS Calculation**
```
TCS Base = order.subtotal = ₹1000 (excludes ₹50 shipping)
TCS = ₹1000 × 1% = ₹10 (for inter-state)
```

**Step 4: Settlement**
```
Seller Shipping Earning = ₹50 (from product.shippingCharge)
Net Payout = Item Earnings + ₹50 - Commission - TDS - TCS
```

---

## 📝 Key Points

1. **Product `shippingCharge` is stored** in Product model
2. **It overrides seller's default shipping rate** when set
3. **It becomes part of `order.shipping`** during order creation
4. **It's included in `order.total`** (subtotal + shipping + tax)
5. **It's included in TDS base** (because TDS = gross sales including GST = order.total)
6. **It's NOT included in TCS base** (because TCS = taxable value excluding GST = order.subtotal)
7. **It's part of seller shipping earnings** in settlement

---

## 🎯 Where It's Used

### **Files Using Product shippingCharge:**

1. **`backend/src/utils/shippingCalculator.ts`**
   - `calculateShippingCharge()` - Priority 4 check

2. **`backend/src/controllers/order.controller.ts`**
   - Order creation - calculates shipping using product.shippingCharge

3. **`backend/src/services/settlement.service.ts`**
   - TDS calculation - uses order.total (includes shipping)
   - Shipping earnings - includes product.shippingCharge

4. **`backend/src/utils/taxCompliance.ts`**
   - TCS calculation - uses order.subtotal (excludes shipping)

---

## ⚠️ Important Notes

1. **TDS includes shipping** because it's calculated on gross sales (order.total)
2. **TCS excludes shipping** because it's calculated on taxable value (order.subtotal)
3. **Product shippingCharge is seller revenue** - it goes to seller as shipping earning
4. **Shipping is NOT part of taxable value** for GST/TCS purposes
5. **Shipping IS part of gross sales** for TDS purposes (Section 194-O)

---

## 🔗 Related Fields

| Field | Location | Description |
|-------|----------|-------------|
| `product.shippingCharge` | Product model | Product-level shipping (overrides seller default) |
| `seller.defaultShippingRate` | User model | Seller's default shipping rate (fallback) |
| `seller.freeShippingThreshold` | User model | Order value threshold for free shipping |
| `product.freeShipping` | Product model | Product-level free shipping flag |
| `product.requiresShipping` | Product model | Whether product requires shipping |
| `order.shipping` | Order model | Final calculated shipping charge |
| `order.subtotal` | Order model | Item prices only (excludes shipping) |
| `order.total` | Order model | Includes shipping (used for TDS) |

