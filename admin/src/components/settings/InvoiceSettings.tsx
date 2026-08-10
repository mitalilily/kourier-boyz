import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd'
import { useEffect } from 'react'
import { useInvoiceSettings, useUpdateInvoiceSettings, type InvoiceSettings } from '../../api/settings'

const { Title, Paragraph } = Typography

type InvoiceFormValues = InvoiceSettings

const InvoiceSettingsTab = () => {
  const { message } = App.useApp()
  const { data: invoiceResponse, isLoading: isInvoiceLoading } = useInvoiceSettings()
  const updateInvoice = useUpdateInvoiceSettings()
  const invoiceSettings = invoiceResponse?.data

  const [invoiceForm] = Form.useForm<InvoiceFormValues>()

  useEffect(() => {
    if (invoiceSettings) {
      invoiceForm.setFieldsValue(invoiceSettings)
    }
  }, [invoiceSettings, invoiceForm])

  const handleInvoiceReset = () => {
    if (invoiceSettings) {
      invoiceForm.setFieldsValue(invoiceSettings)
    }
  }

  const handleInvoiceSubmit = async (values: InvoiceFormValues) => {
    try {
      await updateInvoice.mutateAsync(values)
      message.success('Invoice settings updated successfully')
    } catch (error) {
      console.error(error)
      message.error('Failed to update invoice settings')
    }
  }

  return (
    <Card>
      {isInvoiceLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spin />
        </div>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            message="Configure invoice number generation, formatting, and display options. These settings apply to all invoices, credit notes, and debit notes."
          />
          <Form form={invoiceForm} layout="vertical" onFinish={handleInvoiceSubmit}>
            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Invoice Numbering</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Configure prefixes and sequence settings for invoice number generation.
              </Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Invoice Prefix"
                    name="invoicePrefix"
                    rules={[{ required: true, message: 'Invoice prefix is required' }]}
                    tooltip="Prefix for tax invoices (e.g., TAT/INV)"
                  >
                    <Input placeholder="TAT/INV" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Credit Note Prefix"
                    name="creditNotePrefix"
                    rules={[{ required: true, message: 'Credit note prefix is required' }]}
                    tooltip="Prefix for credit notes (e.g., TAT/CN)"
                  >
                    <Input placeholder="TAT/CN" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Debit Note Prefix"
                    name="debitNotePrefix"
                    rules={[{ required: true, message: 'Debit note prefix is required' }]}
                    tooltip="Prefix for debit notes (e.g., TAT/DN)"
                  >
                    <Input placeholder="TAT/DN" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Financial Year Format"
                    name="financialYearFormat"
                    rules={[{ required: true, message: 'Financial year format is required' }]}
                    tooltip="Format for financial year in invoice numbers (e.g., YY-YY)"
                  >
                    <Input placeholder="YY-YY" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Sequence Start"
                    name="sequenceStart"
                    rules={[
                      { required: true, message: 'Sequence start is required' },
                      { type: 'number', min: 1, message: 'Must be at least 1' },
                    ]}
                    tooltip="Starting number for invoice sequences"
                  >
                    <InputNumber min={1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Reset Frequency"
                    name="resetFrequency"
                    rules={[{ required: true, message: 'Reset frequency is required' }]}
                    tooltip="When to reset invoice sequences"
                  >
                    <Select>
                      <Select.Option value="FINANCIAL_YEAR">Financial Year</Select.Option>
                      <Select.Option value="CALENDAR_YEAR">Calendar Year</Select.Option>
                      <Select.Option value="NEVER">Never</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Formatting</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Configure currency, date format, and rounding behavior.
              </Paragraph>
              <Row gutter={16}>
                          <Col xs={24} md={8}>
                            <Form.Item
                              label="Currency"
                              name="currency"
                              rules={[{ required: true, message: 'Currency is required' }]}
                              tooltip="Select the currency for invoices"
                            >
                              <Select 
                                placeholder="Select currency" 
                                showSearch 
                                filterOption={(input, option) =>
                                  String(option?.label ?? option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                              >
                                <Select.Option value="INR">INR - Indian Rupee (₹)</Select.Option>
                                <Select.Option value="USD">USD - US Dollar ($)</Select.Option>
                                <Select.Option value="EUR">EUR - Euro (€)</Select.Option>
                                <Select.Option value="GBP">GBP - British Pound (£)</Select.Option>
                                <Select.Option value="JPY">JPY - Japanese Yen (¥)</Select.Option>
                                <Select.Option value="AUD">AUD - Australian Dollar (A$)</Select.Option>
                                <Select.Option value="CAD">CAD - Canadian Dollar (C$)</Select.Option>
                                <Select.Option value="CHF">CHF - Swiss Franc (CHF)</Select.Option>
                                <Select.Option value="CNY">CNY - Chinese Yuan (¥)</Select.Option>
                                <Select.Option value="SGD">SGD - Singapore Dollar (S$)</Select.Option>
                                <Select.Option value="AED">AED - UAE Dirham (د.إ)</Select.Option>
                                <Select.Option value="SAR">SAR - Saudi Riyal (﷼)</Select.Option>
                                <Select.Option value="MYR">MYR - Malaysian Ringgit (RM)</Select.Option>
                                <Select.Option value="THB">THB - Thai Baht (฿)</Select.Option>
                                <Select.Option value="PKR">PKR - Pakistani Rupee (₨)</Select.Option>
                                <Select.Option value="BDT">BDT - Bangladeshi Taka (৳)</Select.Option>
                                <Select.Option value="NZD">NZD - New Zealand Dollar (NZ$)</Select.Option>
                                <Select.Option value="ZAR">ZAR - South African Rand (R)</Select.Option>
                                <Select.Option value="BRL">BRL - Brazilian Real (R$)</Select.Option>
                                <Select.Option value="MXN">MXN - Mexican Peso ($)</Select.Option>
                              </Select>
                            </Form.Item>
                          </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Rounding Mode"
                    name="roundingMode"
                    rules={[{ required: true, message: 'Rounding mode is required' }]}
                    tooltip="How to round amounts in invoices"
                  >
                    <Select>
                      <Select.Option value="ROUND_HALF_UP">Round Half Up</Select.Option>
                      <Select.Option value="ROUND_HALF_DOWN">Round Half Down</Select.Option>
                      <Select.Option value="ROUND_UP">Round Up</Select.Option>
                      <Select.Option value="ROUND_DOWN">Round Down</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    label="Date Format"
                    name="dateFormat"
                    rules={[{ required: true, message: 'Date format is required' }]}
                    tooltip="Format for dates in invoices (e.g., DD MMM YYYY)"
                  >
                    <Input placeholder="DD MMM YYYY" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Display Options</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Control what information is shown on invoices.
              </Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="showHsnSummary"
                    valuePropName="checked"
                    tooltip="Show HSN/SAC summary table on invoices"
                  >
                    <Switch checkedChildren="Show HSN Summary" unCheckedChildren="Hide HSN Summary" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="showGstBreakup"
                    valuePropName="checked"
                    tooltip="Show GST breakup columns (IGST, CGST, SGST) in item table"
                  >
                    <Switch checkedChildren="Show GST Breakup" unCheckedChildren="Hide GST Breakup" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Seller Customization</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Allow sellers to customize their invoices with their own branding.
              </Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="allowSellerLogo"
                    valuePropName="checked"
                    tooltip="Allow sellers to use their own logo on invoices"
                  >
                    <Switch
                      checkedChildren="Allow Seller Logo"
                      unCheckedChildren="Marketplace Logo Only"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="allowSellerSignature"
                    valuePropName="checked"
                    tooltip="Allow sellers to use their own signature on invoices"
                  >
                    <Switch
                      checkedChildren="Allow Seller Signature"
                      unCheckedChildren="Marketplace Signature Only"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item
                    name="allowSellerFooterNote"
                    valuePropName="checked"
                    tooltip="Allow sellers to add custom footer note on invoices"
                  >
                    <Switch checkedChildren="Allow Footer Note" unCheckedChildren="No Footer Note" />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Invoice Protection</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Prevent invoices from being regenerated after they are issued.
              </Paragraph>
              <Form.Item
                name="lockAfterIssue"
                valuePropName="checked"
                tooltip="When enabled, invoices cannot be regenerated once issued"
              >
                <Switch checkedChildren="Lock After Issue" unCheckedChildren="Allow Regeneration" />
              </Form.Item>
            </div>

            <Space>
              <Button type="primary" htmlType="submit" loading={updateInvoice.isPending}>
                Save Invoice Settings
              </Button>
              <Button onClick={handleInvoiceReset} disabled={updateInvoice.isPending}>
                Reset
              </Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  )
}

export default InvoiceSettingsTab

