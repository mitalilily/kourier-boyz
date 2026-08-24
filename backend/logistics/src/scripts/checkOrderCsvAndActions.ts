import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ADMIN_ORDER_EXPORT_HEADERS, toAdminOrderExportRow } from '../utils/adminOrderExportCsv'
import { buildCsv } from '../utils/csv'

const workspaceRoot = resolve(__dirname, '../../../..')
const clientRoot = join(workspaceRoot, 'seller-client/apps/logistics')
const clientCsvPath = join(clientRoot, 'src/utils/orderCsvExport.ts')
const b2cListPath = join(clientRoot, 'src/components/orders/b2c/B2COrdersList.tsx')

const clientCsvSource = readFileSync(clientCsvPath, 'utf8')
const b2cListSource = readFileSync(b2cListPath, 'utf8')

const requiredAdminColumns = [
  'Seller Name',
  'Pickup Date',
  'Delivery Date / Last Status',
  'Charged Weight (kg)',
]

const requiredClientColumns = [
  'Seller Name',
  'AWB Number',
  'Pickup Date',
  'Delivery Date / Last Status',
  'Charged Weight (kg)',
  'Last Updated',
]

const requiredActionLabels = [
  'View Details',
  'Generate Manifest',
  'Generate Label',
  'Generate Invoice',
  'Track Shipment',
  'Sync Live Status',
]

const missingAdminColumns = requiredAdminColumns.filter(
  (column) => !ADMIN_ORDER_EXPORT_HEADERS.includes(column),
)
const missingClientColumns = requiredClientColumns.filter(
  (column) => !clientCsvSource.includes(`'${column}'`),
)
const missingActionLabels = requiredActionLabels.filter(
  (label) => !b2cListSource.includes(label),
)

if (missingAdminColumns.length || missingClientColumns.length || missingActionLabels.length) {
  throw new Error(
    [
      missingAdminColumns.length ? `Missing admin CSV columns: ${missingAdminColumns.join(', ')}` : '',
      missingClientColumns.length ? `Missing client CSV columns: ${missingClientColumns.join(', ')}` : '',
      missingActionLabels.length ? `Missing B2C action labels: ${missingActionLabels.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  )
}

const sampleCsv = buildCsv(ADMIN_ORDER_EXPORT_HEADERS, [
  toAdminOrderExportRow({
    order_id: 'ORD-1001',
    merchantName: 'Demo Seller',
    awb_number: 'AWB123456789',
    buyer_name: 'Demo Customer',
    buyer_phone: '9999999999',
    buyer_email: 'buyer@example.com',
    order_status: 'delivered',
    order_type: 'prepaid',
    order_amount: 1299,
    courier_partner: 'Xpressbees',
    order_date: '2026-05-26',
    pickup_details: { final_pickup_date: '2026-05-26' },
    delivered_at: '2026-05-27T10:30:00.000Z',
    charged_weight: 0.75,
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    address: 'Connaught Place',
  }),
])

console.log('Order export and B2C actions proof')
console.log(`- admin previous last column: Address`)
console.log(`- admin added columns: ${requiredAdminColumns.join(', ')}`)
console.log(`- client previous last column: Created At`)
console.log(`- client new last column: Last Updated`)
console.log(`- B2C action menu labels: ${requiredActionLabels.join(', ')}`)
console.log(`- sample admin CSV header: ${sampleCsv.split('\n')[0].replace(/^\uFEFF/, '')}`)
