import { DeleteOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, InputNumber, Row, Select } from 'antd'
import type { VariantType, PickupAddressWithId } from './types'
import { getWarehouseId, findPickupAddressById } from './utils'

interface WarehouseInventoryContentProps {
  variant: VariantType
  variants: Array<VariantType>
  pickupAddresses: PickupAddressWithId[]
  onVariantsChange: (variants: Array<VariantType>) => void
}

export default function WarehouseInventoryContent({
  variant,
  variants,
  pickupAddresses,
  onVariantsChange,
}: WarehouseInventoryContentProps) {
  const currentVariant = variants.find((v) => v.id === variant.id) || variant
  const variantWarehouseInventory = currentVariant.warehouseInventory || []

  const updateVariantWarehouseInventory = (
    warehouseIndex: number,
    field: 'quantity' | 'lowStockThreshold',
    value: string | number | null | undefined,
  ) => {
    // Get the current variant data fresh from the variants array to avoid stale closures
    const freshCurrentVariant = variants.find((v) => v.id === variant.id) || variant
    const freshWarehouseInventory = freshCurrentVariant.warehouseInventory || []
    const updated = [...freshWarehouseInventory]

    if (warehouseIndex < 0 || warehouseIndex >= updated.length) {
      console.error('Invalid warehouse index:', warehouseIndex, 'for variant:', variant.id)
      return
    }

    const processedValue = value === null || value === undefined ? 0 : value

    updated[warehouseIndex] = {
      ...updated[warehouseIndex],
      [field]: processedValue,
    }

    const totalStock = updated.reduce(
      (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
      0,
    )

    const updatedVariants = variants.map((v) => {
      if (v.id === variant.id) {
        return { ...v, warehouseInventory: updated, stock: totalStock }
      }
      return v
    })
    onVariantsChange(updatedVariants)
  }

  const removeWarehouse = (entryIdx: number) => {
    // Get the current variant data fresh from the variants array to avoid stale closures
    const freshCurrentVariant = variants.find((v) => v.id === variant.id) || variant
    const freshWarehouseInventory = freshCurrentVariant.warehouseInventory || []
    const updated = freshWarehouseInventory.filter((_: unknown, i: number) => i !== entryIdx)
    const totalStock = updated.reduce(
      (sum: number, wi: { quantity?: number }) => sum + (Number(wi.quantity) || 0),
      0,
    )

    const updatedVariants = variants.map((v) => {
      if (v.id === variant.id) {
        return { ...v, warehouseInventory: updated, stock: totalStock }
      }
      return v
    })
    onVariantsChange(updatedVariants)
  }

  const addWarehouse = (warehouseId: string) => {
    const selectedWarehouse = findPickupAddressById(
      warehouseId,
      pickupAddresses as Array<{
        _id?: string
        courierCartPickupAddressId?: string
        warehouseName?: string
        postalCode?: string
        addressLine1?: string
        city?: string
        state?: string
      }>,
      getWarehouseId,
    )
    if (selectedWarehouse && warehouseId) {
      // Get the current variant data fresh from the variants array to avoid stale closures
      const freshCurrentVariant = variants.find((v) => v.id === variant.id) || variant
      const freshWarehouseInventory = freshCurrentVariant.warehouseInventory || []
      const selectedWarehouseWithProps = selectedWarehouse as PickupAddressWithId & {
        warehouseName: string
      }
      const updated = [
        ...freshWarehouseInventory,
        {
          warehouseId: warehouseId,
          warehouseName: selectedWarehouseWithProps.warehouseName,
          quantity: 0,
          lowStockThreshold: 5,
        },
      ]

      const updatedVariants = variants.map((v) => {
        if (v.id === variant.id) {
          return { ...v, warehouseInventory: updated }
        }
        return v
      })
      onVariantsChange(updatedVariants)
    }
  }

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          fontSize: 14,
          fontWeight: 600,
          color: '#262626',
        }}
      >
        📦 Warehouse Stock Distribution for <strong>{variant.name}</strong>
      </div>
      {pickupAddresses.length === 0 ? (
        <Alert
          message="No Warehouses Configured"
          description="Please add pickup addresses (warehouses) in Store Settings before assigning inventory."
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
        />
      ) : (
        <div>
          {/* Add Warehouse Section */}
          {pickupAddresses.filter((addr: PickupAddressWithId, addrIndex: number) => {
            const warehouseId = getWarehouseId(addr, addrIndex)
            return !variantWarehouseInventory.some((wi) => wi.warehouseId === warehouseId)
          }).length > 0 && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <Row gutter={16} align="middle">
                <Col flex="auto">
                  <div style={{ color: '#fff' }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 4,
                      }}
                    >
                      Add Stock to Warehouse
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                      Select a warehouse from the dropdown to add stock
                    </div>
                  </div>
                </Col>
                <Col>
                  <Select
                    className="warehouse-select"
                    placeholder="Select warehouse..."
                    style={{ width: 300, background: '#fff' }}
                    size="large"
                    showSearch
                    optionFilterProp="children"
                    filterOption={(input, option) => {
                      const label = String(option?.label || option?.children || '')
                      return label.toLowerCase().includes(input.toLowerCase())
                    }}
                    onChange={(value: string) => {
                      if (value) {
                        addWarehouse(value)
                      }
                    }}
                    value={null}
                  >
                    {pickupAddresses.map((addr: PickupAddressWithId, addrIndex: number) => {
                      const warehouseId = getWarehouseId(addr, addrIndex)
                      const isAssigned = variantWarehouseInventory.some(
                        (wi) => wi.warehouseId === warehouseId,
                      )
                      if (isAssigned) return null
                      const addrWithProps = addr as PickupAddressWithId & {
                        warehouseName: string
                        city: string
                        state: string
                      }
                      return (
                        <Select.Option key={warehouseId} value={warehouseId}>
                          {addrWithProps.warehouseName} ({addrWithProps.city}, {addrWithProps.state})
                        </Select.Option>
                      )
                    })}
                  </Select>
                </Col>
              </Row>
            </Card>
          )}

          {/* Assigned Warehouses List */}
          {variantWarehouseInventory.length > 0 ? (
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#262626',
                  marginBottom: 12,
                }}
              >
                Assigned Warehouses ({variantWarehouseInventory.length})
              </div>
              <Row gutter={[16, 16]}>
                {variantWarehouseInventory
                  .filter(
                    (wi: {
                      warehouseId: string
                      warehouseName: string
                      quantity: number
                      lowStockThreshold?: number
                    }) => wi.warehouseId,
                  )
                  .map(
                    (
                      wi: {
                        warehouseId: string
                        warehouseName: string
                        quantity: number
                        lowStockThreshold?: number
                      },
                      entryIdx: number,
                    ) => {
                      const addr = findPickupAddressById(
                        wi.warehouseId,
                        pickupAddresses as Array<{
                          _id?: string
                          courierCartPickupAddressId?: string
                          warehouseName?: string
                          postalCode?: string
                          addressLine1?: string
                          city?: string
                          state?: string
                        }>,
                        getWarehouseId,
                      )
                      if (!addr) return null

                      const addrWithProps = addr as PickupAddressWithId & {
                        warehouseName: string
                        city: string
                        state: string
                      }

                      return (
                        <Col xs={24} sm={12} md={8} lg={6} key={wi.warehouseId}>
                          <Card
                            size="small"
                            style={{
                              border: '2px solid #1890ff',
                              background: '#f0f7ff',
                            }}
                            bodyStyle={{ padding: '12px' }}
                          >
                            <div style={{ marginBottom: 8 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: 13,
                                  marginBottom: 4,
                                }}
                              >
                                {wi.warehouseName || addrWithProps.warehouseName}
                              </div>
                              <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                {addrWithProps.city}, {addrWithProps.state}
                              </div>
                            </div>
                          <div>
                            <div style={{ marginBottom: 8 }}>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: '#595959',
                                  marginBottom: 4,
                                }}
                              >
                                Quantity
                              </div>
                              <InputNumber
                                min={0}
                                value={wi.quantity ?? 0}
                                style={{ width: '100%' }}
                                size="small"
                                onChange={(value) => {
                                  const numValue = value ?? 0
                                  updateVariantWarehouseInventory(entryIdx, 'quantity', numValue)
                                }}
                              />
                            </div>
                            <div style={{ marginBottom: 8 }}>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: '#595959',
                                  marginBottom: 4,
                                }}
                              >
                                Low Stock Threshold
                              </div>
                              <InputNumber
                                min={0}
                                value={wi.lowStockThreshold || 5}
                                style={{ width: '100%' }}
                                size="small"
                                onChange={(value) => {
                                  updateVariantWarehouseInventory(
                                    entryIdx,
                                    'lowStockThreshold',
                                    value || 5,
                                  )
                                }}
                              />
                            </div>
                            <Button
                              type="link"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => removeWarehouse(entryIdx)}
                              style={{ padding: 0, height: 'auto' }}
                            >
                              Remove
                            </Button>
                          </div>
                        </Card>
                      </Col>
                    )
                  },
                )}
              </Row>
            </div>
          ) : (
            <Alert
              message="No Warehouses Assigned"
              description="Select a warehouse from the dropdown above to add stock for this variant."
              type="info"
              showIcon
            />
          )}
        </div>
      )}
    </div>
  )
}

