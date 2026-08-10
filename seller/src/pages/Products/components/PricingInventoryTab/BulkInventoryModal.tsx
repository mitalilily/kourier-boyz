import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Tooltip,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import {
  filterVariantsByAttribute,
  getUniqueAttributeValues,
} from '../../productFormUtils'
import type { PickupAddressWithId, VariantType, WarehouseInventoryItem } from './types'
import { getWarehouseId } from './utils'

const { Text } = Typography

interface BulkInventoryModalProps {
  open: boolean
  variants: Array<VariantType>
  pickupAddresses: PickupAddressWithId[]
  onOk: (
    warehouseInventory: WarehouseInventoryItem[],
    targetVariantIds: string[],
  ) => void
  onCancel: () => void
}

export default function BulkInventoryModal({
  open,
  variants,
  pickupAddresses,
  onOk,
  onCancel,
}: BulkInventoryModalProps) {
  const [applyMode, setApplyMode] = useState<'all' | 'attribute'>('all')
  const [selectedAttribute, setSelectedAttribute] = useState<string | null>(null)
  const [selectedValue, setSelectedValue] = useState<string | null>(null)
  const [warehouseInventory, setWarehouseInventory] = useState<WarehouseInventoryItem[]>([])

  // Get unique attributes and their values
  const attributeValues = useMemo(() => getUniqueAttributeValues(variants), [variants])

  const attributeOptions = useMemo(
    () =>
      Object.keys(attributeValues).map((attr) => ({
        label: attr,
        value: attr,
      })),
    [attributeValues],
  )

  const valueOptions = useMemo(() => {
    if (!selectedAttribute || !attributeValues[selectedAttribute]) return []
    return attributeValues[selectedAttribute].map((val) => ({
      label: val,
      value: val,
    }))
  }, [selectedAttribute, attributeValues])

  // Get matching variants based on selection
  const matchingVariants = useMemo(() => {
    if (applyMode === 'all') return variants
    return filterVariantsByAttribute(variants, selectedAttribute, selectedValue)
  }, [variants, applyMode, selectedAttribute, selectedValue])

  // Calculate total stock from warehouse inventory
  const totalStock = useMemo(() => {
    return warehouseInventory.reduce((sum, wi) => sum + (wi.quantity || 0), 0)
  }, [warehouseInventory])

  // Get available warehouses (not yet added)
  const availableWarehouses = useMemo(() => {
    return pickupAddresses.filter((addr, index) => {
      const warehouseId = getWarehouseId(addr, index)
      return !warehouseInventory.some((wi) => wi.warehouseId === warehouseId)
    })
  }, [pickupAddresses, warehouseInventory])

  const handleOk = () => {
    const targetIds = matchingVariants.map((v) => v.id)
    onOk(warehouseInventory, targetIds)
    handleReset()
  }

  const handleCancel = () => {
    handleReset()
    onCancel()
  }

  const handleReset = () => {
    setApplyMode('all')
    setSelectedAttribute(null)
    setSelectedValue(null)
    setWarehouseInventory([])
  }

  const handleApplyModeChange = (value: 'all' | 'attribute') => {
    setApplyMode(value)
    if (value === 'all') {
      setSelectedAttribute(null)
      setSelectedValue(null)
    }
  }

  const handleAttributeChange = (value: string | null) => {
    setSelectedAttribute(value)
    setSelectedValue(null)
  }

  const addWarehouse = (warehouseId: string) => {
    const addrIndex = pickupAddresses.findIndex(
      (addr, idx) => getWarehouseId(addr, idx) === warehouseId,
    )
    if (addrIndex === -1) return

    const addr = pickupAddresses[addrIndex] as PickupAddressWithId & { warehouseName: string }
    setWarehouseInventory([
      ...warehouseInventory,
      {
        warehouseId,
        warehouseName: addr.warehouseName || `Warehouse ${addrIndex + 1}`,
        quantity: 0,
        lowStockThreshold: 5,
      },
    ])
  }

  const removeWarehouse = (index: number) => {
    setWarehouseInventory(warehouseInventory.filter((_, i) => i !== index))
  }

  const updateWarehouse = (
    index: number,
    field: 'quantity' | 'lowStockThreshold',
    value: number,
  ) => {
    const updated = [...warehouseInventory]
    updated[index] = { ...updated[index], [field]: value }
    setWarehouseInventory(updated)
  }

  const isApplyDisabled =
    (applyMode === 'attribute' && (!selectedAttribute || !selectedValue)) ||
    warehouseInventory.length === 0

  const hasNoWarehouses = pickupAddresses.length === 0

  return (
    <Modal
      title="Distribute Inventory to Variants"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Apply to Variants"
      cancelText="Cancel"
      okButtonProps={{ disabled: isApplyDisabled }}
      width={700}
    >
      {hasNoWarehouses ? (
        <Alert
          message="No Warehouses Configured"
          description="Please add pickup addresses (warehouses) in Store Settings before distributing inventory."
          type="warning"
          showIcon
        />
      ) : (
        <div>
          {/* Apply Mode Selection */}
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              Apply to
            </Text>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Select
                value={applyMode}
                onChange={handleApplyModeChange}
                style={{ width: '100%' }}
                options={[
                  { label: 'All Variants', value: 'all' },
                  { label: 'By Attribute', value: 'attribute' },
                ]}
              />

              {applyMode === 'attribute' && (
                <Space size={8}>
                  <Select
                    placeholder="Select attribute"
                    value={selectedAttribute}
                    onChange={handleAttributeChange}
                    style={{ width: 150 }}
                    options={attributeOptions}
                  />
                  {selectedAttribute && (
                    <Select
                      placeholder={`Select ${selectedAttribute}`}
                      value={selectedValue}
                      onChange={setSelectedValue}
                      style={{ width: 150 }}
                      options={valueOptions}
                    />
                  )}
                </Space>
              )}
            </Space>
          </div>

          {/* Add Warehouse Section */}
          {availableWarehouses.length > 0 && (
            <Card
              size="small"
              style={{
                marginBottom: 16,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <Row gutter={16} align="middle">
                <Col flex="auto">
                  <div style={{ color: '#fff' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      Add Warehouse Stock
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>
                      Select warehouses and set quantities to distribute
                    </div>
                  </div>
                </Col>
                <Col>
                  <Select
                    className="warehouse-select"
                    placeholder="Select warehouse..."
                    style={{ width: 250, background: '#fff' }}
                    showSearch
                    optionFilterProp="children"
                    onChange={(value: string) => {
                      if (value) addWarehouse(value)
                    }}
                    value={null}
                  >
                    {availableWarehouses.map((addr) => {
                      const realIndex = pickupAddresses.indexOf(addr)
                      const warehouseId = getWarehouseId(addr, realIndex)
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

          {/* Warehouse Inventory List */}
          {warehouseInventory.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>
                Warehouse Distribution ({warehouseInventory.length})
              </Text>
              <Row gutter={[12, 12]}>
                {warehouseInventory.map((wi, index) => (
                  <Col xs={24} sm={12} key={wi.warehouseId}>
                    <Card
                      size="small"
                      style={{ border: '2px solid #1890ff', background: '#f0f7ff' }}
                      styles={{ body: { padding: '12px' } }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{wi.warehouseName}</div>
                        </div>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeWarehouse(index)}
                        />
                      </div>
                      <Row gutter={12}>
                        <Col span={12}>
                          <div style={{ fontSize: 11, color: '#595959', marginBottom: 4 }}>
                            <Space size={4}>
                              Quantity
                              <Tooltip title="Stock quantity for this warehouse">
                                <InfoCircleOutlined style={{ fontSize: 10, color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          </div>
                          <InputNumber
                            min={0}
                            value={wi.quantity}
                            style={{ width: '100%' }}
                            size="small"
                            onChange={(value) => updateWarehouse(index, 'quantity', value || 0)}
                          />
                        </Col>
                        <Col span={12}>
                          <div style={{ fontSize: 11, color: '#595959', marginBottom: 4 }}>
                            <Space size={4}>
                              Low Stock
                              <Tooltip title="Alert threshold for low stock">
                                <InfoCircleOutlined style={{ fontSize: 10, color: '#1890ff' }} />
                              </Tooltip>
                            </Space>
                          </div>
                          <InputNumber
                            min={0}
                            value={wi.lowStockThreshold || 5}
                            style={{ width: '100%' }}
                            size="small"
                            onChange={(value) =>
                              updateWarehouse(index, 'lowStockThreshold', value || 5)
                            }
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          ) : (
            <Alert
              message="No Warehouses Selected"
              description="Select a warehouse from the dropdown above to distribute inventory."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Summary */}
          <Alert
            message={
              <Space direction="vertical" size={0}>
                <Text>
                  This will set inventory for{' '}
                  <Text strong>
                    {matchingVariants.length} variant{matchingVariants.length !== 1 ? 's' : ''}
                  </Text>
                </Text>
                {applyMode === 'attribute' && selectedAttribute && selectedValue && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Matching {selectedAttribute}: {selectedValue}
                  </Text>
                )}
                {warehouseInventory.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Total stock per variant: {totalStock} units across {warehouseInventory.length}{' '}
                    warehouse{warehouseInventory.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </Space>
            }
            type="info"
            showIcon
          />
        </div>
      )}
    </Modal>
  )
}
