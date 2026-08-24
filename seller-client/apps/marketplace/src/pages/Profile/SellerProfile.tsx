import {
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EditOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  PictureOutlined,
  PoweroffOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  ShopOutlined,
  UploadOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import type { UploadFile } from 'antd'
import {
  Alert,
  App,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useResendVerificationEmail } from '../../api/authQueries'
import { useChangePassword, useProfile, useUpdateProfile } from '../../api/profileQueries'
import { useUpdateStore } from '../../api/storeQueries'
import AccountDeactivation from '../../components/AccountDeactivation'
import { useAuthStore } from '../../store/authStore'

const { Title, Paragraph, Text, Link } = Typography
const { TextArea } = Input
const { Panel } = Collapse

const SellerProfile = () => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [storeForm] = Form.useForm()
  const [showKycWarningModal, setShowKycWarningModal] = useState(false)
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [logoFileList, setLogoFileList] = useState<UploadFile[]>([])
  const [profilePhotoFileList, setProfilePhotoFileList] = useState<UploadFile[]>([])
  const user = useAuthStore((state) => state.user)

  const { data: profileData, isLoading: isLoadingProfile } = useProfile()
  const updateProfileMutation = useUpdateProfile()
  const changePasswordMutation = useChangePassword()
  const updateStoreMutation = useUpdateStore()
  const resendVerificationMutation = useResendVerificationEmail()

  const handleUpdateKycClick = () => {
    if (user?.isApproved) {
      // Show warning modal for approved users
      setShowKycWarningModal(true)
    } else {
      // Directly navigate for non-approved users
      navigate('/submit-kyc')
    }
  }

  const handleConfirmKycUpdate = () => {
    setShowKycWarningModal(false)
    navigate('/submit-kyc')
  }

  const handleUpdateStoreInfo = async (values: { storeDescription: string }) => {
    try {
      const updateData: { storeLogo?: File; storeDescription?: string } = {}

      if (values.storeDescription) {
        updateData.storeDescription = values.storeDescription
      }

      if (logoFileList.length > 0 && logoFileList[0].originFileObj) {
        updateData.storeLogo = logoFileList[0].originFileObj as File
      }

      await updateStoreMutation.mutateAsync(updateData)
      message.success('✅ Store information updated successfully!')
      setShowStoreModal(false)
      setLogoFileList([])
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      message.error(err.response?.data?.error || '❌ Failed to update store information')
    }
  }

  const handleOpenStoreModal = () => {
    storeForm.setFieldsValue({
      storeDescription: profileData?.storeDescription || '',
    })
    setShowStoreModal(true)
  }

  useEffect(() => {
    if (profileData) {
      form.setFieldsValue({
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone,
        businessName: profileData.businessName,
        gstNumber: profileData.gstNumber,
      })
    }
  }, [profileData, form])

  const handleUpdateProfile = async (values: { name: string; phone?: string }) => {
    try {
      const updateData: { name: string; phone?: string; profilePhoto?: File } = {
        name: values.name,
        phone: values.phone,
      }

      // Include profile photo if uploaded
      if (profilePhotoFileList.length > 0 && profilePhotoFileList[0].originFileObj) {
        updateData.profilePhoto = profilePhotoFileList[0].originFileObj as File
      }

      await updateProfileMutation.mutateAsync(updateData)
      message.success('✅ Profile updated successfully!')
      setProfilePhotoFileList([]) // Clear file list after successful upload
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      message.error(err.response?.data?.error || '❌ Failed to update profile')
    }
  }

  const handleChangePassword = async (values: {
    currentPassword?: string
    newPassword: string
    confirmPassword: string
  }) => {
    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: profileData?.hasPassword ? values.currentPassword : undefined,
        newPassword: values.newPassword,
      })
      const successMessage = profileData?.hasPassword
        ? ' Password changed successfully!'
        : ' Password set successfully! You can now log in with your email and password.'
      message.success(successMessage)
      passwordForm.resetFields()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      message.error(err.response?.data?.error || '❌ Failed to change password')
    }
  }

  const hasPassword = profileData?.hasPassword ?? false

  if (isLoadingProfile) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Loading profile...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // Helper function to mask sensitive data
  const maskData = (data: string | undefined, visibleChars = 4) => {
    if (!data) return 'Not provided'
    if (data.length <= visibleChars) return data
    return '*'.repeat(data.length - visibleChars) + data.slice(-visibleChars)
  }

  // Helper function to format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not provided'
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  // Helper function to render document link
  const renderDocumentLink = (url: string | undefined, label: string) => {
    if (!url) return <Text type="secondary">Not uploaded</Text>
    return (
      <Space>
        <Link href={url} target="_blank">
          <Button type="link" size="small" icon={<DownloadOutlined />}>
            View {label}
          </Button>
        </Link>
      </Space>
    )
  }

  // Calculate account completion percentage
  const getAccountCompletionPercentage = () => {
    let completed = 0
    const total = 4

    if (user.isEmailVerified) completed++
    if (user.kycSubmitted) completed++
    if (user.isApproved) completed++
    if (profileData?.phone) completed++

    return Math.round((completed / total) * 100)
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header with Profile Card */}
        <Card
          style={{
            background: 'linear-gradient(135deg, #4F5552 0%, #303537 100%)',
            color: 'white',
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(19, 83, 164, 0.15)',
            border: 'none',
          }}
          bodyStyle={{ padding: '32px' }}
        >
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} sm={24} md={6} lg={4} style={{ textAlign: 'center' }}>
              <Badge
                count={user.isApproved ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 0}
                offset={[-12, 12]}
              >
                {profileData?.profilePhoto ? (
                  <div
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '4px solid rgba(255,255,255,0.3)',
                      backgroundColor: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Image
                      src={profileData.profilePhoto}
                      alt="Profile Photo"
                      preview={true}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                ) : profileData?.storeLogo ? (
                  <div
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '4px solid rgba(255,255,255,0.3)',
                      backgroundColor: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Image
                      src={profileData.storeLogo}
                      alt="Store Logo"
                      preview={true}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </div>
                ) : (
                  <Avatar
                    size={140}
                    icon={<UserOutlined style={{ fontSize: 60 }} />}
                    style={{
                      backgroundColor: '#fff',
                      color: '#4F5552',
                      border: '4px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  />
                )}
              </Badge>
            </Col>
            <Col xs={24} sm={24} md={12} lg={14}>
              <div>
                <Title level={2} style={{ margin: 0, color: 'white', fontWeight: 600 }}>
                  {user.name}
                </Title>
                <Paragraph
                  style={{ margin: '8px 0 16px', color: 'rgba(255,255,255,0.95)', fontSize: 16 }}
                >
                  <MailOutlined style={{ marginRight: 8 }} />
                  {user.email}
                </Paragraph>
                <Space wrap style={{ marginTop: 12 }}>
                  {user.isApproved ? (
                    <Tag
                      color="success"
                      icon={<CheckCircleOutlined />}
                      style={{ padding: '4px 12px', fontSize: 14 }}
                    >
                      Verified Seller
                    </Tag>
                  ) : (
                    <Tag
                      color="warning"
                      icon={<ClockCircleOutlined />}
                      style={{ padding: '4px 12px', fontSize: 14 }}
                    >
                      Pending Approval
                    </Tag>
                  )}
                  {user.isEmailVerified ? (
                    <Tag
                      color="success"
                      icon={<CheckCircleOutlined />}
                      style={{ padding: '4px 12px', fontSize: 14 }}
                    >
                      Email Verified
                    </Tag>
                  ) : (
                    <Space size="small">
                      <Tag
                        color="error"
                        icon={<WarningOutlined />}
                        style={{ padding: '4px 12px', fontSize: 14 }}
                      >
                        Email Not Verified
                      </Tag>
                      <Button
                        size="small"
                        type="default"
                        loading={resendVerificationMutation.isPending}
                        onClick={async () => {
                          if (!user.email) {
                            message.error('No email found for this account.')
                            return
                          }
                          try {
                            await resendVerificationMutation.mutateAsync(user.email)
                            message.success('Verification email sent. Please check your inbox.')
                          } catch (e: unknown) {
                            const error = e as {
                              response?: { data?: { error?: string; message?: string } }
                              message?: string
                            }
                            const apiError =
                              error?.response?.data?.error ||
                              error?.response?.data?.message ||
                              error?.message ||
                              'Failed to send verification email.'
                            message.error(apiError)
                          }
                        }}
                      >
                        Verify Email
                      </Button>
                    </Space>
                  )}
                  {user.kycSubmitted && (
                    <Tag
                      color="processing"
                      icon={<InfoCircleOutlined />}
                      style={{ padding: '4px 12px', fontSize: 14 }}
                    >
                      KYC Submitted
                    </Tag>
                  )}
                </Space>
              </div>
            </Col>
            <Col xs={24} sm={24} md={6} lg={6}>
              <Card
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  textAlign: 'center',
                }}
                bodyStyle={{ padding: '20px 16px' }}
              >
                <div style={{ marginBottom: 8 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>
                    Profile Completion
                  </Text>
                </div>
                <Progress
                  type="circle"
                  percent={getAccountCompletionPercentage()}
                  strokeColor={{ '0%': '#52c41a', '100%': '#73d13d' }}
                  trailColor="rgba(255,255,255,0.2)"
                  strokeWidth={8}
                  width={80}
                  format={(percent) => (
                    <span style={{ color: 'white', fontSize: 18, fontWeight: 600 }}>
                      {percent}%
                    </span>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </Card>

        {/* Critical Alerts */}
        {user.rejectionReason && (
          <Alert
            message="⚠️ KYC Rejected"
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Reason: </Text>
                  <Text>{user.rejectionReason}</Text>
                </div>
                <Button
                  type="primary"
                  danger
                  size="large"
                  onClick={() => navigate('/submit-kyc')}
                  icon={<EditOutlined />}
                >
                  Resubmit KYC Now
                </Button>
              </Space>
            }
            type="error"
            showIcon
            closable
            style={{ borderRadius: 12 }}
          />
        )}

        {!user.kycSubmitted && (
          <Alert
            message="🚀 Complete Your KYC to Start Selling"
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>
                  Complete your KYC verification to unlock all seller features and start listing
                  products on Kourier Boyz.
                </Text>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => navigate('/submit-kyc')}
                  icon={<SafetyCertificateOutlined />}
                >
                  Complete KYC Now
                </Button>
              </Space>
            }
            type="info"
            showIcon
            style={{ borderRadius: 12 }}
          />
        )}

        {!user.isApproved && user.kycSubmitted && !user.rejectionReason && (
          <Alert
            message="⏳ Account Under Review"
            description="Your KYC has been submitted successfully. Our admin team is reviewing your application. You'll receive an email notification once your account is approved."
            type="warning"
            showIcon
            style={{ borderRadius: 12 }}
          />
        )}

        {/* Main Content with Tabs */}
        <Card style={{ borderRadius: 12, overflow: 'hidden' }} bodyStyle={{ padding: 0 }}>
          <Tabs
            defaultActiveKey="profile"
            size="large"
            type="card"
            style={{ marginBottom: 0 }}
            items={[
              {
                key: 'profile',
                label: (
                  <span>
                    <UserOutlined />
                    <span style={{ marginLeft: 8 }}>Profile & Settings</span>
                  </span>
                ),
                children: (
                  <div style={{ padding: '24px 24px 0' }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      {/* Quick Stats */}
                      <Row gutter={[16, 16]}>
                        <Col xs={24} sm={8}>
                          <Card
                            style={{
                              background: 'linear-gradient(135deg, #4F5552 0%, #303537 100%)',
                              borderRadius: 12,
                            }}
                          >
                            <Statistic
                              title={
                                <span style={{ color: 'rgba(255,255,255,0.9)' }}>Account Type</span>
                              }
                              value="Seller"
                              prefix={<ShopOutlined style={{ color: 'white' }} />}
                              valueStyle={{ color: 'white', fontSize: 24, fontWeight: 600 }}
                            />
                          </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Card
                            style={{
                              background: user.kycSubmitted
                                ? 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
                                : 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
                              borderRadius: 12,
                            }}
                          >
                            <Statistic
                              title={
                                <span style={{ color: 'rgba(255,255,255,0.9)' }}>KYC Status</span>
                              }
                              value={user.kycSubmitted ? 'Submitted' : 'Pending'}
                              prefix={
                                user.kycSubmitted ? (
                                  <CheckCircleOutlined style={{ color: 'white' }} />
                                ) : (
                                  <ClockCircleOutlined style={{ color: 'white' }} />
                                )
                              }
                              valueStyle={{ color: 'white', fontSize: 24, fontWeight: 600 }}
                            />
                          </Card>
                        </Col>
                        <Col xs={24} sm={8}>
                          <Card
                            style={{
                              background: user.isApproved
                                ? 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
                                : 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)',
                              borderRadius: 12,
                            }}
                          >
                            <Statistic
                              title={
                                <span style={{ color: 'rgba(255,255,255,0.9)' }}>
                                  Approval Status
                                </span>
                              }
                              value={user.isApproved ? 'Approved' : 'Pending'}
                              prefix={
                                user.isApproved ? (
                                  <CheckCircleOutlined style={{ color: 'white' }} />
                                ) : (
                                  <ClockCircleOutlined style={{ color: 'white' }} />
                                )
                              }
                              valueStyle={{ color: 'white', fontSize: 24, fontWeight: 600 }}
                            />
                          </Card>
                        </Col>
                      </Row>

                      <Divider orientation="left">
                        <Space>
                          <UserOutlined />
                          <Text strong style={{ fontSize: 16 }}>
                            Personal Information
                          </Text>
                          <Tag color="blue">Editable</Tag>
                        </Space>
                      </Divider>

                      <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleUpdateProfile}
                        size="large"
                      >
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="name"
                              label="Full Name"
                              rules={[
                                { required: true, message: 'Please enter your name' },
                                { min: 2, message: 'Name must be at least 2 characters' },
                                { max: 50, message: 'Name cannot exceed 50 characters' },
                              ]}
                            >
                              <Input prefix={<UserOutlined />} placeholder="Enter your full name" />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={12}>
                            <Form.Item
                              name="email"
                              label="Email Address"
                              tooltip="Email cannot be changed"
                            >
                              <Input
                                prefix={<MailOutlined />}
                                placeholder="Email"
                                disabled
                                style={{ backgroundColor: '#f5f5f5' }}
                              />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={12}>
                            <Form.Item
                              name="phone"
                              label="Phone Number"
                              rules={[
                                {
                                  pattern: /^[6-9]\d{9}$/,
                                  message: 'Please enter a valid 10-digit phone number',
                                },
                              ]}
                            >
                              <Input
                                prefix={<PhoneOutlined />}
                                placeholder="10-digit mobile number"
                                addonBefore="+91"
                                maxLength={10}
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Row gutter={[24, 16]} align="middle" style={{ marginBottom: 24 }}>
                          <Col xs={24} sm={8} style={{ textAlign: 'center' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              {profilePhotoFileList.length > 0 &&
                              profilePhotoFileList[0].originFileObj ? (
                                <div
                                  style={{
                                    width: 100,
                                    height: 100,
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '2px solid #d9d9d9',
                                    position: 'relative',
                                  }}
                                >
                                  <Image
                                    src={URL.createObjectURL(profilePhotoFileList[0].originFileObj)}
                                    alt="Preview"
                                    width={100}
                                    height={100}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                    }}
                                  />
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: 4,
                                      right: 4,
                                      background: '#fff',
                                      borderRadius: '50%',
                                      width: 24,
                                      height: 24,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setProfilePhotoFileList([])
                                    }}
                                  >
                                    <span style={{ fontSize: 16, color: '#8c8c8c' }}>×</span>
                                  </div>
                                </div>
                              ) : profileData?.profilePhoto ? (
                                <div
                                  style={{
                                    width: 100,
                                    height: 100,
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: '2px solid #d9d9d9',
                                  }}
                                >
                                  <Image
                                    src={profileData.profilePhoto}
                                    alt="Profile Photo"
                                    width={100}
                                    height={100}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                    }}
                                    preview={true}
                                  />
                                </div>
                              ) : (
                                <Avatar
                                  size={100}
                                  icon={<UserOutlined style={{ fontSize: 40 }} />}
                                  style={{
                                    backgroundColor: '#f5f5f5',
                                    color: '#bfbfbf',
                                  }}
                                />
                              )}
                            </div>
                          </Col>
                          <Col xs={24} sm={16}>
                            <Form.Item
                              label="Profile Photo"
                              help="PNG, JPG, or WebP. Max 5MB"
                              style={{ marginBottom: 0 }}
                            >
                              <Upload
                                fileList={profilePhotoFileList}
                                onChange={({ fileList }) => setProfilePhotoFileList(fileList)}
                                beforeUpload={() => false}
                                maxCount={1}
                                accept="image/*"
                                showUploadList={false}
                              >
                                <Button icon={<UploadOutlined />}>
                                  {profilePhotoFileList.length > 0
                                    ? 'Change Photo'
                                    : 'Upload Photo'}
                                </Button>
                              </Upload>
                            </Form.Item>
                          </Col>
                        </Row>

                        <Divider orientation="left">
                          <Space>
                            <ShopOutlined />
                            <Text strong style={{ fontSize: 16 }}>
                              Business Information
                            </Text>
                            <Tag color="orange">Read-Only</Tag>
                          </Space>
                        </Divider>

                        <Alert
                          message="Business Details Managed via KYC"
                          description="Your business name, GST number, and other business details are part of your KYC submission. To update them, use the 'Update KYC' button in the KYC Details tab."
                          type="info"
                          showIcon
                          style={{ marginBottom: 24, borderRadius: 8 }}
                        />

                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item name="businessName" label="Business / Store Name">
                              <Input
                                prefix={<ShopOutlined />}
                                placeholder="Not provided"
                                disabled
                                style={{ backgroundColor: '#fafafa', cursor: 'not-allowed' }}
                              />
                            </Form.Item>
                          </Col>

                          <Col xs={24} md={12}>
                            <Form.Item name="gstNumber" label="GST Number">
                              <Input
                                placeholder="Not provided"
                                disabled
                                style={{ backgroundColor: '#fafafa', cursor: 'not-allowed' }}
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                          <Space size="middle">
                            <Button
                              type="primary"
                              htmlType="submit"
                              size="large"
                              icon={<SaveOutlined />}
                              loading={updateProfileMutation.isPending}
                              style={{ minWidth: 160 }}
                            >
                              Save Changes
                            </Button>
                            <Button
                              size="large"
                              onClick={() => {
                                form.resetFields()
                                setProfilePhotoFileList([])
                              }}
                              disabled={updateProfileMutation.isPending}
                            >
                              Reset
                            </Button>
                          </Space>
                        </Form.Item>
                      </Form>
                    </Space>
                  </div>
                ),
              },

              {
                key: 'kyc',
                label: (
                  <span>
                    <SafetyCertificateOutlined />
                    <span style={{ marginLeft: 8 }}>KYC & Business Details</span>
                    {user.kycSubmitted && (
                      <Badge
                        count={user.isApproved ? '✓' : '⏳'}
                        style={{
                          backgroundColor: user.isApproved ? '#52c41a' : '#faad14',
                          marginLeft: 8,
                        }}
                      />
                    )}
                  </span>
                ),
                children: (
                  <div style={{ padding: '24px' }}>
                    {user.kycSubmitted ? (
                      <Space direction="vertical" size="large" style={{ width: '100%' }}>
                        {/* Status Alert and Actions */}
                        <Row gutter={16} align="middle">
                          <Col flex="auto">
                            {user.isApproved ? (
                              <Alert
                                message="Account Verified"
                                description="Your account is verified. You can update non-critical information like store logo and description below. To update legal documents or bank details, click 'Update KYC'."
                                type="success"
                                showIcon
                                style={{ borderRadius: 8 }}
                              />
                            ) : (
                              <Alert
                                message="⏳ KYC Under Review"
                                description="Your KYC is being reviewed by our admin team. You'll be notified via email once the review is complete."
                                type="info"
                                showIcon
                                style={{ borderRadius: 8 }}
                              />
                            )}
                          </Col>
                        </Row>

                        <Row gutter={16}>
                          <Col>
                            <Button
                              type={user.isApproved ? 'default' : 'primary'}
                              size="large"
                              icon={<EditOutlined />}
                              onClick={handleUpdateKycClick}
                            >
                              Update KYC
                            </Button>
                          </Col>
                          {user.isApproved && (
                            <Col>
                              <Button
                                type="primary"
                                size="large"
                                icon={<ShopOutlined />}
                                onClick={handleOpenStoreModal}
                              >
                                Update Store Info
                              </Button>
                            </Col>
                          )}
                        </Row>

                        <Divider />

                        {/* KYC Details in Collapsible Panels */}
                        <Collapse
                          defaultActiveKey={['business']}
                          expandIconPosition="end"
                          style={{ background: '#fafafa', borderRadius: 8 }}
                        >
                          {/* Business Information Panel */}
                          <Panel
                            header={
                              <Space>
                                <ShopOutlined style={{ fontSize: 18, color: '#4F5552' }} />
                                <Text strong style={{ fontSize: 16 }}>
                                  Business / Store Information
                                </Text>
                              </Space>
                            }
                            key="business"
                          >
                            <Descriptions
                              bordered
                              column={{ xs: 1, sm: 1, md: 2 }}
                              size="middle"
                              style={{ background: 'white' }}
                            >
                              <Descriptions.Item label="Business Name">
                                <Text strong>{profileData?.businessName || 'Not provided'}</Text>
                              </Descriptions.Item>
                              <Descriptions.Item label="Business Type">
                                <Tag color="blue">
                                  {profileData?.businessType || 'Not provided'}
                                </Tag>
                              </Descriptions.Item>
                              <Descriptions.Item label="Registration Number">
                                {profileData?.businessRegistrationNumber || 'Not provided'}
                              </Descriptions.Item>
                              <Descriptions.Item label="Date of Establishment">
                                {formatDate(profileData?.dateOfEstablishment)}
                              </Descriptions.Item>
                              <Descriptions.Item label="Store Description" span={2}>
                                <Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}>
                                  {profileData?.storeDescription || 'Not provided'}
                                </Paragraph>
                              </Descriptions.Item>
                              <Descriptions.Item label="Store Logo" span={2}>
                                {renderDocumentLink(profileData?.storeLogo, 'Logo')}
                              </Descriptions.Item>
                            </Descriptions>
                          </Panel>

                          {/* Business Address Panel */}
                          <Panel
                            header={
                              <Space>
                                <EnvironmentOutlined style={{ fontSize: 18, color: '#52c41a' }} />
                                <Text strong style={{ fontSize: 16 }}>
                                  Business Address
                                </Text>
                              </Space>
                            }
                            key="address"
                          >
                            <Descriptions
                              bordered
                              column={{ xs: 1, sm: 1, md: 2 }}
                              size="middle"
                              style={{ background: 'white' }}
                            >
                              <Descriptions.Item label="Address Line 1">
                                {profileData?.addressLine1 || 'Not provided'}
                              </Descriptions.Item>
                              <Descriptions.Item label="Address Line 2">
                                {profileData?.addressLine2 || 'N/A'}
                              </Descriptions.Item>
                              <Descriptions.Item label="City">
                                {profileData?.city || 'Not provided'}
                              </Descriptions.Item>
                              <Descriptions.Item label="State">
                                {profileData?.state || 'Not provided'}
                              </Descriptions.Item>
                              <Descriptions.Item label="Postal Code">
                                {profileData?.postalCode || 'Not provided'}
                              </Descriptions.Item>
                              <Descriptions.Item label="Country">
                                {profileData?.country || 'Not provided'}
                              </Descriptions.Item>
                            </Descriptions>
                          </Panel>

                          {/* Bank Details Panel */}
                          <Panel
                            header={
                              <Space>
                                <BankOutlined style={{ fontSize: 18, color: '#B78115' }} />
                                <Text strong style={{ fontSize: 16 }}>
                                  Bank Details
                                </Text>
                                <Tag color="gold" icon={<LockOutlined />}>
                                  Sensitive
                                </Tag>
                              </Space>
                            }
                            key="bank"
                          >
                            <Alert
                              message="🔒 Sensitive Information Protected"
                              description="Account numbers are partially hidden for your security. Contact support to update."
                              type="info"
                              showIcon
                              style={{ marginBottom: 16, borderRadius: 8 }}
                            />
                            <Descriptions
                              bordered
                              column={{ xs: 1, sm: 1, md: 2 }}
                              size="middle"
                              style={{ background: 'white' }}
                            >
                              <Descriptions.Item label="Account Holder Name">
                                <Text strong>
                                  {profileData?.accountHolderName || 'Not provided'}
                                </Text>
                              </Descriptions.Item>
                              <Descriptions.Item label="Account Number">
                                <Space>
                                  <LockOutlined style={{ color: '#faad14' }} />
                                  <Tooltip title="Full account number is hidden for security">
                                    <Text code>{maskData(profileData?.bankAccountNumber)}</Text>
                                  </Tooltip>
                                </Space>
                              </Descriptions.Item>
                              <Descriptions.Item label="Bank Name">
                                {profileData?.bankName || 'Not provided'}
                              </Descriptions.Item>
                              <Descriptions.Item label="IFSC Code">
                                <Text code>{profileData?.ifscCode || 'Not provided'}</Text>
                              </Descriptions.Item>
                              <Descriptions.Item label="Bank Branch">
                                {profileData?.bankBranch || 'Not provided'}
                              </Descriptions.Item>
                              <Descriptions.Item label="Cancelled Cheque">
                                {renderDocumentLink(profileData?.cancelledCheque, 'Cheque')}
                              </Descriptions.Item>
                            </Descriptions>
                          </Panel>

                          {/* Tax & Legal Information Panel */}
                          <Panel
                            header={
                              <Space>
                                <FileTextOutlined style={{ fontSize: 18, color: '#fa8c16' }} />
                                <Text strong style={{ fontSize: 16 }}>
                                  Tax & Legal Information
                                </Text>
                                <Tag color="gold" icon={<LockOutlined />}>
                                  Sensitive
                                </Tag>
                              </Space>
                            }
                            key="tax"
                          >
                            <Descriptions
                              bordered
                              column={{ xs: 1, sm: 1, md: 2 }}
                              size="middle"
                              style={{ background: 'white' }}
                            >
                              <Descriptions.Item label="PAN Number">
                                <Space>
                                  <LockOutlined style={{ color: '#faad14' }} />
                                  <Tooltip title="Full PAN is hidden for security">
                                    <Text code>{maskData(profileData?.panNumber, 4)}</Text>
                                  </Tooltip>
                                </Space>
                              </Descriptions.Item>
                              <Descriptions.Item label="GST Number">
                                <Space>
                                  <LockOutlined style={{ color: '#faad14' }} />
                                  <Tooltip title="Contact support to update GST number">
                                    <Text code>{maskData(profileData?.gstNumber, 6)}</Text>
                                  </Tooltip>
                                </Space>
                              </Descriptions.Item>
                              {(profileData?.businessType === 'Individual' ||
                                profileData?.businessType === 'Proprietorship') && (
                                <Descriptions.Item label="Aadhaar Number">
                                  <Space>
                                    <LockOutlined style={{ color: '#faad14' }} />
                                    <Tooltip title="Full Aadhaar is hidden for security">
                                      <Text code>{maskData(profileData?.aadhaarNumber)}</Text>
                                    </Tooltip>
                                  </Space>
                                </Descriptions.Item>
                              )}
                              <Descriptions.Item label="ID Proof">
                                {renderDocumentLink(profileData?.idProof, 'ID Proof')}
                              </Descriptions.Item>
                              <Descriptions.Item label="GST Certificate">
                                {renderDocumentLink(profileData?.gstCertificate, 'GST Certificate')}
                              </Descriptions.Item>
                              {(profileData?.businessType === 'Individual' ||
                                profileData?.businessType === 'Proprietorship') && (
                                <Descriptions.Item label="Address Proof">
                                  {renderDocumentLink(profileData?.addressProof, 'Address Proof')}
                                </Descriptions.Item>
                              )}
                              {(profileData?.businessType === 'Partnership' ||
                                profileData?.businessType === 'Pvt Ltd' ||
                                profileData?.businessType === 'LLP') && (
                                <>
                                  <Descriptions.Item label="Business Certificate">
                                    {renderDocumentLink(
                                      profileData?.businessCertificate,
                                      'Business Certificate',
                                    )}
                                  </Descriptions.Item>
                                  <Descriptions.Item label="Certificate of Incorporation">
                                    {renderDocumentLink(
                                      profileData?.certificateOfIncorporation,
                                      'Incorporation Certificate',
                                    )}
                                  </Descriptions.Item>
                                </>
                              )}
                              {profileData?.businessType === 'Trust' && (
                                <Descriptions.Item label="Trust Deed">
                                  {renderDocumentLink(profileData?.trustDeed, 'Trust Deed')}
                                </Descriptions.Item>
                              )}
                              {profileData?.businessType === 'Partnership' && (
                                <Descriptions.Item label="Partnership Deed">
                                  {renderDocumentLink(
                                    profileData?.partnershipDeed,
                                    'Partnership Deed',
                                  )}
                                </Descriptions.Item>
                              )}
                            </Descriptions>
                          </Panel>

                          {/* Authorized Person Panel (for companies) */}
                          {(profileData?.businessType === 'Partnership' ||
                            profileData?.businessType === 'Pvt Ltd' ||
                            profileData?.businessType === 'LLP') && (
                            <Panel
                              header={
                                <Space>
                                  <UserOutlined style={{ fontSize: 18, color: '#4F5552' }} />
                                  <Text strong style={{ fontSize: 16 }}>
                                    Authorized Person Details
                                  </Text>
                                </Space>
                              }
                              key="authorized"
                            >
                              <Descriptions
                                bordered
                                column={{ xs: 1, sm: 1, md: 2 }}
                                size="middle"
                                style={{ background: 'white' }}
                              >
                                <Descriptions.Item label="Name">
                                  <Text strong>
                                    {profileData?.authorizedPersonName || 'Not provided'}
                                  </Text>
                                </Descriptions.Item>
                                <Descriptions.Item label="Designation">
                                  {profileData?.authorizedPersonDesignation || 'Not provided'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Email">
                                  {profileData?.authorizedPersonEmail || 'Not provided'}
                                </Descriptions.Item>
                                <Descriptions.Item label="Phone">
                                  {profileData?.authorizedPersonPhone || 'Not provided'}
                                </Descriptions.Item>
                              </Descriptions>
                            </Panel>
                          )}
                        </Collapse>

                        {/* Rejection Alert if applicable */}
                        {user.rejectionReason && (
                          <>
                            <Divider />
                            <Alert
                              message="❌ KYC Rejected"
                              description={
                                <Space direction="vertical" style={{ width: '100%' }}>
                                  <div>
                                    <Text strong>Rejection Reason: </Text>
                                    <Text>{user.rejectionReason}</Text>
                                  </div>
                                  <Button
                                    type="primary"
                                    danger
                                    size="large"
                                    onClick={() => navigate('/submit-kyc')}
                                    icon={<EditOutlined />}
                                  >
                                    Resubmit KYC Now
                                  </Button>
                                </Space>
                              }
                              type="error"
                              showIcon
                              style={{ borderRadius: 8 }}
                            />
                          </>
                        )}
                      </Space>
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                          <Space direction="vertical" size="small">
                            <Title level={4}>KYC Not Submitted</Title>
                            <Text type="secondary">
                              Complete your KYC verification to unlock all seller features
                            </Text>
                          </Space>
                        }
                        style={{ padding: '60px 20px' }}
                      >
                        <Button
                          type="primary"
                          size="large"
                          icon={<SafetyCertificateOutlined />}
                          onClick={() => navigate('/submit-kyc')}
                        >
                          Submit KYC Now
                        </Button>
                      </Empty>
                    )}
                  </div>
                ),
              },

              {
                key: 'security',
                label: (
                  <span>
                    <KeyOutlined />
                    <span style={{ marginLeft: 8 }}>Security & Password</span>
                  </span>
                ),
                children: (
                  <div style={{ padding: '24px' }}>
                    <Space direction="vertical" size="large" style={{ width: '100%' }}>
                      {!!isLoadingProfile && !!hasPassword && (
                        <Alert
                          message="🔑 Set a Password"
                          description="You signed up with Google. Set a password so you can also log in with your email and password."
                          type="info"
                          showIcon
                          style={{ marginBottom: 24, borderRadius: 8 }}
                        />
                      )}

                      <Alert
                        message="🔐 Password Security"
                        description={
                          <div>
                            <Paragraph style={{ marginBottom: 12 }}>
                              {hasPassword
                                ? 'Keep your account secure by using a strong password. Your password must meet the following requirements:'
                                : 'Your password must meet the following requirements:'}
                            </Paragraph>
                            <Row gutter={[16, 8]}>
                              <Col xs={24} sm={12}>
                                <Space>
                                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                  <Text>Minimum 8 characters long</Text>
                                </Space>
                              </Col>
                              <Col xs={24} sm={12}>
                                <Space>
                                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                  <Text>At least one uppercase letter</Text>
                                </Space>
                              </Col>
                              <Col xs={24} sm={12}>
                                <Space>
                                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                  <Text>At least one lowercase letter</Text>
                                </Space>
                              </Col>
                              <Col xs={24} sm={12}>
                                <Space>
                                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                  <Text>At least one number</Text>
                                </Space>
                              </Col>
                              <Col xs={24} sm={12}>
                                <Space>
                                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                  <Text>At least one special character</Text>
                                </Space>
                              </Col>
                            </Row>
                          </div>
                        }
                        type="info"
                        showIcon
                        style={{ marginBottom: 32, borderRadius: 8 }}
                      />

                      <Card
                        title={
                          <Space>
                            <LockOutlined />
                            <Text strong>{hasPassword ? 'Change Password' : 'Set Password'}</Text>
                          </Space>
                        }
                        style={{ borderRadius: 8, background: '#fafafa' }}
                      >
                        <Form
                          form={passwordForm}
                          layout="vertical"
                          onFinish={handleChangePassword}
                          size="large"
                        >
                          <Row gutter={16}>
                            {hasPassword && (
                              <Col xs={24}>
                                <Form.Item
                                  name="currentPassword"
                                  label="Current Password"
                                  rules={[
                                    {
                                      required: true,
                                      message: 'Please enter your current password',
                                    },
                                  ]}
                                >
                                  <Input.Password
                                    prefix={<LockOutlined />}
                                    placeholder="Enter current password"
                                    autoComplete="current-password"
                                    size="large"
                                  />
                                </Form.Item>
                              </Col>
                            )}

                            <Col xs={24} md={12}>
                              <Form.Item
                                name="newPassword"
                                label="New Password"
                                rules={[
                                  { required: true, message: 'Please enter your new password' },
                                  { min: 8, message: 'Password must be at least 8 characters' },
                                  {
                                    pattern:
                                      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
                                    message:
                                      'Password must include uppercase, lowercase, number and special character',
                                  },
                                ]}
                              >
                                <Input.Password
                                  prefix={<KeyOutlined />}
                                  placeholder="Enter new password"
                                  autoComplete="new-password"
                                  size="large"
                                />
                              </Form.Item>
                            </Col>

                            <Col xs={24} md={12}>
                              <Form.Item
                                name="confirmPassword"
                                label="Confirm New Password"
                                dependencies={['newPassword']}
                                rules={[
                                  { required: true, message: 'Please confirm your password' },
                                  ({ getFieldValue }) => ({
                                    validator(_, value) {
                                      if (!value || getFieldValue('newPassword') === value) {
                                        return Promise.resolve()
                                      }
                                      return Promise.reject(new Error('Passwords do not match!'))
                                    },
                                  }),
                                ]}
                              >
                                <Input.Password
                                  prefix={<KeyOutlined />}
                                  placeholder="Confirm new password"
                                  autoComplete="new-password"
                                  size="large"
                                />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                            <Space size="middle">
                              <Button
                                type="primary"
                                htmlType="submit"
                                size="large"
                                danger
                                icon={<LockOutlined />}
                                loading={changePasswordMutation.isPending}
                                style={{ minWidth: 160 }}
                              >
                                {hasPassword ? 'Update Password' : 'Set Password'}
                              </Button>
                              <Button
                                size="large"
                                onClick={() => passwordForm.resetFields()}
                                disabled={changePasswordMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </Space>
                          </Form.Item>
                        </Form>
                      </Card>
                    </Space>
                  </div>
                ),
              },

              {
                key: 'account',
                label: (
                  <span>
                    <PoweroffOutlined />
                    <span style={{ marginLeft: 8 }}>Account</span>
                  </span>
                ),
                children: (
                  <div style={{ padding: '24px' }}>
                    <AccountDeactivation />
                  </div>
                ),
              },
            ]}
          />
        </Card>

        {/* Update Store Info Modal */}
        <Modal
          title={
            <Space>
              <ShopOutlined />
              <span>Update Store Information</span>
            </Space>
          }
          open={showStoreModal}
          onCancel={() => {
            setShowStoreModal(false)
            setLogoFileList([])
            storeForm.resetFields()
          }}
          footer={null}
          width={600}
        >
          <Alert
            message="Update Non-Critical Information"
            description="You can update your store logo and description without requiring admin re-approval. Changes will be visible immediately."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />

          <Form form={storeForm} layout="vertical" onFinish={handleUpdateStoreInfo} size="large">
            <Form.Item label="Current Store Logo">
              {profileData?.storeLogo ? (
                <Image
                  src={profileData.storeLogo}
                  alt="Store Logo"
                  width={120}
                  height={120}
                  style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #d9d9d9' }}
                />
              ) : (
                <div
                  style={{
                    width: 120,
                    height: 120,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px dashed #d9d9d9',
                    borderRadius: 8,
                    color: '#999',
                  }}
                >
                  <PictureOutlined style={{ fontSize: 32 }} />
                </div>
              )}
            </Form.Item>

            <Form.Item
              label="Upload New Store Logo"
              help="PNG, JPG, or WebP. Max 5MB. Recommended: 500x500px"
            >
              <Upload
                listType="picture-card"
                fileList={logoFileList}
                onChange={({ fileList }) => setLogoFileList(fileList)}
                beforeUpload={() => false}
                maxCount={1}
                accept="image/*"
              >
                {logoFileList.length === 0 && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>Upload Logo</div>
                  </div>
                )}
              </Upload>
            </Form.Item>

            <Form.Item
              name="storeDescription"
              label="Store Description"
              help="A brief description of your store (max 500 characters)"
              rules={[{ max: 500, message: 'Description cannot exceed 500 characters' }]}
            >
              <TextArea
                rows={4}
                placeholder="Tell customers about your store, products, and what makes you unique..."
                showCount
                maxLength={500}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={updateStoreMutation.isPending}
                >
                  Save Changes
                </Button>
                <Button
                  onClick={() => {
                    setShowStoreModal(false)
                    setLogoFileList([])
                    storeForm.resetFields()
                  }}
                >
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* KYC Update Warning Modal */}
        <Modal
          title={
            <Space>
              <WarningOutlined style={{ color: '#faad14' }} />
              <span>Update KYC Information</span>
            </Space>
          }
          open={showKycWarningModal}
          onOk={handleConfirmKycUpdate}
          onCancel={() => setShowKycWarningModal(false)}
          okText="Yes, Continue"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              message="Important Notice"
              description="Updating your KYC information will require admin re-approval. During the review period:"
              type="warning"
              showIcon
            />
            <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
              <li>✅ You can continue accessing your dashboard</li>
              <li>✅ You can view your existing products</li>
              <li>❌ You cannot add new products</li>
              <li>❌ You cannot edit existing products</li>
              <li>❌ Product management will be locked until re-approval</li>
            </ul>
            <Paragraph strong style={{ marginBottom: 0 }}>
              Are you sure you want to proceed with updating your KYC?
            </Paragraph>
          </Space>
        </Modal>
      </Space>
    </div>
  )
}

export default SellerProfile
