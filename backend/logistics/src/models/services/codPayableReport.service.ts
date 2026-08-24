import { pool } from '../client'

export interface CodPayableReportParams {
  status?: 'pending' | 'credited' | 'all'
  fromDate?: Date
  toDate?: Date
  search?: string
  courierPartner?: string
  customerId?: string
  limit?: number
}

const MAX_DELIVERY_ROWS = 1000

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const money = (value: unknown) => Number(toNumber(value).toFixed(2))

const getCompanyName = (companyInfo: any, fallback: string) => {
  if (!companyInfo || typeof companyInfo !== 'object') return fallback
  return (
    companyInfo.brandName ||
    companyInfo.businessName ||
    companyInfo.contactPerson ||
    companyInfo.name ||
    fallback
  )
}

const clampLimit = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 250
  return Math.min(Math.floor(parsed), MAX_DELIVERY_ROWS)
}

const buildFilters = (params: CodPayableReportParams) => {
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

  const status = params.status || 'pending'
  if (status !== 'all') push('cr.status = ?', status)
  if (params.fromDate) push('cr.collected_at >= ?', params.fromDate)
  if (params.toDate) push('cr.collected_at <= ?', params.toDate)
  if (params.customerId?.trim()) push('cr.user_id::text = ?', params.customerId.trim())
  if (params.courierPartner?.trim()) {
    push('COALESCE(cr.courier_partner, \'\') ILIKE ?', `%${params.courierPartner.trim()}%`)
  }
  if (params.search?.trim()) {
    pushRepeated(
      `(
        cr.order_number ILIKE ?
        OR COALESCE(cr.awb_number, '') ILIKE ?
        OR COALESCE(cr.courier_partner, '') ILIKE ?
        OR COALESCE(u.email, '') ILIKE ?
        OR cr.user_id::text ILIKE ?
        OR COALESCE(up."companyInfo" ->> 'brandName', '') ILIKE ?
        OR COALESCE(up."companyInfo" ->> 'businessName', '') ILIKE ?
        OR COALESCE(up."companyInfo" ->> 'contactPerson', '') ILIKE ?
      )`,
      `%${params.search.trim()}%`,
      8,
    )
  }

  return {
    whereSql: filters.length ? `WHERE ${filters.join(' AND ')}` : '',
    values,
  }
}

export const getCodPayableReport = async (params: CodPayableReportParams = {}) => {
  const { whereSql, values } = buildFilters(params)
  const limit = clampLimit(params.limit)

  const sql = `
    SELECT
      cr.id::text AS id,
      cr.user_id::text AS customer_id,
      u.email AS customer_email,
      up."companyInfo" AS company_info,
      COALESCE(w.balance, 0) AS wallet_balance,
      cr.order_id::text AS order_id,
      cr.order_type,
      cr.order_number,
      cr.awb_number,
      cr.courier_partner,
      cr.cod_amount,
      cr.cod_charges,
      cr.shipping_charges,
      cr.deductions,
      cr.remittable_amount,
      cr.status,
      cr.collected_at,
      cr.credited_at,
      cr.created_at
    FROM cod_remittances cr
    LEFT JOIN users u ON u.id = cr.user_id
    LEFT JOIN user_profiles up ON up."userId" = cr.user_id
    LEFT JOIN wallets w ON w."userId" = cr.user_id
    ${whereSql}
    ORDER BY cr.collected_at DESC NULLS LAST, cr.created_at DESC NULLS LAST
  `

  const result = await pool.query(sql, values)
  const rows = result.rows.map((row) => {
    const customerName = getCompanyName(row.company_info, row.customer_email || row.customer_id)
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName,
      customerEmail: row.customer_email || '',
      walletBalance: money(row.wallet_balance),
      orderId: row.order_id,
      orderType: row.order_type,
      orderNumber: row.order_number,
      awbNumber: row.awb_number || '',
      courierPartner: row.courier_partner || 'Unassigned',
      codAmount: money(row.cod_amount),
      codCharges: money(row.cod_charges),
      shippingCharges: money(row.shipping_charges),
      deductions: money(row.deductions),
      remittableAmount: money(row.remittable_amount),
      status: row.status,
      collectedAt: row.collected_at,
      creditedAt: row.credited_at,
      createdAt: row.created_at,
    }
  })

  const customers = new Map<string, any>()
  const couriers = new Map<string, any>()

  rows.forEach((row) => {
    const customer =
      customers.get(row.customerId) ||
      {
        customerId: row.customerId,
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        walletBalance: row.walletBalance,
        codOrderCount: 0,
        codAmount: 0,
        deductions: 0,
        codPayableAmount: 0,
        negativeWalletBalance: Math.max(0, -row.walletBalance),
        negativeWalletAdjustment: 0,
        netPayableBalance: 0,
      }

    customer.codOrderCount += 1
    customer.codAmount = money(customer.codAmount + row.codAmount)
    customer.deductions = money(customer.deductions + row.deductions)
    customer.codPayableAmount = money(customer.codPayableAmount + row.remittableAmount)
    customer.negativeWalletAdjustment = money(
      Math.min(customer.codPayableAmount, customer.negativeWalletBalance),
    )
    customer.netPayableBalance = money(
      customer.codPayableAmount - customer.negativeWalletAdjustment,
    )
    customers.set(row.customerId, customer)

    const courierKey = row.courierPartner || 'Unassigned'
    const courier =
      couriers.get(courierKey) ||
      {
        courierPartner: courierKey,
        deliveredCodOrders: 0,
        codToBeCollectedAmount: 0,
        deductions: 0,
        expectedReceivable: 0,
        creditedAmount: 0,
      }

    courier.deliveredCodOrders += 1
    courier.codToBeCollectedAmount = money(courier.codToBeCollectedAmount + row.codAmount)
    courier.deductions = money(courier.deductions + row.deductions)
    courier.expectedReceivable = money(courier.expectedReceivable + row.remittableAmount)
    if (row.status === 'credited') {
      courier.creditedAmount = money(courier.creditedAmount + row.remittableAmount)
    }
    couriers.set(courierKey, courier)
  })

  const customerPayables = Array.from(customers.values()).sort(
    (a, b) => b.codPayableAmount - a.codPayableAmount,
  )
  const courierReceivables = Array.from(couriers.values()).sort(
    (a, b) => b.expectedReceivable - a.expectedReceivable,
  )

  const summary = customerPayables.reduce(
    (acc, customer) => {
      acc.customerCount += 1
      acc.codPayableAmount = money(acc.codPayableAmount + customer.codPayableAmount)
      acc.negativeWalletAdjustment = money(
        acc.negativeWalletAdjustment + customer.negativeWalletAdjustment,
      )
      acc.netPayableBalance = money(acc.netPayableBalance + customer.netPayableBalance)
      return acc
    },
    {
      customerCount: 0,
      pendingOrderCount: rows.length,
      codPayableAmount: 0,
      negativeWalletAdjustment: 0,
      netPayableBalance: 0,
      courierReceivableAmount: courierReceivables.reduce(
        (sum, courier) => money(sum + courier.expectedReceivable),
        0,
      ),
    },
  )

  return {
    summary,
    customerPayables,
    deliveryRows: rows.slice(0, limit),
    courierReceivables,
    filters: {
      status: params.status || 'pending',
      limit,
    },
  }
}
