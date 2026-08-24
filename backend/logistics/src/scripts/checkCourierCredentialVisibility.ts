import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

process.env.DATABASE_URL ||= 'postgres://postgres@127.0.0.1:5432/kourier_boyz_visibility_test'

const run = async () => {
  const { isCourierCredentialRowConfigured } = await import(
    '../models/services/courierCredentials.service'
  )

assert.equal(isCourierCredentialRowConfigured('delhivery', { apiKey: 'token' }), false)
assert.equal(
  isCourierCredentialRowConfigured('delhivery', { apiKey: 'token', clientName: 'hq-name' }),
  true,
)
assert.equal(
  isCourierCredentialRowConfigured('delhivery', {
    metadata: { ltlUsername: 'user', ltlToken: 'token' },
  }),
  true,
)
assert.equal(
  isCourierCredentialRowConfigured('ekart', { clientId: 'client', username: 'user' }),
  false,
)
assert.equal(
  isCourierCredentialRowConfigured('ekart', {
    clientId: 'client',
    username: 'user',
    password: 'password',
  }),
  true,
)
assert.equal(isCourierCredentialRowConfigured('xpressbees', { apiKey: 'token' }), true)
assert.equal(isCourierCredentialRowConfigured('shadowfax', { apiKey: '' }), false)
assert.equal(isCourierCredentialRowConfigured('shadowfax', { apiKey: 'token' }), true)
assert.equal(
  isCourierCredentialRowConfigured('amazon', {
    metadata: {
      refreshToken: 'refresh',
      lwaClientId: 'client',
      lwaClientSecret: 'secret',
    },
  }),
  true,
)

const seedSource = fs.readFileSync(
  path.resolve(__dirname, 'seedBasicProviderRateCards.ts'),
  'utf8',
)
assert.doesNotMatch(seedSource, /insert\s+into\s+couriers/i)
assert.doesNotMatch(seedSource, /ensureFallbackCouriers/)
assert.match(seedSource, /courier_credentials/)

const delhiverySyncSource = fs.readFileSync(
  path.resolve(__dirname, 'syncDelhiveryB2CCouriers.ts'),
  'utf8',
)
assert.match(delhiverySyncSource, /DELHIVERY_COURIER_IDS\.EXPRESS/)
assert.match(delhiverySyncSource, /DELHIVERY_COURIER_IDS\.SURFACE/)
assert.match(delhiverySyncSource, /getConfiguredCourierProviderSet/)
assert.doesNotMatch(delhiverySyncSource, /apiKey:\s*['"][A-Za-z0-9]/)

  console.log('Credential-gated courier visibility checks passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
