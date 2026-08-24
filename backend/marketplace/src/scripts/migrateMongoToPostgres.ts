import dotenv from 'dotenv'
import { MongoClient, type IndexDescriptionInfo } from 'mongodb'
import { Pool, type PoolClient } from 'pg'

dotenv.config()

const DOCUMENTS_TABLE = 'kourier_boyz_marketplace_documents'
const UNIQUE_KEYS_TABLE = 'kourier_boyz_marketplace_unique_keys'
const BATCH_SIZE = Math.max(1, Number(process.env.MARKETPLACE_MIGRATION_BATCH_SIZE) || 500)

const normalize = (value: any): any => {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object') return value
  if (value._bsontype === 'ObjectId') return value.toHexString()
  if (value._bsontype && typeof value.toString === 'function') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (Array.isArray(value)) return value.map(normalize)
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => [key, normalize(item)])
      .filter(([, item]) => item !== undefined),
  )
}

const getPath = (value: any, path: string): any => {
  const [part, ...remaining] = path.split('.')
  if (value == null) return undefined
  if (Array.isArray(value)) return value.map((item) => getPath(item, path))
  const current = value[part]
  return remaining.length ? getPath(current, remaining.join('.')) : current
}

const stableKey = (value: any): string => {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableKey(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const migrateUniqueKeys = async (
  client: PoolClient,
  collectionName: string,
  document: Record<string, any>,
  indexes: IndexDescriptionInfo[],
) => {
  const documentId = String(document._id)
  await client.query(
    `DELETE FROM ${UNIQUE_KEYS_TABLE} WHERE collection = $1 AND document_id = $2`,
    [collectionName, documentId],
  )

  for (const index of indexes.filter((candidate) => candidate.unique && candidate.name !== '_id_')) {
    const paths = Object.keys(index.key)
    const values = paths.map((path) => getPath(document, path))
    if (index.sparse && values.some((value) => value === null || value === undefined)) continue
    await client.query(
      `INSERT INTO ${UNIQUE_KEYS_TABLE} (collection, index_name, key_value, document_id)
       VALUES ($1, $2, $3, $4)`,
      [collectionName, index.name || paths.join('_'), values.map(stableKey).join('|'), documentId],
    )
  }
}

const migrateBatch = async (
  postgres: Pool,
  collectionName: string,
  sourceDocuments: Record<string, any>[],
  indexes: IndexDescriptionInfo[],
) => {
  const client = await postgres.connect()
  try {
    await client.query('BEGIN')
    for (const sourceDocument of sourceDocuments) {
      const document = normalize(sourceDocument)
      const documentId = String(document._id)
      await client.query(
        `INSERT INTO ${DOCUMENTS_TABLE} (collection, document_id, document)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (collection, document_id)
         DO UPDATE SET document = EXCLUDED.document,
                       version = ${DOCUMENTS_TABLE}.version + 1,
                       updated_at = now()`,
        [collectionName, documentId, JSON.stringify(document)],
      )
      await migrateUniqueKeys(client, collectionName, document, indexes)
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const run = async () => {
  const sourceMongoUri = process.env.SOURCE_MONGO_URI
  const databaseUrl = process.env.DATABASE_URL
  if (!sourceMongoUri) throw new Error('SOURCE_MONGO_URI is required for the one-time import')
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the PostgreSQL target')

  const mongo = new MongoClient(sourceMongoUri)
  const postgres = new Pool({ connectionString: databaseUrl })

  await mongo.connect()
  const source = mongo.db(process.env.SOURCE_MONGO_DATABASE || undefined)
  const collections = await source.listCollections({}, { nameOnly: true }).toArray()
  let migratedDocuments = 0

  try {
    for (const { name } of collections) {
      if (name.startsWith('system.')) continue
      const collection = source.collection(name)
      const indexes = await collection.indexes()
      const sourceCount = await collection.countDocuments()
      let batch: Record<string, any>[] = []

      for await (const sourceDocument of collection.find({}).batchSize(BATCH_SIZE)) {
        batch.push(sourceDocument)
        if (batch.length === BATCH_SIZE) {
          await migrateBatch(postgres, name, batch, indexes)
          batch = []
        }
      }
      if (batch.length) await migrateBatch(postgres, name, batch, indexes)

      const targetCount = await postgres.query(
        `SELECT count(*)::integer AS count FROM ${DOCUMENTS_TABLE} WHERE collection = $1`,
        [name],
      )
      if (Number(targetCount.rows[0]?.count || 0) < sourceCount) {
        throw new Error(`Count validation failed for ${name}`)
      }
      migratedDocuments += sourceCount
      console.log(`Migrated ${name}: ${sourceCount} document(s)`)
    }

    console.log(
      `Marketplace migration complete: ${migratedDocuments} document(s) across ${collections.length} collection(s)`,
    )
  } finally {
    await Promise.allSettled([mongo.close(), postgres.end()])
  }
}

void run().catch((error) => {
  console.error('Marketplace MongoDB to PostgreSQL migration failed', error)
  process.exitCode = 1
})
