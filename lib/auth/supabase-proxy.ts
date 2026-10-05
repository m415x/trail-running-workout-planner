import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { createSupabaseProxySessionRefresher } from './supabase-proxy-core'

const refreshSession = createSupabaseProxySessionRefresher({
  createClient: ({ url, publishableKey, cookies }) =>
    createServerClient(url, publishableKey, {
      cookies: {
        getAll: cookies.getAll,
        setAll: cookies.setAll,
      },
    }),
  getConfig: () => ({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }),
})

export async function refreshSupabaseProxySession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const result = await refreshSession({
    cookies: {
      getAll: () => request.cookies.getAll(),
      set: (cookie) => {
        request.cookies.set({
          name: cookie.name,
          value: cookie.value,
          ...cookie.options,
        })
      },
    },
  })

  if (result.status === 'verified') {
    response = NextResponse.next({ request })

    for (const cookie of result.cookies) {
      response.cookies.set({
        name: cookie.name,
        value: cookie.value,
        ...cookie.options,
      })
    }

    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
  }

  return {
    status: result.status,
    response,
  }
}
