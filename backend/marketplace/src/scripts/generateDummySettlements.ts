import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Order from '../models/Order'
import '../models/Product'
import SellerSettlementSettings from '../models/SellerSettlementSettings'
import User from '../models/User'
import GlobalSettlementSettings from '../models/GlobalSettlementSettings'
import {
  generateSettlementBatchesForAllSellers,
  calculateSettlementForOrder,
  type SettlementConfig,
} from '../services/settlement.service'

dotenv.config()

/**
 * Utility script to quickly generate dummy settlement settings and batches
 * for existing seller orders so you can test the full settlement + UI flow.
 *
 * Run from backend directory:
 *   npx ts-node src/scripts/generateDummySettlements.ts
 */
async function generateDummySettlements() {
  try {
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI not defined in .env')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB')

    // 1) Seed basic settlement settings for all approved sellers that don't have any yet
    const sellers = await User.find({ role: 'seller', isApproved: true }).select(
      '_id name businessName',
    )
    console.log(`Found ${sellers.length} approved sellers`)

    let createdSettings = 0
    for (const seller of sellers) {
      const existing = await SellerSettlementSettings.findOne({ seller: seller._id })
      if (existing) continue

      await SellerSettlementSettings.create({
        seller: seller._id,
        settlementCycle: 'WEEKLY',
        customCycleDays: null,
        returnWindowDays: 7,
        commissionType: 'PERCENTAGE',
        commissionValue: 10, // 10% dummy commission
        minBatchAmount: 0,
      })
      createdSettings += 1
    }
    console.log(`🛠  Seeded settlement settings for ${createdSettings} seller(s) (if any)`)

    // 2) Force-mark delivered orders as ELIGIBLE and compute settlement amounts (ignoring return window)
    console.log('🔍 Forcing delivered orders to ELIGIBLE for dummy settlements...')

    const global = await GlobalSettlementSettings.findOne().lean()
    if (!global) {
      console.warn(
        'GlobalSettlementSettings not found. Please open Admin → Settings → Settlement Settings once to initialize.',
      )
    }

    const sellerSettingsDocs = await SellerSettlementSettings.find({}).lean()
    const sellerSettingsBySeller = new Map<string, any>()
    sellerSettingsDocs.forEach((doc) => {
      sellerSettingsBySeller.set(String(doc.seller), doc)
    })

    const deliveredOrders = await Order.find({ status: 'delivered' })
      .populate('items.product', 'returnable returnDays')
      .exec()

    let touchedOrders = 0
    for (const order of deliveredOrders) {
      if (!order.sellerShipments || order.sellerShipments.length === 0) continue
      const firstShipmentSeller = order.sellerShipments[0].seller
      if (!firstShipmentSeller) continue

      if (!global) continue

      const sellerIdStr = String(firstShipmentSeller)
      const sellerSettings = sellerSettingsBySeller.get(sellerIdStr)

      const allowOverride = global.allowSellerOverride
      const effective: SettlementConfig =
        allowOverride && sellerSettings?.isActiveOverride
          ? {
              settlementCycle: sellerSettings.settlementCycle,
              customCycleDays: sellerSettings.customCycleDays ?? null,
              returnWindowDays: sellerSettings.returnWindowDays,
              commissionType: sellerSettings.commissionType,
              commissionValue: sellerSettings.commissionValue,
              minBatchAmount: sellerSettings.minBatchAmount ?? null,
            }
          : {
              settlementCycle: global.settlementCycle,
              customCycleDays: global.customCycleDays ?? null,
              returnWindowDays: global.returnWindowDays,
              commissionType: global.commissionType,
              commissionValue: global.commissionValue,
              minBatchAmount: global.minBatchAmount ?? null,
            }

      // Compute settlement amounts ignoring actual return window timing
      const { saleAmount, commissionAmount, netAmount } = await calculateSettlementForOrder(
        order,
        effective,
      )
      ;(order as any).sellerSaleAmount = saleAmount
      ;(order as any).sellerCommissionAmount = commissionAmount
      ;(order as any).sellerNetAmount = netAmount
      ;(order as any).settlementStatus = 'ELIGIBLE'
      ;(order as any).settlementEligibleAt = new Date()
      await order.save()
      touchedOrders += 1
    }

    console.log(`   → Marked ${touchedOrders} delivered order(s) as ELIGIBLE for settlements`)

    // 3) Generate settlement batches using the normal batch generation logic
    console.log('📦 Generating settlement batches for all sellers...')
    const batchResult = await generateSettlementBatchesForAllSellers()
    console.log(
      `   → Created ${batchResult.createdBatches.length} batch(es): ${
        batchResult.createdBatches.map((b) => String(b._id)).join(', ') || 'none'
      }`,
    )

    console.log('\n🎉 Dummy settlement generation completed.\n')
    console.log('You can now:')
    console.log('  - Open Admin → Settlements to view generated batches')
    console.log('  - Open Seller → Settlements and Orders → Order Detail to verify settlement info')
    process.exit(0)
  } catch (err) {
    console.error('❌ Error generating dummy settlements:', err)
    process.exit(1)
  }
}

generateDummySettlements()
