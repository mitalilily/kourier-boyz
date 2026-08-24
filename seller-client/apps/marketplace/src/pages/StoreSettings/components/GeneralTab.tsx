import {
  AlertOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  LinkOutlined,
  PictureOutlined,
  SaveOutlined,
  StarFilled,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Radio,
  Row,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStorefrontUrl } from '../../../utils/storefrontUrl'
import type { GeneralTabProps } from './types'

const { Title, Text } = Typography
const { TextArea } = Input

const GeneralTab = ({
  form,
  onSubmit,
  isLoading,
  logoFileList,
  onLogoChange,
  bannerFileList,
  onBannerChange,
  reviewStats,
  isLoadingReviewStats,
}: GeneralTabProps) => {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const storeSlug = form.getFieldValue('storeSlug')
  const storeUrl = getStorefrontUrl(storeSlug)
  const overallRating = reviewStats?.overallRating || 0
  const totalReviews = reviewStats?.totalReviews || 0

  const handleCopyUrl = async () => {
    if (storeUrl) {
      try {
        await navigator.clipboard.writeText(storeUrl)
        message.success('Store URL copied to clipboard!')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        message.error('Failed to copy URL')
      }
    }
  }

  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>Store Information</Title>

        {/* Seller Rating - One Line */}
        <div style={{ marginBottom: 24, padding: '12px 16px', backgroundColor: '#fafafa', borderRadius: 6 }}>
          <Space>
            <StarFilled style={{ color: '#faad14' }} />
            <Text strong>Your Rating:</Text>
            {isLoadingReviewStats ? (
              <Text type="secondary">Loading...</Text>
            ) : (
              <>
                <Text strong style={{ fontSize: 16, color: '#B78115' }}>
                  {overallRating.toFixed(1)} / 5.0
                </Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
                </Text>
                <Button
                  type="link"
                  size="small"
                  onClick={() => navigate('/reviews')}
                  style={{ padding: 0, height: 'auto', fontSize: 12 }}
                >
                  View all →
                </Button>
              </>
            )}
          </Space>
        </div>

        {storeSlug && (
          <Alert
            message={
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Space>
                  <LinkOutlined />
                  <Text strong>Store URL</Text>
                </Space>
                <Space.Compact style={{ width: '100%' }}>
                  <Input value={storeUrl} readOnly style={{ flex: 1 }} />
                  <Button type="primary" icon={<CopyOutlined />} onClick={handleCopyUrl}>
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </Space.Compact>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Share this URL with your customers to visit your store
                </Text>
              </Space>
            }
            type="info"
            showIcon={false}
            style={{ marginBottom: 24 }}
          />
        )}
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item label="Store Logo">
              <Upload
                listType="picture-card"
                fileList={logoFileList}
                onChange={({ fileList }) => onLogoChange(fileList)}
                beforeUpload={() => false}
                maxCount={1}
                accept="image/*"
              >
                {logoFileList.length === 0 && (
                  <div>
                    <PictureOutlined />
                    <div style={{ marginTop: 8 }}>Upload Logo</div>
                  </div>
                )}
              </Upload>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                Recommended: 500x500px, PNG or JPG
              </Text>
            </Form.Item>
          </Col>
        </Row>

        {/* Store Banner (for header) */}
        <Form.Item label="Store Banner (Header)" style={{ marginTop: 24 }}>
          <Upload
            listType="picture-card"
            fileList={bannerFileList}
            onChange={({ fileList }) => onBannerChange(fileList)}
            beforeUpload={(file) => {
              const isLt50M = file.size / 1024 / 1024 < 50
              if (!isLt50M) {
                message.error('Banner must be smaller than 50MB!')
              }
              return isLt50M || Upload.LIST_IGNORE
            }}
            maxCount={1}
            accept="image/*"
          >
            {bannerFileList.length === 0 && (
              <div>
                <PictureOutlined />
                <div style={{ marginTop: 8 }}>Upload Banner</div>
              </div>
            )}
          </Upload>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
            This banner will be shown in the header of your store. Recommended: 1920x400px
          </Text>
        </Form.Item>

        <Form.Item
          name="storeDescription"
          label="Store Description"
          rules={[{ max: 1000, message: 'Description cannot exceed 1000 characters' }]}
        >
          <TextArea
            rows={4}
            placeholder="Describe your store, products, and what makes you unique..."
            showCount
            maxLength={1000}
          />
        </Form.Item>

        <Form.Item name="storeStatus" label="Store Status" initialValue="active">
          <Radio.Group>
            <Radio value="active">
              <Tag color="green">
                <CheckCircleOutlined /> Active
              </Tag>
            </Radio>
            <Radio value="inactive">
              <Tag color="red">
                <AlertOutlined /> Inactive
              </Tag>
            </Radio>
          </Radio.Group>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Inactive stores won't appear in search results
          </Text>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
            Save General Settings
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default GeneralTab
