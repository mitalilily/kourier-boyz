import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  PlusCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Spin,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { useCategories } from '../api/category'
import {
  useAddCategoriesToBrand,
  useBrandApprovedCategories,
  useBrands,
  useUpdateBrandStatus,
  type Brand,
} from '../api/brands'

const { Text } = Typography
const { TextArea } = Input

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
    label: 'More Documents Required',
  },
  REVOKED: {
    color: 'default',
    icon: <CloseCircleOutlined />,
    label: 'Revoked',
  },
}

const documentTypeLabels: Record<string, string> = {
  TM_CERTIFICATE: 'Trademark Registration Certificate',
  TM_APPLICATION: 'Trademark Application / Registration Form',
  SALE_INVOICE: 'Sale Invoice from Brand Owner',
  AUTHORIZATION_LETTER: 'Brand Authorization Letter',
}

const BrandApprovals = () => {
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'need_more_docs' | 'revoke'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')
  const [approvedCategories, setApprovedCategories] = useState<string[]>([])
  const [addCategoriesModalOpen, setAddCategoriesModalOpen] = useState(false)
  const [brandForAddCategories, setBrandForAddCategories] = useState<Brand | null>(null)
  const [categoriesToAdd, setCategoriesToAdd] = useState<string[]>([])

  // Fetch categories for selection
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories({
    status: 'active',
    includeSubcategories: true,
  })
  const categories = categoriesData?.categories || []

  // Fetch brands using the proper API hook
  const { data: brandsData, isLoading, refetch } = useBrands()
  const brands: Brand[] = brandsData?.brands || []
  const pagination = brandsData?.pagination || { total: 0, page: 1, limit: 20, pages: 1 }

  // Update brand status mutation
  const updateBrandStatus = useUpdateBrandStatus()
  const addCategoriesToBrand = useAddCategoriesToBrand()

  // Approved categories for View modal or Add-categories modal (from backend)
  const brandIdForApprovedCategories =
    modalOpen && selectedBrand ? selectedBrand._id : addCategoriesModalOpen && brandForAddCategories ? brandForAddCategories._id : null
  const { data: approvedCategoriesData, isLoading: approvedCategoriesLoading } = useBrandApprovedCategories(
    brandIdForApprovedCategories ?? null,
  )
  const existingApprovedCategoryNames = approvedCategoriesData?.categories?.map((c) => c.name).filter(Boolean) ?? []
  const categoriesAvailableToAdd = approvedCategoriesData?.available_to_add_categories ?? []

  const handleViewBrand = (brand: Brand) => {
    setSelectedBrand(brand)
    setModalOpen(true)
  }

  const handleAction = (brand: Brand, type: 'approve' | 'reject' | 'need_more_docs' | 'revoke') => {
    setSelectedBrand(brand)
    setActionType(type)
    setRejectionReason('')
    setApprovedCategories([])
    setActionModalOpen(true)
  }

  const handleOpenAddCategories = (brand: Brand) => {
    setBrandForAddCategories(brand)
    setCategoriesToAdd([])
    setAddCategoriesModalOpen(true)
  }

  const handleCloseAddCategories = () => {
    setAddCategoriesModalOpen(false)
    setBrandForAddCategories(null)
    setCategoriesToAdd([])
  }

  const submitAddCategories = async () => {
    if (!brandForAddCategories || categoriesToAdd.length === 0) {
      message.error('Please select at least one category to add')
      return
    }
    try {
      const result = await addCategoriesToBrand.mutateAsync({
        id: brandForAddCategories._id,
        category_ids: categoriesToAdd,
      })
      message.success(
        result.added_count > 0
          ? `Added ${result.added_count} category(ies). ${result.product_count_unblocked ?? 0} product(s) unblocked. Seller notified by email.`
          : result.message,
      )
      handleCloseAddCategories()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      message.error(err.response?.data?.error || 'Failed to add categories')
    }
  }

  const submitAction = async () => {
    if (!selectedBrand) return

    if (
      (actionType === 'reject' || actionType === 'revoke' || actionType === 'need_more_docs') &&
      !rejectionReason.trim()
    ) {
      message.error(
        actionType === 'need_more_docs'
          ? 'Please specify which documents are required'
          : 'Rejection reason is required',
      )
      return
    }

    if (actionType === 'approve' && approvedCategories.length === 0) {
      message.error('Please select at least one category for brand approval')
      return
    }

    try {
      const statusMap = {
        approve: 'APPROVED' as const,
        reject: 'REJECTED' as const,
        need_more_docs: 'NEED_MORE_DOCS' as const,
        revoke: 'REVOKED' as const,
      }

      await updateBrandStatus.mutateAsync({
        id: selectedBrand._id,
        status: statusMap[actionType],
        rejection_reason:
          actionType === 'reject' || actionType === 'revoke' || actionType === 'need_more_docs'
            ? rejectionReason
            : undefined,
        approved_categories: actionType === 'approve' ? approvedCategories : undefined,
      })

      message.success(`Brand ${actionType === 'approve' ? 'approved' : actionType === 'reject' ? 'rejected' : actionType === 'revoke' ? 'revoked' : 'marked as needing more documents'} successfully`)
      setActionModalOpen(false)
      setSelectedBrand(null)
      setRejectionReason('')
      setApprovedCategories([])
    } catch (error: unknown) {
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error ===
          'string'
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : error instanceof Error
            ? error.message
            : 'Failed to update brand status'
      message.error(errorMessage)
    }
  }

  const columns: ColumnsType<Brand> = [
    {
      title: 'Brand Name',
      dataIndex: 'brand_name',
      key: 'brand_name',
      render: (text: string) => <Text strong>{text}</Text>,
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
      title: 'Type',
      dataIndex: 'brand_type',
      key: 'brand_type',
      render: (type: string) => (
        <Tag color={type === 'OWN' ? 'blue' : 'purple'}>{type === 'OWN' ? 'Own Brand' : 'Other Brand'}</Tag>
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
      title: 'Documents',
      key: 'documents',
      render: (_, record) => (
        <Tag>{record.documents?.length || 0} document(s)</Tag>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewBrand(record)}>
            View
          </Button>
          {(record.status === 'PENDING' || record.status === 'NEED_MORE_DOCS') && (
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
                Need More Docs
              </Button>
            </>
          )}
          {record.status === 'APPROVED' && (
            <>
              <Button
                size="small"
                icon={<PlusCircleOutlined />}
                onClick={() => handleOpenAddCategories(record)}
              >
                Add categories
              </Button>
              <Button
                size="small"
                danger
                icon={<ReloadOutlined />}
                onClick={() => handleAction(record, 'revoke')}
              >
                Revoke
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
        title="Brand Approvals"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
        }
      >
        <Table<Brand>
          rowKey="_id"
          dataSource={brands}
          columns={columns}
          loading={isLoading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} brands`,
          }}
        />
      </Card>

      {/* Brand Detail Modal */}
      <Modal
        title="Brand Details"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false)
          setSelectedBrand(null)
        }}
        width={800}
        footer={[
          <Button key="close" onClick={() => {
            setModalOpen(false)
            setSelectedBrand(null)
          }}>
            Close
          </Button>,
        ]}
      >
        {selectedBrand && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Brand Name" span={2}>
                <Text strong>{selectedBrand.brand_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Brand Type">
                <Tag color={selectedBrand.brand_type === 'OWN' ? 'blue' : 'purple'}>
                  {selectedBrand.brand_type === 'OWN' ? 'Own Brand' : 'Other Brand'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {(() => {
                  const config = statusConfig[selectedBrand.status] || statusConfig.PENDING
                  return (
                    <Tag color={config.color} icon={config.icon}>
                      {config.label}
                    </Tag>
                  )
                })()}
              </Descriptions.Item>
              {selectedBrand.status === 'APPROVED' && (
                <Descriptions.Item label="Approved for categories" span={2}>
                  {approvedCategoriesLoading ? (
                    <Text type="secondary">Loading…</Text>
                  ) : (approvedCategoriesData?.category_ids?.length ?? 0) > 0 ? (
                    <Space direction="vertical" size={0}>
                      <Text strong>{approvedCategoriesData?.category_ids?.length ?? 0} category(ies)</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {(approvedCategoriesData?.categories ?? []).map((c: { name?: string }) => c.name).filter(Boolean).join(', ')}
                      </Text>
                    </Space>
                  ) : (
                    <Text type="secondary">None assigned yet</Text>
                  )}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Seller Name" span={2}>
                {selectedBrand.seller_id.businessName || selectedBrand.seller_id.name}
              </Descriptions.Item>
              <Descriptions.Item label="Seller Email" span={2}>
                {selectedBrand.seller_id.email}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted">
                {dayjs(selectedBrand.created_at).format('DD MMM YYYY, HH:mm')}
              </Descriptions.Item>
              {selectedBrand.reviewed_at && (
                <Descriptions.Item label="Reviewed">
                  {dayjs(selectedBrand.reviewed_at).format('DD MMM YYYY, HH:mm')}
                </Descriptions.Item>
              )}
              {selectedBrand.reviewed_by && (
                <Descriptions.Item label="Reviewed By" span={2}>
                  {selectedBrand.reviewed_by.name} ({selectedBrand.reviewed_by.email})
                </Descriptions.Item>
              )}
              {selectedBrand.rejection_reason && (
                <Descriptions.Item
                  label={
                    selectedBrand.status === 'NEED_MORE_DOCS' ? 'Documents Requested' : 'Review Notes'
                  }
                  span={2}
                >
                  <Alert
                    type={selectedBrand.status === 'NEED_MORE_DOCS' ? 'warning' : 'error'}
                    message={selectedBrand.rejection_reason}
                  />
                </Descriptions.Item>
              )}
            </Descriptions>

            {selectedBrand.documents && selectedBrand.documents.length > 0 && (
              <Card title="Documents" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  {selectedBrand.documents.map((doc) => (
                    <Card key={doc._id} size="small" style={{ marginBottom: 8 }}>
                      <Space>
                        <Text strong>{documentTypeLabels[doc.document_type] || doc.document_type}</Text>
                        <Button
                          size="small"
                          icon={<EyeOutlined />}
                          href={doc.file_url}
                          target="_blank"
                        >
                          View Document
                        </Button>
                      </Space>
                    </Card>
                  ))}
                </Space>
              </Card>
            )}
          </Space>
        )}
      </Modal>

      {/* Action Modal */}
      <Modal
        title={
          actionType === 'approve'
            ? 'Approve Brand'
            : actionType === 'reject'
              ? 'Reject Brand'
              : actionType === 'revoke'
                ? 'Revoke Brand'
                : 'Request More Documents'
        }
        open={actionModalOpen}
        onOk={submitAction}
        onCancel={() => {
          setActionModalOpen(false)
          setSelectedBrand(null)
          setRejectionReason('')
          setApprovedCategories([])
        }}
        okText={actionType === 'approve' ? 'Approve' : actionType === 'reject' ? 'Reject' : actionType === 'revoke' ? 'Revoke' : 'Request'}
        okButtonProps={{
          danger: actionType === 'reject' || actionType === 'revoke',
          type: 'primary',
        }}
        width={actionType === 'approve' ? 600 : 520}
      >
        {selectedBrand && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Text>
              {actionType === 'approve' && `Select categories for "${selectedBrand.brand_name}" approval:`}
              {actionType === 'reject' && `Are you sure you want to reject "${selectedBrand.brand_name}"?`}
              {actionType === 'revoke' && `Are you sure you want to revoke "${selectedBrand.brand_name}"? This will disable all products under this brand.`}
              {actionType === 'need_more_docs' && `Request more documents for "${selectedBrand.brand_name}"?`}
            </Text>
            
            {actionType === 'approve' && (
              <div>
                <Alert
                  type="info"
                  message="Category Selection Required"
                  description="Select the categories where this brand can be used. At least one category must be selected."
                  style={{ marginBottom: 16 }}
                />
                {categoriesLoading ? (
                  <Spin />
                ) : (
                  <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 12 }}>
                    <Checkbox.Group
                      value={approvedCategories}
                      onChange={(values) => setApprovedCategories(values as string[])}
                      style={{ width: '100%' }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {categories.map((category) => (
                          <Checkbox key={category._id || category.id} value={category._id || category.id}>
                            {category.name}
                            {category.parent && typeof category.parent === 'object' && (
                              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                                ({category.parent.name})
                              </Text>
                            )}
                          </Checkbox>
                        ))}
                      </Space>
                    </Checkbox.Group>
                    {categories.length === 0 && (
                      <Text type="secondary">No active categories available</Text>
                    )}
                  </div>
                )}
                {approvedCategories.length > 0 && (
                  <Alert
                    type="success"
                    message={`${approvedCategories.length} category(ies) selected`}
                    style={{ marginTop: 16 }}
                  />
                )}
              </div>
            )}

            {(actionType === 'reject' || actionType === 'revoke' || actionType === 'need_more_docs') && (
              <Alert
                type={actionType === 'need_more_docs' ? 'info' : 'warning'}
                message={
                  actionType === 'need_more_docs'
                    ? 'Specify which documents are required'
                    : 'Rejection reason is required'
                }
                description={
                  <TextArea
                    rows={4}
                    placeholder={
                      actionType === 'need_more_docs'
                        ? 'Example: Please upload TM certificate and authorization letter'
                        : 'Enter rejection reason'
                    }
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                }
              />
            )}
          </Space>
        )}
      </Modal>

      {/* Add categories to approved brand */}
      <Modal
        title={`Add categories to "${brandForAddCategories?.brand_name ?? ''}"`}
        open={addCategoriesModalOpen}
        onOk={submitAddCategories}
        onCancel={handleCloseAddCategories}
        okText="Add categories"
        okButtonProps={{
          disabled: categoriesToAdd.length === 0,
          loading: addCategoriesToBrand.isPending,
        }}
        width={560}
        destroyOnClose
      >
        {brandForAddCategories && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              message="Assign more categories"
              description="Select categories to allow this brand to sell in. The seller will receive an email notification and any products waiting for category approval in these categories will be unblocked."
              showIcon
            />
            {existingApprovedCategoryNames.length > 0 && (
              <div>
                <Text type="secondary">Currently approved: </Text>
                <Text strong>{existingApprovedCategoryNames.join(', ')}</Text>
              </div>
            )}
            {approvedCategoriesLoading ? (
              <Spin />
            ) : categoriesAvailableToAdd.length === 0 ? (
              <Text type="secondary">No more categories to add. This brand is already approved for all active categories.</Text>
            ) : (
              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 4, padding: 12 }}>
                <Checkbox.Group
                  value={categoriesToAdd}
                  onChange={(values) => setCategoriesToAdd(values as string[])}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {categoriesAvailableToAdd.map((category) => (
                      <Checkbox key={category._id} value={String(category._id)}>
                        {category.name}
                        {category.parent && typeof category.parent === 'object' && (
                          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                            ({(category.parent as { name?: string }).name})
                          </Text>
                        )}
                      </Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
              </div>
            )}
            {categoriesToAdd.length > 0 && (
              <Alert type="success" message={`${categoriesToAdd.length} category(ies) selected`} />
            )}
          </Space>
        )}
      </Modal>
    </>
  )
}

export default BrandApprovals

