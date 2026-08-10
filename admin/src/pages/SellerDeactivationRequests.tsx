import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PoweroffOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import API from '../api/axiosInstance'
import PermissionButton from '../components/PermissionButton'

const { Title, Text } = Typography
const { TextArea } = Input

interface DeactivationRequest {
  _id: string
  name: string
  email: string
  businessName?: string
  gstNumber?: string
  panNumber?: string
  isApproved: boolean
  kycSubmitted?: boolean
  bankVerified?: boolean
  deactivationRequestedAt: string
  deactivationReason?: string
  pendingOrders: number
  ledgerBalance: number
}

interface DeactivationRequestsResponse {
  requests: DeactivationRequest[]
}

/**
 * Fetch deactivation requests
 */
const fetchDeactivationRequests = async (): Promise<DeactivationRequestsResponse> => {
  const response = await API.get('/admin/sellers/deactivation/requests')
  return response.data
}

/**
 * Approve deactivation
 */
const approveDeactivation = async (sellerId: string) => {
  const response = await API.post(`/admin/sellers/deactivation/sellers/${sellerId}/approve-deactivation`)
  return response.data
}

/**
 * Reject deactivation
 */
const rejectDeactivation = async (sellerId: string, rejectionReason: string) => {
  const response = await API.post(`/admin/sellers/deactivation/sellers/${sellerId}/reject-deactivation`, {
    rejectionReason,
  })
  return response.data
}


const SellerDeactivationRequests = () => {
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [selectedSeller, setSelectedSeller] = useState<DeactivationRequest | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['deactivationRequests'],
    queryFn: fetchDeactivationRequests,
  })

  const approveMutation = useMutation({
    mutationFn: approveDeactivation,
    onSuccess: () => {
      message.success('Deactivation approved successfully')
      queryClient.invalidateQueries({ queryKey: ['deactivationRequests'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.error || 'Failed to approve deactivation')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ sellerId, rejectionReason }: { sellerId: string; rejectionReason: string }) =>
      rejectDeactivation(sellerId, rejectionReason),
    onSuccess: () => {
      message.success('Deactivation request rejected')
      setShowRejectModal(false)
      form.resetFields()
      setSelectedSeller(null)
      queryClient.invalidateQueries({ queryKey: ['deactivationRequests'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.error || 'Failed to reject deactivation')
    },
  })


  const handleApprove = (seller: DeactivationRequest) => {
    modal.confirm({
      title: 'Approve Deactivation',
      icon: <CheckCircleOutlined />,
      content: (
        <div>
          <p>Are you sure you want to approve the deactivation request for:</p>
          <p>
            <strong>{seller.businessName || seller.name}</strong> ({seller.email})
          </p>
          <p>This will permanently deactivate the seller account.</p>
        </div>
      ),
      okText: 'Approve',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        approveMutation.mutate(seller._id)
      },
    })
  }

  const handleReject = (seller: DeactivationRequest) => {
    setSelectedSeller(seller)
    setShowRejectModal(true)
  }

  const handleRejectSubmit = async (values: { rejectionReason: string }) => {
    if (!selectedSeller) return
    await rejectMutation.mutateAsync({
      sellerId: selectedSeller._id,
      rejectionReason: values.rejectionReason,
    })
  }


  const columns = [
    {
      title: 'Seller',
      key: 'seller',
      render: (_: any, record: DeactivationRequest) => (
        <div>
          <div>
            <Text strong>{record.businessName || record.name}</Text>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: 'KYC Status',
      key: 'kyc',
      render: (_: any, record: DeactivationRequest) => (
        <Space direction="vertical" size="small">
          <Tag color={record.isApproved ? 'green' : 'orange'}>
            {record.isApproved ? 'Approved' : 'Pending'}
          </Tag>
          {record.kycSubmitted && <Tag color="blue">KYC Submitted</Tag>}
          {record.bankVerified && <Tag color="green">Bank Verified</Tag>}
        </Space>
      ),
    },
    {
      title: 'Pending Orders',
      dataIndex: 'pendingOrders',
      key: 'pendingOrders',
      render: (count: number) => (
        <Tag color={count > 0 ? 'orange' : 'green'}>{count}</Tag>
      ),
    },
    {
      title: 'Ledger Balance',
      dataIndex: 'ledgerBalance',
      key: 'ledgerBalance',
      render: (balance: number) => (
        <Text strong style={{ color: balance === 0 ? '#52c41a' : '#ff4d4f' }}>
          ₹{balance.toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Requested At',
      dataIndex: 'deactivationRequestedAt',
      key: 'deactivationRequestedAt',
      render: (date: string) => new Date(date).toLocaleDateString('en-IN'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: DeactivationRequest) => (
        <Space>
          <PermissionButton
            type="primary"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => handleApprove(record)}
            loading={approveMutation.isPending}
            module="sellerManagement"
            permission="approve"
          >
            Approve
          </PermissionButton>
          <PermissionButton
            danger
            size="small"
            icon={<CloseCircleOutlined />}
            onClick={() => handleReject(record)}
            loading={rejectMutation.isPending}
            module="sellerManagement"
            permission="approve"
          >
            Reject
          </PermissionButton>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3}>
              <PoweroffOutlined /> Seller Deactivation Requests
            </Title>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Refresh
            </Button>
          </div>

          {data?.requests && data.requests.length === 0 ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">No pending deactivation requests</Text>
              </div>
            </Card>
          ) : (
            <Table
              columns={columns}
              dataSource={data?.requests || []}
              loading={isLoading}
              rowKey="_id"
              expandable={{
                expandedRowRender: (record: DeactivationRequest) => (
                  <Card size="small" style={{ margin: '16px 0' }}>
                    <Descriptions column={2} bordered size="small">
                      <Descriptions.Item label="Business Name">
                        {record.businessName || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="GST Number">
                        {record.gstNumber || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="PAN Number">
                        {record.panNumber || 'N/A'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Pending Orders">
                        <Tag color={record.pendingOrders > 0 ? 'orange' : 'green'}>
                          {record.pendingOrders}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Ledger Balance" span={2}>
                        <Text strong style={{ color: record.ledgerBalance === 0 ? '#52c41a' : '#ff4d4f' }}>
                          ₹{record.ledgerBalance.toFixed(2)}
                        </Text>
                      </Descriptions.Item>
                      {record.deactivationReason && (
                        <Descriptions.Item label="Deactivation Reason" span={2}>
                          {record.deactivationReason}
                        </Descriptions.Item>
                      )}
                    </Descriptions>
                  </Card>
                ),
              }}
            />
          )}
        </Space>
      </Card>

      {/* Reject Modal */}
      <Modal
        title="Reject Deactivation Request"
        open={showRejectModal}
        onCancel={() => {
          setShowRejectModal(false)
          form.resetFields()
          setSelectedSeller(null)
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRejectSubmit}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="rejectionReason"
            label="Rejection Reason"
            rules={[
              { required: true, message: 'Please provide a rejection reason' },
              { min: 10, message: 'Reason must be at least 10 characters' },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Explain why the deactivation request is being rejected..."
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button
                type="primary"
                danger
                htmlType="submit"
                loading={rejectMutation.isPending}
                icon={<CloseCircleOutlined />}
              >
                Reject Request
              </Button>
              <Button
                onClick={() => {
                  setShowRejectModal(false)
                  form.resetFields()
                  setSelectedSeller(null)
                }}
                disabled={rejectMutation.isPending}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SellerDeactivationRequests

