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

  return carryAuthRefreshIntoResponse(auth.response, normalizeLocalSpanishRewrite(request, localizedResponse))
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
