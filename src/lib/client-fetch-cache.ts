'use client'

type CacheEntry<T> = {
  expiresAt: number
  data?: T
  promise?: Promise<T>
}

const cache = new Map<string, CacheEntry<any>>()
const DEFAULT_TTL_MS = 45_000

function cacheKey(url: string, init?: RequestInit) {
  return `${init?.method || 'GET'}:${url}`
}

export async function fetchJsonCached<T = any>(
  url: string,
  init?: RequestInit,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const method = init?.method || 'GET'
  if (method !== 'GET') {
    const response = await fetch(url, init)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json()
  }

  const key = cacheKey(url, init)
  const now = Date.now()
  const hit = cache.get(key)

  if (hit?.data !== undefined && hit.expiresAt > now) {
    return hit.data as T
  }

  if (hit?.promise) {
    return hit.promise as Promise<T>
  }

  const promise = fetch(url, init).then(async response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.json() as Promise<T>
  })

  cache.set(key, { promise, expiresAt: now + ttlMs })

  try {
    const data = await promise
    cache.set(key, { data, expiresAt: Date.now() + ttlMs })
    return data
  } catch (error) {
    cache.delete(key)
    throw error
  }
}

export function invalidateClientFetchCache(match?: string | RegExp) {
  if (!match) {
    cache.clear()
    return
  }

  Array.from(cache.keys()).forEach(key => {
    if (typeof match === 'string' ? key.includes(match) : match.test(key)) {
      cache.delete(key)
    }
  })
}
