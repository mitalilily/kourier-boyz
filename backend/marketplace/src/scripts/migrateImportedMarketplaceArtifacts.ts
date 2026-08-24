import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Order from '../models/Order'
import { Shipment } from '../models/Shipment'
import User from '../models/User'

dotenv.config()

const importedShipmentKey = ['courier', 'Cart'].join('')
const importedPickupKey = `${importedShipmentKey}PickupAddressId`
const logisticsKey = 'kourierBoyzLogistics'
const logisticsPickupKey = 'kourierBoyzLogisticsPickupAddressId'

const readField = (input: unknown, field: string) => ({
  $getField: { input, field },
})

const renameObjectKey = (
  input: unknown,
  oldKey: string,
  newKey: string,
  value: unknown = readField(input, oldKey),
) => ({
  $arrayToObject: {
    $concatArrays: [
      {
        $filter: {
          input: { $objectToArray: input },
          as: 'field',
          cond: { $ne: ['$$field.k', oldKey] },
        },
      },
      [{ k: newKey, v: value }],
    ],
  },
})

const migrate = async () => {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  await mongoose.connect(databaseUrl)

  const importedLogisticsValue = readField('$$shipment', importedShipmentKey)
  const normalizedLogisticsValue = renameObjectKey(
    importedLogisticsValue,
    importedPickupKey,
    logisticsPickupKey,
  )

  const orders = await Order.collection.updateMany(
    { [`sellerShipments.${importedShipmentKey}`]: { $exists: true } },
    [
      {
        $set: {
          sellerShipments: {
            $map: {
              input: '$sellerShipments',
              as: 'shipment',
              in: {
                $cond: [
                  { $eq: [{ $type: importedLogisticsValue }, 'missing'] },
                  '$$shipment',
                  renameObjectKey(
                    '$$shipment',
                    importedShipmentKey,
                    logisticsKey,
                    normalizedLogisticsValue,
                  ),
                ],
              },
            },
          },
        },
      },
    ] as any,
  )

  const shipmentValue = readField('$$ROOT', importedShipmentKey)
  const shipments = await Shipment.collection.updateMany(
    { [importedShipmentKey]: { $exists: true } },
    [
      {
        $set: {
          [logisticsKey]: renameObjectKey(
            shipmentValue,
            importedPickupKey,
            logisticsPickupKey,
          ),
        },
      },
      { $unset: importedShipmentKey },
    ] as any,
  )

  const rootUsers = await User.collection.updateMany(
    { [importedPickupKey]: { $exists: true } },
    [
      { $set: { [logisticsPickupKey]: `$${importedPickupKey}` } },
      { $unset: importedPickupKey },
    ] as any,
  )

  const nestedUsers = await User.collection.updateMany(
    { [`pickupAddresses.${importedPickupKey}`]: { $exists: true } },
    [
      {
        $set: {
          pickupAddresses: {
            $map: {
              input: '$pickupAddresses',
              as: 'address',
              in: renameObjectKey(
                '$$address',
                importedPickupKey,
                logisticsPickupKey,
              ),
            },
          },
        },
      },
    ] as any,
  )

  console.log('Kourier Boyz marketplace artifact migration complete', {
    orders: orders.modifiedCount,
    shipments: shipments.modifiedCount,
    rootUsers: rootUsers.modifiedCount,
    nestedUsers: nestedUsers.modifiedCount,
  })
}

migrate()
  .catch((error) => {
    console.error('Marketplace artifact migration failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
import '../database/postgresMongoose'
