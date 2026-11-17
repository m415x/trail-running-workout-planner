/** Isolated page projection probe: real page, H2 and SQLite; framework presentation adapters are doubles. */
import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { isValidElement } from 'react'
import type { SupabaseServerSessionAuth } from '../../lib/auth/supabase-server-session-state'

async function main() {
  const target = realpathSync(process.env.SQLITE_DATABASE_PATH ?? '')
  const canonical = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value
  assert.equal(canonical(dirname(dirname(target))), canonical(realpathSync(tmpdir())))
  assert.ok(basename(dirname(target)).startsWith('kan-874-ui-'))
  assert.equal(basename(target), 'sqlite.db')
  assert.notEqual(canonical(target), canonical(resolve('sqlite.db')))
  assert.equal(process.env.SQLITE_SCENARIO_MODE, '1')
  assert.equal(process.env.NODE_ENV, 'test')
  assert.equal(process.env.EPT_IDENTITY_BACKEND, 'sqlite')

  const subject = 'kan874-ui-subject'
  const auth: SupabaseServerSessionAuth = {
    async getClaims() { return { data: { claims: { sub: subject } }, error: null } },
    async getUser() { return { data: { user: { id: subject } }, error: null } },
  }
  const { readEptSessionAccessState } = await import('../../lib/auth/ept-session-access')
  const { requireAuthenticatedEptAction } = await import('../../lib/auth/require-authenticated-action')
  const { createExternalIdentityLookup } = await import('../../lib/auth/external-identity-lookup')
  assert.deepEqual(await requireAuthenticatedEptAction({
    readAccess: () => readEptSessionAccessState(auth, createExternalIdentityLookup()),
  }), { status: 'authenticated', userId: 'kan874-ui-user' })

  const load = createRequire(resolve('package.json'))
  const restore: Array<() => void> = []
  function stub(moduleId: string, exports: Record<string, unknown>) {
    const path = load.resolve(moduleId)
    const original = load.cache[path]
    const replacement = new Module(path)
    replacement.filename = path
    replacement.loaded = true
    replacement.exports = exports
    load.cache[path] = replacement
    restore.push(() => {
      if (original) load.cache[path] = original
      else delete load.cache[path]
    })
    assert.equal(load(moduleId), exports, 'Expected active test adapter: ' + moduleId)
  }

  let providerCalls = 0
  const fakeClient = async () => { providerCalls += 1; return { auth } }
  const CatalogForm = () => null
  const CourseRegistration = () => null
  const EditionRegistrations = () => null
  const Link = () => null
  const messages = Object.fromEntries(['es', 'en'].map(locale => [
    locale, JSON.parse(readFileSync(resolve('messages', locale, 'competitions/race-catalog.json'), 'utf8')) as Record<string, unknown>,
  ]))
  function translate(locale: string, namespace: string, key: string): string {
    let value: unknown = messages[locale]
    for (const part of (namespace + '.' + key).split('.')) {
      assert.ok(value && typeof value === 'object', 'Missing locale message: ' + locale + ':' + key)
      value = (value as Record<string, unknown>)[part]
    }
    assert.equal(typeof value, 'string', 'Missing locale message: ' + locale + ':' + key)
    return value as string
  }

  try {
    stub('@/lib/auth/supabase-server', { createSupabaseServerClient: fakeClient })
    stub('next-intl/server', {
      getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) =>
        (key: string) => translate(locale, namespace, key),
    })
    stub('@/i18n/routing', { Link })
    stub('@/features/race-catalog/components/CatalogForm', { CatalogForm })
    stub('@/features/race-registration/components/CourseRegistration', { CourseRegistration })
    stub('@/features/race-registration/components/EditionRegistrations', { EditionRegistrations })

    const pagePath = './app/[locale]/dashboard/competitions/[[...segments]]/page.tsx'
    const { default: page } = load(pagePath) as typeof import('../../app/[locale]/dashboard/competitions/[[...segments]]/page')
    const event = 'kan874-ui-event'
    const edition = 'kan874-ui-edition'
    const course = 'kan874-ui-course'
    const eventPath = [event]
    const editionPath = [event, 'editions', edition]
    const coursePath = [...editionPath, 'courses', course]
    const routes: Array<{ name: string; segments: string[] }> = [
      { name: 'list', segments: [] },
      { name: 'event', segments: eventPath },
      { name: 'edition', segments: editionPath },
      { name: 'course', segments: coursePath },
      { name: 'event-create', segments: ['new'] },
      { name: 'event-edit', segments: [...eventPath, 'edit'] },
      { name: 'event-archive', segments: [...eventPath, 'archive'] },
      { name: 'edition-create', segments: [...eventPath, 'editions', 'new'] },
      { name: 'edition-edit', segments: [...editionPath, 'edit'] },
      { name: 'edition-archive', segments: [...editionPath, 'archive'] },
      { name: 'course-create', segments: [...editionPath, 'courses', 'new'] },
      { name: 'course-edit', segments: [...coursePath, 'edit'] },
      { name: 'course-archive', segments: [...coursePath, 'archive'] },
    ]
    const results = []
    for (const locale of ['es', 'en']) {
      for (const route of routes) {
        const callsBefore = providerCalls
        const tree = await page({ params: Promise.resolve({ locale, segments: route.segments }), searchParams: Promise.resolve({}) })
        const links: string[] = []
        const alerts: string[] = []
        const forms: Array<{ kind: unknown; archive: boolean; locale: unknown }> = []
        let courseRegistration = false
        let editionRegistrations = false
        function visit(node: unknown): void {
          if (Array.isArray(node)) { node.forEach(visit); return }
          if (!isValidElement<{ children?: unknown; href?: unknown; role?: unknown; kind?: unknown; archive?: unknown; locale?: unknown }>(node)) return
          const props = node.props
          if (node.type === Link && typeof props.href === 'string') links.push(props.href)
          if (node.type === CatalogForm) forms.push({ kind: props.kind, archive: props.archive === true, locale: props.locale })
          if (node.type === CourseRegistration) courseRegistration = true
          if (node.type === EditionRegistrations) editionRegistrations = true
          if (props.role === 'alert' && typeof props.children === 'string') alerts.push(props.children)
          visit(props.children)
        }
        visit(tree)
        results.push({
          locale, name: route.name, links, alerts, forms, courseRegistration, editionRegistrations,
          providerCalls: providerCalls - callsBefore,
        })
      }
    }
    console.log('KAN874_UI_RESULT:' + JSON.stringify(results))
  } finally {
    for (const reset of restore.reverse()) reset()
  }
}

main().catch(error => {
  console.error('KAN-874 UI harness failed: ' + (error instanceof Error ? error.stack : 'unknown'))
  process.exitCode = 2
})
