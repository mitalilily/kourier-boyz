import {
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import { useState } from 'react'
import type { PickupAddress } from '../../../api/storeQueries'
import { lookupPincode } from '../../../utils/pincodeLookup'
import type { StoreSettingsTabProps } from './types'

const { Title, Paragraph } = Typography

const ShippingLogisticsTab = ({ form, onSubmit, isLoading }: StoreSettingsTabProps) => {
  const [loadingPincode, setLoadingPincode] = useState<Record<string, boolean>>({})

  const getLoadingKey = (fieldIndex: number, type: 'pickup' | 'rto') =>
    `${type}_pickupAddresses_${fieldIndex}`

  // Function to fetch city and state from pincode
  const fetchCityState = async (
    pincode: string,
    fieldIndex: number,
    locationType: 'pickup' | 'rto' = 'pickup',
  ) => {
    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      return
    }

    const fieldKey = getLoadingKey(fieldIndex, locationType)
    setLoadingPincode((prev) => ({ ...prev, [fieldKey]: true }))

    try {
      const location = await lookupPincode(pincode)

      if (location) {
        const basePath =
          locationType === 'pickup'
            ? ['pickupAddresses', fieldIndex]
            : ['pickupAddresses', fieldIndex, 'rtoAddress']

        if (locationType === 'rto') {
          const existingRto = form.getFieldValue(basePath)
          if (!existingRto) {
            form.setFieldValue(basePath, {})
          }
        }

        form.setFieldValue([...basePath, 'city'], location.city)
        form.setFieldValue([...basePath, 'state'], location.state)
      }
    } catch (error) {
      console.error('Error fetching city/state:', error)
    } finally {
      setLoadingPincode((prev) => ({ ...prev, [fieldKey]: false }))
    }
  }

  const syncPickupToRto = (fieldIndex: number) => {
    const pickupAddress = form.getFieldValue(['pickupAddresses', fieldIndex]) || {}
    const rtoAddress = {
      contactName: pickupAddress.contactName || '',
      contactPhone: pickupAddress.contactPhone || '',
      addressLine1: pickupAddress.addressLine1 || '',
      addressLine2: pickupAddress.addressLine2 || '',
      city: pickupAddress.city || '',
      state: pickupAddress.state || '',
      postalCode: pickupAddress.postalCode || '',
      country: pickupAddress.country || 'India',
    }

    form.setFieldValue(['pickupAddresses', fieldIndex, 'rtoAddress'], rtoAddress)
  }

  const handleRtoSameChange = (fieldIndex: number, checked: boolean) => {
    form.setFieldValue(['pickupAddresses', fieldIndex, 'rtoSameAsPickup'], checked)
    if (checked) {
      form.setFieldValue(['pickupAddresses', fieldIndex, 'rtoAddress'], undefined)
    } else {
      syncPickupToRto(fieldIndex)
    }
  }

  return (
    <Card>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Title level={4}>Shipping & Logistics Configuration</Title>
        <Paragraph type="secondary">
          Define how products reach customers through shipping and logistics.
        </Paragraph>

        <Divider orientation="left">Pickup Addresses</Divider>
        <Form.Item name="pickupAddresses">
          <Form.List name="pickupAddresses">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => {
                  const pickupLoadingKey = getLoadingKey(field.name, 'pickup')
                  const rtoLoadingKey = getLoadingKey(field.name, 'rto')
                  const isDefault = form.getFieldValue(['pickupAddresses', field.name, 'isDefault'])
                  return (
                    <Card
                      key={field.key}
                      style={{ marginBottom: 16 }}
                      title={
                        <Space>
                          <span>Pickup Address {index + 1}</span>
                          {isDefault && <Tag color="blue">Default</Tag>}
                        </Space>
                      }
                      extra={
                        <Space>
                          <Button
                            type="link"
                            onClick={() => {
                              const addresses =
                                (form.getFieldValue('pickupAddresses') as PickupAddress[]) || []
                              const newAddresses = addresses.map((addr, i: number) => ({
                                ...addr,
                                isDefault: i === index,
                              }))
                              form.setFieldValue('pickupAddresses', newAddresses)
                            }}
                          >
                            Set as Default
                          </Button>
                          <Button type="link" danger onClick={() => remove(field.name)}>
                            <DeleteOutlined /> Remove
                          </Button>
                        </Space>
                      }
                    >
                      <Row gutter={16}>
                        <Col xs={24}>
                          <Form.Item
                            name={[field.name, 'warehouseName']}
                            label="Warehouse Name"
                            rules={[
                              { required: true, message: 'Required' },
                              { max: 100, message: 'Maximum 100 characters' },
                            ]}
                          >
                            <Input placeholder="E.g., Mumbai Central Warehouse" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name={[field.name, 'contactName']}
                            label="Contact Name"
                            rules={[{ required: true, message: 'Required' }]}
                          >
                            <Input placeholder="John Doe" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name={[field.name, 'contactPhone']}
                            label="Contact Phone"
                            rules={[
                              { required: true, message: 'Required' },
                              {
                                pattern: /^\d{10}$/,
                                message: 'Enter a valid 10-digit phone number',
                              },
                            ]}
                          >
                            <Input placeholder="9876543210" maxLength={10} />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item
                            name={[field.name, 'addressLine1']}
                            label="Address Line 1"
                            rules={[{ required: true, message: 'Required' }]}
                          >
                            <Input placeholder="Street address, building number" />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item name={[field.name, 'addressLine2']} label="Address Line 2">
                            <Input placeholder="Apartment, suite, etc. (optional)" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name={[field.name, 'postalCode']}
                            label="Postal Code"
                            rules={[
                              { required: true, message: 'Required' },
                              { len: 6, message: 'PIN code must be 6 digits' },
                              { pattern: /^\d{6}$/, message: 'Invalid PIN code format' },
                            ]}
                          >
                            <Input
                              placeholder="PIN/ZIP Code"
                              maxLength={6}
                              onBlur={(e) => {
                                const pincode = e.target.value.trim()
                                if (pincode.length === 6) {
                                  fetchCityState(pincode, field.name, 'pickup')
                                }
                              }}
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name={[field.name, 'city']}
                            label="City"
                            rules={[{ required: true, message: 'Required' }]}
                          >
                            <Input
                              placeholder="City"
                              disabled
                              suffix={
                                loadingPincode[pickupLoadingKey] ? <Spin size="small" /> : null
                              }
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            name={[field.name, 'state']}
                            label="State"
                            rules={[{ required: true, message: 'Required' }]}
                          >
                            <Input
                              placeholder="State"
                              disabled
                              suffix={
                                loadingPincode[pickupLoadingKey] ? <Spin size="small" /> : null
                              }
                            />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item
                            name={[field.name, 'country']}
                            label="Country"
                            rules={[{ required: true, message: 'Required' }]}
                          >
                            <Input placeholder="Country" defaultValue="India" />
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item
                            name={[field.name, 'rtoSameAsPickup']}
                            valuePropName="checked"
                            initialValue={true}
                          >
                            <Checkbox
                              onChange={(e: CheckboxChangeEvent) =>
                                handleRtoSameChange(field.name, e.target.checked)
                              }
                            >
                              Use pickup address as RTO address
                            </Checkbox>
                          </Form.Item>
                        </Col>
                        <Col xs={24}>
                          <Form.Item noStyle shouldUpdate>
                            {() =>
                              form.getFieldValue([
                                'pickupAddresses',
                                field.name,
                                'rtoSameAsPickup',
                              ]) === false ? (
                                <Card type="inner" title="RTO Address" style={{ marginBottom: 0 }}>
                                  <Row gutter={16}>
                                    <Col xs={24} md={12}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'contactName']}
                                        label="RTO Contact Name"
                                        rules={[{ required: true, message: 'Required' }]}
                                      >
                                        <Input placeholder="Contact person" />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'contactPhone']}
                                        label="RTO Contact Phone"
                                        rules={[
                                          { required: true, message: 'Required' },
                                          {
                                            pattern: /^\d{10}$/,
                                            message: 'Enter a valid 10-digit phone number',
                                          },
                                        ]}
                                      >
                                        <Input placeholder="9876543210" maxLength={10} />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24} md={12}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'contactEmail']}
                                        label="RTO Contact Email"
                                        rules={[{ type: 'email', message: 'Enter a valid email' }]}
                                      >
                                        <Input placeholder="contact@example.com" />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'addressLine1']}
                                        label="RTO Address Line 1"
                                        rules={[{ required: true, message: 'Required' }]}
                                      >
                                        <Input placeholder="Street address, building number" />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'addressLine2']}
                                        label="RTO Address Line 2"
                                      >
                                        <Input placeholder="Apartment, suite, etc. (optional)" />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'postalCode']}
                                        label="RTO Postal Code"
                                        rules={[
                                          { required: true, message: 'Required' },
                                          { len: 6, message: 'PIN code must be 6 digits' },
                                          {
                                            pattern: /^\d{6}$/,
                                            message: 'Invalid PIN code format',
                                          },
                                        ]}
                                      >
                                        <Input
                                          placeholder="PIN/ZIP Code"
                                          maxLength={6}
                                          onBlur={(e) => {
                                            const pincode = e.target.value.trim()
                                            if (pincode.length === 6) {
                                              fetchCityState(pincode, field.name, 'rto')
                                            }
                                          }}
                                        />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'city']}
                                        label="RTO City"
                                        rules={[{ required: true, message: 'Required' }]}
                                      >
                                        <Input
                                          placeholder="City"
                                          disabled
                                          suffix={
                                            loadingPincode[rtoLoadingKey] ? (
                                              <Spin size="small" />
                                            ) : null
                                          }
                                        />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24} md={8}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'state']}
                                        label="RTO State"
                                        rules={[{ required: true, message: 'Required' }]}
                                      >
                                        <Input
                                          placeholder="State"
                                          disabled
                                          suffix={
                                            loadingPincode[rtoLoadingKey] ? (
                                              <Spin size="small" />
                                            ) : null
                                          }
                                        />
                                      </Form.Item>
                                    </Col>
                                    <Col xs={24}>
                                      <Form.Item
                                        name={[field.name, 'rtoAddress', 'country']}
                                        label="RTO Country"
                                        rules={[{ required: true, message: 'Required' }]}
                                      >
                                        <Input placeholder="Country" defaultValue="India" />
                                      </Form.Item>
                                    </Col>
                                  </Row>
                                </Card>
                              ) : null
                            }
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  )
                })}
                <Button
                  type="link"
                  onClick={() =>
                    add({
                      warehouseName: '',
                      addressLine1: '',
                      addressLine2: '',
                      city: '',
                      state: '',
                      postalCode: '',
                      country: 'India',
                      contactName: '',
                      contactPhone: '',
                      isDefault: false,
                      rtoSameAsPickup: true,
                      rtoAddress: {
                        contactName: '',
                        contactPhone: '',
                        contactEmail: '',
                        addressLine1: '',
                        addressLine2: '',
                        city: '',
                        state: '',
                        postalCode: '',
                        country: 'India',
                      },
                    })
                  }
                  block
                  icon={<PlusOutlined />}
                >
                  Add Pickup Address
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Divider orientation="left">Shipping Rates</Divider>
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              name="defaultShippingRate"
              label="Default Shipping Rate (₹)"
              tooltip="Default shipping cost if no zone-specific rate is set"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                prefix="₹"
                placeholder="0.00"
                step={0.01}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">Preferred Courier Partners</Divider>
        <Form.Item
          name="preferredCouriers"
          label="Preferred Courier Partners"
          tooltip="Select your preferred courier partners for shipping"
        >
          <Select
            mode="multiple"
            disabled
            style={{ width: '100%' }}
            placeholder="Select courier partners"
            options={[
              { label: 'BlueDart', value: 'BlueDart' },
              { label: 'DTDC', value: 'DTDC' },
              { label: 'Delhivery', value: 'Delhivery' },
              { label: 'FedEx', value: 'FedEx' },
              { label: 'India Post', value: 'India Post' },
              { label: 'Shiprocket', value: 'Shiprocket' },
              { label: 'XpressBees', value: 'XpressBees' },
              { label: 'Ekart', value: 'Ekart' },
              { label: 'Gati', value: 'Gati' },
              { label: 'Other', value: 'Other' },
            ]}
          />
        </Form.Item>

        <Divider orientation="left">Packaging Standards</Divider>
        <Form.Item name="packagingStandards">
          <Form.List name="packagingStandards">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Card
                    key={field.key}
                    style={{ marginBottom: 16 }}
                    title="Packaging Requirement"
                    extra={
                      <Button type="link" danger onClick={() => remove(field.name)}>
                        <DeleteOutlined /> Remove
                      </Button>
                    }
                  >
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name={[field.name, 'type']}
                          label="Packaging Type"
                          rules={[{ required: true, message: 'Required' }]}
                        >
                          <Select placeholder="Select type">
                            <Select.Option value="fragile">Fragile</Select.Option>
                            <Select.Option value="perishable">Perishable</Select.Option>
                            <Select.Option value="hazardous">Hazardous</Select.Option>
                            <Select.Option value="standard">Standard</Select.Option>
                            <Select.Option value="custom">Custom</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name={[field.name, 'description']} label="Description">
                          <Input placeholder="Additional packaging requirements" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add({ type: 'standard', description: '' })}
                  block
                  icon={<PlusOutlined />}
                >
                  Add Packaging Standard
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isLoading}>
            Save Shipping & Logistics Settings
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default ShippingLogisticsTab
