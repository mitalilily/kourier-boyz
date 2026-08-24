import mongoose, { Document, Schema } from 'mongoose'
import type { IShipmentDimensions, IPickupAddressSnapshot, ISellerShippingMeta } from './Order'

export interface IShipment extends Document {
  _id: mongoose.Types.ObjectId
  seller: mongoose.Types.ObjectId
  status: 'pending' | 'processing' | 'ready_to_ship' | 'pickup_requested' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'cancelled'
  
  // Physical shipment details
  package?: {
    weight: number
    dimensions: IShipmentDimensions
  }
  
  // Courier integration
  kourierBoyzLogistics?: {
    courier_id: number
    order_id: string
    rate: number
    awb_number: string
    label_url?: string
    tracking_link?: string
    estimated_delivery_date?: string
  }
  
  // Shipping metadata
  shippingMeta?: ISellerShippingMeta
  
  // Manifest
  manifest?: {
    manifest_id: string
    manifest_url: string
    manifest_key: string
  }
  
  // Label
  label?: {
    label_id: string
    label_url: string
    generated_at: Date
  }
  
  // Orders and items in this shipment
  orderIds: mongoose.Types.ObjectId[]
  itemIds: mongoose.Types.ObjectId[]
  
  // Pickup address
  pickupAddress?: IPickupAddressSnapshot
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  shippedAt?: Date
  deliveredAt?: Date
  cancelledAt?: Date
}

const ShipmentSchema = new Schema<IShipment>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'ready_to_ship',
        'pickup_requested',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
      ],
      default: 'pending',
      index: true,
    },
    package: {
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
    },
    kourierBoyzLogistics: {
      courier_id: Number,
      order_id: String,
      rate: Number,
      awb_number: String,
      label_url: String,
      tracking_link: String,
      estimated_delivery_date: String,
    },
    shippingMeta: {
      awb: String,
      courier: String,
      label: String,
      tracking_link: String,
      weight: Number,
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
      },
      pickup_address: {
        warehouseName: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        contactName: String,
        contactPhone: String,
      },
      charges: Number,
      estimated_delivery_date: String,
    },
    manifest: {
      manifest_id: String,
      manifest_url: String,
      manifest_key: String,
    },
    label: {
      label_id: String,
      label_url: String,
      generated_at: Date,
    },
    orderIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        index: true,
      },
    ],
    itemIds: [
      {
        type: Schema.Types.ObjectId,
        index: true,
      },
    ],
    pickupAddress: {
      warehouseName: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
      contactName: String,
      contactPhone: String,
    },
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true },
)

// Indexes
ShipmentSchema.index({ seller: 1, status: 1, createdAt: -1 })
ShipmentSchema.index({ 'kourierBoyzLogistics.order_id': 1 })
ShipmentSchema.index({ 'kourierBoyzLogistics.awb_number': 1 })
ShipmentSchema.index({ orderIds: 1 })

export const Shipment = mongoose.model<IShipment>('Shipment', ShipmentSchema)
