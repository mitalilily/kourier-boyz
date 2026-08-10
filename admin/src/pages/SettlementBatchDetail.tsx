import {
  App,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import dayjs from 'dayjs'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useCreateManualAdjustment,
  useGenerateSettlementInvoice,
  useMarkSettlementBatchPaid,
  useSellerLedger,
  useSettlementBatchDetail,
} from '../api/settlementQueries'
import type { SellerLedgerEntryDto } from '../api/settlements'

const { Title, Text } = Typography

const SettlementBatchDetail = () => {
  const { id } = useParams<{ id: string }>()
  const { message } = App.useApp()
  const { data, isLoading } = useSettlementBatchDetail(id)
  const markPaid = useMarkSettlementBatchPaid()
  const generateInvoice = useGenerateSettlementInvoice()
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [adjustmentForm] = Form.useForm()
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false)
  const createAdjustment = useCreateManualAdjustment()

  const batch = data?.data.batch
  const orders = data?.data.orders || []
  const sellerId = batch?.seller?._id

  // Fetch ledger entries for this seller to show credit/debit notes
  const { data: ledgerData } = useSellerLedger(sellerId, !!sellerId)

  // Filter ledger entries for this batch
  const batchLedgerEntries =
    ledgerData?.data?.entries?.filter((entry) => entry.settlementBatch?._id === id) || []

  const totals = orders.reduce(
    (acc, order) => {
      const sale =
        typeof (order as { sellerSaleAmount?: number }).sellerSaleAmount === 'number'
          ? (order as { sellerSaleAmount?: number }).sellerSaleAmount!
          : 0
      const commission =
        typeof (order as { sellerCommissionAmount?: number }).sellerCommissionAmount === 'number'
          ? (order as { sellerCommissionAmount?: number }).sellerCommissionAmount!
          : 0
      const net =
        typeof (order as { sellerNetAmount?: number }).sellerNetAmount === 'number'
          ? (order as { sellerNetAmount?: number }).sellerNetAmount!
          : 0
      const platformDiscount =
        typeof (order as { discountAmount?: number }).discountAmount === 'number'
          ? (order as { discountAmount?: number }).discountAmount!
          : 0
      acc.totalSale += sale
      acc.totalCommission += commission
      acc.totalNet += net
      acc.totalPlatformDiscount += platformDiscount
      return acc
    },
    { totalSale: 0, totalCommission: 0, totalNet: 0, totalPlatformDiscount: 0 },
  )

  if (!id) {
    return null
  }

  const handleMarkPaid = () => {
    if (!batch) return
    const currentPaidAmount = batch.paidAmount || 0
    const remainingAmount = batch.totalNetPayout - currentPaidAmount

    form.setFieldsValue({
      amountPaid: remainingAmount > 0 ? remainingAmount : undefined,
      paymentDate: dayjs().format('YYYY-MM-DD'),
      paymentReference: batch.paymentReference || batch.payoutReference || '',
      paymentMethod: batch.paymentMethod || '',
      // Legacy fields for backward compatibility
      payoutDate: dayjs().format('YYYY-MM-DD'),
      payoutReference: batch.payoutReference || '',
      payoutNotes: batch.payoutNotes || '',
    })
    setMarkPaidModalOpen(true)
  }

  const handleSubmitMarkPaid = async () => {
    try {
      const values = await form.validateFields()

      // Show detailed success message with payment information
      const response = await markPaid.mutateAsync({
        id: id!,
        payload: {
          amountPaid: values.amountPaid,
          paymentMethod: values.paymentMethod,
          paymentReference: values.paymentReference,
          paymentDate: values.paymentDate,
          // Legacy fields for backward compatibility
          payoutDate: values.payoutDate || values.paymentDate,
          payoutReference: values.payoutReference,
          payoutNotes: values.payoutNotes,
        },
      })

      // Extract details from response if available
      const details = (
        response as {
          details?: { paidAmount?: number; totalNetPayout?: number; isFullyPaid?: boolean }
        }
      )?.details
      const currentPaidAmount = details?.paidAmount || batch?.paidAmount || 0
      const totalNetPayout = details?.totalNetPayout || batch?.totalNetPayout || 0
      const isFullyPaid =
        details?.isFullyPaid || Math.abs(currentPaidAmount - totalNetPayout) < 0.01

      message.success({
        content: (
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              ✅ Payment Recorded Successfully
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
              • Amount: ₹{values.amountPaid.toFixed(2)}
              <br />
              • SETTLEMENT_PAYOUT ledger entry created (money outflow from platform)
              <br />•{' '}
              {isFullyPaid
                ? 'Settlement fully paid - seller notified'
                : `Remaining: ₹${(totalNetPayout - currentPaidAmount).toFixed(2)}`}
            </div>
          </div>
        ),
        duration: 6,
      })
      setMarkPaidModalOpen(false)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    }
  }

  // Derive payment status from paidAmount (not from status field)
  const getPaymentStatus = () => {
    if (!batch) return { label: 'Unknown', color: 'default' }

    const totalNetPayout = batch.totalNetPayout
    const paidAmount = batch.paidAmount || 0

    if (totalNetPayout <= 0) {
      return { label: 'No payout (negative balance)', color: 'red' }
    }

    if (paidAmount === 0) {
      return { label: 'Not paid', color: 'orange' }
    }

    if (Math.abs(paidAmount - totalNetPayout) < 0.01) {
      return { label: 'Fully paid', color: 'green' }
    }

    if (paidAmount < totalNetPayout) {
      return {
        label: `Partially paid (₹${paidAmount.toFixed(2)} / ₹${totalNetPayout.toFixed(2)})`,
        color: 'blue',
      }
    }

    return { label: 'Overpaid', color: 'red' }
  }

  const handleOpenAdjustmentModal = () => {
    adjustmentForm.resetFields()
    setAdjustmentModalOpen(true)
  }

  const handleSubmitAdjustment = async () => {
    try {
      if (!batch) return
      const values = await adjustmentForm.validateFields()
      await createAdjustment.mutateAsync({
        sellerId: batch.seller._id,
        payload: {
          type: values.type,
          amount: Number(values.amount),
          description: values.description,
          order_id: values.orderId || undefined,
          batchId: id,
        },
        batchId: id,
      })
      message.success('Manual adjustment added')
      setAdjustmentModalOpen(false)
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message)
      }
    }
  }

  const columns = [
    {
      title: 'Order ID',
      dataIndex: '_id',
    },
    {
      title: 'Order Number',
      dataIndex: 'orderNumber',
    },
    {
      title: 'Order Date',
      dataIndex: 'createdAt',
      render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
    },
    {
      title: 'Order Total (paid by customer)',
      dataIndex: 'total',
      render: (value: number) => `₹${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Platform Cart Discount',
      dataIndex: 'discountAmount',
      render: (value: number) => `₹${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Sale Amount (after seller discounts)',
      dataIndex: 'sellerSaleAmount',
      render: (value: number) => `₹${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Commission',
      dataIndex: 'sellerCommissionAmount',
      render: (value: number) => `₹${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Net Amount',
      dataIndex: 'sellerNetAmount',
      render: (value: number) => `₹${(value || 0).toFixed(2)}`,
    },
    {
      title: 'Settlement Status',
      dataIndex: 'settlementStatus',
      render: (value: string) => <Tag>{value || 'N/A'}</Tag>,
    },
  ]

  if (isLoading) {
    return <Text>Loading...</Text>
  }

  if (!batch) {
    return <Text>Batch not found</Text>
  }

  const sellerObj = batch.seller || {}
  const sellerName = sellerObj.businessName || sellerObj.name || 'Seller'

  return (
    <Space direction="vertical" size="large" className="w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Title level={4} className="mb-0">
            Settlement Batch #{batch._id}
          </Title>
          <Text type="secondary">
            Seller:{' '}
            {sellerId ? (
              <Link to={`/sellers/${sellerId}`} className="font-semibold text-slate-900">
                {sellerName}
              </Link>
            ) : (
              <span className="font-semibold text-slate-900">{sellerName}</span>
            )}{' '}
            • Created {dayjs(batch.createdAt).format('DD MMM YYYY, HH:mm')}
          </Text>
        </div>
        <Space>
          {batch.invoiceUrl && (
            <Button
              onClick={() => {
                window.open(batch.invoiceUrl, '_blank', 'noopener,noreferrer')
              }}
            >
              Download Invoice
            </Button>
          )}
          {(() => {
            const paidAmount = batch.paidAmount || 0
            const remainingAmount = batch.totalNetPayout - paidAmount
            const canRecordPayment = batch.totalNetPayout > 0 && remainingAmount > 0.01

            if (canRecordPayment) {
              return (
                <Button type="primary" onClick={handleMarkPaid} loading={markPaid.isPending}>
                  {paidAmount > 0 ? 'Record Payment' : 'Mark as Paid'}
                </Button>
              )
            }
            return null
          })()}
          {batch.status === 'PAID' && (
            <Button
              onClick={async () => {
                try {
                  await generateInvoice.mutateAsync(id!)
                  message.success('Invoice regenerated successfully')
                } catch (error) {
                  message.error(
                    (error as Error)?.message || 'Failed to regenerate settlement invoice',
                  )
                }
              }}
              loading={generateInvoice.isPending}
            >
              Regenerate Invoice
            </Button>
          )}
          <Button onClick={handleOpenAdjustmentModal}>Add Manual Adjustment</Button>
        </Space>
      </div>

      <Card title="Summary">
        <Descriptions column={2} labelStyle={{ fontWeight: 500 }}>
          {batch.invoiceNumber && (
            <Descriptions.Item label="Invoice Number">{batch.invoiceNumber}</Descriptions.Item>
          )}
          <Descriptions.Item label="Period">
            {dayjs(batch.fromDate).format('DD MMM YYYY')} –{' '}
            {dayjs(batch.toDate).format('DD MMM YYYY')}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={batch.status === 'PAID' ? 'green' : 'orange'}>{batch.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Payment Status">
            <Tag color={getPaymentStatus().color}>{getPaymentStatus().label}</Tag>
          </Descriptions.Item>
          {batch.paidAmount !== undefined && batch.paidAmount > 0 && (
            <>
              <Descriptions.Item label="Paid Amount">
                <Text strong>₹{(batch.paidAmount || 0).toFixed(2)}</Text>
                <Text type="secondary" style={{ fontSize: '11px', marginLeft: 8 }}>
                  (SETTLEMENT_PAYOUT ledger entries)
                </Text>
              </Descriptions.Item>
              {batch.paidAt && (
                <Descriptions.Item label="Last Payment Date">
                  {dayjs(batch.paidAt).format('DD MMM YYYY, HH:mm')}
                </Descriptions.Item>
              )}
              {batch.paymentReference && (
                <Descriptions.Item label="Payment Reference">
                  {batch.paymentReference}
                </Descriptions.Item>
              )}
              {batch.paymentMethod && (
                <Descriptions.Item label="Payment Method">{batch.paymentMethod}</Descriptions.Item>
              )}
            </>
          )}
          {batch.totalNetPayout > 0 && (batch.paidAmount || 0) < batch.totalNetPayout && (
            <Descriptions.Item label="Payment Status Note">
              <Text type="secondary" style={{ fontSize: '12px' }}>
                💡 Recording a payment creates a SETTLEMENT_PAYOUT ledger entry representing money
                outflow from platform to seller.
              </Text>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Orders Count">{batch.ordersCount}</Descriptions.Item>
          <Descriptions.Item label="Total Sale Amount">
            ₹{batch.totalSaleAmount.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Total Commission">
            ₹{batch.totalCommissionAmount.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Other Charges">
            ₹{batch.totalOtherCharges.toFixed(2)}
          </Descriptions.Item>
          <Descriptions.Item label="Total Net Payout">
            <Text strong>₹{batch.totalNetPayout.toFixed(2)}</Text>
          </Descriptions.Item>
          {batch.payoutDate && (
            <Descriptions.Item label="Payout Date">
              {dayjs(batch.payoutDate).format('DD MMM YYYY, HH:mm')}
            </Descriptions.Item>
          )}
          {batch.payoutReference && (
            <Descriptions.Item label="Payout Reference">{batch.payoutReference}</Descriptions.Item>
          )}
          {batch.payoutNotes && (
            <Descriptions.Item label="Payout Notes">{batch.payoutNotes}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="Ledger Breakdown">
        {(() => {
          const itemEarnings = batch.totalItemEarnings ?? totals.totalSale
          const shippingEarned = batch.totalShippingEarned ?? 0
          const commissionReversal = batch.totalCommissionReversal ?? 0
          const commission = batch.totalCommissionAmount
          const courierCost = batch.totalCourierCostDeducted ?? 0
          const pgFee = batch.totalPgFee ?? 0
          const tdsAmount = batch.totalTdsAmount ?? 0
          const tcsAmount = batch.totalTcsAmount ?? 0
          const otherCharges = batch.totalOtherCharges ?? 0
          const manualCredits = batch.totalManualAdjustmentsCredit ?? 0
          const manualDebits = batch.totalManualAdjustmentsDebit ?? 0

          // Calculate total credits (money seller earns)
          const totalCredits = itemEarnings + shippingEarned + commissionReversal + manualCredits

          // Calculate total debits (money deducted from seller)
          const totalDebits = commission + otherCharges + manualDebits + tdsAmount + tcsAmount

          // Validate: Net Payout must equal Credits - Debits
          // Note: totalNetPayout is rounded in the backend using settlementAmountRoundingMode,
          // which can cause small differences due to rounding. We allow a tolerance of 0.50 (half rupee)
          // to account for rounding differences when rounding to nearest rupee or 2 decimal places.
          const calculatedNetPayout = totalCredits - totalDebits
          const netPayoutMatches = Math.abs(batch.totalNetPayout - calculatedNetPayout) < 0.5

          return (
            <>
              <Descriptions column={3} labelStyle={{ fontWeight: 500 }}>
                <Descriptions.Item label="Total Credits">
                  <Text strong>₹{totalCredits.toFixed(2)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Total Debits">
                  <Text strong>₹{totalDebits.toFixed(2)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Net Payout">
                  <Text
                    strong
                    type={batch.totalNetPayout < 0 ? 'danger' : 'success'}
                    style={{
                      color: batch.totalNetPayout < 0 ? '#dc2626' : undefined,
                    }}
                  >
                    ₹{batch.totalNetPayout.toFixed(2)}
                    {batch.totalNetPayout < 0 && (
                      <span style={{ fontSize: 12, marginLeft: 8, fontWeight: 'normal' }}>
                        (Negative balance)
                      </span>
                    )}
                    {!netPayoutMatches && (
                      <span
                        style={{
                          fontSize: 12,
                          marginLeft: 8,
                          fontWeight: 'normal',
                          color: '#dc2626',
                        }}
                      >
                        ⚠️ Calculation mismatch
                      </span>
                    )}
                  </Text>
                </Descriptions.Item>
              </Descriptions>

              <Descriptions column={2} labelStyle={{ fontWeight: 500 }} className="mt-4">
                <Descriptions.Item label="ORDER_EARNING (credits)">
                  ₹{itemEarnings.toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="SHIPPING_EARNING (credits)">
                  ₹{shippingEarned.toFixed(2)}
                </Descriptions.Item>
                {commissionReversal > 0 && (
                  <Descriptions.Item label="COMMISSION_REVERSAL (credits)">
                    ₹{commissionReversal.toFixed(2)}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="COMMISSION (debits)">
                  ₹{commission.toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="SHIPPING_COURIER_COST (debits)">
                  ₹{courierCost.toFixed(2)}
                </Descriptions.Item>
                <Descriptions.Item label="PG_FEE (debits)">₹{pgFee.toFixed(2)}</Descriptions.Item>
                {tdsAmount > 0 && (
                  <Descriptions.Item label="TDS_DEBIT (debits)">
                    ₹{tdsAmount.toFixed(2)}
                  </Descriptions.Item>
                )}
                {tcsAmount > 0 && (
                  <Descriptions.Item label="TCS_DEBIT (debits)">
                    ₹{tcsAmount.toFixed(2)}
                  </Descriptions.Item>
                )}
                {manualCredits > 0 && (
                  <Descriptions.Item label="MANUAL_ADJUSTMENT (CREDIT)">
                    <Text type="success">+₹{manualCredits.toFixed(2)}</Text>
                  </Descriptions.Item>
                )}
                {manualDebits > 0 && (
                  <Descriptions.Item label="MANUAL_ADJUSTMENT (DEBIT)">
                    <Text type="danger">-₹{manualDebits.toFixed(2)}</Text>
                  </Descriptions.Item>
                )}
                {manualCredits === 0 && manualDebits === 0 && (
                  <Descriptions.Item label="MANUAL_ADJUSTMENTS">₹0.00</Descriptions.Item>
                )}
                <Descriptions.Item label="Platform Discounts (info only)">
                  ₹{totals.totalPlatformDiscount.toFixed(2)}
                </Descriptions.Item>
              </Descriptions>

              <div className="mt-3 text-xs text-slate-500">
                <div>
                  <strong>Formula:</strong> Net Payout = (Item Earnings + Shipping Earned +
                  Commission Reversal + Manual Adjustment Credits) − (Commission + Other Charges +
                  Manual Adjustment Debits + TDS + TCS)
                </div>
                <div>
                  Where Other Charges = Courier Cost + PG Fee + Return Reversals + COD Fees (net)
                </div>
                <div>
                  COD fees are platform-funded and are <strong>not</strong> deducted from this
                  batch.
                </div>
              </div>
            </>
          )
        })()}
      </Card>

      <Card title="Orders in this batch">
        <Table rowKey="_id" dataSource={orders} columns={columns} pagination={false} />
      </Card>

      {batchLedgerEntries.length > 0 && (
        <Card title="Ledger Entries with Credit/Debit Notes">
          <Table
            rowKey="_id"
            dataSource={batchLedgerEntries}
            pagination={false}
            columns={[
              {
                title: 'Date',
                dataIndex: 'createdAt',
                render: (value: string) => dayjs(value).format('DD MMM YYYY, HH:mm'),
                width: 180,
              },
              {
                title: 'Type',
                dataIndex: 'entryType',
                render: (value: 'CREDIT' | 'DEBIT') => (
                  <Tag color={value === 'CREDIT' ? 'green' : 'red'}>{value}</Tag>
                ),
                width: 100,
              },
              {
                title: 'Reason',
                dataIndex: 'reasonLabel',
                render: (label: string, record: SellerLedgerEntryDto) => (
                  <div>
                    <div>{label || record.reason}</div>
                    {record.description && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {record.description}
                      </Text>
                    )}
                  </div>
                ),
              },
              {
                title: 'Amount',
                dataIndex: 'amount',
                render: (value: number, record: SellerLedgerEntryDto) => (
                  <Text strong type={record.entryType === 'CREDIT' ? 'success' : 'danger'}>
                    {record.entryType === 'CREDIT' ? '+' : '-'}₹{value.toFixed(2)}
                  </Text>
                ),
                width: 120,
              },
              {
                title: 'Order',
                dataIndex: ['order', 'orderNumber'],
                render: (orderNumber: string, record: SellerLedgerEntryDto) =>
                  orderNumber ? (
                    <Link to={`/orders/${record.order?._id}`}>{orderNumber}</Link>
                  ) : (
                    <Text type="secondary">—</Text>
                  ),
                width: 150,
              },
              {
                title: 'Credit Note',
                key: 'creditNote',
                width: 200,
                render: (_: unknown, record: SellerLedgerEntryDto) => {
                  if (record.creditNote?.credit_note_url) {
                    const creditNoteUrl = record.creditNote.credit_note_url
                    return (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          if (creditNoteUrl) {
                            window.open(creditNoteUrl, '_blank')
                          }
                        }}
                      >
                        {record.creditNote.credit_note_number || 'View Credit Note'}
                      </Button>
                    )
                  }
                  return <Text type="secondary">—</Text>
                },
              },
              {
                title: 'Debit Note',
                key: 'debitNote',
                width: 200,
                render: (_: unknown, record: SellerLedgerEntryDto) => {
                  if (record.debitNote?.debit_note_url) {
                    const debitNoteUrl = record.debitNote.debit_note_url
                    return (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          if (debitNoteUrl) {
                            window.open(debitNoteUrl, '_blank')
                          }
                        }}
                      >
                        {record.debitNote.debit_note_number || 'View Debit Note'}
                      </Button>
                    )
                  }
                  return <Text type="secondary">—</Text>
                },
              },
            ]}
          />
        </Card>
      )}

      <Modal
        title={batch?.paidAmount && batch.paidAmount > 0 ? 'Record Payment' : 'Mark as Paid'}
        open={markPaidModalOpen}
        onCancel={() => setMarkPaidModalOpen(false)}
        onOk={handleSubmitMarkPaid}
        confirmLoading={markPaid.isPending}
        width={600}
      >
        <Form form={form} layout="vertical">
          {(() => {
            const currentPaidAmount = batch?.paidAmount || 0
            const totalNetPayout = batch?.totalNetPayout || 0
            const remainingAmount = totalNetPayout - currentPaidAmount

            return (
              <>
                {currentPaidAmount > 0 && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: 12,
                      background: '#f0f0f0',
                      borderRadius: 4,
                    }}
                  >
                    <Text strong>Current Payment Status:</Text>
                    <br />
                    <Text>Paid: ₹{currentPaidAmount.toFixed(2)}</Text>
                    <br />
                    <Text>Remaining: ₹{remainingAmount.toFixed(2)}</Text>
                    <br />
                    <Text>Total: ₹{totalNetPayout.toFixed(2)}</Text>
                  </div>
                )}
                <Form.Item
                  name="amountPaid"
                  label="Amount Paid"
                  rules={[
                    { required: true, message: 'Please enter payment amount' },
                    {
                      type: 'number',
                      min: 0.01,
                      message: 'Payment amount must be greater than 0',
                    },
                    {
                      validator: (_, value) => {
                        if (value && value > remainingAmount + 0.01) {
                          return Promise.reject(
                            new Error(
                              `Payment amount cannot exceed remaining amount (₹${remainingAmount.toFixed(
                                2,
                              )})`,
                            ),
                          )
                        }
                        return Promise.resolve()
                      },
                    },
                  ]}
                >
                  <InputNumber
                    min={0.01}
                    max={remainingAmount}
                    style={{ width: '100%' }}
                    formatter={(value) => `₹ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => {
                      const parsed = value!.replace(/₹\s?|(,*)/g, '')
                      return parsed ? parseFloat(parsed) : 0
                    }}
                    placeholder={`Enter amount (max: ₹${remainingAmount.toFixed(2)})`}
                  />
                </Form.Item>
                <Form.Item name="paymentDate" label="Payment Date">
                  <Input placeholder="YYYY-MM-DD" defaultValue={dayjs().format('YYYY-MM-DD')} />
                </Form.Item>
                <Form.Item name="paymentMethod" label="Payment Method">
                  <Select
                    placeholder="Select payment method"
                    allowClear
                    options={[
                      { label: 'Bank Transfer', value: 'bank_transfer' },
                      { label: 'UPI', value: 'upi' },
                      { label: 'NEFT', value: 'neft' },
                      { label: 'RTGS', value: 'rtgs' },
                      { label: 'IMPS', value: 'imps' },
                      { label: 'Other', value: 'other' },
                    ]}
                  />
                </Form.Item>
                <Form.Item name="paymentReference" label="Payment Reference">
                  <Input placeholder="Transaction ID / UPI reference / Bank reference (optional)" />
                </Form.Item>
                {/* Legacy fields (hidden, for backward compatibility) */}
                <Form.Item name="payoutDate" hidden>
                  <Input />
                </Form.Item>
                <Form.Item name="payoutReference" hidden>
                  <Input />
                </Form.Item>
                <Form.Item name="payoutNotes" hidden>
                  <Input />
                </Form.Item>
              </>
            )
          })()}
        </Form>
      </Modal>

      <Modal
        title="Add Manual Adjustment"
        open={adjustmentModalOpen}
        onCancel={() => setAdjustmentModalOpen(false)}
        onOk={handleSubmitAdjustment}
        confirmLoading={createAdjustment.isPending}
      >
        <Form form={adjustmentForm} layout="vertical">
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: 'Please select adjustment type' }]}
          >
            <Select
              options={[
                { label: 'Credit (increase seller payout)', value: 'credit' },
                { label: 'Debit (reduce seller payout)', value: 'debit' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber min={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="orderId" label="Linked Order (optional)">
            <Select
              allowClear
              placeholder="Select order to link this adjustment (optional)"
              options={orders.map((o) => {
                const orderId = (o as { _id: string })._id
                const orderNumber = (o as { orderNumber?: string }).orderNumber
                return {
                  label: orderNumber ? `${orderNumber} (${orderId})` : orderId,
                  value: orderId,
                }
              })}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Reason for adjustment" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}

export default SettlementBatchDetail
