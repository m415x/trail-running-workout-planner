/** Test-only provider/navigation seams. Catalog repository, transactions and H2 remain real. */
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import type { SupabaseServerSessionAuth } from '../../lib/auth/supabase-server-session-state'
import { actors, kinds, operations, makeKan875Form, snapshotKan875, maintainer } from './kan-875-fixture'

async function main() {
  const target = realpathSync(process.env.SQLITE_DATABASE_PATH ?? '')
  const canonical = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
  assert.equal(canonical(dirname(dirname(target))), canonical(realpathSync(tmpdir())))
  assert.ok(basename(dirname(target)).startsWith('kan-875-matrix-'))
  assert.equal(basename(target), 'sqlite.db')
  assert.notEqual(canonical(target), canonical(resolve('sqlite.db')))
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.SQLITE_SCENARIO_MODE, '1')
  assert.equal(process.env.EPT_IDENTITY_BACKEND, 'sqlite')
  assert.equal(process.env.RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS, JSON.stringify([maintainer]))
  const actor = actors.find(value => value === process.argv[2])
  assert.ok(actor, 'Invalid actor')
  const subject = 'kan875-subject-' + actor
  const auth: SupabaseServerSessionAuth = {
    async getClaims() {
      if (actor === 'anonymous') return { data: null, error: { name: 'AuthSessionMissingError' } }
      if (actor === 'invalid') return { data: null, error: { code: 'invalid_token' } }
      return { data: { claims: { sub: subject } }, error: null }
    },
    async getUser() { return { data: { user: { id: subject } }, error: null } },
  }
  const { readEptSessionAccessState } = await import('../../lib/auth/ept-session-access')
  const { requireAuthenticatedEptAction } = await import('../../lib/auth/require-authenticated-action')
  const { createExternalIdentityLookup } = await import('../../lib/auth/external-identity-lookup')
  const access = await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(auth, createExternalIdentityLookup()),
  })
  if (actor === 'anonymous' || actor === 'invalid' || actor === 'unlinked') {
    assert.deepEqual(access, { status: 'forbidden', reason: actor })
  } else {
    assert.deepEqual(access, { status: 'authenticated', userId: 'kan875-user-' + actor })
  }
  const load = createRequire(resolve('package.json'))
  const restore: Array<() => void> = []
  function replaceExports(moduleId: string, replacements: Record<string, unknown>) {
    const modulePath = load.resolve(moduleId)
    load(modulePath)
    const cached = load.cache[modulePath]
    assert.ok(cached)
    const original = cached.exports
    cached.exports = { ...original, ...replacements }
    restore.push(() => { cached.exports = original })
    for (const [key, value] of Object.entries(replacements)) assert.equal(load(moduleId)[key], value)
  }
  let providerCalls = 0
  let revalidations = 0
  let redirects = 0
  const fakeClient = async () => { providerCalls += 1; return { auth } }
  try {
    replaceExports('./lib/auth/supabase-server.ts', { createSupabaseServerClient: fakeClient })
    assert.equal(load('@/lib/auth/supabase-server').createSupabaseServerClient, fakeClient)
    replaceExports('next/cache', { revalidatePath: () => { revalidations += 1 } })
    replaceExports('next/navigation', { redirect: (): never => { redirects += 1; throw new Error('Unexpected DENY redirect') } })
    const { saveRaceCatalog } = load('./app/actions/race-catalog-actions.ts') as typeof import('../../app/actions/race-catalog-actions')
    const { eventFormSchema, editionFormSchema, courseFormSchema } = load('./lib/race-catalog/catalog-form.ts') as typeof import('../../lib/race-catalog/catalog-form')
    const schemas = { event: eventFormSchema, edition: editionFormSchema, course: courseFormSchema }
    for (const kind of kinds) {
      for (const operation of operations) {
        const form = makeKan875Form(kind, operation)
        assert.equal(schemas[kind].safeParse(Object.fromEntries(form)).success, true, 'Invalid fixture payload')
        const before = snapshotKan875(target)
        const callsBefore = providerCalls
        const navBefore = [revalidations, redirects]
        let result: unknown
        let thrown = false
        try { result = await saveRaceCatalog({}, form) } catch { thrown = true }
        const after = snapshotKan875(target)
        const changedTables = Object.keys({ ...before.rows, ...after.rows }).filter(table =>
          JSON.stringify(before.rows[table]) !== JSON.stringify(after.rows[table]))
        console.log('KAN875_RESULT:' + JSON.stringify({
          actor, kind, operation, result, thrown, providerCalls: providerCalls - callsBefore,
          revalidations: revalidations - navBefore[0], redirects: redirects - navBefore[1],
          changedTables, schemaUnchanged: JSON.stringify(before.schema) === JSON.stringify(after.schema),
        }))
      }
    }
  } finally { for (const reset of restore.reverse()) reset() }
}
main().catch(error => {
  console.error('KAN-875 harness failed: ' + (error instanceof Error ? error.stack : 'unknown'))
  process.exitCode = 2
})
