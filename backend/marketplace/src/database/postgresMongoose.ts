import mongoose from 'mongoose'
import { aggregate as runAggregation, find as runFind, Query, update as applyUpdate } from 'mingo'
import { Pool, type PoolClient, type QueryResult } from 'pg'

type AnyDocument = Record<string, any>
type QueryExecutor = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>
type PoolLike = Pick<Pool, 'query' | 'connect' | 'end'>

type UniqueDefinition = {
  name: string
  paths: string[]
  sparse: boolean
}

const DOCUMENTS_TABLE = 'kourier_boyz_marketplace_documents'
const UNIQUE_KEYS_TABLE = 'kourier_boyz_marketplace_unique_keys'

let pool: PoolLike | null = null
let connected = false
let modelMethodPatched = false

const collectionAdapters = new Map<string, PostgresCollection>()

const createPool = (): PoolLike => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the Kourier Boyz marketplace database')
  }

  return new Pool({
    connectionString,
    max: Number(process.env.MARKETPLACE_PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10_000),
    application_name: 'kourier-boyz-marketplace',
  })
}

const getPool = () => {
  pool ||= createPool()
  return pool
}

export const setMarketplacePostgresPoolForTests = (testPool: PoolLike | null) => {
  pool = testPool
  connected = false
}

const ensureStorage = async () => {
  const database = getPool()
  await database.query(`
    CREATE TABLE IF NOT EXISTS ${DOCUMENTS_TABLE} (
      collection varchar(160) NOT NULL,
      document_id varchar(64) NOT NULL,
      document jsonb NOT NULL,
      version integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, document_id)
    )
  `)
  await database.query(
    `CREATE INDEX IF NOT EXISTS kb_marketplace_documents_collection_idx ON ${DOCUMENTS_TABLE} (collection)`,
  )
  await database.query(
    `CREATE INDEX IF NOT EXISTS kb_marketplace_documents_payload_gin_idx ON ${DOCUMENTS_TABLE} USING gin (document jsonb_path_ops)`,
  )
  await database.query(`
    CREATE TABLE IF NOT EXISTS ${UNIQUE_KEYS_TABLE} (
      collection varchar(160) NOT NULL,
      index_name varchar(220) NOT NULL,
      key_value text NOT NULL,
      document_id varchar(64) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, index_name, key_value)
    )
  `)
  await database.query(
    `CREATE INDEX IF NOT EXISTS kb_marketplace_unique_keys_document_idx ON ${UNIQUE_KEYS_TABLE} (collection, document_id)`,
  )
}

const isObjectId = (value: unknown): value is mongoose.Types.ObjectId =>
  Boolean(value && typeof value === 'object' && (value as any)._bsontype === 'ObjectId')

const normalizeForStorage = (value: any, seen = new WeakSet<object>()): any => {
  if (value === undefined) return undefined
  if (value === null || typeof value !== 'object') return value
  if (isObjectId(value)) return value.toHexString()
  if (value._bsontype && typeof value.toString === 'function') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (value instanceof RegExp) return { $regex: value.source, $options: value.flags }
  if (Buffer.isBuffer(value)) return value.toString('base64')
  if (value.$__ && typeof value.toObject === 'function') {
    return normalizeForStorage(
      value.toObject({ depopulate: true, flattenMaps: true, getters: false, virtuals: false }),
      seen,
    )
  }
  if (seen.has(value)) return undefined
  seen.add(value)
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([key, item]) => [key, normalizeForStorage(item, seen)]),
    )
  }
  if (Array.isArray(value)) return value.map((item) => normalizeForStorage(item, seen))

  const normalized: AnyDocument = {}
  for (const [key, item] of Object.entries(value)) {
    const next = normalizeForStorage(item, seen)
    if (next !== undefined) normalized[key] = next
  }
  return normalized
}

const getPath = (value: any, path: string): any => {
  const [part, ...remaining] = path.split('.')
  if (value == null) return undefined
  if (Array.isArray(value)) return value.map((item) => getPath(item, path))
  const current = value[part]
  return remaining.length ? getPath(current, remaining.join('.')) : current
}

const stableKey = (value: any): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (isObjectId(value)) return value.toHexString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return `[${value.map(stableKey).join(',')}]`
  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableKey(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const duplicateKeyError = (
  collection: string,
  definition: UniqueDefinition,
  document: AnyDocument,
) => {
  const keyValue = Object.fromEntries(definition.paths.map((path) => [path, getPath(document, path)]))
  const error = new Error(
    `E11000 duplicate key error collection: ${collection} index: ${definition.name}`,
  ) as Error & {
    code: number
    keyPattern: Record<string, number>
    keyValue: Record<string, unknown>
  }
  error.name = 'MongoServerError'
  error.code = 11000
  error.keyPattern = Object.fromEntries(definition.paths.map((path) => [path, 1]))
  error.keyValue = keyValue
  return error
}

class PostgresSession {
  private client: PoolClient | null = null
  private active = false
  hasEnded = false

  startTransaction() {
    if (this.hasEnded) throw new Error('Cannot start a transaction on an ended session')
    this.active = true
  }

  inTransaction() {
    return this.active
  }

  async executor(): Promise<QueryExecutor> {
    if (!this.active) return getPool()
    if (!this.client) {
      this.client = await getPool().connect()
      await this.client.query('BEGIN')
    }
    return this.client
  }

  async commitTransaction() {
    if (this.client) {
      await this.client.query('COMMIT')
      this.client.release()
      this.client = null
    }
    this.active = false
  }

  async abortTransaction() {
    if (this.client) {
      await this.client.query('ROLLBACK')
      this.client.release()
      this.client = null
    }
    this.active = false
  }

  async withTransaction<T>(work: () => Promise<T>) {
    this.startTransaction()
    try {
      const result = await work()
      await this.commitTransaction()
      return result
    } catch (error) {
      await this.abortTransaction()
      throw error
    }
  }

  endSession() {
    this.hasEnded = true
    if (this.client) {
      const client = this.client
      this.client = null
      this.active = false
      void client.query('ROLLBACK').finally(() => client.release())
    }
  }
}

const getExecutor = async (options?: AnyDocument): Promise<QueryExecutor> => {
  if (options?.__executor) return options.__executor
  const session = options?.session
  if (session instanceof PostgresSession) return session.executor()
  return getPool()
}

const withWriteTransaction = async <T>(
  options: AnyDocument | undefined,
  work: (executor: QueryExecutor) => Promise<T>,
): Promise<T> => {
  if (options?.__executor) return work(options.__executor)
  const session = options?.session
  if (session instanceof PostgresSession && session.inTransaction()) {
    return work(await session.executor())
  }

  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

class ArrayCursor<T> {
  private result: Promise<T[]> | null = null
  private offset = 0

  constructor(private readonly resolver: () => Promise<T[]>) {}

  private resolve() {
    this.result ||= this.resolver()
    return this.result
  }

  async toArray() {
    return this.resolve()
  }

  async next() {
    const values = await this.resolve()
    return values[this.offset++] ?? null
  }

  async hasNext() {
    const values = await this.resolve()
    return this.offset < values.length
  }

  async close() {
    this.offset = 0
  }

  addCursorFlag() {
    return this
  }

  batchSize() {
    return this
  }

  [Symbol.asyncIterator]() {
    return {
      next: async () => {
        const value = await this.next()
        return value === null ? { done: true, value: undefined } : { done: false, value }
      },
    }
  }
}

const removeTextFilter = (filter: any, searches: string[]): any => {
  if (Array.isArray(filter)) return filter.map((item) => removeTextFilter(item, searches))
  if (
    !filter ||
    typeof filter !== 'object' ||
    filter instanceof RegExp ||
    filter instanceof Date ||
    isObjectId(filter)
  ) {
    return filter
  }

  const next: AnyDocument = {}
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$text') {
      const search = String((value as AnyDocument)?.$search || '').trim()
      if (search) searches.push(search)
      continue
    }
    next[key] = removeTextFilter(value, searches)
  }
  return next
}

const collectStrings = (value: any, output: string[]) => {
  if (typeof value === 'string') {
    output.push(value.toLocaleLowerCase())
    return
  }
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output))
    return
  }
  Object.values(value).forEach((item) => collectStrings(item, output))
}

const textScore = (document: AnyDocument, searches: string[]) => {
  if (!searches.length) return 0
  const strings: string[] = []
  collectStrings(document, strings)
  const haystack = strings.join(' ')
  return searches.reduce((score, search) => {
    const terms = search
      .toLocaleLowerCase()
      .split(/\s+/)
      .map((term) => term.replace(/^"|"$/g, ''))
      .filter(Boolean)
    return score + terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0)
  }, 0)
}

const stripTextMetaProjection = (projection: AnyDocument | undefined) => {
  if (!projection) return { projection: undefined, scoreFields: [] as string[] }
  const next: AnyDocument = {}
  const scoreFields: string[] = []
  for (const [key, value] of Object.entries(projection)) {
    if (value && typeof value === 'object' && (value as AnyDocument).$meta === 'textScore') {
      scoreFields.push(key)
    } else {
      next[key] = value
    }
  }
  return { projection: Object.keys(next).length ? next : undefined, scoreFields }
}

class PostgresCollection {
  readonly collectionName: string
  readonly namespace: string
  private readonly uniqueDefinitions: UniqueDefinition[]

  constructor(private readonly model: any) {
    this.collectionName = model.collection.collectionName
    this.namespace = `kourier_boyz.${this.collectionName}`
    this.uniqueDefinitions = this.readUniqueDefinitions()
  }

  private readUniqueDefinitions(): UniqueDefinition[] {
    const definitions = new Map<string, UniqueDefinition>()
    this.model.schema.eachPath((path: string, schemaType: any) => {
      if (!schemaType?.options?.unique) return
      const name = `${path}_1`
      definitions.set(name, { name, paths: [path], sparse: Boolean(schemaType.options.sparse) })
    })
    for (const [fields, options] of this.model.schema.indexes()) {
      if (!options?.unique) continue
      const name =
        options.name ||
        Object.entries(fields)
          .map(([path, direction]) => `${path}_${String(direction)}`)
          .join('_')
      definitions.set(name, {
        name,
        paths: Object.keys(fields),
        sparse: Boolean(options.sparse),
      })
    }
    return [...definitions.values()]
  }

  private hydrate(document: AnyDocument) {
    return this.model
      .hydrate(document)
      .toObject({
        depopulate: true,
        flattenMaps: true,
        getters: false,
        transform: false,
        virtuals: false,
      })
  }

  private async load(executor: QueryExecutor, filter?: AnyDocument): Promise<AnyDocument[]> {
    const conditions = ['collection = $1']
    const values: unknown[] = [this.collectionName]
    const normalizedFilter = filter ? normalizeForStorage(filter) : undefined
    const idFilter = normalizedFilter?._id

    if (typeof idFilter === 'string') {
      values.push(idFilter)
      conditions.push(`document_id = $${values.length}`)
    } else if (Array.isArray(idFilter?.$in) && idFilter.$in.length) {
      values.push(idFilter.$in.map(String))
      conditions.push(`document_id = ANY($${values.length}::text[])`)
    } else if (normalizedFilter && !normalizedFilter.$text) {
      const containment = Object.fromEntries(
        Object.entries(normalizedFilter).filter(
          ([key, value]) =>
            !key.startsWith('$') &&
            key !== '_id' &&
            this.model.schema.path(key)?.instance !== 'Array' &&
            (value === null || ['string', 'number', 'boolean'].includes(typeof value)),
        ),
      )
      if (Object.keys(containment).length) {
        values.push(JSON.stringify(containment))
        conditions.push(`document @> $${values.length}::jsonb`)
      }
    }

    const result = await executor.query(
      `SELECT document FROM ${DOCUMENTS_TABLE} WHERE ${conditions.join(' AND ')}`,
      values,
    )
    return result.rows.map((row: AnyDocument) => this.hydrate(row.document))
  }

  private async reserveUniqueKeys(executor: QueryExecutor, document: AnyDocument) {
    const documentId = String(document._id)
    await executor.query(
      `DELETE FROM ${UNIQUE_KEYS_TABLE} WHERE collection = $1 AND document_id = $2`,
      [this.collectionName, documentId],
    )

    for (const definition of this.uniqueDefinitions) {
      const values = definition.paths.map((path) => getPath(document, path))
      if (definition.sparse && values.some((value) => value === null || value === undefined)) continue
      const keyValue = values.map(stableKey).join('|')
      try {
        await executor.query(
          `INSERT INTO ${UNIQUE_KEYS_TABLE} (collection, index_name, key_value, document_id)
           VALUES ($1, $2, $3, $4)`,
          [this.collectionName, definition.name, keyValue, documentId],
        )
      } catch (error: any) {
        if (error?.code === '23505') {
          throw duplicateKeyError(this.collectionName, definition, document)
        }
        throw error
      }
    }
  }

  private async persist(
    executor: QueryExecutor,
    document: AnyDocument,
    mode: 'insert' | 'upsert',
  ) {
    const stored = normalizeForStorage(document)
    const documentId = String(stored._id)
    await this.reserveUniqueKeys(executor, document)

    if (mode === 'insert') {
      try {
        await executor.query(
          `INSERT INTO ${DOCUMENTS_TABLE} (collection, document_id, document)
           VALUES ($1, $2, $3::jsonb)`,
          [this.collectionName, documentId, JSON.stringify(stored)],
        )
      } catch (error: any) {
        if (error?.code === '23505') {
          throw duplicateKeyError(
            this.collectionName,
            { name: '_id_', paths: ['_id'], sparse: false },
            document,
          )
        }
        throw error
      }
      return
    }

    await executor.query(
      `INSERT INTO ${DOCUMENTS_TABLE} (collection, document_id, document)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (collection, document_id)
       DO UPDATE SET document = EXCLUDED.document,
                     version = ${DOCUMENTS_TABLE}.version + 1,
                     updated_at = now()`,
      [this.collectionName, documentId, JSON.stringify(stored)],
    )
  }

  private matches(documents: AnyDocument[], filter: AnyDocument = {}): AnyDocument[] {
    const searches: string[] = []
    const query = normalizeForStorage(removeTextFilter(filter, searches))
    const normalizedDocuments = documents.map((document) => normalizeForStorage(document))
    const matched = new Query(query).find(normalizedDocuments).all() as AnyDocument[]
    if (!searches.length) return matched
    return matched
      .map((document) => ({ document, score: textScore(document, searches) }))
      .filter(({ score }) => score > 0)
      .map(({ document, score }) => ({ ...document, __kbTextScore: score }) as AnyDocument)
  }

  find(filter: AnyDocument = {}, options: AnyDocument = {}) {
    return new ArrayCursor(async () => {
      const documents = this.matches(await this.load(await getExecutor(options), filter), filter)
      const { projection, scoreFields } = stripTextMetaProjection(options.projection)
      const sort = { ...(options.sort || {}) }
      for (const [field, direction] of Object.entries(sort)) {
        if (direction && typeof direction === 'object' && (direction as AnyDocument).$meta) {
          delete sort[field]
          sort.__kbTextScore = -1
        }
      }

      let cursor = runFind(documents, {}, projection)
      if (Object.keys(sort).length) cursor = cursor.sort(sort as any)
      if (options.skip) cursor = cursor.skip(Number(options.skip))
      if (options.limit) cursor = cursor.limit(Number(options.limit))
      const result = cursor.all()
      return result.map((document) => {
        for (const field of scoreFields) document[field] = document.__kbTextScore || 0
        delete document.__kbTextScore
        return document
      })
    })
  }

  async findOne(filter: AnyDocument = {}, options: AnyDocument = {}) {
    const values = await this.find(filter, { ...options, limit: 1 }).toArray()
    return values[0] || null
  }

  async insertOne(document: AnyDocument, options: AnyDocument = {}) {
    await withWriteTransaction(options, async (executor) => {
      await this.persist(executor, document, 'insert')
    })
    return { acknowledged: true, insertedId: document._id }
  }

  async insertMany(documents: AnyDocument[], options: AnyDocument = {}) {
    const insertedIds: Record<number, unknown> = {}
    await withWriteTransaction(options, async (executor) => {
      for (let index = 0; index < documents.length; index += 1) {
        await this.persist(executor, documents[index], 'insert')
        insertedIds[index] = documents[index]._id
      }
    })
    return { acknowledged: true, insertedCount: documents.length, insertedIds }
  }

  private buildUpsertDocument(filter: AnyDocument, update: AnyDocument) {
    const equalityFields: AnyDocument = {}
    for (const [key, value] of Object.entries(filter)) {
      if (!key.startsWith('$') && (value === null || typeof value !== 'object' || isObjectId(value))) {
        equalityFields[key] = value
      }
    }
    const document: AnyDocument = { ...equalityFields, ...(update.$setOnInsert || {}) }
    if (!document._id) document._id = new mongoose.Types.ObjectId()
    this.applyModifier(document, update, true)
    return this.hydrate(normalizeForStorage(document))
  }

  private applyModifier(document: AnyDocument, update: AnyDocument, inserting = false) {
    if (Array.isArray(update)) {
      const [result] = runAggregation([document], update)
      return { changed: true, document: result || document }
    }
    const operatorKeys = Object.keys(update).filter((key) => key.startsWith('$'))
    if (!operatorKeys.length) {
      return { changed: true, document: { _id: document._id, ...update } }
    }

    const modifier = { ...update }
    delete modifier.$setOnInsert
    if (inserting && update.$setOnInsert) {
      modifier.$set = { ...(update.$setOnInsert || {}), ...(modifier.$set || {}) }
    }
    const changed = applyUpdate(document, modifier as any)
    return { changed: changed.length > 0, document }
  }

  private async updateMatching(
    filter: AnyDocument,
    update: AnyDocument,
    options: AnyDocument,
    many: boolean,
  ) {
    return withWriteTransaction(options, async (executor) => {
      const documents = await this.load(executor, filter)
      const matched = this.matches(documents, filter)
      const targets = many ? matched : matched.slice(0, 1)
      let modifiedCount = 0

      for (const original of targets) {
        const { changed, document } = this.applyModifier(original, update)
        if (changed) {
          await this.persist(executor, document, 'upsert')
          modifiedCount += 1
        }
      }

      let upsertedId: unknown
      if (!targets.length && options.upsert) {
        const document = this.buildUpsertDocument(filter, update)
        await this.persist(executor, document, 'insert')
        upsertedId = document._id
      }

      return {
        acknowledged: true,
        matchedCount: targets.length,
        modifiedCount,
        upsertedCount: upsertedId ? 1 : 0,
        upsertedId,
      }
    })
  }

  updateOne(filter: AnyDocument, update: AnyDocument, options: AnyDocument = {}) {
    return this.updateMatching(filter, update, options, false)
  }

  updateMany(filter: AnyDocument, update: AnyDocument, options: AnyDocument = {}) {
    return this.updateMatching(filter, update, options, true)
  }

  replaceOne(filter: AnyDocument, replacement: AnyDocument, options: AnyDocument = {}) {
    return this.updateMatching(filter, replacement, options, false)
  }

  async findOneAndUpdate(filter: AnyDocument, update: AnyDocument, options: AnyDocument = {}) {
    return withWriteTransaction(options, async (executor) => {
      const original = this.matches(await this.load(executor, filter), filter)[0]
      if (!original && !options.upsert) return null
      const before = original ? { ...original } : null
      const next = original
        ? this.applyModifier(original, update).document
        : this.buildUpsertDocument(filter, update)
      await this.persist(executor, next, original ? 'upsert' : 'insert')
      const returnAfter = options.returnDocument === 'after' || options.returnOriginal === false
      return returnAfter ? next : before
    })
  }

  private async deleteMatching(filter: AnyDocument, options: AnyDocument, many: boolean) {
    return withWriteTransaction(options, async (executor) => {
      const matched = this.matches(await this.load(executor, filter), filter)
      const targets = many ? matched : matched.slice(0, 1)
      for (const document of targets) {
        const documentId = String(document._id)
        await executor.query(
          `DELETE FROM ${UNIQUE_KEYS_TABLE} WHERE collection = $1 AND document_id = $2`,
          [this.collectionName, documentId],
        )
        await executor.query(
          `DELETE FROM ${DOCUMENTS_TABLE} WHERE collection = $1 AND document_id = $2`,
          [this.collectionName, documentId],
        )
      }
      return { acknowledged: true, deletedCount: targets.length }
    })
  }

  deleteOne(filter: AnyDocument, options: AnyDocument = {}) {
    return this.deleteMatching(filter, options, false)
  }

  deleteMany(filter: AnyDocument, options: AnyDocument = {}) {
    return this.deleteMatching(filter, options, true)
  }

  async findOneAndDelete(filter: AnyDocument, options: AnyDocument = {}) {
    return withWriteTransaction(options, async (executor) => {
      const document = this.matches(await this.load(executor, filter), filter)[0]
      if (!document) return null
      const documentId = String(document._id)
      await executor.query(
        `DELETE FROM ${UNIQUE_KEYS_TABLE} WHERE collection = $1 AND document_id = $2`,
        [this.collectionName, documentId],
      )
      await executor.query(
        `DELETE FROM ${DOCUMENTS_TABLE} WHERE collection = $1 AND document_id = $2`,
        [this.collectionName, documentId],
      )
      return document
    })
  }

  async countDocuments(filter: AnyDocument = {}, options: AnyDocument = {}) {
    return this.matches(await this.load(await getExecutor(options), filter), filter).length
  }

  async estimatedDocumentCount(options: AnyDocument = {}) {
    const executor = await getExecutor(options)
    const result = await executor.query(
      `SELECT count(*)::integer AS count FROM ${DOCUMENTS_TABLE} WHERE collection = $1`,
      [this.collectionName],
    )
    return Number(result.rows[0]?.count || 0)
  }

  async distinct(path: string, filter: AnyDocument = {}, options: AnyDocument = {}) {
    const documents = this.matches(await this.load(await getExecutor(options), filter), filter)
    const values = documents.flatMap((document) => {
      const value = getPath(document, path)
      return Array.isArray(value) ? value : [value]
    })
    const unique = new Map<string, unknown>()
    for (const value of values) {
      if (value !== undefined) unique.set(stableKey(value), value)
    }
    return [...unique.values()]
  }

  aggregate(pipeline: AnyDocument[] = [], options: AnyDocument = {}) {
    return new ArrayCursor(async () => {
      const executor = await getExecutor(options)
      const collections = new Map<string, AnyDocument[]>()
      collections.set(this.collectionName, await this.load(executor))

      const referenced = new Set<string>()
      const inspect = (value: any) => {
        if (Array.isArray(value)) return value.forEach(inspect)
        if (!value || typeof value !== 'object') return
        if (value.$lookup?.from) referenced.add(String(value.$lookup.from))
        if (typeof value.$unionWith === 'string') referenced.add(value.$unionWith)
        if (value.$unionWith?.coll) referenced.add(String(value.$unionWith.coll))
        Object.values(value).forEach(inspect)
      }
      inspect(pipeline)

      for (const collectionName of referenced) {
        const adapter = collectionAdapters.get(collectionName)
        if (adapter) collections.set(collectionName, await adapter.load(executor))
      }

      return runAggregation(collections.get(this.collectionName) || [], pipeline, {
        collectionResolver: (name: string) => collections.get(name) || [],
      }).map((document) => normalizeForStorage(document))
    })
  }

  async bulkWrite(operations: AnyDocument[], options: AnyDocument = {}) {
    return withWriteTransaction(options, async (executor) => {
      const sessionOptions = { ...options, __executor: executor }
      let insertedCount = 0
      let matchedCount = 0
      let modifiedCount = 0
      let deletedCount = 0
      let upsertedCount = 0
      const insertedIds: AnyDocument = {}
      const upsertedIds: AnyDocument = {}

      for (let index = 0; index < operations.length; index += 1) {
        const operation = operations[index]
        if (operation.insertOne) {
          await this.persist(executor, operation.insertOne.document, 'insert')
          insertedIds[index] = operation.insertOne.document._id
          insertedCount += 1
        } else if (operation.updateOne || operation.updateMany) {
          const details = operation.updateOne || operation.updateMany
          const result = await this.updateMatching(
            details.filter,
            details.update,
            sessionOptions,
            Boolean(operation.updateMany),
          )
          matchedCount += result.matchedCount
          modifiedCount += result.modifiedCount
          if (result.upsertedId) {
            upsertedIds[index] = result.upsertedId
            upsertedCount += 1
          }
        } else if (operation.deleteOne || operation.deleteMany) {
          const details = operation.deleteOne || operation.deleteMany
          const result = await this.deleteMatching(
            details.filter,
            sessionOptions,
            Boolean(operation.deleteMany),
          )
          deletedCount += result.deletedCount
        } else if (operation.replaceOne) {
          const result = await this.updateMatching(
            operation.replaceOne.filter,
            operation.replaceOne.replacement,
            sessionOptions,
            false,
          )
          matchedCount += result.matchedCount
          modifiedCount += result.modifiedCount
        }
      }

      return {
        acknowledged: true,
        insertedCount,
        matchedCount,
        modifiedCount,
        deletedCount,
        upsertedCount,
        insertedIds,
        upsertedIds,
      }
    })
  }

  createIndex(fields: AnyDocument, options: AnyDocument = {}) {
    return Promise.resolve(
      options.name ||
        Object.entries(fields)
          .map(([path, direction]) => `${path}_${String(direction)}`)
          .join('_'),
    )
  }

  async createIndexes(indexes: AnyDocument[]) {
    return Promise.all(
      indexes.map((index) => this.createIndex(index.key || index, index.options || index)),
    )
  }

  listIndexes() {
    const indexes = [
      { name: '_id_', key: { _id: 1 }, unique: true },
      ...this.model.schema.indexes().map(([key, options]: [AnyDocument, AnyDocument]) => ({
        name:
          options.name ||
          Object.entries(key)
            .map(([path, direction]) => `${path}_${String(direction)}`)
            .join('_'),
        key,
        ...options,
      })),
    ]
    return new ArrayCursor(async () => indexes)
  }

  async indexes() {
    return this.listIndexes().toArray()
  }

  async indexInformation() {
    return Object.fromEntries(
      (await this.indexes()).map((index: AnyDocument) => [index.name, Object.entries(index.key)]),
    )
  }

  dropIndex() {
    return Promise.resolve({ ok: 1 })
  }

  dropIndexes() {
    return Promise.resolve({ ok: 1 })
  }

  options() {
    return Promise.resolve({})
  }
}

const attachModel = (model: any) => {
  const adapter = new PostgresCollection(model)
  collectionAdapters.set(adapter.collectionName, adapter)
  model.collection.collection = adapter
  model.collection.buffer = false
  model.collection.queue = []
}

const attachRegisteredModels = () => {
  Object.values(mongoose.models).forEach(attachModel)
}

const patchModelRegistration = () => {
  if (modelMethodPatched) return
  modelMethodPatched = true
  const originalModel = mongoose.model.bind(mongoose) as (...args: any[]) => any
  ;(mongoose as any).model = (...args: any[]) => {
    const model = originalModel(...args)
    if (connected) attachModel(model)
    return model
  }
}

const connect = async () => {
  await ensureStorage()
  connected = true
  ;(mongoose.connection as any).readyState = 1
  attachRegisteredModels()
  return mongoose
}

const disconnect = async () => {
  connected = false
  ;(mongoose.connection as any).readyState = 0
  if (pool) await pool.end()
  pool = null
}

patchModelRegistration()
;(mongoose as any).connect = connect
;(mongoose as any).disconnect = disconnect
;(mongoose as any).startSession = async () => new PostgresSession()
;(mongoose.connection as any).startSession = async () => new PostgresSession()

export const connectMarketplacePostgres = connect
export const disconnectMarketplacePostgres = disconnect
export { PostgresSession }
