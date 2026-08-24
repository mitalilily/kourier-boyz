import { SaveOutlined } from '@ant-design/icons'
import { Button, Card, Divider, Form, Input, Typography } from 'antd'
import type { StoreSettingsTabProps } from './types'

const { Title, Paragraph } = Typography
const { TextArea } = Input

const PoliciesTab = ({ form, onSubmit, isLoading }: StoreSettingsTabProps) => {
  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>Store Policies</Title>
        <Paragraph type="secondary">
          Set clear policies for your customers. These policies will be displayed on your store
          page.
        </Paragraph>

        <Form.Item
          name="shippingPolicy"
          label="Shipping Policy"
          tooltip="Describe your shipping methods, timelines, and costs"
        >
          <TextArea
            rows={5}
            placeholder="We ship via standard and express delivery. Orders are processed within 1-2 business days..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Form.Item
          name="returnPolicy"
          label="Return Policy"
          tooltip="Explain your return process, time limits, and conditions"
        >
          <TextArea
            rows={5}
            placeholder="Items can be returned within 7 days of delivery. Products must be unused and in original packaging..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Form.Item
          name="refundPolicy"
          label="Refund Policy"
          tooltip="Describe how refunds are processed and timelines"
        >
          <TextArea
            rows={5}
            placeholder="Refunds will be processed within 5-7 business days after we receive the returned item..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Form.Item
          name="cancellationPolicy"
          label="Cancellation Policy"
          tooltip="Explain order cancellation rules and timelines"
        >
          <TextArea
            rows={5}
            placeholder="Orders can be cancelled within 24 hours of placement. After that, please contact support..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Form.Item
          name="warrantyPolicy"
          label="Warranty Policy"
          tooltip="Describe warranty terms and coverage"
        >
          <TextArea
            rows={5}
            placeholder="All products come with manufacturer warranty. Warranty duration and terms vary by product..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Divider />

        <Form.Item
          name="replacementPolicy"
          label="Replacement Policy"
          tooltip="Explain your product replacement process and conditions"
        >
          <TextArea
            rows={5}
            placeholder="We offer product replacement for manufacturing defects within 30 days of purchase..."
            showCount
            maxLength={2000}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
            Save Policies
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default PoliciesTab
