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
    const { data } = await this.getClient().post('/shipping/rates', payload)
    return data
  }

  async createOrder(payload: unknown) {
    const { data } = await this.getClient().post('/orders', payload)
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
