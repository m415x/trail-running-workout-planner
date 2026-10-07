import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    throw new Error('Supabase Auth public configuration is incomplete')
  }

  const cookieStore = await cookies()

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components expose a read-only cookie store. Proxy refresh
          // remains responsible for rotating cookies before rendering.
        }
      },
    },
  })
}
