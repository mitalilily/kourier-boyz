import { CheckCircleOutlined, ClockCircleOutlined, DownloadOutlined, RightOutlined } from '@ant-design/icons'
import { Badge, Button, Card, Col, Divider, Row, Space, Statistic, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import type { DashboardOverview } from '../../../api/dashboard'

const { Text } = Typography

interface SettlementSnapshotProps {
  data: DashboardOverview | undefined
  loading: boolean
}

const SettlementSnapshot = ({ data, loading }: SettlementSnapshotProps) => {
  const navigate = useNavigate()

  if (!data?.lastSettlement && !data?.upcomingSettlement) return null

  return (
    <Card
      loading={loading}
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#F7F2E5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircleOutlined style={{ color: '#B78115', fontSize: 16 }} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Settlement Snapshot</span>
          </div>
          <Button
            type="link"
            onClick={() => navigate('/settlements')}
            icon={<RightOutlined />}
            style={{ padding: 0, fontWeight: 500 }}
          >
            View All
          </Button>
        </div>
      }
      style={{
        marginBottom: 0,
        borderRadius: 12,
        border: '1px solid #e8e8e8',
        boxShadow: 'none',
      }}
      bodyStyle={{ padding: '24px' }}
    >
      <Row gutter={[16, 16]}>
        {/* Last Settlement */}
        {data?.lastSettlement && (
          <Col xs={24} md={12}>
            <div
              style={{
                padding: '24px',
                background: '#F7F2E5',
                borderRadius: 12,
                border: '1px solid #D9DCDA',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#B78115',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircleOutlined style={{ fontSize: 20, color: 'white' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <Text strong style={{ fontSize: 15, color: '#B78115', display: 'block' }}>
                    Last Settlement
                  </Text>
                  <Badge
                    status="success"
                    text={<Text style={{ fontSize: 11, color: '#52c41a', fontWeight: 600 }}>PAID</Text>}
                  />
                </div>
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <Statistic
                  value={Math.abs(data.lastSettlement.amount)}
                  prefix="₹"
                  valueStyle={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: '#B78115',
                    marginBottom: 20,
                    lineHeight: '38px',
                  }}
                  precision={2}
                />

                <Divider style={{ margin: '16px 0', borderColor: '#D9DCDA' }} />

                <Space direction="vertical" size={10} style={{ width: '100%', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                      Paid Date
                    </Text>
                    <Text strong style={{ fontSize: 13, color: '#333' }}>
                      {data.lastSettlement.paidDate
                        ? new Date(data.lastSettlement.paidDate).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </Text>
                  </div>

                  {data.lastSettlement.invoiceNumber && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                        Invoice #
                      </Text>
                      <Text strong style={{ fontSize: 13, color: '#333' }}>
                        {data.lastSettlement.invoiceNumber}
                      </Text>
                    </div>
                  )}
                </Space>

                {data.lastSettlement.invoiceUrl && (
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    size="middle"
                    block
                    style={{
                      marginTop: 20,
                      height: 40,
                      borderRadius: 10,
                      fontWeight: 500,
                    }}
                    onClick={() => {
                      window.open(data.lastSettlement?.invoiceUrl || '', '_blank')
                    }}
                  >
                    Download Invoice
                  </Button>
                )}
              </div>
            </div>
          </Col>
        )}

        {/* Upcoming Settlement */}
        {data?.upcomingSettlement && (
          <Col xs={24} md={12}>
            <div
              style={{
                padding: '24px',
                background: '#fffce6',
                borderRadius: 12,
                border: '1px solid #ffe58f',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#DFB743',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ClockCircleOutlined style={{ fontSize: 20, color: 'white' }} />
                </div>
                <Text strong style={{ fontSize: 15, color: '#d48806' }}>
                  Upcoming Settlement
                </Text>
              </div>

              <div>
                <Statistic
                  value={data.upcomingSettlement.estimatedAmount}
                  prefix="₹"
                  valueStyle={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: '#d97706',
                    marginBottom: 6,
                    lineHeight: '38px',
                  }}
                  precision={2}
                />
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 20, fontWeight: 500 }}>
                  Estimated Amount
                </Text>

                <Divider style={{ margin: '16px 0', borderColor: '#ffe58f' }} />

                <Space direction="vertical" size={10} style={{ width: '100%', flex: 1 }}>
                  {data.upcomingSettlement.cutOffDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                        Cut-off Date
                      </Text>
                      <Text strong style={{ fontSize: 13, color: '#333' }}>
                        {new Date(data.upcomingSettlement.cutOffDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                      Expected Payout
                    </Text>
                    <Text strong style={{ fontSize: 13, color: '#d97706', fontWeight: 600 }}>
                      {new Date(data.upcomingSettlement.expectedPayoutDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </div>
                </Space>
              </div>
            </div>
          </Col>
        )}
      </Row>
    </Card>
  )
}

export default SettlementSnapshot

