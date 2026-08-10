import {
  BankOutlined,
  CalculatorOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd'
import { useEffect } from 'react'
import {
  useSettlementSettings,
  useUpdateSettlementSettings,
  type SettlementSettings,
} from '../../api/settings'

const { Paragraph, Text } = Typography
const { Panel } = Collapse

const SettlementCalculationSettings = () => {
  const { message } = App.useApp()
  const { data: settlementResponse, isLoading } = useSettlementSettings()
  const updateSettlement = useUpdateSettlementSettings()
  const settlementSettings = settlementResponse?.data

  const [form] = Form.useForm<SettlementSettings>()
  const pgFeeMethod = Form.useWatch('pgFeeCalculationMethod', form)
  const roundLedgerAggregation = Form.useWatch('roundLedgerAggregation', form)

  useEffect(() => {
    if (settlementSettings) {
      form.setFieldsValue(settlementSettings)
    }
  }, [settlementSettings, form])

  const handleReset = () => {
    if (settlementSettings) {
      form.setFieldsValue(settlementSettings)
    }
  }

  const handleSubmit = async (values: SettlementSettings) => {
    try {
      await updateSettlement.mutateAsync(values)
      message.success('Settlement calculation settings updated successfully')
    } catch (error) {
      console.error(error)
      message.error('Failed to update settlement calculation settings')
    }
  }

  return (
    <Card>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spin />
        </div>
      ) : (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            message="Settlement Calculation Settings"
            description="Configure how settlement amounts, commissions, fees, and ledger entries are calculated. These settings control when orders become eligible, how amounts are rounded, and how settlements are processed."
          />

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Collapse defaultActiveKey={['1', '2', '3', '4', '5', '6', '7', '8']} ghost>
              {/* 1. SETTLEMENT ELIGIBILITY */}
              <Panel
                header={
                  <Space>
                    <ClockCircleOutlined style={{ color: '#1890ff' }} />
                    <Text strong>1. Settlement Eligibility Logic</Text>
                  </Space>
                }
                key="1"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Control when orders become eligible for settlement. These rules determine which
                  orders are included in settlement batches.
                </Paragraph>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="requireOrderDelivered"
                      valuePropName="checked"
                      tooltip="If enabled, only orders with 'Delivered' status can be included in settlement batches. This ensures sellers are paid only after products reach customers."
                    >
                      <Switch
                        checkedChildren="Require Delivered Status"
                        unCheckedChildren="Any Status"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="requireReturnWindowPassed"
                      valuePropName="checked"
                      tooltip="If enabled, orders become eligible for settlement only after the return window period has passed (based on Global/Seller Settlement Settings). This protects against paying for orders that might be returned."
                    >
                      <Switch
                        checkedChildren="Require Return Window Passed"
                        unCheckedChildren="No Return Window Check"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="excludeReplacementOrders"
                      valuePropName="checked"
                      tooltip="If enabled, replacement orders (₹0 value orders created when replacing defective/damaged items) are excluded from settlements. These orders have no payment value."
                    >
                      <Switch
                        checkedChildren="Exclude Replacement Orders"
                        unCheckedChildren="Include"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="excludeCancelledOrders"
                      valuePropName="checked"
                      tooltip="If enabled, cancelled orders are never included in settlement batches. Cancelled orders have no settlement value."
                    >
                      <Switch
                        checkedChildren="Exclude Cancelled Orders"
                        unCheckedChildren="Include"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="excludeFullyReturnedOrders"
                      valuePropName="checked"
                      tooltip="If enabled, orders where all items have been returned are excluded from settlements. Since the seller received no revenue, no settlement is needed."
                    >
                      <Switch
                        checkedChildren="Exclude Fully Returned"
                        unCheckedChildren="Include"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* 2. COMMISSION CALCULATION */}
              <Panel
                header={
                  <Space>
                    <DollarOutlined style={{ color: '#52c41a' }} />
                    <Text strong>2. Commission Calculation Logic</Text>
                  </Space>
                }
                key="2"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Configure how marketplace commission is calculated and rounded.
                </Paragraph>
                <Alert
                  message="Commission Type & Value"
                  description={
                    <Text>
                      Commission type and value are configured in{' '}
                      <strong>Global Settlement Settings</strong> and can be overridden per seller
                      in <strong>Seller Settlement Settings</strong>. This section only controls how
                      commission amounts are rounded and calculated.
                    </Text>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Commission Rounding Mode"
                      name="commissionRoundingMode"
                      rules={[{ required: true, message: 'Commission rounding mode is required' }]}
                      tooltip="Controls how marketplace commission amounts are rounded. This affects the commission deducted from seller payouts, shown in settlement batches, and displayed in seller ledgers."
                    >
                      <Select>
                        <Select.Option value="ROUND_HALF_UP">Round Half Up</Select.Option>
                        <Select.Option value="ROUND_HALF_DOWN">Round Half Down</Select.Option>
                        <Select.Option value="ROUND_UP">Round Up</Select.Option>
                        <Select.Option value="ROUND_DOWN">Round Down</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="includeShippingInSaleAmount"
                      valuePropName="checked"
                      tooltip="If enabled, commission is calculated on both item price and shipping charges. If disabled, commission is calculated only on item price (shipping excluded from commission base). This directly affects how much commission is deducted from sellers."
                    >
                      <Switch
                        checkedChildren="Include Shipping in Commission Base"
                        unCheckedChildren="Exclude Shipping from Commission Base"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Alert
                  type="info"
                  style={{ marginTop: 16 }}
                  message="Commission Calculation Formula"
                  description={
                    <div>
                      <Text>
                        <strong>If PERCENTAGE:</strong> Commission = (Sale Amount × Commission
                        Value) / 100
                      </Text>
                      <br />
                      <Text>
                        <strong>If FIXED:</strong> Commission = Commission Value
                      </Text>
                      <br />
                      <Text>
                        <strong>Sale Amount:</strong>{' '}
                        {form.getFieldValue('includeShippingInSaleAmount')
                          ? 'Subtotal + Shipping'
                          : 'Subtotal Only'}
                      </Text>
                      <br />
                      <Text>
                        <strong>Final Commission:</strong> Round(Commission,{' '}
                        {form.getFieldValue('commissionRoundingMode') || 'ROUND_HALF_UP'})
                      </Text>
                    </div>
                  }
                />
              </Panel>

              {/* 3. FEE CALCULATION */}
              <Panel
                header={
                  <Space>
                    <SettingOutlined style={{ color: '#faad14' }} />
                    <Text strong>3. Fee Calculation Logic</Text>
                  </Space>
                }
                key="3"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Configure how courier, COD, and payment gateway fees are calculated.
                </Paragraph>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Courier Fee Calculation Method"
                      name="courierFeeCalculationMethod"
                      rules={[{ required: true }]}
                      tooltip="AWB-Wise: Sums courier charges from all shipments if an order has multiple shipments. Order-Wise: Uses a single courier charge for the entire order. This affects how much courier cost is deducted from seller payouts in settlement batches."
                    >
                      <Select>
                        <Select.Option value="AWB_WISE">
                          AWB-Wise (Sum of all shipments)
                        </Select.Option>
                        <Select.Option value="ORDER_WISE">Order-Wise (Single charge)</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="COD Fee Calculation Method"
                      name="codFeeCalculationMethod"
                      rules={[{ required: true }]}
                      tooltip="AWB-Wise: Sums COD charges from all shipments if a COD order has multiple shipments. Order-Wise: Uses a single COD charge for the entire order. This affects how much COD fee is deducted from seller payouts in settlement batches."
                    >
                      <Select>
                        <Select.Option value="AWB_WISE">
                          AWB-Wise (Sum of all shipments)
                        </Select.Option>
                        <Select.Option value="ORDER_WISE">Order-Wise (Single charge)</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      label="PG Fee Calculation Method"
                      name="pgFeeCalculationMethod"
                      rules={[{ required: true }]}
                      tooltip="From Payment Meta: Uses the payment gateway fee stored with the order (current default). Percentage: Calculates as a percentage of order total. Fixed: Uses a fixed amount per order. This affects how much payment gateway fee is deducted from seller payouts."
                    >
                      <Select>
                        <Select.Option value="FROM_PAYMENT_META">
                          From Payment Meta (Default)
                        </Select.Option>
                        <Select.Option value="PERCENTAGE">Percentage of Order Total</Select.Option>
                        <Select.Option value="FIXED">Fixed Amount</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  {pgFeeMethod === 'PERCENTAGE' && (
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="PG Fee Percentage"
                        name="pgFeePercentage"
                        tooltip="Enter the percentage of order total to charge as payment gateway fee (0-100). Only used when PG Fee Calculation Method is set to 'Percentage'."
                      >
                        <InputNumber min={0} max={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  )}
                  {pgFeeMethod === 'FIXED' && (
                    <Col xs={24} md={8}>
                      <Form.Item
                        label="PG Fee Fixed Amount (₹)"
                        name="pgFeeFixedAmount"
                        tooltip="Enter the fixed payment gateway fee amount in ₹. Only used when PG Fee Calculation Method is set to 'Fixed'."
                      >
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="includeShippingInNetAmount"
                      valuePropName="checked"
                      tooltip="If enabled, shipping charges collected from customers are added to the seller's net payout amount. If disabled, only item sale amounts contribute to seller payout (shipping earnings excluded)."
                    >
                      <Switch
                        checkedChildren="Include Shipping in Net Amount"
                        unCheckedChildren="Exclude Shipping from Net Amount"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* 4. ROUNDING SETTINGS */}
              <Panel
                header={
                  <Space>
                    <CalculatorOutlined style={{ color: '#722ed1' }} />
                    <Text strong>4. Rounding Settings</Text>
                  </Space>
                }
                key="4"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Configure rounding modes for different types of amounts in settlement
                  calculations.
                </Paragraph>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Settlement Amount Rounding"
                      name="settlementAmountRoundingMode"
                      rules={[{ required: true }]}
                      tooltip="Controls how the final settlement payout amount (total amount paid to seller) is rounded. This appears in settlement batches, seller payout reports, and settlement invoices."
                    >
                      <Select>
                        <Select.Option value="ROUND_HALF_UP">
                          Round Half Up (Standard)
                        </Select.Option>
                        <Select.Option value="ROUND_HALF_DOWN">Round Half Down</Select.Option>
                        <Select.Option value="ROUND_UP">Round Up</Select.Option>
                        <Select.Option value="ROUND_DOWN">Round Down</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Fee Rounding Mode"
                      name="feeRoundingMode"
                      rules={[{ required: true }]}
                      tooltip="Controls how courier fees, COD fees, and payment gateway fees are rounded. This affects the fee amounts deducted from seller payouts, shown in settlement batches, and recorded in seller ledgers."
                    >
                      <Select>
                        <Select.Option value="ROUND_HALF_UP">
                          Round Half Up (Standard)
                        </Select.Option>
                        <Select.Option value="ROUND_HALF_DOWN">Round Half Down</Select.Option>
                        <Select.Option value="ROUND_UP">Round Up</Select.Option>
                        <Select.Option value="ROUND_DOWN">Round Down</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="TDS Rounding Mode"
                      name="tdsRoundingMode"
                      rules={[{ required: true }]}
                      tooltip="Controls how Tax Deducted at Source (TDS) amounts are rounded. TDS is deducted from seller payouts per tax compliance requirements. This affects the TDS amount shown in settlement batches, tax reports, and seller payouts."
                    >
                      <Select>
                        <Select.Option value="ROUND_HALF_UP">
                          Round Half Up (Standard)
                        </Select.Option>
                        <Select.Option value="ROUND_HALF_DOWN">Round Half Down</Select.Option>
                        <Select.Option value="ROUND_UP">Round Up</Select.Option>
                        <Select.Option value="ROUND_DOWN">Round Down</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="TCS Rounding Mode"
                      name="tcsRoundingMode"
                      rules={[{ required: true }]}
                      tooltip="Controls how Tax Collected at Source (TCS) amounts are rounded. TCS is deducted from seller payouts per GST compliance requirements. This affects the TCS amount shown in settlement batches, GST reports, and seller payouts."
                    >
                      <Select>
                        <Select.Option value="ROUND_HALF_UP">
                          Round Half Up (Standard)
                        </Select.Option>
                        <Select.Option value="ROUND_HALF_DOWN">Round Half Down</Select.Option>
                        <Select.Option value="ROUND_UP">Round Up</Select.Option>
                        <Select.Option value="ROUND_DOWN">Round Down</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* 5. LEDGER CALCULATION SETTINGS */}
              <Panel
                header={
                  <Space>
                    <FileTextOutlined style={{ color: '#13c2c2' }} />
                    <Text strong>5. Ledger Entry Calculation</Text>
                  </Space>
                }
                key="5"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Control when ledger entries are created and how amounts are rounded.
                </Paragraph>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="createLedgerEntriesOnEligibility"
                      valuePropName="checked"
                      tooltip="If enabled, seller ledger entries (credits and debits) are created immediately when an order becomes eligible for settlement. Settlement batch totals are calculated by aggregating these ledger entries, so entries must exist before batch generation. This also allows sellers to see their balance updates in real-time."
                    >
                      <Switch
                        checkedChildren="Create on Eligibility"
                        unCheckedChildren="Do Not Create on Eligibility"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="createLedgerEntriesOnBatchCreation"
                      valuePropName="checked"
                      tooltip="If enabled, seller ledger entries are created only when settlement batches are finalized. This ensures entries exist only for orders actually included in settlement batches. Note: This is an alternative to creating entries on eligibility. Currently, entries are only created when orders become eligible."
                    >
                      <Switch
                        checkedChildren="Create on Batch Creation"
                        unCheckedChildren="Do Not Create on Batch"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Ledger Entry Rounding Mode"
                      name="ledgerEntryRoundingMode"
                      rules={[{ required: true }]}
                      tooltip="Controls how individual ledger entry amounts are rounded. When settlement batches are generated, all ledger entries are summed up (item earnings, shipping, commission, fees, etc.) to calculate batch totals. This rounding mode affects each entry before it's aggregated, which impacts the final settlement payout amount."
                    >
                      <Select>
                        <Select.Option value="ROUND_HALF_UP">
                          Round Half Up (Standard)
                        </Select.Option>
                        <Select.Option value="ROUND_HALF_DOWN">Round Half Down</Select.Option>
                        <Select.Option value="ROUND_UP">Round Up</Select.Option>
                        <Select.Option value="ROUND_DOWN">Round Down</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="roundLedgerEntriesBeforeStorage"
                      valuePropName="checked"
                      tooltip="If enabled, all ledger entry amounts are rounded before being saved to the database. This setting works together with 'Round Each Entry Individually' - when both are enabled, entries are rounded using the 'Ledger Entry Rounding Mode' before storage. Since settlement batches calculate totals by summing stored ledger entries, rounding before storage affects the aggregated totals and final payout amount."
                    >
                      <Switch
                        checkedChildren="Round Before Storage"
                        unCheckedChildren="Store Exact Amounts"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="roundLedgerEntriesIndividually"
                      valuePropName="checked"
                      tooltip="If enabled, each ledger entry amount is rounded individually using the 'Ledger Entry Rounding Mode' before being aggregated into settlement batch totals. Settlement batches sum all ledger entries to calculate totals (item earnings, shipping, commission, fees), so rounding each entry affects the final payout amount. If disabled, exact calculated amounts are used in aggregation."
                    >
                      <Switch
                        checkedChildren="Round Each Entry Individually"
                        unCheckedChildren="No Individual Rounding"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="roundLedgerAggregation"
                      valuePropName="checked"
                      tooltip="If enabled, after all ledger entries are summed up by type (total item earnings, total shipping, total commission, total fees, etc.), these aggregated totals are rounded before calculating the final settlement payout. Settlement batches calculate: Total Credits (item earnings + shipping + reversals) minus Total Debits (commission + fees + TDS + TCS). Rounding these aggregated totals affects the final payout amount shown in settlement batches."
                    >
                      <Switch
                        checkedChildren="Round Aggregated Totals"
                        unCheckedChildren="No Aggregation Rounding"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                {roundLedgerAggregation && (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label="Ledger Aggregation Rounding Mode"
                        name="ledgerAggregationRoundingMode"
                        rules={[{ required: true }]}
                        tooltip="Controls how aggregated totals are rounded when 'Round Aggregated Totals' is enabled. Settlement batches sum all ledger entries to get totals like: total item earnings, total shipping earned, total commission, total fees, etc. This rounding mode is applied to these summed totals before calculating the final payout (Total Credits - Total Debits). This directly affects the settlement payout amount."
                      >
                        <Select>
                          <Select.Option value="ROUND_HALF_UP">
                            Round Half Up (Standard)
                          </Select.Option>
                          <Select.Option value="ROUND_HALF_DOWN">Round Half Down</Select.Option>
                          <Select.Option value="ROUND_UP">Round Up</Select.Option>
                          <Select.Option value="ROUND_DOWN">Round Down</Select.Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                )}
              </Panel>

              {/* 6. CALCULATION METHOD */}
              <Panel
                header={
                  <Space>
                    <CalculatorOutlined style={{ color: '#eb2f96' }} />
                    <Text strong>6. Calculation Method</Text>
                  </Space>
                }
                key="6"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Control the calculation method for settlement amounts.
                </Paragraph>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Net Amount Calculation Method"
                      name="netAmountCalculationMethod"
                      rules={[{ required: true }]}
                      tooltip="Credits Minus Debits: Sum all credits (sale + shipping), sum all debits (commission + fees), then subtract. Sale Minus All: Start with sale amount (+ shipping if included), then subtract commission and fees. This affects how the final seller payout amount is calculated in settlement batches."
                    >
                      <Select>
                        <Select.Option value="CREDITS_MINUS_DEBITS">
                          Credits Minus Debits (Recommended)
                        </Select.Option>
                        <Select.Option value="SALE_MINUS_ALL">
                          Sale Amount Minus All Deductions
                        </Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* 7. SETTLEMENT BATCH GENERATION */}
              <Panel
                header={
                  <Space>
                    <BankOutlined style={{ color: '#f5222d' }} />
                    <Text strong>7. Settlement Batch Generation</Text>
                  </Space>
                }
                key="7"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Control when settlement batches are generated and what orders are included.
                </Paragraph>
                <Alert
                  message="Minimum Settlement Amount"
                  description={
                    <Text>
                      Minimum settlement amount is configured in{' '}
                      <strong>Global Settlement Settings</strong> (minBatchAmount) and can be
                      overridden per seller in <strong>Seller Settlement Settings</strong>.
                    </Text>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="allowNegativeSettlements"
                      valuePropName="checked"
                      tooltip="If enabled, settlement batches can have negative payout amounts (meaning seller owes money to the platform). If disabled, negative amounts are clamped to zero in the batch payout, but the negative balance can still be tracked via carry-forward entries (if 'Create Carry-Forward on Clamp' is enabled). This affects whether sellers can have negative payout amounts in settlement batches."
                    >
                      <Switch
                        checkedChildren="Allow Negative Settlements"
                        unCheckedChildren="Clamp to Zero"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="createCarryForwardOnNegativeClamp"
                      valuePropName="checked"
                      tooltip="If enabled and 'Allow Negative Settlements' is disabled, when a settlement batch would have a negative payout, a carry-forward ledger entry is created to track the debt before clamping the payout to zero. This ensures the negative balance is deducted from the next settlement batch. If disabled, negative balances are lost when clamping to zero."
                    >
                      <Switch
                        checkedChildren="Create Carry-Forward on Clamp"
                        unCheckedChildren="No Carry-Forward on Clamp"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="includeUnlinkedLedgerEntries"
                      valuePropName="checked"
                      tooltip="If enabled, unlinked ledger entries (such as refunds or manual adjustments created after a previous settlement) are included in new settlement batches. If disabled, only entries linked to orders in the batch are included. This affects which transactions contribute to settlement batch totals."
                    >
                      <Switch
                        checkedChildren="Include Unlinked Entries"
                        unCheckedChildren="Exclude Unlinked Entries"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="includePreviousNegativeBalances"
                      valuePropName="checked"
                      tooltip="If enabled, negative balances from previous settlement batches are automatically included (carried forward) in the current settlement batch. If disabled, previous negative balances are excluded. This affects whether sellers' past negative balances are deducted from their current payout."
                    >
                      <Switch
                        checkedChildren="Include Previous Negative Balances"
                        unCheckedChildren="Exclude Previous Negative Balances"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* 8. TDS/TCS CALCULATION */}
              <Panel
                header={
                  <Space>
                    <FileTextOutlined style={{ color: '#fa8c16' }} />
                    <Text strong>8. TDS & TCS Calculation Logic</Text>
                  </Space>
                }
                key="8"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Control when and how TDS (Tax Deducted at Source) and TCS (Tax Collected at
                  Source) are calculated.
                </Paragraph>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="calculateTdsAtBatchLevel"
                      valuePropName="checked"
                      tooltip="If enabled, Tax Deducted at Source (TDS) is calculated at the settlement batch level based on total gross sales in the batch, as per Section 194-O requirements (0.1% on gross sales). TDS is then deducted from seller payouts. Recommended: Keep enabled for tax compliance."
                    >
                      <Switch
                        checkedChildren="Calculate TDS at Batch Level (Recommended)"
                        unCheckedChildren="Calculate TDS at Order Level"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="calculateTcsAtBatchLevel"
                      valuePropName="checked"
                      tooltip="If enabled, Tax Collected at Source (TCS) is calculated at the settlement batch level, as per GST Section 52 requirements (1% IGST for inter-state orders, 0.5% CGST + 0.5% SGST for intra-state orders). TCS is then deducted from seller payouts. Recommended: Keep enabled for GST compliance."
                    >
                      <Switch
                        checkedChildren="Calculate TCS at Batch Level (Recommended)"
                        unCheckedChildren="Calculate TCS at Order Level"
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>

              {/* 9. REFUND & RETURN HANDLING */}
              <Panel
                header={
                  <Space>
                    <SettingOutlined style={{ color: '#2f54eb' }} />
                    <Text strong>
                      9. Refund & Return Handling Logic ( What Happens on Refunds/Returns)
                    </Text>
                  </Space>
                }
                key="9"
              >
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Control how refunds and returns affect settlement calculations and ledger entries.
                </Paragraph>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="reverseCommissionOnReturn"
                      valuePropName="checked"
                      tooltip="If enabled, when an order or item is returned, the marketplace commission previously deducted is credited back to the seller's ledger. If disabled, commission is kept even when items are returned. This affects seller balance and payout calculations."
                    >
                      <Switch
                        checkedChildren="Reverse Commission on Return"
                        unCheckedChildren="Keep Commission on Return"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="reverseShippingOnReturn"
                      valuePropName="checked"
                      tooltip="If enabled, when an order or item is returned, the shipping earnings previously credited to the seller are reversed (debited back). If disabled, sellers keep shipping earnings even when items are returned. This affects seller balance and payout calculations."
                    >
                      <Switch
                        checkedChildren="Reverse Shipping on Return"
                        unCheckedChildren="Keep Shipping on Return"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="reverseCourierCostOnReturn"
                      valuePropName="checked"
                      tooltip="If enabled, when an order is returned, the courier cost that was previously deducted from the seller is credited back. If disabled, sellers continue to bear the courier cost even on returns. Note: Typically kept disabled as sellers have already paid the courier for the forward shipment."
                    >
                      <Switch
                        checkedChildren="Reverse Courier Cost on Return"
                        unCheckedChildren="Keep Courier Cost on Return"
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Refund Calculation Method"
                      name="refundCalculationMethod"
                      rules={[{ required: true }]}
                      tooltip="Proportional: Refund amount is calculated based on the quantity returned (e.g., if 2 of 4 items are returned, refund is 50% of the original amount). Full: Full refund is given regardless of returned quantity. This affects how refund amounts are calculated and recorded in seller ledgers when orders or items are returned."
                    >
                      <Select>
                        <Select.Option value="PROPORTIONAL">
                          Proportional (Recommended)
                        </Select.Option>
                        <Select.Option value="FULL">Full Refund</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </Panel>
            </Collapse>

            <Divider />

            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateSettlement.isPending}
                size="large"
              >
                Save All Settlement Calculation Settings
              </Button>
              <Button onClick={handleReset} disabled={updateSettlement.isPending} size="large">
                Reset
              </Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  )
}

export default SettlementCalculationSettings
