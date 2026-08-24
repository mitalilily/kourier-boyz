import { eq } from 'drizzle-orm'
import { db } from '../client'
import { courier_credentials } from '../schema/courierCredentials'

const DEFAULT_DELHIVERY_API_BASE = 'https://track.delhivery.com'
const DEFAULT_DELHIVERY_LTL_API_BASE = 'https://ltl-clients-api.delhivery.com'

export interface DelhiveryCredentials {
  apiBase: string
  clientName: string
  apiKey: string
  ltlApiBase: string
  ltlUsername: string
  ltlToken: string
  ltlTokenExpiresAt: string
  ltlEmail: string
  ltlPassword: string
}

export const getDelhiveryCredentials = async (): Promise<DelhiveryCredentials> => {
  const [credentials] = await db
    .select({
      apiBase: courier_credentials.apiBase,
      clientName: courier_credentials.clientName,
      apiKey: courier_credentials.apiKey,
      metadata: courier_credentials.metadata,
    })
    .from(courier_credentials)
    .where(eq(courier_credentials.provider, 'delhivery'))
    .limit(1)

  const metadata =
    credentials?.metadata && typeof credentials.metadata === 'object' ? credentials.metadata : {}

  return {
    apiBase: credentials?.apiBase || DEFAULT_DELHIVERY_API_BASE,
    clientName: credentials?.clientName || '',
    apiKey: credentials?.apiKey || '',
    ltlApiBase:
      String((metadata as Record<string, unknown>)?.ltlApiBase || (metadata as Record<string, unknown>)?.ltl_api_base || '').trim() ||
      DEFAULT_DELHIVERY_LTL_API_BASE,
    ltlUsername:
      String((metadata as Record<string, unknown>)?.ltlUsername || (metadata as Record<string, unknown>)?.ltl_username || '').trim(),
    ltlToken:
      String((metadata as Record<string, unknown>)?.ltlToken || (metadata as Record<string, unknown>)?.ltl_token || '').trim(),
    ltlTokenExpiresAt:
      String(
        (metadata as Record<string, unknown>)?.ltlTokenExpiresAt ||
          (metadata as Record<string, unknown>)?.ltl_token_expires_at ||
          '',
      ).trim(),
    ltlEmail:
      String((metadata as Record<string, unknown>)?.ltlEmail || (metadata as Record<string, unknown>)?.ltl_email || '').trim(),
    ltlPassword:
      String((metadata as Record<string, unknown>)?.ltlPassword || (metadata as Record<string, unknown>)?.ltl_password || '').trim(),
  }
}
