import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Typography,
} from 'antd'
import { useEffect } from 'react'
import { useFooterSettings, useUpdateFooterSettings } from '../../api/settings'
import type { SocialLink } from '../../api/settings'

const { Title, Paragraph } = Typography
const { TextArea } = Input

const SOCIAL_PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'snapchat', label: 'Snapchat' },
] as const

type FooterFormValues = {
  description?: string
  phone?: string
  email?: string
  address?: string
  socialLinks?: SocialLink[]
}

const FooterSettings = () => {
  const { message } = App.useApp()
  const { data: footerResponse, isLoading: isFooterLoading } = useFooterSettings()
  const updateFooter = useUpdateFooterSettings()
  const footer = footerResponse?.data

  const [footerForm] = Form.useForm<FooterFormValues>()

  useEffect(() => {
    footerForm.setFieldsValue({
      description: footer?.description || '',
      phone: footer?.phone || '',
      email: footer?.email || '',
      address: footer?.address || '',
      socialLinks: footer?.socialLinks?.length ? footer.socialLinks : [],
    })
  }, [footer, footerForm])

  const handleFooterReset = () => {
    footerForm.setFieldsValue({
      description: footer?.description || '',
      phone: footer?.phone || '',
      email: footer?.email || '',
      address: footer?.address || '',
      socialLinks: footer?.socialLinks?.length ? footer.socialLinks : [],
    })
  }

  const handleFooterSubmit = async (values: FooterFormValues) => {
    try {
      await updateFooter.mutateAsync({
        description: values.description?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        email: values.email?.trim() || undefined,
        address: values.address?.trim() || undefined,
        socialLinks: values.socialLinks?.length ? values.socialLinks : undefined,
      })
      message.success('Footer settings updated successfully')
    } catch (error) {
      console.error(error)
      message.error('Failed to update footer settings')
    }
  }

  return (
    <Card>
      {isFooterLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spin />
        </div>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            message="Manage the footer content displayed on the buyer website. These details will appear in the footer section."
          />
          <Form form={footerForm} layout="vertical" onFinish={handleFooterSubmit}>
            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Footer Description</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                A brief description about your company that will appear in the footer.
              </Paragraph>
              <Form.Item
                name="description"
                rules={[{ max: 500, message: 'Description cannot exceed 500 characters' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="Kourier Boyz delivers trusted quality with speed and care. We bring you products that simplify your lifestyle, with service you can rely on."
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Contact Information</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Contact details that will be displayed in the footer.
              </Paragraph>
              <Form.Item
                label="Phone"
                name="phone"
                rules={[
                  { max: 50, message: 'Phone cannot exceed 50 characters' },
                ]}
              >
                <Input placeholder="+1 (234) 567-890" />
              </Form.Item>

              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { type: 'email', message: 'Please enter a valid email address' },
                  { max: 100, message: 'Email cannot exceed 100 characters' },
                ]}
              >
                <Input placeholder="support@kourierboyz.com" type="email" />
              </Form.Item>

              <Form.Item
                label="Address"
                name="address"
                rules={[{ max: 200, message: 'Address cannot exceed 200 characters' }]}
              >
                <TextArea
                  rows={3}
                  placeholder="123 Commerce Street, Business City"
                  showCount
                  maxLength={200}
                />
              </Form.Item>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Social Media Links</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Add social media links that will be displayed in the footer. Only added links will be shown.
              </Paragraph>
              <Form.List name="socialLinks">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 16 }} align="baseline">
                        <Form.Item
                          {...restField}
                          name={[name, 'platform']}
                          rules={[{ required: true, message: 'Please select a platform' }]}
                          style={{ width: 150 }}
                        >
                          <Select placeholder="Select platform" options={[...SOCIAL_PLATFORMS]} />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'url']}
                          rules={[
                            { required: true, message: 'Please enter a URL' },
                            { type: 'url', message: 'Please enter a valid URL' },
                          ]}
                          style={{ flex: 1, minWidth: 300 }}
                        >
                          <Input placeholder="https://..." />
                        </Form.Item>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => remove(name)}
                        >
                          Remove
                        </Button>
                      </Space>
                    ))}
                    <Form.Item>
                      <Button
                        type="dashed"
                        onClick={() => add()}
                        block
                        icon={<PlusOutlined />}
                      >
                        Add Social Link
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </div>

            <Space>
              <Button type="primary" htmlType="submit" loading={updateFooter.isPending}>
                Save Footer Settings
              </Button>
              <Button onClick={handleFooterReset} disabled={updateFooter.isPending}>
                Reset
              </Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  )
}

export default FooterSettings

