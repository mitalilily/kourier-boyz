import {
  CalendarOutlined,
  MailOutlined,
  PictureOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import type { DrawerProps, UploadFile } from 'antd'
import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Typography,
  Upload,
  message,
} from 'antd'
import dayjs from 'dayjs'
import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useCreatePromotionalEmail, useUpdatePromotionalEmail } from '../../api/promotionalEmails'
import type { PromotionalEmail } from '../../types/promotionalEmail'
import { PROMOTIONAL_EMAIL_STATUSES, TARGET_AUDIENCE_OPTIONS } from '../../types/promotionalEmail'
import RichTextEditor from '../RichTextEditor'

const { TextArea } = Input
const { Text } = Typography

interface AddPromotionalEmailDrawerProps extends DrawerProps {
  onAdd?: (formData: FormData, form: { resetFields: () => void }) => void
  editingEmail?: PromotionalEmail | null
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
]

const AddPromotionalEmailDrawer: React.FC<AddPromotionalEmailDrawerProps> = ({
  open,
  onClose,
  editingEmail,
}) => {
  const [form] = Form.useForm()
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const prevBlobRef = useRef<string | null>(null)
  const [drawerWidth, setDrawerWidth] = useState<number | string>('100%')
  const [scheduleEmail, setScheduleEmail] = useState(false)

  const createEmail = useCreatePromotionalEmail()
  const updateEmail = useUpdatePromotionalEmail()

  const isEditing = !!editingEmail

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDrawerWidth('100%')
      return
    }

    const updateWidth = () => {
      const viewport = window.innerWidth
      if (viewport >= 1440) {
        setDrawerWidth(1280)
      } else if (viewport >= 1200) {
        setDrawerWidth(1100)
      } else if (viewport >= 1024) {
        setDrawerWidth(960)
      } else {
        setDrawerWidth('100%')
      }
    }

    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (prevBlobRef.current) {
        try {
          URL.revokeObjectURL(prevBlobRef.current)
        } catch (error) {
          console.warn('Failed to revoke preview URL', error)
        }
        prevBlobRef.current = null
      }
    }
  }, [])

  // Prefill form when editing
  useEffect(() => {
    if (isEditing && editingEmail) {
      form.setFieldsValue({
        subject: editingEmail.subject,
        content: editingEmail.content,
        excerpt: editingEmail.excerpt,
        status: editingEmail.status,
        targetAudience: editingEmail.targetAudience,
        previewText: editingEmail.previewText,
      })
      setScheduleEmail(false)

      // Set file list and preview from existing image
      if (editingEmail.featuredImage) {
        setFileList([
          {
            uid: '-1',
            name: 'Current Image',
            status: 'done',
            url: editingEmail.featuredImage,
          },
        ])
        setPreviewUrl(editingEmail.featuredImage)
      } else {
        setFileList([])
        setPreviewUrl(null)
      }
    } else {
      form.resetFields()
      setFileList([])
      setPreviewUrl(null)
      setImageFile(null)
      setScheduleEmail(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingEmail, isEditing, open])

  const handleBeforeUpload = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error('Invalid file type. Only JPEG, PNG, GIF, WebP, and AVIF are allowed.')
      return false
    }

    if (file.size > MAX_FILE_SIZE) {
      message.error('File too large. Maximum size is 10MB.')
      return false
    }

    const fileURL = URL.createObjectURL(file)

    if (prevBlobRef.current) {
      try {
        URL.revokeObjectURL(prevBlobRef.current)
      } catch (error) {
        console.warn('Failed to revoke preview URL', error)
      }
    }

    prevBlobRef.current = fileURL
    setPreviewUrl(fileURL)

    const uniqueUid = `${Date.now()}-${file.name}`
    setImageFile(file)
    setFileList([
      {
        uid: uniqueUid,
        name: file.name,
        status: 'done',
        url: fileURL,
      },
    ])

    return false // prevent auto upload
  }

  const handleRemove = () => {
    setFileList([])
    setImageFile(null)
    if (prevBlobRef.current) {
      try {
        URL.revokeObjectURL(prevBlobRef.current)
      } catch (error) {
        console.warn('Failed to revoke preview URL', error)
      }
      prevBlobRef.current = null
    }
    setPreviewUrl(null)
  }

  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        const formData = new FormData()
        formData.append('subject', values.subject)
        formData.append('content', values.content || '')
        if (values.excerpt) formData.append('excerpt', values.excerpt)

        // When scheduled, status is locked to draft
        let finalStatus = values.status || 'draft'
        if (scheduleEmail) {
          finalStatus = 'draft' // Schedule locks status to draft
        }
        formData.append('status', finalStatus)

        formData.append('targetAudience', values.targetAudience || 'subscribers')
        if (values.previewText) formData.append('previewText', values.previewText)

        // Add send options (only for new emails, not editing)
        if (!isEditing) {
          // If status is published and not scheduled, send now automatically
          if (finalStatus === 'published' && !scheduleEmail) {
            formData.append('sendNow', 'true')
          }
          if (scheduleEmail && values.scheduledAt) {
            formData.append('scheduledAt', dayjs(values.scheduledAt).toISOString())
          }
        }

        if (imageFile) formData.append('featuredImage', imageFile)

        if (isEditing && editingEmail?._id) {
          updateEmail.mutate(
            { id: editingEmail._id, formData },
            {
              onSuccess: () => {
                toast.success('Promotional email updated successfully!')
                form.resetFields()
                setScheduleEmail(false)
                onClose?.({} as React.MouseEvent<HTMLElement>)
              },
              onError: () => toast.error('Failed to update promotional email'),
            },
          )
        } else {
          createEmail.mutate(formData, {
            onSuccess: () => {
              toast.success('Promotional email created successfully!')
              form.resetFields()
              setScheduleEmail(false)
              setImageFile(null)
              setFileList([])
              setPreviewUrl(null)
              onClose?.({} as React.MouseEvent<HTMLElement>)
            },
            onError: () => toast.error('Failed to create promotional email'),
          })
        }
      })
      .catch(() => message.error('Please fill in all required fields'))
  }

  return (
    <Drawer
      title={isEditing ? 'Edit Promotional Email' : 'Create Promotional Email'}
      placement="right"
      onClose={onClose}
      open={open}
      width={drawerWidth}
      bodyStyle={{ padding: '24px', maxWidth: 1440, margin: '0 auto', background: '#f5f5f5' }}
      styles={{ header: { padding: '16px 24px', borderBottom: '1px solid #f0f0f0' } }}
      extra={
        <Space>
          <Button onClick={onClose} disabled={createEmail.isPending || updateEmail.isPending}>
            Cancel
          </Button>
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={createEmail.isPending || updateEmail.isPending}
            icon={isEditing ? undefined : <SendOutlined />}
          >
            {createEmail.isPending || updateEmail.isPending
              ? isEditing
                ? 'Updating...'
                : 'Creating...'
              : isEditing
              ? 'Update Email'
              : 'Create Email'}
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: 'draft', targetAudience: 'subscribers' }}
      >
        {/* Basic Information Section */}
        <Card
          title={
            <Space>
              <MailOutlined />
              <span>Basic Information</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          headStyle={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}
        >
          <Form.Item
            name="subject"
            label={<Text strong>Email Subject</Text>}
            rules={[{ required: true, message: 'Please enter an email subject' }]}
            style={{ marginBottom: 20 }}
          >
            <Input
              placeholder="Enter email subject line"
              size="large"
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
            />
          </Form.Item>

          <Form.Item
            name="previewText"
            label={<Text strong>Preview Text</Text>}
            rules={[{ max: 150, message: 'Preview text should not exceed 150 characters' }]}
            style={{ marginBottom: 20 }}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Shown in email clients' inbox preview
              </Text>
            }
          >
            <Input
              placeholder="Brief preview text shown in email inbox"
              showCount
              maxLength={150}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="excerpt"
            label={<Text strong>Excerpt (Short Description)</Text>}
            rules={[{ max: 300, message: 'Excerpt should not exceed 300 characters' }]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Optional brief summary of the email
              </Text>
            }
          >
            <TextArea
              rows={3}
              placeholder="A brief summary of the email (optional, max 300 characters)"
              showCount
              maxLength={300}
            />
          </Form.Item>
        </Card>

        {/* Email Content Section */}
        <Card
          title={
            <Space>
              <MailOutlined />
              <span>Email Content</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          headStyle={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}
        >
          <Form.Item
            name="content"
            label={<Text strong>Email Body</Text>}
            rules={[
              {
                required: true,
                validator: (_, value) => {
                  // Strip HTML tags and check for actual text content
                  const textContent = value ? value.replace(/<[^>]*>/g, '').trim() : ''
                  if (!textContent || textContent === '') {
                    return Promise.reject(new Error('Please enter email content'))
                  }
                  return Promise.resolve()
                },
              },
            ]}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Use the "Placeholders" button to insert dynamic fields like [First Name], [Shop Now
                Button], etc.
              </Text>
            }
          >
            <RichTextEditor
              placeholder="Write your email content here..."
              showPlaceholders={true}
            />
          </Form.Item>
        </Card>

        {/* Featured Image Section */}
        <Card
          title={
            <Space>
              <PictureOutlined />
              <span>Featured Image</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          headStyle={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}
        >
          <Form.Item
            label={
              isEditing ? (
                <Text strong>Change Featured Image (optional)</Text>
              ) : (
                <Text strong>Upload Featured Image</Text>
              )
            }
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                Max size: 10MB. Formats: JPEG, PNG, GIF, WebP, AVIF
              </Text>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                beforeUpload={handleBeforeUpload}
                maxCount={1}
                listType="picture-card"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif"
                fileList={fileList}
                onRemove={() => {
                  handleRemove()
                  return false
                }}
              >
                {fileList.length === 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <UploadOutlined style={{ fontSize: 24, color: '#8c8c8c' }} />
                    <span style={{ color: '#595959' }}>Upload Image</span>
                  </div>
                )}
              </Upload>
              {previewUrl && (
                <div style={{ marginTop: 8, textAlign: 'center' }}>
                  <img
                    src={previewUrl}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 300,
                      borderRadius: 8,
                      border: '1px solid #f0f0f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  />
                </div>
              )}
            </Space>
          </Form.Item>
        </Card>

        {/* Settings Section */}
        <Card
          title={
            <Space>
              <MailOutlined />
              <span>Settings</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          headStyle={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Form.Item
              name="targetAudience"
              label={<Text strong>Target Audience</Text>}
              rules={[{ required: true, message: 'Please select target audience' }]}
              style={{ marginBottom: 0 }}
            >
              <Select placeholder="Select target audience" size="large">
                {TARGET_AUDIENCE_OPTIONS.map((option) => (
                  <Select.Option key={option.value} value={option.value}>
                    {option.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="status"
              label={<Text strong>Status</Text>}
              rules={[{ required: true, message: 'Please select a status' }]}
              style={{ marginBottom: 0 }}
              extra={
                !isEditing && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {scheduleEmail
                      ? 'Status is locked to "Draft" when scheduling'
                      : 'Selecting "Published" will automatically send the email immediately'}
                  </Text>
                )
              }
            >
              <Select
                placeholder="Select status"
                size="large"
                disabled={!isEditing && scheduleEmail}
              >
                {PROMOTIONAL_EMAIL_STATUSES.map((statusOption) => (
                  <Select.Option key={statusOption.value} value={statusOption.value}>
                    {statusOption.label}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Space>
        </Card>

        {/* Send Options Section (only for new emails) */}
        {!isEditing && (
          <Card
            title={
              <Space>
                <SendOutlined />
                <span>Send Options</span>
              </Space>
            }
            style={{ marginBottom: 16 }}
            headStyle={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                • Status "Published" = Email sent immediately
                <br />• Schedule for Later = Status locked to "Draft"
              </Text>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Checkbox
                checked={scheduleEmail}
                onChange={(e) => {
                  const checked = e.target.checked
                  setScheduleEmail(checked)
                  if (checked) {
                    // Lock status to draft when scheduling
                    form.setFieldValue('status', 'draft')
                  }
                }}
                style={{ fontSize: 14 }}
              >
                <Text strong>Schedule for Later</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                  Schedule email to be sent at a specific date and time. Status will be locked to
                  "Draft".
                </Text>
              </Checkbox>

              {scheduleEmail && (
                <Form.Item
                  name="scheduledAt"
                  label={<Text strong>Schedule Date & Time</Text>}
                  rules={[
                    {
                      required: scheduleEmail,
                      message: 'Please select a date and time for scheduling',
                    },
                  ]}
                  style={{ marginTop: 16, marginBottom: 0 }}
                >
                  <DatePicker
                    showTime
                    format="YYYY-MM-DD HH:mm"
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Select date and time"
                    suffixIcon={<CalendarOutlined />}
                  />
                </Form.Item>
              )}
            </Space>
          </Card>
        )}
      </Form>
    </Drawer>
  )
}

export default AddPromotionalEmailDrawer
