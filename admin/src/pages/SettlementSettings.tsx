import { App, Button, Card, Form, InputNumber, Select, Space, Switch, Typography } from 'antd'
import { useEffect } from 'react'
import {
  useGlobalSettlementSettings,
  useUpsertGlobalSettlementSettings,
} from '../api/settlementQueries'

const { Title, Text } = Typography

const SettlementSettingsPage = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const { data, isLoading } = useGlobalSettlementSettings()
  const saveMutation = useUpsertGlobalSettlementSettings()

  useEffect(() => {
    if (data?.data) {
      const s = data.data
      form.setFieldsValue({
        settlementCycle: s.settlementCycle,
        customCycleDays: s.customCycleDays ?? undefined,
        returnWindowDays: s.returnWindowDays,
        commissionType: s.commissionType,
        commissionValue: s.commissionValue,
        minBatchAmount: s.minBatchAmount ?? undefined,
        allowSellerOverride: s.allowSellerOverride,
      })
    }
  }, [data, form])

  const handleSubmit = async (values: any) => {
    try {
      await saveMutation.mutateAsync(values)
      message.success('Settlement settings updated successfully')
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to update settlement settings')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Title level={4} className="!mb-0">
          Settlement Settings
        </Title>
        <Text type="secondary">
          Configure global defaults for how and when sellers become eligible for payouts.
        </Text>
      </div>

      <Card loading={isLoading}>
        <Form
          layout="vertical"
          form={form}
          onFinish={handleSubmit}
          initialValues={{
            settlementCycle: 'WEEKLY',
            returnWindowDays: 7,
            commissionType: 'PERCENTAGE',
            commissionValue: 10,
            allowSellerOverride: true,
          }}
        >
          <Form.Item
            name="settlementCycle"
            label="Default Settlement Cycle"
            rules={[{ required: true, message: 'Please select a settlement cycle' }]}
            extra="Controls how often you typically generate settlement batches (this is informational for now; actual generation is driven by your manual trigger or cron)."
          >
            <Select
              options={[
                { label: 'Daily', value: 'DAILY' },
                { label: 'Weekly', value: 'WEEKLY' },
                { label: 'Custom', value: 'CUSTOM' },
              ]}
              style={{ maxWidth: 240 }}
            />
          </Form.Item>

          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) =>
              getFieldValue('settlementCycle') === 'CUSTOM' ? (
                <Form.Item
                  name="customCycleDays"
                  label="Custom Cycle Days"
                  rules={[{ required: true, message: 'Please enter custom cycle days' }]}
                  extra="Number of days between settlements when using a custom cycle."
                >
                  <InputNumber min={1} max={90} style={{ maxWidth: 200 }} />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="returnWindowDays"
            label="Default Return Window (days)"
            rules={[{ required: true, message: 'Please enter return window days' }]}
            extra={
              <>
                Additional buffer added on top of the product&apos;s own return period before an
                order becomes settlement-eligible.
                <br />
                Effective hold period per order:
                <br />
                <strong>product returnDays + Default Return Window</strong>
              </>
            }
          >
            <InputNumber min={0} max={60} style={{ maxWidth: 200 }} />
          </Form.Item>

          <Form.Item
            name="commissionType"
            label="Default Commission Type"
            rules={[{ required: true, message: 'Please select commission type' }]}
            extra="Percentage = share of order value. Fixed = flat amount deducted per order."
          >
            <Select
              options={[
                { label: 'Percentage', value: 'PERCENTAGE' },
                { label: 'Fixed per order', value: 'FIXED' },
              ]}
              style={{ maxWidth: 240 }}
            />
          </Form.Item>

          <Form.Item
            name="commissionValue"
            label="Default Commission Value"
            rules={[{ required: true, message: 'Please enter commission value' }]}
            extra="If percentage, this is % of seller earnings. If fixed, this is a flat amount per order."
          >
            <InputNumber min={0} style={{ maxWidth: 200 }} />
          </Form.Item>

          <Form.Item
            name="minBatchAmount"
            label="Minimum Batch Amount (optional)"
            extra="If set, we only create a settlement batch when the seller's total net payout (credits minus debits) reaches at least this amount. Until then, eligible orders remain queued."
          >
            <InputNumber min={0} style={{ maxWidth: 200 }} />
          </Form.Item>

          <Form.Item
            name="allowSellerOverride"
            label="Allow seller-specific overrides"
            valuePropName="checked"
            extra="When enabled, you can override these defaults for specific sellers from their detail page."
          >
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saveMutation.isPending}>
                Save Settings
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default SettlementSettingsPage


