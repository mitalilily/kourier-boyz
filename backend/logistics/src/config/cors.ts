const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '').toLowerCase()

const splitOrigins = (value?: string) =>
  (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

const builtInOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5176',
  'https://admin.kourierboyz.com',
  'https://seller.kourierboyz.com',
]

export const getAllowedOrigins = () =>
  new Set(
    [
      ...builtInOrigins,
      ...splitOrigins(process.env.CORS_ALLOWED_ORIGINS),
      ...splitOrigins(process.env.CORS_ORIGINS),
      ...splitOrigins(process.env.FRONTEND_URL),
      ...splitOrigins(process.env.ADMIN_URL),
    ].map(normalizeOrigin),
  )

export const isAllowedOrigin = (origin: string) => {
  const normalizedOrigin = normalizeOrigin(origin)
  return getAllowedOrigins().has(normalizedOrigin)
}

export const corsOriginCallback = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => {
  if (!origin || isAllowedOrigin(origin)) {
    callback(null, true)
    return
  }

  callback(new Error(`Not allowed by CORS: ${origin}`))
}
