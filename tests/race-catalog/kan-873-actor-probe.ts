/** Test-only provider seam. No cookies, HTTP, network or product bypass. */
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
  assert.ok(basename(dirname(target)).startsWith('kan-873-actors-'))
  assert.equal(basename(target), 'sqlite.db')
  assert.notEqual(canonical(target), canonical(resolve('sqlite.db')))
  assert.equal(process.env.SQLITE_SCENARIO_MODE, '1')
  assert.equal(process.env.EPT_IDENTITY_BACKEND, 'sqlite')
  const actor = process.argv[2]
  assert.ok(['athlete', 'assistant', 'coach', 'admin', 'unlinked', 'invalid'].includes(actor))
  assert.equal(process.env.RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS, '["kan873-other-maintainer"]')

  const subject = 'kan873-subject-' + actor
  const auth: SupabaseServerSessionAuth = {
    async getClaims() {
      return actor === 'invalid'
        ? { data: null, error: { code: 'invalid_token' } }
        : { data: { claims: { sub: subject } }, error: null }
    },
    async getUser() {
      return { data: { user: { id: subject } }, error: null }
    },
  }

  // The real H2 guard and real persisted EPT identity lookup establish
  // the scenario independently of the currently unguarded action.
  const { readEptSessionAccessState } = await import('../../lib/auth/ept-session-access')
  const { requireAuthenticatedEptAction } = await import('../../lib/auth/require-authenticated-action')
  const { createExternalIdentityLookup } = await import('../../lib/auth/external-identity-lookup')
  const h2 = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(auth, createExternalIdentityLookup()),
  })
  if (actor === 'unlinked' || actor === 'invalid') {
    assert.deepEqual(h2, { status: 'forbidden', reason: actor })
  } else {
    assert.deepEqual(h2, { status: 'authenticated', userId: 'kan873-user-' + actor })
  }

  // Replace only the provider adapter in this throwaway tsx process.
  // The project is CJS under tsx; explicitly check the alias resolves
  // to the same replacement before loading the actual action.
  const load = createRequire(resolve('package.json'))
  const providerPath = load.resolve('./lib/auth/supabase-server.ts')
  load(providerPath)
  const cached = load.cache[providerPath]
  assert.ok(cached, 'Provider adapter cache entry missing')
  const original = cached.exports
  let providerCalls = 0
  const fakeClient = async () => {
    providerCalls += 1
    return { auth }
  }
  cached.exports = { createSupabaseServerClient: fakeClient }
  try {
    const seam = load('@/lib/auth/supabase-server') as { createSupabaseServerClient: unknown }
    assert.equal(seam.createSupabaseServerClient, fakeClient, 'Provider seam not active')
    const { saveRaceCatalog } = load('./app/actions/race-catalog-actions.ts') as typeof import('../../app/actions/race-catalog-actions')
    const form = new FormData()
    form.set('kind', 'event')
    form.set('operation', 'save')
    form.set('locale', 'es')
    form.set('name', 'KAN-873 actor probe ' + actor)
    form.set('description', '')
    form.set('websiteUrl', '')
    form.set('status', 'active')

    let returned = false
    let error: unknown = null
    try {
      const result = await saveRaceCatalog({}, form)
      returned = true
      error = result.error ?? null
    } catch {
      // Snapshot is inspected independently of the action outcome.
    }
    console.log('KAN873_ACTOR_RESULT:' + JSON.stringify({
      invoked: true, actor, h2: h2.status, providerCalls, returned, error,
    }))
  } finally {
    cached.exports = original
  }
}

main().catch(error => {
  console.error('KAN-873 actor harness setup failed: ' + (error instanceof Error ? error.message : 'unknown'))
  process.exitCode = 2
})
