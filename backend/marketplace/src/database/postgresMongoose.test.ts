import assert from 'node:assert/strict'
import mongoose, { Schema } from 'mongoose'
import { newDb } from 'pg-mem'
import {
  connectMarketplacePostgres,
  disconnectMarketplacePostgres,
  setMarketplacePostgresPoolForTests,
} from './postgresMongoose'

const run = async () => {
  const memoryDatabase = newDb()
  const adapter = memoryDatabase.adapters.createPg()
  const nativePool = new adapter.Pool()
  const pool = {
    query: (...args: any[]) => (nativePool.query as any)(...args),
    end: () => nativePool.end(),
    connect: async () => {
      const client = await nativePool.connect()
      let snapshot: ReturnType<typeof memoryDatabase.backup> | null = null
      return {
        query: async (...args: any[]) => {
          const statement = String(args[0]).trim().toUpperCase()
          if (statement === 'BEGIN') {
            snapshot = memoryDatabase.backup()
            return { rows: [], rowCount: 0 }
          }
          if (statement === 'ROLLBACK') {
            snapshot?.restore()
            snapshot = null
            return { rows: [], rowCount: 0 }
          }
          if (statement === 'COMMIT') {
            snapshot = null
            return { rows: [], rowCount: 0 }
          }
          return (client.query as any)(...args)
        },
        release: () => client.release(),
      }
    },
  }
  setMarketplacePostgresPoolForTests(pool as any)

  const sellerSchema = new Schema(
    {
      email: { type: String, required: true, lowercase: true, unique: true },
      name: { type: String, required: true },
    },
    { timestamps: true },
  )
  sellerSchema.pre('save', function prepareName(next) {
    this.name = this.name.trim()
    next()
  })

  const productSchema = new Schema(
    {
      seller: { type: Schema.Types.ObjectId, ref: 'PostgresAdapterSeller', required: true },
      name: { type: String, required: true },
      stock: { type: Number, default: 0 },
      tags: [{ type: String }],
    },
    { timestamps: true },
  )

  const Seller = mongoose.model('PostgresAdapterSeller', sellerSchema)
  const Product = mongoose.model('PostgresAdapterProduct', productSchema)

  await connectMarketplacePostgres()

  const seller = await Seller.create({ email: 'OWNER@EXAMPLE.COM', name: '  Store Owner  ' })
  assert.equal(seller.email, 'owner@example.com')
  assert.equal(seller.name, 'Store Owner')

  await assert.rejects(
    () => Seller.create({ email: 'owner@example.com', name: 'Duplicate' }),
    (error: any) => error?.code === 11000,
  )

  const product = await Product.create({
    seller: seller._id,
    name: 'Travel Backpack',
    stock: 4,
    tags: ['travel', 'bags'],
  })
  await Product.updateOne({ _id: product._id }, { $inc: { stock: 3 } })

  const populated = await Product.findById(product._id).populate('seller').lean()
  assert.equal(populated?.stock, 7)
  assert.equal((populated?.seller as any)?.email, 'owner@example.com')

  const aggregate = await Product.aggregate([
    { $match: { tags: 'travel' } },
    { $group: { _id: '$seller', units: { $sum: '$stock' } } },
  ])
  assert.equal(aggregate[0]?.units, 7)

  const committedSession = await mongoose.startSession()
  committedSession.startTransaction()
  await Product.updateOne(
    { _id: product._id },
    { $inc: { stock: 1 } },
    { session: committedSession },
  )
  await committedSession.commitTransaction()
  committedSession.endSession()
  assert.equal((await Product.findById(product._id).lean())?.stock, 8)

  const abortedSession = await mongoose.startSession()
  abortedSession.startTransaction()
  await Product.updateOne(
    { _id: product._id },
    { $inc: { stock: 100 } },
    { session: abortedSession },
  )
  await abortedSession.abortTransaction()
  abortedSession.endSession()
  assert.equal((await Product.findById(product._id).lean())?.stock, 8)

  await Product.bulkWrite([
    { updateOne: { filter: { _id: product._id }, update: { $set: { name: 'Cabin Backpack' } } } },
    {
      insertOne: {
        document: { seller: seller._id, name: 'Packing Cubes', stock: 12, tags: ['travel'] },
      },
    },
  ])
  assert.equal(await Product.countDocuments({ tags: 'travel' }), 2)
  assert.equal((await Product.findById(product._id).lean())?.name, 'Cabin Backpack')

  const updated = await Product.findByIdAndUpdate(
    product._id,
    { $set: { name: 'Carry-on Backpack' } },
    { new: true },
  ).lean()
  assert.equal(updated?.name, 'Carry-on Backpack')

  const sorted = await Product.find({ tags: 'travel' })
    .sort({ stock: -1 })
    .limit(1)
    .select({ name: 1, stock: 1 })
    .lean()
  assert.equal(sorted[0]?.name, 'Packing Cubes')
  assert.equal(sorted[0]?.stock, 12)

  await Product.findByIdAndDelete(product._id)
  assert.equal(await Product.countDocuments({ tags: 'travel' }), 1)

  await disconnectMarketplacePostgres()
  console.log('Marketplace PostgreSQL compatibility checks passed')
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
