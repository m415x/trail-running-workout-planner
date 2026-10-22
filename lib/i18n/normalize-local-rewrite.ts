import type { NextRequest, NextResponse } from 'next/server'

/**
 * Next 16 may treat next-intl's absolute localhost rewrite as cross-origin when
 * the development server is bound to 127.0.0.1. Keep the internal locale rewrite
 * relative; never modify real redirects, foreign hosts, or authentication data.
 */
export function normalizeLocalSpanishRewrite(request: NextRequest, response: NextResponse): NextResponse {
  const rewrite = response.headers.get('x-middleware-rewrite')
  if (!rewrite || !/^https?:\/\//i.test(rewrite)) return response

  const target = new URL(rewrite)
  const origin = request.nextUrl
  const originalHost = request.headers.get('host')
  if (
    !originalHost || new URL('http://' + originalHost).hostname !== '127.0.0.1' ||
    target.hostname !== 'localhost' ||
    target.protocol !== origin.protocol ||
    target.port !== origin.port ||
    (target.pathname !== '/es' && !target.pathname.startsWith('/es/')) ||
    response.headers.has('location')
  ) return response

  response.headers.set('x-middleware-rewrite', new URL(target.pathname + target.search, `${origin.protocol}//${originalHost}`).toString())
  return response
}
