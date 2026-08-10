import { DeleteOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Typography,
} from 'antd'
import { useState, useEffect } from 'react'
import type { PickupAddress } from '../../../api/storeQueries'
import { findPickupAddressById, getWarehouseId } from './PricingInventoryTab/utils'
import type { WarehouseInventoryItem } from './PricingInventoryTab/types'

const { Text } = Typography
const { Option } = Select

interface WarehouseInventoryAdjustModalProps {
  open: boolean
  onCancel: () => void
  onSave: (warehouseInventory: WarehouseInventoryItem[], reason?: string) => Promise<void>
  loading?: boolean
  currentWarehouseInventory?: WarehouseInventoryItem[]
  pickupAddresses: PickupAddress[]
}

interface PickupAddressWithId extends PickupAddress {
  _id?: string
  courierCartPickupAddressId?: string
}

export default function WarehouseInventoryAdjustModal({
  open,
  onCancel,
  onSave,
  loading = false,
  currentWarehouseInventory = [],
  pickupAddresses,
}: WarehouseInventoryAdjustModalProps) {
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseInventoryItem[]>([])
  const [selectedWarehouseValue, setSelectedWarehouseValue] = useState<string | null>(null)
  const [reason, setReason] = useState<string>('')

  // Initialize warehouse inventory from current product data
  useEffect(() => {
    if (open && currentWarehouseInventory) {
      setWarehouseInventory([...currentWarehouseInventory])
    } else if (open) {
      setWarehouseInventory([])
    }
  }, [open, currentWarehouseInventory])

  const handleAddWarehouse = (value: string) => {
    const selectedWarehouse = findPickupAddressById(
      value,
      pickupAddresses as PickupAddressWithId[],
      getWarehouseId,
    )
    if (selectedWarehouse && value) {
      const selectedWarehouseWithProps = selectedWarehouse as PickupAddressWithId & {
        warehouseName: string
      }
      const updated = [
        ...warehouseInventory,
        {
          warehouseId: value,
          warehouseName: selectedWarehouseWithProps.warehouseName,
          quantity: 0,
          lowStockThreshold: 5,
        },
      ]
      setWarehouseInventory(updated)
      setSelectedWarehouseValue(null)
    }
  }

  const handleQuantityChange = (entryIdx: number, value: number | null) => {
    const numValue = value ?? 0
    const updated = [...warehouseInventory]
    updated[entryIdx] = {
      ...updated[entryIdx],
      quantity: numValue,
    }
    setWarehouseInventory(updated)
  }

  const handleLowStockThresholdChange = (entryIdx: number, value: number | null) => {
    const updated = [...warehouseInventory]
    updated[entryIdx] = {
      ...updated[entryIdx],
      lowStockThreshold: value || 5,
    }
    setWarehouseInventory(updated)
  }

  const handleRemoveWarehouse = (entryIdx: number) => {
    const updated = warehouseInventory.filter((_, i) => i !== entryIdx)
    setWarehouseInventory(updated)
  }

  const handleSave = async () => {
    await onSave(warehouseInventory, reason || undefined)
    setReason('')
  }

  const totalStock = warehouseInventory.reduce((sum, wi) => sum + (wi.quantity || 0), 0)

  const availableWarehouses = pickupAddresses.filter((addr: PickupAddressWithId, addrIndex: number) => {
    const warehouseId = getWarehouseId(addr, addrIndex)
    return !warehouseInventory.some((wi) => wi.warehouseId === warehouseId)
  })

  return (
    <Modal
      title="Adjust Stock - Warehouse Level"
      open={open}
      onCancel={onCancel}
      onOk={handleSave}
      confirmLoading={loading}
      width={900}
      destroyOnClose
      okText="Save Changes"
      cancelText="Cancel"
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          message="Warehouse Inventory Management"
          description="Manage stock quantities across different warehouses. Total stock is automatically calculated from warehouse quantities."
          type="info"
          showIcon
        />

        {/* Total Stock Display */}
        <Card size="small" style={{ background: '#f0f7ff', border: '1px solid #91d5ff' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Text strong style={{ fontSize: '14px' }}>
                Total Stock Quantity:
              </Text>
            </Col>
            <Col>
              <Text strong style={{ fontSize: '18px', color: '#1890ff' }}>
                {totalStock}
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Add Warehouse Section */}
        {availableWarehouses.length > 0 && (
          <Card
            size="small"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
            }}
            bodyStyle={{ padding: '10px 12px' }}
          >
            <Row gutter={12} align="middle">
              <Col flex="auto">
                <div style={{ color: '#fff' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 2 }}>
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
                  {availableWarehouses.map((addr: PickupAddressWithId, addrIndex: number) => {
                    const warehouseId = getWarehouseId(addr, addrIndex)
                    const addrWithProps = addr as PickupAddressWithId & {
                      warehouseName: string
                      city: string
                      state: string
                    }
                    return (
                      <Option key={warehouseId} value={warehouseId}>
                        {addrWithProps.warehouseName} ({addrWithProps.city}, {addrWithProps.state})
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
                fontSize: '12px',
                fontWeight: 600,
                color: '#262626',
                marginBottom: 12,
              }}
            >
              Assigned Warehouses ({warehouseInventory.length})
            </div>
            <Row gutter={[12, 12]}>
              {warehouseInventory.map((wi, entryIdx) => {
                const addr = findPickupAddressById(
                  wi.warehouseId,
                  pickupAddresses as PickupAddressWithId[],
                  getWarehouseId,
                )
                if (!addr) return null

                const addrWithProps = addr as PickupAddressWithId & {
                  warehouseName: string
                  city: string
                  state: string
                }

                const qty = wi.quantity ?? 0
                const threshold = wi.lowStockThreshold || 5
                let statusColor = 'green'
                let statusText = 'In Stock'
                if (qty === 0) {
                  statusColor = 'red'
                  statusText = 'Out of Stock'
                } else if (qty <= threshold) {
                  statusColor = 'orange'
                  statusText = 'Low Stock'
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
                            onChange={(value) => handleQuantityChange(entryIdx, value)}
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
                            onChange={(value) => handleLowStockThresholdChange(entryIdx, value)}
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
                            <Tag color={statusColor} style={{ margin: 0, fontSize: '11px' }}>
                              {statusText}
                            </Tag>
                          </div>
                        </div>
                        <Button
                          type="link"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveWarehouse(entryIdx)}
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
              padding: '16px',
              backgroundColor: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: 4,
              textAlign: 'center',
              fontSize: '12px',
              color: '#1890ff',
            }}
          >
            {pickupAddresses.length === 0
              ? '⚠️ Add pickup addresses in Store Settings to assign inventory'
              : '💡 Select a warehouse from above to add stock'}
          </div>
        )}

        {/* Reason Field */}
        <Form.Item label="Reason (Optional)" style={{ marginBottom: 0 }}>
          <Input.TextArea
            rows={2}
            placeholder="Enter reason for stock adjustment..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Form.Item>
      </Space>
    </Modal>
  )
}

