import { TrophyOutlined } from '@ant-design/icons'
import { Card, Col, Empty, Image, Row, Segmented, Statistic, Typography } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DashboardOverview } from '../../../api/dashboard'

const { Text, Title } = Typography

interface TopSellingProductsProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const TopSellingProducts = ({ data, loading }: TopSellingProductsProps) => {
  const [period, setPeriod] = useState<'7days' | '30days'>('7days')
  const navigate = useNavigate()

  if (!data?.topSellingProducts) return null

  const products = period === '7days' ? data.topSellingProducts.last7Days : data.topSellingProducts.last30Days

  const handleProductClick = (productId: string) => {
    navigate(`/products/${productId}`)
  }

  return (
    <Card
      loading={loading}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#F7F2E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrophyOutlined style={{ color: '#B78115', fontSize: 18 }} />
            </div>
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              Top Selling Products
            </Title>
          </div>
          <Segmented
            options={[
              { label: '7 Days', value: '7days' },
              { label: '30 Days', value: '30days' },
            ]}
            value={period}
            onChange={(value) => setPeriod(value as '7days' | '30days')}
            size="small"
            style={{ background: '#f5f5f5' }}
          />
        </div>
      }
      style={{
        marginBottom: 24,
        borderRadius: 12,
        border: '1px solid #e8e8e8',
        boxShadow: 'none',
      }}
      bodyStyle={{ padding: '24px' }}
    >
      {products.length === 0 ? (
        <Empty
          description={
            <Text type="secondary">
              No sales in the last {period === '7days' ? '7' : '30'} days. Start adding products to see your top sellers!
            </Text>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {products.map((product, index) => (
            <Col xs={24} sm={12} lg={8} key={product.productId}>
              <Card
                hoverable
                onClick={() => handleProductClick(product.productId)}
                style={{
                  cursor: 'pointer',
                  border: index === 0 ? '2px solid #B78115' : '1px solid #e8e8e8',
                  borderRadius: 12,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                bodyStyle={{ padding: 20 }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  {product.productImage ? (
                    <Image
                      src={product.productImage}
                      alt={product.productName}
                      width={60}
                      height={60}
                      style={{ objectFit: 'cover', borderRadius: 4 }}
                      preview={false}
                    />
                  ) : (
                    <div
                      style={{
                        width: 60,
                        height: 60,
                        background: '#f0f0f0',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        No Image
                      </Text>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
                      {product.productName}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      SKU: {product.sku}
                    </Text>
                    {index === 0 && (
                      <div
                        style={{
                          display: 'inline-block',
                          background: '#B78115',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          marginTop: 4,
                        }}
                      >
                        #1 Best Seller
                      </div>
                    )}
                  </div>
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="Units Sold"
                      value={product.unitsSold}
                      valueStyle={{ fontSize: 18, fontWeight: 600, color: '#B78115' }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="Revenue"
                      value={product.revenue}
                      prefix="₹"
                      precision={0}
                      valueStyle={{ fontSize: 18, fontWeight: 600, color: '#B78115' }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      {products.length > 0 && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
            📌 Encourages catalog expansion. Add more products to grow your sales!
          </Text>
        </div>
      )}
    </Card>
  )
}

export default TopSellingProducts

