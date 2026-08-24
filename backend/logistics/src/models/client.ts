import * as dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as path from 'path' // ✅ use this instead of `import path from 'path'`
import { Pool } from 'pg'
import * as schema from '../schema/schema'

// Load environment file based on NODE_ENV
const env = process.env.NODE_ENV || 'development'
console.log('ENVIRONMENT', env)
const envFilePath = path.resolve(__dirname, `../../.env.${env}`)

console.log(`🔍 Loading env file: ${envFilePath}`)
dotenv.config({ path: envFilePath })

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL is missing')
}

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: env === 'production' ? { rejectUnauthorized: false } : false,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000),
  query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS || 60000),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 60000),
  lock_timeout: Number(process.env.PG_LOCK_TIMEOUT_MS || 10000),
  idle_in_transaction_session_timeout: Number(
    process.env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS || 15000,
  ),
  application_name: process.env.PG_APP_NAME || `kourier-boyz-${env}`,
}

export const pool = new Pool({
  ...poolConfig,
})

// console.log('DEBUG: pool created?', !!pool, 'pool.constructor.name=', pool?.constructor?.name)

export const db = drizzle(pool, {
  schema: schema,
})

// ✅ New function you can call explicitly in scripts
export function initPool() {
  console.log('ℹ️ initPool called')
  return { pool, db }
}

// Surface unexpected pool-level errors
pool.on('error', (err) => {
  console.error('❌ PG Pool error:', {
    message: err?.message,
    stack: err?.stack,
  })
})

pool.on('connect', (client) => {
  console.log('✅ PG client connected', {
    processID: (client as any).processID ?? null,
    statement_timeout_ms: poolConfig.statement_timeout,
    query_timeout_ms: poolConfig.query_timeout,
    lock_timeout_ms: poolConfig.lock_timeout,
    idle_in_transaction_timeout_ms: poolConfig.idle_in_transaction_session_timeout,
  })
})

/**
 * Test database connection on startup
 * Returns true if connection succeeds, false otherwise
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect()
    try {
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version')
      const { current_time, pg_version } = result.rows[0]
      console.log('✅ Database connection succeeded')

      // Parse PostgreSQL version (format: "PostgreSQL 15.3 on x86_64...")
      const versionMatch = pg_version.match(/PostgreSQL\s+([\d.]+)/)
      const version = versionMatch ? versionMatch[1] : 'unknown'
      console.log(`   PostgreSQL version: ${version}`)
      console.log(`   Server time: ${current_time}`)

      return true
    } finally {
      client.release()
    }
  } catch (err: any) {
    console.error('❌ Database connection failed:')
    console.error(`   Error: ${err.message}`)
    if (err.code) {
      console.error(`   Code: ${err.code}`)
    }
    if (err.host) {
      console.error(`   Host: ${err.host}`)
    }
    if (err.port) {
      console.error(`   Port: ${err.port}`)
    }
    if (process.env.NODE_ENV === 'development' && err.stack) {
      console.error(`   Stack: ${err.stack}`)
    }
    return false
  }
}
