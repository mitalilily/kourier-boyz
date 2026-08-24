import { randomUUID } from 'crypto'
import { Client } from 'pg'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')
const shouldSeedLegacyInternationalRates =
  process.env.SEED_LEGACY_INTERNATIONAL_PLACEHOLDER_RATES === 'true' ||
  process.argv.includes('--with-legacy-international-rates')

const sync = async () => {
  const client = new Client({ connectionString: databaseUrl, ssl: databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
      CREATE TABLE IF NOT EXISTS kourier_boyz_additional_charge_masters (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(150) NOT NULL, code varchar(80) NOT NULL UNIQUE,
        default_mode varchar(30) NOT NULL DEFAULT 'flat', default_basis varchar(40) NOT NULL DEFAULT 'shipment',
        description text, is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS kourier_boyz_diesel_rates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), diesel_rate numeric(10,2) NOT NULL, effective_date date NOT NULL,
        remarks text, is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS kourier_boyz_international_rate_cards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(180) NOT NULL, origin_zone varchar(20) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS kourier_boyz_international_rates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rate_card_id uuid NOT NULL REFERENCES kourier_boyz_international_rate_cards(id) ON DELETE CASCADE,
        delivery_partner varchar(150) NOT NULL, destination_country varchar(120) NOT NULL,
        destination_zone varchar(20),
        min_weight numeric(10,3) NOT NULL DEFAULT 0, max_weight numeric(10,3) NOT NULL,
        base_rate numeric(12,2) NOT NULL DEFAULT 0, rate_per_kg numeric(12,2) NOT NULL,
        fuel_surcharge_mode varchar(20) NOT NULL DEFAULT 'percentage',
        fuel_surcharge_value numeric(12,2) NOT NULL DEFAULT 0,
        currency varchar(3) NOT NULL DEFAULT 'INR', estimated_days varchar(40), is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS kourier_boyz_international_country_zones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), country_name varchar(160) NOT NULL,
        country_key varchar(180) NOT NULL UNIQUE, zone_code varchar(20) NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS kourier_boyz_b2c_courier_rate_configs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
        courier_id integer NOT NULL, service_provider varchar(100) NOT NULL DEFAULT '', mode varchar(50) NOT NULL DEFAULT 'surface',
        use_shipping_charge_api boolean NOT NULL DEFAULT false, fsc_percentage numeric(8,2),
        minimum_cod_charge numeric(10,2), cod_charge_percentage numeric(8,2), to_pay_charge numeric(10,2),
        minimum_ras_charge numeric(10,2), ras_charge_per_kg numeric(10,2),
        minimum_critical_pickup_charge numeric(10,2), critical_pickup_charge_per_kg numeric(10,2),
        minimum_critical_delivery_charge numeric(10,2), critical_delivery_charge_per_kg numeric(10,2),
        addition_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT b2c_courier_rate_config_scope_unique UNIQUE (plan_id, courier_id, service_provider, mode)
      );
      CREATE TABLE IF NOT EXISTS kourier_boyz_holidays (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(200) NOT NULL, date date NOT NULL, description text,
        type varchar(50) NOT NULL, state varchar(200), courier_id integer, service_provider varchar(100),
        is_recurring boolean NOT NULL DEFAULT false, year integer, is_active boolean NOT NULL DEFAULT true,
        metadata text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        created_by varchar(100)
      );
      ALTER TABLE kourier_boyz_additional_charge_masters ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE kourier_boyz_diesel_rates ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE kourier_boyz_international_rate_cards ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE kourier_boyz_international_rates ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE kourier_boyz_international_rates ALTER COLUMN destination_country TYPE varchar(120);
      ALTER TABLE kourier_boyz_international_rates ADD COLUMN IF NOT EXISTS destination_zone varchar(20);
      ALTER TABLE kourier_boyz_international_rates ADD COLUMN IF NOT EXISTS fuel_surcharge_mode varchar(20) NOT NULL DEFAULT 'percentage';
      ALTER TABLE kourier_boyz_international_rates ADD COLUMN IF NOT EXISTS fuel_surcharge_value numeric(12,2) NOT NULL DEFAULT 0;
      ALTER TABLE kourier_boyz_international_country_zones ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE kourier_boyz_holidays ALTER COLUMN id SET DEFAULT gen_random_uuid();
      ALTER TABLE kourier_boyz_b2c_courier_rate_configs ALTER COLUMN id SET DEFAULT gen_random_uuid();
      INSERT INTO kourier_boyz_zones (id, code, name, description, business_type)
      VALUES
        (gen_random_uuid(), 'A', 'ZONE A', 'Within city and local shipments.', 'B2C'),
        (gen_random_uuid(), 'B', 'ZONE B', 'Metro city to metro city.', 'B2C'),
        (gen_random_uuid(), 'C', 'ZONE C', 'Metro to non-metro and non-metro to metro.', 'B2C'),
        (gen_random_uuid(), 'D', 'ZONE D', 'Rest of India.', 'B2C'),
        (gen_random_uuid(), 'E', 'ZONE E', 'Northeast, Jammu and Kashmir, and special regions.', 'B2C'),
        (gen_random_uuid(), 'F', 'ZONE F', 'Remote and ODA service locations.', 'B2C')
      ON CONFLICT (code, business_type) DO UPDATE
        SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now();
    `)

    const existing = await client.query(`SELECT id FROM kourier_boyz_international_rate_cards WHERE name = $1 LIMIT 1`, ['INTERNATIONAL PURCHASE RATES'])
    const cardId = existing.rows[0]?.id || randomUUID()
    if (!existing.rowCount) {
      await client.query(`INSERT INTO kourier_boyz_international_rate_cards (id, name, origin_zone) VALUES ($1, $2, $3)`, [cardId, 'INTERNATIONAL PURCHASE RATES', 'AU'])
    }
    const rateCount = await client.query(`SELECT COUNT(*)::int AS count FROM kourier_boyz_international_rates WHERE rate_card_id = $1`, [cardId])
    if (!rateCount.rows[0].count && shouldSeedLegacyInternationalRates) {
      const bands = [
        ['Kourier Boyz Global Express', '0', '5', '450', '320', '4-7 business days'],
        ['Kourier Boyz Global Express', '5', '20', '350', '285', '4-7 business days'],
        ['Kourier Boyz Economy', '0', '5', '300', '245', '8-12 business days'],
        ['Kourier Boyz Economy', '5', '20', '250', '210', '8-12 business days'],
      ]
      for (const [partner, minWeight, maxWeight, baseRate, ratePerKg, estimatedDays] of bands) {
        await client.query(`INSERT INTO kourier_boyz_international_rates (id, rate_card_id, delivery_partner, destination_country, min_weight, max_weight, base_rate, rate_per_kg, fuel_surcharge_mode, fuel_surcharge_value, estimated_days) VALUES ($1,$2,$3,'*',$4,$5,$6,$7,'percentage',0,$8)`, [randomUUID(), cardId, partner, minWeight, maxWeight, baseRate, ratePerKg, estimatedDays])
      }
    }
    if (!shouldSeedLegacyInternationalRates) {
      console.log('Skipped legacy international placeholder rate rows')
    }
    await client.query('COMMIT')
    console.log('Rate Card feature tables synchronized')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

sync().catch((error) => { console.error('Rate Card feature sync failed:', error); process.exit(1) })
