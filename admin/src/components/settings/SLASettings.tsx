import { SaveOutlined } from '@ant-design/icons'
import { App, Button, Card, Form, InputNumber, Space, Typography } from 'antd'
import { useEffect } from 'react'
import { useSLASettings, useUpdateSLASettings } from '../../api/settings'

const { Title, Paragraph } = Typography

const SLASettings = () => {
  const { message: antdMessage } = App.useApp()
  const { data: slaResponse } = useSLASettings()
  const updateSLASettings = useUpdateSLASettings()
  const [form] = Form.useForm()

  const slaSettings = slaResponse?.data

  useEffect(() => {
    if (slaSettings) {
      form.setFieldsValue({
        awbGenerationTatHours: slaSettings.awbGenerationTatHours,
        dispatchTatHours: slaSettings.dispatchTatHours,
      })
    }
  }, [slaSettings, form])

  const handleSubmit = async (values: {
    awbGenerationTatHours: number
    dispatchTatHours: number
  }) => {
    try {
      await updateSLASettings.mutateAsync({
        awbGenerationTatHours: values.awbGenerationTatHours,
        dispatchTatHours: values.dispatchTatHours,
      })
      antdMessage.success('SLA settings updated successfully')
    } catch (error: any) {
      antdMessage.error(error.response?.data?.message || 'Failed to update SLA settings')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={3}>SLA / TAT Settings</Title>
            <Paragraph type="secondary">
              Configure Turnaround Time (TAT) / Service Level Agreement (SLA) thresholds for order
              processing. These values are used dynamically across reports and dashboards.
            </Paragraph>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              awbGenerationTatHours: 24,
              dispatchTatHours: 48,
            }}
          >
            <Form.Item
              label="AWB Generation TAT (Hours)"
              name="awbGenerationTatHours"
              rules={[
                { required: true, message: 'AWB Generation TAT is required' },
                { type: 'number', min: 1, message: 'TAT must be at least 1 hour' },
              ]}
              tooltip="Time allowed from order acceptance to AWB generation"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                max={168}
                placeholder="e.g., 24"
                addonAfter="hours"
              />
            </Form.Item>

            <Form.Item
              label="Dispatch / Pickup TAT (Hours)"
              name="dispatchTatHours"
              rules={[
                { required: true, message: 'Dispatch TAT is required' },
                { type: 'number', min: 1, message: 'TAT must be at least 1 hour' },
              ]}
              tooltip="Time allowed from AWB generation to pickup completion"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                max={168}
                placeholder="e.g., 48"
                addonAfter="hours"
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={updateSLASettings.isPending}
                >
                  Save Settings
                </Button>
                <Button onClick={() => form.resetFields()}>Reset</Button>
              </Space>
            </Form.Item>
          </Form>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <Paragraph className="mb-0 text-sm">
              <strong>Note:</strong> These settings apply dynamically to all orders. TAT breach
              status is calculated at runtime based on order timestamps and current SLA
              configuration. Historical data will automatically reflect updated SLA settings.
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  )
}

export default SLASettings

