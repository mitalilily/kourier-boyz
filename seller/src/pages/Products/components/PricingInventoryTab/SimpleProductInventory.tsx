import { DeleteOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  InputNumber,
  Row,
  Select,
  Switch,
  Tag,
  Typography,
} from 'antd'
import { useEffect } from 'react'
import type { PickupAddressWithId, WarehouseInventoryItem } from './types'
import { findPickupAddressById, getWarehouseId } from './utils'

const { Text } = Typography
const { Option } = Select

interface SimpleProductInventoryProps {
  form: FormInstance
  warehouseInventory: WarehouseInventoryItem[]
  pickupAddresses: PickupAddressWithId[]
  selectedWarehouseValue: string | null
  onSelectedWarehouseValueChange: (value: string | null) => void
}

export default function SimpleProductInventory({
  form,
  warehouseInventory,
  pickupAddresses,
  selectedWarehouseValue,
  onSelectedWarehouseValueChange,
}: SimpleProductInventoryProps) {
  // Ensure warehouseInventory is initialized in form
  useEffect(() => {
    const currentValue = form.getFieldValue('warehouseInventory')
    if (!Array.isArray(currentValue)) {
      form.setFieldsValue({ warehouseInventory: [] })
    }
  }, [form])

  const handleAddWarehouse = (value: string) => {
    const selectedWarehouse = findPickupAddressById(
      value,
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
    if (selectedWarehouse && value) {
      // Get fresh warehouse inventory from form to avoid stale closures
      const currentWarehouseInventoryValue = form.getFieldValue('warehouseInventory')
      // Ensure it's always an array
      const currentWarehouseInventory: WarehouseInventoryItem[] = Array.isArray(currentWarehouseInventoryValue)
        ? currentWarehouseInventoryValue
        : []
      const selectedWarehouseWithProps = selectedWarehouse as PickupAddressWithId & {
        warehouseName: string
      }
      const updated = [
        ...currentWarehouseInventory,
        {
          warehouseId: value,
          warehouseName: selectedWarehouseWithProps.warehouseName,
          quantity: 0,
          lowStockThreshold: 5,
        },
      ]
      form.setFieldsValue({ warehouseInventory: updated })
      const totalStock = updated.reduce((sum, wi) => sum + (wi.quantity || 0), 0)
      form.setFieldsValue({ stock: totalStock })
      onSelectedWarehouseValueChange(null)
    }
  }

  const handleQuantityChange = (warehouseId: string, value: number | null) => {
    // Get fresh warehouse inventory from form to avoid stale closures
    const currentWarehouseInventoryValue = form.getFieldValue('warehouseInventory')
    // Ensure it's always an array
    const currentWarehouseInventory: WarehouseInventoryItem[] = Array.isArray(currentWarehouseInventoryValue)
      ? currentWarehouseInventoryValue
      : []
    const numValue = value ?? 0
    const updated = currentWarehouseInventory.map((wi) =>
      wi.warehouseId === warehouseId ? { ...wi, quantity: numValue } : wi,
    )
    form.setFieldsValue({ warehouseInventory: updated })
    const totalStock = updated.reduce((sum, wi) => sum + (wi.quantity || 0), 0)
    form.setFieldsValue({ stock: totalStock })
  }

  const handleLowStockThresholdChange = (warehouseId: string, value: number | null) => {
    // Get fresh warehouse inventory from form to avoid stale closures
    const currentWarehouseInventoryValue = form.getFieldValue('warehouseInventory')
    // Ensure it's always an array
    const currentWarehouseInventory: WarehouseInventoryItem[] = Array.isArray(currentWarehouseInventoryValue)
      ? currentWarehouseInventoryValue
      : []
    const updated = currentWarehouseInventory.map((wi) =>
      wi.warehouseId === warehouseId ? { ...wi, lowStockThreshold: value || 5 } : wi,
    )
    form.setFieldsValue({ warehouseInventory: updated })
  }

  const handleRemoveWarehouse = (warehouseId: string) => {
    // Get fresh warehouse inventory from form to avoid stale closures
    const currentWarehouseInventoryValue = form.getFieldValue('warehouseInventory')
    // Ensure it's always an array
    const currentWarehouseInventory: WarehouseInventoryItem[] = Array.isArray(currentWarehouseInventoryValue)
      ? currentWarehouseInventoryValue
      : []
    const updated = currentWarehouseInventory.filter((wi: WarehouseInventoryItem) => wi.warehouseId !== warehouseId)
    form.setFieldsValue({ warehouseInventory: updated })
    const totalStock = updated.reduce(
      (sum: number, wi: WarehouseInventoryItem) => sum + (wi.quantity || 0),
      0,
    )
    form.setFieldsValue({ stock: totalStock })
  }

  return (
    <div>
      {/* Ordering & Inventory Policy */}
      <Divider orientation="left" style={{ marginTop: 8, marginBottom: 12, fontSize: '12px' }}>
        Ordering & Inventory Policy
      </Divider>
      <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={12}>
          <Form.Item
            name="trackInventory"
            label={<span style={{ fontSize: '12px' }}>Track Inventory</span>}
            valuePropName="checked"
            tooltip="Receive low-stock notifications and keep stock levels in sync."
            style={{ marginBottom: 12 }}
          >
            <Switch size="small" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="minOrderQuantity"
            label={<span style={{ fontSize: '12px' }}>Min Order Quantity</span>}
            tooltip="Minimum quantity per order"
            initialValue={1}
            style={{ marginBottom: 12 }}
          >
            <InputNumber size="small" min={1} style={{ width: '100%' }} placeholder="1" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="maxOrderQuantity"
            label={<span style={{ fontSize: '12px' }}>Max Order Quantity</span>}
            tooltip="Maximum quantity per order"
            style={{ marginBottom: 12 }}
          >
            <InputNumber size="small" min={1} style={{ width: '100%' }} placeholder="No limit" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="taxClass"
            label={<span style={{ fontSize: '12px' }}>Tax Class</span>}
            style={{ marginBottom: 12 }}
          >
            <Select size="small" placeholder="Select tax class">
              <Option value="standard">Standard</Option>
              <Option value="reduced">Reduced</Option>
              <Option value="zero">Zero Rate</Option>
              <Option value="exempt">Exempt</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="taxRate"
            label={<span style={{ fontSize: '12px' }}>Tax Rate (%)</span>}
            style={{ marginBottom: 0 }}
          >
            <InputNumber size="small" min={0} max={100} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Col>
      </Row>

      {/* Stock Management */}
      <Divider orientation="left" style={{ marginTop: 8, marginBottom: 12, fontSize: '12px' }}>
        Stock Management
      </Divider>
      {pickupAddresses.length > 0 && (
        <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
          <Col xs={24} md={12}>
            <Form.Item
              label={<span style={{ fontSize: '12px' }}>Total Stock Quantity</span>}
              tooltip="Auto-calculated from warehouse inventory below"
              style={{ marginBottom: 12 }}
            >
              <div
                style={{
                  padding: '3px 8px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  background: '#fafafa',
                  minHeight: '28px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Text strong style={{ fontSize: '14px' }}>
                  {warehouseInventory.reduce((sum, wi) => sum + (wi.quantity || 0), 0)}
                </Text>
              </div>
              <Form.Item name="stock" noStyle>
                <input
                  type="hidden"
                  value={warehouseInventory.reduce((sum, wi) => sum + (wi.quantity || 0), 0)}
                />
              </Form.Item>
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="isFeatured"
              label={<span style={{ fontSize: '12px' }}>Featured</span>}
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch size="small" />
            </Form.Item>
          </Col>
        </Row>
      )}
      {pickupAddresses.length === 0 && (
        <Row gutter={[12, 8]} style={{ marginBottom: 12 }}>
          <Col xs={24} md={12}>
            <Form.Item
              name="stock"
              label={<span style={{ fontSize: '12px' }}>Total Stock Quantity</span>}
              rules={[{ required: true, message: 'Please enter stock quantity' }]}
              style={{ marginBottom: 12 }}
            >
              <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="isFeatured"
              label={<span style={{ fontSize: '12px' }}>Featured</span>}
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch size="small" />
            </Form.Item>
          </Col>
        </Row>
      )}

      {/* Warehouse Inventory Section */}
      <Divider orientation="left" style={{ marginTop: 8, marginBottom: 12, fontSize: '12px' }}>
        Warehouse Inventory
      </Divider>
      {pickupAddresses.length === 0 ? (
        <div
          style={{
            padding: '8px 10px',
            backgroundColor: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: 4,
            marginBottom: 12,
            fontSize: '11px',
            color: '#d46b08',
          }}
        >
          ⚠️ Add pickup addresses in Store Settings to assign inventory
        </div>
      ) : (
        <div>
          <Form.Item name="warehouseInventory" noStyle>
            <input type="hidden" />
          </Form.Item>
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
                  marginBottom: 12,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                }}
                bodyStyle={{ padding: '10px 12px' }}
              >
                <Row gutter={12} align="middle">
                  <Col flex="auto">
                    <div style={{ color: '#fff' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          marginBottom: 2,
                        }}
                      >
                        Add Stock to Warehouse
                      </div>
                      <div style={{ fontSize: '11px', opacity: 0.9 }}>
                        Select a warehouse from the dropdown to add stock
                      </div>
                    </div>
                  </Col>
                  <Col>
                    <Select
                      className="warehouse-select"
                      placeholder="Select warehouse..."
                      style={{ width: 280, background: '#fff' }}
                      size="small"
                      showSearch
                      optionFilterProp="children"
                      filterOption={(input, option) => {
                        const label = String(option?.label || option?.children || '')
                        return label.toLowerCase().includes(input.toLowerCase())
                      }}
                      onChange={handleAddWarehouse}
                      value={selectedWarehouseValue}
                    >
                      {pickupAddresses.map((addr: PickupAddressWithId, addrIndex: number) => {
                        const warehouseId = getWarehouseId(addr, addrIndex)
                        const isAssigned = warehouseInventory.some(
                          (wi: WarehouseInventoryItem) => wi.warehouseId === warehouseId,
                        )
                        if (isAssigned) return null
                        const addrWithProps = addr as PickupAddressWithId & {
                          warehouseName: string
                          city: string
                          state: string
                        }
                        return (
                          <Option key={warehouseId} value={warehouseId}>
                            {addrWithProps.warehouseName} ({addrWithProps.city},{' '}
                            {addrWithProps.state})
                          </Option>
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
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#262626',
                    marginBottom: 8,
                  }}
                >
                  Assigned Warehouses ({warehouseInventory.length})
                </div>
                <Row gutter={[12, 12]}>
                  {warehouseInventory
                    .filter((wi: WarehouseInventoryItem) => wi.warehouseId)
                    .map((wi: WarehouseInventoryItem) => {
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
                            bodyStyle={{ padding: '10px' }}
                          >
                            <div style={{ marginBottom: 6 }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: '12px',
                                  marginBottom: 2,
                                }}
                              >
                                {wi.warehouseName || addrWithProps.warehouseName}
                              </div>
                              <div style={{ fontSize: '10px', color: '#8c8c8c' }}>
                                {addrWithProps.city}, {addrWithProps.state}
                              </div>
                            </div>
                            <div>
                              <div style={{ marginBottom: 6 }}>
                                <div
                                  style={{
                                    fontSize: '10px',
                                    color: '#595959',
                                    marginBottom: 3,
                                  }}
                                >
                                  Quantity
                                </div>
                                <InputNumber
                                  min={0}
                                  value={wi.quantity ?? 0}
                                  style={{ width: '100%' }}
                                  size="small"
                                  onChange={(value) => handleQuantityChange(wi.warehouseId, value)}
                                />
                              </div>
                              <div style={{ marginBottom: 6 }}>
                                <div
                                  style={{
                                    fontSize: '10px',
                                    color: '#595959',
                                    marginBottom: 3,
                                  }}
                                >
                                  Low Stock Threshold
                                </div>
                                <InputNumber
                                  min={0}
                                  value={wi.lowStockThreshold || 5}
                                  style={{ width: '100%' }}
                                  size="small"
                                  onChange={(value) => handleLowStockThresholdChange(wi.warehouseId, value)}
                                />
                              </div>
                              <div style={{ marginBottom: 6 }}>
                                <div
                                  style={{
                                    fontSize: '10px',
                                    color: '#595959',
                                    marginBottom: 3,
                                  }}
                                >
                                  Status
                                </div>
                                <div>
                                  {(() => {
                                    const qty = wi.quantity ?? 0
                                    const threshold = wi.lowStockThreshold || 5
                                    if (qty === 0) {
                                      return (
                                        <Tag color="red" style={{ margin: 0, fontSize: '11px' }}>
                                          Out of Stock
                                        </Tag>
                                      )
                                    } else if (qty <= threshold) {
                                      return (
                                        <Tag color="orange" style={{ margin: 0, fontSize: '11px' }}>
                                          Low Stock
                                        </Tag>
                                      )
                                    } else {
                                      return (
                                        <Tag color="green" style={{ margin: 0, fontSize: '11px' }}>
                                          In Stock
                                        </Tag>
                                      )
                                    }
                                  })()}
                                </div>
                              </div>
                              <Button
                                type="link"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveWarehouse(wi.warehouseId)}
                                style={{ padding: 0, height: 'auto', fontSize: '11px' }}
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
              <div
                style={{
                  padding: '8px 10px',
                  backgroundColor: '#e6f7ff',
                  border: '1px solid #91d5ff',
                  borderRadius: 4,
                  fontSize: '11px',
                  color: '#1890ff',
                }}
              >
                💡 Select a warehouse from above to add stock
              </div>
            )}
        </div>
      )}
    </div>
  )
}
