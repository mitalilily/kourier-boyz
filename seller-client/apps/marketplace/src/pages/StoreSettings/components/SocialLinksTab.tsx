import {
  FacebookOutlined,
  GlobalOutlined,
  InstagramOutlined,
  LinkedinOutlined,
  SaveOutlined,
  TwitterOutlined,
  YoutubeOutlined,
} from '@ant-design/icons'
import { Button, Card, Col, Form, Input, Row, Typography } from 'antd'
import type { StoreSettingsTabProps } from './types'

const { Title, Paragraph } = Typography

const SocialLinksTab = ({ form, onSubmit, isLoading }: StoreSettingsTabProps) => {
  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>Social Media & Website Links</Title>
        <Paragraph type="secondary">
          Add your social media profiles and website to help customers find you online.
        </Paragraph>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="website"
              label={
                <span>
                  <GlobalOutlined /> Website
                </span>
              }
            >
              <Input placeholder="https://yourwebsite.com" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="facebook"
              label={
                <span>
                  <FacebookOutlined /> Facebook
                </span>
              }
            >
              <Input placeholder="https://facebook.com/yourpage" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="instagram"
              label={
                <span>
                  <InstagramOutlined /> Instagram
                </span>
              }
            >
              <Input placeholder="https://instagram.com/yourprofile" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="twitter"
              label={
                <span>
                  <TwitterOutlined /> Twitter
                </span>
              }
            >
              <Input placeholder="https://twitter.com/yourhandle" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="youtube"
              label={
                <span>
                  <YoutubeOutlined /> YouTube
                </span>
              }
            >
              <Input placeholder="https://youtube.com/@yourchannel" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="linkedin"
              label={
                <span>
                  <LinkedinOutlined /> LinkedIn
                </span>
              }
            >
              <Input placeholder="https://linkedin.com/company/yourcompany" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
            Save Social Links
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default SocialLinksTab
