type MoneyInput = string | number | null | undefined

type OrderItemLike = {
  qty?: MoneyInput
  quantity?: MoneyInput
  price?: MoneyInput
  discount?: MoneyInput
  tax_rate?: MoneyInput
  taxRate?: MoneyInput
  tax_value?: MoneyInput
  taxValue?: MoneyInput
  total_tax?: MoneyInput
}

export type BuyerCollectableInput = {
  orderAmount?: MoneyInput
  invoiceAmount?: MoneyInput
  items?: OrderItemLike[] | null
  shippingCharges?: MoneyInput
  transactionFee?: MoneyInput
  giftWrap?: MoneyInput
  discount?: MoneyInput
  prepaidAmount?: MoneyInput
  trustOrderAmount?: boolean
}

export const toMoneyNumber = (value: unknown, fallback = 0): number => {
  if (value === undefined || value === null || value === '') return fallback
  const normalized = typeof value === 'string' ? value.replace(/[^0-9.-]+/g, '') : value
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const roundMoney = (value: number): number =>
  Number((Number.isFinite(value) ? value : 0).toFixed(2))

export const clampMoney = (value: number): number => Math.max(0, roundMoney(value))

export const resolveItemsAmountWithTax = (items?: OrderItemLike[] | null): number => {
  if (!Array.isArray(items)) return 0

  return clampMoney(
    items.reduce((sum, item) => {
      const qty = Math.max(1, toMoneyNumber(item?.qty ?? item?.quantity, 1))
      const price = toMoneyNumber(item?.price, 0)
      const discount = Math.max(0, toMoneyNumber(item?.discount, 0))
      const taxable = Math.max(0, price * qty - discount)
      const explicitTax = toMoneyNumber(item?.tax_value ?? item?.taxValue ?? item?.total_tax, NaN)
      const tax =
        Number.isFinite(explicitTax) && explicitTax > 0
          ? explicitTax
          : taxable * (Math.max(0, toMoneyNumber(item?.tax_rate ?? item?.taxRate, 0)) / 100)

      return sum + taxable + tax
    }, 0),
  )
}

export const resolveBuyerCollectableAmount = ({
  orderAmount,
  invoiceAmount,
  items,
  shippingCharges,
  transactionFee,
  giftWrap,
  discount,
  prepaidAmount,
  trustOrderAmount = false,
}: BuyerCollectableInput): number => {
  const storedOrderAmount = toMoneyNumber(orderAmount, 0)
  const storedInvoiceAmount = toMoneyNumber(invoiceAmount, 0)
  const trustedAmount = storedOrderAmount > 0 ? storedOrderAmount : storedInvoiceAmount

  if (trustOrderAmount && trustedAmount > 0) {
    return clampMoney(trustedAmount)
  }

  const itemAmount = resolveItemsAmountWithTax(items)
  const baseAmount =
    storedOrderAmount > 0 && itemAmount > 0
      ? Math.max(storedOrderAmount, itemAmount)
      : storedOrderAmount > 0
        ? storedOrderAmount
        : itemAmount
  const fallbackBaseAmount = baseAmount > 0 ? baseAmount : storedInvoiceAmount

  return clampMoney(
    fallbackBaseAmount +
      toMoneyNumber(shippingCharges, 0) +
      toMoneyNumber(transactionFee, 0) +
      toMoneyNumber(giftWrap, 0) -
      Math.abs(toMoneyNumber(discount, 0)) -
      Math.abs(toMoneyNumber(prepaidAmount, 0)),
  )
}

export const isSalesChannelOrder = (order: Record<string, any> | null | undefined): boolean => {
  const orderId = String(order?.order_id || '').toLowerCase()
  const integrationType = String(order?.integration_type || '').toLowerCase()
  const tags = String(order?.tags || '').toLowerCase()

  return (
    orderId.startsWith('shopify_') ||
    orderId.startsWith('woo_') ||
    integrationType === 'shopify' ||
    integrationType === 'woocommerce' ||
    tags.includes('shopify_store:') ||
    tags.includes('woocommerce_store:')
  )
}
