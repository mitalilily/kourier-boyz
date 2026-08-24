import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/kourier_boyz_test'
process.env.ACCESS_TOKEN_SECRET ||= 'test-access-secret'
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret'

const run = async () => {
  const { server } = await import('../app')

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  try {
    const address = server.address()
    assert.ok(address && typeof address === 'object')
    const baseUrl = `http://127.0.0.1:${address.port}`

    const healthResponse = await fetch(`${baseUrl}/api/health`)
    assert.equal(healthResponse.status, 200)
    assert.equal(healthResponse.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(healthResponse.headers.get('x-frame-options'), 'SAMEORIGIN')
    const healthBody = await healthResponse.json()
    assert.equal(healthBody.success, true)
    assert.equal(healthBody.status, 'ok')

    const missingResponse = await fetch(`${baseUrl}/api/does-not-exist`)
    assert.equal(missingResponse.status, 404)
    const missingBody = await missingResponse.json()
    assert.equal(missingBody.success, false)
    assert.equal(missingBody.message, 'Route not found')
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }

  console.log('HTTP security and health checks passed')
}

run().catch((error) => {
  console.error('HTTP security and health checks failed')
  console.error(error)
  process.exit(1)
})
