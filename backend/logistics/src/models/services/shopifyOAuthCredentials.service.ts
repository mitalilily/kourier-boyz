import fs from 'fs/promises'
import path from 'path'
import * as dotenv from 'dotenv'
import { HttpError } from '../../utils/classes'
import { getShopifyOAuthConfig } from './shopify.service'

const SHOPIFY_ENV_KEYS = [
  'SHOPIFY_CLIENT_ID',
  'SHOPIFY_CLIENT_SECRET',
  'SHOPIFY_CREDENTIALS_SOURCE',
  'SHOPIFY_CREDENTIALS_UPDATED_AT',
] as const

const trimText = (value: unknown) => String(value ?? '').trim()

const resolveShopifyEnvFilePath = () => {
  const explicitPath = trimText(process.env.SHOPIFY_OAUTH_ENV_FILE)
  if (explicitPath) return path.resolve(explicitPath)

  const env = trimText(process.env.NODE_ENV) || 'development'
  return path.resolve(process.cwd(), `.env.${env}`)
}

const readEnvFile = async (envFilePath: string) => {
  try {
    return await fs.readFile(envFilePath, 'utf8')
  } catch (error: any) {
    if (error?.code === 'ENOENT') return ''
    throw error
  }
}

const maskSecret = (value: unknown) => {
  const text = trimText(value)
  if (!text) return ''
  if (text.length <= 8) return `${text.slice(0, 2)}****${text.slice(-2)}`
  return `${text.slice(0, 6)}****${text.slice(-4)}`
}

const formatEnvValue = (value: string) => {
  if (/^[A-Za-z0-9_.,:/@+=-]*$/.test(value)) return value
  return JSON.stringify(value)
}

const isPermissionError = (error: any) => error?.code === 'EACCES' || error?.code === 'EPERM'

const writeExistingEnvFileDirectly = async (envFilePath: string, content: string) => {
  const stat = await fs.stat(envFilePath).catch((error: any) => {
    if (error?.code === 'ENOENT') return null
    throw error
  })

  if (!stat?.isFile()) return false

  await fs.writeFile(envFilePath, content, { encoding: 'utf8' })
  return true
}

const writeEnvUpdates = async (envFilePath: string, updates: Record<string, string>) => {
  const content = await readEnvFile(envFilePath)
  const lines = content ? content.split(/\r?\n/) : []
  const seen = new Set<string>()
  const nextLines = lines
    .filter((line, index) => index < lines.length - 1 || line.trim())
    .map((line) => {
      if (!line || line.trimStart().startsWith('#') || !line.includes('=')) return line
      const key = line.split('=', 1)[0].trim()
      if (!Object.prototype.hasOwnProperty.call(updates, key)) return line
      seen.add(key)
      return `${key}=${formatEnvValue(updates[key])}`
    })

  for (const key of Object.keys(updates)) {
    if (!seen.has(key)) nextLines.push(`${key}=${formatEnvValue(updates[key])}`)
  }

  await fs.mkdir(path.dirname(envFilePath), { recursive: true })
  const tempPath = `${envFilePath}.${process.pid}.${Date.now()}.tmp`
  const nextContent = `${nextLines.join('\n')}\n`

  try {
    await fs.writeFile(tempPath, nextContent, { encoding: 'utf8', mode: 0o600 })
    await fs.rename(tempPath, envFilePath)
  } catch (error: any) {
    await fs.unlink(tempPath).catch(() => undefined)

    if (!isPermissionError(error)) {
      throw error
    }

    const usedDirectWrite = await writeExistingEnvFileDirectly(envFilePath, nextContent)
    if (!usedDirectWrite) {
      throw error
    }

    console.warn('[ShopifyOAuth] Used direct env file write because temp file write is not permitted', {
      directory: path.dirname(envFilePath),
      envFile: path.basename(envFilePath),
      errorCode: error?.code || null,
    })
  }

  await fs.chmod(envFilePath, 0o600).catch(() => undefined)
}

const getEnvSnapshot = async () => {
  const envFilePath = resolveShopifyEnvFilePath()
  const content = await readEnvFile(envFilePath)
  const parsed = content ? dotenv.parse(content) : {}
  const clientId = trimText(parsed.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_CLIENT_ID)
  const clientSecret = trimText(parsed.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_CLIENT_SECRET)
  const updatedAt = trimText(parsed.SHOPIFY_CREDENTIALS_UPDATED_AT || process.env.SHOPIFY_CREDENTIALS_UPDATED_AT)
  const source = trimText(parsed.SHOPIFY_CREDENTIALS_SOURCE || process.env.SHOPIFY_CREDENTIALS_SOURCE)

  return { envFilePath, parsed, clientId, clientSecret, source, updatedAt }
}

const buildStatusPayload = async () => {
  const snapshot = await getEnvSnapshot()
  const oauthConfig = getShopifyOAuthConfig()

  return {
    configured: Boolean(snapshot.clientId && snapshot.clientSecret && oauthConfig.redirectUri),
    hasClientId: Boolean(snapshot.clientId),
    hasClientSecret: Boolean(snapshot.clientSecret),
    clientId: snapshot.clientId,
    clientIdMasked: maskSecret(snapshot.clientId),
    clientSecretMasked: maskSecret(snapshot.clientSecret),
    credentialsSource: snapshot.source || 'env',
    credentialsUpdatedAt: snapshot.updatedAt || null,
    envFileName: path.basename(snapshot.envFilePath),
    redirectUri: oauthConfig.redirectUri || null,
    sendOAuthScope: oauthConfig.sendOAuthScope,
    useExpiringOfflineTokens: oauthConfig.useExpiringOfflineTokens,
  }
}

export const getShopifyOAuthCredentialsStatusService = async () => buildStatusPayload()

export const updateShopifyOAuthCredentialsService = async ({
  clientId,
  clientSecret,
  adminUserId,
}: {
  clientId?: unknown
  clientSecret?: unknown
  adminUserId?: string
}) => {
  const snapshot = await getEnvSnapshot()
  const nextClientId = trimText(clientId) || snapshot.clientId
  const nextClientSecret = trimText(clientSecret) || snapshot.clientSecret

  if (!nextClientId) {
    throw new HttpError(400, 'SHOPIFY_CLIENT_ID is required')
  }

  if (!nextClientSecret) {
    throw new HttpError(400, 'SHOPIFY_CLIENT_SECRET is required')
  }

  if (/\s/.test(nextClientId)) {
    throw new HttpError(400, 'SHOPIFY_CLIENT_ID cannot contain spaces')
  }

  if (/\s/.test(nextClientSecret)) {
    throw new HttpError(400, 'SHOPIFY_CLIENT_SECRET cannot contain spaces')
  }

  const updates: Record<string, string> = {
    SHOPIFY_CLIENT_ID: nextClientId,
    SHOPIFY_CLIENT_SECRET: nextClientSecret,
    SHOPIFY_CREDENTIALS_SOURCE: 'admin_panel',
    SHOPIFY_CREDENTIALS_UPDATED_AT: new Date().toISOString(),
  }

  await writeEnvUpdates(snapshot.envFilePath, updates)

  for (const key of SHOPIFY_ENV_KEYS) {
    process.env[key] = updates[key]
  }

  const status = await buildStatusPayload()
  return {
    ...status,
    updatedBy: adminUserId || null,
    secretUpdated: Boolean(trimText(clientSecret)),
  }
}
