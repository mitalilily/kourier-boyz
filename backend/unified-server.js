'use strict'

const http = require('node:http')

const PORT = Number(process.env.PORT || 4000)
const MARKETPLACE_PREFIX = '/api/marketplace'

process.env.KOURIER_BOYZ_LOGISTICS_API_URL ||= `http://127.0.0.1:${PORT}/api`

const marketplace = require('./marketplace/dist/server')
const { disconnectMarketplacePostgres } = require('./marketplace/dist/database/postgresMongoose')
const { app: logisticsApp } = require('./logistics/dist/app')
const { registerLogisticsSocketHandlers } = require('./logistics/dist/config/socketServer')
const { pool: logisticsPool, testDatabaseConnection } = require('./logistics/dist/models/client')

const server = http.createServer((request, response) => {
  const requestUrl = request.url || '/'
  if (requestUrl === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', service: 'kourier-boyz-backend' }))
    return
  }

  if (requestUrl === MARKETPLACE_PREFIX || requestUrl.startsWith(`${MARKETPLACE_PREFIX}/`)) {
    const suffix = requestUrl.slice(MARKETPLACE_PREFIX.length)
    request.url = `/api${suffix || ''}`
    marketplace.app(request, response)
    return
  }

  logisticsApp(request, response)
})

server.timeout = 210_000

const start = async () => {
  if (!(await testDatabaseConnection())) {
    throw new Error('The unified backend could not connect to PostgreSQL')
  }

  await marketplace.startMarketplaceRuntime({ listen: false, httpServer: server })
  registerLogisticsSocketHandlers(marketplace.io)
  require('./logistics/dist/crons')

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Kourier Boyz unified backend listening on port ${PORT}`)
    console.log(`Courier API: /api | Marketplace API: ${MARKETPLACE_PREFIX}`)
  })
}

let shuttingDown = false
const shutdown = async (signal) => {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`Received ${signal}; shutting down the unified backend`)

  await new Promise((resolve) => server.close(resolve))
  await Promise.allSettled([disconnectMarketplacePostgres(), logisticsPool.end()])
  process.exit(0)
}

module.exports = { server, start, shutdown }

if (require.main === module) {
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  void start().catch((error) => {
    console.error('Kourier Boyz unified backend failed to start', error)
    process.exitCode = 1
  })
}
