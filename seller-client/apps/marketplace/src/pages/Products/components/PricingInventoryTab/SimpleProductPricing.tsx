import { InfoCircleOutlined } from '@ant-design/icons'
import { Col, DatePicker, Form, InputNumber, Row, Space, Tooltip, Typography } from 'antd'
import type { FormInstance } from 'antd'
import { calculatePricing } from './utils'

const { Text } = Typography

interface SimpleProductPricingProps {
  form: FormInstance
  price: number
  costPrice: number
  discountPercent: number
  comparePrice: number
  onPriceChange: (value: number) => void
  onCostPriceChange: (value: number) => void
  onDiscountPercentChange: (value: number) => void
  onComparePriceChange: (value: number) => void
}

export default function SimpleProductPricing({
  form,
  price,
  costPrice,
  discountPercent,
  comparePrice,
  onPriceChange,
  onCostPriceChange,
  onDiscountPercentChange,
  onComparePriceChange,
}: SimpleProductPricingProps) {
  const isGstApplicable = form.getFieldValue('isGstApplicable') || false
  const igstRatePercent = form.getFieldValue('igstRatePercent')
  const totalGstRate = igstRatePercent

  const { effectivePrice, profit, margin } = calculatePricing(
    price,
    costPrice,
    comparePrice,
    discountPercent,
    isGstApplicable,
    totalGstRate,
  )

  return (
    <div>
      <Row gutter={[12, 8]}>
        <Col xs={24} md={8}>
          <Form.Item
            name="price"
            label={
              <Space size={4}>
                <span style={{ fontSize: '12px' }}>MRP (₹) (excl of GST)</span>
                <Tooltip title="Maximum Retail Price (MRP) excluding GST - the base selling price before GST is added">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#B78115' }} />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: 'Please enter MRP' }]}
            style={{ marginBottom: 12 }}
          >
            <InputNumber
              size="small"
              min={0}
              style={{ width: '100%' }}
              placeholder="0.00"
              onChange={(value) => onPriceChange(value || 0)}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="comparePrice"
            label={
              <Space size={4}>
                <span style={{ fontSize: '12px' }}>Compare at Price (₹)</span>
                <Tooltip title="Original price shown with strikethrough. If provided, discount is auto-calculated from this price. If not provided, discount applies to the MRP">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#B78115' }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 12 }}
          >
            <InputNumber
              size="small"
              min={0}
              style={{ width: '100%' }}
              placeholder="0.00"
              onChange={(value) => onComparePriceChange(value || 0)}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="costPrice"
            label={
              <Space size={4}>
                <span style={{ fontSize: '12px' }}>Cost Price (₹)</span>
                <Tooltip title="Your cost to produce or acquire this product. Used to calculate profit margin">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#B78115' }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 12 }}
          >
            <InputNumber
              size="small"
              min={0}
              style={{ width: '100%' }}
              placeholder="0.00"
              onChange={(value) => onCostPriceChange(value || 0)}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="discountPercent"
            label={
              <Space size={4}>
                <span style={{ fontSize: '12px' }}>Discount (%)</span>
                <Tooltip
                  title={
                    comparePrice > 0
                      ? 'Discount is auto-calculated from Compare at Price and MRP. To change discount, adjust the MRP or Compare at Price.'
                      : 'Manually set discount percentage that applies to the MRP'
                  }
                >
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#B78115' }} />
                </Tooltip>
              </Space>
            }
            style={{ marginBottom: 12 }}
          >
            <InputNumber
              size="small"
              min={0}
              max={100}
              precision={2}
              style={{ width: '100%' }}
              placeholder="0"
              disabled={comparePrice > 0}
              onChange={(value) => onDiscountPercentChange(value || 0)}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="discountStartDate"
            label={<span style={{ fontSize: '12px' }}>Discount Start Date</span>}
            style={{ marginBottom: 12 }}
          >
            <DatePicker
              size="small"
              style={{ width: '100%' }}
              placeholder="Select start date"
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="discountEndDate"
            label={<span style={{ fontSize: '12px' }}>Discount End Date</span>}
            style={{ marginBottom: 0 }}
          >
            <DatePicker
              size="small"
              style={{ width: '100%' }}
              placeholder="Select end date"
            />
          </Form.Item>
        </Col>
      </Row>

      {/* Live Pricing Insights */}
      {(price > 0 || costPrice > 0) && (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: 6,
          }}
        >
          <Text strong style={{ color: '#389e0d', fontSize: '13px' }}>
            💰 Live Pricing Insights
          </Text>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div
              style={{
                padding: '6px 10px',
                backgroundColor: '#e6f7ff',
                borderRadius: 4,
                border: '1px solid #91d5ff',
              }}
            >
              <Text style={{ color: '#B78115', fontWeight: 500, fontSize: '12px' }}>
                Effective Selling Price: ₹{effectivePrice.toFixed(2)}
                {isGstApplicable && (
                  <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: 4 }}>
                    (incl. of GST)
                  </span>
                )}
              </Text>
            </div>
            <div
              style={{
                padding: '6px 10px',
                backgroundColor: profit >= 0 ? '#f6ffed' : '#fff2f0',
                borderRadius: 4,
                border: `1px solid ${profit >= 0 ? '#b7eb8f' : '#ffccc7'}`,
              }}
            >
              <Text
                style={{
                  color: profit >= 0 ? '#52c41a' : '#ff4d4f',
                  fontWeight: 600,
                  fontSize: '12px',
                }}
              >
                Profit: ₹{profit.toFixed(2)}
              </Text>
            </div>
            <div
              style={{
                padding: '6px 10px',
                backgroundColor: margin >= 0 ? '#f6ffed' : '#fff2f0',
                borderRadius: 4,
                border: `1px solid ${margin >= 0 ? '#b7eb8f' : '#ffccc7'}`,
              }}
            >
              <Text
                style={{
                  color: margin >= 0 ? '#52c41a' : '#ff4d4f',
                  fontWeight: 600,
                  fontSize: '12px',
                }}
              >
                Margin: {margin.toFixed(1)}%
              </Text>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

