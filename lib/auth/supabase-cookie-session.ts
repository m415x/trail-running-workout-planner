export interface AuthCookie {
  name: string
  value: string
  options?: Record<string, unknown>
}

export interface AuthCookieRequest {
  getAll(): AuthCookie[]
  set(cookie: AuthCookie): void
}

export interface AuthCookieResponse {
  setCookie(cookie: AuthCookie): void
  setHeader(name: string, value: string): void
}

export interface SupabaseServerClientFactoryInput {
  cookies: {
    getAll(): AuthCookie[]
    setAll(
      cookies: AuthCookie[],
      headers?: Record<string, string>,
    ): void
  }
}

export interface SupabaseServerClient {
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

export type SupabaseServerClientFactory = (
  input: SupabaseServerClientFactoryInput,
) => SupabaseServerClient

export type RefreshSupabaseAuthCookiesResult =
  | { status: 'verified' }
  | { status: 'invalid' }

export async function refreshSupabaseAuthCookies(input: {
  request: AuthCookieRequest
  response: AuthCookieResponse
  createClient: SupabaseServerClientFactory
}): Promise<RefreshSupabaseAuthCookiesResult> {
  const client = input.createClient({
    cookies: {
      getAll: () => input.request.getAll(),
      setAll: (cookies, headers = {}) => {
        for (const cookie of cookies) {
          input.request.set(cookie)
          input.response.setCookie(cookie)
        }

        for (const [name, value] of Object.entries(headers)) {
          input.response.setHeader(name, value)
        }
      },
    },
  })

  try {
    const { data, error } = await client.auth.getClaims()

    if (error || !data?.claims?.sub?.trim()) {
      return { status: 'invalid' }
    }

    return { status: 'verified' }
  } catch {
    return { status: 'invalid' }
  }
}
