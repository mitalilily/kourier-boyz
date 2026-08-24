import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export type MarketplaceDocumentPayload = Record<string, unknown>

/**
 * PostgreSQL persistence boundary for the marketplace module.
 *
 * Marketplace documents stay grouped by their existing Mongoose collection
 * names so the current API contracts, hooks, seeds, and migration scripts can
 * move to PostgreSQL without changing their externally visible identifiers.
 */
export const kourierBoyzMarketplaceDocuments = pgTable(
  'kourier_boyz_marketplace_documents',
  {
    collection: varchar('collection', { length: 160 }).notNull(),
    documentId: varchar('document_id', { length: 64 }).notNull(),
    document: jsonb('document').$type<MarketplaceDocumentPayload>().notNull(),
    version: integer('version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collection, table.documentId] }),
    collectionLookup: index('kb_marketplace_documents_collection_idx').on(table.collection),
    payloadLookup: index('kb_marketplace_documents_payload_gin_idx').using('gin', table.document),
  }),
)

export const kourierBoyzMarketplaceUniqueKeys = pgTable(
  'kourier_boyz_marketplace_unique_keys',
  {
    collection: varchar('collection', { length: 160 }).notNull(),
    indexName: varchar('index_name', { length: 220 }).notNull(),
    keyValue: text('key_value').notNull(),
    documentId: varchar('document_id', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.collection, table.indexName, table.keyValue] }),
    documentLookup: index('kb_marketplace_unique_keys_document_idx').on(
      table.collection,
      table.documentId,
    ),
  }),
)
