import { ShopOutlined, TruckOutlined } from '@ant-design/icons'
import { Alert, Card, Col, Form, Input, InputNumber, Radio, Row, Select, Space, Switch } from 'antd'
import { useAuthStore } from '../../../store/authStore'

const ShippingTab = () => {
  const user = useAuthStore((state) => state.user)
  const defaultShippingRate = user?.defaultShippingRate || 0

  return (
    <>
      <Card title="Shipping" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="freeShipping"
              label="Free Shipping"
              valuePropName="checked"
              tooltip="Enable if shipping is free for this product"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="shippingCharge"
              label="Shipping Charge (₹)"
              tooltip={`Product-level shipping charge. If not set, will use your default shipping rate (₹${defaultShippingRate.toFixed(
                2,
              )}). This overrides your default rate for this product.`}
              extra={
                defaultShippingRate > 0
                  ? `Your default shipping rate: ₹${defaultShippingRate.toFixed(2)}`
                  : 'Set your default shipping rate in store settings'
              }
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                placeholder={defaultShippingRate > 0 ? defaultShippingRate.toFixed(2) : '0.00'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="shippingWeight" label="Weight (kg)">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0.0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['shippingDimensions', 'length']} label="Length (cm)">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['shippingDimensions', 'width']} label="Width (cm)">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name={['shippingDimensions', 'height']} label="Height (cm)">
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="fulfillmentType"
          label="Fulfillment Type"
          tooltip="Override your default fulfillment method for this product. Select 'Use Store Default' to use your store default."
          style={{ marginTop: 24 }}
        >
          <Radio.Group>
            <Radio value="">
              <Space>
                <div>
                  <div style={{ fontWeight: 600 }}>Use Store Default</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Marketplace-Fulfilled
                  </div>
                </div>
              </Space>
            </Radio>
            <Radio value="self-ship">
              <Space>
                <TruckOutlined />
                <div>
                  <div style={{ fontWeight: 600 }}>Self-Ship</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    You handle logistics and shipping for this product
                  </div>
                </div>
              </Space>
            </Radio>
            <Radio value="marketplace-fulfilled">
              <Space>
                <ShopOutlined />
                <div>
                  <div style={{ fontWeight: 600 }}>Marketplace-Fulfilled</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    We handle logistics and shipping for this product
                  </div>
                </div>
              </Space>
            </Radio>
          </Radio.Group>
        </Form.Item>

        <Alert
          message="Product-Level Fulfillment Override"
          description="You can set a different fulfillment type for this product. If not set, the system will use your store default fulfillment type. At order time, the system may also auto-decide based on inventory location, buyer region, and delivery SLA optimization."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>

      {/* Product Features & Policies */}
      <Card title="Product Features & Policies" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="payOnDelivery"
              label="Pay on Delivery"
              valuePropName="checked"
              tooltip="Enable if customers can pay when the product is delivered"
              initialValue={true}
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="returnable"
              label="Returnable"
              valuePropName="checked"
              tooltip="Enable if this product can be returned"
              initialValue={true}
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="returnDays"
              label="Return Period (Days)"
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
            >
              <InputNumber min={1} max={365} style={{ width: '100%' }} placeholder="10" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="warranty"
              label="Warranty"
              valuePropName="checked"
              tooltip="Enable if this product comes with warranty"
              initialValue={true}
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              label="Warranty Period"
              tooltip="Warranty period in months or years"
              dependencies={['warranty']}
            >
              <Input.Group compact>
                <Form.Item
                  name="warrantyPeriod"
                  noStyle
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
                  <InputNumber min={1} max={100} style={{ width: '60%' }} placeholder="1" />
                </Form.Item>
                <Form.Item name="warrantyPeriodUnit" noStyle initialValue="months">
                  <Select style={{ width: '40%' }}>
                    <Select.Option value="months">Months</Select.Option>
                    <Select.Option value="years">Years</Select.Option>
                  </Select>
                </Form.Item>
              </Input.Group>
            </Form.Item>
          </Col>
        </Row>

        <Alert
          message="Product Features"
          description="These features will be displayed as badges on your product page to build customer trust and highlight key benefits. Configure return and warranty periods based on your store policies."
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Card>
    </>
  )
}

export default ShippingTab
