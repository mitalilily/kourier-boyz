import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Row,
  Select,
  Space,
  Spin,
  Typography,
  Divider,
  List,
} from 'antd'
import {
  FileTextOutlined,
  ShoppingCartOutlined,
  CalculatorOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import { useEffect } from 'react'
import { useInvoiceSettings, useUpdateInvoiceSettings, type InvoiceSettings } from '../../api/settings'

const { Title, Paragraph, Text } = Typography

type GSTRoundingFormValues = Pick<InvoiceSettings, 'gstRoundingMode'>

const GSTRoundingSettings = () => {
  const { message } = App.useApp()
  const { data: invoiceResponse, isLoading } = useInvoiceSettings()
  const updateInvoice = useUpdateInvoiceSettings()
  const invoiceSettings = invoiceResponse?.data

  const [form] = Form.useForm<GSTRoundingFormValues>()

  useEffect(() => {
    if (invoiceSettings) {
      form.setFieldsValue({
        gstRoundingMode: invoiceSettings.gstRoundingMode || 'ROUND_HALF_UP',
      })
    }
  }, [invoiceSettings, form])

  const handleReset = () => {
    if (invoiceSettings) {
      form.setFieldsValue({
        gstRoundingMode: invoiceSettings.gstRoundingMode || 'ROUND_HALF_UP',
      })
    }
  }

  const handleSubmit = async (values: GSTRoundingFormValues) => {
    try {
      await updateInvoice.mutateAsync({
        gstRoundingMode: values.gstRoundingMode,
      })
      message.success('GST rounding settings updated successfully')
    } catch (error) {
      console.error(error)
      message.error('Failed to update GST rounding settings')
    }
  }

  return (
    <Card>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spin />
        </div>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            message="GST Rounding Configuration"
            description="Configure how GST (Goods and Services Tax) amounts are rounded in all calculations across the KOURIER_BOYZ platform. This setting controls the rounding behavior for IGST, CGST, and SGST calculations."
          />

          <div style={{ marginBottom: 24 }}>
            <Title level={4}>Where This Setting Is Used</Title>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              The GST rounding mode you configure here applies to all GST calculations throughout the platform:
            </Paragraph>
            <List
              bordered
              dataSource={[
                {
                  icon: <ShoppingCartOutlined style={{ color: '#1890ff' }} />,
                  title: 'Order Creation',
                  description:
                    'When customers place orders, GST amounts (IGST, CGST, SGST) are calculated using this rounding mode. The rounded amounts are stored in the order items.',
                },
                {
                  icon: <FileTextOutlined style={{ color: '#52c41a' }} />,
                  title: 'Invoice Generation',
                  description:
                    'All buyer invoices, seller invoices, credit notes, and debit notes use this rounding mode when displaying GST breakdowns in the invoice PDFs.',
                },
                {
                  icon: <CalculatorOutlined style={{ color: '#faad14' }} />,
                  title: 'Tax Calculations',
                  description:
                    'All tax-related calculations including line-item GST, order-level GST totals, HSN summary aggregations, and tax reports use this rounding mode.',
                },
                {
                  icon: <BarChartOutlined style={{ color: '#722ed1' }} />,
                  title: 'Reports & Statements',
                  description:
                    'Sales reports, tax reports, settlement calculations, and all financial statements that include GST amounts use this rounding mode for consistency.',
                },
              ]}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<div style={{ fontSize: '24px' }}>{item.icon}</div>}
                    title={<Text strong>{item.title}</Text>}
                    description={item.description}
                  />
                </List.Item>
              )}
            />
          </div>

          <Divider />

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <div style={{ marginBottom: 24 }}>
              <Title level={5}>GST Rounding Mode</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Select the rounding method to apply to all GST calculations. Each mode handles
                decimal values differently:
              </Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    label="GST Rounding Mode"
                    name="gstRoundingMode"
                    rules={[{ required: true, message: 'GST rounding mode is required' }]}
                    tooltip="How to round GST amounts in all calculations across the platform"
                  >
                    <Select>
                      <Select.Option value="ROUND_HALF_UP">
                        <div>
                          <div>
                            <Text strong>Round Half Up (Standard)</Text> - Recommended
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Standard mathematical rounding: 1.5 → 2, 1.4 → 1, 2.5 → 3
                          </Text>
                        </div>
                      </Select.Option>
                      <Select.Option value="ROUND_HALF_DOWN">
                        <div>
                          <div>
                            <Text strong>Round Half Down (Banker's Rounding)</Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Round .5 down towards zero: 1.5 → 1, 1.6 → 2, 2.5 → 2
                          </Text>
                        </div>
                      </Select.Option>
                      <Select.Option value="ROUND_UP">
                        <div>
                          <div>
                            <Text strong>Round Up (Ceiling)</Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Always round up: 1.1 → 2, 1.9 → 2, 2.0 → 2
                          </Text>
                        </div>
                      </Select.Option>
                      <Select.Option value="ROUND_DOWN">
                        <div>
                          <div>
                            <Text strong>Round Down (Floor)</Text>
                          </div>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Always round down: 1.9 → 1, 1.1 → 1, 2.0 → 2
                          </Text>
                        </div>
                      </Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Alert
              type="warning"
              style={{ marginBottom: 24 }}
              message="Important Information"
              description={
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>When Changes Take Effect:</Text>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, marginBottom: 12 }}>
                    <li>
                      <Text>Changes apply immediately to all <strong>new orders</strong> placed after saving</Text>
                    </li>
                    <li>
                      <Text>All <strong>new invoices</strong> (buyer & seller) generated after saving will use the new rounding mode</Text>
                    </li>
                    <li>
                      <Text>All <strong>new reports</strong> and calculations will use the updated rounding mode</Text>
                    </li>
                  </ul>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>Existing Data:</Text>
                    <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                      <li>
                        <Text>
                          <strong>Existing orders</strong> will NOT be recalculated automatically (they retain their original GST amounts)
                        </Text>
                      </li>
                      <li>
                        <Text>
                          <strong>Existing invoices</strong> will NOT be regenerated automatically
                        </Text>
                      </li>
                    </ul>
                  </div>
                </div>
              }
            />

            <Alert
              type="success"
              style={{ marginBottom: 24 }}
              message="Default Setting"
              description={
                <Text>
                  The default rounding mode is <Text strong>Round Half Up</Text> (standard mathematical rounding), which is the most commonly used method in India for GST calculations.
                </Text>
              }
            />

            <Space>
              <Button type="primary" htmlType="submit" loading={updateInvoice.isPending}>
                Save GST Rounding Settings
              </Button>
              <Button onClick={handleReset} disabled={updateInvoice.isPending}>
                Reset
              </Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  )
}

export default GSTRoundingSettings
