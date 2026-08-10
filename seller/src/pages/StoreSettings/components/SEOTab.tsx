import { SaveOutlined } from '@ant-design/icons'
import { Button, Card, Form, Input, Select, Typography } from 'antd'
import type { StoreSettingsTabProps } from './types'

const { Title, Paragraph } = Typography
const { TextArea } = Input

const SEOTab = ({ form, onSubmit, isLoading }: StoreSettingsTabProps) => {
  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>SEO Settings</Title>
        <Paragraph type="secondary">
          Optimize your store for search engines. These settings help improve your store's
          visibility in search results.
        </Paragraph>

        <Form.Item
          name="storeMetaTitle"
          label="Meta Title"
          tooltip="Title shown in search engine results (50-60 characters recommended)"
          rules={[{ max: 60, message: 'Meta title should not exceed 60 characters' }]}
        >
          <Input placeholder="Your Store Name - Best Products Online" maxLength={60} showCount />
        </Form.Item>

        <Form.Item
          name="storeMetaDescription"
          label="Meta Description"
          tooltip="Brief description shown in search results (150-160 characters recommended)"
          rules={[{ max: 160, message: 'Meta description should not exceed 160 characters' }]}
        >
          <TextArea
            rows={3}
            placeholder="Shop the best products at great prices. Fast shipping and excellent customer service."
            maxLength={160}
            showCount
          />
        </Form.Item>

        <Form.Item
          name="storeKeywords"
          label="Keywords"
          tooltip="Comma-separated keywords relevant to your store"
        >
          <Select
            mode="tags"
            style={{ width: '100%' }}
            placeholder="Type and press Enter to add keywords"
            tokenSeparators={[',']}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
            Save SEO Settings
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default SEOTab
