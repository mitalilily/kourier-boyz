import { Alert, Button, InputNumber, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { VariantType, PickupAddressWithId } from './types'

const { Text } = Typography

interface VariantInventoryTableProps {
  variants: Array<VariantType>
  pickupAddresses: PickupAddressWithId[]
  onVariantsChange: (variants: Array<VariantType>) => void
  onDistributeStock: (variant: VariantType) => void
}

export default function VariantInventoryTable({
  variants,
  pickupAddresses,
  onVariantsChange,
  onDistributeStock,
}: VariantInventoryTableProps) {
  const updateVariantStock = (variantId: string, field: string, value: unknown) => {
    const updatedVariants = variants.map((variant) => {
      if (variant.id === variantId) {
        const updated = { ...variant, [field]: value }
        if (field === 'warehouseInventory' && Array.isArray(value)) {
          const totalStock = value.reduce(
            (sum: number, wi: { quantity?: number }) => sum + (wi.quantity || 0),
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

  const warehousesConfigured = pickupAddresses.length > 0

  const columns: ColumnsType<VariantType> = [
    {
      title: 'Variant',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: VariantType) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: '12px' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#666' }}>{record.sku}</div>
        </div>
      ),
    },
    {
      title: 'Total Stock',
      dataIndex: 'stock',
      key: 'stock',
      width: 120,
      render: (_: unknown, record: VariantType) => {
        const variantWarehouseInventory = record.warehouseInventory || []
        const hasWarehouseInventory = variantWarehouseInventory.length > 0

        const calculatedStock =
          warehousesConfigured && hasWarehouseInventory
            ? variantWarehouseInventory.reduce(
                (sum: number, wi: { quantity?: number }) => sum + (wi.quantity || 0),
                0,
              )
            : warehousesConfigured
            ? 0
            : record.stock || 0

        return (
          <div>
            <InputNumber
              value={calculatedStock}
              min={0}
              style={{ width: '100%' }}
              size="small"
              placeholder="0"
              disabled={warehousesConfigured}
              onChange={(value) => {
                if (!warehousesConfigured) {
                  updateVariantStock(record.id, 'stock', value || 0)
                }
              }}
            />
            {warehousesConfigured && (
              <div style={{ fontSize: 10, color: '#8c8c8c', marginTop: 4 }}>
                Calculated from warehouses
              </div>
            )}
          </div>
        )
      },
    },
    {
      title: 'Low Stock Threshold',
      dataIndex: 'lowStockThreshold',
      key: 'lowStockThreshold',
      width: 150,
      render: (threshold: number, record: VariantType) => (
        <InputNumber
          value={threshold || 5}
          min={0}
          style={{ width: '100%' }}
          size="small"
          onChange={(value) => updateVariantStock(record.id, 'lowStockThreshold', value || 5)}
        />
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_: unknown, record: VariantType) => {
        const variantWarehouseInventory = record.warehouseInventory || []
        const hasWarehouseInventory = variantWarehouseInventory.length > 0

        const stock =
          warehousesConfigured && hasWarehouseInventory
            ? variantWarehouseInventory.reduce(
                (sum: number, wi: { quantity?: number }) => sum + (wi.quantity || 0),
                0,
              )
            : warehousesConfigured
            ? 0
            : Number(record?.stock || 0)
        const threshold = Number(record?.lowStockThreshold || 5)
        const isLowStock = stock < threshold
        const isOutOfStock = stock === 0

        if (isOutOfStock) {
          return (
            <Text type="danger" style={{ fontSize: '11px' }}>
              Out of Stock
            </Text>
          )
        } else if (isLowStock) {
          return (
            <Text type="warning" style={{ fontSize: '11px' }}>
              Low Stock
            </Text>
          )
        } else {
          return (
            <Text type="success" style={{ fontSize: '11px' }}>
              In Stock
            </Text>
          )
        }
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: unknown, record: VariantType) => (
        <Button
          type="link"
          size="small"
          onClick={() => onDistributeStock(record)}
          style={{ padding: 0 }}
        >
          Distribute Stock
        </Button>
      ),
    },
  ]

  if (variants.length === 0) {
    return (
      <Alert
        message="No variants yet"
        description="Generate variants in the Variants tab to manage inventory here."
        type="warning"
        showIcon
        style={{ fontSize: '11px' }}
      />
    )
  }

  return (
    <Table
      key={variants.length}
      columns={columns}
      dataSource={variants}
      rowKey="id"
      pagination={false}
      size="small"
    />
  )
}

