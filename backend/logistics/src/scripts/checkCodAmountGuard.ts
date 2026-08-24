import assert from 'assert'
import {
  isSalesChannelOrder,
  resolveBuyerCollectableAmount,
  resolveItemsAmountWithTax,
} from '../utils/codAmount'

const wooOrder = {
  order_id: 'woo_woo_3c59a4f7143455_143455',
  integration_type: 'woocommerce',
  tags: 'woocommerce_store:woo_3c59a4f7',
  order_amount: 1599,
  shipping_charges: 99,
  discount: 400,
  prepaid_amount: 0,
}

assert.equal(isSalesChannelOrder(wooOrder), true)
assert.equal(
  resolveBuyerCollectableAmount({
    orderAmount: wooOrder.order_amount,
    shippingCharges: wooOrder.shipping_charges,
    discount: wooOrder.discount,
    prepaidAmount: wooOrder.prepaid_amount,
    trustOrderAmount: isSalesChannelOrder(wooOrder),
  }),
  1599,
)

assert.equal(
  resolveItemsAmountWithTax([
    { price: 1000, qty: 1, discount: 100, tax_rate: 18 },
    { price: 250, qty: 2, tax_value: 45 },
  ]),
  1607,
)

assert.equal(
  resolveBuyerCollectableAmount({
    orderAmount: 1000,
    items: [{ price: 1000, qty: 1, tax_rate: 18 }],
    shippingCharges: 50,
    transactionFee: 10,
    giftWrap: 5,
    discount: 100,
    prepaidAmount: 200,
  }),
  945,
)

assert.equal(
  resolveBuyerCollectableAmount({
    orderAmount: 1000,
    shippingCharges: 50,
    transactionFee: 10,
    giftWrap: 5,
    discount: 100,
    prepaidAmount: 200,
  }),
  765,
)

assert.equal(
  resolveBuyerCollectableAmount({
    orderAmount: 100,
    discount: 500,
    prepaidAmount: 500,
  }),
  0,
)

console.log('COD amount guard checks passed')
