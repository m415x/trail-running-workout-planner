import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { actors, kinds, operations, maintainer, seedKan875, snapshotKan875 } from './kan-875-fixture'

type Result = {
  actor: string; kind: string; operation: string; result: unknown; thrown: boolean;
  providerCalls: number; revalidations: number; redirects: number;
  changedTables: string[]; schemaUnchanged: boolean
}

test('KAN-875 all denied catalog operations preserve durable database and consumers', async t => {
  const root = process.cwd()
  const dir = mkdtempSync(join(tmpdir(), 'kan-875-matrix-'))
  const target = join(dir, 'sqlite.db')
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
    assert.equal(result.status, 0, 'Fixture or actor harness failed: ' + result.stderr.slice(-3000))
    return result.stdout
  }
  try {
    run(['--import', 'tsx', resolve(root, 'scripts/upgrade-sqlite.ts')])
    seedKan875(target)
    const baseline = snapshotKan875(target)
    for (const table of ['race_events', 'race_editions', 'race_courses', 'competition_entries', 'training_goals', 'competition_entry_race_courses', 'training_goal_race_courses', 'race_registrations', 'macrocycles']) {
      assert.ok(baseline.rows[table]?.length > 0, 'Missing durable witness: ' + table)
    }
    for (const actor of actors) {
      const before = snapshotKan875(target)
      const output = run(['--import', 'tsx', resolve(root, 'tests/race-catalog/kan-875-deny-probe.ts'), actor])
      const results = output.split(/\r?\n/).filter(line => line.startsWith('KAN875_RESULT:'))
        .map(line => JSON.parse(line.slice('KAN875_RESULT:'.length)) as Result)
      assert.equal(results.length, 9)
      for (const kind of kinds) {
        for (const operation of operations) {
          await t.test(actor + ' ' + kind + ' ' + operation + ' denies without durable mutation', () => {
            const matches = results.filter(row => row.actor === actor && row.kind === kind && row.operation === operation)
            assert.equal(matches.length, 1)
            const result = matches[0]
            assert.deepEqual(result.changedTables, [], 'DENY changed durable tables')
            assert.equal(result.schemaUnchanged, true)
            assert.equal(result.thrown, false)
            assert.deepEqual(result.result, { error: 'forbidden' })
            assert.ok(result.providerCalls > 0, 'Writer must evaluate H2')
            assert.equal(result.revalidations, 0)
            assert.equal(result.redirects, 0)
          })
        }
      }
      assert.deepEqual(snapshotKan875(target), before, 'Actor matrix changed database')
    }
    assert.deepEqual(snapshotKan875(target), baseline, 'Matrix changed database')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
