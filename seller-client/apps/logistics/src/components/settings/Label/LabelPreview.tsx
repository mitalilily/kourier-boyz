/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box, Divider, Paper, Stack, Typography } from '@mui/material'
import Barcode from 'react-barcode'
import type { LabelPreferences } from '../../../api/labelPreference.api'

const BLACK = '#111111'
const BORDER = '1px solid #1f1f1f'

const normalize = (value: unknown) => {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value.trim() : `${value}`.trim()
}

const pickFirst = (...values: unknown[]) => values.map(normalize).find(Boolean) || ''

const isEnabled = (value: unknown, fallback = true) => (value === undefined ? fallback : value === true)

const formatDimensions = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return '-'
  return /cm\b/i.test(normalized) ? normalized : `${normalized} cm`
}

const truncate = (value: unknown, max: number) => {
  const text = normalize(value)
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}...` : text
}

const splitAddress = (value: unknown) => {
  const text = normalize(value)
  if (!text) return [] as string[]

  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 2) return parts

  const midpoint = Math.ceil(parts.length / 2)
  return [parts.slice(0, midpoint).join(', '), parts.slice(midpoint).join(', ')]
}

const buildDimensions = (order: any) => {
  const direct = pickFirst(order.dimension, order.dimensions)
  if (direct) return formatDimensions(direct.replace(/x/gi, ' x '))

  const length = pickFirst(order.length)
  const breadth = pickFirst(order.breadth, order.width)
  const height = pickFirst(order.height)
  if (length && breadth && height) return `${length} x ${breadth} x ${height} cm`

  return '-'
}

const buildWeight = (order: any) => {
  const direct = pickFirst(order.deadWeight, order.weightKg)
  if (direct) return direct

  const weight = Number(order.weight ?? 0)
  if (Number.isFinite(weight) && weight > 0) return `${(weight / 1000).toFixed(3)} kg`

  return '-'
}

const buildContact = (source: any, fallback: { name?: string; address?: string; phone?: string } = {}) => {
  const addressLines = [
    pickFirst(source.addressLine1, source.address1, source.line1),
    pickFirst(source.addressLine2, source.address2, source.line2, source.landmark),
  ].filter(Boolean)

  const fallbackAddressLines =
    addressLines.length > 0 ? addressLines : splitAddress(pickFirst(source.address, fallback.address))

  const city = pickFirst(source.city)
  const state = pickFirst(source.state)
  const pincode = pickFirst(source.pincode, source.zipcode)

  return {
    name: pickFirst(source.name, fallback.name),
    line1: fallbackAddressLines[0] || '',
    line2: fallbackAddressLines[1] || '',
    cityStatePin: [city && state ? `${city}, ${state}` : city || state, pincode].filter(Boolean).join(' '),
    phone: pickFirst(source.phone, source.mobile, source.mobileNumber, fallback.phone),
    alternatePhone: pickFirst(source.alternatePhone, source.altPhone),
    gstin: pickFirst(source.gstin, source.gst, source.gstNumber),
  }
}

function ContactBlock({
  title,
  lines,
  rowCount,
}: {
  title: string
  lines: string[]
  rowCount: number
}) {
  const paddedLines = [...lines, ...Array.from({ length: Math.max(0, rowCount - lines.length) }, () => '')]

  return (
    <Box sx={{ border: BORDER }}>
      <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 11, px: 0.6, py: 0.35 }}>
        {title}
      </Typography>
      {paddedLines.map((line, index) => (
        <Typography
          key={`${title}-${index}`}
          sx={{
            color: BLACK,
            fontWeight: 700,
            fontSize: 10.2,
            lineHeight: 1.15,
            px: 0.6,
            py: 0.35,
            minHeight: 18,
            borderTop: BORDER,
          }}
        >
          {line || ' '}
        </Typography>
      ))}
    </Box>
  )
}

type LabelPreviewProps = {
  values: any
  order: any
  preferences?: LabelPreferences
}

export function LabelPreview({ values, order, preferences }: LabelPreviewProps) {
  const showAlternatePhone = isEnabled(values.orderInfo?.alternatePhone, false)
  const showBillingGstin = isEnabled(values.orderInfo?.billingGstin, false)
  const showEwayBill = isEnabled(values.orderInfo?.ewayBillNumber, false)
  const showHeaderLogo = isEnabled(values.shipperInfo?.brandLogo, true) && Boolean(order.shipper?.logoUrl)
  const showShipFromName = isEnabled(values.shipperInfo?.shipperName, true)
  const showShipFromAddress = isEnabled(values.shipperInfo?.shipperAddress, true)
  const showShipFromPhone = isEnabled(values.shipperInfo?.shipperPhone, true)
  const showShipFromGstin = isEnabled(values.shipperInfo?.gstin, true)
  const showReturnName = isEnabled(values.shipperInfo?.returnName, true)
  const showReturnAddress = isEnabled(values.shipperInfo?.returnAddress, true)
  const showReturnPhone = isEnabled(values.shipperInfo?.returnPhone, true)
  const showPricing = isEnabled(values.productInfo?.productCost, true)
  const charLimit = Math.max(12, Number(values?.charLimit ?? 30))
  const maxItems = Math.max(1, Number(values?.maxItems ?? 4))

  const awb = pickFirst(order.awb, order.awbNumber, order.awb_number)
  const orderId = pickFirst(order.orderId, order.order_number, order.id)
  const invoiceNumber = pickFirst(order.invoiceNumber, order.invoice_number)
  const invoiceDate = pickFirst(order.invoiceDate, order.invoice_date)
  const ewayBill = pickFirst(order.ewayBillNumber, order.ewaybill_number)
  const courierName = pickFirst(order.courier, order.courier_partner, 'Courier Name')
  const paymentType = pickFirst(order.paymentType, order.payment_type, 'Prepaid').toLowerCase()
  const paymentLabel = paymentType === 'cod' ? 'COD' : 'Prepaid'

  const shipTo = buildContact(
    {
      name: order.name,
      address: order.address,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      phone: order.phone,
      alternatePhone: order.alternatePhone,
    },
    { name: order.name, address: order.address, phone: order.phone },
  )

  const billTo = buildContact(
    {
      name: order.billTo?.name,
      addressLine1: order.billTo?.addressLine1,
      addressLine2: order.billTo?.addressLine2,
      city: order.billTo?.city,
      state: order.billTo?.state,
      pincode: order.billTo?.pincode,
      phone: order.billTo?.phone,
      gstin: order.billTo?.gstin,
    },
    { name: shipTo.name, address: order.address, phone: shipTo.phone },
  )

  const shipFrom = buildContact(
    {
      name: order.shipper?.name,
      address: order.shipper?.address,
      city: order.shipper?.city,
      state: order.shipper?.state,
      pincode: order.shipper?.pincode,
      phone: order.shipper?.phone,
      gstin: order.shipper?.gst,
    },
    { name: order.shipper?.name, address: order.shipper?.address },
  )

  const returnTo = buildContact(
    {
      name: order.returnTo?.name,
      address: order.returnTo?.address,
      city: order.returnTo?.city,
      state: order.returnTo?.state,
      pincode: order.returnTo?.pincode,
      phone: order.returnTo?.phone,
    },
    { name: order.returnTo?.name, address: order.returnTo?.address },
  )

  const products = Array.isArray(order.products) ? order.products.slice(0, maxItems) : []
  const totalQty = (Array.isArray(order.products) ? order.products : []).reduce(
    (sum: number, product: any) => sum + Number(product.qty ?? product.quantity ?? 0),
    0,
  )
  const totalAmount =
    Number(order.totalAmount ?? 0) ||
    (Array.isArray(order.products) ? order.products : []).reduce(
      (sum: number, product: any) =>
        sum + Number(product.price ?? 0) * Number(product.qty ?? product.quantity ?? 0),
      0,
    )
  const merchantState = pickFirst(order.shipper?.state, order.returnTo?.state)

  const shipToLines = [
    shipTo.name,
    shipTo.line1,
    shipTo.line2,
    shipTo.cityStatePin,
    shipTo.phone ? `Mobile: ${shipTo.phone}` : '',
    showAlternatePhone && shipTo.alternatePhone ? `Alternate: ${shipTo.alternatePhone}` : '',
  ].filter(Boolean)

  const billToLines = [
    billTo.name,
    billTo.line1,
    billTo.line2,
    billTo.cityStatePin,
    billTo.phone ? `Mobile: ${billTo.phone}` : '',
    showBillingGstin && billTo.gstin ? `GSTIN: ${billTo.gstin}` : '',
  ].filter(Boolean)

  const shipFromLines = [
    showShipFromName ? shipFrom.name : '',
    showShipFromAddress ? shipFrom.line1 : '',
    showShipFromAddress ? shipFrom.line2 : '',
    showShipFromAddress ? shipFrom.cityStatePin : '',
    showShipFromPhone && shipFrom.phone ? `Mobile: ${shipFrom.phone}` : '',
    showShipFromGstin && shipFrom.gstin ? `GSTIN: ${shipFrom.gstin}` : '',
  ].filter(Boolean)

  const returnToLines = [
    showReturnName ? returnTo.name : '',
    showReturnAddress ? returnTo.line1 : '',
    showReturnAddress ? returnTo.line2 : '',
    showReturnAddress ? returnTo.cityStatePin : '',
    showReturnPhone && returnTo.phone ? `Mobile: ${returnTo.phone}` : '',
  ].filter(Boolean)
  const contactRowCount = Math.max(5, shipToLines.length, billToLines.length, shipFromLines.length, returnToLines.length)

  return (
    <Paper
      elevation={1}
      sx={{
        width: '100mm',
        minHeight: '152mm',
        mx: 'auto',
        p: 2,
        border: '2px solid #1f1f1f',
        borderRadius: 1,
        bgcolor: 'white',
        color: BLACK,
      }}
    >
      <Stack spacing={1.1}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 60, minWidth: 60, textAlign: 'center', flexShrink: 0 }}>
            {showHeaderLogo ? (
              <Box
                component="img"
                src={order.shipper?.logoUrl}
                alt="Seller logo"
                sx={{ width: 54, height: 54, objectFit: 'contain', mx: 'auto', display: 'block' }}
              />
            ) : (
              <Box sx={{ width: 54, height: 54, border: '1px solid #1f1f1f', borderRadius: '50%', mx: 'auto' }} />
            )}
          </Box>
          <Stack spacing={0.45} flex={1}>
            <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 16, textAlign: 'center' }}>
              {courierName}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Barcode
                value={awb || 'AWB123456789'}
                height={52}
                width={1.65}
                displayValue={false}
                margin={12}
              />
            </Box>
            <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 15, textAlign: 'center' }}>
              {awb}
            </Typography>
          </Stack>
        </Stack>

        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Stack flex={1} spacing={0.2} alignItems="center">
            <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.25, textAlign: 'center' }}>
              Weight (in KG)
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 700 }}>{buildWeight(order)}</Typography>
          </Stack>
          <Stack flex={1} spacing={0.2} alignItems="center">
            <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.25, textAlign: 'center' }}>
              Dimensions L x B x H cm
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 700 }}>{buildDimensions(order)}</Typography>
          </Stack>
          <Stack flex={1} spacing={0.2} alignItems="center">
            <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.25, textAlign: 'center' }}>
              COD or Prepaid
            </Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 700 }}>{paymentLabel}</Typography>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Box flex={1}>
            <ContactBlock
              title="Ship To,"
              lines={shipToLines}
              rowCount={contactRowCount}
            />
          </Box>
          <Box flex={1}>
            <ContactBlock
              title="Bill To,"
              lines={billToLines}
              rowCount={contactRowCount}
            />
          </Box>
        </Stack>

        <Stack direction="row" spacing={1}>
          <Box flex={1}>
            <ContactBlock
              title="Ship From,"
              lines={shipFromLines}
              rowCount={contactRowCount}
            />
          </Box>
          <Box flex={1}>
            <ContactBlock
              title="Return To,"
              lines={returnToLines}
              rowCount={contactRowCount}
            />
          </Box>
        </Stack>

        <Stack spacing={0.45}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Barcode
              value={orderId || 'ORDER1234'}
              height={42}
              width={1.45}
              displayValue={false}
              margin={12}
            />
          </Box>
          <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 15, textAlign: 'center' }}>
            {orderId}
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between" spacing={1}>
          <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10 }}>
            {`Invoice No. ${invoiceNumber || '-'}`}
          </Typography>
          <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10, textAlign: 'center' }}>
            {`Invoice Date ${invoiceDate || '-'}`}
          </Typography>
          <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10, textAlign: 'right' }}>
            {showEwayBill && ewayBill ? `Eway Bill No. ${ewayBill}` : ''}
          </Typography>
        </Stack>

        <Box sx={{ border: BORDER }}>
          <Stack direction="row">
            <Box sx={{ flex: 1, borderRight: BORDER, px: 0.5, py: 0.6 }}>
              <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.6, textAlign: 'center' }}>
                Product Name
              </Typography>
            </Box>
            <Box sx={{ width: 32, borderRight: showPricing ? BORDER : 'none', px: 0.5, py: 0.6 }}>
              <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.6, textAlign: 'center' }}>
                QTY
              </Typography>
            </Box>
            {showPricing && (
              <>
                <Box sx={{ width: 56, borderRight: BORDER, px: 0.5, py: 0.6 }}>
                  <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.6, textAlign: 'center' }}>
                    Price INR
                  </Typography>
                </Box>
                <Box sx={{ width: 70, px: 0.5, py: 0.6 }}>
                  <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.6, textAlign: 'center' }}>
                    Amount INR
                  </Typography>
                </Box>
              </>
            )}
          </Stack>
          {(products.length > 0 ? products : [{ name: 'No product data available', qty: '', price: '', amount: '' }]).map(
            (product: any, index: number) => {
              const qty = Number(product.qty ?? product.quantity ?? 0)
              const price = Number(product.price ?? 0)
              const amount = Number(product.amount ?? qty * price)
              const hasProductData = Boolean(products.length)

              return (
                <Stack key={`${product.name || 'product'}-${index}`} direction="row" sx={{ borderTop: BORDER }}>
                  <Box sx={{ flex: 1, borderRight: BORDER, px: 0.5, py: 0.6 }}>
                    <Typography sx={{ color: BLACK, fontSize: 10.1, textAlign: 'center' }}>
                      {hasProductData ? truncate(product.name, charLimit) : product.name}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 32, borderRight: showPricing ? BORDER : 'none', px: 0.5, py: 0.6 }}>
                    <Typography sx={{ color: BLACK, fontSize: 10.1, textAlign: 'center' }}>
                      {hasProductData ? qty : ' '}
                    </Typography>
                  </Box>
                  {showPricing && (
                    <>
                      <Box sx={{ width: 56, borderRight: BORDER, px: 0.5, py: 0.6 }}>
                        <Typography sx={{ color: BLACK, fontSize: 10.1, textAlign: 'center' }}>
                          {hasProductData ? price : ' '}
                        </Typography>
                      </Box>
                      <Box sx={{ width: 70, px: 0.5, py: 0.6 }}>
                        <Typography sx={{ color: BLACK, fontSize: 10.1, textAlign: 'center' }}>
                          {hasProductData ? amount.toFixed(2) : ' '}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Stack>
              )
            },
          )}
        </Box>

        {Array.isArray(order.products) && order.products.length > maxItems && (
          <Typography sx={{ color: BLACK, fontSize: 10 }}>
            Continue to next page if products are more
          </Typography>
        )}

        <Stack direction="row" justifyContent="flex-end">
          <Box sx={{ border: '1px solid #1f1f1f', width: 'fit-content', maxWidth: '100%', overflow: 'hidden', ml: 'auto' }}>
            <Stack direction="row">
              <Stack sx={{ minWidth: 54, borderRight: '1px solid #1f1f1f', p: 0.75 }}>
                <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10, textAlign: 'center' }}>
                  Total Qty
                </Typography>
                <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10, textAlign: 'center' }}>
                  {totalQty}
                </Typography>
              </Stack>
              {showPricing && (
                <>
                  <Stack sx={{ minWidth: 66, borderRight: '1px solid #1f1f1f', p: 0.75 }}>
                    <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10, textAlign: 'center' }}>
                      Total Amount
                    </Typography>
                  </Stack>
                  <Stack sx={{ minWidth: 82, p: 0.75 }}>
                    <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10, textAlign: 'center' }}>
                      {`Rs.${Number(totalAmount).toFixed(2)}`}
                    </Typography>
                  </Stack>
                </>
              )}
            </Stack>
          </Box>
        </Stack>

        <Stack spacing={0.2}>
          <Typography sx={{ color: BLACK, fontSize: 8.8, textAlign: 'center' }}>
            {merchantState
              ? `All disputes are subject to ${merchantState} jurisdiction only.`
              : 'All disputes are subject to seller jurisdiction only.'}
          </Typography>
          <Typography sx={{ color: BLACK, fontSize: 8.6, textAlign: 'center' }}>
            Goods once sold will only be taken back or exchanged as per the store&apos;s return policy.
          </Typography>
        </Stack>

        <Divider sx={{ borderColor: '#1f1f1f' }} />

        <Stack spacing={0.25}>
          <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.4, textAlign: 'center' }}>
            {`This shipment is Powered by ${preferences?.powered_by?.trim() || 'Kourier Boyz.com'}`}
          </Typography>
          <Typography sx={{ color: BLACK, fontWeight: 700, fontSize: 10.4, textAlign: 'center' }}>
            This is a system generated document, hence no signature is required
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  )
}
