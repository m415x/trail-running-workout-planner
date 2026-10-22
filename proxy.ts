import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'

import { carryAuthRefreshIntoResponse } from '@/lib/auth/proxy-response'
import { refreshSupabaseProxySession } from '@/lib/auth/supabase-proxy'
import { routing } from '@/i18n/routing'
import { normalizeLocalSpanishRewrite } from '@/lib/i18n/normalize-local-rewrite'

const intlMiddleware = createMiddleware(routing)
let fixtureInvocationSequence = 0

export async function proxy(request: NextRequest) {
  const diagnostic = process.env.KAN_HTTP_FIXTURE_DIAGNOSTICS === '1' && Boolean(process.env.KAN_HTTP_FIXTURE_DIST_DIR)
  const invocation = diagnostic ? ++fixtureInvocationSequence : null
  // Logging is deliberately restricted to fixed diagnostic fields and URL pathnames.
  const observe = (stage: string, response?: { status: number; headers: Headers }) => {
    if (!diagnostic) return
    console.info('KAN-849 PROXY_STAGE ' + JSON.stringify({
      invocation,
      stage,
      url: new URL(request.url).origin + new URL(request.url).pathname,
      host: request.headers.get('host'),
      status: response?.status ?? null,
      location: response?.headers.get('location') ?? null,
      rewrite: response?.headers.get('x-middleware-rewrite') ?? null,
    }))
  }

  observe('entry')
  const auth = await refreshSupabaseProxySession(request)
  observe('before-intl')
  const localizedResponse = intlMiddleware(request)
  observe('after-intl', localizedResponse)

  const normalized = normalizeLocalSpanishRewrite(request, localizedResponse)
  observe('after-normalizer', normalized)
  const finalResponse = carryAuthRefreshIntoResponse(auth.response, normalized)
  observe('after-auth-carry', finalResponse)
  return finalResponse
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
