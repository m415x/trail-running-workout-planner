import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

type PageResult = {
  locale: string; name: string; links: string[]; alerts: string[];
  forms: Array<{ kind: string; archive: boolean; locale: string }>;
  courseRegistration: boolean; editionRegistrations: boolean; providerCalls: number
}

const base = '/dashboard/competitions'
const eventPath = base + '/kan874-ui-event'
const editionPath = eventPath + '/editions/kan874-ui-edition'
const coursePath = editionPath + '/courses/kan874-ui-course'
const readRoutes = [
  { name: 'list', mutations: [base + '/new'], readLink: eventPath },
  { name: 'event', mutations: [eventPath + '/edit', eventPath + '/archive', eventPath + '/editions/new'], readLink: editionPath },
  { name: 'edition', mutations: [editionPath + '/edit', editionPath + '/archive', editionPath + '/courses/new'], readLink: coursePath },
  { name: 'course', mutations: [coursePath + '/edit', coursePath + '/archive'], readLink: editionPath },
]
const mutationRoutes = [
  'event-create', 'event-edit', 'event-archive',
  'edition-create', 'edition-edit', 'edition-archive',
  'course-create', 'course-edit', 'course-archive',
]
const denial: Record<string, string> = {
  es: 'No tenés autorización para administrar el catálogo de competencias.',
  en: 'You are not authorized to manage the race catalog.',
}

test('KAN-874 catalog page projects global authority in ES/EN without changing sporting consultation', async t => {
  const root = process.cwd()
  const dir = mkdtempSync(join(tmpdir(), 'kan-874-ui-'))
  const target = join(dir, 'sqlite.db')
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    SQLITE_SCENARIO_MODE: '1',
    SQLITE_SEED_DISPOSABLE_ACK: '1',
    SQLITE_DATABASE_PATH: target,
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
    EPT_IDENTITY_BACKEND: 'sqlite',
    RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS: '[]',
  }

  function run(args: string[], config = '[]') {
    const result = spawnSync(process.execPath, args, {
      cwd: root, env: { ...baseEnv, RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS: config },
      encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    })
    if (result.error) throw result.error
    assert.equal(result.status, 0, 'UI fixture or harness failed: ' + result.stderr.slice(-3000))
    return result.stdout
  }

  function seed() {
    const sqlite = new Database(target, { fileMustExist: true })
    try {
      sqlite.pragma('foreign_keys = ON')
      const now = '2026-01-01T00:00:00.000Z'
      sqlite.transaction(() => {
        sqlite.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)').run('team_1', 'Test Team', now, now)
        sqlite.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
          .run('kan874-ui-user', 'kan874-ui-user', 'kan874-ui@example.invalid', 'Test', 'Coach', now, now)
        sqlite.prepare("INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,'supabase',?,?,?)")
          .run('kan874-ui-link', 'kan874-ui-user', 'kan874-ui-subject', now, now)
        sqlite.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
          .run('kan874-ui-membership', 'kan874-ui-user', 'team_1', 'coach', now, now, now)
        sqlite.prepare("INSERT INTO race_events(id,name,status,created_at,updated_at) VALUES (?,?,'active',?,?)")
          .run('kan874-ui-event', 'Test Event', now, now)
        sqlite.prepare("INSERT INTO race_editions(id,race_event_id,label,start_date,status,created_at,updated_at) VALUES (?,?,?,?,'published',?,?)")
          .run('kan874-ui-edition', 'kan874-ui-event', 'Test Edition', '2027-01-01', now, now)
        sqlite.prepare("INSERT INTO race_courses(id,race_edition_id,label,distance_km,classifications,status,created_at,updated_at) VALUES (?,?,?,?,'[]','published',?,?)")
          .run('kan874-ui-course', 'kan874-ui-edition', 'Test Course', 21, now, now)
        assert.equal((sqlite.pragma('foreign_key_check') as unknown[]).length, 0)
      })()
    } finally { sqlite.close() }
  }

  function snapshot() {
    const sqlite = new Database(target, { readonly: true, fileMustExist: true })
    try {
      assert.equal(sqlite.pragma('integrity_check', { simple: true }), 'ok')
      assert.equal((sqlite.pragma('foreign_key_check') as unknown[]).length, 0)
      return ['race_events', 'race_editions', 'race_courses'].map(table =>
        sqlite.prepare('SELECT * FROM ' + table + ' ORDER BY id').all())
    } finally { sqlite.close() }
  }

  function invoke(config: string): PageResult[] {
    const output = run(['--import', 'tsx', resolve(root, 'tests/race-catalog/kan-874-catalog-ui-probe.ts')], config)
    const marker = output.split(/\r?\n/).find(line => line.startsWith('KAN874_UI_RESULT:'))
    assert.ok(marker, 'Missing page results')
    const results = JSON.parse(marker.slice('KAN874_UI_RESULT:'.length)) as PageResult[]
    assert.equal(results.length, 26)
    return results
  }

  try {
    run(['--import', 'tsx', resolve(root, 'scripts/upgrade-sqlite.ts')])
    seed()
    const before = snapshot()
    const denied = invoke('[]')
    const allowed = invoke('["kan874-ui-user"]')
    for (const locale of ['es', 'en']) {
      for (const [mode, results] of [['DENY', denied], ['ALLOW', allowed]] as const) {
        const authorized = mode === 'ALLOW'
        const get = (name: string) => {
          const result = results.find(row => row.locale === locale && row.name === name)
          assert.ok(result, 'Missing route result: ' + name)
          return result
        }
        for (const route of readRoutes) {
          await t.test(locale + ' ' + mode + ' ' + route.name + ' controls and consultation', () => {
            const result = get(route.name)
            for (const href of route.mutations) {
              assert.equal(result.links.includes(href), authorized, 'Unexpected maintenance link: ' + href)
            }
            // DetailHeader receives the back path; its children are not expanded in this JSX projection probe.
            if (route.name !== 'course') assert.ok(result.links.includes(route.readLink), 'Missing legitimate read navigation')
            assert.equal(result.forms.length, 0)
            assert.equal(result.courseRegistration, route.name === 'course')
            assert.equal(result.editionRegistrations, route.name === 'edition')
            assert.ok(result.providerCalls > 0, 'Page must evaluate H2 authority')
          })
        }
        for (const name of mutationRoutes) {
          await t.test(locale + ' ' + mode + ' direct ' + name, () => {
            const result = get(name)
            const [kind, operation] = name.split('-')
            assert.deepEqual(result.forms, authorized ? [{ kind, archive: operation === 'archive', locale }] : [], 'Unexpected direct maintenance form')
            assert.deepEqual(result.alerts, authorized ? [] : [denial[locale]], 'Expected accessible localized DENY')
            assert.ok(result.providerCalls > 0, 'Page must evaluate H2 authority')
          })
        }
      }
    }
    assert.deepEqual(snapshot(), before, 'Page projection mutated catalog')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
