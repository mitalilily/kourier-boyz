import {
  EyeOutlined,
  FilePdfOutlined,
  SaveOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useMemo, useState } from 'react'
import {
  useAgreementByType,
  useAgreements,
  useGenerateAgreementPDF,
  useUpsertAgreement,
} from '../api/agreementQueries'
import type { AgreementType } from '../api/agreements'
import PermissionButton from '../components/PermissionButton'
import PermissionGate from '../components/PermissionGate'
import RichTextEditor from '../components/RichTextEditor'
import { useModulePermissions } from '../hooks/useModulePermissions'

const { Title, Text } = Typography

// Seller-specific agreements
const SELLER_AGREEMENTS: { key: AgreementType; label: string; description: string }[] = [
  {
    key: 'seller-agreement',
    label: 'Seller Terms & Agreement',
    description: 'Platform rules, obligations, commission, and payment terms',
  },
  {
    key: 'return-refund-policy',
    label: 'Seller Return & Refund Policy',
    description: 'Return and refund policy for sellers',
  },
  {
    key: 'prohibited-items',
    label: 'Prohibited Items Policy',
    description: 'Items that cannot be sold',
  },
  {
    key: 'seller-privacy-policy',
    label: 'Seller Privacy Policy',
    description: 'Privacy policy for sellers',
  },
]

// Buyer/Customer-specific agreements
const BUYER_AGREEMENTS: { key: AgreementType; label: string; description: string }[] = [
  {
    key: 'customer-terms',
    label: 'Customer Terms & Conditions',
    description: 'Terms & Conditions for buyers/customers',
  },
  {
    key: 'privacy-policy',
    label: 'Customer Privacy Policy',
    description: 'Privacy policy for buyers/customers',
  },
  {
    key: 'customer-return-refund-policy',
    label: 'Customer Return & Refund Policy',
    description: 'Return and refund policy for buyers/customers',
  },
]

// All agreements combined
const ALL_AGREEMENTS = [...SELLER_AGREEMENTS, ...BUYER_AGREEMENTS]

const AgreementsPage = () => {
  const { message: messageApi } = App.useApp()
  const [form] = Form.useForm()
  const [activeTab, setActiveTab] = useState<AgreementType>('seller-agreement')
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const agreementsPermissions = useModulePermissions('agreements')

  // Fetch all agreements for statistics
  const { data: allAgreements } = useAgreements()
  const { data: currentAgreement, isLoading: isLoadingCurrent } = useAgreementByType(activeTab)
  const upsertMutation = useUpsertAgreement()
  const generatePDFMutation = useGenerateAgreementPDF()

  // Calculate statistics
  const stats = useMemo(() => {
    if (!allAgreements) return { total: 0, active: 0, seller: 0, buyer: 0 }

    const active = allAgreements.filter((a) => a.isActive).length
    const seller = allAgreements
      .filter((a) => SELLER_AGREEMENTS.some((sa) => sa.key === a.type))
      .filter((a) => a.isActive).length
    const buyer = allAgreements
      .filter((a) => BUYER_AGREEMENTS.some((ba) => ba.key === a.type))
      .filter((a) => a.isActive).length

    return {
      total: allAgreements.length,
      active,
      seller,
      buyer,
    }
  }, [allAgreements])

  // Get agreement status
  const getAgreementStatus = (type: AgreementType) => {
    const agreement = allAgreements?.find((a) => a.type === type && a.isActive)
    return agreement
      ? { exists: true, version: agreement.version, updatedAt: agreement.updatedAt }
      : { exists: false, version: 0, updatedAt: null }
  }

  const handleSubmit = async (values: {
    title: string
    content: string
    effectiveDate: dayjs.Dayjs
  }) => {
    try {
      await upsertMutation.mutateAsync({
        type: activeTab,
        title: values.title,
        content: values.content,
        effectiveDate: values.effectiveDate.toISOString(),
      })
      messageApi.success('Agreement saved successfully!')
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } }
      messageApi.error(err.response?.data?.error || 'Failed to save agreement')
    }
  }

  const handlePreview = () => {
    const content = form.getFieldValue('content') || currentAgreement?.content || ''
    const title = form.getFieldValue('title') || currentAgreement?.title || 'Preview'
    setPreviewContent(content)
    setPreviewTitle(title)
    setPreviewVisible(true)
  }

  const handleGeneratePDF = async () => {
    try {
      await generatePDFMutation.mutateAsync(activeTab)
      messageApi.success('PDF generated successfully!')
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } }
      messageApi.error(err.response?.data?.error || 'Failed to generate PDF')
    }
  }

  // Update form when agreement changes
  useEffect(() => {
    if (currentAgreement) {
      form.setFieldsValue({
        title: currentAgreement.title,
        content: currentAgreement.content,
        effectiveDate: currentAgreement.effectiveDate
          ? dayjs(currentAgreement.effectiveDate)
          : dayjs(),
      })
    } else {
      form.resetFields()
      const agreementInfo = ALL_AGREEMENTS.find((t) => t.key === activeTab)
      form.setFieldsValue({
        title: agreementInfo?.label || '',
        content: '',
        effectiveDate: dayjs(),
      })
    }
  }, [currentAgreement, activeTab, form])

  const renderAgreementItem = (
    agreement: (typeof SELLER_AGREEMENTS)[0] | (typeof BUYER_AGREEMENTS)[0],
  ) => {
    const status = getAgreementStatus(agreement.key)
    const isActive = activeTab === agreement.key

    return (
      <div
        key={agreement.key}
        onClick={() => setActiveTab(agreement.key)}
        style={{
          padding: '12px 16px',
          marginBottom: 8,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'all 0.2s',
          backgroundColor: isActive ? '#e6f7ff' : 'transparent',
          border: isActive ? '1px solid #1890ff' : '1px solid #f0f0f0',
          borderLeft: isActive ? '3px solid #1890ff' : '3px solid transparent',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text strong style={{ fontSize: 14, color: isActive ? '#1890ff' : '#262626' }}>
                {agreement.label}
              </Text>
              {status.exists && (
                <Tag
                  color="success"
                  style={{
                    margin: 0,
                    fontSize: 11,
                    padding: '0 6px',
                    height: 20,
                    lineHeight: '20px',
                  }}
                >
                  v{status.version}
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
              {agreement.description}
            </Text>
          </div>
          <div>{status.exists ? <Badge status="success" /> : <Badge status="default" />}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, marginBottom: 8, fontWeight: 600 }}>
          Terms & Agreements
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          Manage agreements and policies for sellers and customers
        </Text>
      </div>

      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Total</span>}
              value={stats.total}
              valueStyle={{ color: '#fff', fontSize: 24, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Active</span>}
              value={stats.active}
              valueStyle={{ color: '#fff', fontSize: 24, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Sellers</span>}
              value={stats.seller}
              valueStyle={{ color: '#fff', fontSize: 24, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            bordered={false}
            style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>Buyers</span>}
              value={stats.buyer}
              valueStyle={{ color: '#fff', fontSize: 24, fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        {/* Left Sidebar - Agreement List */}
        <Col xs={24} lg={7}>
          <Card
            bordered={false}
            style={{
              position: 'sticky',
              top: 24,
            }}
            bodyStyle={{ padding: '20px 16px' }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ShopOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                <Text strong style={{ fontSize: 14, color: '#1890ff' }}>
                  For Sellers
                </Text>
              </div>
              <div style={{ paddingLeft: 24 }}>
                {SELLER_AGREEMENTS.map((agreement) => renderAgreementItem(agreement))}
              </div>
            </div>

            <Divider style={{ margin: '20px 0' }} />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ShoppingCartOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <Text strong style={{ fontSize: 14, color: '#52c41a' }}>
                  For Buyers
                </Text>
              </div>
              <div style={{ paddingLeft: 24 }}>
                {BUYER_AGREEMENTS.map((agreement) => renderAgreementItem(agreement))}
              </div>
            </div>
          </Card>
        </Col>

        {/* Right Side - Editor */}
        <Col xs={24} lg={17}>
          <Card
            bordered={false}
            title={
              <Space>
                <Text strong style={{ fontSize: 16 }}>
                  {ALL_AGREEMENTS.find((a) => a.key === activeTab)?.label || 'Edit Agreement'}
                </Text>
                {currentAgreement && (
                  <Tag color="success" style={{ margin: 0 }}>
                    Version {currentAgreement.version}
                  </Tag>
                )}
              </Space>
            }
            extra={
              <Space>
                <PermissionGate module="agreements" permission="update">
                  <Button
                    icon={<EyeOutlined />}
                    onClick={handlePreview}
                    disabled={!form.getFieldValue('content') && !currentAgreement?.content}
                  >
                    Preview
                  </Button>
                  {currentAgreement && (
                    <Button
                      icon={<FilePdfOutlined />}
                      onClick={handleGeneratePDF}
                      loading={generatePDFMutation.isPending}
                    >
                      PDF
                    </Button>
                  )}
                </PermissionGate>
              </Space>
            }
            loading={isLoadingCurrent}
            bodyStyle={{ padding: 24 }}
          >
            {currentAgreement && (
              <div
                style={{
                  marginBottom: 24,
                  padding: 16,
                  background: '#fafafa',
                  borderRadius: 8,
                  border: '1px solid #f0f0f0',
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                    >
                      Status
                    </Text>
                    <Tag color={currentAgreement.isActive ? 'success' : 'default'}>
                      {currentAgreement.isActive ? 'Active' : 'Inactive'}
                    </Tag>
                  </Col>
                  <Col span={12}>
                    <Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                    >
                      Last Updated
                    </Text>
                    <Text style={{ fontSize: 13 }}>
                      {dayjs(currentAgreement.updatedAt).format('MMM DD, YYYY')}
                    </Text>
                  </Col>
                  {currentAgreement.effectiveDate && (
                    <Col span={12} style={{ marginTop: 12 }}>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                      >
                        Effective Date
                      </Text>
                      <Text style={{ fontSize: 13 }}>
                        {dayjs(currentAgreement.effectiveDate).format('MMM DD, YYYY')}
                      </Text>
                    </Col>
                  )}
                  {currentAgreement.pdfUrl && (
                    <Col span={12} style={{ marginTop: 12 }}>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginBottom: 4 }}
                      >
                        PDF
                      </Text>
                      <a
                        href={currentAgreement.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 13 }}
                      >
                        View PDF
                      </a>
                    </Col>
                  )}
                </Row>
              </div>
            )}

            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              <Form.Item
                name="title"
                label={<Text strong>Title</Text>}
                rules={
                  agreementsPermissions.canUpdate
                    ? [{ required: true, message: 'Please enter a title' }]
                    : []
                }
              >
                <Input
                  placeholder="Enter agreement title"
                  disabled={!agreementsPermissions.canUpdate}
                  readOnly={!agreementsPermissions.canUpdate}
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="content"
                label={<Text strong>Content</Text>}
                rules={
                  agreementsPermissions.canUpdate
                    ? [{ required: true, message: 'Please enter agreement content' }]
                    : []
                }
              >
                <RichTextEditor
                  placeholder="Enter agreement content using the rich text editor above..."
                  readOnly={!agreementsPermissions.canUpdate}
                />
              </Form.Item>

              <Form.Item
                name="effectiveDate"
                label={<Text strong>Effective Date</Text>}
                rules={
                  agreementsPermissions.canUpdate
                    ? [{ required: true, message: 'Please select an effective date' }]
                    : []
                }
              >
                <DatePicker
                  style={{ width: '100%' }}
                  disabled={!agreementsPermissions.canUpdate}
                  size="large"
                />
              </Form.Item>

              <PermissionGate module="agreements" permission="update">
                <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
                  <Space>
                    <PermissionButton
                      module="agreements"
                      permission="update"
                      type="primary"
                      htmlType="submit"
                      icon={<SaveOutlined />}
                      loading={upsertMutation.isPending}
                      size="large"
                    >
                      Save Agreement
                    </PermissionButton>
                    {currentAgreement && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Will create version {currentAgreement.version + 1}
                      </Text>
                    )}
                  </Space>
                </Form.Item>
              </PermissionGate>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* Preview Modal */}
      <Modal
        title={previewTitle}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            Close
          </Button>,
        ]}
        width={900}
      >
        <div
          style={{
            padding: 24,
            background: '#fafafa',
            borderRadius: 8,
            lineHeight: 1.8,
            maxHeight: '70vh',
            overflow: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: previewContent }}
        />
      </Modal>
    </div>
  )
}

export default AgreementsPage
