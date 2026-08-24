import assert from 'node:assert/strict'
import http, { IncomingMessage, ServerResponse } from 'node:http'
import { AddressInfo } from 'node:net'

type CapturedRequest = {
  method: string
  url: string
  authorization?: string
  body: any
}

const readJsonBody = async (req: IncomingMessage) =>
  new Promise<any>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('error', reject)
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(null)
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
  })

const sendJson = (res: ServerResponse, statusCode: number, body: Record<string, any> | any[]) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const startMockEkartServer = async () => {
  const captured: CapturedRequest[] = []

  const server = http.createServer(async (req, res) => {
    try {
      const body = await readJsonBody(req)
      const url = req.url || ''
      captured.push({
        method: req.method || '',
        url,
        authorization: req.headers.authorization,
        body,
      })

      if (req.method === 'POST' && url === '/integrations/v2/auth/token/mock-client') {
        assert.equal(body?.username, 'mock-user')
        assert.equal(body?.password, 'mock-pass')
        return sendJson(res, 200, {
          access_token: 'mock-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        })
      }

      if (req.method === 'POST' && url === '/data/v3/serviceability') {
        assert.equal(req.headers.authorization, 'Bearer mock-access-token')
        assert.equal(body?.pickupPincode, '560103')
        assert.equal(body?.dropPincode, '110001')
        assert.equal(body?.paymentType, 'COD')
        assert.equal(body?.invoiceAmount, '499')
        return sendJson(res, 200, {
          status: 'success',
          data: {
            serviceability: {
              forward: { pickup: true, drop: true },
              payment_modes: { cod: true, prepaid: true },
              tat: { min: 2, max: 4 },
              forwardDeliveredCharges: 55,
            },
          },
        })
      }

      if (req.method === 'GET' && url === '/data/serviceability/bulk/NON_LARGE?format=JSON') {
        assert.equal(req.headers.authorization, 'Bearer mock-access-token')
        return sendJson(res, 200, {
          serviceability: [
            {
              pincode: 560008,
              fm: true,
              lmCod: true,
              lmPrepaid: true,
              rvp: true,
            },
          ],
        })
      }

      if (req.method === 'GET' && url === '/api/v2/addresses') {
        assert.equal(req.headers.authorization, 'Bearer mock-access-token')
        return sendJson(res, 200, [
          {
            alias: 'BLR Warehouse',
            phone: 9876543210,
            address_line1: 'Embassy Tech Village',
            address_line2: null,
            pincode: 560103,
            city: 'Bengaluru',
            state: 'Karnataka',
            country: 'India',
          },
        ])
      }

      if (req.method === 'GET' && url === '/api/v2/webhook') {
        assert.equal(req.headers.authorization, 'Bearer mock-access-token')
        return sendJson(res, 200, [
          {
            id: 'wh_123',
            url: 'https://example.com/ekart/webhook',
            secret: 'secret123',
            topics: ['track_updated'],
            active: true,
          },
        ])
      }

      if (req.method === 'POST' && url === '/api/v2/webhook') {
        assert.equal(req.headers.authorization, 'Bearer mock-access-token')
        assert.equal(body?.url, 'https://example.com/ekart/webhook')
        return sendJson(res, 200, {
          id: 'wh_124',
          url: body?.url,
          secret: body?.secret,
          topics: body?.topics,
          active: body?.active ?? true,
        })
      }

      if (req.method === 'PUT' && url === '/api/v2/webhook/wh_124') {
        assert.equal(req.headers.authorization, 'Bearer mock-access-token')
        assert.equal(body?.active, false)
        return sendJson(res, 200, {
          id: 'wh_124',
          url: 'https://example.com/ekart/webhook',
          secret: 'secret123',
          topics: ['track_updated'],
          active: false,
        })
      }

      if (req.method === 'POST' && url === '/data/pricing/estimate') {
        assert.equal(req.headers.authorization, 'Bearer mock-access-token')
        assert.equal(body?.pickupPincode, 560103)
        assert.equal(body?.dropPincode, 110001)
        assert.equal(body?.serviceType, 'SURFACE')
        return sendJson(res, 200, {
          type: 'WEIGHT_BASED',
          zone: 'A',
          volumetricWeight: '0.5',
          billingWeight: '0.5',
          shippingCharge: '45',
          rtoCharge: '20',
          fuelSurcharge: '5',
          codCharge: '10',
          qcCharge: '0',
          taxes: '9',
          total: '89',
          rid: 'RID123',
          rSnapshotId: 'RSNP123',
        })
      }

      if (req.method === 'PUT' && url === '/api/v1/package/create') {
        assert.equal(req.headers.authorization, 'Bearer mock-access-token')
        assert.equal(body?.pickup_location?.name, 'BLR Warehouse')
        assert.equal(body?.pickup?.pincode, 560103)
        assert.equal(body?.drop?.pincode, 110001)
        assert.equal(body?.weight, 0.5)
        return sendJson(res, 200, {
          status: true,
          tracking_id: 'EKARTMOCK123',
          shipment_id: 'SHIPMOCK123',
          manifest: 'MANIFESTMOCK123',
        })
      }

      return sendJson(res, 404, { message: `Unhandled mock endpoint ${req.method} ${url}` })
    } catch (error: any) {
      return sendJson(res, 500, { message: error?.message || String(error) })
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    captured,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}

const main = async () => {
  const mock = await startMockEkartServer()

  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres'
  process.env.EKART_BASE_API = mock.baseUrl
  process.env.EKART_BASE_AUTH = mock.baseUrl
  process.env.EKART_CLIENT_ID = 'mock-client'
  process.env.EKART_USERNAME = 'mock-user'
  process.env.EKART_PASSWORD = 'mock-pass'
  process.env.EKART_SERVICEABILITY_BASE_API = mock.baseUrl
  process.env.EKART_SERVICEABILITY_ENDPOINTS = '/data/v3/serviceability'
  process.env.EKART_ADDRESS_BASE_API = mock.baseUrl
  process.env.EKART_BULK_SERVICEABILITY_BASE_API = mock.baseUrl
  process.env.EKART_BULK_SERVICEABILITY_ENDPOINT = '/data/serviceability/bulk'
  process.env.EKART_ADDRESSES_BASE_API = mock.baseUrl
  process.env.EKART_ADDRESSES_ENDPOINT = '/api/v2/addresses'
  process.env.EKART_WEBHOOK_BASE_API = mock.baseUrl
  process.env.EKART_WEBHOOK_ENDPOINT = '/api/v2/webhook'
  process.env.EKART_ESTIMATE_BASE_API = mock.baseUrl
  process.env.EKART_ESTIMATE_ENDPOINT = '/data/pricing/estimate'

  try {
    const { EkartService } = await import('../models/services/couriers/ekart.service')
    ;(EkartService as any).cachedConfig = null

    const ekart = new EkartService()
    const serviceability = await ekart.checkServiceability({
      pickupPincode: '560103',
      dropPincode: '110001',
      length: '10',
      height: '10',
      width: '10',
      weight: '0.5',
      paymentType: 'COD',
      invoiceAmount: '499',
      codAmount: '499',
    })

    assert.equal(serviceability.serviceable, true)
    assert.equal(serviceability.codAvailable, true)
    assert.equal(serviceability.prepaidAvailable, true)
    assert.equal(serviceability.tat, 2)

    const bulkServiceability = await ekart.getBulkServiceability('NON_LARGE')
    assert.equal(bulkServiceability?.serviceability?.[0]?.pincode, 560008)

    const addresses = await ekart.listAddresses()
    assert.equal(addresses?.[0]?.alias, 'BLR Warehouse')

    const webhooks = await ekart.listWebhooks()
    assert.equal(webhooks?.[0]?.id, 'wh_123')

    const createdWebhook = await ekart.createWebhook({
      url: 'https://example.com/ekart/webhook',
      secret: 'secret123',
      topics: ['track_updated'],
      active: true,
    })
    assert.equal(createdWebhook?.id, 'wh_124')

    const updatedWebhook = await ekart.updateWebhook('wh_124', { active: false })
    assert.equal(updatedWebhook?.active, false)

    const estimate = await ekart.estimatePricing({
      pickupPincode: 560103,
      dropPincode: 110001,
      invoiceAmount: 499,
      weight: 500,
      length: 10,
      height: 10,
      width: 10,
      serviceType: 'SURFACE',
      codAmount: 499,
    })
    assert.equal(estimate?.total, '89')

    const shipment = await ekart.createShipment({
      order_number: 'EKART_TEST_ORDER',
      payment_type: 'cod',
      order_amount: 499,
      package_weight: 500,
      package_length: 10,
      package_breadth: 10,
      package_height: 10,
      pickup_location_alias: 'BLR Warehouse',
      company: { name: 'Kourier Boyz Test', gst: '' },
      consignee: {
        name: 'Test Buyer',
        address: 'Connaught Place',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
        phone: '9876543210',
        email: 'buyer@example.com',
      },
      pickup: {
        warehouse_name: 'BLR Warehouse',
        name: 'Ops User',
        address: 'Embassy Tech Village',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560103',
        phone: '9876543210',
      },
      rto: {
        warehouse_name: 'BLR Warehouse',
        name: 'Ops User',
        address: 'Embassy Tech Village',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560103',
        phone: '9876543210',
      },
      order_items: [
        {
          name: 'Test Product',
          sku: 'SKU-1',
          qty: 1,
          price: 499,
          hsn: '1234',
          discount: 0,
          tax_rate: 0,
        },
      ],
    })

    assert.equal(shipment.tracking_id, 'EKARTMOCK123')

    const summary = {
      authCalls: mock.captured.filter((req) => req.url.includes('/auth/token')).length,
      serviceabilityCalls: mock.captured.filter((req) => req.url === '/data/v3/serviceability').length,
      bulkServiceabilityCalls: mock.captured.filter((req) =>
        req.url === '/data/serviceability/bulk/NON_LARGE?format=JSON').length,
      addressesCalls: mock.captured.filter((req) => req.url === '/api/v2/addresses').length,
      listWebhookCalls: mock.captured.filter((req) => req.method === 'GET' && req.url === '/api/v2/webhook').length,
      createWebhookCalls: mock.captured.filter((req) => req.method === 'POST' && req.url === '/api/v2/webhook').length,
      updateWebhookCalls: mock.captured.filter((req) => req.method === 'PUT' && req.url === '/api/v2/webhook/wh_124').length,
      estimateCalls: mock.captured.filter((req) => req.url === '/data/pricing/estimate').length,
      shipmentCalls: mock.captured.filter((req) => req.url === '/api/v1/package/create').length,
      serviceable: serviceability.serviceable,
      trackingId: shipment.tracking_id,
    }

    console.log('Ekart integration mock checks passed')
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await mock.close()
  }
}

main().catch((error) => {
  console.error('Ekart integration mock checks failed')
  console.error(error)
  process.exit(1)
})
