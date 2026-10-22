import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'

import { carryAuthRefreshIntoResponse } from '@/lib/auth/proxy-response'
import { refreshSupabaseProxySession } from '@/lib/auth/supabase-proxy'
import { routing } from '@/i18n/routing'
import { normalizeLocalSpanishRewrite } from '@/lib/i18n/normalize-local-rewrite'

const intlMiddleware = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  const auth = await refreshSupabaseProxySession(request)
  const localizedResponse = intlMiddleware(request)

  const beforeRewrite = localizedResponse.headers.get('x-middleware-rewrite')
  const normalized = normalizeLocalSpanishRewrite(request, localizedResponse)
  const finalResponse = carryAuthRefreshIntoResponse(auth.response, normalized)
  if (process.env.KAN_HTTP_FIXTURE_DIAGNOSTICS === '1' && process.env.KAN_HTTP_FIXTURE_DIST_DIR) {
    // Fixture-only boundary probe: never log credentials, cookies or arbitrary request headers.
    console.info('KAN-849 PROXY_BOUNDARY ' + JSON.stringify({
      url: request.url,
      nextUrl: request.nextUrl.href,
      host: request.headers.get('host'),
      beforeRewrite,
      afterRewrite: normalized.headers.get('x-middleware-rewrite'),
      responseRewrite: finalResponse.headers.get('x-middleware-rewrite'),
      location: finalResponse.headers.get('location'),
    }))
  }
  return finalResponse
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
