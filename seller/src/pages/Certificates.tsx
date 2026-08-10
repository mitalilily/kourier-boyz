import { DeleteOutlined, EyeOutlined, RedoOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Empty,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useMemo, useState } from 'react'
import {
  type Certificate,
  type CertificateType,
  useCertificateTypes,
  useDeleteCertificate,
  useMyCertificates,
} from '../api/certificates'
import CertificateUploadModal from '../components/CertificateUploadModal'

const { Text } = Typography

const SellerCertificates = () => {
  const { data: certificates, isLoading, refetch } = useMyCertificates()
  const { data: certificateTypes } = useCertificateTypes()
  const deleteCertificate = useDeleteCertificate()

  const [typeFilter, setTypeFilter] = useState<string>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [forcedCertificates, setForcedCertificates] = useState<CertificateType[] | undefined>()
  const [initialCertificateType, setInitialCertificateType] = useState<
    CertificateType | undefined
  >()
  const [lockCertificateType, setLockCertificateType] = useState(false)

  const certificateLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    certificateTypes?.forEach((type) => {
      map.set(type.value, type.label)
    })
    return map
  }, [certificateTypes])

  const filteredCertificates = useMemo(() => {
    if (!certificates) return []
    return certificates.filter((certificate) => {
      const typeMatch = typeFilter === 'all' || certificate.certificateType === typeFilter
      return typeMatch
    })
  }, [certificates, typeFilter])

  const expiringCertificates = useMemo(() => {
    return (certificates || []).filter((certificate) => {
      if (!certificate.expiryDate) return false
      const daysLeft = dayjs(certificate.expiryDate).diff(dayjs(), 'day')
      return daysLeft >= 0 && daysLeft <= 30 && certificate.status !== 'expired'
    })
  }, [certificates])

  const openUploadModal = (options?: {
    forced?: CertificateType[]
    initialType?: CertificateType
    lockType?: boolean
  }) => {
    setForcedCertificates(options?.forced)
    setInitialCertificateType(options?.initialType)
    setLockCertificateType(Boolean(options?.lockType))
    setModalOpen(true)
  }

  const handleReupload = (certificate: Certificate) => {
    openUploadModal({
      forced: [certificate.certificateType],
      initialType: certificate.certificateType,
      lockType: true,
    })
  }

  const handleDelete = async (certificateId: string) => {
    try {
      await deleteCertificate.mutateAsync(certificateId)
      await refetch()
    } catch (error) {
      console.error('Failed to delete certificate', error)
    }
  }

  const columns: ColumnsType<Certificate> = [
    {
      title: 'Certificate',
      dataIndex: 'certificateType',
      key: 'certificateType',
      render: (value: CertificateType) =>
        certificateLabelMap.get(value) ?? value.replace(/_/g, ' '),
    },
    {
      title: 'Certificate Number',
      dataIndex: 'certificateNumber',
      key: 'certificateNumber',
      render: (value?: string) => value || <Text type="secondary">Not provided</Text>,
    },
    {
      title: 'Expiry',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (value: string | undefined, record) => {
        if (!value) {
          return <Tag color="blue">No Expiry</Tag>
        }
        const daysLeft = dayjs(value).diff(dayjs(), 'day')
        let color: string = 'default'
        if (record.status === 'expired' || daysLeft < 0) {
          color = 'red'
        } else if (daysLeft <= 7) {
          color = 'volcano'
        } else if (daysLeft <= 30) {
          color = 'orange'
        } else {
          color = 'green'
        }
        return (
          <Space direction="vertical" size={0}>
            <Tag color={color}>{dayjs(value).format('DD MMM YYYY')}</Tag>
            <Text type="secondary">
              {daysLeft < 0
                ? `${Math.abs(daysLeft)} day(s) overdue`
                : `${daysLeft} day(s) remaining`}
            </Text>
          </Space>
        )
      },
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Re-upload certificate">
            <Button size="small" icon={<RedoOutlined />} onClick={() => handleReupload(record)} />
          </Tooltip>
          {record.documentUrl && (
            <Tooltip title="View document">
              <Button
                size="small"
                icon={<EyeOutlined />}
                href={record.documentUrl}
                target="_blank"
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Delete certificate?"
            okButtonProps={{ loading: deleteCertificate.isPending }}
            onConfirm={() => handleDelete(record._id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Tooltip title="Delete certificate">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card
          title="Certificate Compliance"
          extra={
            <Button type="primary" onClick={() => openUploadModal()}>
              Upload Certificate
            </Button>
          }
        >
          {expiringCertificates.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Certificate Expiry Alerts"
              description={
                <Space direction="vertical" size={4}>
                  {expiringCertificates.map((certificate) => {
                    const label =
                      certificateLabelMap.get(certificate.certificateType) ??
                      certificate.certificateType.replace(/_/g, ' ')
                    const daysLeft = dayjs(certificate.expiryDate).diff(dayjs(), 'day')
                    return (
                      <div key={certificate._id}>
                        <strong>{label}</strong> expires on{' '}
                        {certificate.expiryDate
                          ? dayjs(certificate.expiryDate).format('DD MMM YYYY')
                          : 'N/A'}{' '}
                        ({daysLeft} day{daysLeft === 1 ? '' : 's'} remaining)
                      </div>
                    )
                  })}
                </Space>
              }
            />
          )}
          <Space style={{ marginBottom: 16 }} wrap>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="Filter by certificate"
              options={[
                { value: 'all', label: 'All Certificates' },
                ...(certificateTypes?.map((type) => ({
                  value: type.value,
                  label: type.label,
                })) ?? []),
              ]}
              showSearch
              optionFilterProp="label"
              style={{ minWidth: 220 }}
            />
          </Space>
          {isLoading ? (
            <Spin />
          ) : filteredCertificates.length === 0 ? (
            <Empty description="No certificates found" />
          ) : (
            <Table<Certificate>
              rowKey="_id"
              dataSource={filteredCertificates}
              columns={columns}
              pagination={{ pageSize: 10 }}
            />
          )}
        </Card>
      </Space>

      <CertificateUploadModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        requiredCertificates={
          forcedCertificates && forcedCertificates.length > 0
            ? forcedCertificates
            : certificateTypes?.map((type) => type.value) ?? []
        }
        forcedCertificates={forcedCertificates}
        initialCertificateType={initialCertificateType}
        lockCertificateType={lockCertificateType}
        onUploaded={async () => {
          await refetch()
          setModalOpen(false)
        }}
      />
    </>
  )
}

export default SellerCertificates
