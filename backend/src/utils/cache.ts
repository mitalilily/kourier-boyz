import crypto from 'crypto'

type CacheValue<T> = {
  value: T
  expiresAt: number
}

export class InMemoryCache {
  private store = new Map<string, CacheValue<any>>()
  private defaultTtlMs: number

  constructor(defaultTtlSeconds = 300) {
    this.defaultTtlMs = defaultTtlSeconds * 1000
    // periodic cleanup
    setInterval(() => this.cleanup(), 60 * 1000).unref()
  }

  private keyHash(key: string): string {
    return crypto.createHash('sha1').update(key).digest('hex')
  }

  get<T>(key: string): T | undefined {
    const hashed = this.keyHash(key)
    const entry = this.store.get(hashed)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(hashed)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const hashed = this.keyHash(key)
    const expiresAt = Date.now() + (ttlSeconds ? ttlSeconds * 1000 : this.defaultTtlMs)
    this.store.set(hashed, { value, expiresAt })
  }

  private cleanup() {
    const now = Date.now()
    for (const [k, v] of this.store.entries()) {
      if (now > v.expiresAt) this.store.delete(k)
    }
  }
}

export const fiveMinuteCache = new InMemoryCache(300)


