import { randomUUID } from 'crypto'
import { Client } from 'pg'
import rateData from './data/internationalFedexBasicRates.json'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const RETIRED_CARD_NAMES = ['Kourier Boyz International Package Basic']
const shouldSeedPlaceholderRates =
  process.env.SEED_INTERNATIONAL_PLACEHOLDER_RATES === 'true' ||
  process.argv.includes('--with-placeholder-rates')

type RateRow = {
  weight: number
  rates: Record<string, number>
}

type RateSection = {
  code: string
  label: string
  rows: RateRow[]
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
})

const ensureSchema = async () => {
  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE IF NOT EXISTS kourier_boyz_international_rate_cards (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(180) NOT NULL,
      origin_zone varchar(20) NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS kourier_boyz_international_rates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      rate_card_id uuid NOT NULL REFERENCES kourier_boyz_international_rate_cards(id) ON DELETE CASCADE,
      delivery_partner varchar(150) NOT NULL,
      destination_country varchar(120) NOT NULL,
      destination_zone varchar(20),
      min_weight numeric(10,3) NOT NULL DEFAULT 0,
      max_weight numeric(10,3) NOT NULL,
      base_rate numeric(12,2) NOT NULL DEFAULT 0,
      rate_per_kg numeric(12,2) NOT NULL DEFAULT 0,
      fuel_surcharge_mode varchar(20) NOT NULL DEFAULT 'percentage',
      fuel_surcharge_value numeric(12,2) NOT NULL DEFAULT 0,
      currency varchar(3) NOT NULL DEFAULT 'INR',
      estimated_days varchar(40),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS kourier_boyz_international_country_zones (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      country_name varchar(160) NOT NULL,
      country_key varchar(180) NOT NULL UNIQUE,
      zone_code varchar(20) NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE kourier_boyz_international_rates ALTER COLUMN destination_country TYPE varchar(120);
    ALTER TABLE kourier_boyz_international_rates ADD COLUMN IF NOT EXISTS destination_zone varchar(20);
    ALTER TABLE kourier_boyz_international_rates ADD COLUMN IF NOT EXISTS fuel_surcharge_mode varchar(20) NOT NULL DEFAULT 'percentage';
    ALTER TABLE kourier_boyz_international_rates ADD COLUMN IF NOT EXISTS fuel_surcharge_value numeric(12,2) NOT NULL DEFAULT 0;
  `)
}

const getCardName = (section: RateSection) =>
  `Kourier Boyz International ${section.label} Basic`

const upsertRateCard = async (section: RateSection) => {
  const cardName = getCardName(section)
  const existing = await client.query(
    'SELECT id FROM kourier_boyz_international_rate_cards WHERE name = $1 LIMIT 1',
    [cardName],
  )
  const cardId = existing.rows[0]?.id || randomUUID()
  if (existing.rowCount) {
    await client.query(
      `UPDATE kourier_boyz_international_rate_cards
       SET origin_zone = $2, is_active = true, updated_at = now()
       WHERE id = $1`,
      [cardId, rateData.originZone],
    )
  } else {
    await client.query(
      `INSERT INTO kourier_boyz_international_rate_cards (id, name, origin_zone)
       VALUES ($1, $2, $3)`,
      [cardId, cardName, rateData.originZone],
    )
  }
  return cardId
}

const seedCountryZones = async () => {
  for (const country of rateData.countries) {
    await client.query(
      `INSERT INTO kourier_boyz_international_country_zones
         (id, country_name, country_key, zone_code, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (country_key) DO UPDATE
         SET country_name = EXCLUDED.country_name,
             zone_code = EXCLUDED.zone_code,
             is_active = true,
             updated_at = now()`,
      [randomUUID(), country.countryName, country.countryKey, country.zoneCode],
    )
  }
}

const seedRatesForCard = async (cardId: string, section: RateSection) => {
  await client.query('DELETE FROM kourier_boyz_international_rates WHERE rate_card_id = $1', [cardId])

  const sortedRows = [...section.rows].sort((a, b) => a.weight - b.weight)
  for (let index = 0; index < sortedRows.length; index += 1) {
    const row = sortedRows[index]
    const previousWeight = index === 0 ? 0 : sortedRows[index - 1].weight
    const minWeight = index === 0 ? 0 : Number((previousWeight + 0.001).toFixed(3))
    for (const courier of rateData.couriers) {
      for (const zone of rateData.zones) {
        const amount = row.rates[zone]
        if (!Number.isFinite(amount)) continue
        await client.query(
          `INSERT INTO kourier_boyz_international_rates
             (id, rate_card_id, delivery_partner, destination_country, destination_zone,
              min_weight, max_weight, base_rate, rate_per_kg, fuel_surcharge_mode,
              fuel_surcharge_value, currency, estimated_days)
           VALUES ($1,$2,$3,'*',$4,$5,$6,$7,0,'percentage',0,$8,$9)`,
          [
            randomUUID(),
            cardId,
            courier,
            zone,
            minWeight.toFixed(3),
            row.weight.toFixed(3),
            Number(amount).toFixed(2),
            rateData.currency,
            'Manual quote',
          ],
        )
      }
    }
  }
}

const seed = async () => {
  await client.connect()
  try {
    await client.query('BEGIN')
    await ensureSchema()
    const activeCardNames = (rateData.sections as RateSection[]).map((section) => getCardName(section))
    if (shouldSeedPlaceholderRates) {
      await client.query(
        `DELETE FROM kourier_boyz_international_rate_cards
         WHERE name = ANY($1::text[])`,
        [RETIRED_CARD_NAMES],
      )
      await client.query(
        `UPDATE kourier_boyz_international_rate_cards
         SET is_active = false, updated_at = now()
         WHERE name <> ALL($1::text[])`,
        [activeCardNames],
      )
    }
    await seedCountryZones()
    for (const section of rateData.sections as RateSection[]) {
      const cardId = await upsertRateCard(section)
      if (shouldSeedPlaceholderRates) {
        await seedRatesForCard(cardId, section)
      }
    }
    await client.query('COMMIT')
    console.log(
      shouldSeedPlaceholderRates
        ? `Seeded ${rateData.countries.length} international destinations and ${rateData.sections.length} placeholder rate cards.`
        : `Synced ${rateData.countries.length} international destinations. Placeholder rate rows were not seeded.`,
    )
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

seed().catch((error) => {
  console.error('International FedEx basic rate seed failed:', error)
  process.exit(1)
})
