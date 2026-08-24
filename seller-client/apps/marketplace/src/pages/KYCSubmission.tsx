import {
  BankOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  GlobalOutlined,
  IdcardOutlined,
  PictureOutlined,
  ShopOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { UploadFile, UploadProps } from 'antd'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Row,
  Select,
  Space,
  Spin,
  Steps,
  Typography,
  Upload,
  message,
} from 'antd'
import type { RcFile } from 'antd/es/upload'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSaveKYCDraft, useSubmitKYC } from '../api/authQueries'
import { useProfile } from '../api/profileQueries'
import { useAuthStore } from '../store/authStore'
import { lookupPincode } from '../utils/pincodeLookup'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

const KYC_MAX_FILE_MB = 20
const KYC_MAX_FILE_BYTES = KYC_MAX_FILE_MB * 1024 * 1024
const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]
const KYC_DOC_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf']
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']
const DOC_EXTENSIONS = [...IMAGE_EXTENSIONS, 'pdf']

interface KYCFormData {
  // Business/Store Information
  businessName: string
  storeLogo?: UploadFile[]
  businessType: string
  businessRegistrationNumber?: string
  dateOfEstablishment?: string
  storeDescription?: string

  // Business Address
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string

  // Bank Details
  bankAccountNumber?: string
  bankName?: string
  bankBranch?: string
  ifscCode?: string
  accountHolderName?: string

  // Tax & Legal (Individual/Proprietorship)
  panNumber: string
  gstNumber?: string
  aadhaarNumber?: string
  idProof: UploadFile[]
  addressProof?: UploadFile[]
  cancelledCheque?: UploadFile[]

  // Company Documents (Partnership/Pvt Ltd/LLP/Trust)
  certificateOfIncorporation?: UploadFile[]
  companyPan?: UploadFile[]
  gstCertificate?: UploadFile[]
  trustDeed?: UploadFile[]
  partnershipDeed?: UploadFile[]

  // Authorized Person Details (for companies)
  authorizedPersonName?: string
  authorizedPersonDesignation?: string
  authorizedPersonEmail?: string
  authorizedPersonPhone?: string
}

// Indian states for dropdown
const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]

const BUSINESS_TYPES = ['Individual', 'Proprietorship', 'Partnership', 'Pvt Ltd', 'LLP', 'Trust']
const KYC_FILE_HELP_TEXT = `Supported: JPG/PNG/GIF/WebP/AVIF or PDF. Max ${KYC_MAX_FILE_MB}MB per file.`
const KYC_IMAGE_HELP_TEXT = `Images only (JPG/PNG/GIF/WebP/AVIF). Max ${KYC_MAX_FILE_MB}MB.`

/** Fetch state and district/city from Indian pincode (6 digits). Returns { state, city } or null. */
async function fetchLocationFromPincode(
  pincode: string,
): Promise<{ state: string; city: string } | null> {
  return lookupPincode(pincode)
}

/** Match API state name to INDIAN_STATES dropdown value (case-insensitive). */
function matchStateToDropdown(apiState: string): string | undefined {
  const lower = apiState.toLowerCase()
  return INDIAN_STATES.find((s) => s.toLowerCase() === lower) ?? undefined
}

export const KYCSubmission = () => {
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)
  const [businessType, setBusinessType] = useState<string>('')
  const navigate = useNavigate()
  const submitKYCMutation = useSubmitKYC()
  const saveKYCDraftMutation = useSaveKYCDraft()
  const user = useAuthStore((state) => state.user)
  const { data: profileData, isLoading: isLoadingProfile } = useProfile()

  // File upload states
  const [storeLogoFileList, setStoreLogoFileList] = useState<UploadFile[]>([])
  const [idProofFileList, setIdProofFileList] = useState<UploadFile[]>([])
  const [addressProofFileList, setAddressProofFileList] = useState<UploadFile[]>([])
  const [cancelledChequeFileList, setCancelledChequeFileList] = useState<UploadFile[]>([])
  const [gstCertificateFileList, setGstCertificateFileList] = useState<UploadFile[]>([])
  const [certificateOfIncorporationFileList, setCertificateOfIncorporationFileList] = useState<
    UploadFile[]
  >([])
  const [trustDeedFileList, setTrustDeedFileList] = useState<UploadFile[]>([])

  // Pincode lookup (India) – loading state for auto-fill
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false)

  const isIndividualOrProprietorship = ['Individual', 'Proprietorship'].includes(businessType)
  const isCompany = ['Partnership', 'Pvt Ltd', 'LLP'].includes(businessType)
  const isTrust = businessType === 'Trust'

  // Prefer latest email verification status from profile API, fallback to auth store user.
  const isEmailVerified = profileData?.isEmailVerified ?? user?.isEmailVerified ?? false

  // Helper function to create UploadFile from URL
  const createFileFromUrl = (url: string | undefined, name: string): UploadFile[] => {
    if (!url) return []
    return [
      {
        uid: '-1',
        name: name,
        status: 'done',
        url: url,
      },
    ]
  }

  const syncFileList = (
    field: keyof KYCFormData,
    fileList: UploadFile[],
    setFileList: (files: UploadFile[]) => void,
  ) => {
    setFileList(fileList)
    form.setFieldsValue({ [field]: fileList } as Partial<KYCFormData>)
  }

  // Auto-fill state and city from Indian pincode (on blur when 6 digits entered)
  const handlePincodeBlur = useCallback(async () => {
    const country = form.getFieldValue('country')
    if (country !== 'India') return
    const pincode = form.getFieldValue('postalCode')
    if (!pincode || String(pincode).trim().length !== 6) return
    setPincodeLookupLoading(true)
    try {
      const location = await fetchLocationFromPincode(String(pincode).trim())
      if (location) {
        const stateValue = matchStateToDropdown(location.state) ?? location.state
        form.setFieldsValue({
          state: stateValue,
          city: location.city,
        })
        message.success('State and city filled from pincode')
      }
    } finally {
      setPincodeLookupLoading(false)
    }
  }, [form])

  // Prefill form with existing KYC data and restore step when editing or resuming
  useEffect(() => {
    if (profileData) {
      // Set business type first to enable conditional fields
      if (profileData.businessType) {
        setBusinessType(profileData.businessType)
      }

      // Prefill document uploads
      const storeLogoFiles = createFileFromUrl(profileData.storeLogo, 'Store Logo')
      const idProofFiles = createFileFromUrl(profileData.idProof, 'ID Proof')
      const addressProofFiles = createFileFromUrl(profileData.addressProof, 'Address Proof')
      const cancelledChequeFiles = createFileFromUrl(
        profileData.cancelledCheque,
        'Cancelled Cheque',
      )
      const gstCertificateFiles = createFileFromUrl(profileData.gstCertificate, 'GST Certificate')
      const certificateFiles = createFileFromUrl(
        profileData.certificateOfIncorporation,
        'Certificate of Incorporation',
      )
      const trustDeedFiles = createFileFromUrl(profileData.trustDeed, 'Trust Deed')

      setStoreLogoFileList(storeLogoFiles)
      setIdProofFileList(idProofFiles)
      setAddressProofFileList(addressProofFiles)
      setCancelledChequeFileList(cancelledChequeFiles)
      setGstCertificateFileList(gstCertificateFiles)
      setCertificateOfIncorporationFileList(certificateFiles)
      setTrustDeedFileList(trustDeedFiles)

      // Prefill all text form fields
      form.setFieldsValue({
        // Business Information
        businessName: profileData.businessName || '',
        businessType: profileData.businessType || '',
        businessRegistrationNumber: profileData.businessRegistrationNumber || '',
        dateOfEstablishment: profileData.dateOfEstablishment
          ? dayjs(profileData.dateOfEstablishment)
          : undefined,
        storeDescription: profileData.storeDescription || '',

        // Business Address
        addressLine1: profileData.addressLine1 || '',
        addressLine2: profileData.addressLine2 || '',
        city: profileData.city || '',
        state: profileData.state || '',
        postalCode: profileData.postalCode || '',
        country: profileData.country || 'India',

        // Bank Details
        bankAccountNumber: profileData.bankAccountNumber || '',
        accountHolderName: profileData.accountHolderName || '',
        bankName: profileData.bankName || '',
        ifscCode: profileData.ifscCode || '',
        bankBranch: profileData.bankBranch || '',

        // Tax & Legal
        panNumber: profileData.panNumber || '',
        gstNumber: profileData.gstNumber || '',
        aadhaarNumber: profileData.aadhaarNumber || '',

        // Authorized Person (for companies)
        authorizedPersonName: profileData.authorizedPersonName || '',
        authorizedPersonDesignation: profileData.authorizedPersonDesignation || '',
        authorizedPersonEmail: profileData.authorizedPersonEmail || '',
        authorizedPersonPhone: profileData.authorizedPersonPhone || '',

        // File fields (so validation sees them)
        storeLogo: storeLogoFiles,
        idProof: idProofFiles,
        addressProof: addressProofFiles,
        cancelledCheque: cancelledChequeFiles,
        gstCertificate: gstCertificateFiles,
        certificateOfIncorporation: certificateFiles,
        trustDeed: trustDeedFiles,
      })

      // If KYC is not fully submitted yet, automatically jump to the step
      // corresponding to how much data the seller has already filled.
      if (!user?.kycSubmitted) {
        const hasBusinessBasics = !!(profileData.businessName && profileData.businessType)
        const hasAddressBasics = !!(
          profileData.addressLine1 &&
          profileData.city &&
          profileData.state &&
          profileData.postalCode &&
          profileData.country
        )
        const hasBankBasics = !!(
          profileData.bankAccountNumber &&
          profileData.accountHolderName &&
          profileData.bankName &&
          profileData.ifscCode
        )

        if (hasBusinessBasics && hasAddressBasics && !hasBankBasics) {
          setCurrentStep(1) // Business & address done → open Bank step
        } else if (hasBusinessBasics && hasAddressBasics && hasBankBasics) {
          setCurrentStep(2) // Business, address & bank done → open Tax/Documents step
        } else {
          setCurrentStep(0) // Default to first step
        }
      }
    }
  }, [profileData, user?.kycSubmitted, form])

  const onFinish = async (values: KYCFormData) => {
    const formData = new FormData()

    // Add text fields
    formData.append('businessName', values.businessName)
    formData.append('businessType', values.businessType)
    if (values.businessRegistrationNumber)
      formData.append('businessRegistrationNumber', values.businessRegistrationNumber)
    if (values.dateOfEstablishment) {
      const dateStr = dayjs.isDayjs(values.dateOfEstablishment)
        ? values.dateOfEstablishment.toISOString()
        : String(values.dateOfEstablishment)
      formData.append('dateOfEstablishment', dateStr)
    }
    if (values.storeDescription) formData.append('storeDescription', values.storeDescription)

    formData.append('addressLine1', values.addressLine1)
    if (values.addressLine2) formData.append('addressLine2', values.addressLine2)
    formData.append('city', values.city)
    formData.append('state', values.state)
    formData.append('postalCode', values.postalCode)
    formData.append('country', values.country)

    formData.append('panNumber', values.panNumber)
    if (values.gstNumber) formData.append('gstNumber', values.gstNumber)

    // Add bank details
    if (values.bankAccountNumber) formData.append('bankAccountNumber', values.bankAccountNumber)
    if (values.accountHolderName) formData.append('accountHolderName', values.accountHolderName)
    if (values.bankName) formData.append('bankName', values.bankName)
    if (values.ifscCode) formData.append('ifscCode', values.ifscCode)

    // Add tax fields
    if (values.aadhaarNumber) formData.append('aadhaarNumber', values.aadhaarNumber)
    if (values.authorizedPersonName)
      formData.append('authorizedPersonName', values.authorizedPersonName)
    if (values.authorizedPersonDesignation)
      formData.append('authorizedPersonDesignation', values.authorizedPersonDesignation)

    // Add files
    if (values.storeLogo && values.storeLogo.length > 0) {
      formData.append('storeLogo', values.storeLogo[0].originFileObj as File)
    }
    if (values.gstCertificate && values.gstCertificate.length > 0) {
      formData.append('gstCertificate', values.gstCertificate[0].originFileObj as File)
    }
    if (values.idProof && values.idProof.length > 0) {
      formData.append('idProof', values.idProof[0].originFileObj as File)
    }
    if (values.addressProof && values.addressProof.length > 0) {
      formData.append('addressProof', values.addressProof[0].originFileObj as File)
    }
    if (values.cancelledCheque && values.cancelledCheque.length > 0) {
      formData.append('cancelledCheque', values.cancelledCheque[0].originFileObj as File)
    }
    if (values.certificateOfIncorporation && values.certificateOfIncorporation.length > 0) {
      formData.append(
        'certificateOfIncorporation',
        values.certificateOfIncorporation[0].originFileObj as File,
      )
    }
    if (values.trustDeed && values.trustDeed.length > 0) {
      formData.append('trustDeed', values.trustDeed[0].originFileObj as File)
    }

    submitKYCMutation.mutate(formData, {
      onSuccess: (response: { message?: string; user?: unknown }) => {
        if (isUpdating) {
          message.success(
            '✅ KYC updated successfully! Your account will require admin re-approval. You can continue using the dashboard but product management is locked.',
          )
          navigate('/dashboard')
        } else {
          message.success(response.message || 'KYC submitted successfully!')
          navigate('/waiting-approval')
        }
      },
      onError: (error: unknown) => {
        // Try to surface a meaningful error coming from the backend
        let errorMessage = 'Failed to submit KYC'

        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (error as any).response?.data
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (error as { response?: { data?: any } }).response?.data

          if (typeof data?.error === 'string' && data.error.trim()) {
            errorMessage = data.error
          } else if (typeof data?.message === 'string' && data.message.trim()) {
            errorMessage = data.message
          }
        } else if (error instanceof Error && error.message) {
          errorMessage = error.message
        }

        message.error(errorMessage)
      },
    })
  }

  const isAllowedFile = (file: RcFile, allowedMimes: string[], allowedExtensions: string[]) => {
    if (file.type && allowedMimes.includes(file.type)) {
      return true
    }
    const extension = file.name.split('.').pop()?.toLowerCase()
    return !!extension && allowedExtensions.includes(extension)
  }

  const buildUploadProps = (
    allowedMimes: string[],
    allowedExtensions: string[],
    label: string,
    allowedTypesLabel: string,
  ): UploadProps => ({
    beforeUpload: (file) => {
      if (!isAllowedFile(file, allowedMimes, allowedExtensions)) {
        message.error(`${label} must be a ${allowedTypesLabel} file.`)
        return Upload.LIST_IGNORE
      }
      if (file.size > KYC_MAX_FILE_BYTES) {
        message.error(`${label} must be smaller than ${KYC_MAX_FILE_MB}MB.`)
        return Upload.LIST_IGNORE
      }
      return false
    },
    maxCount: 1,
  })

  const imageUploadProps = buildUploadProps(
    IMAGE_MIME_TYPES,
    IMAGE_EXTENSIONS,
    'Image',
    'JPG, PNG, GIF, WebP, or AVIF',
  )
  const documentUploadProps = buildUploadProps(
    KYC_DOC_MIME_TYPES,
    DOC_EXTENSIONS,
    'Document',
    'JPG, PNG, GIF, WebP, AVIF, or PDF',
  )

  const steps = [
    {
      title: 'Business & Address',
      icon: <ShopOutlined />,
    },
    {
      title: 'Bank Details',
      icon: <BankOutlined />,
    },
    {
      title: 'Tax & Documents',
      icon: <IdcardOutlined />,
    },
  ]

  // Show loading state while fetching profile data
  if (isLoadingProfile && user?.kycSubmitted) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f0f2f5',
        }}
      >
        <Card style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading your KYC details...</div>
        </Card>
      </div>
    )
  }

  const isUpdating = user?.kycSubmitted

  // Hard block: do not allow filling KYC at all if email is not verified
  if (user && !isEmailVerified) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f0f2f5',
          padding: '40px 20px',
        }}
      >
        <Card
          style={{
            maxWidth: 600,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Title level={3}>Verify your email to continue KYC</Title>
            <Paragraph type="secondary">
              We&apos;ve sent a verification link to <strong>{user.email}</strong>. Please verify
              your email address before filling or updating your KYC details.
            </Paragraph>
            <Alert
              type="warning"
              showIcon
              message="Email verification required"
              description="For security reasons, KYC can only be completed after your email is verified."
            />
            <Text type="secondary">
              Didn&apos;t receive the email? Check your spam folder or request a new verification
              link from the login page.
            </Text>
            <Button type="primary" onClick={() => navigate('/login')}>
              Go to Login
            </Button>
          </Space>
        </Card>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#f0f2f5',
        padding: '40px 20px',
      }}
    >
      <Card
        style={{
          maxWidth: 1000,
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.1), 0 0 40px rgba(183, 129, 21, 0.16)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          {/* Icon */}
          <div
            style={{
              fontSize: 64,
              color: '#B78115',
              filter: 'drop-shadow(0 0 20px rgba(24, 144, 255, 0.6))',
            }}
          >
            <ShopOutlined />
          </div>

          {/* Title */}
          <div>
            <Title level={2} style={{ margin: 0 }}>
              {isUpdating ? 'Update Your KYC Information' : 'Complete Your KYC Verification'}
            </Title>
            {isUpdating ? (
              <Paragraph type="secondary">
                Update your business details below. Your account will need admin re-approval after
                submission.
              </Paragraph>
            ) : null}
          </div>

          {/* Context: which account this KYC is for (subtle inline text) */}
          {user && (
            <Text
              type="secondary"
              style={{
                fontSize: 13,
                background: '#f5f5f5',
                padding: '6px 10px',
                borderRadius: 999,
                display: 'inline-block',
              }}
            >
              Completing KYC for{' '}
              <strong>
                {user.email}
                {user.phone ? ` · +91 ${user.phone}` : ''}
              </strong>
            </Text>
          )}
        </Space>

        <Divider />

        {/* Steps */}
        <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

        {/* Update KYC Warning */}
        {isUpdating && (
          <Alert
            message="📝 Updating Existing KYC"
            description="You are updating your existing KYC information. Your form has been pre-filled with your current data. After submission, your account will require admin re-approval, and product management will be temporarily locked."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Email Verification Warning */}
        {user && !user.isEmailVerified && (
          <Alert
            message="Email Verification Pending"
            description="Please check your inbox and verify your email address. This is important for receiving updates about your KYC application."
            type="warning"
            showIcon
            closable
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Info Alert */}
        <Alert
          message="Required Information"
          description="Please provide accurate business information. Our admin team will review your application within 24-48 hours. All fields marked with * are mandatory."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Alert
          message="Document guidelines"
          description={`Use clear, readable files with matching names and numbers. ${KYC_FILE_HELP_TEXT}`}
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* KYC Form */}
        <Form
          form={form}
          name="kyc"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          {/* Step 1: Business/Store Information + Address - keep mounted so form values persist on submit */}
          <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 32 }}>
              <div>
                <Title level={4}>
                  <ShopOutlined style={{ marginRight: 8 }} />
                  Business / Store Information
                </Title>
                <Text type="secondary">Tell us about your business</Text>
              </div>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="businessName"
                    label="Business / Store Name"
                    rules={[
                      { required: true, message: 'Please enter your business name' },
                      { min: 2, message: 'Business name must be at least 2 characters' },
                      { max: 200, message: 'Business name must not exceed 200 characters' },
                    ]}
                  >
                    <Input
                      prefix={<ShopOutlined />}
                      placeholder="ABC Store"
                      autoComplete="organization"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="businessType"
                    label="Business Type"
                    rules={[{ required: true, message: 'Please select your business type' }]}
                  >
                    <Select
                      placeholder="Select business type"
                      onChange={(value) => setBusinessType(value)}
                    >
                      {BUSINESS_TYPES.map((type) => (
                        <Option key={type} value={type}>
                          {type}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="businessRegistrationNumber"
                    label="Business Registration Number / Udyam ID"
                    tooltip="Registration number, Udyam ID or GSTIN"
                  >
                    <Input
                      prefix={<IdcardOutlined />}
                      placeholder="Enter your registration number"
                    />
                  </Form.Item>
                </Col>

                <Col xs={24} md={12}>
                  <Form.Item
                    name="dateOfEstablishment"
                    label="Date of Establishment"
                    tooltip="When was your business established?"
                  >
                    <DatePicker style={{ width: '100%' }} placeholder="Select date" />
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="storeLogo"
                    label="Store Logo (Optional)"
                    valuePropName="fileList"
                    getValueFromEvent={(e) => {
                      if (Array.isArray(e)) return e
                      return e?.fileList
                    }}
                    tooltip="Upload your store logo. Recommended size: 512x512px"
                  >
                    <Upload
                      {...imageUploadProps}
                      listType="picture"
                      accept="image/*"
                      fileList={storeLogoFileList}
                      onChange={({ fileList }) => syncFileList('storeLogo', fileList, setStoreLogoFileList)}
                    >
                      <Button icon={<PictureOutlined />}>
                        {storeLogoFileList.length > 0 ? 'Change Logo' : 'Upload Logo'}
                      </Button>
                    </Upload>
                    <Text type="secondary">{KYC_IMAGE_HELP_TEXT}</Text>
                  </Form.Item>
                </Col>

                <Col xs={24}>
                  <Form.Item
                    name="storeDescription"
                    label="About Store / Description"
                    tooltip="Tell customers about your business"
                  >
                    <TextArea
                      rows={4}
                      placeholder="Brief description of your business and what you sell"
                      showCount
                      maxLength={1000}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Space>

            <Divider />

            {/* Section 2: Business Address */}
            <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 32 }}>
                <div>
                  <Title level={4}>
                    <GlobalOutlined style={{ marginRight: 8 }} />
                    Business Address
                  </Title>
                  <Text type="secondary">Your business location</Text>
                </div>

                <Row gutter={16}>
                  <Col xs={24}>
                    <Form.Item
                      name="addressLine1"
                      label="Address Line 1"
                      rules={[
                        { required: true, message: 'Please enter your address' },
                        { min: 5, message: 'Address must be at least 5 characters' },
                      ]}
                    >
                      <Input placeholder="Street, Building Number" />
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Form.Item name="addressLine2" label="Address Line 2 (Optional)">
                      <Input placeholder="Apartment, Suite, Floor" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="city"
                      label="City"
                      rules={[{ required: true, message: 'Please enter your city' }]}
                    >
                      <Input placeholder="e.g. Mumbai" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="state"
                      label="State / Province"
                      rules={[{ required: true, message: 'Please select your state' }]}
                    >
                      <Select
                        showSearch
                        placeholder="Select state"
                        filterOption={(input, option) =>
                          String(option?.children || '')
                            .toLowerCase()
                            .includes(input.toLowerCase())
                        }
                      >
                        {INDIAN_STATES.map((state) => (
                          <Option key={state} value={state}>
                            {state}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="postalCode"
                      label="Postal Code / PIN"
                      tooltip="Enter 6-digit PIN and tab out to auto-fill State & City (India)"
                      rules={[
                        { required: true, message: 'Please enter your postal code' },
                        { pattern: /^[0-9]{6}$/, message: 'Please enter a valid 6-digit PIN code' },
                      ]}
                    >
                      <Input
                        placeholder="e.g. 400001"
                        maxLength={6}
                        onBlur={handlePincodeBlur}
                        suffix={pincodeLookupLoading ? <Spin size="small" /> : null}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="country"
                      label="Country"
                      initialValue="India"
                      rules={[{ required: true, message: 'Please select your country' }]}
                    >
                      <Select>
                        <Option value="India">India</Option>
                        <Option value="USA">USA</Option>
                        <Option value="UK">UK</Option>
                        <Option value="Other">Other</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Space>
          </div>

          {/* Step 2: Bank Details - keep mounted so form values persist on submit */}
          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
              <Divider />

              {/* Step 2: Bank Details */}
              <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 32 }}>
                <div>
                  <Title level={4}>
                    <BankOutlined style={{ marginRight: 8 }} />
                    Bank Account Details
                  </Title>
                  <Text type="secondary">For receiving payments from sales</Text>
                </div>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="bankAccountNumber"
                      label="Bank Account Number"
                      rules={[
                        { required: true, message: 'Please enter your bank account number' },
                        {
                          pattern: /^[0-9]{9,18}$/,
                          message: 'Please enter a valid account number',
                        },
                      ]}
                    >
                      <Input placeholder="Enter account number" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="accountHolderName"
                      label="Account Holder Name"
                      rules={[{ required: true, message: 'Please enter account holder name' }]}
                    >
                      <Input placeholder="As per bank records" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="bankName"
                      label="Bank Name"
                      rules={[{ required: true, message: 'Please enter your bank name' }]}
                    >
                      <Input placeholder="e.g. State Bank of India" />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="ifscCode"
                      label="IFSC Code"
                      rules={[
                        { required: true, message: 'Please enter IFSC code' },
                        {
                          pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
                          message: 'Please enter a valid IFSC code',
                        },
                      ]}
                    >
                      <Input
                        placeholder="e.g. SBIN0001234"
                        maxLength={11}
                        style={{ textTransform: 'uppercase' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24}>
                    <Form.Item
                      name="cancelledCheque"
                      label="Upload Cancelled Cheque / Bank Statement"
                      valuePropName="fileList"
                      getValueFromEvent={(e) => {
                        if (Array.isArray(e)) return e
                        return e?.fileList
                      }}
                      rules={[
                        {
                          required: true,
                          message: 'Please upload cancelled cheque or bank statement',
                        },
                      ]}
                    tooltip="Upload a cancelled cheque or recent bank statement showing account details"
                    >
                      <Upload
                        {...documentUploadProps}
                        accept=".pdf,image/*"
                        fileList={cancelledChequeFileList}
                      onChange={({ fileList }) =>
                        syncFileList('cancelledCheque', fileList, setCancelledChequeFileList)
                      }
                      >
                        <Button icon={<UploadOutlined />}>
                          {cancelledChequeFileList.length > 0
                            ? 'Change Document'
                            : 'Upload Cancelled Cheque (PDF/JPG)'}
                        </Button>
                    </Upload>
                    <Text type="secondary">{KYC_FILE_HELP_TEXT}</Text>
                    </Form.Item>
                  </Col>

                  {/* Bank verification button removed for now; will be reintroduced with Setu. */}
                </Row>
              </Space>
          </div>

          {/* Step 3: Tax & Documents - keep mounted so form values persist on submit */}
          <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
              <Divider />

              {/* Step 3: Tax & Legal Information */}
              <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 32 }}>
                <div>
                  <Title level={4}>
                    <IdcardOutlined style={{ marginRight: 8 }} />
                    Tax & Legal Information
                  </Title>
                  <Text type="secondary">
                    {isIndividualOrProprietorship &&
                      'Required documents for Individual/Proprietorship'}
                    {isCompany && 'Required documents for Company/Partnership'}
                    {isTrust && 'Required documents for Trust'}
                    {!businessType && 'Select business type to see required documents'}
                  </Text>
                </div>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="panNumber"
                      label="PAN / Tax ID"
                      rules={[
                        { required: true, message: 'Please enter your PAN number' },
                        {
                          pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                          message: 'Please enter a valid PAN (e.g. ABCDE1234F)',
                        },
                      ]}
                    >
                      <Input
                        prefix={<IdcardOutlined />}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                        style={{ textTransform: 'uppercase' }}
                      />
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item
                      name="gstNumber"
                      label="GSTIN / VAT Number (Optional)"
                      tooltip="Required if your turnover exceeds GST threshold"
                      rules={[
                        {
                          pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                          message: 'Please enter a valid GST number (e.g., 22AAAAA0000A1Z5)',
                        },
                      ]}
                    >
                      <Input
                        prefix={<BankOutlined />}
                        placeholder="22AAAAA0000A1Z5"
                        maxLength={15}
                        style={{ textTransform: 'uppercase' }}
                      />
                    </Form.Item>
                  </Col>

                  {/* Individual/Proprietorship Documents */}
                  {isIndividualOrProprietorship && (
                    <>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="aadhaarNumber"
                          label="Aadhaar Number (Optional)"
                          rules={[
                            {
                              pattern: /^[0-9]{12}$/,
                              message: 'Please enter a valid 12-digit Aadhaar number',
                            },
                          ]}
                        >
                          <Input placeholder="XXXX XXXX XXXX" maxLength={12} />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="addressProof"
                          label="Upload Address Proof (Aadhaar/Passport/License)"
                          valuePropName="fileList"
                          getValueFromEvent={(e) => {
                            if (Array.isArray(e)) return e
                            return e?.fileList
                          }}
                          rules={[{ required: true, message: 'Please upload address proof' }]}
                        >
                          <Upload
                            {...documentUploadProps}
                            accept=".pdf,image/*"
                            fileList={addressProofFileList}
                            onChange={({ fileList }) =>
                              syncFileList('addressProof', fileList, setAddressProofFileList)
                            }
                          >
                            <Button icon={<UploadOutlined />}>
                              {addressProofFileList.length > 0
                                ? 'Change Address Proof'
                                : 'Upload Address Proof (PDF/JPG)'}
                            </Button>
                          </Upload>
                          <Text type="secondary">{KYC_FILE_HELP_TEXT}</Text>
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="gstCertificate"
                          label="Upload GST Certificate (Optional - if registered)"
                          valuePropName="fileList"
                          getValueFromEvent={(e) => {
                            if (Array.isArray(e)) return e
                            return e?.fileList
                          }}
                        >
                          <Upload
                            {...documentUploadProps}
                            accept=".pdf,image/*"
                            fileList={gstCertificateFileList}
                            onChange={({ fileList }) =>
                              syncFileList('gstCertificate', fileList, setGstCertificateFileList)
                            }
                          >
                            <Button icon={<UploadOutlined />}>
                              {gstCertificateFileList.length > 0
                                ? 'Change GST Certificate'
                                : 'Upload GST Certificate (PDF/JPG)'}
                            </Button>
                          </Upload>
                          <Text type="secondary">{KYC_FILE_HELP_TEXT}</Text>
                        </Form.Item>
                      </Col>
                    </>
                  )}

                  {/* Company/Partnership Documents */}
                  {isCompany && (
                    <>
                      <Col xs={24}>
                        <Form.Item
                          name="certificateOfIncorporation"
                          label="Upload Certificate of Incorporation / Registration"
                          valuePropName="fileList"
                          getValueFromEvent={(e) => {
                            if (Array.isArray(e)) return e
                            return e?.fileList
                          }}
                          rules={[
                            {
                              required: true,
                              message: 'Please upload certificate of incorporation',
                            },
                          ]}
                        >
                          <Upload
                            {...documentUploadProps}
                            accept=".pdf,image/*"
                            fileList={certificateOfIncorporationFileList}
                            onChange={({ fileList }) =>
                              syncFileList(
                                'certificateOfIncorporation',
                                fileList,
                                setCertificateOfIncorporationFileList,
                              )
                            }
                          >
                            <Button icon={<UploadOutlined />}>
                              {certificateOfIncorporationFileList.length > 0
                                ? 'Change Certificate'
                                : 'Upload Incorporation Certificate (PDF/JPG)'}
                            </Button>
                          </Upload>
                          <Text type="secondary">{KYC_FILE_HELP_TEXT}</Text>
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="gstCertificate"
                          label="Upload GST Certificate (Required for companies)"
                          valuePropName="fileList"
                          getValueFromEvent={(e) => {
                            if (Array.isArray(e)) return e
                            return e?.fileList
                          }}
                          rules={[{ required: true, message: 'Please upload GST certificate' }]}
                        >
                          <Upload
                            {...documentUploadProps}
                            accept=".pdf,image/*"
                            fileList={gstCertificateFileList}
                            onChange={({ fileList }) =>
                              syncFileList('gstCertificate', fileList, setGstCertificateFileList)
                            }
                          >
                            <Button icon={<UploadOutlined />}>
                              {gstCertificateFileList.length > 0
                                ? 'Change GST Certificate'
                                : 'Upload GST Certificate (PDF/JPG)'}
                            </Button>
                          </Upload>
                          <Text type="secondary">{KYC_FILE_HELP_TEXT}</Text>
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="authorizedPersonName"
                          label="Authorized Person Name"
                          rules={[
                            { required: true, message: 'Please enter authorized person name' },
                          ]}
                        >
                          <Input placeholder="Full name of authorized signatory" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="authorizedPersonDesignation"
                          label="Designation"
                          rules={[{ required: true, message: 'Please enter designation' }]}
                        >
                          <Input placeholder="e.g. Director, Partner" />
                        </Form.Item>
                      </Col>
                    </>
                  )}

                  {/* Trust Documents */}
                  {isTrust && (
                    <>
                      <Col xs={24}>
                        <Form.Item
                          name="trustDeed"
                          label="Upload Trust Deed"
                          valuePropName="fileList"
                          getValueFromEvent={(e) => {
                            if (Array.isArray(e)) return e
                            return e?.fileList
                          }}
                          rules={[{ required: true, message: 'Please upload trust deed' }]}
                        >
                          <Upload
                            {...documentUploadProps}
                            accept=".pdf,image/*"
                            fileList={trustDeedFileList}
                            onChange={({ fileList }) =>
                              syncFileList('trustDeed', fileList, setTrustDeedFileList)
                            }
                          >
                            <Button icon={<UploadOutlined />}>
                              {trustDeedFileList.length > 0
                                ? 'Change Trust Deed'
                                : 'Upload Trust Deed (PDF/JPG)'}
                            </Button>
                          </Upload>
                          <Text type="secondary">{KYC_FILE_HELP_TEXT}</Text>
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="gstCertificate"
                          label="Upload GST Certificate (If registered)"
                          valuePropName="fileList"
                          getValueFromEvent={(e) => {
                            if (Array.isArray(e)) return e
                            return e?.fileList
                          }}
                        >
                          <Upload
                        {...documentUploadProps}
                            accept=".pdf,image/*"
                            fileList={gstCertificateFileList}
                        onChange={({ fileList }) =>
                          syncFileList('gstCertificate', fileList, setGstCertificateFileList)
                        }
                          >
                            <Button icon={<UploadOutlined />}>
                              {gstCertificateFileList.length > 0
                                ? 'Change GST Certificate'
                                : 'Upload GST Certificate (PDF/JPG)'}
                            </Button>
                          </Upload>
                          <Text type="secondary">{KYC_FILE_HELP_TEXT}</Text>
                        </Form.Item>
                      </Col>
                    </>
                  )}

                  <Col xs={24}>
                    <Form.Item
                      name="idProof"
                      label="Upload ID Proof (Owner / Authorized Person)"
                      valuePropName="fileList"
                      getValueFromEvent={(e) => {
                        if (Array.isArray(e)) return e
                        return e?.fileList
                      }}
                      rules={[{ required: true, message: 'Please upload your ID proof' }]}
                      tooltip="Aadhaar / Passport / Driver's License"
                    >
                      <Upload
                        {...documentUploadProps}
                        accept=".pdf,image/*"
                        fileList={idProofFileList}
                        onChange={({ fileList }) =>
                          syncFileList('idProof', fileList, setIdProofFileList)
                        }
                      >
                        <Button icon={<FileTextOutlined />}>
                          {idProofFileList.length > 0
                            ? 'Change ID Proof'
                            : 'Upload ID Proof (PDF/JPG)'}
                        </Button>
                      </Upload>
                      <Text type="secondary">{KYC_FILE_HELP_TEXT}</Text>
                    </Form.Item>
                  </Col>
                </Row>
              </Space>
          </div>

          {/* Step Navigation & Submit */}
          <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 24 }}>
            <Row justify="space-between" gutter={16}>
              <Col>
                {currentStep > 0 && (
                  <Button
                    onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                    disabled={submitKYCMutation.isPending}
                  >
                    Previous
                  </Button>
                )}
              </Col>
              <Col style={{ textAlign: 'right' }}>
                {currentStep < steps.length - 1 && (
                  <Button
                    type="primary"
                    loading={saveKYCDraftMutation.isPending}
                    onClick={async () => {
                      try {
                        if (currentStep === 0) {
                          await form.validateFields([
                            'businessName',
                            'businessType',
                            'addressLine1',
                            'city',
                            'state',
                            'postalCode',
                            'country',
                          ])
                        } else if (currentStep === 1) {
                          await form.validateFields([
                            'bankAccountNumber',
                            'accountHolderName',
                            'bankName',
                            'ifscCode',
                            'cancelledCheque',
                          ])
                        }

                        const values = form.getFieldsValue()
                        saveKYCDraftMutation.mutate(values, {
                          onSuccess: () => {
                            setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
                          },
                        })
                      } catch {
                        // Validation errors are shown by antd
                      }
                    }}
                  >
                    Save & Continue
                  </Button>
                )}

                {currentStep === steps.length - 1 && (
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={submitKYCMutation.isPending}
                    icon={<CheckCircleOutlined />}
                    style={{ minWidth: 200, height: 50 }}
                  >
                    {isUpdating ? 'Update KYC for Re-Approval' : 'Submit KYC for Review'}
                  </Button>
                )}
              </Col>
            </Row>

            <Text type="secondary" style={{ textAlign: 'center', display: 'block' }}>
              By submitting, you confirm that all information provided is accurate and complete
            </Text>

            <Space
              direction="horizontal"
              size="middle"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            >
              <Button type="link" onClick={() => navigate('/login')}>
                Back to Seller Login
              </Button>
              <Divider type="vertical" />
              <Button type="link" onClick={() => navigate('/register')}>
                Create a New Seller Account
              </Button>
            </Space>
          </Space>
        </Form>
      </Card>
    </div>
  )
}
