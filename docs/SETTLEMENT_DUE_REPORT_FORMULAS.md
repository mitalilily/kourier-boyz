# Settlement Due Report - Complete Calculation Formulas

This document provides the **exact formulas** used in the Settlement Due Report, using all keywords from the codebase.

---

## Data Source Fields

### From `SellerSettlementBatch`:
- `batch.seller` - Seller reference (ObjectId)
- `batch.fromDate` - Settlement period start date
- `batch.toDate` - Settlement period end date
- `batch.totalNetPayout` - Total settlement amount (net payout to seller)
- `batch.status` - Settlement status: `'PENDING'` or `'PAID'`
- `batch._id` - Batch ID

### From `SellerSettlementSettings`:
- `settings.settlementCycle` - Cycle type: `'DAILY'`, `'WEEKLY'`, or `'CUSTOM'`
- `settings.customCycleDays` - Number of days (if cycle is `'CUSTOM'`)

### From `User` (Seller):
- `seller.name` - Seller name
- `seller.businessName` - Business name (preferred)
- `seller.gstNumber` - GST number
- `seller.state` - Seller state (for state-wise grouping)

---

## 1. SETTLEMENT AMOUNT

### Formula:
```javascript
settlementAmount = batch.totalNetPayout || 0
```

### Keywords Used:
- `batch.totalNetPayout`
- `settlementAmount`

### Explanation:
- Uses `totalNetPayout` from the settlement batch
- This is the **net amount** payable to the seller after all deductions
- Falls back to 0 if `totalNetPayout` is null/undefined

---

## 2. SETTLEMENT PERIOD

### Formula:
```javascript
fromDate = new Date(batch.fromDate)
toDate = new Date(batch.toDate)
periodLabel = formatDate(fromDate) + " - " + formatDate(toDate)
```

### Keywords Used:
- `batch.fromDate`
- `batch.toDate`
- `formatDate()` (helper function)
- `periodLabel`

### Explanation:
- Combines start and end dates into a readable period string
- Example: "01 Jan 2024 - 07 Jan 2024"

---

## 3. DUE DATE

### Formula:
```javascript
toDate = new Date(batch.toDate)
dueDate = calculateDueDate(toDate)

// calculateDueDate function:
dueDate = new Date(toDate)
dueDate.setDate(dueDate.getDate() + 2)  // Add 2 days processing time
return dueDate
```

### Keywords Used:
- `batch.toDate`
- `calculateDueDate()` (helper function)
- `dueDate`

### Explanation:
- Due date = Settlement period end date + 2 days
- Standard processing time: **2 days** after period end
- Example: If period ends on Jan 7, due date is Jan 9

---

## 4. SETTLEMENT CYCLE LABEL

### Formula:
```javascript
// Get cycle from seller settings
settings = sellerSettingsMap.get(sellerId)
cycle = settings?.settlementCycle || 'WEEKLY'
customDays = settings?.customCycleDays

// Calculate label
cycleLabel = getSettlementCycleLabel(cycle, customDays)

// getSettlementCycleLabel function:
IF (cycle === 'DAILY'):
    return 'Daily'
ELSE IF (cycle === 'WEEKLY'):
    return 'Weekly'
ELSE IF (cycle === 'CUSTOM' && customDays):
    IF (customDays === 14):
        return 'Fortnightly'
    ELSE IF (customDays === 30 || customDays === 28 || customDays === 31):
        return 'Monthly'
    ELSE:
        return `${customDays} Days`
ELSE:
    return 'Weekly'  // Default fallback
```

### Keywords Used:
- `settings.settlementCycle`
- `settings.customCycleDays`
- `getSettlementCycleLabel()` (helper function)
- `cycleLabel`

### Explanation:
- Maps settlement cycle type to human-readable label
- Handles standard cycles (Daily, Weekly) and custom cycles
- Custom cycles show as "X Days" (e.g., "15 Days", "20 Days")
- Special cases: 14 days = "Fortnightly", 28/30/31 days = "Monthly"

---

## 5. SELLER INFORMATION

### Formula:
```javascript
sellerId = batch.seller._id.toString()
sellerName = batch.seller.businessName || batch.seller.name || 'Unknown Seller'
sellerGstin = batch.seller.gstNumber || undefined
```

### Keywords Used:
- `batch.seller._id`
- `batch.seller.businessName`
- `batch.seller.name`
- `batch.seller.gstNumber`
- `sellerId`
- `sellerName`
- `sellerGstin`

### Explanation:
- Extracts seller information from populated seller object
- Prefers `businessName` over `name`
- GST number is optional

---

## 6. STATUS

### Formula:
```javascript
status = batch.status  // 'PENDING' or 'PAID'
```

### Keywords Used:
- `batch.status`

### Explanation:
- Directly uses status from settlement batch
- Values: `'PENDING'` or `'PAID'`

---

## 7. TOTAL AMOUNT DUE

### Formula:
```javascript
// For each row:
IF (row.status === 'PENDING'):
    totalAmountDue += row.settlementAmount
ELSE:
    totalAmountDue += 0

// Aggregate:
totalAmountDue = SUM of all PENDING settlementAmount values
```

### Keywords Used:
- `row.status`
- `row.settlementAmount`
- `totalAmountDue`

### Explanation:
- Sum of settlement amounts for **PENDING** batches only
- Represents total amount that needs to be paid to sellers

---

## 8. TOTAL AMOUNT SETTLED

### Formula:
```javascript
// For each row:
IF (row.status === 'PAID'):
    totalAmountSettled += row.settlementAmount
ELSE:
    totalAmountSettled += 0

// Aggregate:
totalAmountSettled = SUM of all PAID settlementAmount values
```

### Keywords Used:
- `row.status`
- `row.settlementAmount`
- `totalAmountSettled`

### Explanation:
- Sum of settlement amounts for **PAID** batches only
- Represents total amount already paid to sellers

---

## 9. PENDING COUNT

### Formula:
```javascript
// For each row:
IF (row.status === 'PENDING'):
    pendingCount += 1
ELSE:
    pendingCount += 0

// Aggregate:
pendingCount = COUNT of rows where status === 'PENDING'
```

### Keywords Used:
- `row.status`
- `pendingCount`

### Explanation:
- Count of settlement batches with status `'PENDING'`

---

## 10. PAID COUNT

### Formula:
```javascript
// For each row:
IF (row.status === 'PAID'):
    paidCount += 1
ELSE:
    paidCount += 0

// Aggregate:
paidCount = COUNT of rows where status === 'PAID'
```

### Keywords Used:
- `row.status`
- `paidCount`

### Explanation:
- Count of settlement batches with status `'PAID'`

---

## FILTERING LOGIC

### 1. Status Filter

### Formula:
```javascript
// Build query:
batchQuery = {}

IF (status === 'PENDING'):
    batchQuery.status = 'PENDING'
ELSE IF (status === 'ALL' OR status is undefined):
    // No status filter (show all)
```

### Keywords Used:
- `status` (from query params)
- `batchQuery.status`

---

### 2. Seller Filter

### Formula:
```javascript
IF (seller is provided):
    batchQuery.seller = new mongoose.Types.ObjectId(seller)
```

### Keywords Used:
- `seller` (from query params)
- `batchQuery.seller`

---

### 3. Settlement Cycle Filter (Optimized)

### Formula - Step 1: Map Cycle Label to Query
```javascript
IF (settlementCycle === 'Daily'):
    targetCycle = 'DAILY'
ELSE IF (settlementCycle === 'Weekly'):
    targetCycle = 'WEEKLY'
ELSE IF (settlementCycle === 'Fortnightly'):
    targetCycle = 'CUSTOM'
    targetCustomDays = 14
ELSE IF (settlementCycle === 'Monthly'):
    targetCycle = 'CUSTOM'
    targetCustomDays = 30  // Also match 28, 31
ELSE:
    // Handle custom: "15 Days", "20 Days", etc.
    customDaysMatch = settlementCycle.match(/^(\d+)\s*Days?$/i)
    IF (customDaysMatch):
        targetCycle = 'CUSTOM'
        targetCustomDays = parseInt(customDaysMatch[1], 10)
```

### Formula - Step 2: Query Seller Settings
```javascript
cycleQuery = {}

IF (targetCycle === 'CUSTOM' && targetCustomDays !== null):
    IF (targetCustomDays === 30):
        // Match Monthly: 28, 30, or 31 days
        cycleQuery.$or = [
            { settlementCycle: 'CUSTOM', customCycleDays: { $in: [28, 30, 31] } }
        ]
    ELSE:
        cycleQuery.settlementCycle = 'CUSTOM'
        cycleQuery.customCycleDays = targetCustomDays
ELSE:
    cycleQuery.settlementCycle = targetCycle

// Find matching sellers
matchingSettings = SellerSettlementSettings.find(cycleQuery)
sellerIdsForCycleFilter = matchingSettings.map(s => s.seller.toString())
```

### Formula - Step 3: Filter Batches
```javascript
IF (sellerIdsForCycleFilter.length === 0):
    return empty result

IF (seller not already filtered):
    batchQuery.seller = { $in: sellerIdsForCycleFilter }
ELSE:
    // Verify specific seller matches cycle
    IF (seller NOT IN sellerIdsForCycleFilter):
        return empty result
```

### Formula - Step 4: In-Memory Filter (Fallback)
```javascript
// For each batch:
settings = sellerSettingsMap.get(sellerId)
cycle = settings?.settlementCycle || 'WEEKLY'
customDays = settings?.customCycleDays
cycleLabel = getSettlementCycleLabel(cycle, customDays)

IF (settlementCycle && cycleLabel !== settlementCycle):
    continue  // Skip this batch
```

### Keywords Used:
- `settlementCycle` (from query params)
- `targetCycle`
- `targetCustomDays`
- `cycleQuery`
- `sellerIdsForCycleFilter`
- `cycleLabel`
- `getSettlementCycleLabel()`

---

### 4. Due Date Range Filter

### Formula:
```javascript
// For each batch:
dueDate = calculateDueDate(batch.toDate)

IF (dueDateFrom is provided):
    from = new Date(dueDateFrom)
    IF (dueDate < from):
        continue  // Skip this batch

IF (dueDateTo is provided):
    to = new Date(dueDateTo)
    to.setHours(23, 59, 59, 999)  // End of day
    IF (dueDate > to):
        continue  // Skip this batch
```

### Keywords Used:
- `dueDateFrom` (from query params)
- `dueDateTo` (from query params)
- `dueDate`
- `batch.toDate`

---

### 5. Amount Range Filter

### Formula:
```javascript
amount = batch.totalNetPayout || 0

IF (amountFrom is provided):
    min = parseFloat(amountFrom)
    IF (amount < min):
        continue  // Skip this batch

IF (amountTo is provided):
    max = parseFloat(amountTo)
    IF (amount > max):
        continue  // Skip this batch
```

### Keywords Used:
- `amountFrom` (from query params)
- `amountTo` (from query params)
- `batch.totalNetPayout`
- `amount`

---

## COMPLETE CALCULATION FLOW

### Step 1: Build Query
```
1. Initialize batchQuery = {}
2. Apply status filter (if 'PENDING')
3. Apply seller filter (if provided)
4. Apply settlement cycle filter (optimized - query sellers first)
```

### Step 2: Fetch Batches
```
1. Query: SellerSettlementBatch.find(batchQuery)
2. Populate seller: .populate('seller', 'name businessName gstNumber')
3. Sort: .sort({ toDate: 1, createdAt: 1 })
4. Convert to plain objects
5. Filter out batches with unpopulated sellers
```

### Step 3: Get Seller Settings
```
1. Extract unique seller IDs from batches
2. Query: SellerSettlementSettings.find({ seller: { $in: sellerIds } })
3. Build sellerSettingsMap for quick lookup
```

### Step 4: Process Each Batch
```
For each valid batch:
1. Get seller info: sellerId, sellerName, sellerGstin
2. Get settlement cycle from settings
3. Calculate cycleLabel using getSettlementCycleLabel()
4. Calculate dueDate using calculateDueDate(batch.toDate)
5. Apply filters:
   - Settlement cycle (in-memory if needed)
   - Due date range
   - Amount range
6. Format settlement period
7. Create row with:
   - sellerId, sellerName, sellerGstin
   - settlementPeriod, fromDate, toDate
   - settlementAmount (from batch.totalNetPayout)
   - settlementCycle (cycleLabel)
   - dueDate
   - status (batch.status)
   - batchId
```

### Step 5: Calculate Totals
```
For each row:
IF (status === 'PENDING'):
    totalAmountDue += settlementAmount
    pendingCount += 1
ELSE IF (status === 'PAID'):
    totalAmountSettled += settlementAmount
    paidCount += 1
```

### Step 6: Sort and Return
```
1. Sort rows by dueDate (earliest first)
2. Return response with rows and totals
```

---

## HELPER FUNCTIONS

### 1. calculateDueDate(toDate: Date): Date
```javascript
dueDate = new Date(toDate)
dueDate.setDate(dueDate.getDate() + 2)  // Add 2 days
return dueDate
```

### 2. getSettlementCycleLabel(cycle: string, customDays?: number): string
```javascript
IF (cycle === 'DAILY'): return 'Daily'
IF (cycle === 'WEEKLY'): return 'Weekly'
IF (cycle === 'CUSTOM' && customDays):
    IF (customDays === 14): return 'Fortnightly'
    IF (customDays === 30 || 28 || 31): return 'Monthly'
    ELSE: return `${customDays} Days`
ELSE: return 'Weekly'  // Default
```

### 3. formatDate(date: Date): string
```javascript
// Formats date as "DD MMM YYYY"
// Example: "01 Jan 2024"
```

---

## EXAMPLE CALCULATION

### Input:
```
Batch:
  fromDate: 2024-01-01
  toDate: 2024-01-07
  totalNetPayout: ₹10,140
  status: 'PAID'
  seller: { _id: '...', businessName: 'Keya', gstNumber: '...' }

Settings:
  settlementCycle: 'WEEKLY'
```

### Calculations:
```
1. settlementAmount = ₹10,140
2. periodLabel = "01 Jan 2024 - 07 Jan 2024"
3. dueDate = calculateDueDate(2024-01-07) = 2024-01-09
4. cycleLabel = getSettlementCycleLabel('WEEKLY') = 'Weekly'
5. sellerName = 'Keya'
```

### Totals:
```
IF (status === 'PAID'):
    totalAmountSettled += ₹10,140
    paidCount += 1
```

---

## ALL KEYWORDS REFERENCE

### Batch Fields:
- `batch.seller`
- `batch.fromDate`
- `batch.toDate`
- `batch.totalNetPayout`
- `batch.status`
- `batch._id`

### Settings Fields:
- `settings.settlementCycle`
- `settings.customCycleDays`

### Seller Fields:
- `seller._id`
- `seller.name`
- `seller.businessName`
- `seller.gstNumber`
- `seller.state`

### Calculated Variables:
- `settlementAmount`
- `periodLabel`
- `dueDate`
- `cycleLabel`
- `sellerId`
- `sellerName`
- `sellerGstin`

### Totals:
- `totalAmountDue`
- `totalAmountSettled`
- `pendingCount`
- `paidCount`

### Query Parameters:
- `seller`
- `settlementCycle`
- `dueDateFrom`
- `dueDateTo`
- `amountFrom`
- `amountTo`
- `status`

### Data Structures:
- `batchQuery`
- `sellerSettingsMap` (Map<string, Settings>)
- `validBatches` (filtered array)
- `rows` (SettlementDueReportRow[])

---

## KEY PRINCIPLES

1. **Settlement Amount**: Uses `totalNetPayout` from batch (net amount after all deductions)
2. **Due Date**: Always 2 days after settlement period end date
3. **Settlement Cycle**: Determined from seller settings, not stored on batch
4. **Status Separation**: Totals are calculated separately for PENDING and PAID
5. **Optimized Filtering**: Settlement cycle filter queries sellers first, then batches
6. **Seller Population**: Batches with unpopulated sellers are filtered out



















