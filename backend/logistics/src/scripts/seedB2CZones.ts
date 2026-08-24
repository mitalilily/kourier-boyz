import { sql } from 'drizzle-orm'
import { db } from '../models/client'
import { zones } from '../schema/schema'

async function seedB2CZones() {
  try {
    console.log('🌱 Seeding B2C zones...')

    const b2cZones = [
      {
        id: 'b10596c6-01bf-4061-a460-ab2e254aa462',
        code: 'METRO_TO_METRO',
        name: 'Metro to Metro',
        description:
          'Shipments moving between major metro cities, typically with the fastest service coverage and standard metro lane pricing.',
      },
      {
        id: 'a5a4fc8c-7f7e-4657-98be-285dcd4fcfb2',
        code: 'ROI',
        name: 'Rest of India',
        description:
          'Shipments that do not fall into metro, same-city, same-state, same-region, or special-zone categories and are served through the wider national network.',
      },
      {
        id: 'a0a126ca-112e-4bcd-b07f-eaf428228325',
        code: 'SPECIAL_ZONE',
        name: 'Special Zone',
        description:
          'Shipments going to or from exceptional service areas that require extra operational handling, routing control, or surcharge treatment outside the regular network.',
      },
      {
        id: '6eb63305-f569-4e57-96aa-e54161b33e9d',
        code: 'WITHIN_CITY',
        name: 'Within City',
        description:
          'Shipments where pickup and delivery happen inside the same city boundary, including eligible north-east metro movements treated as same-city lanes.',
      },
      {
        id: '1d887656-c855-4caa-a607-74c1aad2a4fd',
        code: 'WITHIN_REGION',
        name: 'Within Region',
        description:
          'Shipments travelling within a defined neighbouring-state region, where movement stays regional but crosses city or state boundaries.',
      },
      {
        id: '4a72f47e-b1b5-4248-8f0d-efadfef1448e',
        code: 'WITHIN_STATE',
        name: 'Within State',
        description:
          'Shipments whose pickup and delivery locations remain within the same state, excluding lanes already classified as within-city.',
      },
    ]

    for (const zone of b2cZones) {
      await db
        .insert(zones)
        .values({
          ...zone,
          business_type: 'B2C',
          created_at: sql`NOW()`,
          updated_at: sql`NOW()`,
        })
        .onConflictDoUpdate({
          target: zones.id,
          set: {
            code: zone.code,
            name: zone.name,
            description: zone.description,
            business_type: 'B2C',
            updated_at: sql`NOW()`,
          },
        })

      console.log(`✅ Upserted B2C zone: ${zone.name}`)
    }

    console.log('✅ B2C zones seeded successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error seeding B2C zones:', error)
    process.exit(1)
  }
}

seedB2CZones()
