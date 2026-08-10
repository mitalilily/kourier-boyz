import { Card, Table, Avatar, Tag, Spin, Empty, Button, Statistic, Segmented } from 'antd'
import {
  UserOutlined,
  BankOutlined,
  RightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import type { SettlementsData, SettlementItem } from '../../api/dashboard'

interface SettlementsTableProps {
  data?: SettlementsData
  loading?: boolean
  statusFilter: 'PENDING' | 'PAID' | ''
  onStatusFilterChange: (status: 'PENDING' | 'PAID' | '') => void
}

const SettlementsTable = ({
  data,
  loading,
  statusFilter,
  onStatusFilterChange,
}: SettlementsTableProps) => {
  const navigate = useNavigate()

  const columns = [
    {
      title: 'Seller',
      key: 'seller',
      render: (record: SettlementItem) => (
        <div className="flex items-center gap-3">
          <Avatar
            size="small"
            icon={<UserOutlined />}
            className="bg-blue-100 text-blue-600"
          />
          <div>
            <p className="font-medium text-gray-800 text-sm">
              {record.seller.businessName || record.seller.name}
            </p>
            {record.invoiceNumber && (
              <p className="text-xs text-gray-400">{record.invoiceNumber}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Period',
      key: 'period',
      render: (record: SettlementItem) => (
        <span className="text-sm text-gray-600">
          {dayjs(record.fromDate).format('MMM DD')} -{' '}
          {dayjs(record.toDate).format('MMM DD, YYYY')}
        </span>
      ),
    },
    {
      title: 'Orders',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
      align: 'center' as const,
      render: (value: number) => (
        <Tag color="blue">{value}</Tag>
      ),
    },
    {
      title: 'Payout Amount',
      dataIndex: 'totalNetPayout',
      key: 'totalNetPayout',
      align: 'right' as const,
      render: (value: number) => (
        <span className="font-semibold text-green-600">
          ₹{value.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center' as const,
      render: (status: 'PENDING' | 'PAID') => (
        <Tag
          icon={status === 'PAID' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          color={status === 'PAID' ? 'success' : 'warning'}
        >
          {status}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (record: SettlementItem) => (
        <Button
          type="text"
          size="small"
          icon={<RightOutlined />}
          onClick={() => navigate(`/settlements/${record._id}`)}
        />
      ),
    },
  ]

  // Calculate summary stats
  const pendingSummary = data?.summary?.pending || { count: 0, totalAmount: 0 }
  const paidSummary = data?.summary?.paid || { count: 0, totalAmount: 0 }

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <BankOutlined className="text-blue-500" />
          <span className="text-lg font-semibold">Settlement Payouts</span>
        </div>
      }
      extra={
        <Button type="link" size="small" onClick={() => navigate('/settlements')}>
          View All <RightOutlined />
        </Button>
      }
      className="h-full"
    >
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-gray-100">
            <div
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                statusFilter === 'PENDING' ? 'bg-amber-50 ring-2 ring-amber-200' : 'bg-gray-50 hover:bg-amber-50'
              }`}
              onClick={() => onStatusFilterChange(statusFilter === 'PENDING' ? '' : 'PENDING')}
            >
              <Statistic
                title={
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <ClockCircleOutlined /> Pending
                  </span>
                }
                value={pendingSummary.totalAmount}
                precision={0}
                prefix="₹"
                suffix={
                  <span className="text-xs text-gray-400 ml-1">
                    ({pendingSummary.count} batches)
                  </span>
                }
                valueStyle={{ fontSize: '18px', color: '#d97706' }}
              />
            </div>
            <div
              className={`p-3 rounded-lg cursor-pointer transition-all ${
                statusFilter === 'PAID' ? 'bg-green-50 ring-2 ring-green-200' : 'bg-gray-50 hover:bg-green-50'
              }`}
              onClick={() => onStatusFilterChange(statusFilter === 'PAID' ? '' : 'PAID')}
            >
              <Statistic
                title={
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircleOutlined /> Paid
                  </span>
                }
                value={paidSummary.totalAmount}
                precision={0}
                prefix="₹"
                suffix={
                  <span className="text-xs text-gray-400 ml-1">
                    ({paidSummary.count} batches)
                  </span>
                }
                valueStyle={{ fontSize: '18px', color: '#059669' }}
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="mb-4">
            <Segmented
              size="small"
              value={statusFilter || 'all'}
              onChange={(val) =>
                onStatusFilterChange(val === 'all' ? '' : (val as 'PENDING' | 'PAID'))
              }
              options={[
                { label: 'All', value: 'all' },
                { label: 'Pending', value: 'PENDING' },
                { label: 'Paid', value: 'PAID' },
              ]}
            />
          </div>

          {/* Table */}
          {!data?.settlements?.length ? (
            <Empty description="No settlement batches" />
          ) : (
            <Table
              dataSource={data.settlements}
              columns={columns}
              rowKey="_id"
              pagination={false}
              size="small"
              className="dashboard-table"
            />
          )}
        </>
      )}
    </Card>
  )
}

export default SettlementsTable

