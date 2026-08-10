import { PlusOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import { Alert, Button, Card, Form } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProfile } from '../../../../api/profileQueries'
import type { PickupAddress } from '../../../../api/storeQueries'
import BulkInventoryModal from './BulkInventoryModal'
import BulkPricingModal from './BulkPricingModal'
import DistributeStockModal from './DistributeStockModal'
import SimpleProductInventory from './SimpleProductInventory'
import SimpleProductPricing from './SimpleProductPricing'
import type { PickupAddressWithId, VariantType, WarehouseInventoryItem } from './types'
import { calculateDiscountPercent } from './utils'
import VariantInventoryTable from './VariantInventoryTable'
import VariantPricingTable from './VariantPricingTable'

interface PricingInventoryTabProps {
  form: FormInstance
  variants: Array<VariantType>
  onVariantsChange: (variants: Array<VariantType>) => void
}

const PricingInventoryTab = ({ form, variants, onVariantsChange }: PricingInventoryTabProps) => {
  console.log('form', form.getFieldsValue())
  const hasVariants = form.getFieldValue('hasVariants') || false
  const { data: profile } = useProfile()
  console.log('variants in pricing tab', variants)
  // Treat seller as GST-registered if they have a GST number
  const isGstRegistered = Boolean((profile as unknown as { gstNumber?: string })?.gstNumber)

  const pickupAddresses: PickupAddressWithId[] = (
    (profile?.pickupAddresses as PickupAddress[]) || []
  ).map((addr) => ({
    ...addr,
    _id: (addr as PickupAddressWithId)._id,
    courierCartPickupAddressId: (addr as PickupAddressWithId).courierCartPickupAddressId,
  }))

  // Pricing state
  const [price, setPrice] = useState(form.getFieldValue('price') || 0)
  const [costPrice, setCostPrice] = useState(form.getFieldValue('costPrice') || 0)
  const [discountPercent, setDiscountPercent] = useState(form.getFieldValue('discountPercent') || 0)
  const [isBulkModalVisible, setIsBulkModalVisible] = useState(false)
  const [isBulkInventoryModalVisible, setIsBulkInventoryModalVisible] = useState(false)
  const [distributeStockModalVisible, setDistributeStockModalVisible] = useState(false)
  const [selectedVariantForStock, setSelectedVariantForStock] = useState<VariantType | null>(null)

  // Inventory state
  const warehouseInventoryValue = Form.useWatch('warehouseInventory', form)
  const warehouseInventory: WarehouseInventoryItem[] = useMemo(
    () => (Array.isArray(warehouseInventoryValue) ? warehouseInventoryValue : []),
    [warehouseInventoryValue],
  )
  const [selectedWarehouseValue, setSelectedWarehouseValue] = useState<string | null>(null)

  const comparePrice = form.getFieldValue('comparePrice') || 0

  // Watch for form changes to update local state
  useEffect(() => {
    const currentPrice = form.getFieldValue('price') || 0
    const currentCostPrice = form.getFieldValue('costPrice') || 0
    const currentDiscountPercent = form.getFieldValue('discountPercent') || 0

    setPrice(currentPrice)
    setCostPrice(currentCostPrice)
    setDiscountPercent(currentDiscountPercent)
  }, [form])

  // Note: Inheritance logic removed - variants must have their own GST/HSN values

  // Helper function to auto-calculate discount from price and comparePrice
  const calculateDiscount = useCallback(
    (priceOverride?: number, comparePriceOverride?: number) => {
      const currentPrice =
        priceOverride !== undefined ? priceOverride : form.getFieldValue('price') || 0
      const currentComparePrice =
        comparePriceOverride !== undefined
          ? comparePriceOverride
          : form.getFieldValue('comparePrice') || 0

      // Only auto-calculate discount if comparePrice is provided
      if (currentComparePrice > 0 && currentPrice > 0 && currentComparePrice > currentPrice) {
        const calculatedDiscount = calculateDiscountPercent(currentPrice, currentComparePrice)
        form.setFieldsValue({ discountPercent: calculatedDiscount })
        setDiscountPercent(calculatedDiscount)
      } else if (currentComparePrice === 0) {
        form.setFieldsValue({ discountPercent: 0 })
        setDiscountPercent(0)
      } else if (currentComparePrice > 0 && currentComparePrice <= currentPrice) {
        form.setFieldsValue({ discountPercent: 0 })
        setDiscountPercent(0)
      }
    },
    [form],
  )

  // Bulk update all variants pricing
  const handleBulkPricingUpdate = (values: {
    price?: number | string
    costPrice?: number | string
    discountPercent?: number | string
  }) => {
    const updatedVariants = variants.map((variant) => ({
      ...variant,
      price:
        values.price !== undefined && values.price !== null && values.price !== ''
          ? Number(values.price)
          : variant.price,
      costPrice:
        values.costPrice !== undefined && values.costPrice !== null && values.costPrice !== ''
          ? Number(values.costPrice)
          : variant.costPrice,
      discountPercent:
        values.discountPercent !== undefined &&
        values.discountPercent !== null &&
        values.discountPercent !== ''
          ? Number(values.discountPercent)
          : variant.discountPercent,
    }))
    onVariantsChange(updatedVariants)
    setIsBulkModalVisible(false)
  }

  // Bulk update variants inventory (with warehouse distribution)
  const handleBulkInventoryUpdate = (
    warehouseInventory: WarehouseInventoryItem[],
    targetVariantIds: string[],
  ) => {
    // Calculate total stock from warehouse inventory
    const totalStock = warehouseInventory.reduce((sum, wi) => sum + (wi.quantity || 0), 0)

    const updatedVariants = variants.map((variant) => {
      // Only update variants in the target list
      if (!targetVariantIds.includes(variant.id)) return variant

      return {
        ...variant,
        warehouseInventory: [...warehouseInventory], // Copy warehouse inventory to each variant
        stock: totalStock,
      }
    })
    onVariantsChange(updatedVariants)
    setIsBulkInventoryModalVisible(false)
  }

  // Ensure warehouseInventory is always an array in form and sync total stock
  useEffect(() => {
    // Ensure warehouseInventory is always an array in form
    const currentWarehouseInventory = form.getFieldValue('warehouseInventory')
    if (!Array.isArray(currentWarehouseInventory)) {
      form.setFieldsValue({ warehouseInventory: [] })
      return
    }
    
    // Sync total stock with warehouse inventory when warehouses are configured
    if (pickupAddresses.length > 0 && Array.isArray(warehouseInventory)) {
      const totalStock = warehouseInventory.reduce((sum, wi) => sum + (wi.quantity || 0), 0)
      form.setFieldsValue({ stock: totalStock })
    }
  }, [warehouseInventory, pickupAddresses.length, form])
  return (
    <>
      {/* Pricing Section */}
      <Card
        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>Pricing</span>}
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        {hasVariants ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Alert
                message="Variant Pricing Management"
                description="Set individual MRP, cost prices, and discounts for each variant. Use the button on the right to apply the same MRP, cost price, and discount to all variants at once."
                type="info"
                showIcon
                style={{ flex: 1, marginRight: 12 }}
              />
              {variants.length > 0 && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setIsBulkModalVisible(true)}
                  style={{ flexShrink: 0 }}
                  size="small"
                >
                  Set for All
                </Button>
              )}
            </div>

            <VariantPricingTable
              form={form}
              variants={variants}
              onVariantsChange={onVariantsChange}
              isGstRegistered={!!isGstRegistered}
            />
          </div>
        ) : (
          <SimpleProductPricing
            form={form}
            price={price}
            costPrice={costPrice}
            discountPercent={discountPercent}
            comparePrice={comparePrice}
            onPriceChange={(value) => {
              setPrice(value)
              calculateDiscount(value)
            }}
            onCostPriceChange={setCostPrice}
            onDiscountPercentChange={setDiscountPercent}
            onComparePriceChange={(value) => {
              calculateDiscount(undefined, value)
            }}
          />
        )}
      </Card>

      {/* Inventory Section */}
      <Card
        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>Inventory</span>}
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        {hasVariants && variants.length > 0 ? (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Alert
                message="Variant Inventory Management"
                description="Manage stock and low stock thresholds for each variant. Use 'Set for All' to apply values in bulk."
                type="info"
                showIcon
                style={{ flex: 1, marginRight: 12, fontSize: '11px' }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setIsBulkInventoryModalVisible(true)}
                style={{ flexShrink: 0 }}
                size="small"
              >
                Set for All
              </Button>
            </div>

            <VariantInventoryTable
              variants={variants}
              pickupAddresses={pickupAddresses}
              onVariantsChange={onVariantsChange}
              onDistributeStock={(variant) => {
                setSelectedVariantForStock(variant)
                setDistributeStockModalVisible(true)
              }}
            />
          </div>
        ) : hasVariants ? (
          <Alert
            message="No variants yet"
            description="Generate variants in the Variants tab to manage inventory here."
            type="warning"
            showIcon
            style={{ fontSize: '11px' }}
          />
        ) : (
          <SimpleProductInventory
            form={form}
            warehouseInventory={warehouseInventory}
            pickupAddresses={pickupAddresses}
            selectedWarehouseValue={selectedWarehouseValue}
            onSelectedWarehouseValueChange={setSelectedWarehouseValue}
          />
        )}
      </Card>

      {/* Bulk Pricing Modal */}
      <BulkPricingModal
        open={isBulkModalVisible}
        variants={variants}
        onOk={handleBulkPricingUpdate}
        onCancel={() => setIsBulkModalVisible(false)}
      />

      {/* Bulk Inventory Modal */}
      <BulkInventoryModal
        open={isBulkInventoryModalVisible}
        variants={variants}
        pickupAddresses={pickupAddresses}
        onOk={handleBulkInventoryUpdate}
        onCancel={() => setIsBulkInventoryModalVisible(false)}
      />

      {/* Distribute Stock Modal */}
      <DistributeStockModal
        open={distributeStockModalVisible}
        variant={selectedVariantForStock}
        variants={variants}
        pickupAddresses={pickupAddresses}
        onVariantsChange={onVariantsChange}
        onClose={() => {
          setDistributeStockModalVisible(false)
          setSelectedVariantForStock(null)
        }}
      />
    </>
  )
}

export default PricingInventoryTab
