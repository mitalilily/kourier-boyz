import { InfoCircleOutlined } from '@ant-design/icons'
import type { FormInstance } from 'antd'
import { Alert, InputNumber, Space, Table, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { createGstHsnColumns } from './GstHsnColumns'
import type { VariantType } from './types'
import { calculatePricing, calculateVariantDiscount } from './utils'

const { Text } = Typography

interface VariantPricingTableProps {
  form: FormInstance
  variants: Array<VariantType>
  onVariantsChange: (variants: Array<VariantType>) => void
  isGstRegistered: boolean
}

export default function VariantPricingTable({
  form,
  variants,
  onVariantsChange,
  isGstRegistered,
}: VariantPricingTableProps) {
  const updateVariantPricing = (variantId: string, field: string, value: unknown) => {
    const updatedVariants = variants.map((variant) => {
      if (variant.id === variantId) {
        const updated = { ...variant, [field]: value }

        // Auto-calculate discount when comparePrice or price changes
        if (field === 'comparePrice' || field === 'price') {
          const calculatedDiscount = calculateVariantDiscount(
            updated,
            field as 'price' | 'comparePrice',
            value as number,
          )
          updated.discountPercent = calculatedDiscount
        }

        return updated
      }
      return variant
    })
    onVariantsChange(updatedVariants)
  }

  const isGstApplicable = form.getFieldValue('isGstApplicable') || false
  const defaultIgst = form.getFieldValue('defaultIgstRatePercent')

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
      title: (
        <Space size={4}>
          MRP (₹) (excl of GST)
          <Tooltip title="Maximum Retail Price (MRP) excluding GST - the base selling price before GST is added">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price: number, record: VariantType) => (
        <InputNumber
          value={price || 0}
          min={0}
          style={{ width: '100%' }}
          size="small"
          onChange={(value) => updateVariantPricing(record.id, 'price', value || 0)}
        />
      ),
    },
    {
      title: (
        <Space size={4}>
          Cost Price (₹)
          <Tooltip title="Your cost to produce or acquire this variant. Used to calculate profit margin">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'costPrice',
      key: 'costPrice',
      width: 120,
      render: (costPrice: number, record: VariantType) => (
        <InputNumber
          value={costPrice || 0}
          min={0}
          style={{ width: '100%' }}
          size="small"
          onChange={(value) => updateVariantPricing(record.id, 'costPrice', value || 0)}
        />
      ),
    },
    {
      title: (
        <Space size={4}>
          Compare at Price (₹)
          <Tooltip title="Original price shown with strikethrough. If provided, discount is auto-calculated from this price. If not provided, discount applies to the MRP">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'comparePrice',
      key: 'comparePrice',
      width: 140,
      render: (comparePrice: number, record: VariantType) => (
        <InputNumber
          value={comparePrice || 0}
          min={0}
          style={{ width: '100%' }}
          size="small"
          onChange={(value) => updateVariantPricing(record.id, 'comparePrice', value || 0)}
        />
      ),
    },
    {
      title: (
        <Space size={4}>
          Discount on Selling Price(%)
          <Tooltip title="Discount percentage. Auto-calculated when Compare at Price is provided. Otherwise, manually set discount applies to the MRP">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      dataIndex: 'discountPercent',
      key: 'discountPercent',
      width: 120,
      render: (_discountPercent: number, record: VariantType) => {
        const hasComparePrice = (record.comparePrice || 0) > 0
        return (
          <InputNumber
            value={record.discountPercent ?? 0}
            min={0}
            max={100}
            style={{ width: '100%' }}
            size="small"
            precision={2}
            disabled={hasComparePrice}
            onChange={(value) => updateVariantPricing(record.id, 'discountPercent', value || 0)}
          />
        )
      },
    },
    {
      title: (
        <Space size={4}>
          Effective Selling Price (₹)
          <Tooltip title="The actual price customers will pay after discount is applied (inclusive of GST if applicable). If Compare at Price exists, discount applies to it. Otherwise, discount applies to MRP">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      key: 'effectivePrice',
      width: 130,
      render: (_: unknown, record: VariantType) => {
        const variantPrice = record.price || 0
        const variantComparePrice = record.comparePrice || 0
        const variantDiscount = record.discountPercent || 0
        const variantCost = record.costPrice || 0
        // Use only IGST for effective price calculation (not CGST + SGST)
        // IMPORTANT: For effective price, we only add IGST, not CGST + SGST
        // CGST and SGST are for accounting purposes only (intra-state transactions)
        // IGST is for inter-state transactions
        // Both represent the same total GST rate, so we use IGST only
        const variantIgst =
          (record as unknown as { igstRatePercent?: number }).igstRatePercent ??
          (record as unknown as { gstRatePercent?: number }).gstRatePercent ?? // Fallback to legacy field
          defaultIgst

        // Ensure we're using a valid number (not NaN or undefined)
        const variantTotalGst =
          variantIgst !== undefined && variantIgst !== null && !isNaN(variantIgst)
            ? Number(variantIgst)
            : undefined

        const { effectivePrice } = calculatePricing(
          variantPrice,
          variantCost,
          variantComparePrice,
          variantDiscount,
          isGstApplicable,
          variantTotalGst,
        )

        return (
          <div>
            <Text strong style={{ fontSize: '12px', color: '#1890ff' }}>
              ₹{effectivePrice.toFixed(2)}
              {isGstApplicable && variantTotalGst !== undefined && variantTotalGst !== null && (
                <span style={{ fontSize: '10px', color: '#8c8c8c', marginLeft: 4 }}>(incl. of GST)</span>
              )}
            </Text>
          </div>
        )
      },
    },
    {
      title: (
        <Space size={4}>
          Profit
          <Tooltip title="If Compare at Price exists: Profit = MRP - Cost Price. If Compare at Price doesn't exist and discount exists: Profit = Effective Price - Cost Price. Otherwise: Profit = MRP - Cost Price">
            <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
          </Tooltip>
        </Space>
      ),
      key: 'profit',
      width: 100,
      render: (_: unknown, record: VariantType) => {
        const variantPrice = record.price || 0
        const variantComparePrice = record.comparePrice || 0
        const variantDiscount = record.discountPercent || 0
        const variantCost = record.costPrice || 0

        const { profit } = calculatePricing(
          variantPrice,
          variantCost,
          variantComparePrice,
          variantDiscount,
          isGstApplicable,
          undefined,
        )

        return (
          <Text
            style={{
              color: profit >= 0 ? '#52c41a' : '#ff4d4f',
              fontSize: '12px',
            }}
          >
            ₹{profit.toFixed(2)}
          </Text>
        )
      },
    },
    // GST/HSN columns - only show if seller is GST registered
    ...(isGstRegistered ? createGstHsnColumns({ variants, onVariantsChange }) : []),
  ]

  if (variants.length === 0) {
    return (
      <Alert
        message="No variants yet"
        description="Generate variants in the Variants tab to edit pricing here."
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
      style={{ marginBottom: 12 }}
      scroll={{ x: 1200 }}
    />
  )
}
