import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { getWalletTransactionOrderLookup } from '../utils/walletTransactionOrderLink'

const shipmentLookup = getWalletTransactionOrderLookup({
  type: 'debit',
  reason: 'B2C COD Service Charges',
  ref: '123e4567-e89b-12d3-a456-426614174000',
  meta: {
    awb_number: 'AWB123456789',
    order_number: 'ORD-1001',
    shipment_id: 'SHIP-1001',
    courier_name: 'DeliveryOne',
  },
})

assert.equal(shipmentLookup.isShipmentOrderTransaction, true)
assert.deepEqual(shipmentLookup.awbNumbers, ['AWB123456789'])
assert.deepEqual(shipmentLookup.orderNumbers, ['ORD-1001'])
assert.deepEqual(shipmentLookup.shipmentIds, ['SHIP-1001'])

const topupLookup = getWalletTransactionOrderLookup({
  type: 'credit',
  reason: 'Wallet Recharge',
  ref: 'pay_test_123',
  meta: {
    orderId: 'order_gateway_123',
    gateway: 'razorpay',
  },
})

assert.equal(topupLookup.isShipmentOrderTransaction, false)
assert.deepEqual(topupLookup.awbNumbers, [])
assert.deepEqual(topupLookup.orderIds, [])

const adminWalletSource = fs.readFileSync(
  path.resolve(process.cwd(), '../../admin/logistics/src/views/Wallets/AdminWallets.jsx'),
  'utf8',
)

assert.equal(adminWalletSource.includes('<Th>AWB</Th>'), true)
assert.equal(adminWalletSource.includes('OrderDetailsModal'), true)
assert.equal(adminWalletSource.includes('renderTransactionAwb(txn)'), true)

console.log('Wallet transaction AWB proof')
console.log(`- shipment transaction AWB: ${shipmentLookup.awbNumbers[0]}`)
console.log(`- shipment transaction order number: ${shipmentLookup.orderNumbers[0]}`)
console.log('- wallet recharge stays unlinked: true')
console.log('- admin wallet table has clickable AWB/order-details wiring: true')
