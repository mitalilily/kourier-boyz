import { InfoCircleOutlined } from '@ant-design/icons'
import { Alert, Form, InputNumber, Modal, Space, Tooltip } from 'antd'
import type { VariantType } from './types'

interface BulkPricingModalProps {
  open: boolean
  variants: Array<VariantType>
  onOk: (values: {
    price?: number
    costPrice?: number
    discountPercent?: number
  }) => void
  onCancel: () => void
}

export default function BulkPricingModal({
  open,
  variants,
  onOk,
  onCancel,
}: BulkPricingModalProps) {
  const [form] = Form.useForm()

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        onOk(values)
        form.resetFields()
      })
      .catch(() => {
        // Validation failed, but we still want to apply non-empty values
        const values = form.getFieldsValue()
        onOk(values)
        form.resetFields()
      })
  }

  const handleCancel = () => {
    form.resetFields()
    onCancel()
  }

  return (
    <Modal
      title="Set Pricing for All Variants"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="Apply to All Variants"
      cancelText="Cancel"
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          price: undefined,
          costPrice: undefined,
          discountPercent: undefined,
        }}
      >
        <Form.Item
          name="price"
            label={
              <Space size={4}>
                MRP (₹) (excl of GST)
                <Tooltip title="Maximum Retail Price (MRP) excluding GST - the base selling price before GST is added. Set for all variants. Leave empty to keep existing values.">
                  <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
                </Tooltip>
              </Space>
            }
          rules={[]}
        >
          <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter MRP" />
        </Form.Item>
        <Form.Item
          name="costPrice"
          label={
            <Space size={4}>
              Cost Price (₹)
              <Tooltip title="Your cost to produce or acquire. Set for all variants. Leave empty to keep existing values.">
                <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
              </Tooltip>
            </Space>
          }
          rules={[]}
        >
          <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter cost price" />
        </Form.Item>
        <Form.Item
          name="discountPercent"
          label={
            <Space size={4}>
              Discount (%)
              <Tooltip title="Discount percentage. Auto-calculated when Compare at Price is provided. Set for all variants. Leave empty to keep existing values.">
                <InfoCircleOutlined style={{ fontSize: 12, color: '#1890ff' }} />
              </Tooltip>
            </Space>
          }
          rules={[]}
        >
          <InputNumber
            min={0}
            max={100}
            style={{ width: '100%' }}
            placeholder="Enter discount percentage"
          />
        </Form.Item>
        <Alert
          message={`This will update ${variants.length} variant(s)`}
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Form>
    </Modal>
  )
}

