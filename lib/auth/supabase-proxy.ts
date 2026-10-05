import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function refreshSupabaseProxySession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set({ name, value, ...options })
          })

          response = NextResponse.next({ request })

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    },
  )

  try {
    const { data, error } = await supabase.auth.getClaims()

    if (error || !data?.claims?.sub) {
      return {
        status: 'invalid' as const,
        response,
      }
    }

    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return {
      status: 'verified' as const,
      response,
    }
  } catch {
    return {
      status: 'invalid' as const,
      response,
    }
  }
}
