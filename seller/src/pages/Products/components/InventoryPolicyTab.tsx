import { Card, Col, Form, InputNumber, Row, Select, Switch } from 'antd'

const InventoryPolicyTab = () => {
  return (
    <Card title="Ordering & Inventory Policy" style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item
            name="trackInventory"
            label="Track Inventory"
            valuePropName="checked"
            tooltip="Receive low-stock notifications and keep stock levels in sync."
          >
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="minOrderQuantity"
            label="Min Order Quantity"
            tooltip="Minimum quantity per order"
            initialValue={1}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="1" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item
            name="maxOrderQuantity"
            label="Max Order Quantity"
            tooltip="Maximum quantity per order"
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="No limit" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="taxClass" label="Tax Class">
            <Select placeholder="Select tax class">
              <Select.Option value="standard">Standard</Select.Option>
              <Select.Option value="reduced">Reduced</Select.Option>
              <Select.Option value="zero">Zero Rate</Select.Option>
              <Select.Option value="exempt">Exempt</Select.Option>
            </Select>
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="taxRate" label="Tax Rate (%)">
            <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  )
}

export default InventoryPolicyTab
