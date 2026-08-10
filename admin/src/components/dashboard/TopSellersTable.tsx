import { Card, Table, Avatar, Tag, Spin, Empty, Button } from 'antd'
import { UserOutlined, TrophyOutlined, RightOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { TopSeller } from '../../api/dashboard'

interface TopSellersTableProps {
  data?: TopSeller[]
  loading?: boolean
}

const TopSellersTable = ({ data, loading }: TopSellersTableProps) => {
  const navigate = useNavigate()

  const columns = [
    {
      title: 'Rank',
      key: 'rank',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => {
        const colors = ['#ffd700', '#c0c0c0', '#cd7f32']
        return (
          <div className="flex items-center justify-center">
            {index < 3 ? (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors[index], color: '#fff' }}
              >
                <TrophyOutlined />
              </div>
            ) : (
              <span className="text-gray-500 font-medium">#{index + 1}</span>
            )}
          </div>
        )
      },
    },
    {
      title: 'Seller',
      key: 'seller',
      render: (record: TopSeller) => (
        <div className="flex items-center gap-3">
          <Avatar
            size="small"
            icon={<UserOutlined />}
            className="bg-indigo-100 text-indigo-600"
          />
          <div>
            <p className="font-medium text-gray-800 text-sm">
              {record.businessName || record.sellerName}
            </p>
            {record.businessName && (
              <p className="text-xs text-gray-400">{record.sellerName}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right' as const,
      render: (value: number) => (
        <span className="font-semibold text-green-600">
          ₹{value.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      title: 'Orders',
      dataIndex: 'orderCount',
      key: 'orderCount',
      align: 'center' as const,
      render: (value: number) => (
        <Tag color="blue">{value}</Tag>
      ),
    },
    {
      title: 'Items Sold',
      dataIndex: 'itemsSold',
      key: 'itemsSold',
      align: 'center' as const,
      render: (value: number) => (
        <span className="text-gray-600">{value}</span>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (record: TopSeller) => (
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
          <TrophyOutlined className="text-yellow-500" />
          <span className="text-lg font-semibold">Top Performing Sellers</span>
        </div>
      }
      extra={
        <Button type="link" size="small" onClick={() => navigate('/sellers')}>
          View All <RightOutlined />
        </Button>
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
          <Empty description="No seller data available" />
        </div>
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey="sellerId"
          pagination={false}
          size="small"
          className="dashboard-table"
        />
      )}
    </Card>
  )
}

export default TopSellersTable

