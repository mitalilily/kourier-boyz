import { useOrder } from '@/api/orderQueries'
import type { Order, OrderItem } from '@/api/orders'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import API from '@/lib/axios'
import { calculateInvoiceBreakdown } from '@/utils/invoice'
import { ArrowLeft, Download, Loader2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

interface InvoiceSettings {
  invoicePrefix: string
  creditNotePrefix: string
  debitNotePrefix: string
  financialYearFormat: string
  sequenceStart: number
  resetFrequency: string
  currency: string
  roundingMode: string
  dateFormat: string
  showHsnSummary: boolean
  showGstBreakup: boolean
  allowSellerLogo: boolean
  allowSellerSignature: boolean
  allowSellerFooterNote: boolean
  lockAfterIssue: boolean
}

interface BrandingSettings {
  companyName: string
  invoiceLogoUrl?: string
  labelLogoUrl?: string
  signatureUrl?: string
  signatureName?: string
  signatureTitle?: string
}

type OrderWithSeller = Order & {
  sellerShipments?: Array<{
    seller?: {
      businessName?: string
      name?: string
      addressLine1?: string
      addressLine2?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
      panNumber?: string
      gstNumber?: string
    }
    shippingMeta?: {
      pickup_address?: {
        warehouseName?: string
        addressLine1: string
        addressLine2?: string
        city: string
        state: string
        postalCode: string
        country?: string
      }
    }
    courierCart?: {
      pickup_address?: {
        warehouseName?: string
        addressLine1: string
        addressLine2?: string
        city: string
        state: string
        postalCode: string
        country?: string
      }
    }
  }>
  seller?: {
    businessName?: string
    name?: string
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
    panNumber?: string
    gstNumber?: string
  }
  user?: {
    name?: string
    gstNumber?: string
  }
  razorpayPaymentId?: string
  paymentGateway?: string
}

const formatDate = (date: Date | string, format: string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  if (format === 'DD MMM YYYY') {
    const day = String(d.getDate()).padStart(2, '0')
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]
    return `${day}.${monthNames[d.getMonth()]}.${d.getFullYear()}`
  }
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const formatCurrency = (amount: number, currency: string = 'INR'): string => {
  const symbol = currency === 'INR' ? '₹' : currency
  return `${symbol}${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

const numberToWords = (num: number): string => {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ]
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ]

  if (num === 0) return 'Zero'
  if (num < 20) return ones[num]
  if (num < 100) {
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ` ${ones[num % 10]}` : '')
  }
  if (num < 1000) {
    return (
      ones[Math.floor(num / 100)] +
      ' Hundred' +
      (num % 100 !== 0 ? ` ${numberToWords(num % 100)}` : '')
    )
  }
  if (num < 100000) {
    return (
      numberToWords(Math.floor(num / 1000)) +
      ' Thousand' +
      (num % 1000 !== 0 ? ` ${numberToWords(num % 1000)}` : '')
    )
  }
  if (num < 10000000) {
    return (
      numberToWords(Math.floor(num / 100000)) +
      ' Lakh' +
      (num % 100000 !== 0 ? ` ${numberToWords(num % 100000)}` : '')
    )
  }
  return (
    numberToWords(Math.floor(num / 10000000)) +
    ' Crore' +
    (num % 10000000 !== 0 ? ` ${numberToWords(num % 10000000)}` : '')
  )
}

const getStateCode = (state: string): string => {
  const stateCodeMap: Record<string, string> = {
    'Andhra Pradesh': '37',
    'Arunachal Pradesh': '12',
    Assam: '18',
    Bihar: '10',
    Chhattisgarh: '22',
    Goa: '30',
    Gujarat: '24',
    Haryana: '06',
    'Himachal Pradesh': '02',
    Jharkhand: '20',
    Karnataka: '29',
    Kerala: '32',
    'Madhya Pradesh': '23',
    Maharashtra: '27',
    Manipur: '14',
    Meghalaya: '17',
    Mizoram: '15',
    Nagaland: '13',
    Odisha: '21',
    Punjab: '03',
    Rajasthan: '08',
    Sikkim: '11',
    'Tamil Nadu': '33',
    Telangana: '36',
    Tripura: '16',
    'Uttar Pradesh': '09',
    Uttarakhand: '05',
    'West Bengal': '19',
    Delhi: '07',
    'Jammu and Kashmir': '01',
    Ladakh: '38',
    Puducherry: '34',
    'Andaman and Nicobar Islands': '35',
    Chandigarh: '04',
    'Dadra and Nagar Haveli and Daman and Diu': '26',
    Lakshadweep: '31',
  }
  return stateCodeMap[state] || '00'
}

const sectionCardClass = 'space-y-1.5 border border-slate-200/90 p-4 text-sm text-slate-700'
const sectionLabelClass = 'text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500'

const InvoiceView = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const { data: orderResponse, isLoading: orderLoading } = useOrder(orderId)
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings | null>(null)
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [downloadingInvoice, setDownloadingInvoice] = useState(false)

  const order = orderResponse?.data

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [invoiceRes, brandingRes] = await Promise.all([
          API.get('/admin/settings/public/invoice').catch(() => null),
          API.get('/admin/settings/public/branding').catch(() => null),
        ])

        if (invoiceRes?.data?.data) {
          setInvoiceSettings(invoiceRes.data.data)
        }
        if (brandingRes?.data?.data) {
          setBrandingSettings(brandingRes.data.data)
        }
      } catch (error) {
        console.error('Error fetching settings:', error)
      } finally {
        setLoadingSettings(false)
      }
    }

    fetchSettings()
  }, [])

  const handleDownloadInvoice = async () => {
    if (!orderId) {
      toast.error('Order ID not available')
      return
    }

    if (downloadingInvoice) return

    setDownloadingInvoice(true)
    const loadingToast = toast.loading('Preparing invoice PDF...', {
      description: 'This may take a few moments',
    })

    try {
      const response = await API.get(`/orders/${orderId}/invoice`, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            toast.loading(`Downloading invoice... ${percentCompleted}%`, {
              id: loadingToast,
              description: 'Please wait while we prepare your invoice',
            })
          }
        },
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Invoice-${
        order?.invoice?.invoice_number || order?.orderNumber || order?._id || 'invoice'
      }.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Invoice downloaded successfully', {
        id: loadingToast,
        description: 'Your invoice PDF is ready',
      })
    } catch (error) {
      console.error('Error downloading invoice:', error)
      toast.error('Failed to download invoice', {
        id: loadingToast,
        description: 'Please try again later',
      })
    } finally {
      setDownloadingInvoice(false)
    }
  }

  if (orderLoading || loadingSettings) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <Card className="p-8 text-center">
          <p className="text-gray-600">Order not found</p>
          <Button onClick={() => navigate('/profile/orders')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </Card>
      </div>
    )
  }

  if (!order.invoice?.invoice_number) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-gray-600">Invoice not available for this order</p>
          <Button onClick={() => navigate('/profile/orders')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Orders
          </Button>
        </Card>
      </div>
    )
  }

  const settings = invoiceSettings || {
    currency: 'INR',
    dateFormat: 'DD MMM YYYY',
    showHsnSummary: true,
    showGstBreakup: true,
  }

  const branding = brandingSettings || {
    companyName: 'Kourier Boyz India Private Limited',
  }

  const invoiceBreakdown = calculateInvoiceBreakdown(order)
  const {
    lines,
    totalTaxableValue,
    totalTax,
    totalIgst,
    totalCgst,
    totalSgst,
    itemsTotal,
    grandTotal,
    roundedTotal,
  } = invoiceBreakdown

  const orderWithSeller = order as OrderWithSeller
  const seller = orderWithSeller.sellerShipments?.[0]?.seller || orderWithSeller.seller
  const warehouseAddress =
    orderWithSeller.sellerShipments?.[0]?.shippingMeta?.pickup_address ||
    orderWithSeller.sellerShipments?.[0]?.courierCart?.pickup_address ||
    null

  const invoiceDate = order.invoice.generated_at
    ? formatDate(order.invoice.generated_at, settings.dateFormat)
    : formatDate(order.createdAt, settings.dateFormat)
  const totalUnits = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0)

  return (
    <div className="min-h-screen bg-slate-100 pt-4 sm:pt-6 md:pt-32 py-6 sm:py-8">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-5 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/profile/orders')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Orders
          </Button>
          <Button
            onClick={handleDownloadInvoice}
            disabled={downloadingInvoice}
            className="flex items-center gap-2"
          >
            {downloadingInvoice ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </Button>
        </div>

        <Card className="overflow-hidden border border-slate-300 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
          <div className="p-6 sm:p-8">
            <header className="border-b border-slate-300 pb-5">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <p className={sectionLabelClass}>Tax Invoice</p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {branding.companyName || 'Kourier Boyz India Private Limited'}
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Invoice for your Kourier Boyz order.
                  </p>
                </div>

                <div className="min-w-[260px] space-y-3">
                  {(branding.invoiceLogoUrl || branding.labelLogoUrl) && (
                    <img
                      src={branding.invoiceLogoUrl || branding.labelLogoUrl || ''}
                      alt="Kourier Boyz"
                      className="ml-auto h-10 max-w-[150px] object-contain"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        if (
                          branding.labelLogoUrl &&
                          target.src !== branding.labelLogoUrl &&
                          !target.src.includes('kourier-boyz-logo.png')
                        ) {
                          target.src = branding.labelLogoUrl
                        } else if (!target.src.includes('kourier-boyz-logo.png')) {
                          target.src = '/brand/kourier-boyz-logo.png'
                        }
                      }}
                    />
                  )}
                  {!branding.invoiceLogoUrl && !branding.labelLogoUrl && (
                    <img
                      src="/brand/kourier-boyz-logo.png"
                      alt="Kourier Boyz"
                      className="ml-auto h-10 max-w-[150px] object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        if (!target.src.includes('kourier-boyz-logo.png')) {
                          target.src = '/brand/kourier-boyz-logo.png'
                        }
                      }}
                    />
                  )}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-700">
                    <span className="text-slate-500">Invoice No.</span>
                    <span className="text-right font-medium text-slate-900">
                      {order.invoice.invoice_number}
                    </span>
                    <span className="text-slate-500">Invoice Date</span>
                    <span className="text-right font-medium text-slate-900">{invoiceDate}</span>
                    <span className="text-slate-500">Order Number</span>
                    <span className="text-right font-medium text-slate-900">
                      {order.orderNumber || order._id}
                    </span>
                    <span className="text-slate-500">Payment Mode</span>
                    <span className="text-right font-medium text-slate-900">
                      {order.paymentMethod?.toUpperCase() || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 border-t border-slate-200 pt-4 text-sm text-slate-700 md:grid-cols-4">
                <div>
                  <p className={sectionLabelClass}>Invoice Total</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {formatCurrency(grandTotal, settings.currency)}
                  </p>
                </div>
                <div>
                  <p className={sectionLabelClass}>Rounded Total</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {formatCurrency(roundedTotal, settings.currency)}
                  </p>
                </div>
                <div>
                  <p className={sectionLabelClass}>Items</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {lines.length} lines, {totalUnits} units
                  </p>
                </div>
                <div>
                  <p className={sectionLabelClass}>Fulfilled By</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {seller?.businessName || seller?.name || branding.companyName}
                  </p>
                </div>
              </div>
            </header>

            <section className="mt-5 grid gap-3 md:grid-cols-3">
              <div className={sectionCardClass}>
                <p className={sectionLabelClass}>Sold By</p>
                {warehouseAddress?.warehouseName &&
                warehouseAddress.warehouseName !==
                  (seller?.businessName || seller?.name || branding.companyName) ? (
                  <>
                    <p className="font-semibold text-slate-900">
                      {seller?.businessName || seller?.name || branding.companyName}
                    </p>
                    <p className="font-medium text-slate-900">{warehouseAddress.warehouseName}</p>
                  </>
                ) : (
                  <p className="font-semibold text-slate-900">
                    {seller?.businessName || seller?.name || branding.companyName}
                  </p>
                )}
                {warehouseAddress ? (
                  <>
                    <p>
                      {warehouseAddress.addressLine1}
                      {warehouseAddress.addressLine2 && `, ${warehouseAddress.addressLine2}`}
                    </p>
                    <p>
                      {warehouseAddress.city}, {warehouseAddress.state} {warehouseAddress.postalCode}
                    </p>
                    <p>{warehouseAddress.country || 'India'}, IN</p>
                  </>
                ) : (
                  <>
                    {seller?.addressLine1 && (
                      <p>
                        {seller.addressLine1}
                        {seller.addressLine2 && `, ${seller.addressLine2}`}
                      </p>
                    )}
                    {seller?.city && seller?.state && seller?.postalCode && (
                      <p>
                        {seller.city}, {seller.state} {seller.postalCode}
                      </p>
                    )}
                    {seller?.country && <p>{seller.country}, IN</p>}
                  </>
                )}
                {seller?.panNumber && <p>PAN: {seller.panNumber}</p>}
                {seller?.gstNumber && <p>GSTIN: {seller.gstNumber}</p>}
              </div>

              <div className={sectionCardClass}>
                <p className={sectionLabelClass}>Billing Address</p>
                <p className="font-semibold text-slate-900">
                  {order.shippingAddress?.name || orderWithSeller.user?.name || 'Customer'}
                </p>
                {order.shippingAddress && (
                  <>
                    <p>{order.shippingAddress.addressLine1}</p>
                    {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                    <p>
                      {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                      {order.shippingAddress.postalCode}
                    </p>
                    <p>{order.shippingAddress.country}, IN</p>
                    <p>State Code: {getStateCode(order.shippingAddress.state)}</p>
                    {orderWithSeller.user?.gstNumber && <p>GSTIN: {orderWithSeller.user.gstNumber}</p>}
                  </>
                )}
              </div>

              <div className={sectionCardClass}>
                <p className={sectionLabelClass}>Shipping Address</p>
                <p className="font-semibold text-slate-900">
                  {order.shippingAddress?.name || orderWithSeller.user?.name || 'Customer'}
                </p>
                {order.shippingAddress && (
                  <>
                    <p>{order.shippingAddress.addressLine1}</p>
                    {order.shippingAddress.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                    <p>
                      {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                      {order.shippingAddress.postalCode}
                    </p>
                    <p>{order.shippingAddress.country}, IN</p>
                    <p>State Code: {getStateCode(order.shippingAddress.state)}</p>
                    <p>Place of Supply: {order.shippingAddress.state.toUpperCase()}</p>
                    {orderWithSeller.user?.gstNumber && <p>GSTIN: {orderWithSeller.user.gstNumber}</p>}
                  </>
                )}
              </div>
            </section>

            <section className="mt-5 overflow-hidden border border-slate-300">
              <div className="flex items-center justify-between border-b border-slate-300 bg-slate-50 px-4 py-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Invoice Line Items</h3>
                  <p className="text-xs text-slate-500">Amounts are derived from stored invoice values.</p>
                </div>
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {lines.length} items
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-50 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                      <th className="px-3 py-2 text-left font-semibold">Sl.</th>
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      <th className="px-3 py-2 text-center font-semibold">HSN</th>
                      <th className="px-3 py-2 text-center font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold">Rate</th>
                      <th className="px-3 py-2 text-right font-semibold">Discount</th>
                      <th className="px-3 py-2 text-right font-semibold">Taxable</th>
                      {settings.showGstBreakup && (
                        <>
                          <th className="px-3 py-2 text-center font-semibold">Tax %</th>
                          <th className="px-3 py-2 text-right font-semibold">Tax</th>
                        </>
                      )}
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const item = line.item as OrderItem
                      return (
                        <tr
                          key={item._id || line.lineNumber}
                          className="border-b border-slate-200 align-top last:border-b-0"
                        >
                          <td className="px-3 py-2.5 text-slate-900">{line.lineNumber}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-slate-900">
                              {item.product?.name || 'Product'}
                              {item.variant?.name && ` - ${item.variant.name}`}
                            </div>
                            {line.taxAmount > 0 && (
                              <div className="mt-0.5 text-xs text-slate-500">
                                {line.taxType === 'CGST_SGST' ? 'CGST+SGST' : line.taxType}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-700">{line.hsnCode}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700">{line.quantity}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">
                            {formatCurrency(line.sellingPriceExclGst, settings.currency)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700">
                            {line.totalDiscount > 0 ? (
                              <span className="font-medium text-rose-600">
                                -{formatCurrency(line.totalDiscount, settings.currency)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-700">
                            {formatCurrency(line.taxableValue, settings.currency)}
                          </td>
                          {settings.showGstBreakup && (
                            <>
                              <td className="px-3 py-2.5 text-center text-slate-700">
                                {line.gstRate > 0 ? `${line.gstRate}%` : '-'}
                              </td>
                              <td className="px-3 py-2.5 text-right text-slate-700">
                                {line.gstRate > 0
                                  ? formatCurrency(line.taxAmount, settings.currency)
                                  : '-'}
                              </td>
                            </>
                          )}
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                            {formatCurrency(line.lineTotal, settings.currency)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className={sectionCardClass}>
                  <p className={sectionLabelClass}>Taxable Value</p>
                  <p className="text-lg font-semibold text-slate-950">
                    {formatCurrency(totalTaxableValue, settings.currency)}
                  </p>
                  <p className="text-xs text-slate-500">GST-exclusive amount</p>
                </div>
                <div className={sectionCardClass}>
                  <p className={sectionLabelClass}>GST Total</p>
                  <p className="text-lg font-semibold text-slate-950">
                    {formatCurrency(totalTax, settings.currency)}
                  </p>
                  <p className="text-xs text-slate-500">
                    IGST {formatCurrency(totalIgst, settings.currency)} | CGST{' '}
                    {formatCurrency(totalCgst, settings.currency)} | SGST{' '}
                    {formatCurrency(totalSgst, settings.currency)}
                  </p>
                </div>
                <div className={sectionCardClass}>
                  <p className={sectionLabelClass}>Items Total</p>
                  <p className="text-lg font-semibold text-slate-950">
                    {formatCurrency(itemsTotal, settings.currency)}
                  </p>
                  <p className="text-xs text-slate-500">Before shipping and adjustments</p>
                </div>
              </div>

              <div className="border border-slate-300 p-4">
                <div className="space-y-2.5 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(totalTaxableValue, settings.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>GST</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(totalTax, settings.currency)}
                    </span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Discount{order.coupon?.code ? ` (${order.coupon.code})` : ''}</span>
                      <span className="font-medium text-rose-600">
                        -{formatCurrency(order.discount, settings.currency)}
                      </span>
                    </div>
                  )}
                  {order.shipping > 0 && (
                    <div className="flex items-center justify-between">
                      <span>Shipping</span>
                      <span className="font-medium text-slate-900">
                        {formatCurrency(order.shipping, settings.currency)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-300 pt-3">
                  <div className="flex items-center justify-between text-base font-semibold text-slate-950">
                    <span>Total</span>
                    <span>{formatCurrency(grandTotal, settings.currency)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-slate-700">
                    <span>Rounded Total</span>
                    <span className="font-medium text-slate-900">
                      {formatCurrency(roundedTotal, settings.currency)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-700">
                  <span className="font-medium text-slate-900">Amount in Words:</span>{' '}
                  {numberToWords(Math.floor(grandTotal))} only
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-5 border-t border-slate-300 pt-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Wallet className="h-4 w-4 text-slate-500" />
                  Payment Details
                </div>
                <div className="mt-3 grid gap-x-6 gap-y-2 text-sm text-slate-700 md:grid-cols-2">
                  <p>
                    <span className="text-slate-500">Transaction ID:</span>{' '}
                    <span className="font-medium text-slate-900">
                      {orderWithSeller.razorpayPaymentId || orderWithSeller.paymentGateway || 'N/A'}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">Invoice Value:</span>{' '}
                    <span className="font-medium text-slate-900">
                      {formatCurrency(grandTotal, settings.currency)}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">Date & Time:</span>{' '}
                    <span className="font-medium text-slate-900">
                      {formatDate(order.createdAt, settings.dateFormat)},{' '}
                      {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}{' '}
                      hrs
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-500">Mode:</span>{' '}
                    <span className="font-medium text-slate-900">
                      {order.paymentMethod?.toUpperCase() || 'N/A'}
                    </span>
                  </p>
                </div>
              </div>

              <div className="text-left lg:text-right">
                {branding.signatureUrl ? (
                  <div className="mb-2">
                    <img
                      src={branding.signatureUrl}
                      alt="Authorized Signature"
                      className="h-16 w-auto object-contain lg:ml-auto"
                      style={{ maxWidth: '180px', minHeight: '50px' }}
                      crossOrigin="anonymous"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                      }}
                    />
                  </div>
                ) : (
                  <div className="mb-2 h-14 w-40 border-b border-slate-300 lg:ml-auto" />
                )}
                <p className="text-sm font-semibold text-slate-900">
                  {branding.signatureName || 'Authorized Signatory'}
                </p>
                {branding.signatureTitle && (
                  <p className="text-xs text-slate-500">{branding.signatureTitle}</p>
                )}
              </div>
            </section>

            <footer className="mt-6 border-t border-slate-300 pt-3 text-xs text-slate-500">
              This digital invoice is optimized for on-screen viewing. Correct page numbering is
              applied on the downloaded PDF copy.
            </footer>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default InvoiceView
