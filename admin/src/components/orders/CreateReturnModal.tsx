import { UploadOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Image,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { UploadFile } from 'antd'
import { useState, useEffect, useMemo } from 'react'
import type { AdminOrder } from '../../api/orders'
import {
  useAdminCreateReturn,
  useReplacementVariants,
  useReturnReasons,
  type ReplacementVariant,
} from '../../api/returns'

const { Text } = Typography
const { TextArea } = Input

interface CreateReturnModalProps {
  open: boolean
  onClose: () => void
  order: AdminOrder
  orderItemId?: string
}

const CreateReturnModal = ({ open, onClose, order, orderItemId }: CreateReturnModalProps) => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [returnType, setReturnType] = useState<'return' | 'replacement'>('return')
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [selectedVariant, setSelectedVariant] = useState<ReplacementVariant | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [refundMode, setRefundMode] = useState<'UPI' | 'BANK' | undefined>(undefined)

  // Extract customer ID from order
  // user can be: string (ObjectId), object with _id, or undefined
  const customerId =
    order.user && typeof order.user === 'object' && order.user._id
      ? order.user._id
      : typeof order.user === 'string'
      ? order.user
      : undefined

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const { data: returnReasonsData } = useReturnReasons(returnType)
  const returnReasons = returnReasonsData?.data?.reasons || []

  const orderItem = orderItemId
    ? order.items?.find((item) => String(item._id) === String(orderItemId))
    : order.items?.[0]

  const { data: replacementVariantsData, isLoading: loadingVariants } = useReplacementVariants({
    orderId: order._id,
    orderItemId: orderItem?._id ? String(orderItem._id) : '',
    reason: selectedReason || undefined,
    customerId: customerId ? String(customerId) : undefined,
  })

  const replacementVariants = replacementVariantsData?.data?.variants || []

  const createReturnMutation = useAdminCreateReturn()

  useEffect(() => {
    if (open) {
      form.resetFields()
      setReturnType('return')
      setSelectedReason('')
      setSelectedVariant(null)
      setFileList([])
      setRefundMode(undefined)
    }
  }, [open, form])

  useEffect(() => {
    if (returnType === 'replacement' && orderItem && selectedReason) {
      // Variants will be fetched automatically by the query
    }
  }, [returnType, orderItem, selectedReason])

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (returnType === 'replacement' && !selectedVariant) {
        message.error('Please select a replacement variant')
        return
      }

      // Calculate if refund is needed for replacement
      let needsRefund = false
      if (returnType === 'replacement' && selectedVariant) {
        const priceDiff = selectedVariant.priceDifference
        if (priceDiff < 0) {
          // Lower price - refund needed
          needsRefund = true
          if (!refundMode) {
            message.error('Please select a refund method for the price difference')
            return
          }
          if (refundMode === 'UPI' && !values.upiId) {
            message.error('UPI ID is required')
            return
          }
          if (refundMode === 'BANK') {
            if (!values.bankAccountNumber || !values.ifscCode || !values.accountHolderName) {
              message.error('Bank account details are required')
              return
            }
          }
        }
      }

      const imageFiles = fileList
        .filter((file) => file.originFileObj)
        .map((file) => file.originFileObj) as File[]

      const imageUrls = fileList
        .filter((file) => !file.originFileObj && (file.url || file.response?.url))
        .map((file) => file.url || file.response?.url)
        .filter(Boolean) as string[]

      await createReturnMutation.mutateAsync({
        order_id: order._id,
        customer_id: String(customerId),
        order_item_id: orderItem?._id ? String(orderItem._id) : undefined,
        reason: selectedReason,
        description: values.description,
        images: (imageFiles.length > 0 ? imageFiles : imageUrls.length > 0 ? imageUrls : undefined) as (File | string)[] | undefined,
        returnType,
        exchangeVariantId: returnType === 'replacement' ? selectedVariant?._id : undefined,
        refundMode: needsRefund ? refundMode : undefined,
        upiId: needsRefund && refundMode === 'UPI' ? values.upiId : undefined,
        bankAccountNumber: needsRefund && refundMode === 'BANK' ? values.bankAccountNumber : undefined,
        ifscCode: needsRefund && refundMode === 'BANK' ? values.ifscCode : undefined,
        accountHolderName: needsRefund && refundMode === 'BANK' ? values.accountHolderName : undefined,
      })

      message.success(
        returnType === 'replacement' ? 'Replacement request created successfully' : 'Return request created successfully',
      )
      // Close modal after success - query invalidation will refresh data automatically
      onClose()
    } catch (error: any) {
      if (error?.errorFields) {
        // Form validation errors
        return
      }
      const errorMessage = error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Failed to create return request'
      message.error(errorMessage)
    }
  }

  // Check if return period has expired - must be before conditional return
  const isReturnPeriodExpired = useMemo(() => {
    if (!orderItem || !order) return false

    const product = orderItem.product as { returnable?: boolean; returnDays?: number } | undefined
    if (!product || product.returnable !== true) return false

    const maxProductReturnDays =
      typeof product.returnDays === 'number' && product.returnDays > 0
        ? product.returnDays
        : 7 // Default 7 days

    // Find delivery date from seller shipments
    let deliveredAt: Date | null = null
    if (order.sellerShipments && Array.isArray(order.sellerShipments)) {
      const itemSeller = orderItem.seller
      const itemSellerId = typeof itemSeller === 'object' ? itemSeller?._id : itemSeller
      for (const shipment of order.sellerShipments) {
        const shipmentObj = shipment as { seller?: string | { _id: string }; deliveredAt?: string }
        const shipmentSeller = shipmentObj.seller
        const shipmentSellerId = typeof shipmentSeller === 'object' ? shipmentSeller?._id : shipmentSeller
        if (
          shipmentSellerId &&
          String(shipmentSellerId) === String(itemSellerId) &&
          shipmentObj.deliveredAt
        ) {
          const d = new Date(shipmentObj.deliveredAt)
          if (!Number.isNaN(d.getTime())) {
            if (!deliveredAt || d > deliveredAt) {
              deliveredAt = d
            }
          }
        }
      }
    }

    // Fallback to order updatedAt if no delivery date found
    const orderWithUpdatedAt = order as { updatedAt?: string }
    if (!deliveredAt && orderWithUpdatedAt.updatedAt) {
      deliveredAt = new Date(orderWithUpdatedAt.updatedAt)
    }

    if (!deliveredAt) return false

    const now = new Date()
    const diffMs = now.getTime() - deliveredAt.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    return diffDays > maxProductReturnDays
  }, [order, orderItem])

  const returnPeriodDays = useMemo(() => {
    if (!orderItem) return 7
    const product = orderItem.product as { returnDays?: number } | undefined
    return typeof product?.returnDays === 'number' && product.returnDays > 0
      ? product.returnDays
      : 7
  }, [orderItem])

  const priceDifference = selectedVariant ? selectedVariant.priceDifference : 0
  const needsRefund = returnType === 'replacement' && priceDifference < 0

  // Show error modal if customer ID is missing
  if (!customerId) {
    return (
      <Modal open={open} onCancel={onClose} title="Error" footer={[<Button onClick={onClose}>Close</Button>]}>
        <Alert
          message="Cannot create return"
          description="Order does not have a customer ID. Please contact support."
          type="error"
        />
      </Modal>
    )
  }

  return (
    <Modal
      title={`Create ${returnType === 'replacement' ? 'Replacement' : 'Return'} Request`}
      open={open}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={createReturnMutation.isPending}
          onClick={handleSubmit}
        >
          Create {returnType === 'replacement' ? 'Replacement' : 'Return'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Space direction="vertical" size="large" className="w-full">
          {isReturnPeriodExpired && (
            <Alert
              message={
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  ⚠️ Return Period Has Expired
                </div>
              }
              description={
                <div style={{ fontSize: '14px', marginTop: '8px' }}>
                  <p>
                    The return period for this product ({returnPeriodDays} days) has expired. As an
                    admin, you can still create a return/replacement request, but this is outside
                    the normal return policy window.
                  </p>
                  <p style={{ marginTop: '8px', fontWeight: 'bold' }}>
                    Please ensure you have proper authorization before proceeding.
                  </p>
                </div>
              }
              type="warning"
              showIcon
              style={{
                border: '2px solid #faad14',
                backgroundColor: '#fffbe6',
                padding: '16px',
                marginBottom: '16px',
              }}
            />
          )}
          <Alert
            message="Creating Return/Replacement on Behalf of Customer"
            description={`You are creating a ${returnType} request for order #${order.orderNumber || order._id} on behalf of the customer.`}
            type="info"
            showIcon
          />

          <div>
            <Text strong>Order Item</Text>
            {orderItem && (
              <Card size="small" style={{ marginTop: 8 }}>
                <div>
                  <Text strong>{orderItem.product?.name}</Text>
                  {orderItem.variant && (
                    <div>
                      <Text type="secondary" className="text-xs">
                        Variant: {orderItem.variant?.name || 'N/A'}
                      </Text>
                    </div>
                  )}
                  <div>
                    <Text type="secondary">Quantity: {orderItem.quantity}</Text>
                    <Text type="secondary" style={{ marginLeft: 16 }}>
                      Price: ₹{(orderItem.effectivePrice ?? orderItem.price)?.toFixed(2)}
                    </Text>
                  </div>
                </div>
              </Card>
            )}
          </div>

          <Form.Item label="Return Type" required>
            <Radio.Group
              value={returnType}
              onChange={(e) => {
                setReturnType(e.target.value)
                setSelectedVariant(null)
                setSelectedReason('')
                form.setFieldsValue({ reason: undefined })
              }}
            >
              <Radio value="return">Return & Refund</Radio>
              <Radio value="replacement">Replacement</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="Reason"
            name="reason"
            rules={[{ required: true, message: 'Please select a reason' }]}
          >
            <Select
              placeholder="Select a reason"
              value={selectedReason}
              onChange={(value) => {
                setSelectedReason(value)
                form.setFieldsValue({ reason: value })
              }}
              options={returnReasons.map((r) => ({ label: r.label, value: r.value }))}
            />
          </Form.Item>

          {returnType === 'replacement' && orderItem && (
            <div>
              <Text strong>Select Replacement Variant</Text>
              {loadingVariants ? (
                <div className="flex justify-center py-4">
                  <Spin />
                </div>
              ) : replacementVariants.length === 0 ? (
                <Alert
                  message="No replacement variants available"
                  description="This product has no eligible variants for replacement."
                  type="warning"
                  style={{ marginTop: 8 }}
                />
              ) : (
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  {replacementVariants.map((variant) => (
                    <Card
                      key={variant._id}
                      size="small"
                      hoverable
                      onClick={() => setSelectedVariant(variant)}
                      style={{
                        cursor: 'pointer',
                        border:
                          selectedVariant?._id === variant._id ? '2px solid #1890ff' : '1px solid #d9d9d9',
                        backgroundColor: selectedVariant?._id === variant._id ? '#e6f7ff' : undefined,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {variant.mainImage && (
                          <Image
                            src={variant.mainImage}
                            alt={variant.name}
                            width={60}
                            height={60}
                            style={{ objectFit: 'cover', borderRadius: 4 }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <Text strong>{variant.name}</Text>
                            <Tag color={variant.canReplace ? 'green' : 'red'}>
                              {variant.canReplace ? 'Available' : 'Unavailable'}
                            </Tag>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            SKU: {variant.sku}
                          </div>
                          {Object.keys(variant.attributes).length > 0 && (
                            <div className="mt-1">
                              {Object.entries(variant.attributes).map(([key, value]) => (
                                <Tag key={key} style={{ marginRight: 4 }}>
                                  {key}: {value}
                                </Tag>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-4">
                            <Text>
                              Price: ₹{variant.price.toFixed(2)}
                              {variant.priceDifference !== 0 && (
                                <Text
                                  type={variant.priceDifference < 0 ? 'success' : 'danger'}
                                  style={{ marginLeft: 8 }}
                                >
                                  ({variant.priceDifference > 0 ? '+' : ''}₹
                                  {Math.abs(variant.priceDifference).toFixed(2)})
                                </Text>
                              )}
                            </Text>
                            <Text type="secondary">Stock: {variant.stock || 0}</Text>
                          </div>
                          {variant.requiresNewOrder && (
                            <Alert
                              message="Higher price variant"
                              description="This variant costs more. Customer needs to place a new order."
                              type="warning"
                              showIcon
                              style={{ marginTop: 8 }}
                            />
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {returnType === 'replacement' && selectedVariant && needsRefund && (
            <div>
              <Alert
                message="Price Difference Refund Required"
                description={`The replacement variant costs ₹${Math.abs(priceDifference).toFixed(2)} less. A refund of ₹${Math.abs(priceDifference).toFixed(2)} will be processed.`}
                type="info"
                showIcon
              />
              <Form.Item
                label="Refund Method"
                style={{ marginTop: 16 }}
                rules={[{ required: true, message: 'Please select a refund method' }]}
              >
                <Radio.Group
                  value={refundMode}
                  onChange={(e) => setRefundMode(e.target.value)}
                >
                  <Radio value="UPI">UPI</Radio>
                  <Radio value="BANK">Bank Transfer</Radio>
                </Radio.Group>
              </Form.Item>

              {refundMode === 'UPI' && (
                <Form.Item
                  label="UPI ID"
                  name="upiId"
                  rules={[
                    { required: true, message: 'UPI ID is required' },
                    {
                      pattern: /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/,
                      message: 'Invalid UPI ID format (e.g., xyz@paytm)',
                    },
                  ]}
                >
                  <Input placeholder="e.g., customer@paytm" />
                </Form.Item>
              )}

              {refundMode === 'BANK' && (
                <>
                  <Form.Item
                    label="Bank Account Number"
                    name="bankAccountNumber"
                    rules={[
                      { required: true, message: 'Bank account number is required' },
                      {
                        pattern: /^\d{9,18}$/,
                        message: 'Account number must be 9-18 digits',
                      },
                    ]}
                  >
                    <Input placeholder="Enter account number" />
                  </Form.Item>
                  <Form.Item
                    label="IFSC Code"
                    name="ifscCode"
                    rules={[
                      { required: true, message: 'IFSC code is required' },
                      {
                        pattern: /^[A-Z]{4}0[A-Z0-9]{6}$/,
                        message: 'Invalid IFSC format (e.g., HDFC0001234)',
                      },
                    ]}
                  >
                    <Input placeholder="e.g., HDFC0001234" style={{ textTransform: 'uppercase' }} />
                  </Form.Item>
                  <Form.Item
                    label="Account Holder Name"
                    name="accountHolderName"
                    rules={[
                      { required: true, message: 'Account holder name is required' },
                      { min: 2, max: 100, message: 'Name must be 2-100 characters' },
                    ]}
                  >
                    <Input placeholder="Enter account holder name" />
                  </Form.Item>
                </>
              )}
            </div>
          )}

          <Form.Item label="Description (Optional)" name="description">
            <TextArea rows={4} placeholder="Additional details about the return/replacement..." />
          </Form.Item>

          <Form.Item label="Images (Optional)" name="images">
            <Upload
              listType="picture-card"
              fileList={fileList}
              onChange={({ fileList: newFileList }) => setFileList(newFileList)}
              beforeUpload={() => false}
              maxCount={5}
            >
              {fileList.length < 5 && (
                <div>
                  <UploadOutlined />
                  <div style={{ marginTop: 8 }}>Upload</div>
                </div>
              )}
            </Upload>
            <Text type="secondary" className="text-xs">
              Maximum 5 images allowed
            </Text>
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  )
}

export default CreateReturnModal

