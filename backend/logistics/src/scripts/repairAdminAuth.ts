import bcrypt from 'bcryptjs'
import { Client } from 'pg'
import { randomUUID } from 'crypto'

const databaseUrl = process.env.DATABASE_URL
const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD
const adminPhone = process.env.ADMIN_PHONE || '+916283315911'

if (!databaseUrl || !adminEmail || !adminPassword) {
  throw new Error('DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD are required')
}

const repairAdminAuth = async () => {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
  })

  await client.connect()

  try {
    await client.query('BEGIN')
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS "pendingEmail" varchar(100),
        ADD COLUMN IF NOT EXISTS "pendingPhone" varchar(20),
        ADD COLUMN IF NOT EXISTS "previousRefreshToken" varchar(500),
        ADD COLUMN IF NOT EXISTS "previousRefreshTokenExpiresAt" timestamp,
        ADD COLUMN IF NOT EXISTS "accountVerified" boolean DEFAULT false,
        ADD COLUMN IF NOT EXISTS "emailVerificationToken" varchar(8),
        ADD COLUMN IF NOT EXISTS "emailVerificationTokenExpiresAt" timestamptz
    `)

    const passwordHash = await bcrypt.hash(adminPassword, 10)
    const existing = await client.query(
      'SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1',
      [adminEmail.toLowerCase(), adminPhone],
    )

    if (existing.rowCount) {
      await client.query(
        `UPDATE users
         SET email = $1, phone = $2, "passwordHash" = $3, role = 'admin',
             "emailVerified" = true, "phoneVerified" = true,
             "accountVerified" = true, "updatedAt" = NOW()
         WHERE id = $4`,
        [adminEmail.toLowerCase(), adminPhone, passwordHash, existing.rows[0].id],
      )
    } else {
      await client.query(
        `INSERT INTO users
          (id, email, phone, "passwordHash", role, "emailVerified", "phoneVerified", "accountVerified", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'admin', true, true, true, NOW(), NOW())`,
        [randomUUID(), adminEmail.toLowerCase(), adminPhone, passwordHash],
      )
    }

    await client.query('COMMIT')
    console.log(`Admin authentication repaired for ${adminEmail.toLowerCase()}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

repairAdminAuth().catch((error) => {
  console.error('Admin authentication repair failed:', error)
  process.exit(1)
})
