import { SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Divider, Form, Input, Select, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useApprovedBrands } from '../../../api/brandQueries'
import { getStorefrontDomainDisplay, getStorefrontUrlDisplay } from '../../../utils/storefrontUrl'
import BannerManager from './BannerManager'
import ThemeSelector from './ThemeSelector'
import type { StorefrontTabProps } from './types'

const { Title, Text, Paragraph } = Typography

const StorefrontTab = ({
  form,
  onSubmit,
  isLoading,
  storefrontBanners = [],
  onStorefrontBannersChange,
  onStorefrontBannersWithFilesChange,
  videoUrl = '',
  videoFile = null,
  onVideoUrlChange,
  onVideoFileChange,
}: StorefrontTabProps) => {
  const [storeSlug, setStoreSlug] = useState<string>('')
  const { data: approvedBrands = [], isLoading: approvedBrandsLoading } = useApprovedBrands()

  useEffect(() => {
    const currentSlug = form.getFieldValue('storeSlug') || ''
    setStoreSlug(currentSlug)
  }, [form])

  const approvedBrandNames = approvedBrands.map((brand) => brand.brand_name)

  useEffect(() => {
    if (approvedBrandNames.length > 0) {
      form.setFieldValue('brandNames', approvedBrandNames)
    }
  }, [approvedBrandNames, form])

  const brandOptions = approvedBrandNames.map((brandName) => ({
    label: brandName,
    value: brandName,
  }))

  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>Storefront & Catalog Setup</Title>
        <Paragraph type="secondary">
          Configure your store branding and product catalog settings.
        </Paragraph>

        <Divider orientation="left">Store URL Slug</Divider>
        <Form.Item
          name="storeSlug"
          label="Store URL Slug"
          extra={
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Your store microsite URL:{' '}
                <strong>
                  {getStorefrontUrlDisplay(storeSlug)}
                </strong>
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Slug is auto-generated from your business name. You can customize it if needed.
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Only lowercase letters, numbers, and hyphens allowed. Must be unique.
              </Text>
            </div>
          }
          rules={[
            {
              pattern: /^[a-z0-9-]+$/,
              message: 'Only lowercase letters, numbers, and hyphens are allowed',
            },
            { min: 3, message: 'Slug must be at least 3 characters' },
            { max: 50, message: 'Slug cannot exceed 50 characters' },
          ]}
        >
          <Input
            placeholder="Auto-generated from business name"
            addonBefore={<span style={{ fontSize: 12, color: '#666' }}>{getStorefrontDomainDisplay()}</span>}
            onChange={(e) => {
              setStoreSlug(e.target.value)
              form.setFieldValue('storeSlug', e.target.value)
            }}
          />
        </Form.Item>

        <Divider orientation="left">Store Theme</Divider>
        <Form.Item name="storeTheme" label="Choose a Theme">
          <ThemeSelector
            value={form.getFieldValue('storeTheme')}
            onChange={(themeId) => {
              form.setFieldValue('storeTheme', themeId)
            }}
          />
        </Form.Item>

        <Divider orientation="left">Brand Names</Divider>
        <Form.Item
          name="brandNames"
          label="Brand Name(s)"
          tooltip="Choose from your approved brands."
        >
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="Select approved brand names"
            options={brandOptions}
            loading={approvedBrandsLoading}
            disabled
          />
        </Form.Item>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: -12 }}>
          Approved brands are shown here automatically. If a brand is missing, submit it for approval.
        </Text>

        <Divider orientation="left">Storefront Banners</Divider>
        <Form.Item label="Home Page Banners" style={{ marginTop: 24 }}>
          <BannerManager
            value={storefrontBanners}
            onChange={onStorefrontBannersChange}
            onBannersWithFilesChange={onStorefrontBannersWithFilesChange}
            videoUrl={videoUrl}
            videoFile={videoFile}
            onVideoUrlChange={onVideoUrlChange}
            onVideoFileChange={onVideoFileChange}
          />
        </Form.Item>

        <Alert
          message="Product Categories"
          description="Product categories are managed separately in the Categories section. You can request new categories if needed."
          type="info"
          showIcon
          style={{ marginTop: 24 }}
        />

        <Form.Item style={{ marginTop: 24 }}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
            Save Storefront Settings
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default StorefrontTab
