import axios, { AxiosInstance } from 'axios'

const normalizeApiRoot = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

class KourierBoyzLogisticsService {
  private readonly apiRoot = normalizeApiRoot(
    process.env.KOURIER_BOYZ_LOGISTICS_API_URL || '',
  )

  private readonly apiKey = (process.env.KOURIER_BOYZ_LOGISTICS_API_KEY || '').trim()

  private readonly internalClient: AxiosInstance | null = this.apiRoot
    ? axios.create({
        baseURL: this.apiRoot.replace(/\/v1$/, '/internal/marketplace'),
        timeout: 60_000,
        headers: {
          'Content-Type': 'application/json',
          'X-Kourier-Boyz-Internal-Key':
            process.env.KOURIER_BOYZ_INTERNAL_SERVICE_KEY || this.apiKey,
        },
      })
    : null

  private readonly client: AxiosInstance | null = this.apiRoot
    ? axios.create({
        baseURL: this.apiRoot,
        timeout: 60_000,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
          'X-Kourier-Boyz-Service': 'marketplace',
        },
      })
    : null

  get isConfigured() {
    return Boolean(this.client && this.apiKey)
  }

  private getClient() {
    if (!this.client || !this.apiKey) {
      throw new Error('Kourier Boyz logistics service is not configured')
    }
    return this.client
  }

  async getRates(payload: unknown) {
    const linked = payload as { logistics_user_id?: string }
    if (linked.logistics_user_id && this.internalClient) {
      const { data } = await this.internalClient.post('/rates', {
        ...(payload as object),
        logisticsUserId: linked.logistics_user_id,
      })
      return data
    }
    const { data } = await this.getClient().post('/shipping/rates', payload)
    return data
  }

  async createOrder(payload: unknown) {
    const linked = payload as {
      existing_logistics_order_id?: string
      logistics_user_id?: string
      marketplace_order_id?: string
      order_number?: string
      order_date?: string
      order_amount?: number
      payment_type?: string
      shipping_charges?: number
      discount?: number
      gift_wrap?: number
      consignee?: Record<string, unknown>
      order_items?: unknown[]
      package_weight?: number
      package_length?: number
      package_breadth?: number
      package_height?: number
    }
    if (linked.logistics_user_id && linked.marketplace_order_id && this.internalClient) {
      let draftId = linked.existing_logistics_order_id
      if (!draftId) {
        const draftResponse = await this.createMarketplaceDraft({
          logisticsUserId: linked.logistics_user_id,
          marketplaceOrderId: linked.marketplace_order_id,
          orderNumber: linked.order_number,
          orderDate: linked.order_date,
          orderAmount: linked.order_amount,
          paymentType: linked.payment_type,
          shippingCharges: linked.shipping_charges,
          discount: linked.discount,
          giftWrap: linked.gift_wrap,
          buyer: {
            name: linked.consignee?.name,
            phone: linked.consignee?.phone,
            email: linked.consignee?.email,
            address: linked.consignee?.address,
            city: linked.consignee?.city,
            state: linked.consignee?.state,
            country: linked.consignee?.country,
            pincode: linked.consignee?.pincode,
          },
          products: linked.order_items,
          package: {
            weight: linked.package_weight,
            length: linked.package_length,
            breadth: linked.package_breadth,
            height: linked.package_height,
          },
        })
        draftId = draftResponse?.data?.id
      }
      if (!draftId) throw new Error('Marketplace courier draft could not be created')
      const { data } = await this.internalClient.post(
        `/orders/${encodeURIComponent(draftId)}/book`,
        { ...(payload as object), logisticsUserId: linked.logistics_user_id },
      )
      return data
    }
    const { data } = await this.getClient().post('/orders', payload)
    return data
  }

  async createMarketplaceDraft(payload: unknown) {
    if (!this.internalClient || !this.apiKey) {
      throw new Error('Kourier Boyz logistics service is not configured')
    }
    const { data } = await this.internalClient.post('/orders', payload)
    return data
  }

  async cancelMarketplaceDraft(payload: unknown) {
    if (!this.internalClient || !this.apiKey) {
      throw new Error('Kourier Boyz logistics service is not configured')
    }
    const { data } = await this.internalClient.post('/orders/cancel', payload)
    return data
  }

  async createReturn(payload: unknown) {
    const { data } = await this.getClient().post('/returns', payload)
    return data
  }

  async getLabel(orderId: string) {
    const { data } = await this.getClient().get(`/orders/${encodeURIComponent(orderId)}/label`)
    return data
  }

  async track(awb: string) {
    const { data } = await this.getClient().get('/orders/track', { params: { awb } })
    return data
  }

  async generateManifest(payload: unknown) {
    const { data } = await this.getClient().post('/manifest', payload)
    return data
  }

  async createPickupAddress(payload: unknown) {
    const { data } = await this.getClient().post('/pickup-addresses', payload)
    return data
  }

  async updatePickupAddress(id: string, payload: unknown) {
    const { data } = await this.getClient().put(
      `/pickup-addresses/${encodeURIComponent(id)}`,
      payload,
    )
    return data
  }
}

export const kourierBoyzLogisticsService = new KourierBoyzLogisticsService()
