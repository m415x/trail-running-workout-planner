/** Isolated test adapter: real H2 resolution and writer; no live Supabase or Next request. */
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import type { SupabaseServerSessionAuth } from '../../lib/auth/supabase-server-session-state'

async function main() {
  const target = realpathSync(process.env.SQLITE_DATABASE_PATH ?? '')
  const canonical = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
  assert.equal(canonical(dirname(dirname(target))), canonical(realpathSync(tmpdir())))
  assert.ok(basename(dirname(target)).startsWith('kan-874-maintainer-'))
  assert.equal(basename(target), 'sqlite.db')
  assert.notEqual(canonical(target), canonical(resolve('sqlite.db')))
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.SQLITE_SCENARIO_MODE, '1')
  assert.equal(process.env.EPT_IDENTITY_BACKEND, 'sqlite')

  const subject = 'kan874-maintainer-subject'
  const auth: SupabaseServerSessionAuth = {
    async getClaims() { return { data: { claims: { sub: subject } }, error: null } },
    async getUser() { return { data: { user: { id: subject } }, error: null } },
  }
  const { readEptSessionAccessState } = await import('../../lib/auth/ept-session-access')
  const { requireAuthenticatedEptAction } = await import('../../lib/auth/require-authenticated-action')
  const { createExternalIdentityLookup } = await import('../../lib/auth/external-identity-lookup')
  assert.deepEqual(await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(auth, createExternalIdentityLookup()),
  }), { status: 'authenticated', userId: 'kan874-maintainer' })

  const load = createRequire(resolve('package.json'))
  const restore: Array<() => void> = []
  function replaceExports(moduleId: string, replacements: Record<string, unknown>) {
    const modulePath = load.resolve(moduleId)
    load(modulePath)
    const cached = load.cache[modulePath]
    assert.ok(cached, 'Expected isolated CJS module cache entry')
    const original = cached.exports
    cached.exports = { ...original, ...replacements }
    restore.push(() => { cached.exports = original })
    for (const [key, value] of Object.entries(replacements)) assert.equal(load(moduleId)[key], value)
  }

  let providerCalls = 0
  const revalidations: Array<[string, string | undefined]> = []
  const redirects: string[] = []
  const redirectSignal = new Error('KAN874_TEST_REDIRECT')
  const fakeClient = async () => { providerCalls += 1; return { auth } }

  try {
    replaceExports('./lib/auth/supabase-server.ts', { createSupabaseServerClient: fakeClient })
    assert.equal(load('@/lib/auth/supabase-server').createSupabaseServerClient, fakeClient)
    replaceExports('next/cache', {
      revalidatePath: (path: string, type?: string) => { revalidations.push([path, type]) },
    })
    replaceExports('next/navigation', {
      redirect: (destination: string): never => { redirects.push(destination); throw redirectSignal },
    })
    const { saveRaceCatalog } = load('./app/actions/race-catalog-actions.ts') as typeof import('../../app/actions/race-catalog-actions')
    const label = process.argv[2]
    assert.ok(label && /^[a-z0-9-]+$/.test(label))
    const form = new FormData()
    form.set('kind', 'event')
    form.set('operation', 'save')
    form.set('locale', 'es')
    form.set('name', 'KAN-874 maintainer probe ' + label)
    form.set('description', '')
    form.set('websiteUrl', '')
    form.set('status', 'active')

    let returned = false
    let error: unknown = null
    let redirected = false
    try {
      const result = await saveRaceCatalog({}, form)
      returned = true
      error = result.error ?? null
    } catch (cause) {
      assert.equal(cause, redirectSignal, 'Unexpected action exception')
      redirected = true
    }
    console.log('KAN874_RESULT:' + JSON.stringify({ returned, error, redirected, providerCalls, revalidations, redirects }))
  } finally {
    for (const reset of restore.reverse()) reset()
  }
}

main().catch(error => {
  console.error('KAN-874 maintainer harness failed: ' + (error instanceof Error ? error.message : 'unknown'))
  process.exitCode = 2
})
