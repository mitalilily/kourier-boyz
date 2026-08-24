import { MessageOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Modal, Rate, Space } from 'antd'
import { useState } from 'react'
import { submitSellerFeedback } from '../api/feedback'

const { TextArea } = Input

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
}

const FeedbackModal = ({ open, onClose }: FeedbackModalProps) => {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: { rating: number; comment: string }) => {
    try {
      setLoading(true)
      await submitSellerFeedback(values)
      message.success('Thanks for your feedback!')
      form.resetFields()
      onClose()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      const errorMessage =
        err.response?.data?.error || 'Failed to submit feedback. Please try again.'
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <MessageOutlined />
          <span>Send Feedback</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ marginTop: 24 }}
      >
        <Form.Item
          name="rating"
          label="Rating"
          rules={[{ required: true, message: 'Please provide a rating' }]}
        >
          <Rate />
        </Form.Item>

        <Form.Item
          name="comment"
          label="Feedback"
          rules={[
            { required: true, message: 'Please enter your feedback' },
            { max: 1000, message: 'Feedback cannot exceed 1000 characters' },
          ]}
        >
          <TextArea
            rows={5}
            placeholder="Tell us what we can improve"
            showCount
            maxLength={1000}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              Submit
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default FeedbackModal

