import { MailOutlined, PhoneOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, Card, Col, Form, Input, Row, Typography } from 'antd'
import type { StoreSettingsTabProps } from './types'

const { Title, Paragraph } = Typography

const ContactTab = ({ form, onSubmit, isLoading }: StoreSettingsTabProps) => {
  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>Contact Information</Title>
        <Paragraph type="secondary">
          Set up contact information that will be displayed to customers.
        </Paragraph>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="storeEmail"
              label={
                <span>
                  <MailOutlined /> Store Email
                </span>
              }
              rules={[{ type: 'email', message: 'Please enter a valid email address' }]}
            >
              <Input placeholder="store@example.com" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="storePhone"
              label={
                <span>
                  <PhoneOutlined /> Store Phone
                </span>
              }
            >
              <Input placeholder="+91 9876543210" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="supportEmail"
              label={
                <span>
                  <MailOutlined /> Support Email
                </span>
              }
              rules={[{ type: 'email', message: 'Please enter a valid email address' }]}
            >
              <Input placeholder="support@example.com" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
            Save Contact Information
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default ContactTab
