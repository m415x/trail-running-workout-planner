import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { kinds, operations, ids, maintainer, revision, seedKan875, snapshotKan875 } from './kan-875-fixture'

type Row = Record<string, unknown> & { id: string }
type Result = {
  kind: string; operation: string; result: unknown; returned: boolean; redirected: boolean;
  providerCalls: number; revalidations: unknown[]; redirects: string[]
}

test('KAN-875 authorized maintainer executes all nine catalog mutations without consumer drift', async t => {
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
    const result = spawnSync(process.execPath, args, {
      cwd: root, env, encoding: 'utf8', windowsHide: true,
      timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    })
    if (result.error) throw result.error
    assert.equal(result.status, 0, 'Fixture or maintainer harness failed: ' + result.stderr.slice(-3000))
    return result.stdout
  }
  const tableNames = { event: 'race_events', edition: 'race_editions', course: 'race_courses' }
  const base = '/dashboard/competitions'
  const eventPath = base + '/' + ids.event
  const editionPath = eventPath + '/editions/' + ids.edition

  try {
    run(['--import', 'tsx', resolve(root, 'scripts/upgrade-sqlite.ts')])
    seedKan875(target)
    copyFileSync(target, pristine)
    const baseline = snapshotKan875(pristine)
    for (const table of ['competition_entries', 'training_goals', 'competition_entry_race_courses', 'training_goal_race_courses', 'race_registrations', 'macrocycles']) {
      assert.ok(baseline.rows[table]?.length > 0, 'Missing durable consumer: ' + table)
    }
    for (const kind of kinds) {
      for (const operation of operations) {
        await t.test(kind + ' ' + operation + ' commits only the intended catalog row', () => {
          // Each action receives exactly the same initial state as the DENY matrix.
          copyFileSync(pristine, target)
          const before = snapshotKan875(target)
          assert.deepEqual(before, baseline)
          const output = run(['--import', 'tsx', resolve(root, 'tests/race-catalog/kan-875-allow-probe.ts'), kind, operation])
          const marker = output.split(/\r?\n/).find(line => line.startsWith('KAN875_ALLOW_RESULT:'))
          assert.ok(marker)
          const result = JSON.parse(marker.slice('KAN875_ALLOW_RESULT:'.length)) as Result
          const after = snapshotKan875(target)
          assert.deepEqual(after.schema, before.schema)
          assert.deepEqual(Object.keys(after.rows), Object.keys(before.rows))
          const table = tableNames[kind]
          for (const name of Object.keys(before.rows)) {
            if (name !== table) assert.deepEqual(after.rows[name], before.rows[name], 'Unintended table mutation: ' + name)
          }
          const oldRows = before.rows[table].map(row => JSON.parse(row) as Row)
          const newRows = after.rows[table].map(row => JSON.parse(row) as Row)
          const old = oldRows.find(row => row.id === ids[kind])
          assert.ok(old)
          let changed: Row
          if (operation === 'create') {
            assert.equal(newRows.length, oldRows.length + 1)
            const additions = newRows.filter(row => !oldRows.some(previous => previous.id === row.id))
            assert.equal(additions.length, 1)
            changed = additions[0]
            assert.deepEqual(newRows.filter(row => row.id !== changed.id), oldRows)
            assert.equal(changed.source_origin, 'product')
            assert.equal(changed.source_provider, null)
            assert.equal(changed.external_id, null)
            assert.equal(changed.source_url, null)
            assert.equal(changed.is_deleted, 0)
          } else {
            assert.equal(newRows.length, oldRows.length)
            const current = newRows.find(row => row.id === old.id)
            assert.ok(current)
            changed = current
            assert.deepEqual(newRows.filter(row => row.id !== old.id), oldRows.filter(row => row.id !== old.id))
            for (const field of ['source_origin', 'source_provider', 'external_id', 'source_url', 'created_at']) {
              assert.equal(changed[field], old[field], 'Lost provenance or creation timestamp: ' + field)
            }
            assert.notEqual(changed.updated_at, revision)
          }
          if (kind === 'edition') assert.equal(changed.race_event_id, ids.event)
          if (kind === 'course') assert.equal(changed.race_edition_id, ids.edition)
          if (operation === 'archive') {
            const expected = { ...old, updated_at: changed.updated_at,
              ...(kind === 'event' ? { status: 'archived' } : { is_deleted: 1 }),
            }
            assert.deepEqual(changed, expected)
          } else {
            assert.equal(changed.is_deleted, 0)
            assert.equal(changed.status, kind === 'event' ? 'active' : 'published')
            if (kind === 'event') {
              assert.equal(changed.name, 'Changed event')
              assert.equal(changed.description, 'Changed description')
            } else {
              assert.equal(changed.label, 'Changed ' + kind)
              if (kind === 'edition') assert.equal(changed.start_date, '2027-04-02')
              if (kind === 'course') {
                assert.equal(changed.distance_km, 25)
                assert.equal(changed.elevation_gain_m, 0)
                assert.deepEqual(JSON.parse(String(changed.modality)), { code: 'trail' })
                assert.deepEqual(JSON.parse(String(changed.classifications)), operation === 'create' ? [] : JSON.parse(String(old.classifications)))
              }
            }
          }
          const destination = operation === 'archive'
            ? kind === 'event' ? base : kind === 'edition' ? eventPath : editionPath
            : kind === 'event' ? base + '/' + changed.id
              : kind === 'edition' ? eventPath + '/editions/' + changed.id
                : editionPath + '/courses/' + changed.id
          assert.equal(result.kind, kind)
          assert.equal(result.operation, operation)
          assert.equal(result.returned, false)
          assert.equal(result.result, null)
          assert.equal(result.redirected, true)
          assert.ok(result.providerCalls > 0)
          assert.deepEqual(result.revalidations, [['/[locale]/dashboard/competitions/[[...segments]]', 'page']])
          assert.deepEqual(result.redirects, [destination])
        })
      }
    }
    assert.deepEqual(snapshotKan875(pristine), baseline, 'Reference fixture changed')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
