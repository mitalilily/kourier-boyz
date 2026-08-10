import {
  Alert,
  App,
  Button,
  DatePicker,
  Divider,
  Form,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'
import {
  useRequestPickup,
  useSellerPickupAddresses,
  useShipmentRates,
} from '../../api/orderQueries'
import type {
  AdminOrder,
  AdminSellerShipment,
  CourierRateOption,
  PickupAddress,
} from '../../api/orders'

const { Text, Title } = Typography

interface RequestPickupModalProps {
  open: boolean
  onClose: () => void
  order?: AdminOrder
  shipment?: AdminSellerShipment
  onSuccess?: () => void
}

const RequestPickupModal: React.FC<RequestPickupModalProps> = ({
  open,
  onClose,
  order,
  shipment,
  onSuccess,
}) => {
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [rates, setRates] = useState<CourierRateOption[]>([])
  const [selectedCourier, setSelectedCourier] = useState<CourierRateOption | null>(null)
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesFetched, setRatesFetched] = useState(false)

  const { data: addressesData, isLoading: addressesLoading } = useSellerPickupAddresses(
    order?._id,
    shipment?._id,
  )
  const shipmentRatesMutation = useShipmentRates()
  const requestPickupMutation = useRequestPickup()

  const pickupAddresses: PickupAddress[] = addressesData?.data || []

  // Forward total = forward rate + COD (if COD order) + other. Used for display and backend.
  const getForwardTotalCharges = (courier: CourierRateOption, isCod: boolean): number => {
    const forwardRate =
      courier.rate_details?.forward?.rate !== undefined
        ? typeof courier.rate_details.forward.rate === 'string'
          ? parseFloat(courier.rate_details.forward.rate)
          : courier.rate_details.forward.rate
        : (typeof courier.rate === 'number' ? courier.rate : courier.rate ? parseFloat(String(courier.rate)) : 0)

    const codCharges =
      isCod && courier.rate_details?.forward?.cod_charges !== undefined
        ? typeof courier.rate_details.forward.cod_charges === 'string'
          ? parseFloat(courier.rate_details.forward.cod_charges)
          : courier.rate_details.forward.cod_charges
        : 0

    const otherCharges =
      courier.rate_details?.forward?.other_charges !== undefined
        ? typeof courier.rate_details.forward.other_charges === 'string'
          ? parseFloat(courier.rate_details.forward.other_charges)
          : courier.rate_details.forward.other_charges
        : 0

    return forwardRate + codCharges + otherCharges
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setRates([])
      setSelectedCourier(null)
      setRatesFetched(false)
      form.resetFields()
      // Set default values
      form.setFieldsValue({
        weight: 0.5,
        length: 10,
        width: 10,
        height: 10,
        pickupDate: dayjs().add(1, 'day'),
        pickupTime: '10:00-14:00',
      })
    }
  }, [open, form])

  // Set default pickup address when addresses load
  useEffect(() => {
    if (pickupAddresses.length > 0 && !form.getFieldValue('pickupAddressId')) {
      const defaultAddress =
        pickupAddresses.find((addr) => addr.isDefault) || pickupAddresses[0]
      form.setFieldsValue({ pickupAddressId: defaultAddress._id })
    }
  }, [pickupAddresses, form])

  const handleFetchRates = async () => {
    if (!order || !shipment) return

    try {
      const values = await form.validateFields(['weight', 'length', 'width', 'height'])
      setRatesLoading(true)
      setRates([])
      setSelectedCourier(null)

      const response = await shipmentRatesMutation.mutateAsync({
        orderId: order._id,
        shipmentId: shipment._id,
        payload: {
          weight: values.weight,
          dimensions: {
            length: values.length,
            width: values.width,
            height: values.height,
          },
        },
      })

      const fetchedRates = response.data?.rates || []
      setRates(fetchedRates)
      setRatesFetched(true)

      if (fetchedRates.length === 0) {
        message.warning('No courier rates available for this route')
      }
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to fetch rates')
    } finally {
      setRatesLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!order || !shipment || !selectedCourier) {
      message.error('Please select a courier')
      return
    }

    try {
      const values = await form.validateFields()

      const isCod = order.paymentMethod === 'cod'
      const totalCharges = getForwardTotalCharges(selectedCourier, isCod)

      await requestPickupMutation.mutateAsync({
        orderId: order._id,
        shipmentId: shipment._id,
        payload: {
          package: {
            weight: values.weight,
            length: values.length,
            width: values.width,
            height: values.height,
          },
          courierId: selectedCourier.courier_id,
          providerCode: selectedCourier.provider_code,
          pickupAddressId: values.pickupAddressId,
          pickupDate: values.pickupDate?.format('YYYY-MM-DD'),
          pickupTime: values.pickupTime,
          estimatedCharge: totalCharges,
        },
      })

      message.success('Pickup requested successfully')
      onSuccess?.()
      onClose()
    } catch (error) {
      message.error((error as Error)?.message || 'Failed to request pickup')
    }
  }

  const rateColumns = [
    {
      title: 'Courier',
      dataIndex: 'courier_name',
      key: 'courier_name',
      render: (name: string, record: CourierRateOption) => (
        <div>
          <Text strong>{name}</Text>
          {record.zone && (
            <div>
              <Tag color="blue" className="text-xs">
                Zone: {record.zone}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Total charges',
      key: 'rate',
      render: (_: unknown, record: CourierRateOption) => {
        const total = order
          ? getForwardTotalCharges(record, order.paymentMethod === 'cod')
          : (record.rate ?? 0)
        return `₹${typeof total === 'number' ? total.toFixed(2) : '0.00'}`
      },
    },
    {
      title: 'Delivery',
      key: 'delivery',
      render: (_: unknown, record: CourierRateOption) =>
        record.estimated_delivery_days || record.estimated_delivery_date || '—',
    },
    {
      title: 'COD',
      dataIndex: 'cod_available',
      key: 'cod',
      render: (available: boolean) =>
        available ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
    },
  ]

  if (!order || !shipment) return null

  return (
    <Modal
      title={
        <div>
          <Title level={5} className="!mb-0">
            Request Pickup
          </Title>
          <Text type="secondary" className="text-sm">
            Order #{order.orderNumber || order._id}
          </Text>
        </div>
      }
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
          onClick={handleSubmit}
          loading={requestPickupMutation.isPending}
          disabled={!selectedCourier}
        >
          Request Pickup
        </Button>,
      ]}
    >
      <div className="space-y-4">
        {/* Seller Info */}
        <Alert
          type="info"
          showIcon
          message={`Seller: ${shipment.seller?.businessName || shipment.seller?.name || 'Unknown'}`}
          description={`Current Status: ${shipment.status.replace(/_/g, ' ').toUpperCase()}`}
        />

        <Form form={form} layout="vertical">
          {/* Package Details */}
          <Divider orientation="left">Package Details</Divider>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Form.Item
              name="weight"
              label="Weight (kg)"
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={0.1} step={0.1} className="w-full" />
            </Form.Item>
            <Form.Item
              name="length"
              label="Length (cm)"
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item
              name="width"
              label="Width (cm)"
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item
              name="height"
              label="Height (cm)"
              rules={[{ required: true, message: 'Required' }]}
            >
              <InputNumber min={1} className="w-full" />
            </Form.Item>
          </div>

          {/* Pickup Details */}
          <Divider orientation="left">Pickup Details</Divider>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item
              name="pickupAddressId"
              label="Pickup Address"
              rules={[{ required: true, message: 'Select pickup address' }]}
            >
              {addressesLoading ? (
                <Spin size="small" />
              ) : (
                <Select placeholder="Select pickup address">
                  {pickupAddresses.map((addr) => (
                    <Select.Option key={addr._id} value={addr._id}>
                      <div>
                        <div className="font-medium">{addr.warehouseName || 'Address'}</div>
                        <div className="text-xs text-gray-500">
                          {addr.addressLine1}, {addr.city} - {addr.postalCode}
                        </div>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              )}
            </Form.Item>

            <Form.Item name="pickupDate" label="Pickup Date">
              <DatePicker
                className="w-full"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            </Form.Item>

            <Form.Item name="pickupTime" label="Pickup Time Slot">
              <Select placeholder="Select time slot">
                <Select.Option value="10:00-14:00">10:00 AM - 2:00 PM</Select.Option>
                <Select.Option value="14:00-18:00">2:00 PM - 6:00 PM</Select.Option>
                <Select.Option value="18:00-21:00">6:00 PM - 9:00 PM</Select.Option>
              </Select>
            </Form.Item>
          </div>

          {/* Fetch Rates Button */}
          <div className="flex justify-center my-4">
            <Button
              type="primary"
              ghost
              onClick={handleFetchRates}
              loading={ratesLoading}
              size="large"
            >
              Get Shipping Rates
            </Button>
          </div>

          {/* Courier Selection */}
          {ratesFetched && (
            <>
              <Divider orientation="left">Select Courier</Divider>
              {rates.length > 0 ? (
                <Table
                  dataSource={rates}
                  columns={rateColumns}
                  rowKey={(record) => `${record.courier_id}-${record.provider_code || ''}`}
                  pagination={false}
                  size="small"
                  rowSelection={{
                    type: 'radio',
                    selectedRowKeys: selectedCourier
                      ? [`${selectedCourier.courier_id}-${selectedCourier.provider_code || ''}`]
                      : [],
                    onChange: (_, selectedRows) => {
                      setSelectedCourier(selectedRows[0] || null)
                    },
                  }}
                  onRow={(record) => ({
                    onClick: () => setSelectedCourier(record),
                    style: { cursor: 'pointer' },
                  })}
                />
              ) : (
                <Alert
                  type="warning"
                  message="No courier rates available"
                  description="Try adjusting the package dimensions or check seller pickup address."
                />
              )}
            </>
          )}

          {/* Selected Courier Summary */}
          {selectedCourier && order && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <Space direction="vertical" className="w-full">
                <Text strong>Selected Courier: {selectedCourier.courier_name}</Text>
                <Text>
                  Total shipping charges: ₹
                  {getForwardTotalCharges(selectedCourier, order.paymentMethod === 'cod').toFixed(2)}
                </Text>
                {selectedCourier.estimated_delivery_days && (
                  <Text>
                    Estimated Delivery: {selectedCourier.estimated_delivery_days} days
                  </Text>
                )}
              </Space>
            </div>
          )}
        </Form>
      </div>
    </Modal>
  )
}

export default RequestPickupModal

