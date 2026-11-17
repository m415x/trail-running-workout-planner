/** Test-only provider/navigation seams. Catalog repository, transactions and H2 remain real. */
import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import type { SupabaseServerSessionAuth } from '../../lib/auth/supabase-server-session-state'
import { kinds, operations, makeKan875Form, maintainer, ids } from './kan-875-fixture'

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
  const kind = kinds.find(value => value === process.argv[2])
  const operation = operations.find(value => value === process.argv[3])
  assert.ok(kind && operation, 'Invalid operation')
  const subject = 'kan875-subject-maintainer'
  const auth: SupabaseServerSessionAuth = {
    async getClaims() {
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
  assert.deepEqual(access, { status: 'authenticated', userId: maintainer })
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
  const revalidations: Array<[string, string | undefined]> = []
  const redirects: string[] = []
  const redirectSignal = new Error('KAN875_TEST_REDIRECT')
  const fakeClient = async () => { providerCalls += 1; return { auth } }
  try {
    replaceExports('./lib/auth/supabase-server.ts', { createSupabaseServerClient: fakeClient })
    assert.equal(load('@/lib/auth/supabase-server').createSupabaseServerClient, fakeClient)
    replaceExports('next/cache', { revalidatePath: (path: string, type?: string) => { revalidations.push([path, type]) } })
    replaceExports('next/navigation', { redirect: (destination: string): never => { redirects.push(destination); throw redirectSignal } })
    const { saveRaceCatalog } = load('./app/actions/race-catalog-actions.ts') as typeof import('../../app/actions/race-catalog-actions')
    const { eventFormSchema, editionFormSchema, courseFormSchema } = load('./lib/race-catalog/catalog-form.ts') as typeof import('../../lib/race-catalog/catalog-form')
    const schemas = { event: eventFormSchema, edition: editionFormSchema, course: courseFormSchema }
    const form = makeKan875Form(kind, operation)
    const scenario = process.argv[4]
    assert.ok(scenario)
    if (scenario === 'stale') form.set('revision', '2025-01-01T00:00:00.000Z')
    if (scenario === 'foreign-event') form.set('eventId', 'kan875-other-event')
    if (scenario === 'foreign-edition') form.set('editionId', 'kan875-other-edition')
    if (scenario === 'unknown-metrics') { form.set('distanceKm', ''); form.set('elevationGainM', '') }
    if (scenario === 'cancelled') form.set('status', 'cancelled')
    if (scenario === 'completed') form.set('status', 'completed')
    if (scenario === 'draft') form.set('status', 'draft')
    if (scenario === 'invalid-distance') form.set('distanceKm', '0')
    if (scenario !== 'invalid-distance') assert.equal(schemas[kind].safeParse(Object.fromEntries(form)).success, true)
    const selectableBefore = (await load('./app/actions/race-catalog-actions.ts').searchSelectableRaceCourses('')).some((row: { course: { id: string } }) => row.course.id === ids.course)
    let returned = false
    let result: unknown = null
    let redirected = false
    try {
      result = await saveRaceCatalog({}, form)
      returned = true
    } catch (cause) {
      assert.equal(cause, redirectSignal, 'Unexpected action exception')
      redirected = true
    }
    const selectableAfter = (await load('./app/actions/race-catalog-actions.ts').searchSelectableRaceCourses('')).some((row: { course: { id: string } }) => row.course.id === ids.course)
    console.log('KAN875_DOMAIN_RESULT:' + JSON.stringify({
      scenario, selectableBefore, selectableAfter,
      kind, operation, result, returned, redirected, providerCalls, revalidations, redirects,
    }))
  } finally { for (const reset of restore.reverse()) reset() }
}
main().catch(error => {
  console.error('KAN-875 harness failed: ' + (error instanceof Error ? error.stack : 'unknown'))
  process.exitCode = 2
})
