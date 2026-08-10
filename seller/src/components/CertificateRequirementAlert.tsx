import { CheckCircleOutlined, ExclamationCircleOutlined, UploadOutlined } from '@ant-design/icons'
import { Alert, Button, Space, Tag, Typography } from 'antd'
import type { CertificateType } from '../api/categories'
import type { Certificate } from '../api/certificates'

interface CertificateRequirementAlertProps {
  requiredCertificates: CertificateType[]
  inheritedCertificates?: CertificateType[]
  inheritsParentRule?: boolean
  sellerCertificates: Certificate[] | undefined
  onUploadClick: () => void
  loading?: boolean
}

const CertificateRequirementAlert = ({
  requiredCertificates,
  inheritedCertificates,
  inheritsParentRule = false,
  sellerCertificates,
  onUploadClick,
  loading = false,
}: CertificateRequirementAlertProps) => {
  if (!requiredCertificates || requiredCertificates.length === 0) {
    return null
  }

  type CertificateStatus = 'approved' | 'pending' | 'rejected' | 'expired' | 'missing'

  const statusLabels: Record<CertificateStatus, string> = {
    approved: 'Approved',
    pending: 'Pending Review',
    rejected: 'Rejected',
    expired: 'Expired',
    missing: 'Not Uploaded',
  }

  const statusColors: Record<CertificateStatus, string> = {
    approved: 'green',
    pending: 'orange',
    rejected: 'red',
    expired: 'red',
    missing: 'red',
  }

  const now = new Date()

  const certificateStatuses = requiredCertificates.map((requiredType) => {
    const matchingCertificate = sellerCertificates?.find(
      (certificate) => certificate.certificateType === requiredType,
    )

    let status: CertificateStatus = 'missing'
    if (matchingCertificate) {
      status = matchingCertificate.status as CertificateStatus
      if (
        status === 'approved' &&
        matchingCertificate.expiryDate &&
        new Date(matchingCertificate.expiryDate) <= now
      ) {
        status = 'expired'
      }
    }

    return {
      type: requiredType,
      status,
      certificate: matchingCertificate,
      inherited: inheritedCertificates?.includes(requiredType) ?? false,
    }
  })

  const hasAllCertificates = certificateStatuses.every(({ status }) => status === 'approved')
  const hasPendingCertificates = certificateStatuses.some(({ status }) => status === 'pending')
  const hasMissingCertificates = certificateStatuses.some(({ status }) => status === 'missing')

  // Format certificate name for display
  const formatCertificateName = (certType: CertificateType): string => {
    return certType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  if (hasAllCertificates) {
    return (
      <Alert
        message="All Required Certificates Verified"
        description="You have all the required certificates for this category. New products will be auto-approved for compliance."
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        style={{ marginTop: 8 }}
      />
    )
  }

  const needsAction = certificateStatuses.some(({ status }) => status !== 'approved')

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {/* Priority Alert: Show prominent message if certificates are pending */}
      {hasPendingCertificates && (
        <Alert
          message={
            <Typography.Text strong style={{ fontSize: '14px' }}>
              ⚠️ Product Approval Required
            </Typography.Text>
          }
          description={
            <Typography.Text>
              {hasPendingCertificates && hasMissingCertificates
                ? 'Some required certificates are pending admin review. Products created in this category will require admin approval before they can be published.'
                : 'One or more required certificates are currently pending admin review. Products created in this category will automatically be set to "Pending Approval" status and will require admin approval before they can be published.'}
            </Typography.Text>
          }
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{
            marginTop: 8,
            border: '1px solid #ff9800',
            backgroundColor: '#fff7e6',
          }}
        />
      )}

      <Alert
        message="Certificate Required"
        description={
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Typography.Text>
              {inheritsParentRule
                ? 'This category inherits compliance requirements from its parent, so the following certificates must be approved.'
                : 'Admin marked this category as requiring the following certificates.'}
            </Typography.Text>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
                width: '100%',
              }}
            >
              {certificateStatuses.map(({ type, status, inherited }) => (
                <div
                  key={type}
                  className="rounded-md border border-yellow-200 bg-white px-3 py-2 shadow-sm"
                  style={{ minHeight: 73 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Tag color={statusColors[status]} style={{ marginBottom: 0 }}>
                      {statusLabels[status]}
                    </Tag>
                    {inherited ? (
                      <Tag color="blue" style={{ marginBottom: 0 }}>
                        Inherited
                      </Tag>
                    ) : null}
                  </div>
                  <Typography.Text strong style={{ display: 'block', marginTop: 6 }}>
                    {formatCertificateName(type)}
                  </Typography.Text>
                  {status === 'pending' && (
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: '11px', display: 'block', marginTop: 4 }}
                    >
                      Awaiting admin review
                    </Typography.Text>
                  )}
                </div>
              ))}
            </div>

            <Typography.Text type="secondary">
              {hasPendingCertificates
                ? 'Products in this category will be set to "Pending Approval" status until all required certificates are approved by admin.'
                : 'Products in this category will remain in pending approval until all certificates are approved.'}
            </Typography.Text>
            {needsAction && (
              <Button
                type="primary"
                icon={<UploadOutlined />}
                onClick={onUploadClick}
                size="small"
                loading={loading}
              >
                Manage Certificates
              </Button>
            )}
          </Space>
        }
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        style={{ marginTop: hasPendingCertificates ? 0 : 8 }}
      />
    </Space>
  )
}

export default CertificateRequirementAlert
