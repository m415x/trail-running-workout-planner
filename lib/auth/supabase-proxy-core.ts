export interface SupabaseProxyCookie {
  name: string
  value: string
  options?: Record<string, unknown>
}

export interface SupabaseProxyRequestLike {
  cookies: {
    getAll(): SupabaseProxyCookie[]
    set(cookie: SupabaseProxyCookie): void
  }
}

export interface SupabaseProxyClientFactoryInput {
  url: string
  publishableKey: string
  cookies: {
    getAll(): SupabaseProxyCookie[]
    setAll(cookies: SupabaseProxyCookie[]): void
  }
}

export interface SupabaseProxyClientFactory {
  (input: SupabaseProxyClientFactoryInput): {
    auth: {
      getClaims(): Promise<{
        data: {
          claims: {
            sub?: string | null
          }
        } | null
        error: unknown
      }>
    }
  }
}

export interface SupabaseProxyConfig {
  url?: string
  publishableKey?: string
}

export type SupabaseProxyRefreshResult =
  | {
      status: 'verified'
      cookies: SupabaseProxyCookie[]
    }
  | {
      status: 'invalid'
      cookies: SupabaseProxyCookie[]
    }

export function createSupabaseProxySessionRefresher(input: {
  createClient: SupabaseProxyClientFactory
  getConfig: () => SupabaseProxyConfig
}) {
  return async function refresh(
    request: SupabaseProxyRequestLike,
  ): Promise<SupabaseProxyRefreshResult> {
    const config = input.getConfig()
    const url = config.url?.trim()
    const publishableKey = config.publishableKey?.trim()

    if (!url || !publishableKey) {
      return { status: 'invalid', cookies: [] }
    }

    const rotatedCookies: SupabaseProxyCookie[] = []

    try {
      const client = input.createClient({
        url,
        publishableKey,
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookies) => {
            rotatedCookies.splice(0, rotatedCookies.length, ...cookies)

            for (const cookie of cookies) {
              request.cookies.set(cookie)
            }
          },
        },
      })

      const { data, error } = await client.auth.getClaims()

      if (error || !data?.claims?.sub?.trim()) {
        return { status: 'invalid', cookies: [] }
      }

      return {
        status: 'verified',
        cookies: rotatedCookies,
      }
    } catch {
      return { status: 'invalid', cookies: [] }
    }
  }
}
