import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm'
import { db, pool } from '../client'
import { wallets, walletTransactions } from '../schema/wallet'
import { userProfiles } from '../schema/userProfile'
import { users } from '../schema/users'
import { enrichWalletTransactionsWithShipmentDetails } from './walletTransactionDetails.service'

interface GetAllWalletsParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: 'balance' | 'createdAt' | 'updatedAt' | 'email' | 'companyName'
  sortOrder?: 'asc' | 'desc'
}

export const getAllWallets = async ({
  page = 1,
  limit = 20,
  search = '',
  sortBy = 'updatedAt',
  sortOrder = 'desc',
}: GetAllWalletsParams) => {
  const offset = (page - 1) * limit
  const filters: any[] = []

  // Search filter
  if (search.trim()) {
    const pattern = `%${search.trim()}%`
    filters.push(
      or(
        ilike(sql`coalesce(${userProfiles.companyInfo} ->> 'brandName', '')`, pattern),
        ilike(sql`coalesce(${userProfiles.companyInfo} ->> 'contactPerson', '')`, pattern),
        ilike(sql`coalesce(${userProfiles.companyInfo} ->> 'contactEmail', '')`, pattern),
        ilike(sql`coalesce(${userProfiles.companyInfo} ->> 'businessName', '')`, pattern),
        ilike(users.email, pattern),
      ),
    )
  }

  // Sort mapping
  const sortColumns: Record<string, any> = {
    balance: wallets.balance,
    createdAt: wallets.createdAt,
    updatedAt: wallets.updatedAt,
    email: users.email,
    companyName: sql`${userProfiles.companyInfo} ->> 'brandName'`,
  }
  const sortColumn = sortColumns[sortBy] ?? wallets.updatedAt
  const orderBy = sortOrder === 'asc' ? sortColumn : desc(sortColumn)

  // Get total count
  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(filters.length > 0 ? and(...filters) : undefined)

  const totalCount = Number(totalCountResult[0]?.count || 0)

  // Get wallets with user info
  const walletsData = await db
    .select({
      id: wallets.id,
      userId: wallets.userId,
      balance: wallets.balance,
      currency: wallets.currency,
      createdAt: wallets.createdAt,
      updatedAt: wallets.updatedAt,
      userEmail: users.email,
      userRole: users.role,
      companyInfo: userProfiles.companyInfo,
    })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)

  return {
    data: walletsData,
    totalCount,
    page,
    limit,
  }
}

export const getWalletByUserId = async (userId: string) => {
  const walletData = await db
    .select({
      id: wallets.id,
      userId: wallets.userId,
      balance: wallets.balance,
      currency: wallets.currency,
      createdAt: wallets.createdAt,
      updatedAt: wallets.updatedAt,
      userEmail: users.email,
      userRole: users.role,
      companyInfo: userProfiles.companyInfo,
    })
    .from(wallets)
    .innerJoin(users, eq(wallets.userId, users.id))
    .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(wallets.userId, userId))
    .limit(1)

  if (!walletData[0]) {
    throw new Error('Wallet not found for this user')
  }

  return walletData[0]
}

export const getWalletTransactionsByUserId = async ({
  userId,
  page = 1,
  limit = 50,
  type,
  dateFrom,
  dateTo,
}: {
  userId: string
  page?: number
  limit?: number
  type?: 'credit' | 'debit'
  dateFrom?: Date
  dateTo?: Date
}) => {
  const offset = (page - 1) * limit

  // Get wallet
  const userWallet = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
  if (!userWallet[0]) {
    throw new Error('Wallet not found for this user')
  }

  // Build filters
  const conditions: any[] = [eq(walletTransactions.wallet_id, userWallet[0].id)]
  if (type) conditions.push(eq(walletTransactions.type, type))
  if (dateFrom) conditions.push(gte(walletTransactions.created_at, dateFrom))
  if (dateTo) conditions.push(lte(walletTransactions.created_at, dateTo))

  const filter = and(...conditions)

  // Get total count
  const totalCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(walletTransactions)
    .where(filter)

  const totalCount = Number(totalCountResult[0]?.count || 0)

  // Get transactions
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(filter)
    .orderBy(desc(walletTransactions.created_at))
    .limit(limit)
    .offset(offset)

  const enrichedTransactions = await enrichWalletTransactionsWithShipmentDetails(userId, transactions, {
    masked: false,
  })

  return {
    wallet: userWallet[0],
    transactions: enrichedTransactions,
    totalCount,
    page,
    limit,
  }
}

export const WALLET_MIS_TRANSACTION_AGAINST_OPTIONS = [
  'Forward Shipping charges including COD charges',
  'wallet recharge',
  'weight dispute charges',
  'Penalty',
  'Refund against order cancellation',
  'COD adjustment against negative balance',
  'other charges',
  'Reverse shipping charges',
  'Lost shipment reimbursement',
  'credit card Chargeback',
  'Credit note',
] as const

export type WalletMisTransactionAgainst =
  (typeof WALLET_MIS_TRANSACTION_AGAINST_OPTIONS)[number]

export interface WalletMisReportParams {
  page?: number
  limit?: number
  search?: string
  customerId?: string
  type?: 'credit' | 'debit'
  transactionAgainst?: string
  dateFrom?: Date
  dateTo?: Date
  awb?: string
  courier?: string
  minWeight?: number
  maxWeight?: number
  shipmentOnly?: boolean
}

const WALLET_MIS_MAX_LIMIT = 5000

const clampPositiveInt = (value: unknown, fallback: number, max = WALLET_MIS_MAX_LIMIT) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(Math.floor(parsed), max)
}

const isValidMisTransactionAgainst = (
  value?: string,
): value is WalletMisTransactionAgainst =>
  WALLET_MIS_TRANSACTION_AGAINST_OPTIONS.includes(value as WalletMisTransactionAgainst)

const normalizeMoney = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : '0.00'
}

const normalizeWeight = (value: unknown) => {
  if (value === null || value === undefined || value === '') return ''
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toFixed(3) : String(value)
}

const toIsoDate = (value: unknown) => {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value as any)
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString()
}

const walletMisBaseSql = `
WITH wallet_mis_base AS (
  SELECT
    wt.id::text AS id,
    w."userId"::text AS customer_id,
    COALESCE(
      NULLIF(up."companyInfo" ->> 'brandName', ''),
      NULLIF(up."companyInfo" ->> 'businessName', ''),
      NULLIF(up."companyInfo" ->> 'contactPerson', ''),
      NULLIF(up."companyInfo" ->> 'name', ''),
      NULLIF(u.email, ''),
      w."userId"::text
    ) AS customer_name,
    u.email AS customer_email,
    wt.created_at AS transaction_date,
    wt.amount,
    wt.currency,
    wt.type::text AS type,
    wt.reason,
    wt.ref,
    wt.meta,
    lower(coalesce(wt.reason, '')) AS reason_lower,
    COALESCE(
      NULLIF(b2c.awb_number, ''),
      NULLIF(b2b.awb_number, ''),
      NULLIF(wt.meta ->> 'awb_number', ''),
      NULLIF(wt.meta ->> 'awbNumber', ''),
      NULLIF(wt.meta ->> 'awb', ''),
      NULLIF(wt.meta ->> 'waybill', ''),
      NULLIF(wt.meta ->> 'waybill_number', '')
    ) AS awb,
    COALESCE(
      NULLIF(b2c.courier_partner, ''),
      NULLIF(b2b.courier_partner, ''),
      NULLIF(wt.meta ->> 'courier_name', ''),
      NULLIF(wt.meta ->> 'courier_partner', ''),
      NULLIF(wt.meta ->> 'integration_type', '')
    ) AS courier_partner_name,
    COALESCE(
      b2c.charged_weight,
      b2b.charged_weight,
      CASE
        WHEN (wt.meta ->> 'charged_weight') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN (wt.meta ->> 'charged_weight')::numeric
        WHEN (wt.meta ->> 'chargedWeight') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN (wt.meta ->> 'chargedWeight')::numeric
      END,
      b2c.weight,
      b2b.weight,
      CASE
        WHEN (wt.meta ->> 'declared_weight') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN (wt.meta ->> 'declared_weight')::numeric
        WHEN (wt.meta ->> 'declaredWeight') ~ '^-?[0-9]+(\\.[0-9]+)?$'
          THEN (wt.meta ->> 'declaredWeight')::numeric
      END
    ) AS weight
  FROM wallet_transactions wt
  INNER JOIN wallets w ON w.id = wt.wallet_id
  LEFT JOIN users u ON u.id = w."userId"
  LEFT JOIN user_profiles up ON up."userId" = w."userId"
  LEFT JOIN LATERAL (
    SELECT
      o.id::text,
      o.order_number,
      o.awb_number,
      o.courier_partner,
      o.charged_weight,
      o.weight,
      o.created_at
    FROM b2c_orders o
    WHERE
      o.user_id = w."userId"
      AND (
        o.id::text = wt.ref
        OR o.order_id = wt.ref
        OR o.order_number = wt.ref
        OR o.shipment_id = wt.ref
        OR o.awb_number = wt.ref
        OR o.id::text = wt.meta ->> 'order_id'
        OR o.id::text = wt.meta ->> 'orderId'
        OR o.id::text = wt.meta ->> 'orderUuid'
        OR o.id::text = wt.meta ->> 'order_uuid'
        OR o.id::text = wt.meta ->> 'original_order_id'
        OR o.order_id = wt.meta ->> 'order_id'
        OR o.order_id = wt.meta ->> 'orderId'
        OR o.order_id = wt.meta ->> 'original_order_id'
        OR o.order_number = wt.meta ->> 'order_number'
        OR o.order_number = wt.meta ->> 'orderNumber'
        OR o.awb_number = wt.meta ->> 'awb_number'
        OR o.awb_number = wt.meta ->> 'awbNumber'
        OR o.awb_number = wt.meta ->> 'awb'
        OR o.awb_number = wt.meta ->> 'waybill'
        OR o.shipment_id = wt.meta ->> 'shipment_id'
        OR o.shipment_id = wt.meta ->> 'shipmentId'
        OR lower(o.order_number) = lower(NULLIF(substring(wt.reason from 'order #?([A-Za-z0-9._-]+)'), ''))
        OR lower(o.order_number) = lower(NULLIF(substring(wt.reason from '\\(([^)]+)\\)'), ''))
      )
    ORDER BY o.created_at DESC NULLS LAST
    LIMIT 1
  ) b2c ON true
  LEFT JOIN LATERAL (
    SELECT
      o.id::text,
      o.order_number,
      o.awb_number,
      o.courier_partner,
      o.charged_weight,
      o.weight,
      o.created_at
    FROM b2b_orders o
    WHERE
      o.user_id = w."userId"
      AND (
        o.id::text = wt.ref
        OR o.order_id = wt.ref
        OR o.order_number = wt.ref
        OR o.shipment_id = wt.ref
        OR o.awb_number = wt.ref
        OR o.id::text = wt.meta ->> 'order_id'
        OR o.id::text = wt.meta ->> 'orderId'
        OR o.id::text = wt.meta ->> 'orderUuid'
        OR o.id::text = wt.meta ->> 'order_uuid'
        OR o.id::text = wt.meta ->> 'original_order_id'
        OR o.order_id = wt.meta ->> 'order_id'
        OR o.order_id = wt.meta ->> 'orderId'
        OR o.order_id = wt.meta ->> 'original_order_id'
        OR o.order_number = wt.meta ->> 'order_number'
        OR o.order_number = wt.meta ->> 'orderNumber'
        OR o.awb_number = wt.meta ->> 'awb_number'
        OR o.awb_number = wt.meta ->> 'awbNumber'
        OR o.awb_number = wt.meta ->> 'awb'
        OR o.awb_number = wt.meta ->> 'waybill'
        OR o.shipment_id = wt.meta ->> 'shipment_id'
        OR o.shipment_id = wt.meta ->> 'shipmentId'
        OR lower(o.order_number) = lower(NULLIF(substring(wt.reason from 'order #?([A-Za-z0-9._-]+)'), ''))
        OR lower(o.order_number) = lower(NULLIF(substring(wt.reason from '\\(([^)]+)\\)'), ''))
      )
    ORDER BY o.created_at DESC NULLS LAST
    LIMIT 1
  ) b2b ON true
),
wallet_mis_classified AS (
  SELECT
    *,
    CASE
      WHEN reason_lower LIKE '%wallet recharge%' OR reason_lower LIKE '%wallet_topup%'
        THEN 'wallet recharge'
      WHEN type = 'debit'
        AND (
          reason_lower LIKE '%reverse_shipment%'
          OR reason_lower LIKE '%reverse shipment%'
          OR reason_lower LIKE '%rto freight%'
        )
        THEN 'Reverse shipping charges'
      WHEN type = 'debit'
        AND (
          reason_lower LIKE '%b2c prepaid order payment%'
          OR reason_lower LIKE '%b2c cod service charges%'
          OR reason_lower LIKE '%forward shipping%'
          OR reason_lower LIKE '%forward shipment%'
          OR reason_lower LIKE '%shipment charge%'
        )
        THEN 'Forward Shipping charges including COD charges'
      WHEN type = 'debit'
        AND (
          reason_lower LIKE '%weight discrepancy charge%'
          OR reason_lower LIKE '%weight dispute charge%'
          OR reason_lower LIKE '%weight_disc%'
          OR reason_lower LIKE '%dispute rejected%'
        )
        THEN 'weight dispute charges'
      WHEN type = 'credit'
        AND (
          reason_lower LIKE '%refund for cancelled order%'
          OR reason_lower LIKE '%refund for canceled order%'
          OR reason_lower LIKE '%order cancellation%'
          OR reason_lower LIKE '%manifest failed%'
        )
        THEN 'Refund against order cancellation'
      WHEN type = 'credit'
        AND (
          reason_lower LIKE '%cod adjustment%'
          OR reason_lower LIKE '%negative balance%'
        )
        THEN 'COD adjustment against negative balance'
      WHEN type = 'credit'
        AND (
          reason_lower LIKE '%lost shipment%'
          OR reason_lower LIKE '%lost reimbursement%'
          OR reason_lower LIKE '%reimbursement%'
        )
        THEN 'Lost shipment reimbursement'
      WHEN type = 'debit'
        AND reason_lower LIKE '%chargeback%'
        THEN 'credit card Chargeback'
      WHEN type = 'debit'
        AND reason_lower LIKE '%penalty%'
        THEN 'Penalty'
      WHEN type = 'credit'
        AND (
          reason_lower LIKE '%credit note%'
          OR reason_lower LIKE '%invoice_credits_waivers%'
          OR reason_lower LIKE '%weight dispute refund%'
          OR reason_lower LIKE '%weight discrepancy refund%'
        )
        THEN 'Credit note'
      WHEN type = 'debit'
        THEN 'other charges'
      ELSE 'Credit note'
    END AS transaction_against
  FROM wallet_mis_base
)
`

const buildWalletMisFilters = (params: WalletMisReportParams) => {
  const filters: string[] = []
  const values: any[] = []
  const push = (condition: string, value: any) => {
    values.push(value)
    filters.push(condition.replace('?', `$${values.length}`))
  }
  const pushRepeated = (condition: string, value: any, count: number) => {
    const placeholders: string[] = []
    for (let i = 0; i < count; i += 1) {
      values.push(value)
      placeholders.push(`$${values.length}`)
    }

    let index = 0
    filters.push(condition.replace(/\?/g, () => placeholders[index++] || '?'))
  }

  if (params.dateFrom) push('transaction_date >= ?', params.dateFrom)
  if (params.dateTo) push('transaction_date <= ?', params.dateTo)
  if (params.customerId?.trim()) push('customer_id = ?', params.customerId.trim())
  if (params.type) push('type = ?', params.type)
  if (params.transactionAgainst?.trim() && isValidMisTransactionAgainst(params.transactionAgainst)) {
    push('transaction_against = ?', params.transactionAgainst.trim())
  }
  if (params.search?.trim()) {
    pushRepeated(
      `(
        customer_name ILIKE ?
        OR customer_email ILIKE ?
        OR customer_id ILIKE ?
        OR COALESCE(reason, '') ILIKE ?
        OR COALESCE(ref, '') ILIKE ?
        OR COALESCE(awb, '') ILIKE ?
      )`,
      `%${params.search.trim()}%`,
      6,
    )
  }
  if (params.awb?.trim()) push('COALESCE(awb, \'\') ILIKE ?', `%${params.awb.trim()}%`)
  if (params.courier?.trim()) {
    push('COALESCE(courier_partner_name, \'\') ILIKE ?', `%${params.courier.trim()}%`)
  }
  if (typeof params.minWeight === 'number' && Number.isFinite(params.minWeight)) {
    push('weight >= ?', params.minWeight)
  }
  if (typeof params.maxWeight === 'number' && Number.isFinite(params.maxWeight)) {
    push('weight <= ?', params.maxWeight)
  }
  if (params.shipmentOnly) {
    filters.push(`(
      awb IS NOT NULL
      OR courier_partner_name IS NOT NULL
      OR reason_lower LIKE '%shipment%'
      OR reason_lower LIKE '%order payment%'
      OR reason_lower LIKE '%cod service charges%'
      OR reason_lower LIKE '%weight discrepancy%'
      OR reason_lower LIKE '%rto freight%'
      OR reason_lower LIKE '%reverse%'
    )`)
  }

  return {
    whereSql: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    values,
  }
}

const mapWalletMisRow = (row: any) => ({
  id: row.id,
  customerName: row.customer_name || '',
  customerId: row.customer_id || '',
  customerEmail: row.customer_email || '',
  transactionDate: row.transaction_date,
  walletTransactionAmount: normalizeMoney(row.amount),
  transactionAgainst: row.transaction_against || '',
  transactionType: String(row.type || '').toUpperCase(),
  rawTransactionType: row.type || '',
  rawReason: row.reason || '',
  reference: row.ref || '',
  awb: row.awb || '',
  courierPartnerName: row.courier_partner_name || '',
  weight: normalizeWeight(row.weight),
  currency: row.currency || 'INR',
})

export const getConsolidatedWalletMisReport = async (params: WalletMisReportParams = {}) => {
  const page = clampPositiveInt(params.page, 1, 100000)
  const limit = clampPositiveInt(params.limit, 50)
  const offset = (page - 1) * limit
  const { whereSql, values } = buildWalletMisFilters(params)

  const countSql = `
    ${walletMisBaseSql}
    SELECT count(*)::int AS count
    FROM wallet_mis_classified
    ${whereSql}
  `
  const dataSql = `
    ${walletMisBaseSql}
    SELECT
      id,
      customer_id,
      customer_name,
      customer_email,
      transaction_date,
      amount,
      currency,
      type,
      reason,
      ref,
      transaction_against,
      awb,
      courier_partner_name,
      weight
    FROM wallet_mis_classified
    ${whereSql}
    ORDER BY transaction_date DESC NULLS LAST, id DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `

  const [countResult, dataResult] = await Promise.all([
    pool.query(countSql, values),
    pool.query(dataSql, [...values, limit, offset]),
  ])

  return {
    data: dataResult.rows.map(mapWalletMisRow),
    totalCount: Number(countResult.rows[0]?.count || 0),
    page,
    limit,
    transactionAgainstOptions: WALLET_MIS_TRANSACTION_AGAINST_OPTIONS,
  }
}

export const getConsolidatedWalletMisExportRows = async (
  params: WalletMisReportParams = {},
) => {
  const result = await getConsolidatedWalletMisReport({
    ...params,
    page: 1,
    limit: clampPositiveInt(params.limit, WALLET_MIS_MAX_LIMIT),
  })

  return result.data.map((row) => [
    row.customerName,
    row.customerId,
    toIsoDate(row.transactionDate),
    row.walletTransactionAmount,
    row.transactionAgainst,
    row.transactionType,
    row.awb,
    row.courierPartnerName,
    row.weight,
  ])
}
