import { EyeOutlined, FileSearchOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Modal,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useCertificateTypes } from '../../api/certificates'
import { useProductCertificates } from '../../api/products'
import CertificateApprovalFlowInfo from './CertificateApprovalFlowInfo'

const { Text, Title } = Typography

type BasicProductInfo = {
  _id?: string
  name?: string
  seller?: {
    _id?: string
    name?: string
    email?: string
    businessName?: string
  } | null
  category?: {
    _id?: string
    name?: string
    parent?:
      | {
          _id?: string
          name?: string
          slug?: string
        }
      | string
      | null
  } | null
}

interface ProductCertificateApprovalModalProps {
  open: boolean
  product?: BasicProductInfo | null
  onCancel: () => void
  onApprove: () => void | Promise<void>
  onRemind?: (missingCertificates: string[]) => void | Promise<void>
  remindLoading?: boolean
  approveLoading?: boolean
}

const statusMeta: Record<
  'approved' | 'pending' | 'rejected' | 'expired' | 'missing',
  { color: string; label: string }
> = {
  approved: { color: 'green', label: 'Approved' },
  pending: { color: 'gold', label: 'Pending Review' },
  rejected: { color: 'red', label: 'Rejected' },
  expired: { color: 'red', label: 'Expired' },
  missing: { color: 'default', label: 'Not Uploaded' },
}

const formatCertificateName = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (t) => t.toUpperCase())

const formatDate = (value?: string) =>
  value ? dayjs(value).format('DD MMM YYYY') : undefined

const getCategoryBreadcrumb = (product?: BasicProductInfo | null, fallback?: string) => {
  if (!product?.category) return fallback ?? 'N/A'
  const categoryName = product.category.name ?? fallback ?? 'N/A'
  const parent =
    product.category.parent && typeof product.category.parent === 'object'
      ? product.category.parent.name
      : undefined
  return parent ? `${parent} > ${categoryName}` : categoryName
}

const getSellerLabel = (product?: BasicProductInfo | null) => {
  if (!product?.seller) return 'Unknown seller'
  const { name, email, businessName } = product.seller
  if (businessName) {
    return `${businessName}${name ? ` • ${name}` : ''}${email ? ` (${email})` : ''}`
  }
  if (name || email) {
    return `${name ?? 'Unknown'}${email ? ` (${email})` : ''}`
  }
  return 'Unknown seller'
}

const ProductCertificateApprovalModal = ({
  open,
  product,
  onCancel,
  onApprove,
  onRemind,
  remindLoading,
  approveLoading,
}: ProductCertificateApprovalModalProps) => {
  const productId = product?._id
  const { data: summary, isLoading } = useProductCertificates(productId, {
    enabled: open && !!productId,
  })
  const { data: certificateTypes } = useCertificateTypes()

  const certificateLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    certificateTypes?.forEach((item) => map.set(item.value, item.label))
    return map
  }, [certificateTypes])

  const handleApprove = () => {
    if (!productId) return
    onApprove()
  }

  const handleRemind = () => {
    if (!summary || !onRemind) return
    const missing = summary.certificates
      .filter((cert) => cert.status === 'missing' || cert.status === 'rejected' || cert.status === 'expired')
      .map((cert) => cert.certificateType)
    onRemind(missing)
  }

  const renderCertificates = () => {
    if (!summary) {
      return (
        <Alert
          type="error"
          message="Unable to load certificate summary"
          description="Please try again in a moment."
        />
      )
    }

    if ((summary.effectiveCertificates || []).length === 0) {
      return (
        <Alert
          type="success"
          message="No certificates required for this category"
          description="You can approve this product immediately."
          showIcon
        />
      )
    }

    const hasBlockingStatuses = summary.certificates.some(
      (cert) => cert.status === 'missing' || cert.status === 'rejected' || cert.status === 'expired',
    )
    const pendingCount = summary.certificates.filter((cert) => cert.status === 'pending').length

    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {summary.inheritsParentRule && (
          <Alert
            type="info"
            message="This category inherits certificate requirements from its parent."
            showIcon
          />
        )}
        {hasBlockingStatuses ? (
          <Alert
            type="warning"
            message="Some certificates need attention before approval."
            description="You can still approve the product, or remind the seller to upload missing certificates."
            showIcon
          />
        ) : summary.hasAllValid ? (
          <Alert
            type="success"
            message="All required certificates are approved."
            description="You can approve this product."
            showIcon
          />
        ) : pendingCount > 0 ? (
          <Alert
            type="warning"
            message={`${pendingCount} certificate${pendingCount > 1 ? 's are' : ' is'} pending review.`}
            description="You may approve now or wait for the review to finish."
            showIcon
          />
        ) : null}

        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          {summary.certificates.map((cert) => {
            const status = statusMeta[cert.status]
            const certificateName =
              certificateLabelMap.get(cert.certificateType) ?? formatCertificateName(cert.certificateType)
            return (
              <Card
                key={cert.certificateType}
                size="small"
                bodyStyle={{ padding: 12 }}
                style={{ borderColor: cert.status === 'approved' ? '#b7eb8f' : undefined }}
              >
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space size="small" wrap>
                    <Tag color={status.color}>{status.label}</Tag>
                    <Tag color={cert.inherited ? 'blue' : 'purple'}>
                      {cert.inherited ? 'Inherited Rule' : 'Category Specific'}
                    </Tag>
                  </Space>
                  <Title level={5} style={{ margin: 0 }}>
                    {certificateName}
                  </Title>
                  {cert.certificateNumber && (
                    <Text type="secondary">Certificate No: {cert.certificateNumber}</Text>
                  )}
                  {cert.expiryDate && (
                    <Text type={cert.status === 'expired' ? 'danger' : 'secondary'}>
                      Expires on: {formatDate(cert.expiryDate)}
                    </Text>
                  )}
                  {cert.status === 'rejected' && cert.rejectionReason && (
                    <Text type="danger">Rejection reason: {cert.rejectionReason}</Text>
                  )}
                  <Space size="small">
                    {cert.documentUrl && (
                      <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => window.open(cert.documentUrl, '_blank', 'noopener')}
                      >
                        View Document
                      </Button>
                    )}
                    {cert.certificateId && (
                      <Tag icon={<FileSearchOutlined />} color="default" style={{ marginInlineStart: 0 }}>
                        ID: {cert.certificateId.slice(-6)}
                      </Tag>
                    )}
                  </Space>
                </Space>
              </Card>
            )
          })}
        </Space>
      </Space>
    )
  }

  return (
    <Modal
      title="Review Certificates Before Approval"
      open={open}
      onCancel={onCancel}
      footer={[
        onRemind ? (
          <Button
            key="remind"
            onClick={handleRemind}
            disabled={!summary || !productId}
            loading={remindLoading}
          >
            Remind Seller
          </Button>
        ) : null,
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="approve"
          type="primary"
          onClick={handleApprove}
          loading={approveLoading}
          disabled={isLoading || !productId}
        >
          Approve Product
        </Button>,
      ]}
      onOk={handleApprove}
      okText="Approve Product"
      okButtonProps={{ loading: approveLoading, disabled: isLoading || !productId }}
      width={720}
      destroyOnClose
    >
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>
              {product?.name ?? 'Product'}
            </Title>
            <Text type="secondary">Seller: {getSellerLabel(product)}</Text>
            <br />
            <Text type="secondary">Category: {getCategoryBreadcrumb(product)}</Text>
          </div>
          <CertificateApprovalFlowInfo compact />
          {renderCertificates()}
        </Space>
      )}
    </Modal>
  )
}

export default ProductCertificateApprovalModal

