import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Divider,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { searchSellerOrdersApi, type OrderSearchResult } from '../api/orders'
import { useAdminProducts, type AdminProduct } from '../api/products'
import {
  approveSellerCoupon,
  deleteSellerCoupon,
  denySellerCoupon,
  getAllSellerCoupons,
  getSellerCoupon,
  pauseSellerCoupon,
  updateSellerCouponStatus,
  type SellerCoupon,
} from '../api/sellerCoupons'
import {
  useCreateManualAdjustment,
  useGlobalSettlementSettings,
  useSellerLedger,
  useSellerSettlementSettings,
  useSettlementBatches,
  useUpsertSellerSettlementSettings,
} from '../api/settlementQueries'
import type { SellerLedgerEntryDto, SettlementBatch } from '../api/settlements'
import { useUpdateSellerApproval, useUser } from '../api/users'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'

const { Title, Text } = Typography

/** Error shape from API mutations (e.g. axios) for toast messages */
interface MutationError {
  response?: { data?: { error?: string } }
}

/** Normalize value for display – never show undefined, null, or the string "undefined" */
const displayVal = (value: unknown, fallback = 'N/A'): string => {
  if (value == null) return fallback
  const s = String(value).trim()
  if (s === '' || s === 'undefined') return fallback
  return s
}

/** Format date for display; return fallback if invalid or missing */
const displayDate = (value: unknown, format = 'YYYY-MM-DD HH:mm'): string => {
  if (value == null) return 'N/A'
  const d = dayjs(value as string | Date)
  return d.isValid() ? d.format(format) : 'N/A'
}

const UserDetail = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false)
  const [adjustmentForm] = Form.useForm()
  const [orderSearchOptions, setOrderSearchOptions] = useState<OrderSearchResult[]>([])
  const [orderSearchLoading, setOrderSearchLoading] = useState(false)

  const { data: user, isLoading, error, refetch } = useUser(id || '')
  const updateApproval = useUpdateSellerApproval()
  const queryClient = useQueryClient()
  const { data: sellerProductsData, isLoading: isLoadingSellerProducts } = useAdminProducts(
    id ? { seller: id, page: 1, limit: 10 } : { page: 1, limit: 10 },
  )

  // Seller coupons query
  const [couponPage, setCouponPage] = useState(1)
  const [couponStatusFilter, setCouponStatusFilter] = useState<string>('')
  const [selectedCoupon, setSelectedCoupon] = useState<string | null>(null)
  const [pauseModalVisible, setPauseModalVisible] = useState(false)
  const [couponToPause, setCouponToPause] = useState<string | null>(null)
  const [pauseReason, setPauseReason] = useState('')
  const [statusModalVisible, setStatusModalVisible] = useState(false)
  const [couponToUpdate, setCouponToUpdate] = useState<string | null>(null)
  const [newStatus, setNewStatus] = useState<'active' | 'paused'>('active')
  const [statusReason, setStatusReason] = useState('')

  const { data: sellerCouponsData, isLoading: isLoadingSellerCoupons } = useQuery({
    queryKey: ['sellerCoupons', id, { status: couponStatusFilter, page: couponPage, limit: 10 }],
    queryFn: () =>
      getAllSellerCoupons({
        sellerId: id,
        status: couponStatusFilter || undefined,
        page: couponPage,
        limit: 10,
      }),
    enabled: !!id && user?.role === 'seller',
  })

  const { data: couponDetail } = useQuery({
    queryKey: ['sellerCoupon', selectedCoupon],
    queryFn: () => getSellerCoupon(selectedCoupon!),
    enabled: !!selectedCoupon,
  })

  // Coupon mutations
  const approveCouponMutation = useMutation({
    mutationFn: (couponId: string) => approveSellerCoupon(couponId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons', id] })
      toast.success('Coupon approved!')
    },
    onError: (error: MutationError) => {
      toast.error(error?.response?.data?.error || 'Failed to approve coupon')
    },
  })

  const denyCouponMutation = useMutation({
    mutationFn: ({ id: couponId, reason }: { id: string; reason?: string }) =>
      denySellerCoupon(couponId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons', id] })
      toast.success('Coupon denied!')
    },
    onError: (error: MutationError) => {
      toast.error(error?.response?.data?.error || 'Failed to deny coupon')
    },
  })

  const pauseCouponMutation = useMutation({
    mutationFn: ({ id: couponId, reason }: { id: string; reason?: string }) =>
      pauseSellerCoupon(couponId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons', id] })
      toast.success('Coupon paused!')
      setPauseModalVisible(false)
      setCouponToPause(null)
      setPauseReason('')
    },
    onError: (error: MutationError) => {
      toast.error(error?.response?.data?.error || 'Failed to pause coupon')
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id: couponId,
      status,
      reason,
    }: {
      id: string
      status: 'active' | 'paused'
      reason?: string
    }) => updateSellerCouponStatus(couponId, status, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons', id] })
      toast.success(`Coupon ${newStatus === 'active' ? 'activated' : 'paused'}!`)
      setStatusModalVisible(false)
      setCouponToUpdate(null)
      setNewStatus('active')
      setStatusReason('')
    },
    onError: (error: MutationError) => {
      toast.error(error?.response?.data?.error || 'Failed to update coupon status')
    },
  })

  const deleteCouponMutation = useMutation({
    mutationFn: (couponId: string) => deleteSellerCoupon(couponId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellerCoupons', id] })
      toast.success('Coupon deleted!')
    },
    onError: (error: MutationError) => {
      toast.error(error?.response?.data?.error || 'Failed to delete coupon')
    },
  })

  const { data: globalSettlement } = useGlobalSettlementSettings()
  const { data: sellerSettlement, isLoading: isLoadingSellerSettlement } =
    useSellerSettlementSettings(id)
  const upsertSellerSettlement = useUpsertSellerSettlementSettings()
  const [settlementForm] = Form.useForm()

  const { data: sellerBatches, isLoading: isLoadingSellerBatches } = useSettlementBatches(
    id ? { seller: id, page: 1, limit: 10 } : undefined,
  )

  // Call useSellerLedger at the top level (before any conditional returns) to avoid hooks order violation
  // The query will be disabled if id is missing or user is not a seller (checked after user loads)
  // We use a safe check: if user exists and is seller, enable; otherwise disable
  const isSellerCheck = user?.role === 'seller'
  const { data: sellerLedger, refetch: refetchSellerLedger } = useSellerLedger(
    id || undefined,
    !!isSellerCheck,
  )

  const createAdjustment = useCreateManualAdjustment()

  const productColumns: ColumnsType<AdminProduct> = [
    {
      title: 'Product',
      dataIndex: 'name',
      render: (_: unknown, r) => (
        <Space>
          <Image
            src={r.mainImage}
            width={40}
            height={40}
            style={{ objectFit: 'cover' }}
            fallback=""
          />
          <Link to={`/products/${r._id}`}>{r.name}</Link>
        </Space>
      ),
    },
    { title: 'Status', dataIndex: 'status', width: 120 },
    {
      title: 'Stock',
      dataIndex: 'totalStock',
      width: 100,
      render: (_: unknown, r) => (r.hasVariants ? r.totalStock ?? 0 : r.stock ?? 0),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      width: 180,
      render: (
        category:
          | string
          | { name?: string; parent?: string | { name?: string } }
          | null
          | undefined,
      ) => {
        if (!category) return '-'
        const categoryName = typeof category === 'string' ? category : category.name || ''
        const parent =
          typeof category === 'object' && category.parent
            ? typeof category.parent === 'string'
              ? null
              : category.parent
            : null
        const parentName = parent?.name || null
        const displayText = parentName ? `${parentName} > ${categoryName}` : categoryName
        return (
          <span title={displayText} style={{ maxWidth: 180, display: 'inline-block' }}>
            {displayText}
          </span>
        )
      },
    },
  ]

  const handleApproveReject = async (isApproved: boolean) => {
    if (!id) return
    try {
      await updateApproval.mutateAsync({ id, isApproved })
      message.success(`Seller ${isApproved ? 'approved' : 'rejected'} successfully!`)
      refetch() // Refetch user data to update status
    } catch {
      message.error(`Failed to ${isApproved ? 'approve' : 'reject'} seller.`)
    }
  }

  const handleSearchOrders = async (searchText: string) => {
    if (!id || !searchText || searchText.trim().length < 2) {
      setOrderSearchOptions([])
      return
    }

    setOrderSearchLoading(true)
    try {
      const response = await searchSellerOrdersApi(id, searchText.trim())
      setOrderSearchOptions(response.data || [])
    } catch (error) {
      console.error('Error searching orders:', error)
      setOrderSearchOptions([])
    } finally {
      setOrderSearchLoading(false)
    }
  }

  const handleSubmitAdjustment = async () => {
    if (!id) return

    try {
      const values = await adjustmentForm.validateFields()
      if (!values.confirmed) {
        message.error('Please confirm that you understand this will affect future settlements')
        return
      }

      await createAdjustment.mutateAsync({
        sellerId: id,
        payload: {
          type: values.type,
          amount: values.amount,
          description: values.description || undefined,
          order_id: values.orderId || undefined,
        },
      })

      message.success('Manual adjustment created successfully')
      setIsAdjustmentModalOpen(false)
      adjustmentForm.resetFields()
      setOrderSearchOptions([])
      refetchSellerLedger()
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // Form validation errors
        return
      }
      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? String(error.message)
          : 'Failed to create manual adjustment'
      message.error(errorMessage)
    }
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !user) {
    return (
      <Card title="User Details">
        <p>Error loading user details or user not found.</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </Card>
    )
  }

  const isSeller = user.role === 'seller'

  const effectiveGlobal = globalSettlement?.data
  const sellerSettingsData = sellerSettlement?.data || null
  const allowSellerOverride = effectiveGlobal?.allowSellerOverride ?? true

  const activeTab = searchParams.get('tab') || 'overview'

  const handleTabChange = (key: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next)
  }

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            User Details: {displayVal(user.name)}
          </Title>
        </div>
      }
      extra={
        user.role === 'seller' && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {user.isApproved && (
              <Button
                icon={<FileTextOutlined />}
                onClick={() => navigate(`/sellers/${id}/reports`)}
              >
                View Reports
              </Button>
            )}
            {user.kycSubmitted && (
              <PermissionGate module="sellerManagement" permission="approve">
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!user.isApproved && (
                    <PermissionButton
                      module="sellerManagement"
                      permission="approve"
                      type="primary"
                      onClick={() => handleApproveReject(true)}
                      loading={updateApproval.isPending}
                    >
                      Approve Seller
                    </PermissionButton>
                  )}
                  {user.isApproved && (
                    <PermissionButton
                      module="sellerManagement"
                      permission="approve"
                      danger
                      onClick={() => handleApproveReject(false)}
                      loading={updateApproval.isPending}
                    >
                      Revoke Approval
                    </PermissionButton>
                  )}
                </div>
              </PermissionGate>
            )}
          </div>
        )
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          { key: 'overview', label: 'Overview' },
          ...(isSeller
            ? [
                { key: 'settlements', label: 'Settlements' },
                { key: 'products', label: 'Products' },
                { key: 'coupons', label: 'Coupons' },
              ]
            : []),
        ]}
      />

      {activeTab === 'overview' && (
        <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} layout="vertical">
          <Descriptions.Item label="Name">{displayVal(user.name)}</Descriptions.Item>
          <Descriptions.Item label="Email">{displayVal(user.email)}</Descriptions.Item>
          <Descriptions.Item label="Role">
            <Tag
              color={
                user.role === 'super-admin' ? 'blue' : user.role === 'seller' ? 'purple' : 'green'
              }
            >
              {displayVal(user.role)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Phone">{displayVal(user.phone)}</Descriptions.Item>
          <Descriptions.Item label="Email Verified">
            {user.isEmailVerified ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Phone Verified">
            {user.isPhoneVerified ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Account Status">
            {user.isBlocked ? <Tag color="red">Blocked</Tag> : <Tag color="green">Active</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {displayDate(user.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="Last Updated">
            {displayDate(user.updatedAt)}
          </Descriptions.Item>

          {isSeller && (
            <>
              <Descriptions.Item label="Business Name">
                {displayVal(user.businessName)}
              </Descriptions.Item>
              <Descriptions.Item label="Store Slug">
                {displayVal(user.storeSlug)}
              </Descriptions.Item>
              <Descriptions.Item label="Store Status">
                {user.storeStatus ? (
                  <Tag color={user.storeStatus === 'active' ? 'green' : 'orange'}>
                    {displayVal(user.storeStatus)}
                  </Tag>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="KYC Submitted">
                {user.kycSubmitted ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Approval">
                {user.isApproved ? (
                  <Tag color="green">Approved</Tag>
                ) : (
                  <Tag color="orange">Pending</Tag>
                )}
              </Descriptions.Item>
              {user.rejectionReason && (
                <Descriptions.Item label="Rejection Reason" span={3}>
                  <span style={{ color: '#ff4d4f' }}>{displayVal(user.rejectionReason)}</span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Store Description" span={3}>
                {displayVal(user.storeDescription)}
              </Descriptions.Item>
              <Descriptions.Item label="Business Type">
                {displayVal(user.businessType)}
              </Descriptions.Item>
              <Descriptions.Item label="Registration No.">
                {displayVal(user?.businessRegistrationNumber)}
              </Descriptions.Item>
              <Descriptions.Item label="Date of Establishment">
                {displayDate(user.dateOfEstablishment, 'YYYY-MM-DD')}
              </Descriptions.Item>
              <Descriptions.Item label="Address">
                {[
                  displayVal(user.addressLine1, ''),
                  displayVal(user.addressLine2, ''),
                  displayVal(user.city, ''),
                  displayVal(user.state, ''),
                  displayVal(user.postalCode, ''),
                  displayVal(user.country, ''),
                ]
                  .filter(Boolean)
                  .join(', ') || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Store Contact Email">
                {displayVal(user.storeEmail)}
              </Descriptions.Item>
              <Descriptions.Item label="Store Contact Phone">
                {displayVal(user.storePhone)}
              </Descriptions.Item>
              <Descriptions.Item label="Bank Account">
                {displayVal(user.bankAccountNumber)}
              </Descriptions.Item>
              <Descriptions.Item label="Account Holder">
                {displayVal(user.accountHolderName)}
              </Descriptions.Item>
              <Descriptions.Item label="Bank Name">{displayVal(user.bankName)}</Descriptions.Item>
              <Descriptions.Item label="IFSC Code">{displayVal(user.ifscCode)}</Descriptions.Item>
              <Descriptions.Item label="PAN Number">{displayVal(user.panNumber)}</Descriptions.Item>
              <Descriptions.Item label="GST Number">{displayVal(user.gstNumber)}</Descriptions.Item>
              <Descriptions.Item label="Aadhaar Number">
                {displayVal(user.aadhaarNumber)}
              </Descriptions.Item>
              <Descriptions.Item label="Authorized Person Name">
                {displayVal(user.authorizedPersonName)}
              </Descriptions.Item>
              <Descriptions.Item label="Authorized Person Designation">
                {displayVal(user.authorizedPersonDesignation)}
              </Descriptions.Item>
              {/* Document links */}
              <Descriptions.Item label="Store Logo">
                {user.storeLogo ? (
                  <a href={user.storeLogo} target="_blank" rel="noopener noreferrer">
                    View Logo
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="ID Proof">
                {user.idProof ? (
                  <a href={user.idProof} target="_blank" rel="noopener noreferrer">
                    View ID Proof
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Address Proof">
                {user.addressProof ? (
                  <a href={user.addressProof} target="_blank" rel="noopener noreferrer">
                    View Address Proof
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="GST Certificate">
                {user.gstCertificate ? (
                  <a href={user.gstCertificate} target="_blank" rel="noopener noreferrer">
                    View GST Certificate
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Certificate of Incorporation">
                {user.certificateOfIncorporation ? (
                  <a
                    href={user.certificateOfIncorporation}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Certificate
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Trust Deed">
                {user.trustDeed ? (
                  <a href={user.trustDeed} target="_blank" rel="noopener noreferrer">
                    View Trust Deed
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Cancelled Cheque">
                {user.cancelledCheque ? (
                  <a href={user.cancelledCheque} target="_blank" rel="noopener noreferrer">
                    View Document
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Website">
                {user.website ? (
                  <a href={user.website} target="_blank" rel="noopener noreferrer">
                    {user.website}
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Social (Instagram)">
                {user.instagram ? (
                  <a href={user.instagram} target="_blank" rel="noopener noreferrer">
                    {user.instagram}
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Social (Facebook)">
                {user.facebook ? (
                  <a href={user.facebook} target="_blank" rel="noopener noreferrer">
                    {user.facebook}
                  </a>
                ) : (
                  'N/A'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Notifications" span={3}>
                <Space direction="vertical" size={4}>
                  <div>
                    New order notifications:{' '}
                    {user.newOrderNotification ? (
                      <Tag color="green">Enabled</Tag>
                    ) : (
                      <Tag>Disabled</Tag>
                    )}
                  </div>
                  <div>
                    Low stock notifications:{' '}
                    {user.lowStockNotification ? (
                      <Tag color="green">Enabled</Tag>
                    ) : (
                      <Tag>Disabled</Tag>
                    )}
                  </div>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Agreements & Consents" span={3}>
                <Space direction="vertical" size={4}>
                  <div>
                    Marketplace Terms:{' '}
                    {user.marketplaceTermsAccepted ? (
                      <Tag color="green">Accepted</Tag>
                    ) : (
                      <Tag>Pending</Tag>
                    )}
                  </div>
                  <div>
                    Seller Agreement:{' '}
                    {user.sellerAgreementSigned ? (
                      <Tag color="green">Signed</Tag>
                    ) : (
                      <Tag>Pending</Tag>
                    )}
                  </div>
                  <div>
                    Return & Refund Policy:{' '}
                    {user.returnRefundPolicyAccepted ? (
                      <Tag color="green">Accepted</Tag>
                    ) : (
                      <Tag>Pending</Tag>
                    )}
                  </div>
                  <div>
                    Prohibited Items Declaration:{' '}
                    {user.prohibitedItemsDeclared ? (
                      <Tag color="green">Submitted</Tag>
                    ) : (
                      <Tag>Pending</Tag>
                    )}
                  </div>
                  <div>
                    Data Privacy Consent:{' '}
                    {user.dataPrivacyConsent ? <Tag color="green">Given</Tag> : <Tag>Pending</Tag>}
                  </div>
                </Space>
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      )}

      {isSeller && activeTab === 'settlements' && (
        <Card style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={5} style={{ margin: 0 }}>
              Settlement Settings
            </Title>
            <Button
              type="primary"
              icon={<SettingOutlined />}
              onClick={() => setIsSettlementModalOpen(true)}
              loading={isLoadingSellerSettlement}
            >
              Configure Settlement Settings
            </Button>
          </div>
        </Card>
      )}

      {isSeller && activeTab === 'settlements' && (
        <Modal
          title="Settlement Settings"
          open={isSettlementModalOpen}
          onCancel={() => setIsSettlementModalOpen(false)}
          footer={null}
          width={700}
          destroyOnClose
        >
          {!effectiveGlobal ? (
            <div className="text-sm text-slate-600">
              Global settlement settings are not configured yet.
            </div>
          ) : (
            <>
              {!allowSellerOverride && (
                <div className="mb-3 text-sm text-slate-600">
                  Global settlement settings override seller-level settings. You can change this in{' '}
                  <strong>Settings → Settlement Settings</strong>.
                </div>
              )}
              <div className="mb-3 text-xs text-slate-600">
                These settings control how this seller&apos;s orders are settled:
                <br />- The effective hold period before settlement is:{' '}
                <strong>product return period + Return Window Days</strong>.
                <br />- Commission settings define how much the platform deducts from each order
                before paying the seller.
              </div>

              <Form
                layout="vertical"
                form={settlementForm}
                initialValues={{
                  isActiveOverride: sellerSettingsData?.isActiveOverride ?? false,
                  settlementCycle:
                    sellerSettingsData?.settlementCycle ?? effectiveGlobal.settlementCycle,
                  customCycleDays:
                    sellerSettingsData?.customCycleDays ?? effectiveGlobal.customCycleDays,
                  returnWindowDays:
                    sellerSettingsData?.returnWindowDays ?? effectiveGlobal.returnWindowDays,
                  commissionType:
                    sellerSettingsData?.commissionType ?? effectiveGlobal.commissionType,
                  commissionValue:
                    sellerSettingsData?.commissionValue ?? effectiveGlobal.commissionValue,
                  minBatchAmount:
                    sellerSettingsData?.minBatchAmount ?? effectiveGlobal.minBatchAmount,
                }}
                onFinish={async (values) => {
                  if (!id) return
                  try {
                    await upsertSellerSettlement.mutateAsync({
                      sellerId: id,
                      payload: values,
                    })
                    message.success('Settlement settings updated')
                    setIsSettlementModalOpen(false)
                  } catch (e) {
                    message.error(
                      (e as Error)?.message || 'Failed to update seller settlement settings',
                    )
                  }
                }}
              >
                <Form.Item
                  name="isActiveOverride"
                  label="Use custom settings for this seller"
                  valuePropName="checked"
                >
                  <Switch disabled={!allowSellerOverride} />
                </Form.Item>

                <Divider />

                <Form.Item shouldUpdate noStyle>
                  {({ getFieldValue }) => {
                    const active = allowSellerOverride && getFieldValue('isActiveOverride')
                    const disabled = !active

                    return (
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {disabled && (
                          <Text type="secondary" className="text-sm">
                            Using global defaults. Toggle "Use custom settings for this seller" to
                            override.
                          </Text>
                        )}

                        <Form.Item
                          name="settlementCycle"
                          label="Settlement Cycle"
                          rules={[{ required: true, message: 'Please select a cycle' }]}
                          extra="High-level indication of how often you intend to settle this seller (actual generation is driven by your batch logic)."
                        >
                          <Segmented
                            options={[
                              { label: 'Daily', value: 'DAILY' },
                              { label: 'Weekly', value: 'WEEKLY' },
                              { label: 'Custom', value: 'CUSTOM' },
                            ]}
                            disabled={disabled}
                          />
                        </Form.Item>

                        <Form.Item shouldUpdate noStyle>
                          {({ getFieldValue: gf }) =>
                            gf('settlementCycle') === 'CUSTOM' ? (
                              <Form.Item
                                name="customCycleDays"
                                label="Custom Cycle Days"
                                rules={[
                                  { required: true, message: 'Please enter custom cycle days' },
                                ]}
                              >
                                <InputNumber min={1} max={90} disabled={disabled} />
                              </Form.Item>
                            ) : null
                          }
                        </Form.Item>

                        <Form.Item
                          name="returnWindowDays"
                          label="Return Window Days"
                          rules={[{ required: true, message: 'Please enter return window days' }]}
                          extra="Extra buffer added after each product's own return policy before this seller's orders become settlement-eligible."
                        >
                          <InputNumber min={0} max={60} disabled={disabled} />
                        </Form.Item>

                        <Form.Item
                          name="commissionType"
                          label="Commission Type"
                          rules={[{ required: true, message: 'Please select commission type' }]}
                          extra="Percentage = share of seller earnings; Fixed = flat amount per order."
                        >
                          <Segmented
                            options={[
                              { label: 'Percentage', value: 'PERCENTAGE' },
                              { label: 'Fixed', value: 'FIXED' },
                            ]}
                            disabled={disabled}
                          />
                        </Form.Item>

                        <Form.Item
                          name="commissionValue"
                          label="Commission Value"
                          rules={[{ required: true, message: 'Please enter commission value' }]}
                          extra="If Percentage, this is % of seller earnings; if Fixed, this is a flat deduction per order."
                        >
                          <InputNumber min={0} disabled={disabled} />
                        </Form.Item>

                        <Form.Item
                          name="minBatchAmount"
                          label="Minimum Batch Amount (optional)"
                          extra="If set, this seller only gets a new batch when the sum of their net payouts reaches at least this amount. Smaller eligibile amounts will wait and roll into the next batch."
                        >
                          <InputNumber min={0} disabled={disabled} />
                        </Form.Item>

                        <Form.Item>
                          <Space>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={upsertSellerSettlement.isPending}
                              disabled={!allowSellerOverride}
                            >
                              Save Settlement Settings
                            </Button>
                            <Button onClick={() => setIsSettlementModalOpen(false)}>Cancel</Button>
                          </Space>
                        </Form.Item>
                      </Space>
                    )
                  }}
                </Form.Item>
              </Form>
            </>
          )}
        </Modal>
      )}

      {isSeller && activeTab === 'settlements' && (
        <Card title="Settlement Batches" style={{ marginTop: 24 }}>
          <Table
            rowKey="_id"
            loading={isLoadingSellerBatches}
            size="small"
            dataSource={sellerBatches?.data || []}
            pagination={
              sellerBatches?.pagination
                ? {
                    current: sellerBatches.pagination.page,
                    pageSize: sellerBatches.pagination.limit,
                    total: sellerBatches.pagination.total,
                  }
                : false
            }
            columns={[
              {
                title: 'Batch ID',
                dataIndex: '_id',
                render: (value: string) => <Link to={`/settlements/${value}`}>{value}</Link>,
              },
              {
                title: 'Period',
                key: 'period',
                render: (_: unknown, record: SettlementBatch) =>
                  `${dayjs(record.fromDate).format('DD MMM YYYY')} – ${dayjs(record.toDate).format(
                    'DD MMM YYYY',
                  )}`,
              },
              {
                title: 'Orders',
                dataIndex: 'ordersCount',
              },
              {
                title: 'Total Net Payout',
                dataIndex: 'totalNetPayout',
                render: (value: number) => `₹${(value || 0).toFixed(2)}`,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (value: string) => (
                  <Tag color={value === 'PAID' ? 'green' : 'orange'}>{value}</Tag>
                ),
              },
              {
                title: 'Created At',
                dataIndex: 'createdAt',
                render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
              },
              {
                title: 'Action',
                key: 'action',
                render: (_: unknown, record: SettlementBatch) => (
                  <Link to={`/settlements/${record._id}`}>View &amp; Settle</Link>
                ),
              },
            ]}
          />
        </Card>
      )}

      {isSeller && activeTab === 'settlements' && sellerLedger && (
        <Card
          title="Seller Ledger Snapshot"
          style={{ marginTop: 24 }}
          extra={
            <Button
              type="primary"
              onClick={() => {
                adjustmentForm.resetFields()
                setIsAdjustmentModalOpen(true)
              }}
            >
              Add Manual Adjustment
            </Button>
          }
        >
          <Descriptions column={4} labelStyle={{ fontWeight: 500 }}>
            <Descriptions.Item label="Opening Balance">
              ₹{sellerLedger.data.openingBalance.toFixed(2)}
            </Descriptions.Item>
            <Descriptions.Item label="Closing Balance">
              <div>
                <span
                  style={{
                    fontWeight: 600,
                    color: sellerLedger.data.closingBalance < 0 ? '#dc2626' : '#059669',
                  }}
                >
                  ₹{sellerLedger.data.closingBalance.toFixed(2)}
                </span>
                {sellerLedger.data.closingBalance < 0 && (
                  <div style={{ fontSize: 12, marginTop: 4, color: '#666' }}>
                    This amount will be adjusted in their next settlement.
                  </div>
                )}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Total Entries">
              {sellerLedger.data.totalEntries ?? sellerLedger.data.entries.length}
            </Descriptions.Item>
            <Descriptions.Item label="Entries Shown">
              {sellerLedger.data.entries.length}
            </Descriptions.Item>
          </Descriptions>

          <Table
            size="small"
            style={{ marginTop: 16 }}
            rowKey="_id"
            dataSource={sellerLedger.data.entries}
            pagination={false}
            columns={[
              {
                title: 'Date',
                dataIndex: 'createdAt',
                width: 180,
                render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
              },
              {
                title: 'Type',
                dataIndex: 'entryType',
                width: 100,
                render: (value: 'CREDIT' | 'DEBIT') => (
                  <Tag color={value === 'CREDIT' ? 'green' : 'red'}>{value}</Tag>
                ),
              },
              {
                title: 'Transaction',
                dataIndex: 'reasonLabel',
                key: 'reason',
                width: 200,
                render: (value: string | undefined, record: SellerLedgerEntryDto) =>
                  value || record.reason,
              },
              {
                title: 'Order',
                key: 'order',
                width: 150,
                render: (_: unknown, record: SellerLedgerEntryDto) => {
                  if (record.order?.orderNumber) {
                    return (
                      <Link to={`/orders/${record.order._id}`} target="_blank">
                        {record.order.orderNumber}
                      </Link>
                    )
                  }
                  return <span style={{ color: '#999' }}>—</span>
                },
              },
              {
                title: 'Settlement',
                key: 'settlement',
                width: 180,
                render: (_: unknown, record: SellerLedgerEntryDto) => {
                  if (record.settlementBatch) {
                    const batch = record.settlementBatch
                    const period = `${dayjs(batch.fromDate).format('DD MMM')} – ${dayjs(
                      batch.toDate,
                    ).format('DD MMM YYYY')}`
                    return (
                      <Link to={`/settlements/${batch._id}`}>
                        <div>
                          <div style={{ fontSize: 12 }}>{period}</div>
                          <Tag
                            color={batch.status === 'PAID' ? 'green' : 'orange'}
                            style={{ marginTop: 4 }}
                          >
                            {batch.status}
                          </Tag>
                        </div>
                      </Link>
                    )
                  }
                  return <span style={{ color: '#999' }}>—</span>
                },
              },
              {
                title: 'Amount',
                dataIndex: 'amount',
                width: 120,
                align: 'right' as const,
                render: (value: number, record: SellerLedgerEntryDto) => (
                  <span
                    style={{
                      fontWeight: 600,
                      color: record.entryType === 'DEBIT' ? '#dc2626' : '#059669',
                    }}
                  >
                    {record.entryType === 'DEBIT' ? '-' : '+'}₹{value.toFixed(2)}
                  </span>
                ),
              },
              {
                title: 'Running Balance',
                dataIndex: 'runningBalance',
                key: 'runningBalance',
                width: 140,
                align: 'right' as const,
                render: (value: number | undefined) => {
                  if (value === undefined) return '—'
                  return (
                    <span
                      style={{
                        fontWeight: 600,
                        color: value < 0 ? '#dc2626' : value > 0 ? '#059669' : '#666',
                      }}
                    >
                      ₹{value.toFixed(2)}
                    </span>
                  )
                },
              },
              {
                title: 'Description',
                dataIndex: 'description',
                render: (value?: string | null) => (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {value || '—'}
                  </Text>
                ),
              },
            ]}
            scroll={{ x: 1200 }}
          />

          <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            <div>
              This table shows recent ledger entries for this seller, including refunds and manual
              adjustments.
            </div>
            <div>
              Negative closing balance means future settlements will first adjust this amount before
              paying out.
            </div>
          </div>
        </Card>
      )}

      {user.role === 'seller' && activeTab === 'products' && (
        <Card style={{ marginTop: 16 }} title="Seller Products">
          <Table<AdminProduct>
            rowKey="_id"
            size="small"
            loading={isLoadingSellerProducts}
            columns={productColumns}
            dataSource={sellerProductsData?.products || []}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {user.role === 'seller' && activeTab === 'coupons' && (
        <Card style={{ marginTop: 16 }} title="Seller Coupons">
          <div style={{ marginBottom: 16 }}>
            <Select
              placeholder="Filter by status"
              allowClear
              value={couponStatusFilter || undefined}
              onChange={(value) => {
                setCouponStatusFilter(value || '')
                setCouponPage(1)
              }}
              style={{ width: 200 }}
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
                { label: 'Expired', value: 'expired' },
              ]}
            />
          </div>
          <Table<SellerCoupon>
            rowKey="_id"
            size="small"
            loading={isLoadingSellerCoupons}
            dataSource={sellerCouponsData?.coupons || []}
            pagination={{
              current: couponPage,
              pageSize: 10,
              total: sellerCouponsData?.pagination?.total || 0,
              showSizeChanger: false,
              onChange: (page) => setCouponPage(page),
            }}
            columns={[
              {
                title: 'Code',
                dataIndex: 'couponCode',
                key: 'couponCode',
                width: 120,
                render: (code: string) => (
                  <Tag color="blue" className="font-mono font-semibold">
                    {code || 'Auto'}
                  </Tag>
                ),
              },
              {
                title: 'Type',
                dataIndex: 'discountType',
                key: 'discountType',
                width: 100,
                render: (type: string) => (
                  <Tag color={type === 'percent' ? 'green' : 'orange'}>
                    {type === 'percent' ? '%' : '₹'}
                  </Tag>
                ),
              },
              {
                title: 'Value',
                key: 'value',
                width: 120,
                render: (_: unknown, record: SellerCoupon) => (
                  <span className="font-semibold">
                    {record.discountType === 'percent'
                      ? `${record.discountValue}%`
                      : `₹${record.discountValue}`}
                  </span>
                ),
              },
              {
                title: 'Scope',
                key: 'scope',
                width: 150,
                render: (_: unknown, record: SellerCoupon) => {
                  if (record.productIds && record.productIds.length > 0) {
                    return <Tag color="cyan">{record.productIds.length} Product(s)</Tag>
                  }
                  if (record.categoryIds && record.categoryIds.length > 0) {
                    return <Tag color="purple">{record.categoryIds.length} Category(ies)</Tag>
                  }
                  return <Tag color="default">All Products</Tag>
                },
              },
              {
                title: 'Usage',
                key: 'usage',
                width: 120,
                render: (_: unknown, record: SellerCoupon) => (
                  <span>
                    {record.redeemedCount || 0} / {record.maxRedemptions || '∞'}
                  </span>
                ),
              },
              {
                title: 'Valid Period',
                key: 'validPeriod',
                width: 200,
                render: (_: unknown, record: SellerCoupon) => (
                  <div className="text-xs">
                    <div>From: {dayjs(record.startDate).format('MMM DD, YYYY')}</div>
                    <div>To: {dayjs(record.endDate).format('MMM DD, YYYY')}</div>
                  </div>
                ),
              },
              {
                title: 'Status',
                key: 'status',
                width: 150,
                render: (_: unknown, record: SellerCoupon) => {
                  const statusColors: Record<string, string> = {
                    active: 'green',
                    paused: 'orange',
                    expired: 'red',
                  }
                  return (
                    <div className="flex flex-col gap-1">
                      <Tag color={statusColors[record.status]}>{record.status.toUpperCase()}</Tag>
                      {record.requiresApproval && (
                        <Tag color={record.isApproved ? 'green' : 'red'}>
                          {record.isApproved ? 'Approved' : 'Pending'}
                        </Tag>
                      )}
                      {record.deactivationReason && record.status === 'paused' && (
                        <div className="text-xs text-gray-500 mt-1" title={record.deactivationReason}>
                          Reason: {record.deactivationReason.length > 30 
                            ? `${record.deactivationReason.substring(0, 30)}...` 
                            : record.deactivationReason}
                        </div>
                      )}
                    </div>
                  )
                },
              },
              {
                title: 'Actions',
                key: 'actions',
                fixed: 'right' as const,
                width: 200,
                render: (_: unknown, record: SellerCoupon) => (
                  <Space>
                    <Button
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => setSelectedCoupon(record._id)}
                    >
                      View
                    </Button>
                    {record.requiresApproval && !record.isApproved && (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => approveCouponMutation.mutate(record._id)}
                          loading={approveCouponMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="small"
                          danger
                          onClick={() => {
                            Modal.confirm({
                              title: 'Deny Coupon',
                              content: 'Are you sure you want to deny this coupon?',
                              okText: 'Deny',
                              okType: 'danger',
                              onOk: () => denyCouponMutation.mutate({ id: record._id }),
                            })
                          }}
                          loading={denyCouponMutation.isPending}
                        >
                          Deny
                        </Button>
                      </>
                    )}
                    {record.status === 'active' && (
                      <Button
                        size="small"
                        icon={<PauseCircleOutlined />}
                        onClick={() => {
                          setCouponToPause(record._id)
                          setPauseModalVisible(true)
                        }}
                        loading={pauseCouponMutation.isPending}
                        danger
                        title="Pause this coupon"
                      >
                        Pause
                      </Button>
                    )}
                    {record.status === 'paused' && (
                      <Button
                        size="small"
                        icon={<PlayCircleOutlined />}
                        onClick={() => {
                          setCouponToUpdate(record._id)
                          setNewStatus('active')
                          setStatusModalVisible(true)
                        }}
                        loading={updateStatusMutation.isPending}
                        type="primary"
                        title="Activate this coupon"
                      >
                        Activate
                      </Button>
                    )}
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        Modal.confirm({
                          title: 'Delete Coupon',
                          content: 'Are you sure you want to delete this coupon? This action cannot be undone.',
                          okText: 'Delete',
                          okType: 'danger',
                          onOk: () => deleteCouponMutation.mutate(record._id),
                        })
                      }}
                      loading={deleteCouponMutation.isPending}
                    >
                      Delete
                    </Button>
                  </Space>
                ),
              },
            ]}
            scroll={{ x: 1200 }}
          />
        </Card>
      )}

      {/* Manual Adjustment Modal */}
      <Modal
        title="Add Manual Adjustment"
        open={isAdjustmentModalOpen}
        onCancel={() => {
          setIsAdjustmentModalOpen(false)
          adjustmentForm.resetFields()
        }}
        onOk={handleSubmitAdjustment}
        confirmLoading={createAdjustment.isPending}
        width={600}
        okText="Create Adjustment"
        okButtonProps={{
          danger: adjustmentForm.getFieldValue('type') === 'debit',
        }}
      >
        <Alert
          message="Financial Impact"
          description="This adjustment will be recorded in the seller's ledger and will affect their future settlement calculations. This action is logged and cannot be undone."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form form={adjustmentForm} layout="vertical">
          <Form.Item
            name="type"
            label="Adjustment Type"
            rules={[{ required: true, message: 'Please select adjustment type' }]}
            extra="Credit increases seller payout, Debit reduces seller payout"
          >
            <Select
              placeholder="Select adjustment type"
              options={[
                { label: 'Credit (increase seller payout)', value: 'credit' },
                { label: 'Debit (reduce seller payout)', value: 'debit' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="amount"
            label="Amount (₹)"
            rules={[
              { required: true, message: 'Please enter amount' },
              { type: 'number', min: 0.01, message: 'Amount must be greater than 0' },
            ]}
            extra="Enter the adjustment amount in Indian Rupees"
          >
            <InputNumber
              min={0.01}
              step={0.01}
              precision={2}
              style={{ width: '100%' }}
              prefix="₹"
              placeholder="0.00"
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Reason for Adjustment"
            rules={[
              { required: true, message: 'Please provide a reason for this adjustment' },
              { min: 10, message: 'Reason must be at least 10 characters' },
            ]}
            extra="Provide a clear, detailed reason for this adjustment. This will be visible in audit logs and seller ledger."
          >
            <Input.TextArea
              rows={4}
              placeholder="Example: Compensation for shipping delay, Penalty for order cancellation, Bonus for performance, etc."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Form.Item
            name="orderId"
            label="Link to Order (Optional)"
            extra="If this adjustment is related to a specific order, search by Order ID or Order Number"
          >
            <AutoComplete
              placeholder="Search order by Order ID / Order Number"
              allowClear
              options={orderSearchOptions.map((order) => ({
                value: order._id,
                label: order.label,
              }))}
              onSearch={handleSearchOrders}
              filterOption={false}
              notFoundContent={
                orderSearchLoading ? (
                  <div style={{ textAlign: 'center', padding: 8 }}>
                    <Spin size="small" />
                  </div>
                ) : orderSearchOptions.length === 0 && adjustmentForm.getFieldValue('orderId') ? (
                  <div style={{ textAlign: 'center', padding: 8, color: '#999' }}>
                    No orders found
                  </div>
                ) : null
              }
            />
          </Form.Item>

          <Form.Item
            name="confirmed"
            valuePropName="checked"
            rules={[
              {
                validator: (_: unknown, value: boolean) => {
                  if (!value) {
                    return Promise.reject(
                      new Error(
                        'You must confirm that you understand this will affect future settlements',
                      ),
                    )
                  }
                  return Promise.resolve()
                },
              },
            ]}
          >
            <Checkbox>
              <Text strong>I understand this will affect future settlements</Text>
            </Checkbox>
          </Form.Item>
        </Form>
      </Modal>

      {/* Coupon Detail Modal */}
      <Modal
        title="Coupon Details"
        open={!!selectedCoupon}
        onCancel={() => setSelectedCoupon(null)}
        footer={
          couponDetail && (
            <Space>
              {couponDetail.coupon.status === 'active' && (
                <Button
                  danger
                  icon={<PauseCircleOutlined />}
                  onClick={() => {
                    setSelectedCoupon(null)
                    setCouponToPause(couponDetail.coupon._id)
                    setPauseModalVisible(true)
                  }}
                  loading={pauseCouponMutation.isPending}
                >
                  Pause Coupon
                </Button>
              )}
              {couponDetail.coupon.status === 'paused' && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    setSelectedCoupon(null)
                    setCouponToUpdate(couponDetail.coupon._id)
                    setNewStatus('active')
                    setStatusModalVisible(true)
                  }}
                  loading={updateStatusMutation.isPending}
                >
                  Activate Coupon
                </Button>
              )}
              <Button onClick={() => setSelectedCoupon(null)}>Close</Button>
            </Space>
          )
        }
        width={800}
      >
        {couponDetail && (
          <div className="space-y-4">
            <div>
              <Text strong>Coupon Code: </Text>
              <Tag color="blue" className="font-mono">
                {couponDetail.coupon.couponCode || 'Auto'}
              </Tag>
            </div>
            <div>
              <Text strong>Status: </Text>
              <Tag
                color={
                  couponDetail.coupon.status === 'active'
                    ? 'green'
                    : couponDetail.coupon.status === 'paused'
                    ? 'orange'
                    : 'red'
                }
              >
                {couponDetail.coupon.status.toUpperCase()}
              </Tag>
            </div>
            <div>
              <Text strong>Seller: </Text>
              <Text>
                {typeof couponDetail.coupon.seller === 'object' && couponDetail.coupon.seller !== null && 'businessName' in couponDetail.coupon.seller
                  ? (couponDetail.coupon.seller as { businessName?: string }).businessName || 'N/A'
                  : 'N/A'}
              </Text>
            </div>
            <div>
              <Text strong>Discount: </Text>
              <Text>
                {couponDetail.coupon.discountType === 'percent'
                  ? `${couponDetail.coupon.discountValue}%`
                  : `₹${couponDetail.coupon.discountValue}`}
              </Text>
            </div>
            {couponDetail.coupon.description && (
              <div>
                <Text strong>Description: </Text>
                <Text>{couponDetail.coupon.description}</Text>
              </div>
            )}
            {couponDetail.coupon.deactivationReason && (
              <div>
                <Text strong>Deactivation Reason: </Text>
                <Text type="secondary">{couponDetail.coupon.deactivationReason}</Text>
                {couponDetail.coupon.deactivatedBy && (
                  <div className="mt-2">
                    <Text strong>Deactivated By: </Text>
                    <Text type="secondary">
                      {typeof couponDetail.coupon.deactivatedBy === 'object' && couponDetail.coupon.deactivatedBy !== null && 'name' in couponDetail.coupon.deactivatedBy
                          ? (couponDetail.coupon.deactivatedBy as { name?: string }).name || 'N/A'
                          : 'N/A'}
                    </Text>
                    {couponDetail.coupon.deactivatedAt && (
                      <>
                        <Text strong className="ml-4">
                          On:{' '}
                        </Text>
                        <Text type="secondary">
                          {dayjs(couponDetail.coupon.deactivatedAt).format('MMM DD, YYYY HH:mm')}
                        </Text>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {couponDetail.stats && (
              <div>
                <Text strong>Stats:</Text>
                <ul className="list-disc list-inside ml-4">
                  <li>Total Redemptions: {couponDetail.stats.totalRedemptions}</li>
                  <li>Clipped: {couponDetail.stats.clippedCount}</li>
                  <li>Applied: {couponDetail.stats.appliedCount}</li>
                  <li>Redeemed: {couponDetail.stats.redeemedCount}</li>
                  <li>Unique Users: {couponDetail.stats.uniqueUsers}</li>
                  <li>Total Discount Given: ₹{couponDetail.stats.totalDiscountGiven.toLocaleString()}</li>
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Pause Coupon Modal */}
      <Modal
        title="Pause Coupon"
        open={pauseModalVisible}
        onOk={() => {
          if (couponToPause) {
            pauseCouponMutation.mutate({ id: couponToPause, reason: pauseReason || undefined })
          }
        }}
        onCancel={() => {
          setPauseModalVisible(false)
          setCouponToPause(null)
          setPauseReason('')
        }}
        okText="Pause"
        okType="danger"
        confirmLoading={pauseCouponMutation.isPending}
      >
        <div className="space-y-4">
          <Text>Are you sure you want to pause this coupon?</Text>
          <div>
            <Text strong>Reason (optional):</Text>
            <Input.TextArea
              rows={4}
              placeholder="Enter reason for pausing..."
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
      </Modal>

      {/* Update Status Modal */}
      <Modal
        title={newStatus === 'active' ? 'Activate Coupon' : 'Pause Coupon'}
        open={statusModalVisible}
        onOk={() => {
          if (couponToUpdate) {
            updateStatusMutation.mutate({
              id: couponToUpdate,
              status: newStatus,
              reason: statusReason || undefined,
            })
          }
        }}
        onCancel={() => {
          setStatusModalVisible(false)
          setCouponToUpdate(null)
          setNewStatus('active')
          setStatusReason('')
        }}
        okText={newStatus === 'active' ? 'Activate' : 'Pause'}
        okType={newStatus === 'active' ? 'primary' : 'danger'}
        confirmLoading={updateStatusMutation.isPending}
      >
        <div className="space-y-4">
          <Text>
            Are you sure you want to {newStatus === 'active' ? 'activate' : 'pause'} this coupon?
          </Text>
          {newStatus === 'paused' && (
            <div>
              <Text strong>Reason (optional):</Text>
              <Input.TextArea
                rows={4}
                placeholder="Enter reason for pausing..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className="mt-2"
              />
            </div>
          )}
        </div>
      </Modal>
    </Card>
  )
}

export default UserDetail
