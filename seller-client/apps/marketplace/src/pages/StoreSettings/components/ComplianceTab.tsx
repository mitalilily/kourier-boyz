import { CheckOutlined, FilePdfOutlined, SaveOutlined } from '@ant-design/icons'
import {
  Alert,
  Form as AntdForm,
  App,
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Input,
  Space,
  Tag,
  Typography,
} from 'antd'
import SignaturePad from './SignaturePad'
import type { StoreSettingsTabProps } from './types'

const { Title, Paragraph, Link: TypographyLink } = Typography
const { TextArea } = Input

const ComplianceTab = ({ form, onSubmit, isLoading }: StoreSettingsTabProps) => {
  const { message } = App.useApp()

  // Watch form values for conditional rendering
  const sellerAgreementSigned = AntdForm.useWatch('sellerAgreementSigned', form)
  const returnRefundPolicyAccepted = AntdForm.useWatch('returnRefundPolicyAccepted', form)
  const prohibitedItemsDeclared = AntdForm.useWatch('prohibitedItemsDeclared', form)
  const dataPrivacyConsent = AntdForm.useWatch('dataPrivacyConsent', form)
  const sellerAgreementSignature = AntdForm.useWatch('sellerAgreementSignature', form)



  const handleSignatureChange = (value: string | File | null) => {
    form.setFieldValue('sellerAgreementSignature', value)
    // Auto-check the signature checkbox if signature is provided
    if (value) {
      form.setFieldValue('sellerAgreementSigned', true)
    }
  }

  const handleAgreementClick = (e: React.MouseEvent<HTMLElement>, type: string) => {
    e.preventDefault()
    const agreementUrl = `/agreements/${type}`
    window.open(agreementUrl, '_blank', 'noopener,noreferrer')
  }


  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>Compliance & Agreements</Title>
        <Paragraph type="secondary">
          Review and accept marketplace terms, agreements, and declarations required to sell on our
          platform.
        </Paragraph>

        <Alert
          message="Legal Requirements"
          description="You must accept all agreements and declarations to sell on our marketplace. These agreements are legally binding."
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Divider orientation="left">Marketplace Agreements</Divider>

        <Card style={{ marginBottom: 16, border: '1px solid #d9d9d9' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                Seller Terms & Agreement
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                Digital signature required. This comprehensive agreement includes platform rules, seller
                obligations, service terms, commission structure, and payment terms. You can draw your
                signature or upload a signature image file.
              </Paragraph>
              <Form.Item
                name="sellerAgreementSigned"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value) => {
                      const signature = form.getFieldValue('sellerAgreementSignature')
                      if (!value && !signature) {
                        return Promise.reject('You must sign the Seller Agreement')
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
              >
                <Checkbox>
                  I have read and digitally sign the{' '}
                  <TypographyLink
                    href="/agreements/seller-agreement"
                    target="_blank"
                    onClick={(e) => handleAgreementClick(e, 'seller-agreement')}
                  >
                    Seller Terms & Agreement
                  </TypographyLink>
                </Checkbox>
              </Form.Item>

              <Form.Item
                name="sellerAgreementSignature"
                label="Digital Signature"
                rules={[
                  {
                    validator: (_, value) => {
                      const isChecked = form.getFieldValue('sellerAgreementSigned')
                      if (isChecked && !value) {
                        return Promise.reject('Please provide a digital signature')
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
                style={{ marginTop: 16 }}
              >
                <SignaturePad
                  value={sellerAgreementSignature}
                  onChange={handleSignatureChange}
                  onClear={() => {
                    form.setFieldValue('sellerAgreementSigned', false)
                  }}
                />
              </Form.Item>

              {sellerAgreementSigned && sellerAgreementSignature && (
                <Tag color="green" icon={<CheckOutlined />} style={{ marginTop: 8 }}>
                  Signature Provided
                </Tag>
              )}
            </div>
          </Space>
        </Card>

        <Card style={{ marginBottom: 16, border: '1px solid #d9d9d9' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                Return & Refund Policy Agreement
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                Accept our standardized return and refund policy that applies to all sellers on the
                marketplace.
              </Paragraph>
              <Form.Item
                name="returnRefundPolicyAccepted"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value) =>
                      value
                        ? Promise.resolve()
                        : Promise.reject('You must accept the Return & Refund Policy'),
                  },
                ]}
              >
                <Checkbox>
                  I accept the{' '}
                  <TypographyLink
                    href="/agreements/return-refund-policy"
                    target="_blank"
                    onClick={(e) => handleAgreementClick(e, 'return-refund-policy')}
                  >
                    Return & Refund Policy
                  </TypographyLink>
                </Checkbox>
              </Form.Item>
              {returnRefundPolicyAccepted && (
                <Tag color="green" icon={<CheckOutlined />} style={{ marginTop: 8 }}>
                  Accepted
                </Tag>
              )}
              {returnRefundPolicyAccepted && (
                <Button
                  type="link"
                  icon={<FilePdfOutlined />}
                  onClick={() => {
                    const pdfUrl = form.getFieldValue('returnRefundPolicyPdfUrl')
                    if (pdfUrl) {
                      window.open(pdfUrl, '_blank')
                    } else {
                      message.warning('PDF is being generated. Please refresh in a moment.')
                    }
                  }}
                  size="small"
                  style={{ marginTop: returnRefundPolicyAccepted ? 0 : 8 }}
                  disabled={!form.getFieldValue('returnRefundPolicyPdfUrl')}
                >
                  View My PDF
                </Button>
              )}
            </div>
          </Space>
        </Card>

        <Divider orientation="left">Declarations</Divider>

        <Card style={{ marginBottom: 16, border: '1px solid #d9d9d9' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                Prohibited Items Declaration
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                Declare that you will not sell prohibited items including illegal products,
                counterfeit goods, restricted items, etc.
              </Paragraph>
              <Form.Item
                name="prohibitedItemsDeclared"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value) =>
                      value
                        ? Promise.resolve()
                        : Promise.reject(
                            'You must declare that you will not sell prohibited items',
                          ),
                  },
                ]}
              >
                <Checkbox>
                  I declare that I will not sell any prohibited items listed in the{' '}
                  <TypographyLink
                    href="/agreements/prohibited-items"
                    target="_blank"
                    onClick={(e) => handleAgreementClick(e, 'prohibited-items')}
                  >
                    Prohibited Items Policy
                  </TypographyLink>
                </Checkbox>
              </Form.Item>
            </div>
            <Form.Item
              name="prohibitedItemsDeclaration"
              label="Additional Declaration"
              tooltip="If needed, provide additional details about your product compliance"
            >
              <TextArea
                rows={3}
                placeholder="I understand and confirm that all products I list comply with marketplace policies..."
                maxLength={500}
                showCount
              />
            </Form.Item>
            {prohibitedItemsDeclared && (
              <Tag color="blue" icon={<CheckOutlined />} style={{ marginTop: 8 }}>
                Declared
              </Tag>
            )}
            {prohibitedItemsDeclared && (
              <Button
                type="link"
                icon={<FilePdfOutlined />}
                onClick={() => {
                  const pdfUrl = form.getFieldValue('prohibitedItemsPdfUrl')
                  if (pdfUrl) {
                    window.open(pdfUrl, '_blank')
                  } else {
                    message.warning('PDF is being generated. Please refresh in a moment.')
                  }
                }}
                size="small"
                style={{ marginTop: prohibitedItemsDeclared ? 0 : 8 }}
                disabled={!form.getFieldValue('prohibitedItemsPdfUrl')}
              >
                View My PDF
              </Button>
            )}
          </Space>
        </Card>

        <Divider orientation="left">Data Privacy</Divider>

        <Card style={{ marginBottom: 16, border: '1px solid #d9d9d9' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Title level={5} style={{ margin: 0, marginBottom: 8 }}>
                Data Privacy & Usage Consent
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                Consent to the collection, processing, and usage of your data as outlined in our
                privacy policy.
              </Paragraph>
              <Form.Item
                name="dataPrivacyConsent"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value) =>
                      value
                        ? Promise.resolve()
                        : Promise.reject('You must provide data privacy consent'),
                  },
                ]}
              >
                <Checkbox>
                  I consent to data collection and usage as per the{' '}
                  <TypographyLink
                    href="/agreements/seller-privacy-policy"
                    target="_blank"
                    onClick={(e) => handleAgreementClick(e, 'seller-privacy-policy')}
                  >
                    Seller Privacy Policy
                  </TypographyLink>
                </Checkbox>
              </Form.Item>
              {dataPrivacyConsent && (
                <Tag color="green" icon={<CheckOutlined />} style={{ marginTop: 8 }}>
                  Consent Provided
                </Tag>
              )}
              {dataPrivacyConsent && (
                <Button
                  type="link"
                  icon={<FilePdfOutlined />}
                  onClick={() => {
                    const pdfUrl = form.getFieldValue('dataPrivacyPdfUrl')
                    if (pdfUrl) {
                      window.open(pdfUrl, '_blank')
                    } else {
                      message.warning('PDF is being generated. Please refresh in a moment.')
                    }
                  }}
                  size="small"
                  style={{ marginTop: dataPrivacyConsent ? 0 : 8 }}
                  disabled={!form.getFieldValue('dataPrivacyPdfUrl')}
                >
                  View My PDF
                </Button>
              )}
            </div>
          </Space>
        </Card>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SaveOutlined />}
            loading={isLoading}
            size="large"
          >
            Save Compliance & Agreements
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default ComplianceTab
