import assert from 'node:assert/strict'
import test from 'node:test'
import { createServerClient } from '@supabase/ssr'
import { resolveKan791AcceptanceIdentity } from '../../lib/auth/kan-791-acceptance-identity'

/**
 * Dedicated operator credentials only. No token, cookie value, password or
 * subject is written to stdout, snapshots or repo files.
 * Missing credentials intentionally classify as BLOCKED, not authentication PASS.
 */
test('KAN-854/T3 obtains authentic Supabase SSR cookies for dedicated operator identity when available', { timeout: 45_000 }, async () => {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'KAN791_AUTH_TEST_PASSWORD', 'KAN791_ACCEPTANCE_EMAIL', 'KAN791_ACCEPTANCE_SUBJECT'] as const
  const missing = required.filter(name => !process.env[name]?.trim())
  if (missing.length) {
    process.stdout.write('KAN-854 T3_SUPABASE_SSR ' + JSON.stringify({
      outcome:'BLOCKED', reason:'dedicated-credentials-not-configured', missingVariableNames:missing,
      validatedSession:false, authenticSsrCookies:false, eptScope:'not-evaluated',
    }) + '\n')
    return
  }
  assert.notEqual(process.env.CI, 'true', 'EXPERIMENT_SETUP_ERROR: no real Supabase login in CI')
  assert.notEqual(process.env.NODE_ENV, 'production', 'EXPERIMENT_SETUP_ERROR: no real Supabase login under production')
  const expected = resolveKan791AcceptanceIdentity({
    email:process.env.KAN791_ACCEPTANCE_EMAIL!,
    subject:process.env.KAN791_ACCEPTANCE_SUBJECT!,
  })
  type Cookie = {name:string;value:string;options?:Record<string,unknown>}
  const stored = new Map<string,Cookie>()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => [...stored.values()],
        setAll: (cookies) => {
          for (const cookie of cookies) {
            if (cookie.value) stored.set(cookie.name, cookie as Cookie)
            else stored.delete(cookie.name)
          }
        },
      },
      auth: { autoRefreshToken:false, detectSessionInUrl:false, persistSession:true },
    },
  )
  try {
    const login = await client.auth.signInWithPassword({
      email:expected.email, password:process.env.KAN791_AUTH_TEST_PASSWORD!,
    })
    assert.ok(!login.error && login.data.session, 'EXPERIMENT_SETUP_ERROR: dedicated Supabase password login failed')
    const verified = await client.auth.getUser()
    assert.ok(!verified.error && verified.data.user, 'EXPERIMENT_SETUP_ERROR: dedicated Supabase getUser failed')
    assert.equal(verified.data.user.id.toLowerCase(), expected.subject, 'EXPERIMENT_INCONCLUSIVE: unexpected authenticated subject')
    assert.equal(verified.data.user.email?.toLowerCase(), expected.email, 'EXPERIMENT_INCONCLUSIVE: unexpected authenticated email')
    assert.ok(stored.size > 0, 'EXPERIMENT_SETUP_ERROR: @supabase/ssr generated no session cookies')
    assert.ok([...stored.values()].some(cookie => cookie.name.startsWith('sb-')), 'EXPERIMENT_SETUP_ERROR: real SSR cookie missing')
    process.stdout.write('KAN-854 T3_SUPABASE_SSR ' + JSON.stringify({
      outcome:'AUTHENTICATED', provider:'supabase', verifiedSubject:true,
      authenticSsrCookies:true, cookieCount:stored.size,
      cookieNames:[...stored.keys()], eptScope:'not-evaluated', httpRoutes:'not-evaluated',
    }) + '\n')
  } finally {
    await client.auth.signOut().catch(()=>undefined)
    stored.clear()
  }
})
