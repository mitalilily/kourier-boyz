import type { FormInstance } from 'antd'
import { Card, Col, Form, InputNumber, Row, Select, Switch } from 'antd'
import { useEffect } from 'react'
import { useAuthStore } from '../../../store/authStore'

interface ShippingPoliciesTabProps {
  form?: FormInstance
}

const ShippingPoliciesTab = ({ form }: ShippingPoliciesTabProps) => {
  const user = useAuthStore((state) => state.user)
  const defaultShippingRate = user?.defaultShippingRate || 0

  // Prefill shipping charge with default value if form is provided and field is empty
  useEffect(() => {
    if (form) {
      const currentShippingCharge = form.getFieldValue('shippingCharge')
      // Only set if field is empty/undefined and defaultShippingRate exists
      if (
        (currentShippingCharge === undefined ||
          currentShippingCharge === null ||
          currentShippingCharge === '') &&
        defaultShippingRate > 0
      ) {
        form.setFieldsValue({ shippingCharge: defaultShippingRate })
      }
    }
  }, [form, defaultShippingRate])

  return (
    <>
      <Card
        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>Shipping</span>}
        style={{ marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        <Row gutter={[12, 8]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="freeShipping"
              label={<span style={{ fontSize: '12px' }}>Free Shipping</span>}
              valuePropName="checked"
              tooltip="Enable if shipping is free for this product"
              style={{ marginBottom: 12 }}
            >
              <Switch size="small" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="shippingCharge"
              label={<span style={{ fontSize: '12px' }}>Shipping Charge (₹)</span>}
              tooltip={`Product-level shipping charge. If not set, will use your default shipping rate (₹${defaultShippingRate.toFixed(
                2,
              )}). This overrides your default rate for this product.`}
              initialValue={defaultShippingRate > 0 ? defaultShippingRate : undefined}
              extra={
                defaultShippingRate > 0 ? (
                  <span style={{ fontSize: '11px' }}>
                    Your default shipping rate: ₹{defaultShippingRate.toFixed(2)}
                  </span>
                ) : (
                  <span style={{ fontSize: '11px' }}>
                    Set your default shipping rate in store settings
                  </span>
                )
              }
              style={{ marginBottom: 12 }}
            >
              <InputNumber
                size="small"
                min={0}
                style={{ width: '100%' }}
                placeholder={defaultShippingRate > 0 ? defaultShippingRate.toFixed(2) : '0.00'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="shippingWeight"
              label={<span style={{ fontSize: '12px' }}>Weight (kg)</span>}
              style={{ marginBottom: 12 }}
            >
              <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0.0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name={['shippingDimensions', 'length']}
              label={<span style={{ fontSize: '12px' }}>Length (cm)</span>}
              style={{ marginBottom: 12 }}
            >
              <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name={['shippingDimensions', 'width']}
              label={<span style={{ fontSize: '12px' }}>Width (cm)</span>}
              style={{ marginBottom: 12 }}
            >
              <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name={['shippingDimensions', 'height']}
              label={<span style={{ fontSize: '12px' }}>Height (cm)</span>}
              style={{ marginBottom: 12 }}
            >
              <InputNumber size="small" min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Col>
        </Row>
      </Card>

      {/* Product Policies */}
      <Card
        title={<span style={{ fontSize: '14px', fontWeight: 600 }}>Product Policies</span>}
        style={{ marginTop: 0, marginBottom: 12 }}
        bodyStyle={{ padding: '12px' }}
        size="small"
      >
        <Row gutter={[12, 8]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="payOnDelivery"
              label={<span style={{ fontSize: '12px' }}>Pay on Delivery</span>}
              valuePropName="checked"
              tooltip="Enable if customers can pay when the product is delivered"
              initialValue={true}
              style={{ marginBottom: 12 }}
            >
              <Switch size="small" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="returnable"
              label={<span style={{ fontSize: '12px' }}>Returnable</span>}
              valuePropName="checked"
              tooltip="Enable if this product can be returned"
              initialValue={true}
              style={{ marginBottom: 12 }}
            >
              <Switch size="small" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="returnDays"
              label={<span style={{ fontSize: '12px' }}>Return Period (Days)</span>}
              tooltip="Number of days customers have to return this product"
              dependencies={['returnable']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!getFieldValue('returnable')) {
                      return Promise.resolve()
                    }
                    if (!value || value < 1) {
                      return Promise.reject(
                        new Error('Please enter a valid return period (minimum 1 day)'),
                      )
                    }
                    return Promise.resolve()
                  },
                }),
              ]}
              style={{ marginBottom: 12 }}
            >
              <InputNumber
                size="small"
                min={1}
                max={365}
                style={{ width: '100%' }}
                placeholder="10"
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="warranty"
              label={<span style={{ fontSize: '12px' }}>Warranty</span>}
              valuePropName="checked"
              tooltip="Enable if this product comes with warranty"
              initialValue={true}
              style={{ marginBottom: 12 }}
            >
              <Switch size="small" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label={<span style={{ fontSize: '12px' }}>Warranty Period</span>}
              tooltip="Warranty period in months or years"
              style={{ marginBottom: 0 }}
            >
              <Row gutter={8}>
                <Col flex="auto">
                  <Form.Item
                    name="warrantyPeriod"
                    noStyle
                    dependencies={['warranty']}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!getFieldValue('warranty')) {
                            return Promise.resolve()
                          }
                          if (!value || value < 1) {
                            return Promise.reject(new Error('Please enter a valid warranty period'))
                          }
                          return Promise.resolve()
                        },
                      }),
                    ]}
                  >
                    <InputNumber
                      size="small"
                      min={1}
                      max={100}
                      style={{ width: '100%' }}
                      placeholder="1"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="warrantyPeriodUnit" noStyle initialValue="months">
                    <Select size="small" style={{ width: '100%' }}>
                      <Select.Option value="months">Months</Select.Option>
                      <Select.Option value="years">Years</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            </Form.Item>
          </Col>
        </Row>
      </Card>
    </>
  )
}

export default ShippingPoliciesTab
