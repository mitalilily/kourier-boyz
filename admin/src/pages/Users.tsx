import {
  BarChartOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import API from '../api/axiosInstance'
import type { UserFilters } from '../api/users'
import { useDeleteUser, useUpdateUser, useUsers } from '../api/users'
import PermissionButton from '../components/PermissionButton'
import { useActionPermissions } from '../hooks/useActionPermissions'
import { useAuthStore } from '../store/authStore'

const { Title, Text } = Typography

interface User {
  _id: string
  name: string
  email: string
  role: string
  phone?: string
  roles?: Array<{ _id: string; name: string; description?: string }>

  // Business / Store Information
  businessName?: string
  storeLogo?: string
  businessType?: string
  businessRegistrationNumber?: string
  dateOfEstablishment?: string
  storeDescription?: string

  // Business Address
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string

  // Tax & Legal
  panNumber?: string
  gstNumber?: string
  businessCertificate?: string
  gstCertificate?: string
  idProof?: string

  isApproved: boolean
  kycSubmitted?: boolean
  rejectionReason?: string
  isEmailVerified: boolean
  createdAt: string
  sellerLifecycleStatus?: 'ACTIVE' | 'DEACTIVATION_REQUESTED' | 'DEACTIVATED'
  deactivatedAt?: string
}

const Users = () => {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const currentUserId = useAuthStore((state) => state.userId)
  const actionPermissions = useActionPermissions('sellerManagement')

  const [activeTab, setActiveTab] = useState('all')
  const [filters, setFilters] = useState<UserFilters>({
    role: 'seller',
  })

  // Build filters based on active tab
  const activeFilters = useMemo(() => {
    const baseFilters = { ...filters, role: 'seller' }

    switch (activeTab) {
      case 'pending-sellers':
        return { ...baseFilters, kycStatus: 'pending' }
      case 'approved-sellers':
        return { ...baseFilters, kycStatus: 'approved' }
      case 'rejected-sellers':
        return { ...baseFilters, kycStatus: 'rejected' }
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { kycStatus, ...rest } = baseFilters
        return rest
      }
    }
  }, [filters, activeTab])

  const { data: users, isLoading } = useUsers(activeFilters)

  // Filter out current admin from results
  const filteredUsers = useMemo(() => {
    if (!users) return []
    return users.filter((u: User) => u._id !== currentUserId)
  }, [users, currentUserId])

  // Count for badges (from total users data)
  const { data: allSellers } = useUsers({ role: 'seller' })

  const pendingCount = useMemo(() => {
    if (!allSellers) return 0
    return allSellers.filter(
      (u: User) => u.role === 'seller' && u.kycSubmitted && !u.isApproved && !u.rejectionReason,
    ).length
  }, [allSellers])

  const rejectedCount = useMemo(() => {
    if (!allSellers) return 0
    return allSellers.filter((u: User) => u.role === 'seller' && u.rejectionReason).length
  }, [allSellers])

  // Reactivate seller mutation
  const reactivateMutation = useMutation({
    mutationFn: async (sellerId: string) => {
      const response = await API.post(`/admin/sellers/deactivation/sellers/${sellerId}/reactivate`)
      return response.data
    },
    onSuccess: () => {
      message.success('Seller reactivated successfully')
      queryClient.invalidateQueries({ queryKey: ['sellers'] })
      queryClient.invalidateQueries({ queryKey: ['allUsers'] })
    },
    onError: (error: unknown) => {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined
      message.error(errorMessage || 'Failed to reactivate seller')
    },
  })

  const handleReactivate = (sellerId: string, sellerName: string) => {
    modal.confirm({
      title: 'Reactivate Seller Account',
      icon: <ReloadOutlined />,
      content: (
        <div>
          <p>Are you sure you want to reactivate the account for:</p>
          <p>
            <strong>{sellerName}</strong>
          </p>
          <p>
            The seller's account will be set to 'ACTIVE', but their store will remain 'inactive'.
            They will need to manually re-enable their store from their profile settings.
          </p>
        </div>
      ),
      okText: 'Reactivate',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: () => {
        reactivateMutation.mutate(sellerId)
      },
    })
  }

  const handleApproval = (userId: string, isApproved: boolean, userName: string) => {
    if (isApproved) {
      // Direct approval
      modal.confirm({
        title: 'Approve Seller',
        content: `Are you sure you want to approve ${userName}? They will receive an email and gain access to the seller panel.`,
        onOk: () => {
          updateUser.mutate(
            { id: userId, data: { isApproved } },
            {
              onSuccess: () => message.success('Seller approved successfully! Email sent.'),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onError: (err: any) =>
                message.error(err.response?.data?.error || 'Failed to approve seller'),
            },
          )
        },
      })
    } else {
      // Rejection with reason
      let rejectionReason = ''
      modal.confirm({
        title: 'Reject Seller KYC',
        content: (
          <div>
            <p style={{ marginBottom: 16 }}>
              Please provide a reason for rejecting {userName}'s KYC application:
            </p>
            <Input.TextArea
              rows={4}
              placeholder="Enter reason for rejection (will be sent via email)..."
              onChange={(e) => (rejectionReason = e.target.value)}
            />
          </div>
        ),
        onOk: () => {
          if (!rejectionReason?.trim()) {
            message.error('Please provide a rejection reason')
            return Promise.reject()
          }
          updateUser.mutate(
            { id: userId, data: { isApproved: false, rejectionReason } },
            {
              onSuccess: () => message.success('Seller rejected. Email sent with reason.'),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onError: (err: any) =>
                message.error(err.response?.data?.error || 'Failed to reject seller'),
            },
          )
        },
      })
    }
  }

  const handleDelete = (id: string, name: string) => {
    modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to delete ${name}?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        deleteUser.mutate(id, {
          onSuccess: () => message.success('User deleted'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onError: (err: any) => message.error(err.response?.data?.error || 'Delete failed'),
        })
      },
    })
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (_: unknown, r: User) => <Link to={`/sellers/${r._id}`}>{r.name}</Link>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: 250,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (phone: string) => phone || '-',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => {
        const colors: Record<string, string> = {
          'super-admin': 'red',
          seller: 'blue',
          user: 'green',
        }
        return <Tag color={colors[role]}>{role.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Business Name',
      dataIndex: 'businessName',
      key: 'businessName',
      width: 200,
      render: (businessName: string) => businessName || '-',
    },
    {
      title: 'GST Number',
      dataIndex: 'gstNumber',
      key: 'gstNumber',
      width: 180,
      render: (gstNumber: string) => gstNumber || '-',
    },
    {
      title: 'Status',
      key: 'status',
      width: 200,
      render: (_: unknown, record: User) => (
        <Space direction="vertical" size="small">
          {record.role === 'seller' && (
            <>
              {record.sellerLifecycleStatus === 'DEACTIVATED' && <Tag color="red">Deactivated</Tag>}
              {record.sellerLifecycleStatus === 'DEACTIVATION_REQUESTED' && (
                <Tag color="orange">Deactivation Pending</Tag>
              )}
              {(!record.sellerLifecycleStatus || record.sellerLifecycleStatus === 'ACTIVE') && (
                <Tag
                  color={
                    record.isApproved ? 'success' : record.kycSubmitted ? 'warning' : 'default'
                  }
                >
                  {record.isApproved
                    ? 'Approved'
                    : record.kycSubmitted
                    ? 'Pending Approval'
                    : 'KYC Not Submitted'}
                </Tag>
              )}
            </>
          )}
          {record.role !== 'seller' && <Tag color="success">Active</Tag>}
          <Tag color={record.isEmailVerified ? 'success' : 'default'}>
            {record.isEmailVerified ? 'Email Verified' : 'Email Unverified'}
          </Tag>
        </Space>
      ),
    },
    ...(actionPermissions.hasAnyAction
      ? [
          {
            title: 'Actions',
            key: 'actions',
            width: 200,
            fixed: 'right' as const,
            render: (_: unknown, record: User) => (
              <Space>
                {record.role === 'seller' && record.isApproved && (
                  <Tooltip title="View Reports">
                    <Button
                      type="default"
                      size="small"
                      icon={<BarChartOutlined />}
                      onClick={() => navigate(`/sellers/${record._id}/reports`)}
                    >
                      <span />
                    </Button>
                  </Tooltip>
                )}
                {record.role === 'seller' && record.sellerLifecycleStatus === 'DEACTIVATED' && (
                  <Tooltip title="Reactivate Seller">
                    <PermissionButton
                      module="sellerManagement"
                      permission="update"
                      type="primary"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => handleReactivate(record._id, record.name)}
                      loading={reactivateMutation.isPending}
                    >
                      Reactivate
                    </PermissionButton>
                  </Tooltip>
                )}
                {record.role === 'seller' && !record.isApproved && record.kycSubmitted && (
                  <>
                    <Tooltip title="Approve Seller">
                      <PermissionButton
                        module="sellerManagement"
                        permission="approve"
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => handleApproval(record._id, true, record.name)}
                        loading={updateUser.isPending}
                      >
                        <span />
                      </PermissionButton>
                    </Tooltip>
                    <Tooltip title="Reject Seller">
                      <PermissionButton
                        module="sellerManagement"
                        permission="approve"
                        danger
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => handleApproval(record._id, false, record.name)}
                        loading={updateUser.isPending}
                      >
                        <span />
                      </PermissionButton>
                    </Tooltip>
                  </>
                )}
                {record.role === 'seller' && !record.isApproved && !record.kycSubmitted && (
                  <Tooltip title="Cannot approve - KYC not submitted yet">
                    <Button type="default" size="small" disabled icon={<CheckOutlined />}>
                      Awaiting KYC
                    </Button>
                  </Tooltip>
                )}
                {record.role === 'seller' && record.isApproved && (
                  <Tooltip title="Revoke Approval">
                    <PermissionButton
                      module="sellerManagement"
                      permission="update"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => handleApproval(record._id, false, record.name)}
                      loading={updateUser.isPending}
                    >
                      <span />
                    </PermissionButton>
                  </Tooltip>
                )}
                <Tooltip title="Delete User">
                  <PermissionButton
                    module="sellerManagement"
                    permission="delete"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(record._id, record.name)}
                    loading={deleteUser.isPending}
                  >
                    <span />
                  </PermissionButton>
                </Tooltip>
              </Space>
            ),
          },
        ]
      : []),
  ]

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}

          {/* Filters */}
          <Card size="small" style={{ background: '#fafafa' }}>
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} lg={8}>
                <Input
                  placeholder="Search by name, email, business, phone..."
                  prefix={<SearchOutlined />}
                  allowClear
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  style={{ width: '100%' }}
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Select
                  placeholder="Business Type"
                  allowClear
                  style={{ width: '100%' }}
                  value={filters.businessType}
                  onChange={(value) => setFilters({ ...filters, businessType: value })}
                  options={[
                    { label: 'Individual', value: 'Individual' },
                    { label: 'Proprietorship', value: 'Proprietorship' },
                    { label: 'Partnership', value: 'Partnership' },
                    { label: 'Pvt Ltd', value: 'Pvt Ltd' },
                    { label: 'LLP', value: 'LLP' },
                    { label: 'Trust', value: 'Trust' },
                  ]}
                />
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Button
                  onClick={() => setFilters({ role: 'seller' })}
                  block
                  style={{ width: '100%' }}
                >
                  Clear Filters
                </Button>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Text type="secondary" style={{ fontSize: '13px' }}>
                  {filteredUsers.length} seller
                  {filteredUsers.length !== 1 ? 's' : ''} found
                </Text>
              </Col>
            </Row>
          </Card>

          {/* Tabs for filtering */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'all',
                label: 'All Sellers',
                children: null,
              },
              {
                key: 'pending-sellers',
                label: (
                  <Badge count={pendingCount} offset={[10, 0]}>
                    <span>Pending KYC</span>
                  </Badge>
                ),
                children: null,
              },
              {
                key: 'approved-sellers',
                label: 'Approved',
                children: null,
              },
              {
                key: 'rejected-sellers',
                label: (
                  <Badge count={rejectedCount} offset={[10, 0]} color="red">
                    <span>Rejected</span>
                  </Badge>
                ),
                children: null,
              },
            ]}
          />

          {/* Table */}
          <Table<User>
            rowKey="_id"
            columns={columns}
            dataSource={filteredUsers}
            loading={isLoading}
            scroll={{ x: 1600 }}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} sellers`,
            }}
            expandable={{
              expandedRowRender: (record) => {
                if (record.role !== 'seller') return null

                if (!record.kycSubmitted) {
                  return (
                    <Card size="small" style={{ background: '#fafafa' }}>
                      <Text type="secondary">KYC not yet submitted by this seller</Text>
                    </Card>
                  )
                }

                return (
                  <Card size="small" style={{ background: '#fafafa' }}>
                    <Title level={5}>Complete KYC Details</Title>

                    {/* Personal Information */}
                    <Descriptions
                      column={2}
                      size="small"
                      title="Personal Information"
                      bordered
                      style={{ marginBottom: 16 }}
                    >
                      <Descriptions.Item label="Full Name">{record.name}</Descriptions.Item>
                      <Descriptions.Item label="Email">{record.email}</Descriptions.Item>
                      <Descriptions.Item label="Phone">{record.phone || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Email Verified">
                        <Tag color={record.isEmailVerified ? 'success' : 'default'}>
                          {record.isEmailVerified ? 'Yes' : 'No'}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>

                    {/* Business / Store Information */}
                    <Descriptions
                      column={2}
                      size="small"
                      title="Business / Store Information"
                      bordered
                      style={{ marginBottom: 16 }}
                    >
                      <Descriptions.Item label="Business Name">
                        {record.businessName || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Business Type">
                        {record.businessType || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Registration Number">
                        {record.businessRegistrationNumber || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Date of Establishment">
                        {record.dateOfEstablishment
                          ? new Date(record.dateOfEstablishment).toLocaleDateString()
                          : '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Store Logo" span={2}>
                        {record.storeLogo ? (
                          <a href={record.storeLogo} target="_blank" rel="noopener noreferrer">
                            View Logo
                          </a>
                        ) : (
                          'Not Provided'
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="Store Description" span={2}>
                        {record.storeDescription || 'Not Provided'}
                      </Descriptions.Item>
                    </Descriptions>

                    {/* Business Address */}
                    <Descriptions
                      column={2}
                      size="small"
                      title="Business Address"
                      bordered
                      style={{ marginBottom: 16 }}
                    >
                      <Descriptions.Item label="Address Line 1">
                        {record.addressLine1 || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Address Line 2">
                        {record.addressLine2 || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="City">{record.city || '-'}</Descriptions.Item>
                      <Descriptions.Item label="State">{record.state || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Postal Code">
                        {record.postalCode || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Country">{record.country || '-'}</Descriptions.Item>
                    </Descriptions>

                    {/* Tax & Legal Information */}
                    <Descriptions
                      column={2}
                      size="small"
                      title="Tax & Legal Information"
                      bordered
                      style={{ marginBottom: 16 }}
                    >
                      <Descriptions.Item label="PAN Number">
                        {record.panNumber || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label="GST Number">
                        {record.gstNumber || 'Not Provided'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Business Certificate">
                        {record.businessCertificate ? (
                          <a
                            href={record.businessCertificate}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View Certificate
                          </a>
                        ) : (
                          '-'
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="GST Certificate">
                        {record.gstCertificate ? (
                          <a href={record.gstCertificate} target="_blank" rel="noopener noreferrer">
                            View Certificate
                          </a>
                        ) : (
                          'Not Provided'
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="ID Proof">
                        {record.idProof ? (
                          <a href={record.idProof} target="_blank" rel="noopener noreferrer">
                            View ID Proof
                          </a>
                        ) : (
                          '-'
                        )}
                      </Descriptions.Item>
                    </Descriptions>

                    {!record.isApproved && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          background: '#fff7e6',
                          borderRadius: 8,
                        }}
                      >
                        <Text type="warning">
                          ⚠️ This seller is awaiting KYC approval. Review all details above and
                          approve or reject accordingly.
                        </Text>
                      </div>
                    )}

                    {record.rejectionReason && (
                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          background: '#fff2f0',
                          borderRadius: 8,
                        }}
                      >
                        <Text type="danger">
                          ❌ <strong>Rejection Reason:</strong> {record.rejectionReason}
                        </Text>
                      </div>
                    )}
                  </Card>
                )
              },
              rowExpandable: (record) => record.role === 'seller',
            }}
          />
        </Space>
      </Card>
    </div>
  )
}

export default Users
