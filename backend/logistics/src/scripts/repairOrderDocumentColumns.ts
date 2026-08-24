import { pool } from '../models/client'

const statements = [
  `alter table b2c_orders alter column label type varchar(500)`,
  `alter table b2c_orders alter column manifest type varchar(500)`,
  `alter table b2c_orders alter column invoice_link type varchar(500)`,
  `alter table b2b_orders alter column label type varchar(500)`,
  `alter table b2b_orders alter column manifest type varchar(500)`,
  `alter table b2b_orders alter column invoice_link type varchar(500)`,
]

async function main() {
  const client = await pool.connect()
  try {
    await client.query('begin')
    for (const statement of statements) {
      await client.query(statement)
    }
    await client.query('commit')
    console.log(
      JSON.stringify({
        success: true,
        widenedColumns: [
          'b2c_orders.label',
          'b2c_orders.manifest',
          'b2c_orders.invoice_link',
          'b2b_orders.label',
          'b2b_orders.manifest',
          'b2b_orders.invoice_link',
        ],
        length: 500,
      }),
    )
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

main()
  .catch((error) => {
    console.error('Failed to widen order document columns:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
