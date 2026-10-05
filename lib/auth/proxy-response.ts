export interface ProxyCookie {
  name: string
  value: string
  options?: Record<string, unknown>
}

export interface ProxyResponseLike {
  cookies: {
    getAll(): ProxyCookie[]
    set(cookie: ProxyCookie): void
  }
  headers: {
    get(name: string): string | null
    set(name: string, value: string): void
  }
}

const AUTH_CACHE_HEADERS = ['cache-control', 'expires', 'pragma'] as const

export function carryAuthRefreshIntoResponse(
  authResponse: ProxyResponseLike,
  localizedResponse: ProxyResponseLike,
): ProxyResponseLike {
  for (const cookie of authResponse.cookies.getAll()) {
    localizedResponse.cookies.set(cookie)
  }

  for (const headerName of AUTH_CACHE_HEADERS) {
    const value = authResponse.headers.get(headerName)

    if (value !== null) {
      localizedResponse.headers.set(headerName, value)
    }
  }

  return localizedResponse
}
