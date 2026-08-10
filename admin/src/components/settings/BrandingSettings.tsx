import { DeleteOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Image,
  Input,
  Row,
  Space,
  Spin,
  Typography,
  Upload,
} from 'antd'
import type { UploadProps } from 'antd/es/upload'
import type { UploadFile } from 'antd/es/upload/interface'
import { useEffect, useState } from 'react'
import { useBrandingSettings, useUpdateBrandingSettings } from '../../api/settings'
import SignaturePad from '../SignaturePad'

const { Title, Paragraph } = Typography

type BrandingFormValues = {
  signatureName?: string
  signatureTitle?: string
  companyName?: string
  companyTagline?: string
  authorizedSignature?: string | File | null
}

const base64ToFile = (base64: string, filename: string = 'signature.png'): File => {
  const arr = base64.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

const BrandingSettings = () => {
  const { message } = App.useApp()
  const { data: brandingResponse, isLoading: isBrandingLoading } = useBrandingSettings()
  const updateBranding = useUpdateBrandingSettings()
  const branding = brandingResponse?.data

  const [brandingForm] = Form.useForm<BrandingFormValues>()
  const [invoiceLogoList, setInvoiceLogoList] = useState<UploadFile[]>([])
  const [labelLogoList, setLabelLogoList] = useState<UploadFile[]>([])
  const [signatureValue, setSignatureValue] = useState<string | File | null>(null)
  const [removeInvoiceLogo, setRemoveInvoiceLogo] = useState(false)
  const [removeLabelLogo, setRemoveLabelLogo] = useState(false)

  const uploadProps: UploadProps = {
    accept: 'image/*',
    beforeUpload: () => false,
    listType: 'picture-card',
    multiple: false,
    maxCount: 1,
  }

  useEffect(() => {
    brandingForm.setFieldsValue({
      signatureName: branding?.signatureName || '',
      signatureTitle: branding?.signatureTitle || '',
      companyName: branding?.companyName || '',
      companyTagline: branding?.companyTagline || '',
      authorizedSignature: branding?.signatureUrl || null,
    })
    setSignatureValue(branding?.signatureUrl || null)
  }, [branding, brandingForm])

  const handleBrandingReset = () => {
    setInvoiceLogoList([])
    setLabelLogoList([])
    setSignatureValue(branding?.signatureUrl || null)
    setRemoveInvoiceLogo(false)
    setRemoveLabelLogo(false)
    brandingForm.setFieldsValue({
      signatureName: branding?.signatureName || '',
      signatureTitle: branding?.signatureTitle || '',
      companyName: branding?.companyName || '',
      companyTagline: branding?.companyTagline || '',
      authorizedSignature: branding?.signatureUrl || null,
    })
  }

  const handleBrandingSubmit = async (values: BrandingFormValues) => {
    try {
      const formData = new FormData()

      const invoiceLogoFile = invoiceLogoList[0]?.originFileObj as File | undefined
      if (invoiceLogoFile) {
        formData.append('invoiceLogo', invoiceLogoFile)
      } else if (removeInvoiceLogo) {
        formData.append('clearInvoiceLogo', 'true')
      }

      const labelLogoFile = labelLogoList[0]?.originFileObj as File | undefined
      if (labelLogoFile) {
        formData.append('labelLogo', labelLogoFile)
      } else if (removeLabelLogo) {
        formData.append('clearLabelLogo', 'true')
      }

      if (signatureValue) {
        let signatureFile: File
        if (typeof signatureValue === 'string' && signatureValue.startsWith('data:image')) {
          signatureFile = base64ToFile(signatureValue, 'signature.png')
          formData.append('authorizedSignature', signatureFile)
        } else if (signatureValue instanceof File) {
          formData.append('authorizedSignature', signatureValue)
        }
      } else if (branding?.signatureUrl && !signatureValue) {
        formData.append('clearSignature', 'true')
      }

      if (values.signatureName !== undefined) {
        formData.append('signatureName', values.signatureName ?? '')
      }
      if (values.signatureTitle !== undefined) {
        formData.append('signatureTitle', values.signatureTitle ?? '')
      }
      if (values.companyName !== undefined) {
        formData.append('companyName', values.companyName ?? '')
      }
      if (values.companyTagline !== undefined) {
        formData.append('companyTagline', values.companyTagline ?? '')
      }

      await updateBranding.mutateAsync(formData)
      message.success('Branding settings updated successfully')
      setInvoiceLogoList([])
      setLabelLogoList([])
      setRemoveInvoiceLogo(false)
      setRemoveLabelLogo(false)
    } catch (error) {
      console.error(error)
      message.error('Failed to update branding settings')
    }
  }

  return (
    <Card>
      {isBrandingLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spin />
        </div>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            message="Customize branding for invoices and shipping labels. These settings will be applied to all customer and seller invoices."
          />
          <Form form={brandingForm} layout="vertical" onFinish={handleBrandingSubmit}>
            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Company Information</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                These details will appear on invoices when no logo is uploaded.
              </Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Company Name"
                    name="companyName"
                    tooltip="Displayed on invoices when logo is not available"
                  >
                    <Input placeholder="e.g., Kourier Boyz Marketplace" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="Company Tagline"
                    name="companyTagline"
                    tooltip="Displayed below company name on invoices"
                  >
                    <Input placeholder="e.g., Online Marketplace Platform" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Logos</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Upload logos for invoices and shipping labels. Recommended size: 200x60px or similar
                aspect ratio.
              </Paragraph>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Card size="small" style={{ border: '1px solid #d9d9d9' }}>
                    <Form.Item label="Invoice Logo">
                      <div style={{ position: 'relative' }}>
                        {branding?.invoiceLogoUrl &&
                          invoiceLogoList.length === 0 &&
                          !removeInvoiceLogo && (
                            <div style={{ marginBottom: 12, position: 'relative' }}>
                              <Image
                                src={branding.invoiceLogoUrl}
                                width="100%"
                                style={{ maxWidth: 300, borderRadius: 4 }}
                                alt="Current invoice logo"
                                preview={{ mask: <EyeOutlined /> }}
                              />
                              <Button
                                icon={<DeleteOutlined />}
                                danger
                                size="small"
                                style={{ marginTop: 8 }}
                                onClick={() => {
                                  setInvoiceLogoList([])
                                  setRemoveInvoiceLogo(true)
                                }}
                              >
                                Remove Logo
                              </Button>
                            </div>
                          )}
                        <Upload
                          {...uploadProps}
                          fileList={invoiceLogoList}
                          onChange={({ fileList }) => {
                            setInvoiceLogoList(fileList.slice(-1))
                            setRemoveInvoiceLogo(false)
                          }}
                          onRemove={() => {
                            setInvoiceLogoList([])
                            return true
                          }}
                        >
                          {invoiceLogoList.length === 0 && (
                            <div>
                              <UploadOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                              <div style={{ marginTop: 8 }}>
                                {branding?.invoiceLogoUrl ? 'Replace Logo' : 'Upload Logo'}
                              </div>
                            </div>
                          )}
                        </Upload>
                      </div>
                    </Form.Item>
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card size="small" style={{ border: '1px solid #d9d9d9' }}>
                    <Form.Item label="Shipping Label Logo (optional)">
                      <div style={{ position: 'relative' }}>
                        {branding?.labelLogoUrl &&
                          labelLogoList.length === 0 &&
                          !removeLabelLogo && (
                            <div style={{ marginBottom: 12, position: 'relative' }}>
                              <Image
                                src={branding.labelLogoUrl}
                                width="100%"
                                style={{ maxWidth: 300, borderRadius: 4 }}
                                alt="Current label logo"
                                preview={{ mask: <EyeOutlined /> }}
                              />
                              <Button
                                icon={<DeleteOutlined />}
                                danger
                                size="small"
                                style={{ marginTop: 8 }}
                                onClick={() => {
                                  setLabelLogoList([])
                                  setRemoveLabelLogo(true)
                                }}
                              >
                                Remove Logo
                              </Button>
                            </div>
                          )}
                        <Upload
                          {...uploadProps}
                          fileList={labelLogoList}
                          onChange={({ fileList }) => {
                            setLabelLogoList(fileList.slice(-1))
                            setRemoveLabelLogo(false)
                          }}
                          onRemove={() => {
                            setLabelLogoList([])
                            return true
                          }}
                        >
                          {labelLogoList.length === 0 && (
                            <div>
                              <UploadOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                              <div style={{ marginTop: 8 }}>
                                {branding?.labelLogoUrl ? 'Replace Logo' : 'Upload Logo'}
                              </div>
                            </div>
                          )}
                        </Upload>
                      </div>
                    </Form.Item>
                  </Card>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Authorized Signature</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Draw your signature on the canvas or upload a signature image file. This will appear
                on invoices and shipping labels.
              </Paragraph>
              <Form.Item name="authorizedSignature">
                <SignaturePad
                  value={signatureValue}
                  onChange={(value) => {
                    setSignatureValue(value)
                    brandingForm.setFieldValue('authorizedSignature', value)
                  }}
                  onClear={() => {
                    setSignatureValue(null)
                    brandingForm.setFieldValue('authorizedSignature', null)
                  }}
                />
              </Form.Item>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Signature Details</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Name and title for the authorized signatory on invoices.
              </Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Signature Name" name="signatureName">
                    <Input placeholder="Authorized signatory name" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Signature Title" name="signatureTitle">
                    <Input placeholder="Designation / title" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Space>
              <Button type="primary" htmlType="submit" loading={updateBranding.isPending}>
                Save Branding Settings
              </Button>
              <Button onClick={handleBrandingReset} disabled={updateBranding.isPending}>
                Reset
              </Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  )
}

export default BrandingSettings

