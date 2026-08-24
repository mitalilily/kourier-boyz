import assert from 'node:assert/strict'
import http, { IncomingMessage, ServerResponse } from 'node:http'
import { AddressInfo } from 'node:net'
import path from 'node:path'
import axios from 'axios'
import * as dotenv from 'dotenv'

type CliOptions = {
  mock: boolean
  skipWebhooks: boolean
  storeUrl?: string
  accessToken?: string
}

const env = process.env.NODE_ENV || 'development'
dotenv.config({ path: path.resolve(__dirname, `../../.env.${env}`) })

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-04'

const SHOP_QUERY = `
  query Kourier BoyzCheckShop {
    shop {
      id
      name
      myshopifyDomain
      currencyCode
      ianaTimezone
      primaryDomain { host url }
    }
  }
`

const ORDERS_QUERY = `
  query Kourier BoyzCheckOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          legacyResourceId
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          currentTotalPriceSet { shopMoney { amount currencyCode } }
        }
      }
    }
  }
`

const WEBHOOKS_QUERY = `
  query Kourier BoyzCheckWebhooks($topics: [WebhookSubscriptionTopic!]) {
    webhookSubscriptions(first: 50, topics: $topics) {
      edges {
        node {
          id
          topic
          uri
        }
      }
    }
  }
`

const getArgValue = (name: string) => {
  const prefix = `--${name}=`
  const match = process.argv.find((arg) => arg.startsWith(prefix))
  return match ? match.slice(prefix.length).trim() : undefined
}

const hasArg = (name: string) => process.argv.includes(`--${name}`)

const parseCliOptions = (): CliOptions => ({
  mock: hasArg('mock') || String(process.env.SHOPIFY_MOCK || '').toLowerCase() === 'true',
  skipWebhooks:
    hasArg('skip-webhooks') || String(process.env.SHOPIFY_SKIP_WEBHOOK_CHECK || '').toLowerCase() === 'true',
  storeUrl: getArgValue('store-url') || process.env.SHOPIFY_STORE || process.env.SHOPIFY_STORE_URL,
  accessToken:
    getArgValue('access-token') ||
    process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN ||
    process.env.SHOPIFY_ACCESS_TOKEN,
})

const normalizeShopifyDomain = (domain?: string) =>
  String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\/admin(?:\/.*)?$/, '')

const buildGraphqlUrl = (storeUrl: string) => {
  const raw = String(storeUrl || '').trim().replace(/\/+$/, '')
  if (/^https?:\/\//i.test(raw)) {
    const parsed = new URL(raw)
    if (['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
      return `${raw}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
    }
  }
  return `https://${normalizeShopifyDomain(raw)}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
}

const maskToken = (value: string) => {
  const trimmed = String(value || '').trim()
  if (trimmed.length <= 12) return trimmed ? `${trimmed.slice(0, 4)}...` : ''
  return `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`
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

const sendJson = (res: ServerResponse, statusCode: number, body: Record<string, any>) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

const startMockShopifyServer = async () => {
  const captured: string[] = []

  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1')
      const expectedPath = `/admin/api/${SHOPIFY_API_VERSION}/graphql.json`
      captured.push(`${req.method || ''} ${parsedUrl.pathname}`)

      assert.equal(req.method, 'POST')
      assert.equal(parsedUrl.pathname, expectedPath)
      assert.equal(req.headers['x-shopify-access-token'], 'shpat_mock_shopify')

      const body = await readJsonBody(req)
      const query = String(body?.query || '')

      if (query.includes('Kourier BoyzCheckShop')) {
        return sendJson(res, 200, {
          data: {
            shop: {
              id: 'gid://shopify/Shop/123456789',
              name: 'Kourier Boyz Shopify Test Store',
              myshopifyDomain: 'kourier-boyz-test.myshopify.com',
              currencyCode: 'INR',
              ianaTimezone: 'Asia/Kolkata',
              primaryDomain: {
                host: 'kourier-boyz-test.myshopify.com',
                url: 'https://kourier-boyz-test.myshopify.com',
              },
            },
          },
        })
      }

      if (query.includes('Kourier BoyzCheckOrders')) {
        return sendJson(res, 200, {
          data: {
            orders: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/Order/987654321',
                    legacyResourceId: '987654321',
                    name: '#1001',
                    createdAt: '2026-05-22T10:00:00Z',
                    displayFinancialStatus: 'PAID',
                    displayFulfillmentStatus: 'UNFULFILLED',
                    currentTotalPriceSet: {
                      shopMoney: { amount: '1299.00', currencyCode: 'INR' },
                    },
                  },
                },
              ],
            },
          },
        })
      }

      if (query.includes('Kourier BoyzCheckWebhooks')) {
        return sendJson(res, 200, {
          data: {
            webhookSubscriptions: {
              edges: [
                {
                  node: {
                    id: 'gid://shopify/WebhookSubscription/111',
                    topic: 'ORDERS_CREATE',
                    uri: 'https://api.kourierboyz.com/api/webhooks/shopify/order-created',
                  },
                },
              ],
            },
          },
        })
      }

      return sendJson(res, 400, { errors: [{ message: 'Unhandled mock GraphQL operation' }] })
    } catch (error: any) {
      return sendJson(res, 500, { errors: [{ message: error?.message || String(error) }] })
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    captured,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  }
}

const shopifyGraphql = async <T>({
  storeUrl,
  accessToken,
  query,
  variables,
}: {
  storeUrl: string
  accessToken: string
  query: string
  variables?: Record<string, any>
}): Promise<T> => {
  const response = await axios.post(
    buildGraphqlUrl(storeUrl),
    { query, variables },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken.trim(),
      },
      timeout: Number(process.env.PLATFORM_API_TIMEOUT_MS || 15000),
    },
  )

  if (Array.isArray(response.data?.errors) && response.data.errors.length) {
    throw new Error(response.data.errors.map((err: any) => err?.message || JSON.stringify(err)).join('; '))
  }

  return response.data?.data as T
}

const requiredMessage = () => [
  'Missing Shopify credentials.',
  '',
  'Use a real store:',
  '  SHOPIFY_STORE=your-store.myshopify.com',
  '  SHOPIFY_STORE_URL=your-store.myshopify.com',
  '  SHOPIFY_ACCESS_TOKEN=shpat_...',
  '  SHOPIFY_ADMIN_API_ACCESS_TOKEN=shpat_...',
  '  npm run check:shopify-apis',
  '',
  'Or run the built-in mock proof:',
  '  npm run check:shopify-apis -- --mock',
].join('\n')

const main = async () => {
  const options = parseCliOptions()
  let mockServer: Awaited<ReturnType<typeof startMockShopifyServer>> | null = null

  try {
    if (options.mock) {
      mockServer = await startMockShopifyServer()
      options.storeUrl = mockServer.baseUrl
      options.accessToken = 'shpat_mock_shopify'
    }

    const storeUrl = String(options.storeUrl || '').trim()
    const accessToken = String(options.accessToken || '').trim()
    if (!storeUrl || !accessToken) {
      throw new Error(requiredMessage())
    }

    const shopData = await shopifyGraphql<any>({
      storeUrl,
      accessToken,
      query: SHOP_QUERY,
    })

    const ordersData = await shopifyGraphql<any>({
      storeUrl,
      accessToken,
      query: ORDERS_QUERY,
      variables: { first: 5 },
    })

    let webhooksData: any = null
    if (!options.skipWebhooks) {
      webhooksData = await shopifyGraphql<any>({
        storeUrl,
        accessToken,
        query: WEBHOOKS_QUERY,
        variables: { topics: ['ORDERS_CREATE', 'ORDERS_UPDATED', 'ORDERS_CANCELLED'] },
      })
    }

    const orders = ordersData?.orders?.edges?.map((edge: any) => edge.node) || []
    const webhooks = webhooksData?.webhookSubscriptions?.edges?.map((edge: any) => edge.node) || []

    const summary = {
      mode: options.mock ? 'mock' : 'live',
      apiVersion: SHOPIFY_API_VERSION,
      endpoint: buildGraphqlUrl(storeUrl).replace(accessToken, maskToken(accessToken)),
      accessToken: maskToken(accessToken),
      shop: {
        id: shopData?.shop?.legacyResourceId || shopData?.shop?.id,
        name: shopData?.shop?.name,
        myshopifyDomain: shopData?.shop?.myshopifyDomain,
        currency: shopData?.shop?.currencyCode,
      },
      ordersFetched: orders.length,
      firstOrder: orders[0]
        ? {
            id: orders[0].legacyResourceId || orders[0].id,
            name: orders[0].name,
            financialStatus: orders[0].displayFinancialStatus,
            fulfillmentStatus: orders[0].displayFulfillmentStatus,
            total: orders[0].currentTotalPriceSet?.shopMoney?.amount,
          }
        : null,
      webhookSubscriptionsListed: options.skipWebhooks ? 'skipped' : webhooks.length,
      firstWebhook: webhooks[0] || null,
      mockCalls: mockServer?.captured,
    }

    console.log('Shopify API checks passed')
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    await mockServer?.close()
  }
}

main().catch((error) => {
  const responseMessage =
    error?.response?.data?.errors?.[0]?.message ||
    error?.response?.data?.message ||
    error?.message ||
    String(error)

  console.error('Shopify API checks failed')
  console.error(responseMessage)
  process.exit(1)
})
