import { DeleteOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Image,
  Input,
  Row,
  Space,
  Spin,
  Switch,
  Typography,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import { useEffect, useState } from 'react'
import { useAboutUsSettings, useUpdateAboutUsSettings } from '../../api/settings'
import RichTextEditor from '../RichTextEditor'

const { Title, Paragraph } = Typography
const { TextArea } = Input

type AboutUsFormValues = {
  title?: string
  content?: string
  mission?: string
  vision?: string
  isPublished?: boolean
}

const AboutUsSettings = () => {
  const { message } = App.useApp()
  const { data: aboutUsResponse, isLoading: isAboutUsLoading } = useAboutUsSettings()
  const updateAboutUs = useUpdateAboutUsSettings()
  const aboutUs = aboutUsResponse?.data

  const [aboutUsForm] = Form.useForm<AboutUsFormValues>()
  const [heroImageList, setHeroImageList] = useState<UploadFile[]>([])
  const [removeHeroImage, setRemoveHeroImage] = useState(false)
  const [aboutUsContent, setAboutUsContent] = useState<string>('')

  useEffect(() => {
    aboutUsForm.setFieldsValue({
      title: aboutUs?.title || 'About Us',
      mission: aboutUs?.mission || '',
      vision: aboutUs?.vision || '',
      isPublished: aboutUs?.isPublished || false,
    })
    setAboutUsContent(aboutUs?.content || '')
  }, [aboutUs, aboutUsForm])

  const handleAboutUsReset = () => {
    setHeroImageList([])
    setRemoveHeroImage(false)
    setAboutUsContent(aboutUs?.content || '')
    aboutUsForm.setFieldsValue({
      title: aboutUs?.title || 'About Us',
      mission: aboutUs?.mission || '',
      vision: aboutUs?.vision || '',
      isPublished: aboutUs?.isPublished || false,
    })
  }

  const handleAboutUsSubmit = async (values: AboutUsFormValues) => {
    try {
      const formData = new FormData()

      const heroImageFile = heroImageList[0]?.originFileObj as File | undefined
      if (heroImageFile) {
        formData.append('heroImage', heroImageFile)
      } else if (removeHeroImage) {
        formData.append('clearHeroImage', 'true')
      }

      formData.append('title', values.title || 'About Us')
      formData.append('content', aboutUsContent || '')
      formData.append('mission', values.mission || '')
      formData.append('vision', values.vision || '')
      formData.append('isPublished', String(values.isPublished || false))

      await updateAboutUs.mutateAsync(formData)
      message.success('About Us settings updated successfully')
      setHeroImageList([])
      setRemoveHeroImage(false)
    } catch (error) {
      console.error(error)
      message.error('Failed to update About Us settings')
    }
  }

  return (
    <Card>
      {isAboutUsLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spin />
        </div>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            message="Manage the content displayed on the About Us page. This content will be visible to customers at /about-us."
          />
          <Form form={aboutUsForm} layout="vertical" onFinish={handleAboutUsSubmit}>
            <div style={{ marginBottom: 24 }}>
              <Form.Item
                name="isPublished"
                label="Publish Status"
                valuePropName="checked"
                tooltip="When enabled, the About Us page will be visible to customers"
              >
                <Switch checkedChildren="Published" unCheckedChildren="Draft" />
              </Form.Item>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Page Title</Title>
              <Form.Item name="title" rules={[{ required: true, message: 'Please enter a title' }]}>
                <Input placeholder="About Us" />
              </Form.Item>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Hero Image (Optional)</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Upload a banner image for the About Us page. Recommended size: 1920x600px.
              </Paragraph>
              <div style={{ position: 'relative' }}>
                {aboutUs?.heroImage && heroImageList.length === 0 && !removeHeroImage && (
                  <div style={{ marginBottom: 12, position: 'relative' }}>
                    <Image
                      src={aboutUs.heroImage}
                      width="100%"
                      style={{ maxWidth: 600, borderRadius: 4 }}
                      alt="Current hero image"
                      preview={{ mask: <EyeOutlined /> }}
                    />
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      size="small"
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        setHeroImageList([])
                        setRemoveHeroImage(true)
                      }}
                    >
                      Remove Image
                    </Button>
                  </div>
                )}
                <Upload
                  accept="image/*"
                  beforeUpload={() => false}
                  listType="picture-card"
                  multiple={false}
                  maxCount={1}
                  fileList={heroImageList}
                  onChange={({ fileList }) => {
                    setHeroImageList(fileList.slice(-1))
                    setRemoveHeroImage(false)
                  }}
                  onRemove={() => {
                    setHeroImageList([])
                    return true
                  }}
                >
                  {heroImageList.length === 0 && (
                    <div>
                      <UploadOutlined style={{ fontSize: 24, color: '#1890ff' }} />
                      <div style={{ marginTop: 8 }}>
                        {aboutUs?.heroImage ? 'Replace Image' : 'Upload Image'}
                      </div>
                    </div>
                  )}
                </Upload>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Main Content</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Write the main content for your About Us page. You can use rich text formatting.
              </Paragraph>
              <RichTextEditor
                value={aboutUsContent}
                onChange={setAboutUsContent}
                placeholder="Tell your customers about your company, values, and story..."
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5}>Mission & Vision (Optional)</Title>
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                Add your company's mission and vision statements.
              </Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Mission Statement" name="mission">
                    <TextArea rows={4} placeholder="Our mission is to..." />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item label="Vision Statement" name="vision">
                    <TextArea rows={4} placeholder="Our vision is to..." />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <Space>
              <Button type="primary" htmlType="submit" loading={updateAboutUs.isPending}>
                Save About Us
              </Button>
              <Button onClick={handleAboutUsReset} disabled={updateAboutUs.isPending}>
                Reset
              </Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  )
}

export default AboutUsSettings

