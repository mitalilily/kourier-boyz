import {
  App,
  Card,
  Checkbox,
  Image,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { useMemo, useState } from 'react'
import { useCategories, useCreateCategory } from '../api/category'
import {
  useApproveCategoryRequest,
  useCategoryRequests,
  useRejectCategoryRequest,
  type CategoryRequest,
} from '../api/categoryRequests'
import { useCertificateTypes } from '../api/certificates'
import AddCategoryDrawer from '../components/categories/AddCategoryDrawer'
import PermissionButton from '../components/PermissionButton'
import { useModulePermissions } from '../hooks/useModulePermissions'
import type { Category } from '../types/category'

const Requests = () => {
  const { message, modal } = App.useApp()
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | undefined>('pending')
  const { data, isLoading } = useCategoryRequests(status)
  const { data: categoriesData } = useCategories({ includeSubcategories: true })
  const approve = useApproveCategoryRequest()
  const reject = useRejectCategoryRequest()
  const requestsPermissions = useModulePermissions('requests')

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [prefillData, setPrefillData] = useState<CategoryRequest | null>(null)
  const [approveOpen, setApproveOpen] = useState(false)
  const [approveId, setApproveId] = useState<string | null>(null)
  const [selectedCertificates, setSelectedCertificates] = useState<string[]>([])
  const [overrideParentRule, setOverrideParentRule] = useState(false)
  const [approveNote, setApproveNote] = useState('')
  const [approveRecord, setApproveRecord] = useState<CategoryRequest | null>(null)

  const inheritedPreview = useMemo(
    () => approveRecord?.inheritedCertificates ?? [],
    [approveRecord],
  )
  const effectivePreview = useMemo(() => {
    if (!approveRecord) return selectedCertificates
    if (overrideParentRule) return selectedCertificates
    const inherited = approveRecord.inheritedCertificates ?? []
    return Array.from(new Set([...inherited, ...selectedCertificates]))
  }, [approveRecord, overrideParentRule, selectedCertificates])

  const createCategory = useCreateCategory()
  const { data: certificateTypes } = useCertificateTypes()
  const certificateLabelMap = useMemo(() => {
    const map = new Map<string, string>()
    certificateTypes?.forEach((type) => {
      map.set(type.value, type.label)
    })
    return map
  }, [certificateTypes])

  const columns = useMemo(() => {
    const categories = categoriesData?.categories || []

    // Helper function to check if category exists
    const categoryExists = (categoryName: string) => {
      return categories.some(
        (cat) => cat.name.toLowerCase().trim() === categoryName.toLowerCase().trim(),
      )
    }

    return [
      { title: 'Name', dataIndex: 'name', key: 'name' },
      {
        title: 'Parent Category',
        key: 'parent',
        render: (_: unknown, r: CategoryRequest) => {
          const parent = r.parent ? (typeof r.parent === 'string' ? null : r.parent) : null
          return parent ? (
            <Tag color="blue">
              {parent.name} ({parent.slug})
            </Tag>
          ) : (
            <Tag color="default">Root Category</Tag>
          )
        },
      },
      {
        title: 'Certificate Requirement',
        key: 'certificateRequirement',
        render: (_: unknown, record: CategoryRequest) => {
          const categorySpecific = record.requiredCertificates || []
          const inherited = record.inheritedCertificates || []

          if (categorySpecific.length === 0 && inherited.length === 0) {
            return <Tag color="default">No Certificate Needed</Tag>
          }

          return (
            <Space direction="vertical" size={4}>
              {inherited.length > 0 && (
                <div>
                  <Tag color="blue">Inherited</Tag>
                  <Space size={[4, 4]} wrap>
                    {inherited.map((cert) => (
                      <Tag key={`inherited-${cert}`} color="blue">
                        {certificateLabelMap.get(cert) ?? cert.replace(/_/g, ' ')}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
              {categorySpecific.length > 0 && (
                <div>
                  <Tag color="purple">Category Specific</Tag>
                  <Space size={[4, 4]} wrap>
                    {categorySpecific.map((cert) => (
                      <Tag key={`own-${cert}`} color="purple">
                        {certificateLabelMap.get(cert) ?? cert.replace(/_/g, ' ')}
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
              {record.overrideParentCertificateRule ? (
                <Tag color="volcano">Overrides Parent Rule</Tag>
              ) : null}
            </Space>
          )
        },
      },
      {
        title: 'Requested By',
        key: 'requestedBy',
        render: (_: unknown, r: CategoryRequest) => {
          const reqBy = (r as unknown as { requestedBy?: { _id?: string; email?: string } })
            .requestedBy
          return reqBy?._id ? <a href={`/sellers/${reqBy._id}`}>{reqBy.email}</a> : <span>-</span>
        },
      },
      {
        title: 'Suggested Images',
        key: 'suggestedImages',
        render: (_: unknown, record: CategoryRequest) => {
          const images = []
          if (record.suggestedMainImage)
            images.push({ type: 'Main', url: record.suggestedMainImage })
          if (record.suggestedHoverImage)
            images.push({ type: 'Hover', url: record.suggestedHoverImage })
          if (record.suggestedBanners?.length) {
            record.suggestedBanners.forEach((url, idx) => {
              images.push({ type: `Banner ${idx + 1}`, url })
            })
          }

          if (images.length === 0) return <span style={{ color: '#999' }}>No images</span>

          return (
            <Space wrap>
              {images.slice(0, 3).map((img, idx) => (
                <Image
                  key={idx}
                  width={40}
                  height={40}
                  src={img.url}
                  alt={img.type}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                  preview={{
                    mask: img.type,
                  }}
                />
              ))}
              {images.length > 3 && (
                <span style={{ color: '#999', fontSize: '12px' }}>+{images.length - 3} more</span>
              )}
            </Space>
          )
        },
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (s: CategoryRequest['status']) => (
          <Tag color={s === 'pending' ? 'gold' : s === 'approved' ? 'green' : 'red'}>{s}</Tag>
        ),
      },
      ...(requestsPermissions.canApprove || requestsPermissions.canReject || requestsPermissions.canCreate
        ? [
            {
              title: 'Actions',
              key: 'actions',
              render: (_: unknown, record: CategoryRequest) => (
                <Space>
                  {record.status === 'pending' && (
                    <>
                      <PermissionButton
                        module="requests"
                        permission="approve"
                        type="primary"
                        loading={approve.isPending}
                        onClick={() => {
                          setApproveId(record._id)
                          setApproveRecord(record)
                          setSelectedCertificates(record.requiredCertificates || [])
                          setOverrideParentRule(record.overrideParentCertificateRule ?? false)
                          setApproveNote(record.adminNote || '')
                          setApproveOpen(true)
                        }}
                      >
                        Approve
                      </PermissionButton>
                      <PermissionButton
                        module="requests"
                        permission="reject"
                        danger
                        loading={reject.isPending}
                        onClick={() => {
                          setRejectId(record._id)
                          setAdminNote('')
                          setRejectOpen(true)
                        }}
                      >
                        Reject
                      </PermissionButton>
                    </>
                  )}
                  {record.status === 'approved' && (
                    <>
                      {categoryExists(record.name) ? (
                        <Tag color="green">Category Already Created</Tag>
                      ) : (
                        <PermissionButton
                          module="categories"
                          permission="create"
                          type="primary"
                          onClick={() => {
                            setPrefillData(record)
                            setDrawerOpen(true)
                          }}
                        >
                          Create Category
                        </PermissionButton>
                      )}
                    </>
                  )}
                </Space>
              ),
            },
          ]
        : []),
    ]
  }, [approve, reject, categoriesData, certificateLabelMap, requestsPermissions])

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card>
          <Segmented
            options={['pending', 'approved', 'rejected']}
            value={status || 'pending'}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(val) => setStatus(val as any)}
          />
        </Card>
        <Card>
          <Table
            rowKey="_id"
            loading={isLoading}
            dataSource={data || []}
            columns={columns}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </Space>
      <Modal
        title="Reject Category Request"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={async () => {
          if (!rejectId) return
          try {
            await reject.mutateAsync({ id: rejectId, adminNote: adminNote || undefined })
            message.success('Request rejected')
            setRejectOpen(false)
          } catch {
            message.error('Failed to reject')
          }
        }}
        okButtonProps={{ loading: reject.isPending }}
      >
        <p>Optional note for the seller:</p>
        <Input.TextArea rows={4} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
      </Modal>

      <Modal
        title="Approve Category Request"
        open={approveOpen}
        onCancel={() => {
          setApproveOpen(false)
          setApproveId(null)
          setApproveRecord(null)
          setSelectedCertificates([])
          setOverrideParentRule(false)
          setApproveNote('')
        }}
        onOk={async () => {
          if (!approveId) return
          try {
            await approve.mutateAsync({
              id: approveId,
              requiredCertificates:
                selectedCertificates.length > 0 ? selectedCertificates : undefined,
              overrideParentCertificateRule: overrideParentRule,
              adminNote: approveNote || undefined,
            })
            message.success('Request approved')
            setApproveOpen(false)
            setApproveId(null)
            setApproveRecord(null)
            setSelectedCertificates([])
            setOverrideParentRule(false)
            setApproveNote('')
            modal.confirm({
              title: `Category request is approved`,
              content: 'Do you want to create a global category now?',
              okText: 'Create Category',
              cancelText: 'Later',
              onOk: () => {
                const record = data?.find((r) => r._id === approveId)
                if (record) {
                  setPrefillData(record)
                  setDrawerOpen(true)
                }
              },
            })
          } catch {
            message.error('Failed to approve')
          }
        }}
        okButtonProps={{ loading: approve.isPending }}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {approveRecord && (
            <div>
              <p style={{ marginBottom: 4, fontWeight: 500 }}>Current certificate requirements</p>
              <Space direction="vertical" style={{ width: '100%' }} size={4}>
                <div>
                  <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
                    Inherited from parent:
                  </Typography.Text>
                  {inheritedPreview.length > 0 ? (
                    <Space size={[4, 4]} wrap>
                      {inheritedPreview.map((cert) => (
                        <Tag key={`approve-inherited-${cert}`} color="blue">
                          {certificateLabelMap.get(cert) ?? cert.replace(/_/g, ' ')}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <span style={{ color: '#999' }}>None</span>
                  )}
                </div>
                <div>
                  <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
                    Category specific (selected):
                  </Typography.Text>
                  {selectedCertificates.length > 0 ? (
                    <Space size={[4, 4]} wrap>
                      {selectedCertificates.map((cert) => (
                        <Tag key={`approve-selected-${cert}`} color="purple">
                          {certificateLabelMap.get(cert) ?? cert.replace(/_/g, ' ')}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <span style={{ color: '#999' }}>None</span>
                  )}
                </div>
                <div>
                  <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
                    Effective after approval:
                  </Typography.Text>
                  {effectivePreview.length > 0 ? (
                    <Space size={[4, 4]} wrap>
                      {effectivePreview.map((cert) => (
                        <Tag key={`approve-effective-${cert}`} color="geekblue">
                          {certificateLabelMap.get(cert) ?? cert.replace(/_/g, ' ')}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <span style={{ color: '#999' }}>No certificates required</span>
                  )}
                </div>
              </Space>
            </div>
          )}
          <div>
            <p style={{ marginBottom: 8 }}>Does this category require certificates?</p>
            <Select
              mode="multiple"
              placeholder="Select required certificates (optional)"
              value={selectedCertificates}
              onChange={(values) => setSelectedCertificates(values as string[])}
              style={{ width: '100%' }}
              allowClear
              options={certificateTypes?.map((type) => ({
                label: type.label,
                value: type.value,
              }))}
            />
          </div>
          <div>
            <Checkbox
              checked={overrideParentRule}
              onChange={(e) => setOverrideParentRule(e.target.checked)}
            >
              Override parent certificate rule (subcategories won't inherit parent's certificate
              requirements)
            </Checkbox>
          </div>
          <div>
            <p style={{ marginBottom: 8 }}>Optional note for the seller:</p>
            <Input.TextArea
              rows={3}
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="Add any notes or instructions..."
            />
          </div>
        </Space>
      </Modal>

      {/* Add Category Drawer */}
      <AddCategoryDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setPrefillData(null)
        }}
        onAdded={(formData: FormData, form: { resetFields: () => void }) => {
          createCategory.mutate(formData, {
            onSuccess: () => {
              message.success('Category created successfully!')
              setDrawerOpen(false)
              setPrefillData(null)
              form.resetFields()
              // Invalidate queries to refresh data
            },
            onError: () => message.error('Failed to create category'),
          })
        }}
        category={
          prefillData
            ? {
                _id: '',
                name: prefillData.name,
                description: prefillData.description || '',
                slug: prefillData.name
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/(^-|-$)/g, ''),
                status: 'active' as const,
                top: false,
                mainImage: prefillData.suggestedMainImage || '',
                hoverImage: prefillData.suggestedHoverImage || '',
                banners: prefillData.suggestedBanners || [],
                parent:
                  prefillData.parent && typeof prefillData.parent === 'object'
                    ? prefillData.parent._id
                    : prefillData.parent || null,
                requiredCertificates: (prefillData.requiredCertificates ||
                  []) as Category['requiredCertificates'],
                overrideParentCertificateRule: prefillData.overrideParentCertificateRule ?? false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            : null
        }
        loading={createCategory.isPending}
      />
    </>
  )
}

export default Requests
