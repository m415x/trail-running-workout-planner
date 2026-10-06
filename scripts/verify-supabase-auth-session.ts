import { createClient } from '@supabase/supabase-js'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

async function main(): Promise<void> {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const publishableKey = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
  const email = requireEnv('SUPABASE_AUTH_TEST_EMAIL')
  const password = requireEnv('SUPABASE_AUTH_TEST_PASSWORD')

  const supabase = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  try {
    const signIn = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signIn.error || !signIn.data.session) {
      throw signIn.error ?? new Error('Supabase Auth test login did not return a session')
    }

    const claimsResult = await supabase.auth.getClaims()

    if (claimsResult.error || !claimsResult.data?.claims?.sub) {
      throw claimsResult.error ?? new Error('Supabase Auth claims verification failed')
    }

    const userResult = await supabase.auth.getUser()

    if (userResult.error || !userResult.data.user) {
      throw userResult.error ?? new Error('Supabase Auth user verification failed')
    }

    const claimsSubject = claimsResult.data.claims.sub.trim()
    const userSubject = userResult.data.user.id.trim()

    if (!claimsSubject || !userSubject || claimsSubject !== userSubject) {
      throw new Error('Supabase Auth claims/user subject mismatch')
    }

    process.stdout.write(`Supabase Auth session verified for subject ${claimsSubject}\n`)
  } finally {
    await supabase.auth.signOut()
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
