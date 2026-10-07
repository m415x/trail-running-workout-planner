import createMiddleware from 'next-intl/middleware'
import type { NextRequest } from 'next/server'

import { carryAuthRefreshIntoResponse } from '@/lib/auth/proxy-response'
import { refreshSupabaseProxySession } from '@/lib/auth/supabase-proxy'
import { routing } from '@/i18n/routing'

const intlMiddleware = createMiddleware(routing)

export async function proxy(request: NextRequest) {
  const auth = await refreshSupabaseProxySession(request)
  const localizedResponse = intlMiddleware(request)

  return carryAuthRefreshIntoResponse(auth.response, localizedResponse)
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
