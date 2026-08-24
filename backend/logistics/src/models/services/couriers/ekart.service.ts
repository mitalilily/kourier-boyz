import axios, { AxiosInstance } from 'axios'
import { EkartConfig, getEffectiveCourierConfig } from '../courierCredentials.service'
import { HttpError } from '../../../utils/classes'

const EKART_ELITE_BASE_URL = 'https://app.elite.ekartlogistics.in'
const EKART_LEGACY_API_BASE_URL = 'https://api.ekartlogistics.com'

export type EkartServiceabilityDetail = {
  status: boolean
  pincode: number
  remark?: string
  details?: {
    cod?: boolean
    max_cod_amount?: number
    forward_pickup?: boolean
    forward_drop?: boolean
    reverse_pickup?: boolean
    reverse_drop?: boolean
    city?: string
    state?: string
  }
}

export type EkartCreateShipmentResponse = {
  status: boolean
  remark?: string
  tracking_id?: string
  vendor?: string
  barcodes?: {
    wbn?: string
    order?: string
    cod?: string
  }
}

export type EkartPairServiceabilityResponse = {
  serviceable: boolean
  availability: Record<string, any> | null
  records: any[]
  codAvailable: boolean
  prepaidAvailable: boolean
  tat: number | null
  raw: any
}

export type EkartTrackResponse = {
  _id: string
  track: {
    status: string
    ctime: number
    pickupTime?: number
    desc?: string
    location?: string
    ndrStatus?: string
    attempts?: number
    ndrActions?: string[]
    details?: any[]
  }
  edd?: number
  order_number?: string
}

export type EkartWebhookPayload = {
  url: string
  secret?: string
  topics?: string[]
  active?: boolean
}

export type EkartEstimatePayload = {
  pickupPincode: number
  dropPincode: number
  invoiceAmount?: number
  weight: number
  length: number
  height: number
  width: number
  serviceType: 'SURFACE' | 'EXPRESS'
  codAmount?: number
  packages?: Array<{
    length: number
    height: number
    width: number
    count: string
  }>
}

export class EkartService {
  private baseApi: string = process.env.EKART_BASE_API || EKART_ELITE_BASE_URL
  private baseAuth: string = process.env.EKART_BASE_AUTH || EKART_ELITE_BASE_URL
  private clientId = process.env.EKART_CLIENT_ID || ''
  private username = process.env.EKART_USERNAME || ''
  private password = process.env.EKART_PASSWORD || ''

  private token: string | null = null
  private tokenExpiry: number | null = null
  private static cachedConfig: EkartConfig | null | undefined

  private log(prefix: string, details: any) {
    console.log(`[Ekart] ${prefix}`, details)
  }

  private maskPhone(value: any) {
    const normalized = String(value ?? '').replace(/\D/g, '')
    if (!normalized) return ''
    if (normalized.length <= 4) return normalized
    return `${normalized.slice(0, 2)}****${normalized.slice(-2)}`
  }

  private sanitizeShipmentPayload(payload: any) {
    return {
      order_number: payload?.order_number,
      payment_type: payload?.payment_type ?? payload?.payment_mode ?? null,
      courier_id: payload?.courier_id ?? null,
      package_weight: payload?.package_weight ?? payload?.package?.weight ?? null,
      package_length: payload?.package_length ?? payload?.package?.length ?? null,
      package_breadth: payload?.package_breadth ?? payload?.package?.breadth ?? null,
      package_height: payload?.package_height ?? payload?.package?.height ?? null,
      order_amount: payload?.order_amount ?? payload?.total_amount ?? null,
      collectable_amount: payload?.collectable_amount ?? payload?.cod_amount ?? null,
      preferred_dispatch_date: payload?.preferred_dispatch_date ?? null,
      delayed_dispatch: payload?.delayed_dispatch ?? null,
      tax_value: payload?.tax_value ?? payload?.taxValue ?? null,
      consignee_gst_amount: payload?.consignee_gst_amount ?? payload?.consigneeGstAmount ?? null,
      invoice_number: payload?.invoice_number ?? null,
      invoice_date: payload?.invoice_date ?? null,
      invoice_amount: payload?.invoice_amount ?? null,
      seller_name: payload?.seller_name ?? null,
      consignee_name: payload?.consignee_name ?? payload?.drop?.name ?? null,
      consignee_phone: this.maskPhone(
        payload?.consignee_phone ?? payload?.consignee_alternate_phone ?? payload?.drop?.phone,
      ),
      pickup: payload?.pickup
        ? {
            name: payload.pickup.name ?? payload.seller_name ?? null,
            city: payload.pickup.city,
            state: payload.pickup.state,
            pincode: payload.pickup.pincode,
            phone: this.maskPhone(payload.pickup.phone),
          }
        : payload?.pickup_location
          ? {
              name: payload.pickup_location.name ?? payload.seller_name ?? null,
              city: payload.pickup_location.city ?? null,
              state: payload.pickup_location.state ?? null,
              pincode: payload.pickup_location.pin ?? null,
              phone: this.maskPhone(payload.pickup_location.phone),
          }
        : null,
      pickup_location: payload?.pickup_location
        ? {
            name: payload.pickup_location.name ?? null,
          }
        : null,
      consignee: payload?.drop
        ? {
            name: payload.drop.name ?? null,
            city: payload.drop.city,
            state: payload.drop.state,
            pincode: payload.drop.pincode,
            phone: this.maskPhone(payload.drop.phone),
          }
        : null,
      order_items_count: Array.isArray(payload?.items)
        ? payload.items.length
        : Array.isArray(payload?.order_items)
          ? payload.order_items.length
          : 0,
    }
  }

  private toNumber(value: any, fallback = 0) {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : fallback
  }

  private normalizeWeightKg(value: any, fallback = 0.5) {
    const numeric = this.toNumber(value, fallback)
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback
    return numeric > 50 ? Number((numeric / 1000).toFixed(3)) : numeric
  }

  private deriveTaxValue(payload: any) {
    const directTaxValue = this.toNumber(payload?.tax_value ?? payload?.taxValue, NaN)
    if (Number.isFinite(directTaxValue) && directTaxValue >= 0) {
      return Number(directTaxValue.toFixed(2))
    }

    const items = Array.isArray(payload?.order_items) ? payload.order_items : []
    const computed = items.reduce((sum: number, item: any) => {
      const qty = this.toNumber(item?.qty ?? item?.quantity, 1)
      const price = this.toNumber(item?.price, 0)
      const discount = this.toNumber(item?.discount, 0)
      const taxRate = this.toNumber(item?.tax_rate ?? item?.taxRate, 0)
      const lineTaxableValue = Math.max(0, price * qty - discount)
      return sum + lineTaxableValue * (taxRate / 100)
    }, 0)

    return Number(Math.max(0, computed).toFixed(2))
  }

  private getNormalizedInvoiceDate(payload: any) {
    const rawValue = String(payload?.invoice_date ?? '').trim()
    if (rawValue) {
      const isoDateMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
      if (isoDateMatch) return isoDateMatch[1]

      const parsed = new Date(rawValue)
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10)
      }
    }

    return new Date().toISOString().slice(0, 10)
  }

  private normalizeDispatchDate(value: any) {
    const rawValue = String(value ?? '').trim()
    if (!rawValue) return ''

    const isoDateMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/)
    if (isoDateMatch) return isoDateMatch[1]

    const parsed = new Date(rawValue)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10)
    }

    return ''
  }

  private getIndiaDispatchDate(offsetDays = 0) {
    const indiaOffsetMs = 330 * 60 * 1000
    const dayMs = 24 * 60 * 60 * 1000
    return new Date(Date.now() + indiaOffsetMs + offsetDays * dayMs).toISOString().slice(0, 10)
  }

  private getTomorrowDispatchDate() {
    return this.getIndiaDispatchDate(1)
  }

  private resolvePreferredDispatchDate(payload: any) {
    const preferredDispatchDate =
      this.normalizeDispatchDate(payload?.preferred_dispatch_date) ||
      this.normalizeDispatchDate(payload?.pickup_date) ||
      this.normalizeDispatchDate(payload?.pickup?.pickup_date) ||
      this.normalizeDispatchDate(payload?.order_date) ||
      this.getTomorrowDispatchDate()

    return preferredDispatchDate <= this.getIndiaDispatchDate()
      ? this.getTomorrowDispatchDate()
      : preferredDispatchDate
  }

  private isDelayedDispatch(payload: any) {
    const value = payload?.delayed_dispatch
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value === 1
    return ['true', '1', 'yes', 'y'].includes(String(value ?? '').trim().toLowerCase())
  }

  private sanitizeText(value: any, fallback = '') {
    const normalized = String(value ?? '').trim()
    return normalized || fallback
  }

  private sanitizePhoneNumber(value: any, fallback = '') {
    const digits = String(value ?? '').replace(/\D/g, '')
    if (!digits) return fallback
    return digits.length <= 10 ? digits : digits.slice(-10)
  }

  private sanitizePhoneInteger(value: any, fallback = 0) {
    const digits = this.sanitizePhoneNumber(value)
    if (!digits) return fallback
    const phone = Number(digits)
    return Number.isFinite(phone) ? phone : fallback
  }

  private normalizePin(value: any, fallback = 0) {
    const digits = String(value ?? '').replace(/\D/g, '')
    if (!digits) return fallback
    return Number(digits.slice(0, 6))
  }

  private normalizeUrl(value: any) {
    const normalized = String(value ?? '').trim().replace(/\/+$/, '')
    return normalized === EKART_LEGACY_API_BASE_URL ? EKART_ELITE_BASE_URL : normalized
  }

  private normalizeEndpoint(value: any) {
    const endpoint = String(value ?? '').trim()
    if (!endpoint) return ''
    return endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  }

  private uniqueValues(values: string[]) {
    return [...new Set(values.filter(Boolean))]
  }

  private getAddressBaseUrls() {
    return this.uniqueValues(
      [process.env.EKART_ADDRESS_BASE_API, this.baseApi, this.baseAuth].map((value) => this.normalizeUrl(value)),
    )
  }

  private getAddressEndpoints() {
    const configured = process.env.EKART_ADDRESS_ENDPOINTS || process.env.EKART_ADDRESS_ENDPOINT || '/api/v2/address'
    return this.uniqueValues(configured.split(',').map((value) => this.normalizeEndpoint(value)))
  }

  private getServiceabilityBaseUrls() {
    return this.uniqueValues(
      [process.env.EKART_SERVICEABILITY_BASE_API, this.baseApi, this.baseAuth].map((value) =>
        this.normalizeUrl(value),
      ),
    )
  }

  private getServiceabilityEndpoints() {
    const configured =
      process.env.EKART_SERVICEABILITY_ENDPOINTS ||
      process.env.EKART_SERVICEABILITY_ENDPOINT ||
      '/data/v3/serviceability'
    return this.uniqueValues(configured.split(',').map((value) => this.normalizeEndpoint(value)))
  }

  private getBulkServiceabilityBaseUrls() {
    return this.uniqueValues(
      [process.env.EKART_BULK_SERVICEABILITY_BASE_API, this.baseApi, this.baseAuth].map((value) =>
        this.normalizeUrl(value),
      ),
    )
  }

  private getBulkServiceabilityEndpoints() {
    const configured =
      process.env.EKART_BULK_SERVICEABILITY_ENDPOINTS ||
      process.env.EKART_BULK_SERVICEABILITY_ENDPOINT ||
      '/data/serviceability/bulk'
    return this.uniqueValues(configured.split(',').map((value) => this.normalizeEndpoint(value)))
  }

  private getWebhookBaseUrls() {
    return this.uniqueValues(
      [process.env.EKART_WEBHOOK_BASE_API, this.baseApi, this.baseAuth].map((value) =>
        this.normalizeUrl(value),
      ),
    )
  }

  private getWebhookEndpoints() {
    const configured =
      process.env.EKART_WEBHOOK_ENDPOINTS || process.env.EKART_WEBHOOK_ENDPOINT || '/api/v2/webhook'
    return this.uniqueValues(configured.split(',').map((value) => this.normalizeEndpoint(value)))
  }

  private getAddressesBaseUrls() {
    return this.uniqueValues(
      [process.env.EKART_ADDRESSES_BASE_API, this.baseApi, this.baseAuth].map((value) =>
        this.normalizeUrl(value),
      ),
    )
  }

  private getAddressesEndpoints() {
    const configured =
      process.env.EKART_ADDRESSES_ENDPOINTS || process.env.EKART_ADDRESSES_ENDPOINT || '/api/v2/addresses'
    return this.uniqueValues(configured.split(',').map((value) => this.normalizeEndpoint(value)))
  }

  private getEstimateBaseUrls() {
    return this.uniqueValues(
      [process.env.EKART_ESTIMATE_BASE_API, this.baseApi, this.baseAuth].map((value) =>
        this.normalizeUrl(value),
      ),
    )
  }

  private getEstimateEndpoints() {
    const configured =
      process.env.EKART_ESTIMATE_ENDPOINTS || process.env.EKART_ESTIMATE_ENDPOINT || '/data/pricing/estimate'
    return this.uniqueValues(configured.split(',').map((value) => this.normalizeEndpoint(value)))
  }

  private buildEkartShipmentPayload(payload: any) {
    const paymentMode =
      String(payload?.payment_type || '').toLowerCase() === 'cod'
        ? 'COD'
        : String(payload?.payment_type || '').toLowerCase() === 'reverse'
          ? 'Pickup'
          : 'Prepaid'

    const rawItems = Array.isArray(payload?.order_items) ? payload.order_items : []
    const normalizedItems = rawItems
      .map((item: any) => {
        const quantity = this.toNumber(item?.qty ?? item?.quantity, 1)
        const price = this.toNumber(item?.price, 0)
        const discount = this.toNumber(item?.discount, 0)
        const taxRate = this.toNumber(item?.tax_rate ?? item?.taxRate, 0)
        const directTaxValue = this.toNumber(item?.tax_value ?? item?.taxValue, NaN)
        const taxableAmount = Math.max(0, price * quantity - discount)
        const taxValue = Number.isFinite(directTaxValue)
          ? directTaxValue
          : Number((taxableAmount * (taxRate / 100)).toFixed(2))
        const itemName = this.sanitizeText(item?.name ?? item?.product_name ?? item?.productName, 'Product')
        const itemSku = this.sanitizeText(item?.sku ?? item?.product_sku ?? item?.productSku, 'SKU')
        const itemHsn = this.sanitizeText(item?.hsn ?? item?.hsnCode ?? item?.product_hsn)
        const itemQuantity = quantity > 0 ? quantity : 1
        const itemTaxValue = Math.max(0, taxValue)

        return {
          name: itemName,
          product_name: itemName,
          sku: itemSku,
          product_sku: itemSku,
          quantity: itemQuantity,
          product_quantity: itemQuantity,
          price,
          product_price: price,
          hsn: itemHsn,
          product_hsn: itemHsn,
          tax_value: itemTaxValue,
          product_tax_value: itemTaxValue,
        }
      })
      .filter((item: any) => item.quantity > 0)

    if (!normalizedItems.length) {
      const packageAmount = this.toNumber(payload?.order_amount, 0)
      normalizedItems.push({
        name: 'Package',
        product_name: 'Package',
        sku: 'PKG',
        product_sku: 'PKG',
        quantity: 1,
        product_quantity: 1,
        price: packageAmount,
        product_price: packageAmount,
        hsn: '',
        product_hsn: '',
        tax_value: 0,
        product_tax_value: 0,
      })
    }

    const totalQuantity = normalizedItems.reduce((sum: number, item: any) => sum + item.quantity, 0)
    const taxableAmount = normalizedItems.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0,
    )
    const totalTaxValue = Number(
      normalizedItems.reduce((sum: number, item: any) => sum + this.toNumber(item.tax_value, 0), 0).toFixed(2),
    )
    const orderAmount = this.toNumber(payload?.order_amount ?? payload?.invoice_amount, 0)
    const computedTotalAmount = orderAmount > 0 ? orderAmount : taxableAmount + totalTaxValue
    const codAmount = paymentMode === 'COD' ? computedTotalAmount : 0
    const packageWeight = this.normalizeWeightKg(payload?.package_weight ?? payload?.weight, 0.5)
    const packageLength = this.toNumber(payload?.package_length ?? payload?.length, 10)
    const packageBreadth = this.toNumber(payload?.package_breadth ?? payload?.breadth ?? payload?.width, 10)
    const packageHeight = this.toNumber(payload?.package_height ?? payload?.height, 10)

    const sellerName = this.sanitizeText(payload?.company?.name || payload?.pickup?.name, 'Kourier Boyz')
    const sellerAddress = [
      this.sanitizeText(payload?.pickup?.address),
      this.sanitizeText(payload?.pickup?.address_2),
      this.sanitizeText(payload?.pickup?.city),
      this.sanitizeText(payload?.pickup?.state),
    ]
      .filter(Boolean)
      .join(', ')

    const consigneeName = this.sanitizeText(payload?.consignee?.name, 'Consignee')
    const consigneePhone = this.sanitizePhoneInteger(payload?.consignee?.phone)
    const consigneeAlternatePhone = this.sanitizePhoneInteger(
      payload?.consignee?.alternate_phone ??
        payload?.consignee?.alternatePhone ??
        payload?.consignee?.alt_phone ??
        payload?.consignee?.altPhone,
      0,
    )
    const pickupPhone = this.sanitizePhoneInteger(payload?.pickup?.phone)
    const returnPhone = this.sanitizePhoneInteger(payload?.rto?.phone || payload?.pickup?.phone)

    const pickupContact = {
      name: this.sanitizeText(payload?.pickup?.name, sellerName),
      phone: pickupPhone,
      address1: this.sanitizeText(payload?.pickup?.address),
      address2: this.sanitizeText(payload?.pickup?.address_2),
      city: this.sanitizeText(payload?.pickup?.city),
      state: this.sanitizeText(payload?.pickup?.state),
      pincode: this.normalizePin(payload?.pickup?.pincode),
      country: this.sanitizeText(payload?.pickup?.country || payload?.country, 'India'),
    }

    const dropContact = {
      name: consigneeName,
      phone: consigneePhone,
      address1: this.sanitizeText(payload?.consignee?.address),
      address2: this.sanitizeText(payload?.consignee?.address_2),
      city: this.sanitizeText(payload?.consignee?.city),
      state: this.sanitizeText(payload?.consignee?.state),
      pincode: this.normalizePin(payload?.consignee?.pincode),
      country: this.sanitizeText(payload?.consignee?.country || payload?.country, 'India'),
    }

    const returnContact = {
      name: this.sanitizeText(payload?.rto?.name, pickupContact.name),
      phone: returnPhone,
      address1: this.sanitizeText(payload?.rto?.address, pickupContact.address1),
      address2: this.sanitizeText(payload?.rto?.address_2, pickupContact.address2),
      city: this.sanitizeText(payload?.rto?.city, pickupContact.city),
      state: this.sanitizeText(payload?.rto?.state, pickupContact.state),
      pincode: this.normalizePin(payload?.rto?.pincode || payload?.pickup?.pincode),
      country: this.sanitizeText(payload?.rto?.country, pickupContact.country),
    }

    const invoiceDate = this.getNormalizedInvoiceDate(payload)
    const invoiceNumber = this.sanitizeText(payload?.invoice_number || payload?.order_number)
    const categoryOfGoods = this.sanitizeText(
      payload?.category_of_goods || normalizedItems.map((item: any) => item.name).join(', '),
      'General Merchandise',
    )
    const pickupLocationAlias = this.sanitizeText(
      payload?.pickup_location_alias ||
        payload?.pickup?.warehouse_name ||
        payload?.pickup?.addressNickname ||
        payload?.pickup?.address_nickname,
    )
    if (!pickupLocationAlias) {
      throw new HttpError(
        400,
        'Ekart pickup warehouse name is required. Please select a saved pickup warehouse before booking.',
      )
    }
    const returnLocationAlias = this.sanitizeText(
      payload?.return_location_alias ||
        payload?.rto?.warehouse_name ||
        payload?.rto?.addressNickname ||
        payload?.rto?.address_nickname ||
        pickupLocationAlias,
    )
    const delayedDispatch = this.isDelayedDispatch(payload)
    const preferredDispatchDate = delayedDispatch ? '' : this.resolvePreferredDispatchDate(payload)

    return {
      trackingId: payload?.order_number,
      referenceId: payload?.order_id || payload?.order_number,
      order_number: payload?.order_number,
      order_id: payload?.order_id,
      order_date: invoiceDate,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      invoice_amount: computedTotalAmount,
      seller_name: sellerName,
      seller_address: sellerAddress,
      seller_gst_tin: this.sanitizeText(payload?.company?.gst || payload?.pickup?.gst_number),
      seller_gst_amount: totalTaxValue,
      consignee_name: consigneeName,
      consignee_phone: consigneePhone,
      ...(consigneeAlternatePhone && consigneeAlternatePhone !== consigneePhone
        ? { consignee_alternate_phone: consigneeAlternatePhone }
        : {}),
      consignee_gst_tin: this.sanitizeText(payload?.consignee?.gstin),
      consignee_gst_amount: totalTaxValue,
      integrated_gst_amount: 0,
      category_of_goods: categoryOfGoods,
      products_desc: normalizedItems.map((item: any) => item.name).join(', '),
      paymentType: paymentMode,
      payment_mode: paymentMode,
      codAmount,
      cod_amount: codAmount,
      invoiceAmount: computedTotalAmount,
      total_amount: computedTotalAmount,
      order_amount: computedTotalAmount,
      collectable_amount: codAmount,
      tax_value: totalTaxValue,
      taxable_amount: taxableAmount,
      commodity_value: String(taxableAmount),
      quantity: totalQuantity || 1,
      weight: packageWeight,
      length: packageLength,
      breadth: packageBreadth,
      width: packageBreadth,
      height: packageHeight,
      pickup: pickupContact,
      drop: dropContact,
      returnAddress: returnContact,
      pickup_location: {
        name: pickupLocationAlias,
      },
      ...(delayedDispatch
        ? { delayed_dispatch: true }
        : { preferred_dispatch_date: preferredDispatchDate }),
      drop_location: {
        name: dropContact.name,
        address: dropContact.address1,
        city: dropContact.city,
        state: dropContact.state,
        pin: dropContact.pincode,
        phone: dropContact.phone,
        country: dropContact.country,
      },
      return_location: {
        name: returnLocationAlias,
      },
      package: {
        weight: packageWeight,
        length: packageLength,
        breadth: packageBreadth,
        width: packageBreadth,
        height: packageHeight,
        items: normalizedItems,
      },
      items: normalizedItems,
    }
  }

  private buildWarehousePayloadFromShipment(originalPayload: any, shipmentPayload: any) {
    const pickup = shipmentPayload?.pickup || {}
    const alias = this.sanitizeText(
      shipmentPayload?.pickup_location?.name ||
        originalPayload?.pickup_location_alias ||
        originalPayload?.pickup?.warehouse_name ||
        originalPayload?.pickup?.addressNickname ||
        originalPayload?.pickup?.address_nickname,
    )

    if (!alias || !pickup.address1 || !pickup.city || !pickup.state || !pickup.pincode) {
      return null
    }

    return {
      alias,
      phone: pickup.phone || originalPayload?.pickup?.phone || 0,
      addressLine1: pickup.address1,
      addressLine2: pickup.address2 || '',
      pincode: pickup.pincode,
      city: pickup.city,
      state: pickup.state,
      country: originalPayload?.pickup?.country || 'India',
    }
  }

  private isLocationNotRegisteredError(err: any) {
    const message = this.extractErrorMessage(err, '')
    return /location/i.test(message) && /not registered/i.test(message)
  }

  private isAddressAlreadyRegisteredError(err: any) {
    const message = this.extractErrorMessage(err, '')
    return /already/i.test(message) && /(exist|registered|created|used)/i.test(message)
  }

  private extractErrorMessage(err: any, fallback: string) {
    const candidates = [
      err?.response?.data?.description,
      err?.response?.data?.message,
      err?.response?.data?.remark,
      err?.response?.data?.error,
      err?.response?.data?.details?.message,
      err?.message,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim()
      }
    }

    return fallback
  }

  private async ensureConfigLoaded() {
    if (EkartService.cachedConfig === undefined) {
      EkartService.cachedConfig = await getEffectiveCourierConfig<EkartConfig>('ekart', 'b2c')
    }
    const cfg = EkartService.cachedConfig
    if (cfg) {
      this.clientId = cfg.clientId || this.clientId
      this.username = cfg.username || this.username
      this.password = cfg.password || this.password
      this.baseApi = this.normalizeUrl(cfg.baseApi) || this.normalizeUrl(this.baseApi)
      this.baseAuth = this.normalizeUrl(cfg.baseAuth) || this.normalizeUrl(this.baseAuth)
    }
  }

  private async getHttp(): Promise<AxiosInstance> {
    const token = await this.getAccessToken()
    this.baseApi = this.normalizeUrl(this.baseApi)
    return axios.create({
      baseURL: this.baseApi,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    })
  }

  private async getAccessToken(): Promise<string> {
    await this.ensureConfigLoaded()

    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) return this.token

    this.baseAuth = this.normalizeUrl(this.baseAuth)
    const url = `${this.baseAuth}/integrations/v2/auth/token/${this.clientId}`
    this.log('Auth attempt', {
      url,
      clientId: this.clientId,
      username: this.username,
    })

    let res
    try {
      res = await axios.post(url, { username: this.username, password: this.password })
    } catch (err: any) {
      this.log('Auth failed', {
        url,
        status: err?.response?.status || null,
        statusText: err?.response?.statusText || null,
        response: err?.response?.data || null,
        message: err?.message || err,
      })
      throw new HttpError(
        Number(err?.response?.status || 502),
        this.extractErrorMessage(err, 'Ekart authentication failed'),
      )
    }

    const { access_token, expires_in, token_type } = res.data || {}

    if (!access_token || !token_type) {
      throw new Error('Invalid Ekart auth response')
    }

    this.token = access_token
    this.tokenExpiry = Date.now() + (expires_in ? Number(expires_in) * 1000 : 23 * 60 * 60 * 1000)
    return this.token || ''
  }

  // ---------- Serviceability ----------
  async checkPincodeServiceability(pincode: string | number): Promise<EkartServiceabilityDetail> {
    const http = await this.getHttp()
    const res = await http.get(`/api/v2/serviceability/${pincode}`)
    return res.data
  }

  async checkPairServiceability(payload: {
    pickupPincode: string
    dropPincode: string
    length: string
    height: string
    width: string
    weight: string
    paymentType: 'COD' | 'Prepaid'
    serviceType?: 'SURFACE' | 'EXPRESS'
    codAmount?: string
    invoiceAmount: string
  }) {
    const token = await this.getAccessToken()
    const baseUrls = this.getServiceabilityBaseUrls()
    const endpoints = this.getServiceabilityEndpoints()
    const tried: string[] = []
    let lastError: any = null
    let res: any = null

    this.log('Serviceability v3 request', {
      baseUrls,
      endpoints,
      pickup: payload.pickupPincode,
      drop: payload.dropPincode,
      paymentType: payload.paymentType,
      invoiceAmount: payload.invoiceAmount,
    })

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`
        tried.push(url)

        try {
          res = await axios.post(url, payload, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          })
          break
        } catch (err: any) {
          lastError = err
          const status = Number(err?.response?.status || 502)
          this.log('Serviceability v3 failed', {
            url,
            status,
            statusText: err?.response?.statusText || null,
            response: err?.response?.data || null,
            message: err?.message || err,
          })

          if (status === 404) continue

          const httpError = new HttpError(status, this.extractErrorMessage(err, 'Ekart serviceability failed')) as any
          httpError.code = 'EKART_SERVICEABILITY_FAILED'
          httpError.response = err?.response
          throw httpError
        }
      }

      if (res) break
    }

    if (!res) {
      const httpError = new HttpError(
        404,
        `Ekart serviceability endpoint not found. Tried: ${tried.join(', ')}`,
      ) as any
      httpError.code = 'EKART_SERVICEABILITY_ENDPOINT_NOT_FOUND'
      httpError.response = lastError?.response
      throw httpError
    }

    this.log('Serviceability v3', {
      pickup: payload.pickupPincode,
      drop: payload.dropPincode,
      url: res.config?.url || null,
      status: res.status,
    })
    const raw = res.data
    type EkartRecord = Record<string, any>
    const isObjectRecord = (value: any): value is EkartRecord =>
      Boolean(value) && typeof value === 'object' && !Array.isArray(value)

    const readPath = (source: any, path: string) => {
      if (!source) return undefined
      return path.split('.').reduce((current: any, part: string) => {
        if (current === undefined || current === null) return undefined
        return current?.[part]
      }, source)
    }

    const collectNestedRecords = (value: any, depth = 0): any[] => {
      if (depth > 5 || value === undefined || value === null) return []
      if (Array.isArray(value)) {
        const nested = value.flatMap((item) => collectNestedRecords(item, depth + 1))
        return nested.length ? nested : value
      }
      if (!isObjectRecord(value)) return []

      const nestedKeys = [
        'records',
        'data',
        'result',
        'results',
        'response',
        'availability',
        'serviceability',
        'services',
        'serviceabilities',
        'availableServices',
        'available_services',
        'details',
        'forward',
        'forwardServiceability',
        'forward_serviceability',
      ]
      const nestedRecords = nestedKeys.flatMap((key) => collectNestedRecords(value[key], depth + 1))
      return nestedRecords.length ? [value, ...nestedRecords] : [value]
    }

    const records = collectNestedRecords(raw)
    const recordObjects = records.filter(isObjectRecord)
    const availabilitySignalPaths = [
      'is_serviceable',
      'isServiceable',
      'serviceable',
      'available',
      'is_available',
      'isAvailable',
      'status',
      'tat',
      'tat.min',
      'tat.max',
      'cod',
      'cod_available',
      'codAvailable',
      'prepaid',
      'prepaid_available',
      'prepaidAvailable',
      'payment_modes.cod',
      'paymentModes.cod',
      'payment_modes.prepaid',
      'paymentModes.prepaid',
      'forward_pickup',
      'forwardPickup',
      'forward_drop',
      'forwardDrop',
      'forward.pickup',
      'forward.drop',
      'delivery',
      'delivery_available',
      'drop',
      'forwardDeliveredCharges',
      'freight_charges',
      'total_charges',
      'totalCharges',
    ]

    const scoreAvailabilityRecord = (record: EkartRecord) =>
      availabilitySignalPaths.reduce((score, path) => {
        const value = readPath(record, path)
        return value !== undefined && value !== null ? score + 1 : score
      }, 0)

    const availability =
      recordObjects
        .slice()
        .sort((left, right) => scoreAvailabilityRecord(right) - scoreAvailabilityRecord(left))[0] ??
      (isObjectRecord(raw) ? raw : null)

    const sources = [availability, ...recordObjects, raw].filter(Boolean)

    const pathValues = (paths: string[]) =>
      sources.flatMap((source) => paths.map((path) => readPath(source, path))).filter((value) => value !== undefined)

    const toBoolean = (...values: any[]): boolean | undefined => {
      for (const value of values) {
        if (typeof value === 'boolean') return value
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase()
          if (
            /not\s+serviceable|non[-\s]?serviceable|unserviceable|not\s+available|unavailable|not\s+covered|no\s+service/.test(
              normalized,
            )
          ) {
            return false
          }
          if (['false', 'no', 'n', '0', 'failed', 'failure', 'inactive', 'disabled'].includes(normalized)) {
            return false
          }
          if (
            ['true', 'yes', 'y', '1', 'serviceable', 'available', 'success', 'successful', 'ok', 'active'].includes(
              normalized,
            ) ||
            /\bserviceable\b|\bavailable\b/.test(normalized)
          ) {
            return true
          }
        }
        if (typeof value === 'number') return value > 0
      }
      return undefined
    }

    const textCandidates = pathValues([
      'message',
      'remark',
      'remarks',
      'description',
      'reason',
      'error',
      'status.message',
      'status.remark',
      'status.description',
    ]).filter((value) => typeof value === 'string') as string[]

    const hasNegativeServiceabilityText = textCandidates.some((text) =>
      /not\s+serviceable|non[-\s]?serviceable|unserviceable|not\s+available|unavailable|not\s+covered|no\s+service/i.test(
        text,
      ),
    )

    const hasTatSignal =
      pathValues(['tat', 'tat.min', 'tat.max', 'tat_days', 'estimated_delivery_days', 'eta_days']).some(
        (value) => Number.isFinite(Number(value)) && Number(value) > 0,
      )

    const hasChargeSignal = Boolean(
      pathValues([
        'forwardDeliveredCharges',
        'rtoDeliveredCharges',
        'reverseDeliveredCharges',
        'freight_charges',
        'freightCharges',
        'total_charges',
        'totalCharges',
        'charge',
        'amount',
        'rate',
      ]).some((value) => Number.isFinite(Number(value)) && Number(value) > 0),
    )

    const pickupReady = toBoolean(
      ...pathValues([
        'forward_pickup',
        'forwardPickup',
        'pickup',
        'pickup_available',
        'pickupAvailable',
        'forward.pickup',
        'forward.pickup_available',
        'details.forward_pickup',
      ]),
    )
    const dropReady = toBoolean(
      ...pathValues([
        'forward_drop',
        'forwardDrop',
        'drop',
        'drop_available',
        'dropAvailable',
        'delivery',
        'delivery_available',
        'deliveryAvailable',
        'forward.drop',
        'forward.drop_available',
        'details.forward_drop',
      ]),
    )
    const pairReady =
      (pickupReady === true && dropReady !== false) || (dropReady === true && pickupReady !== false)

    const explicitServiceable = toBoolean(
      ...pathValues([
        'is_serviceable',
        'isServiceable',
        'serviceable',
        'available',
        'is_available',
        'isAvailable',
        'status',
        'serviceability_status',
        'serviceabilityStatus',
      ]),
    )
    const inferredServiceable = pairReady || (records.length > 0 && (hasTatSignal || hasChargeSignal))
    const serviceable =
      !hasNegativeServiceabilityText && (explicitServiceable ?? inferredServiceable)

    const codAvailable =
      toBoolean(
        ...pathValues([
          'cod',
          'is_cod',
          'isCod',
          'cod_available',
          'codAvailable',
          'cod.serviceable',
          'cod.available',
          'payment_modes.cod',
          'paymentModes.cod',
          'services.cod',
        ]),
      ) ?? true

    const prepaidAvailable =
      toBoolean(
        ...pathValues([
          'prepaid',
          'is_prepaid',
          'isPrepaid',
          'prepaid_available',
          'prepaidAvailable',
          'prepaid.serviceable',
          'prepaid.available',
          'payment_modes.prepaid',
          'paymentModes.prepaid',
          'services.prepaid',
        ]),
      ) ?? true

    const tatCandidates = pathValues([
      'tat',
      'tat.min',
      'tat.max',
      'tat_days',
      'estimated_delivery_days',
      'eta_days',
      'edd',
      'edd_days',
    ])
    const tat = tatCandidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value > 0) ?? null

    return {
      serviceable,
      availability,
      records,
      codAvailable,
      prepaidAvailable,
      tat,
      raw,
    } satisfies EkartPairServiceabilityResponse
  }

  // Backward-compatible alias used by older callers
  async checkServiceability(payload: {
    pickupPincode: string
    dropPincode: string
    length: string
    height: string
    width: string
    weight: string
    paymentType: 'COD' | 'Prepaid'
    serviceType?: 'SURFACE' | 'EXPRESS'
    codAmount?: string
    invoiceAmount: string
  }) {
    return this.checkPairServiceability(payload)
  }

  // ---------- Booking ----------
  async createShipment(payload: any): Promise<EkartCreateShipmentResponse> {
    const http = await this.getHttp()
    const endpoint = '/api/v1/package/create'
    const normalizedPayload = this.buildEkartShipmentPayload(payload)
    const sanitizedPayload = this.sanitizeShipmentPayload(normalizedPayload)

    this.log('Create shipment request', {
      baseApi: this.baseApi,
      endpoint,
      payload: sanitizedPayload,
    })

    try {
      const res = await http.put(endpoint, normalizedPayload)
      this.log('Create shipment response', {
        baseApi: this.baseApi,
        endpoint,
        status: res.status,
        data: res.data,
      })
      return res.data
    } catch (err: any) {
      this.log('Create shipment failed', {
        baseApi: this.baseApi,
        endpoint,
        payload: sanitizedPayload,
        status: err?.response?.status || null,
        statusText: err?.response?.statusText || null,
        response: err?.response?.data || null,
        message: err?.message || err,
      })

      if (this.isLocationNotRegisteredError(err)) {
        const warehousePayload = this.buildWarehousePayloadFromShipment(payload, normalizedPayload)

        if (warehousePayload) {
          this.log('Registering missing pickup location before retry', {
            alias: warehousePayload.alias,
            city: warehousePayload.city,
            state: warehousePayload.state,
            pincode: warehousePayload.pincode,
            phone: this.maskPhone(warehousePayload.phone),
          })

          try {
            await this.createWarehouse(warehousePayload)
          } catch (registrationErr: any) {
            if (!this.isAddressAlreadyRegisteredError(registrationErr)) {
              this.log('Missing pickup location registration failed', {
                alias: warehousePayload.alias,
                status: registrationErr?.response?.status || registrationErr?.statusCode || null,
                response: registrationErr?.response?.data || null,
                message: registrationErr?.message || registrationErr,
              })

              throw new HttpError(
                Number(registrationErr?.response?.status || registrationErr?.statusCode || 502),
                this.extractErrorMessage(
                  registrationErr,
                  `Ekart pickup location '${warehousePayload.alias}' is not registered and could not be registered automatically.`,
                ),
              )
            }

            this.log('Missing pickup location already registered; retrying shipment', {
              alias: warehousePayload.alias,
            })
          }

          try {
            const retryRes = await http.put(endpoint, normalizedPayload)
            this.log('Create shipment retry response', {
              baseApi: this.baseApi,
              endpoint,
              status: retryRes.status,
              data: retryRes.data,
            })
            return retryRes.data
          } catch (retryErr: any) {
            this.log('Create shipment retry failed', {
              baseApi: this.baseApi,
              endpoint,
              payload: sanitizedPayload,
              status: retryErr?.response?.status || null,
              statusText: retryErr?.response?.statusText || null,
              response: retryErr?.response?.data || null,
              message: retryErr?.message || retryErr,
            })

            throw new HttpError(
              Number(retryErr?.response?.status || 502),
              this.extractErrorMessage(retryErr, 'Ekart shipment creation failed after pickup location registration'),
            )
          }
        }

        this.log('Missing pickup location could not be auto-registered', {
          reason: 'Shipment payload did not contain complete pickup address fields',
          pickup_location: normalizedPayload?.pickup_location?.name || null,
        })
      }

      throw new HttpError(
        Number(err?.response?.status || 502),
        this.extractErrorMessage(err, 'Ekart shipment creation failed'),
      )
    }
  }

  async cancelShipment(trackingId: string) {
    const http = await this.getHttp()
    const res = await http.delete('/api/v1/package/cancel', { params: { tracking_id: trackingId } })
    return res.data
  }

  async updateDispatchDate(ids: string[], dispatchDate: string) {
    const http = await this.getHttp()
    const res = await http.post('/data/shipment/dispatch-date', { ids, dispatchDate })
    return res.data
  }

  async updateEwbn(id: string, ewbn: string) {
    const http = await this.getHttp()
    const res = await http.post('/data/shipment/ewbn', { id, ewbn })
    return res.data
  }

  // ---------- Tracking ----------
  async track(trackingId: string): Promise<EkartTrackResponse> {
    const http = await this.getHttp()
    const res = await http.get(`/api/v1/track/${trackingId}`)
    return res.data
  }

  async trackWbn(wbn: string) {
    const http = await this.getHttp()
    const res = await http.get(`/data/v1/elite/track/${wbn}`)
    return res.data
  }

  // ---------- Labels & Manifest ----------
  async downloadLabels(ids: string[], jsonOnly = false) {
    const http = await this.getHttp()
    const res = await http.post(
      '/api/v1/package/label',
      { ids },
      {
        params: { json_only: jsonOnly },
        responseType: jsonOnly ? 'json' : 'arraybuffer',
      },
    )
    return res.data
  }

  async generateManifest(ids: string[]) {
    const http = await this.getHttp()
    const res = await http.post('/data/v2/generate/manifest', { ids }, { responseType: 'json' })
    return res.data
  }

  // ---------- Address sync ----------
  async addAddress(payload: {
    alias: string
    phone: string | number
    address_line1: string
    address_line2?: string | null
    pincode: string | number
    city: string
    state: string
    country?: string
    geo?: { lat?: number; lon?: number }
  }) {
    const token = await this.getAccessToken()
    const hasValidGeo =
      payload.geo?.lat !== undefined &&
      Number.isFinite(Number(payload.geo.lat)) &&
      payload.geo?.lon !== undefined &&
      Number.isFinite(Number(payload.geo.lon))
    const body = {
      alias: payload.alias,
      phone: Number(payload.phone),
      address_line1: payload.address_line1,
      address_line2: payload.address_line2 ?? null,
      pincode: Number(payload.pincode),
      city: payload.city,
      state: payload.state,
      country: payload.country || 'India',
      ...(hasValidGeo
        ? {
            geo: {
              lat: Number(payload.geo?.lat),
              lon: Number(payload.geo?.lon),
            },
          }
        : {}),
    }
    const baseUrls = this.getAddressBaseUrls()
    const endpoints = this.getAddressEndpoints()
    const tried: string[] = []
    let lastError: any = null

    this.log('Address sync request', {
      baseUrls,
      endpoints,
      payload: {
        alias: body.alias,
        phone: this.maskPhone(body.phone),
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        has_geo: Boolean(body.geo),
      },
    })

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`
        tried.push(url)

        try {
          const res = await axios.post(url, body, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          })
          this.log('Address sync response', {
            url,
            status: res.status,
            data: res.data,
          })
          return res.data
        } catch (err: any) {
          lastError = err
          const status = Number(err?.response?.status || 502)
          this.log('Address sync failed', {
            url,
            status,
            statusText: err?.response?.statusText || null,
            response: err?.response?.data || null,
            message: err?.message || err,
          })

          if (status === 404) continue

          const httpError = new HttpError(status, this.extractErrorMessage(err, 'Ekart address registration failed')) as any
          httpError.code = 'EKART_ADDRESS_REGISTRATION_FAILED'
          httpError.response = err?.response
          throw httpError
        }
      }
    }

    const httpError = new HttpError(
      404,
      `Ekart address registration endpoint not found. Tried: ${tried.join(', ')}`,
    ) as any
    httpError.code = 'EKART_ADDRESS_ENDPOINT_NOT_FOUND'
    httpError.response = lastError?.response
    throw httpError
  }

  // Backward-compatible alias used by pickup registration flow
  async createWarehouse(payload: any) {
    return this.addAddress({
      alias: payload?.alias || payload?.name || 'Warehouse',
      phone: payload?.phone || payload?.contactPhone || 0,
      address_line1: payload?.addressLine1 || payload?.address_line1 || '',
      address_line2: payload?.addressLine2 || payload?.address_line2 || null,
      pincode: payload?.pincode || '',
      city: payload?.city || '',
      state: payload?.state || '',
      country: payload?.country || 'India',
      geo: payload?.geo,
    })
  }

  async listAddresses() {
    const token = await this.getAccessToken()
    const baseUrls = this.getAddressesBaseUrls()
    const endpoints = this.getAddressesEndpoints()
    const tried: string[] = []
    let lastError: any = null

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`
        tried.push(url)

        try {
          const res = await axios.get(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          })
          return res.data
        } catch (err: any) {
          lastError = err
          if (Number(err?.response?.status || 0) === 404) continue
          throw new HttpError(
            Number(err?.response?.status || 502),
            this.extractErrorMessage(err, 'Ekart addresses fetch failed'),
          )
        }
      }
    }

    throw new HttpError(
      404,
      `Ekart addresses endpoint not found. Tried: ${tried.join(', ')}`,
    )
  }

  async getBulkServiceability(type: 'NON_LARGE' | 'LARGE', format: 'JSON' | 'EXCEL' = 'JSON') {
    const token = await this.getAccessToken()
    const baseUrls = this.getBulkServiceabilityBaseUrls()
    const endpoints = this.getBulkServiceabilityEndpoints()
    const tried: string[] = []

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        const path = `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(type)}`
        const url = `${baseUrl}${path}`
        tried.push(url)

        try {
          const res = await axios.get(url, {
            params: { format },
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
            responseType: format === 'EXCEL' ? 'arraybuffer' : 'json',
          })
          return res.data
        } catch (err: any) {
          if (Number(err?.response?.status || 0) === 404) continue
          throw new HttpError(
            Number(err?.response?.status || 502),
            this.extractErrorMessage(err, 'Ekart bulk serviceability failed'),
          )
        }
      }
    }

    throw new HttpError(
      404,
      `Ekart bulk serviceability endpoint not found. Tried: ${tried.join(', ')}`,
    )
  }

  async listWebhooks() {
    const token = await this.getAccessToken()
    const baseUrls = this.getWebhookBaseUrls()
    const endpoints = this.getWebhookEndpoints()
    const tried: string[] = []

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`
        tried.push(url)
        try {
          const res = await axios.get(url, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          })
          return res.data
        } catch (err: any) {
          if (Number(err?.response?.status || 0) === 404) continue
          throw new HttpError(
            Number(err?.response?.status || 502),
            this.extractErrorMessage(err, 'Ekart webhooks fetch failed'),
          )
        }
      }
    }

    throw new HttpError(404, `Ekart webhook endpoint not found. Tried: ${tried.join(', ')}`)
  }

  async createWebhook(payload: EkartWebhookPayload) {
    const token = await this.getAccessToken()
    const baseUrls = this.getWebhookBaseUrls()
    const endpoints = this.getWebhookEndpoints()
    const tried: string[] = []

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`
        tried.push(url)
        try {
          const res = await axios.post(url, payload, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          })
          return res.data
        } catch (err: any) {
          if (Number(err?.response?.status || 0) === 404) continue
          throw new HttpError(
            Number(err?.response?.status || 502),
            this.extractErrorMessage(err, 'Ekart webhook creation failed'),
          )
        }
      }
    }

    throw new HttpError(404, `Ekart webhook endpoint not found. Tried: ${tried.join(', ')}`)
  }

  async updateWebhook(webhookId: string, payload: Partial<EkartWebhookPayload>) {
    const token = await this.getAccessToken()
    const baseUrls = this.getWebhookBaseUrls()
    const endpoints = this.getWebhookEndpoints()
    const tried: string[] = []

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        const normalizedEndpoint = endpoint.replace(/\/+$/, '')
        const url = `${baseUrl}${normalizedEndpoint}/${encodeURIComponent(webhookId)}`
        tried.push(url)
        try {
          const res = await axios.put(url, payload, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          })
          return res.data
        } catch (err: any) {
          if (Number(err?.response?.status || 0) === 404) continue
          throw new HttpError(
            Number(err?.response?.status || 502),
            this.extractErrorMessage(err, 'Ekart webhook update failed'),
          )
        }
      }
    }

    throw new HttpError(404, `Ekart webhook endpoint not found. Tried: ${tried.join(', ')}`)
  }

  async estimatePricing(payload: EkartEstimatePayload) {
    const token = await this.getAccessToken()
    const baseUrls = this.getEstimateBaseUrls()
    const endpoints = this.getEstimateEndpoints()
    const tried: string[] = []

    for (const baseUrl of baseUrls) {
      for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`
        tried.push(url)
        try {
          const res = await axios.post(url, payload, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            timeout: 20000,
          })
          return res.data
        } catch (err: any) {
          if (Number(err?.response?.status || 0) === 404) continue
          throw new HttpError(
            Number(err?.response?.status || 502),
            this.extractErrorMessage(err, 'Ekart estimate fetch failed'),
          )
        }
      }
    }

    throw new HttpError(404, `Ekart estimate endpoint not found. Tried: ${tried.join(', ')}`)
  }

  // ---------- NDR ----------
  async ndrAction(payload: {
    action: 'Re-Attempt' | 'RTO'
    wbn: string
    date?: number
    phone?: string
    address?: string
    instructions?: string
    links?: string[]
  }) {
    const http = await this.getHttp()
    const res = await http.post('/api/v2/package/ndr', payload)
    return res.data
  }

  // Backward-compatible alias used by NDR controllers
  async submitNdrAction(payload: any) {
    return this.ndrAction(payload)
  }
}
