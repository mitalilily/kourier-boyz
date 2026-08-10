import {
  ArrowUpOutlined,
  EnvironmentOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Row,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useState } from 'react'
import type { CustomerFilters, SellerCustomer } from '../api/customers'
import { useSellerCustomerStats, useSellerCustomers } from '../api/customers'
import { useNavigate } from 'react-router-dom'

dayjs.extend(relativeTime)

const { Title, Text } = Typography

// Helper function to mask customer name (show first name + first letter of last name)
const maskCustomerName = (name: string): string => {
  if (!name) return 'Unknown'
  const nameParts = name.trim().split(/\s+/)
  if (nameParts.length === 1) {
    // Only one word, show first 3 characters + ***
    return nameParts[0].length > 3
      ? nameParts[0].substring(0, 3) + '***'
      : nameParts[0].charAt(0) + '***'
  }
  // Multiple words: show first name + first letter of last name
  const firstName = nameParts[0]
  const lastName = nameParts[nameParts.length - 1]
  return `${firstName} ${lastName.charAt(0)}.`
}

const Customers = () => {
  const [filters, setFilters] = useState<CustomerFilters>({})
  const [activeTab, setActiveTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const limit = 10
  const navigate = useNavigate()

  // Get stats from API
  const { data: stats, isLoading: isLoadingStats } = useSellerCustomerStats()

  // Get customers with filters from API
  const { data: customersData, isLoading: isLoadingCustomers } = useSellerCustomers({
    ...filters,
    tab: activeTab as CustomerFilters['tab'],
    page,
    limit,
  })

  const customers = customersData?.customers || []
  const pagination = customersData?.pagination

  // Update filters when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    setPage(1) // Reset to first page when changing tabs
  }

  const columns: ColumnsType<SellerCustomer> = [
    {
      title: 'Buyer Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (_: unknown, r: SellerCustomer) => (
        <Text style={{ fontWeight: 500 }}>{maskCustomerName(r.name)}</Text>
      ),
    },
    {
      title: 'City / State',
      key: 'location',
      width: 180,
      render: (_: unknown, r: SellerCustomer) => {
        const city = r.city || ''
        const state = r.state || ''
        if (!city && !state) return <Text type="secondary">-</Text>
        return <Text>{[city, state].filter(Boolean).join(', ')}</Text>
      },
    },
    {
      title: 'Total Orders',
      dataIndex: 'totalOrders',
      key: 'totalOrders',
      width: 120,
      align: 'center',
      render: (orders: number) =>
        orders !== undefined ? (
          <Tag color={orders > 0 ? 'blue' : 'default'}>{orders}</Tag>
        ) : (
          <Tag color="default">0</Tag>
        ),
      sorter: (a, b) => (a.totalOrders || 0) - (b.totalOrders || 0),
    },
    {
      title: 'Last Order Date',
      dataIndex: 'lastOrderDate',
      key: 'lastOrderDate',
      width: 150,
      render: (date: string) =>
        date ? (
          <Text>{dayjs(date).format('YYYY-MM-DD')}</Text>
        ) : (
          <Tag color="default">Never</Tag>
        ),
      sorter: (a, b) => {
        if (!a.lastOrderDate || !b.lastOrderDate) return 0
        return dayjs(a.lastOrderDate).valueOf() - dayjs(b.lastOrderDate).valueOf()
      },
    },
    {
      title: 'Total Revenue',
      dataIndex: 'totalSpent',
      key: 'totalSpent',
      width: 140,
      align: 'right',
      render: (spent: number) =>
        spent !== undefined && spent > 0 ? (
          <Text style={{ fontWeight: 600, color: '#52c41a' }}>
            ₹{spent.toLocaleString('en-IN')}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
      sorter: (a, b) => (a.totalSpent || 0) - (b.totalSpent || 0),
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (_: unknown, record: SellerCustomer) => (
        <Tag color={record.isBlocked ? 'error' : 'success'}>
          {record.isBlocked ? 'Blocked' : 'Active'}
        </Tag>
      ),
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>
              <TeamOutlined style={{ marginRight: 8, color: '#1890ff' }} /> My Customers
            </Title>
            <Text type="secondary">
              {pagination?.total || 0} customer{(pagination?.total || 0) !== 1 ? 's' : ''}
            </Text>
          </div>
        </Card>

        {/* Stats Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable loading={isLoadingStats}>
              <Statistic
                title="Total Customers"
                value={stats?.totalCustomers || 0}
                prefix={<UserOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable loading={isLoadingStats}>
              <Statistic
                title="Repeat Customers"
                value={stats?.repeatCustomers || 0}
                prefix={<TrophyOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
                suffix={
                  stats?.repeatCustomerPercentage !== undefined ? (
                    <span style={{ fontSize: 14, color: '#999' }}>
                      ({stats.repeatCustomerPercentage}%)
                    </span>
                  ) : null
                }
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable loading={isLoadingStats}>
              <Statistic
                title="New This Month"
                value={stats?.newThisMonth || 0}
                prefix={<ArrowUpOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card hoverable loading={isLoadingStats}>
              <Statistic
                title="Total Revenue"
                value={stats?.totalSpent || 0}
                precision={0}
                valueStyle={{ color: '#722ed1' }}
                prefix="₹"
              />
              {stats?.avgOrderValue && stats.avgOrderValue > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                  Avg: ₹{Math.round(stats.avgOrderValue).toLocaleString('en-IN')}
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Top Locations */}
        {((stats?.topCities && stats.topCities.length > 0) ||
          (stats?.topStates && stats.topStates.length > 0)) && (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <EnvironmentOutlined style={{ color: '#1890ff' }} />
                    <span>Top Cities</span>
                  </Space>
                }
                size="small"
                loading={isLoadingStats}
              >
                {stats?.topCities && stats.topCities.length > 0 ? (
                  <List
                    size="small"
                    dataSource={stats.topCities}
                    renderItem={(item, index) => (
                      <List.Item>
                        <Space>
                          <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : 'default'}>
                            #{index + 1}
                          </Tag>
                          <Text>{item.name}</Text>
                        </Space>
                        <Tag color="blue">{item.count} orders</Tag>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card
                title={
                  <Space>
                    <EnvironmentOutlined style={{ color: '#52c41a' }} />
                    <span>Top States</span>
                  </Space>
                }
                size="small"
                loading={isLoadingStats}
              >
                {stats?.topStates && stats.topStates.length > 0 ? (
                  <List
                    size="small"
                    dataSource={stats.topStates}
                    renderItem={(item, index) => (
                      <List.Item>
                        <Space>
                          <Tag color={index === 0 ? 'gold' : index === 1 ? 'silver' : 'default'}>
                            #{index + 1}
                          </Tag>
                          <Text>{item.name}</Text>
                        </Space>
                        <Tag color="green">{item.count} orders</Tag>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* Filters and Tabs */}
        <Card>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Filters */}
            <Card size="small" style={{ background: '#fafafa' }}>
              <Row gutter={[16, 16]} align="middle">
                <Col xs={24} sm={12} lg={8}>
                  <Input
                    placeholder="Search by name..."
                    prefix={<SearchOutlined />}
                    allowClear
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    style={{ width: '100%' }}
                    size="large"
                  />
                </Col>
                <Col xs={24} sm={12} lg={4}>
                  <Button
                    onClick={() => setFilters({})}
                    block
                    style={{ width: '100%' }}
                    size="large"
                  >
                    Clear Filters
                  </Button>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>
                    {pagination?.total || 0} customer{(pagination?.total || 0) !== 1 ? 's' : ''}{' '}
                    found
                  </Text>
                </Col>
              </Row>
            </Card>

            {/* Tabs */}
            <Tabs
              activeKey={activeTab}
              onChange={handleTabChange}
              items={[
                {
                  key: 'all',
                  label: (
                    <Badge count={stats?.totalCustomers || 0} offset={[10, 0]} showZero>
                      <span>All Customers</span>
                    </Badge>
                  ),
                  children: null,
                },
                {
                  key: 'top',
                  label: (
                    <Badge count={stats?.topCustomersCount || 0} offset={[10, 0]}>
                      <span>Top Customers</span>
                    </Badge>
                  ),
                  children: null,
                },
                {
                  key: 'repeat',
                  label: (
                    <Badge count={stats?.repeatCustomers || 0} offset={[10, 0]} color="green">
                      <span>Repeat Customers</span>
                    </Badge>
                  ),
                  children: null,
                },
                {
                  key: 'recent',
                  label: (
                    <Badge count={stats?.recentOrdersCount || 0} offset={[10, 0]}>
                      <span>Recent Orders</span>
                    </Badge>
                  ),
                  children: null,
                },
                {
                  key: 'new',
                  label: (
                    <Badge count={stats?.newThisMonth || 0} offset={[10, 0]} color="orange">
                      <span>New This Month</span>
                    </Badge>
                  ),
                  children: null,
                },
              ]}
            />

            {/* Table */}
            <Table<SellerCustomer>
              rowKey="_id"
              columns={columns}
              dataSource={customers}
              loading={isLoadingCustomers || isLoadingStats}
              scroll={{ x: 1000 }}
              onRow={(record) => ({
                onClick: () => navigate(`/customers/${record._id}`),
              })}
              pagination={{
                current: pagination?.page || 1,
                total: pagination?.total || 0,
                pageSize: pagination?.limit || limit,
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} customers`,
                onChange: (pageNum) => setPage(pageNum),
              }}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      activeTab === 'all' ? 'No customers found' : `No ${activeTab} customers found`
                    }
                  />
                ),
              }}
              expandable={{
                expandedRowRender: (record) => (
                  <Card size="small" style={{ background: '#fafafa' }}>
                    <Descriptions column={2} size="small" bordered>
                      <Descriptions.Item label="Total Orders">
                        {record.totalOrders !== undefined ? record.totalOrders : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Total Spent">
                        {record.totalSpent !== undefined
                          ? `₹${record.totalSpent.toLocaleString('en-IN')}`
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Last Order">
                        {record.lastOrderDate
                          ? dayjs(record.lastOrderDate).format('YYYY-MM-DD HH:mm')
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Joined">
                        {record.createdAt
                          ? dayjs(record.createdAt).format('YYYY-MM-DD HH:mm')
                          : '-'}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                ),
              }}
            />
          </Space>
        </Card>
      </Space>
    </div>
  )
}

export default Customers
