import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { ids, maintainer, revision, seedKan875, snapshotKan875 } from './kan-875-fixture'

type Scenario = {
  name: string; kind: 'event' | 'edition' | 'course'; operation: 'create' | 'update' | 'archive';
  variant: string; error?: string; setup?: string; selectableAfter?: boolean; patch?: Record<string, unknown>
}
const cases: Scenario[] = [
  ...(['event', 'edition', 'course'] as const).flatMap(kind =>
    (['update', 'archive'] as const).map(operation => ({
      name: 'stale ' + kind + ' ' + operation, kind, operation, variant: 'stale', error: 'stale',
    }))),
  { name: 'edition cannot reparent to existing foreign event', kind: 'edition', operation: 'update', variant: 'foreign-event', error: 'unavailable' },
  { name: 'edition archive rejects foreign event', kind: 'edition', operation: 'archive', variant: 'foreign-event', error: 'unavailable' },
  { name: 'course cannot reparent to sibling edition', kind: 'course', operation: 'update', variant: 'foreign-edition', error: 'unavailable' },
  { name: 'course archive rejects sibling edition', kind: 'course', operation: 'archive', variant: 'foreign-edition', error: 'unavailable' },
  { name: 'course create rejects mismatched event and edition', kind: 'course', operation: 'create', variant: 'foreign-event', error: 'unavailable' },
  { name: 'zero distance is invalid', kind: 'course', operation: 'update', variant: 'invalid-distance', error: 'invalid' },
  { name: 'unknown distance and elevation persist as null', kind: 'course', operation: 'update', variant: 'unknown-metrics', selectableAfter: false, patch: { distance_km: null, elevation_gain_m: null } },
  { name: 'cancelled course stops selection', kind: 'course', operation: 'update', variant: 'cancelled', selectableAfter: false, patch: { status: 'cancelled' } },
  { name: 'completed edition stops selection', kind: 'edition', operation: 'update', variant: 'completed', selectableAfter: false, patch: { status: 'completed' } },
  { name: 'draft course stops selection', kind: 'course', operation: 'update', variant: 'draft', selectableAfter: false, patch: { status: 'draft' } },
  { name: 'archive event stops selection', kind: 'event', operation: 'archive', variant: 'normal', selectableAfter: false, patch: { status: 'archived', is_deleted: 0 } },
  { name: 'soft-deleted edition stops child selection', kind: 'edition', operation: 'archive', variant: 'normal', selectableAfter: false, patch: { is_deleted: 1 } },
  { name: 'soft-deleted course stops selection', kind: 'course', operation: 'archive', variant: 'normal', selectableAfter: false, patch: { is_deleted: 1 } },
  { name: 'deleted edition rejects new course', kind: 'course', operation: 'create', variant: 'normal', setup: "UPDATE race_editions SET is_deleted=1 WHERE id='kan875-edition'", error: 'unavailable' },
  { name: 'deleted course rejects update', kind: 'course', operation: 'update', variant: 'normal', setup: "UPDATE race_courses SET is_deleted=1 WHERE id='kan875-course'", error: 'unavailable' },
  { name: 'transaction rolls back post-write failure', kind: 'event', operation: 'update', variant: 'normal', setup: 'rollback-trigger', error: 'saveFailed' },
]
const trigger = "CREATE TRIGGER kan875_fail_after_write AFTER UPDATE ON race_events WHEN NEW.id='kan875-event' BEGIN SELECT RAISE(FAIL, 'KAN875_POST_WRITE_FAILURE'); END"
const tables = { event: 'race_events', edition: 'race_editions', course: 'race_courses' }

test('KAN-875 maintainer domain boundaries and rollback', async t => {
  const root = process.cwd()
  const dir = mkdtempSync(join(tmpdir(), 'kan-875-matrix-'))
  const target = join(dir, 'sqlite.db')
  const pristine = join(dir, 'pristine.db')
  const env: NodeJS.ProcessEnv = {
    ...process.env, NODE_ENV: 'test', SQLITE_SCENARIO_MODE: '1',
    SQLITE_SEED_DISPOSABLE_ACK: '1', SQLITE_DATABASE_PATH: target,
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'), EPT_IDENTITY_BACKEND: 'sqlite',
    RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS: JSON.stringify([maintainer]),
  }
  function run(args: string[]) {
    const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 8 * 1024 * 1024 })
    if (result.error) throw result.error
    assert.equal(result.status, 0, 'Fixture or probe failed: ' + result.stderr.slice(-3000))
    return result.stdout
  }
  function setup(sql: string) {
    const db = new Database(target, { fileMustExist: true })
    try { db.pragma('foreign_keys = ON'); db.exec(sql) } finally { db.close() }
  }
  try {
    run(['--import', 'tsx', resolve(root, 'scripts/upgrade-sqlite.ts')])
    seedKan875(target)
    setup(`INSERT INTO race_events(id,name,status,created_at,updated_at) VALUES ('kan875-other-event','Other event','active','${revision}','${revision}');
      INSERT INTO race_editions(id,race_event_id,label,start_date,status,created_at,updated_at) VALUES ('kan875-other-edition','kan875-event','Sibling edition','2027-04-03','published','${revision}','${revision}');`)
    copyFileSync(target, pristine)
    const baseline = snapshotKan875(pristine)
    await t.test('rollback fault witness: FAIL after UPDATE retains write without transaction', () => {
      copyFileSync(pristine, target)
      setup(trigger)
      const db = new Database(target, { fileMustExist: true })
      try {
        assert.throws(() => db.prepare("UPDATE race_events SET name='Witness changed' WHERE id=?").run(ids.event), /KAN875_POST_WRITE_FAILURE/)
        assert.equal(db.prepare('SELECT name FROM race_events WHERE id=?').pluck().get(ids.event), 'Witness changed')
      } finally { db.close() }
    })
    for (const scenario of cases) {
      await t.test(scenario.name, () => {
        copyFileSync(pristine, target)
        if (scenario.setup) setup(scenario.setup === 'rollback-trigger' ? trigger : scenario.setup)
        const before = snapshotKan875(target)
        const output = run(['--import', 'tsx', resolve(root, 'tests/race-catalog/kan-875-domain-probe.ts'), scenario.kind, scenario.operation, scenario.variant])
        const marker = output.split(/\r?\n/).find(line => line.startsWith('KAN875_DOMAIN_RESULT:'))
        assert.ok(marker)
        const result = JSON.parse(marker.slice('KAN875_DOMAIN_RESULT:'.length)) as {
          scenario: string; result: { error?: string }; returned: boolean; redirected: boolean;
          providerCalls: number; revalidations: unknown[]; redirects: string[];
          selectableBefore: boolean; selectableAfter: boolean
        }
        const after = snapshotKan875(target)
        assert.equal(result.scenario, scenario.variant)
        assert.ok(result.providerCalls > 0)
        if (scenario.error) {
          assert.deepEqual(after, before, 'Rejected operation changed durable state')
          assert.equal(result.returned, true)
          assert.equal(result.result.error, scenario.error)
          assert.equal(result.redirected, false)
          assert.deepEqual(result.revalidations, [])
          assert.deepEqual(result.redirects, [])
        } else {
          assert.equal(result.returned, false)
          assert.equal(result.redirected, true)
          assert.deepEqual(result.revalidations, [['/[locale]/dashboard/competitions/[[...segments]]', 'page']])
          assert.equal(result.redirects.length, 1)
          assert.equal(result.selectableBefore, true)
          assert.equal(result.selectableAfter, scenario.selectableAfter)
          assert.deepEqual(after.schema, before.schema)
          const table = tables[scenario.kind]
          for (const name of Object.keys(before.rows)) {
            if (name !== table) assert.deepEqual(after.rows[name], before.rows[name], 'Consumer or unrelated table drift: ' + name)
          }
          const row = (rows: string[]) => rows.map(value => JSON.parse(value) as Record<string, unknown>).find(value => value.id === ids[scenario.kind])
          const old = row(before.rows[table])
          const changed = row(after.rows[table])
          assert.ok(old && changed)
          assert.equal(after.rows[table].length, before.rows[table].length)
          for (const [key, value] of Object.entries(scenario.patch ?? {})) assert.deepEqual(changed[key], value)
          for (const key of ['source_origin', 'source_provider', 'external_id', 'source_url', 'created_at']) assert.equal(changed[key], old[key])
          if (scenario.kind === 'course') assert.equal(changed.classifications, old.classifications)
        }
      })
    }
    await t.test('historical references physically restrict deletion', () => {
      copyFileSync(pristine, target)
      const before = snapshotKan875(target)
      const db = new Database(target, { fileMustExist: true })
      try {
        db.pragma('foreign_keys = ON')
        for (const [table, id] of [[tables.course, ids.course], [tables.edition, ids.edition], [tables.event, ids.event]]) {
          assert.throws(() => db.prepare('DELETE FROM ' + table + ' WHERE id=?').run(id), /FOREIGN KEY constraint failed/)
        }
      } finally { db.close() }
      assert.deepEqual(snapshotKan875(target), before)
    })
    assert.deepEqual(snapshotKan875(pristine), baseline)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
