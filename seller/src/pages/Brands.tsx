import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { type Brand, type DocumentType, useBrand, useSellerBrands, useUploadBrandDocument } from '../api/brandQueries'
import type { BrandDocument } from '../api/brands'
import BrandRequestModal from '../components/BrandRequestModal'
import { useAuthStore } from '../store/authStore'

const { Text } = Typography

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PENDING: {
    color: 'orange',
    icon: <ClockCircleOutlined />,
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

const documentTypeLabels: Record<DocumentType, string> = {
  TM_CERTIFICATE: 'Trademark Registration Certificate',
  TM_APPLICATION: 'Trademark Application / Registration Form',
  SALE_INVOICE: 'Sale Invoice from Brand Owner',
  AUTHORIZATION_LETTER: 'Brand Authorization Letter',
}

const Brands = () => {
  const user = useAuthStore((state) => state.user)
  const { data: brands, isLoading, refetch } = useSellerBrands()
  const [modalOpen, setModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [viewBrand, setViewBrand] = useState<Brand | null>(null)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadBrand, setUploadBrand] = useState<Brand | null>(null)
  const [uploadFileList, setUploadFileList] = useState<Record<DocumentType, UploadFile[]>>({
    TM_CERTIFICATE: [],
    TM_APPLICATION: [],
    SALE_INVOICE: [],
    AUTHORIZATION_LETTER: [],
  })
  const uploadBrandDocument = useUploadBrandDocument()
  const { data: viewBrandDetail, isLoading: viewBrandLoading } = useBrand(viewBrand?._id ?? '')

  // Check if KYC is approved
  const isKycApproved =
    user?.kycStatus === 'APPROVED' || (user?.isApproved === true && user?.kycSubmitted === true)

  const approvedBrandsCount = brands?.filter((b) => b.status === 'APPROVED').length || 0

  const resetUploadFiles = () => {
    setUploadFileList({
      TM_CERTIFICATE: [],
      TM_APPLICATION: [],
      SALE_INVOICE: [],
      AUTHORIZATION_LETTER: [],
    })
  }

  const clearUploadState = () => {
    resetUploadFiles()
    setUploadBrand(null)
  }

  const handleOpenUploadModal = (brand: Brand) => {
    setUploadBrand(brand)
    resetUploadFiles()
    setUploadModalOpen(true)
  }

  const handleUploadChange = (documentType: DocumentType, fileList: UploadFile[]) => {
    setUploadFileList((prev) => ({
      ...prev,
      [documentType]: fileList,
    }))
  }

  const handleUploadSubmit = async () => {
    if (!uploadBrand) return

    const filesToUpload: Array<{ file: File; documentType: DocumentType }> = []
    ;(Object.keys(uploadFileList) as DocumentType[]).forEach((documentType) => {
      uploadFileList[documentType].forEach((file) => {
        if (file.originFileObj) {
          filesToUpload.push({ file: file.originFileObj as File, documentType })
        }
      })
    })

    if (filesToUpload.length === 0) {
      message.error('Please select at least one document to upload.')
      return
    }

    for (const { file, documentType } of filesToUpload) {
      await uploadBrandDocument.mutateAsync({
        brandId: uploadBrand._id,
        file,
        documentType,
      })
    }

    await refetch()
    setUploadModalOpen(false)
    clearUploadState()
  }

  const columns: ColumnsType<Brand> = [
    {
      title: 'Brand Name',
      dataIndex: 'brand_name',
      key: 'brand_name',
      render: (text: string) => <Text strong>{text}</Text>,
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
          <Tooltip
            title={
              status === 'NEED_MORE_DOCS'
                ? 'Additional documents requested by admin'
                : undefined
            }
          >
            <Tag color={config.color} icon={config.icon}>
              {config.label}
            </Tag>
          </Tooltip>
        )
      },
    },
    {
      title: 'Approved categories',
      key: 'approved_category_count',
      render: (_, record) =>
        record.status === 'APPROVED' ? (
          <Text>{record.approved_category_count ?? 0} category(ies)</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Documents',
      key: 'documents',
      render: (_, record) => (
        <Space>
          {record.documents && record.documents.length > 0 ? (
            <Tooltip title={`${record.documents.length} document(s) uploaded`}>
              <Tag icon={<FileTextOutlined />}>{record.documents.length}</Tag>
            </Tooltip>
          ) : (
            <Text type="secondary">No documents</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Submitted',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Reviewed',
      key: 'reviewed',
      render: (_, record) => {
        if (record.reviewed_at && record.reviewed_by) {
          return (
            <Space direction="vertical" size={0}>
              <Text>{dayjs(record.reviewed_at).format('DD MMM YYYY, HH:mm')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                by {record.reviewed_by.name}
              </Text>
            </Space>
          )
        }
        return <Text type="secondary">Not reviewed</Text>
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View brand details">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => {
                setViewBrand(record)
                setViewModalOpen(true)
              }}
            />
          </Tooltip>
          {record.documents && record.documents.length > 0 && (
            <Tooltip title="View documents">
              <Button
                size="small"
                icon={<FileTextOutlined />}
                onClick={() => {
                  const urls = record.documents?.map((d: BrandDocument) => d.file_url) || []
                  urls.forEach((url: string) => window.open(url, '_blank'))
                }}
              />
            </Tooltip>
          )}
          {record.rejection_reason && (
            <Tooltip title={record.rejection_reason}>
              <Button size="small" icon={<QuestionCircleOutlined />} />
            </Tooltip>
          )}
          {record.status === 'NEED_MORE_DOCS' && (
            <Button size="small" icon={<UploadOutlined />} onClick={() => handleOpenUploadModal(record)}>
              Upload Docs
            </Button>
          )}
        </Space>
      ),
    },
  ]

  if (!isKycApproved) {
    return (
      <Card>
        <Alert
          type="warning"
          showIcon
          message="KYC Approval Required"
          description="Complete KYC to unlock brand approval and product listing."
          action={
            <Button type="primary" href="/submit-kyc">
              Complete KYC
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card
          title="Brand Management"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              data-tour="request-brand-btn"
            >
              Request Brand Approval
            </Button>
          }
        >
          {approvedBrandsCount === 0 && brands && brands.length > 0 && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="No Approved Brands"
              description="You need at least one approved brand to list products. Request brand approval or wait for admin review."
            />
          )}

          {approvedBrandsCount === 0 && (!brands || brands.length === 0) && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="No Brands Yet"
              description="You need at least one approved brand to list products. Request brand approval to get started."
            />
          )}

          {isLoading ? (
            <Spin />
          ) : !brands || brands.length === 0 ? (
            <Empty
              description="No brands found"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
                Request Brand Approval
              </Button>
            </Empty>
          ) : (
            <Table<Brand>
              rowKey="_id"
              dataSource={brands}
              columns={columns}
              pagination={{ pageSize: 10 }}
            />
          )}
        </Card>
      </Space>

      <BrandRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={async () => {
          await refetch()
          setModalOpen(false)
        }}
      />

      {/* Brand details view modal */}
      <Modal
        title={viewBrand ? `Brand: ${viewBrand.brand_name}` : 'Brand Details'}
        open={viewModalOpen}
        onCancel={() => {
          setViewModalOpen(false)
          setViewBrand(null)
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setViewModalOpen(false)
              setViewBrand(null)
            }}
          >
            Close
          </Button>,
        ]}
        width={640}
        destroyOnClose
      >
        {viewBrand && (
          <>
            {viewBrandLoading ? (
              <Spin />
            ) : viewBrandDetail ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Brand name">
                  <Text strong>{viewBrandDetail.brand_name}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag color={viewBrandDetail.brand_type === 'OWN' ? 'blue' : 'purple'}>
                    {viewBrandDetail.brand_type === 'OWN' ? 'Own Brand' : 'Other Brand'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {(() => {
                    const config = statusConfig[viewBrandDetail.status] || statusConfig.PENDING
                    return (
                      <Tag color={config.color} icon={config.icon}>
                        {config.label}
                      </Tag>
                    )
                  })()}
                </Descriptions.Item>
                {viewBrandDetail.status === 'APPROVED' && (
                  <Descriptions.Item label="Approved for categories">
                    <Space direction="vertical" size={0}>
                      <Text strong>
                        {viewBrandDetail.approved_category_count ?? 0} category(ies)
                      </Text>
                      {viewBrandDetail.approved_categories &&
                        viewBrandDetail.approved_categories.length > 0 && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {viewBrandDetail.approved_categories.map((c) => c.name).join(', ')}
                          </Text>
                        )}
                    </Space>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Submitted">
                  {dayjs(viewBrandDetail.created_at).format('DD MMM YYYY, HH:mm')}
                </Descriptions.Item>
                {viewBrandDetail.reviewed_at && (
                  <Descriptions.Item label="Reviewed">
                    {dayjs(viewBrandDetail.reviewed_at).format('DD MMM YYYY, HH:mm')}
                    {viewBrandDetail.reviewed_by && (
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        by {viewBrandDetail.reviewed_by.name}
                      </Text>
                    )}
                  </Descriptions.Item>
                )}
              </Descriptions>
            ) : (
              <Text type="secondary">Could not load brand details.</Text>
            )}
          </>
        )}
      </Modal>

      <Modal
        title={uploadBrand ? `Upload Documents for ${uploadBrand.brand_name}` : 'Upload Documents'}
        open={uploadModalOpen}
        onCancel={() => {
          setUploadModalOpen(false)
          clearUploadState()
        }}
        onOk={handleUploadSubmit}
        okText="Upload Documents"
        confirmLoading={uploadBrandDocument.isPending}
        width={720}
      >
        {uploadBrand && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {uploadBrand.rejection_reason && (
              <Alert
                type="warning"
                showIcon
                message="Documents requested by admin"
                description={uploadBrand.rejection_reason}
              />
            )}
            <Alert
              type="info"
              showIcon
              message="Choose the documents you want to upload"
              description="You can upload one or more documents. Only the files you select will be sent."
            />
            {(Object.keys(documentTypeLabels) as DocumentType[]).map((documentType) => (
              <div key={documentType}>
                <Text strong>{documentTypeLabels[documentType]}</Text>
                <Upload
                  fileList={uploadFileList[documentType]}
                  onChange={({ fileList }) => handleUploadChange(documentType, fileList)}
                  beforeUpload={() => false}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />} style={{ marginTop: 8 }}>
                    Upload
                  </Button>
                </Upload>
              </div>
            ))}
          </Space>
        )}
      </Modal>
    </>
  )
}

export default Brands

