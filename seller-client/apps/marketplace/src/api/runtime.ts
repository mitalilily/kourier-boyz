const isLocalRuntime = () =>
  typeof window === 'undefined' || ['localhost', '127.0.0.1'].includes(window.location.hostname)

export const marketplaceSellerApiUrl =
  import.meta.env.VITE_API_URL ||
  (isLocalRuntime() ? 'http://localhost:4000/api/marketplace/seller' : '/api/marketplace/seller')

export const marketplacePublicApiUrl =
  import.meta.env.VITE_PUBLIC_API_URL ||
  (isLocalRuntime() ? 'http://localhost:4000/api/marketplace' : '/api/marketplace')

export const logisticsApiUrl =
  import.meta.env.VITE_LOGISTICS_API_URL ||
  (isLocalRuntime() ? 'http://localhost:4000/api' : '/api')

export const marketplaceSocketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  (isLocalRuntime() ? 'http://localhost:4000' : window.location.origin)
