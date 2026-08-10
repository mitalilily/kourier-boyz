import { Card, Table, Avatar, Tag, Progress, Spin, Empty, Button, Tooltip } from 'antd'
import { UserOutlined, WarningOutlined, RightOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { HighReturnSeller } from '../../api/dashboard'

interface HighReturnSellersTableProps {
  data?: HighReturnSeller[]
  loading?: boolean
}

// Return rate thresholds for color coding
const getReturnRateColor = (rate: number): string => {
  if (rate >= 15) return '#ff4d4f' // Critical
  if (rate >= 10) return '#fa8c16' // Warning
  if (rate >= 5) return '#faad14' // Caution
  return '#52c41a' // Good
}

const getReturnRateStatus = (rate: number): { text: string; color: string } => {
  if (rate >= 15) return { text: 'Critical', color: 'red' }
  if (rate >= 10) return { text: 'High', color: 'orange' }
  if (rate >= 5) return { text: 'Moderate', color: 'gold' }
  return { text: 'Low', color: 'green' }
}

const HighReturnSellersTable = ({ data, loading }: HighReturnSellersTableProps) => {
  const navigate = useNavigate()

  const columns = [
    {
      title: 'Seller',
      key: 'seller',
      render: (record: HighReturnSeller) => (
        <div className="flex items-center gap-3">
          <Avatar
            size="small"
            icon={<UserOutlined />}
            className="bg-red-100 text-red-600"
          />
          <div>
            <p className="font-medium text-gray-800 text-sm">
              {record.businessName || record.sellerName}
            </p>
            {record.email && (
              <p className="text-xs text-gray-400 truncate max-w-[150px]">
                {record.email}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      title: (
        <Tooltip title="Percentage of orders that were returned">
          <span className="flex items-center gap-1">
            Return Rate <InfoCircleOutlined className="text-gray-400" />
          </span>
        </Tooltip>
      ),
      key: 'returnRate',
      width: 160,
      render: (record: HighReturnSeller) => {
        const status = getReturnRateStatus(record.returnRate)
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span
                className="font-semibold text-sm"
                style={{ color: getReturnRateColor(record.returnRate) }}
              >
                {record.returnRate}%
              </span>
              <Tag color={status.color} className="text-xs">
                {status.text}
              </Tag>
            </div>
            <Progress
              percent={Math.min(record.returnRate, 100)}
              size="small"
              showInfo={false}
              strokeColor={getReturnRateColor(record.returnRate)}
              trailColor="#f0f0f0"
            />
          </div>
        )
      },
    },
    {
      title: 'Returns / Orders',
      key: 'ratio',
      align: 'center' as const,
      render: (record: HighReturnSeller) => (
        <span className="text-gray-600">
          <span className="font-medium text-red-500">{record.returnCount}</span>
          <span className="text-gray-400 mx-1">/</span>
          <span className="font-medium">{record.totalOrders}</span>
        </span>
      ),
    },
    {
      title: 'Refund Amount',
      dataIndex: 'refundAmount',
      key: 'refundAmount',
      align: 'right' as const,
      render: (value: number) => (
        <span className="font-medium text-red-500">
          ₹{value.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (record: HighReturnSeller) => (
        <Button
          type="text"
          size="small"
          icon={<RightOutlined />}
          onClick={() => navigate(`/sellers/${record.sellerId}`)}
        />
      ),
    },
  ]

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <WarningOutlined className="text-red-500" />
          <span className="text-lg font-semibold">High Return Rate Sellers</span>
        </div>
      }
      extra={
        <Tooltip title="Sellers with minimum 5 orders are shown">
          <InfoCircleOutlined className="text-gray-400" />
        </Tooltip>
      }
      className="h-full"
      styles={{ body: { padding: 0 } }}
    >
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spin size="large" />
        </div>
      ) : !data?.length ? (
        <div className="h-64 flex items-center justify-center">
          <Empty
            description={
              <span className="text-gray-500">
                No sellers with high return rates
              </span>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey="sellerId"
          pagination={false}
          size="small"
          className="dashboard-table"
          rowClassName={(record) =>
            record.returnRate >= 15 ? 'bg-red-50' : ''
          }
        />
      )}
    </Card>
  )
}

export default HighReturnSellersTable

