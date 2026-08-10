import { Card, Empty, Progress, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { SellerHealthItem } from '../../api/dashboard'

interface SellerHealthTableProps {
  data?: SellerHealthItem[]
  loading?: boolean
}

const getHealthTag = (score: number) => {
  if (score >= 90) return { color: 'green', text: 'Excellent' }
  if (score >= 75) return { color: 'blue', text: 'Good' }
  if (score >= 60) return { color: 'orange', text: 'Average' }
  return { color: 'red', text: 'Poor' }
}

const SellerHealthTable = ({ data, loading }: SellerHealthTableProps) => {
  const columns: ColumnsType<SellerHealthItem> = [
    {
      title: 'Seller',
      key: 'seller',
      render: (record) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-800 text-sm">
            {record.businessName || record.sellerName}
          </span>
          {record.email && <span className="text-xs text-gray-400">{record.email}</span>}
        </div>
      ),
    },
    {
      title: 'Health Score',
      dataIndex: 'healthScore',
      key: 'healthScore',
      width: 180,
      render: (score: number) => {
        const tag = getHealthTag(score)
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm">{score}/100</span>
              <Tag color={tag.color} className="text-xs">
                {tag.text}
              </Tag>
            </div>
            <Progress percent={score} size="small" showInfo={false} />
          </div>
        )
      },
    },
    {
      title: 'Orders',
      dataIndex: 'totalOrders',
      key: 'totalOrders',
      width: 100,
    },
    {
      title: 'Return Rate',
      dataIndex: 'returnRate',
      key: 'returnRate',
      width: 120,
      render: (value: number) => <span>{value}%</span>,
    },
  ]

  return (
    <Card
      title={<span className="text-lg font-semibold">Seller Health Scores</span>}
      className="h-full"
      extra={
        <span className="text-xs text-gray-400">
          Combines return rate and order volume into a 0–100 score
        </span>
      }
    >
      <Table<SellerHealthItem>
        dataSource={data}
        columns={columns}
        loading={loading}
        rowKey="sellerId"
        pagination={false}
        locale={{
          emptyText: (
            <Empty description="No seller health data available for this period" />
          ),
        }}
        size="small"
      />
    </Card>
  )
}

export default SellerHealthTable


