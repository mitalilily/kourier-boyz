import { SaveOutlined } from '@ant-design/icons'
import { Button, Card, Form, Switch, Typography } from 'antd'
import type { StoreSettingsTabProps } from './types'

const { Title, Text, Paragraph } = Typography

const PreferencesTab = ({ form, onSubmit, isLoading }: StoreSettingsTabProps) => {
  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>Store Preferences</Title>
        <Paragraph type="secondary">
          Configure automation and notification preferences for your store.
        </Paragraph>

        <Form.Item
          name="lowStockNotification"
          label="Low Stock Notifications"
          tooltip="Receive notifications when product stock falls below threshold"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Get notified via email when products run low on stock
        </Text>

        <Form.Item
          name="newOrderNotification"
          label="New Order Notifications"
          tooltip="Receive notifications when new orders are placed"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Get notified via email when customers place new orders
        </Text>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
            Save Preferences
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default PreferencesTab
