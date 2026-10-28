import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'

import { carryAuthRefreshIntoResponse } from '@/lib/auth/proxy-response'
import { refreshSupabaseProxySession } from '@/lib/auth/supabase-proxy'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  const auth = await refreshSupabaseProxySession(request)
  const localizedResponse = intlMiddleware(request)

  const response = carryAuthRefreshIntoResponse(auth.response, localizedResponse)
  if (process.env.KAN855_PROXY_DIAGNOSTICS === '1') {
    // Diagnostic-only: observe decisions, never log cookies or authorization headers.
    const safe = (value: string | null) => value ? new URL(value, request.url).pathname : null
    console.info('[KAN-855 proxy]', JSON.stringify({
      requestPath: request.nextUrl.pathname,
      intlStatus: localizedResponse.status,
      intlLocation: safe(localizedResponse.headers.get('location')),
      intlRewrite: safe(localizedResponse.headers.get('x-middleware-rewrite')),
      finalProxyStatus: localizedResponse.status,
      finalProxyLocation: safe(response.headers.get('location')),
      finalProxyRewrite: safe(response.headers.get('x-middleware-rewrite')),
    }))
  }
  return response
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
