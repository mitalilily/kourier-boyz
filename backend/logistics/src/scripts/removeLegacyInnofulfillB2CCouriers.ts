import { pool } from '../models/client'

const LEGACY_COURIER_IDS = [91001, 91002]
const SERVICE_PROVIDER = 'innofulfill'

const main = async () => {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const rateDelete = await client.query(
      `
        delete from shipping_rates
        where courier_id = any($1::int[])
          and lower(coalesce(service_provider, '')) = $2
          and business_type = 'b2c'
      `,
      [LEGACY_COURIER_IDS, SERVICE_PROVIDER],
    )

    const configDelete = await client.query(
      `
        delete from kourier_boyz_b2c_courier_rate_configs
        where courier_id = any($1::int[])
          and lower(coalesce(service_provider, '')) = $2
      `,
      [LEGACY_COURIER_IDS, SERVICE_PROVIDER],
    )

    const courierUpdate = await client.query(
      `
        update couriers
        set
          business_type = coalesce(business_type, '[]'::jsonb) - 'b2c',
          "isEnabled" = case
            when jsonb_array_length(coalesce(business_type, '[]'::jsonb) - 'b2c') = 0 then false
            else "isEnabled"
          end,
          updated_at = now()
        where id = any($1::int[])
          and lower(coalesce("serviceProvider", '')) = $2
          and coalesce(business_type, '[]'::jsonb) @> '["b2c"]'::jsonb
        returning id, name, "serviceProvider", "isEnabled", business_type
      `,
      [LEGACY_COURIER_IDS, SERVICE_PROVIDER],
    )

    const remainingB2C = await client.query(
      `
        select id, name, "serviceProvider", "isEnabled", business_type
        from couriers
        where id = any($1::int[])
          and lower(coalesce("serviceProvider", '')) = $2
          and coalesce(business_type, '[]'::jsonb) @> '["b2c"]'::jsonb
        order by id
      `,
      [LEGACY_COURIER_IDS, SERVICE_PROVIDER],
    )

    await client.query('COMMIT')

    console.log(
      JSON.stringify(
        {
          success: true,
          legacyCourierIds: LEGACY_COURIER_IDS,
          deletedB2CRates: rateDelete.rowCount,
          deletedB2CConfigs: configDelete.rowCount,
          updatedCouriers: courierUpdate.rows,
          remainingLegacyB2CCouriers: remainingB2C.rows,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

main()
  .catch((error) => {
    console.error('Failed to remove legacy Innofulfill B2C couriers', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
