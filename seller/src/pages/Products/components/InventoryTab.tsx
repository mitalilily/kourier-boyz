import { DeleteOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  InputNumber,
  Row,
  Select,
  Switch,
  Table,
  Typography,
  type FormInstance,
  type UploadFile,
} from 'antd'
import { useState } from 'react'
import { useProfile } from '../../../api/profileQueries'
import type { PickupAddress } from '../../../api/storeQueries'

interface WarehouseInventoryItem {
  warehouseId: string
  warehouseName: string
  quantity: number
  lowStockThreshold?: number
}

// Extended PickupAddress type that includes MongoDB _id and courierCartPickupAddressId
interface PickupAddressWithId extends PickupAddress {
  _id?: string
  courierCartPickupAddressId?: string
}

const { Text } = Typography

interface VariantWarehouseInventory {
  warehouseId: string
  warehouseName: string
  quantity: number
  lowStockThreshold?: number
}

interface VariantData {
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
  warehouseInventory?: VariantWarehouseInventory[]
  mainImage: UploadFile | string | null
  images: Array<UploadFile | string>
  isDefault: boolean
  status: string
}

interface InventoryTabProps {
  form: FormInstance
  variants: VariantData[]
  onVariantsChange: (variants: VariantData[]) => void
}

const InventoryTab = ({ form, variants, onVariantsChange }: InventoryTabProps) => {
  const hasVariants = form.getFieldValue('hasVariants') || false
  const { data: profile } = useProfile()
  const pickupAddresses: PickupAddress[] = (profile?.pickupAddresses as PickupAddress[]) || []

  // Watch warehouse inventory from form to trigger re-renders when it changes
  const warehouseInventory: WarehouseInventoryItem[] =
    Form.useWatch('warehouseInventory', form) || []

  // State to control the Select value for adding warehouses
  const [selectedWarehouseValue, setSelectedWarehouseValue] = useState<string | null>(null)

  // Helper function to get unique identifier for a pickup address
  const getWarehouseId = (addr: PickupAddressWithId, index?: number): string => {
    // Use _id if available (Mongoose subdocuments have _id by default)
    if (addr._id) {
      return String(addr._id)
    }
    // Fallback: use courierCartPickupAddressId if available
    if (addr.courierCartPickupAddressId) {
      return String(addr.courierCartPickupAddressId)
    }
    // Use index-based ID if provided (ensures uniqueness even if name/postalCode match)
    if (index !== undefined) {
      return `warehouse-${index}-${addr.warehouseName}-${addr.postalCode}`
    }
    // Last resort: use warehouseName + postalCode + addressLine1 as unique identifier
    return `${addr.warehouseName}-${addr.postalCode}-${addr.addressLine1 || ''}`
  }

  // Helper function to find pickup address by warehouseId
  const findPickupAddressById = (warehouseId: string): PickupAddressWithId | undefined => {
    return (pickupAddresses as PickupAddressWithId[]).find((addr, index) => {
      if (addr._id && String(addr._id) === warehouseId) return true
      if (
        addr.courierCartPickupAddressId &&
        String(addr.courierCartPickupAddressId) === warehouseId
      )
        return true
      // Check index-based ID format
      if (warehouseId.startsWith('warehouse-')) {
        const expectedId = getWarehouseId(addr, index)
        return expectedId === warehouseId
      }
      // Fallback: check composite key format
      return `${addr.warehouseName}-${addr.postalCode}-${addr.addressLine1 || ''}` === warehouseId
    })
  }

  // Update variant stock
  const updateVariantStock = (
    variantId: string,
    field: string,
    value: number | string | VariantWarehouseInventory[],
  ) => {
    const updatedVariants = variants.map((variant) => {
      if (variant.id === variantId) {
        const updated = { ...variant, [field]: value }
        // If warehouseInventory is updated, recalculate total stock
        if (field === 'warehouseInventory' && Array.isArray(value)) {
          const totalStock = value.reduce(
            (sum: number, wi: VariantWarehouseInventory) => sum + (wi.quantity || 0),
            0,
          )
          updated.stock = totalStock
        }
        return updated
      }
      return variant
    })
    onVariantsChange(updatedVariants)
  }

  // Update variant warehouse inventory
  const updateVariantWarehouseInventory = (
    variantId: string,
    warehouseIndex: number,
    field: keyof VariantWarehouseInventory,
    value: string | number | null | undefined,
  ) => {
    const variant = variants.find((v) => v.id === variantId)
    if (!variant) return

    const warehouseInventory = variant.warehouseInventory || []

    // Ensure we have a valid array and index
    if (warehouseIndex < 0 || warehouseIndex >= warehouseInventory.length) {
      console.error('Invalid warehouse index:', warehouseIndex, 'for variant:', variantId)
      return
    }

    const updated = [...warehouseInventory]

    // Handle null/undefined values properly
    const processedValue = value === null || value === undefined ? 0 : value

    updated[warehouseIndex] = {
      ...updated[warehouseIndex],
      [field]: processedValue,
    }

    // Recalculate total stock
    const totalStock = updated.reduce(
      (sum: number, wi: VariantWarehouseInventory) => sum + (Number(wi.quantity) || 0),
      0,
    )

    // Update both warehouseInventory and stock in a single call to avoid race conditions
    const updatedVariants = variants.map((v) => {
      if (v.id === variantId) {
        const updatedVariant = { ...v, warehouseInventory: updated, stock: totalStock }
        return updatedVariant
      }
      return v
    })
    onVariantsChange(updatedVariants)
  }

  // Variant inventory table columns
  const variantColumns = [
    {
      title: 'Variant',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: { sku: string }) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.sku}</div>
        </div>
      ),
    },
    {
      title: 'Total Stock',
      dataIndex: 'stock',
      key: 'stock',
      width: 120,
      render: (_: unknown, record: VariantData) => (
        <InputNumber
          value={record.stock || 0}
          min={0}
          style={{ width: '100%' }}
          placeholder="0"
          disabled
        />
      ),
    },
    {
      title: 'Low Stock Threshold',
      dataIndex: 'lowStockThreshold',
      key: 'lowStockThreshold',
      width: 150,
      render: (threshold: number, record: { id: string }) => (
        <InputNumber
          value={threshold || 5}
          min={0}
          style={{ width: '100%' }}
          onChange={(value) => updateVariantStock(record.id, 'lowStockThreshold', value || 5)}
        />
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (
        _: unknown,
        record: {
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
          mainImage: UploadFile | string | null
          images: Array<UploadFile | string>
          isDefault: boolean
          status: string
        },
      ) => {
        const stock = Number(record?.stock || 0)
        const threshold = Number(record?.lowStockThreshold || 5)
        const isLowStock = stock < threshold
        const isOutOfStock = stock === 0

        if (isOutOfStock) {
          return <Text type="danger">Out of Stock</Text>
        } else if (isLowStock) {
          return <Text type="warning">Low Stock</Text>
        } else {
          return <Text type="success">In Stock</Text>
        }
      },
    },
  ]

  return (
    <Card title="Inventory" style={{ marginBottom: 16 }}>
      {hasVariants && variants.length > 0 ? (
        <div>
          <Alert
            message="Variant Inventory Management"
            description="Manage stock and low stock thresholds for each variant individually."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* Variant Inventory Table */}
          <Table
            key={variants.length}
            columns={variantColumns}
            dataSource={variants}
            rowKey="id"
            pagination={false}
            size="small"
            expandable={{
              expandedRowRender: (record: VariantData) => {
                // Get the current variant data from the variants array to ensure we have the latest state
                const currentVariant = variants.find((v) => v.id === record.id) || record
                const variantWarehouseInventory = currentVariant.warehouseInventory || []
                return (
                  <div style={{ padding: '20px', background: '#fafafa', borderRadius: '4px' }}>
                    <div
                      style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#262626' }}
                    >
                      📦 Warehouse Stock Distribution for <strong>{record.name}</strong>
                    </div>
                    {pickupAddresses.length === 0 ? (
                      <Alert
                        message="No Warehouses Configured"
                        description="Please add pickup addresses (warehouses) in Store Settings before assigning inventory."
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                      />
                    ) : (
                      <div>
                        {/* Add Warehouse Section */}
                        {pickupAddresses.filter((addr: PickupAddressWithId, addrIndex: number) => {
                          const warehouseId = getWarehouseId(addr, addrIndex)
                          return !variantWarehouseInventory.some(
                            (wi) => wi.warehouseId === warehouseId,
                          )
                        }).length > 0 && (
                          <Card
                            size="small"
                            style={{
                              marginBottom: 16,
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              border: 'none',
                            }}
                            bodyStyle={{ padding: '16px' }}
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
                                    const selectedWarehouse = findPickupAddressById(value)
                                    if (selectedWarehouse && value) {
                                      const updated = [
                                        ...variantWarehouseInventory,
                                        {
                                          warehouseId: value,
                                          warehouseName: selectedWarehouse.warehouseName,
                                          quantity: 0,
                                          lowStockThreshold: 5,
                                        },
                                      ]
                                      updateVariantStock(record.id, 'warehouseInventory', updated)
                                    }
                                  }}
                                  value={null}
                                >
                                  {pickupAddresses.map(
                                    (addr: PickupAddressWithId, addrIndex: number) => {
                                      const warehouseId = getWarehouseId(addr, addrIndex)
                                      const isAssigned = variantWarehouseInventory.some(
                                        (wi) => wi.warehouseId === warehouseId,
                                      )
                                      if (isAssigned) return null
                                      return (
                                        <Select.Option key={warehouseId} value={warehouseId}>
                                          {addr.warehouseName} ({addr.city}, {addr.state})
                                        </Select.Option>
                                      )
                                    },
                                  )}
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
                              {variantWarehouseInventory.map(
                                (wi: VariantWarehouseInventory, entryIdx: number) => {
                                  const addr = findPickupAddressById(wi.warehouseId)
                                  if (!addr) return null

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
                                            {wi.warehouseName || addr.warehouseName}
                                          </div>
                                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                            {addr.city}, {addr.state}
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
                                                updateVariantWarehouseInventory(
                                                  record.id,
                                                  entryIdx,
                                                  'quantity',
                                                  numValue,
                                                )
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
                                                  record.id,
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
                                            onClick={() => {
                                              const updated = variantWarehouseInventory.filter(
                                                (_: VariantWarehouseInventory, i: number) =>
                                                  i !== entryIdx,
                                              )
                                              const totalStock = updated.reduce(
                                                (sum: number, wi: VariantWarehouseInventory) =>
                                                  sum + (Number(wi.quantity) || 0),
                                                0,
                                              )
                                              updateVariantStock(
                                                record.id,
                                                'warehouseInventory',
                                                updated,
                                              )
                                              updateVariantStock(record.id, 'stock', totalStock)
                                            }}
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
              },
              rowExpandable: () => true,
            }}
          />
        </div>
      ) : (
        <div>
          {/* Simple Product Inventory */}
          <Alert
            message="Automatic Status Updates"
            description="Product status will automatically update based on stock levels: Active (stock > 0), Out of Stock (stock = 0). Draft status is preserved regardless of stock."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="stock"
                label="Total Stock Quantity"
                rules={[{ required: true, message: 'Please enter stock quantity' }]}
                tooltip="Total stock across all warehouses (auto-calculated from warehouse inventory below)"
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="lowStockThreshold" label="Low Stock Threshold">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="5" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="Status">
                <Select placeholder="Select status">
                  <Select.Option value="active">Active</Select.Option>
                  <Select.Option value="inactive">Inactive</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="isFeatured" label="Featured" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          {/* Warehouse Inventory Section */}
          <Divider orientation="left">Warehouse Inventory</Divider>
          {pickupAddresses.length === 0 ? (
            <Alert
              message="No Warehouses Configured"
              description="Please add pickup addresses (warehouses) in Store Settings before assigning inventory."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          ) : (
            <div>
              <Alert
                message="Distribute Inventory Across Warehouses"
                description="Assign stock quantities to each warehouse. Total stock will be automatically calculated from the sum of all warehouse quantities."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item name="warehouseInventory">
                {/* Add Warehouse Section */}
                {pickupAddresses.filter((addr: PickupAddressWithId, addrIndex: number) => {
                  const warehouseId = getWarehouseId(addr, addrIndex)
                  return !warehouseInventory.some(
                    (wi: WarehouseInventoryItem) => wi.warehouseId === warehouseId,
                  )
                }).length > 0 && (
                  <Card
                    size="small"
                    style={{
                      marginBottom: 16,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                    }}
                    bodyStyle={{ padding: '16px' }}
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
                            const selectedWarehouse = findPickupAddressById(value)
                            if (selectedWarehouse && value) {
                              const updated = [
                                ...warehouseInventory,
                                {
                                  warehouseId: value,
                                  warehouseName: selectedWarehouse.warehouseName,
                                  quantity: 0,
                                  lowStockThreshold: 5,
                                },
                              ]
                              form.setFieldsValue({ warehouseInventory: updated })
                              // Recalculate total stock
                              const totalStock = updated.reduce(
                                (sum, wi) => sum + (wi.quantity || 0),
                                0,
                              )
                              form.setFieldsValue({ stock: totalStock })
                              // Reset the Select value after adding
                              setSelectedWarehouseValue(null)
                            }
                          }}
                          value={selectedWarehouseValue}
                        >
                          {pickupAddresses.map((addr: PickupAddressWithId, addrIndex: number) => {
                            const warehouseId = getWarehouseId(addr, addrIndex)
                            const isAssigned = warehouseInventory.some(
                              (wi: WarehouseInventoryItem) => wi.warehouseId === warehouseId,
                            )
                            if (isAssigned) return null
                            return (
                              <Select.Option key={warehouseId} value={warehouseId}>
                                {addr.warehouseName} ({addr.city}, {addr.state})
                              </Select.Option>
                            )
                          })}
                        </Select>
                      </Col>
                    </Row>
                  </Card>
                )}

                {/* Assigned Warehouses List */}
                {warehouseInventory.length > 0 ? (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#262626',
                        marginBottom: 12,
                      }}
                    >
                      Assigned Warehouses ({warehouseInventory.length})
                    </div>
                    <Row gutter={[16, 16]}>
                      {warehouseInventory.map((wi: WarehouseInventoryItem, entryIdx: number) => {
                        const addr = findPickupAddressById(wi.warehouseId)
                        if (!addr) return null

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
                                  {wi.warehouseName || addr.warehouseName}
                                </div>
                                <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                  {addr.city}, {addr.state}
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
                                      const updated = [...warehouseInventory]
                                      updated[entryIdx] = {
                                        ...updated[entryIdx],
                                        quantity: numValue,
                                      }
                                      form.setFieldsValue({ warehouseInventory: updated })
                                      // Recalculate total stock
                                      const totalStock = updated.reduce(
                                        (sum, wi) => sum + (wi.quantity || 0),
                                        0,
                                      )
                                      form.setFieldsValue({ stock: totalStock })
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
                                      const updated = [...warehouseInventory]
                                      updated[entryIdx] = {
                                        ...updated[entryIdx],
                                        lowStockThreshold: value || 5,
                                      }
                                      form.setFieldsValue({ warehouseInventory: updated })
                                    }}
                                  />
                                </div>
                                <Button
                                  type="link"
                                  danger
                                  size="small"
                                  icon={<DeleteOutlined />}
                                  onClick={() => {
                                    const updated = warehouseInventory.filter(
                                      (_: WarehouseInventoryItem, i: number) => i !== entryIdx,
                                    )
                                    form.setFieldsValue({ warehouseInventory: updated })
                                    // Recalculate total stock
                                    const totalStock = updated.reduce(
                                      (sum: number, wi: WarehouseInventoryItem) =>
                                        sum + (wi.quantity || 0),
                                      0,
                                    )
                                    form.setFieldsValue({ stock: totalStock })
                                  }}
                                  style={{ padding: 0, height: 'auto' }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </Card>
                          </Col>
                        )
                      })}
                    </Row>
                  </div>
                ) : (
                  <Alert
                    message="No Warehouses Assigned"
                    description="Select a warehouse from the dropdown above to add stock for this product."
                    type="info"
                    showIcon
                  />
                )}
              </Form.Item>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export default InventoryTab
