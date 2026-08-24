import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { MARKETPLACE_ADMIN_STORAGE } from '../config/authStorage'

const { Text } = Typography
const { TextArea } = Input

interface CategoryExtensionRequest {
  _id: string
  seller_id: {
    _id: string
    name: string
    email: string
    businessName?: string
  }
  brand_id: {
    _id: string
    brand_name: string
    brand_type: 'OWN' | 'OTHER'
    status: string
  }
  category_id: {
    _id: string
    name: string
    slug: string
  }
  reference_product_id?: {
    _id: string
    name: string
    slug: string
    status: string
  }
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NEED_MORE_DOCS'
  rejection_reason?: string
  reviewed_by?: {
    _id: string
    name: string
    email: string
  }
  reviewed_at?: string
  created_at: string
  updated_at: string
}

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PENDING: {
    color: 'orange',
    icon: <QuestionCircleOutlined />,
    label: 'Pending Review',
  },
  APPROVED: {
    color: 'green',
    icon: <CheckCircleOutlined />,
    label: 'Approved',
  },
  REJECTED: {
    color: 'red',
    icon: <CloseCircleOutlined />,
    label: 'Rejected',
  },
  NEED_MORE_DOCS: {
    color: 'volcano',
    icon: <QuestionCircleOutlined />,
    label: 'More Information Required',
  },
}

const CategoryExtensionRequests = () => {
  const [selectedRequest, setSelectedRequest] = useState<CategoryExtensionRequest | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'need_more_docs'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')

  const API_BASE = import.meta.env.VITE_API_URL?.replace('/seller', '') || 'http://localhost:5004/api'

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-category-extensions'],
    queryFn: async () => {
      const token = localStorage.getItem(MARKETPLACE_ADMIN_STORAGE.token)
      const response = await axios.get(`${API_BASE}/admin/category-extensions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      return response.data
    },
  })

  const requests: CategoryExtensionRequest[] = data || []

  const handleViewRequest = (request: CategoryExtensionRequest) => {
    setSelectedRequest(request)
    setModalOpen(true)
  }

  const handleAction = (request: CategoryExtensionRequest, type: 'approve' | 'reject' | 'need_more_docs') => {
    setSelectedRequest(request)
    setActionType(type)
    setRejectionReason('')
    setActionModalOpen(true)
  }

  const submitAction = async () => {
    if (!selectedRequest) return

    if (actionType === 'reject' && !rejectionReason.trim()) {
      message.error('Rejection reason is required')
      return
    }

    try {
      const token = localStorage.getItem(MARKETPLACE_ADMIN_STORAGE.token)
      const statusMap = {
        approve: 'APPROVED',
        reject: 'REJECTED',
        need_more_docs: 'NEED_MORE_DOCS',
      }

      await axios.patch(
        `${API_BASE}/admin/category-extensions/${selectedRequest._id}/status`,
        {
          status: statusMap[actionType],
          rejection_reason: actionType === 'reject' || actionType === 'need_more_docs' ? rejectionReason : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      )

      message.success(
        `Category extension request ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : 'marked as needing more information'} successfully`,
      )
      setActionModalOpen(false)
      setSelectedRequest(null)
      setRejectionReason('')
      refetch()
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: string } } }
      message.error(apiError.response?.data?.error || 'Failed to update category extension request status')
    }
  }

  const columns: ColumnsType<CategoryExtensionRequest> = [
    {
      title: 'Brand',
      key: 'brand',
      render: (_, record) => <Text strong>{record.brand_id.brand_name}</Text>,
    },
    {
      title: 'Category',
      key: 'category',
      render: (_, record) => <Text>{record.category_id.name}</Text>,
    },
    {
      title: 'Seller',
      key: 'seller',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.seller_id.businessName || record.seller_id.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.seller_id.email}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config = statusConfig[status] || statusConfig.PENDING
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: 'Reference Product',
      key: 'reference_product',
      render: (_, record) => {
        if (!record.reference_product_id) {
          return <Text type="secondary">N/A</Text>
        }
        return (
          <Text
            type="secondary"
            style={{ fontSize: 12 }}
            title={record.reference_product_id.name}
          >
            {record.reference_product_id.name.length > 30
              ? `${record.reference_product_id.name.substring(0, 30)}...`
              : record.reference_product_id.name}
          </Text>
        )
      },
    },
    {
      title: 'Requested',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewRequest(record)}>
            View
          </Button>
          {record.status === 'PENDING' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={() => handleAction(record, 'approve')}
              >
                Approve
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleAction(record, 'reject')}
              >
                Reject
              </Button>
              <Button
                size="small"
                icon={<QuestionCircleOutlined />}
                onClick={() => handleAction(record, 'need_more_docs')}
              >
                Need More Info
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card
        title="Category Extension Requests"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
        }
      >
        <Table<CategoryExtensionRequest>
          rowKey="_id"
          dataSource={requests}
          columns={columns}
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} requests`,
          }}
        />
      </Card>

      {/* Request Detail Modal */}
      <Modal
        title="Category Extension Request Details"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setSelectedRequest(null)
        }}
        width={800}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setModalOpen(false)
              setSelectedRequest(null)
            }}
          >
            Close
          </Button>,
        ]}
      >
        {selectedRequest && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Brand" span={2}>
                <Text strong>{selectedRequest.brand_id.brand_name}</Text>
                <Tag color={selectedRequest.brand_id.brand_type === 'OWN' ? 'blue' : 'purple'} style={{ marginLeft: 8 }}>
                  {selectedRequest.brand_id.brand_type === 'OWN' ? 'Own Brand' : 'Other Brand'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Category" span={2}>
                <Text strong>{selectedRequest.category_id.name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Seller Name" span={2}>
                {selectedRequest.seller_id.businessName || selectedRequest.seller_id.name}
              </Descriptions.Item>
              <Descriptions.Item label="Seller Email" span={2}>
                {selectedRequest.seller_id.email}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {(() => {
                  const config = statusConfig[selectedRequest.status] || statusConfig.PENDING
                  return (
                    <Tag color={config.color} icon={config.icon}>
                      {config.label}
                    </Tag>
                  )
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="Requested">
                {dayjs(selectedRequest.created_at).format('DD MMM YYYY, HH:mm')}
              </Descriptions.Item>
              {selectedRequest.reviewed_at && (
                <Descriptions.Item label="Reviewed">
                  {dayjs(selectedRequest.reviewed_at).format('DD MMM YYYY, HH:mm')}
                </Descriptions.Item>
              )}
              {selectedRequest.reviewed_by && (
                <Descriptions.Item label="Reviewed By" span={2}>
                  {selectedRequest.reviewed_by.name} ({selectedRequest.reviewed_by.email})
                </Descriptions.Item>
              )}
              {selectedRequest.rejection_reason && (
                <Descriptions.Item label="Rejection Reason" span={2}>
                  <Alert type="error" message={selectedRequest.rejection_reason} />
                </Descriptions.Item>
              )}
              {selectedRequest.reference_product_id && (
                <Descriptions.Item label="Reference Product" span={2}>
                  <Text>{selectedRequest.reference_product_id.name}</Text>
                  <Tag style={{ marginLeft: 8 }}>{selectedRequest.reference_product_id.status}</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Space>
        )}
      </Modal>

      {/* Action Modal */}
      <Modal
        title={
          actionType === 'approve'
            ? 'Approve Category Extension'
            : actionType === 'reject'
              ? 'Reject Category Extension'
              : 'Request More Information'
        }
        open={actionModalOpen}
        onOk={submitAction}
        onCancel={() => {
          setActionModalOpen(false)
          setSelectedRequest(null)
          setRejectionReason('')
        }}
        okText={actionType === 'approve' ? 'Approve' : actionType === 'reject' ? 'Reject' : 'Request'}
        okButtonProps={{
          danger: actionType === 'reject',
          type: 'primary',
        }}
      >
        {selectedRequest && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>
              {actionType === 'approve' &&
                `Approve "${selectedRequest.brand_id.brand_name}" for category "${selectedRequest.category_id.name}"? This will allow unlimited product listings under this brand + category combination.`}
              {actionType === 'reject' &&
                `Are you sure you want to reject the request for "${selectedRequest.brand_id.brand_name}" in category "${selectedRequest.category_id.name}"?`}
              {actionType === 'need_more_docs' &&
                `Request more information for "${selectedRequest.brand_id.brand_name}" in category "${selectedRequest.category_id.name}"?`}
            </Text>
            {(actionType === 'reject' || actionType === 'need_more_docs') && (
              <Alert
                type="warning"
                message={actionType === 'reject' ? 'Rejection reason is required' : 'Please provide details about what information is needed'}
                description={
                  <TextArea
                    rows={4}
                    placeholder={
                      actionType === 'reject'
                        ? 'Enter rejection reason'
                        : 'Enter details about what additional information is needed'
                    }
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                }
              />
            )}
            {actionType === 'approve' && (
              <Alert
                type="info"
                message="Note"
                description="All products currently waiting for category approval will be automatically unblocked and moved to pending review."
              />
            )}
          </Space>
        )}
      </Modal>
    </>
  )
}

export default CategoryExtensionRequests


