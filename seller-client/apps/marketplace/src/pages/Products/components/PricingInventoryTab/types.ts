import type { UploadFile } from 'antd'
import type { PickupAddress } from '../../../../api/store'

export interface WarehouseInventoryItem {
  warehouseId: string
  warehouseName: string
  quantity: number
  lowStockThreshold?: number
}

export interface PickupAddressWithId extends PickupAddress {
  _id?: string
  kourierBoyzLogisticsPickupAddressId?: string
}

export type VariantType = {
  id: string
  name: string
  sku: string
  attributes: Record<string, string>
  price?: number
  costPrice?: number
  comparePrice?: number
  discountPercent?: number
  stock?: number
  lowStockThreshold?: number
  warehouseInventory?: Array<{
    warehouseId: string
    warehouseName: string
    quantity: number
    lowStockThreshold?: number
  }>
  mainImage: UploadFile | string | null
  images: Array<UploadFile | string>
  isDefault: boolean
  status: string
  // GST/HSN fields
  hsnSacCode?: string
  cgstRatePercent?: number
  sgstRatePercent?: number
  igstRatePercent?: number
}

export interface PricingInventoryTabProps {
  form: import('antd').FormInstance
  variants: Array<VariantType>
  onVariantsChange: (variants: Array<VariantType>) => void
}
