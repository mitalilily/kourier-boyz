import { ArrowLeftOutlined, BlockOutlined, UnlockOutlined } from '@ant-design/icons'
import { App, Button, Card, Descriptions, Input, Space, Spin, Tag, Typography } from 'antd'
import dayjs from 'dayjs'
import { useNavigate, useParams } from 'react-router-dom'
import { useCustomer, useUpdateCustomerStatus } from '../api/customers'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'

const { Title } = Typography

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const { data: customer, isLoading, error, refetch } = useCustomer(id || '')
  const updateStatus = useUpdateCustomerStatus()

  const handleBlock = (block: boolean) => {
    if (!id || !customer) return

    if (block) {
      let blockedReason = ''
      modal.confirm({
        title: 'Block Customer',
        icon: <BlockOutlined />,
        content: (
          <div>
            <p style={{ marginBottom: 16 }}>Are you sure you want to block {customer.name}?</p>
            <Input.TextArea
              rows={3}
              placeholder="Reason for blocking (optional)..."
              onChange={(e) => (blockedReason = e.target.value)}
              style={{ marginTop: '8px' }}
            />
          </div>
        ),
        okText: 'Block',
        okType: 'danger',
        onOk: () => {
          updateStatus.mutate(
            { id, isBlocked: true, blockedReason },
            {
              onSuccess: () => {
                message.success('Customer blocked successfully')
                refetch()
              },
              onError: () => message.error('Failed to block customer'),
            },
          )
        },
      })
    } else {
      modal.confirm({
        title: 'Unblock Customer',
        icon: <UnlockOutlined />,
        content: `Are you sure you want to unblock ${customer.name}?`,
        onOk: () => {
          updateStatus.mutate(
            { id, isBlocked: false },
            {
              onSuccess: () => {
                message.success('Customer unblocked successfully')
                refetch()
              },
              onError: () => message.error('Failed to unblock customer'),
            },
          )
        },
      })
    }
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <Card title="Customer Details">
        <p>Error loading customer details or customer not found.</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Card>
    )
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            Customer Details: {customer.name}
          </Title>
        </div>
      }
      extra={
        <PermissionGate module="customerManagement" permission="update">
          <Space>
            {customer.isBlocked ? (
              <PermissionButton
                module="customerManagement"
                permission="update"
                type="primary"
                icon={<UnlockOutlined />}
                onClick={() => handleBlock(false)}
                loading={updateStatus.isPending}
              >
                Unblock Customer
              </PermissionButton>
            ) : (
              <PermissionButton
                module="customerManagement"
                permission="update"
                danger
                icon={<BlockOutlined />}
                onClick={() => handleBlock(true)}
                loading={updateStatus.isPending}
              >
                Block Customer
              </PermissionButton>
            )}
          </Space>
        </PermissionGate>
      }
    >
      <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} layout="vertical">
        <Descriptions.Item label="Name">{customer.name}</Descriptions.Item>
        <Descriptions.Item label="Email">{customer.email}</Descriptions.Item>
        <Descriptions.Item label="Phone">{customer.phone || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="Status">
          {customer.isBlocked ? (
            <Tag color="red">Blocked</Tag>
          ) : (
            <Tag color="green">Active</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Email Verified">
          {customer.isEmailVerified ? (
            <Tag color="green">Verified</Tag>
          ) : (
            <Tag color="default">Not Verified</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Phone Verified">
          {customer.isPhoneVerified ? (
            <Tag color="cyan">Verified</Tag>
          ) : (
            <Tag color="default">Not Verified</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Created At">
          {customer.createdAt ? dayjs(customer.createdAt).format('YYYY-MM-DD HH:mm') : 'N/A'}
        </Descriptions.Item>
        <Descriptions.Item label="Last Updated">
          {customer.updatedAt ? dayjs(customer.updatedAt).format('YYYY-MM-DD HH:mm') : 'N/A'}
        </Descriptions.Item>
        {customer.isBlocked && (
          <>
            <Descriptions.Item label="Blocked At">
              {customer.blockedAt
                ? dayjs(customer.blockedAt).format('YYYY-MM-DD HH:mm')
                : 'N/A'}
            </Descriptions.Item>
            <Descriptions.Item label="Block Reason" span={2}>
              {customer.blockedReason || 'N/A'}
            </Descriptions.Item>
          </>
        )}
        {(customer.addressLine1 || customer.city || customer.state) && (
          <>
            <Descriptions.Item label="Address" span={3}>
              {[
                customer.addressLine1,
                customer.addressLine2,
                customer.city,
                customer.state,
                customer.postalCode,
                customer.country,
              ]
                .filter(Boolean)
                .join(', ')}
            </Descriptions.Item>
          </>
        )}
      </Descriptions>

      {/* Order History Section - Will be implemented when orders are available */}
      <Card style={{ marginTop: 16 }} title="Order History">
        <p style={{ color: '#999' }}>Order history will be displayed here once order management is implemented.</p>
      </Card>

      {/* Activity Log Section - Future enhancement */}
      <Card style={{ marginTop: 16 }} title="Activity Log">
        <p style={{ color: '#999' }}>Activity log will be displayed here as a future enhancement.</p>
      </Card>
    </Card>
  )
}

export default CustomerDetail

