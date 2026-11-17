import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

const CONFIG = 'RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS'
const ID = 'kan874-maintainer'

test('KAN-874 designated maintainer and configuration fail closed', async t => {
  const root = process.cwd()
  const dir = mkdtempSync(join(tmpdir(), 'kan-874-maintainer-'))
  const target = join(dir, 'sqlite.db')
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    SQLITE_SCENARIO_MODE: '1',
    SQLITE_SEED_DISPOSABLE_ACK: '1',
    SQLITE_DATABASE_PATH: target,
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
    EPT_IDENTITY_BACKEND: 'sqlite',
  }
  delete baseEnv[CONFIG]

  function run(args: string[], config?: string) {
    const env = { ...baseEnv }
    if (config !== undefined) env[CONFIG] = config
    const result = spawnSync(process.execPath, args, {
      cwd: root, env, encoding: 'utf8', windowsHide: true,
      timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    })
    if (result.error) throw result.error
    assert.equal(result.status, 0, 'Fixture or action harness failed: ' + result.stderr.slice(-2000))
    return result.stdout
  }

  function seedMaintainer() {
    const sqlite = new Database(target, { fileMustExist: true })
    try {
      sqlite.pragma('foreign_keys = ON')
      const now = '2026-01-01T00:00:00.000Z'
      sqlite.transaction(() => {
        sqlite.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
          .run(ID, ID, ID + '@example.invalid', 'Test', 'Maintainer', now, now)
        sqlite.prepare("INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,'supabase',?,?,?)")
          .run('kan874-maintainer-link', ID, 'kan874-maintainer-subject', now, now)
        assert.equal(sqlite.prepare('SELECT count(*) FROM team_memberships WHERE user_id=?').pluck().get(ID), 0)
        assert.equal((sqlite.pragma('foreign_key_check') as unknown[]).length, 0)
      })()
    } finally {
      sqlite.close()
    }
  }

  function snapshot() {
    const sqlite = new Database(target, { readonly: true, fileMustExist: true })
    try {
      assert.equal(sqlite.pragma('integrity_check', { simple: true }), 'ok')
      assert.equal((sqlite.pragma('foreign_key_check') as unknown[]).length, 0)
      return sqlite.prepare('SELECT * FROM race_events ORDER BY id').all() as Array<{ id: string; name: string; status: string }>
    } finally {
      sqlite.close()
    }
  }

  function invoke(label: string, config?: string) {
    const output = run(['--import', 'tsx', resolve(root, 'tests/race-catalog/kan-874-maintainer-probe.ts'), label], config)
    const marker = output.split(/\r?\n/).find(line => line.startsWith('KAN874_RESULT:'))
    assert.ok(marker, 'Missing action outcome')
    const result = JSON.parse(marker.slice('KAN874_RESULT:'.length)) as {
      returned: boolean; error: unknown; redirected: boolean; providerCalls: number;
      revalidations: unknown[]; redirects: string[]
    }
    assert.ok(result.providerCalls > 0, 'Writer must consult H2 provider')
    return result
  }

  try {
    run(['--import', 'tsx', resolve(root, 'scripts/upgrade-sqlite.ts')])
    seedMaintainer()
    assert.deepEqual(snapshot(), [])
    await t.test('explicitly designated H2 user without Team membership creates an event', () => {
      const result = invoke('allowed', JSON.stringify([ID]))
      const rows = snapshot()
      assert.equal(rows.length, 1, 'ALLOW must persist exactly one event')
      assert.equal(rows[0].name, 'KAN-874 maintainer probe allowed')
      assert.equal(rows[0].status, 'active')
      assert.equal(result.returned, false)
      assert.equal(result.error, null)
      assert.equal(result.redirected, true)
      assert.deepEqual(result.revalidations, [['/[locale]/dashboard/competitions/[[...segments]]', 'page']])
      assert.deepEqual(result.redirects, ['/dashboard/competitions/' + rows[0].id])
    })

    const cases: Array<[string, string | undefined]> = [
      ['revoked', '[]'],
      ['missing', undefined],
      ['empty', ''],
      ['malformed', '['],
      ['object', JSON.stringify({ id: ID })],
      ['scalar', JSON.stringify(ID)],
      ['null', 'null'],
      ['nested', JSON.stringify([[ID]])],
      ['numeric', JSON.stringify([ID, 42])],
      ['null-member', JSON.stringify([ID, null])],
      ['blank-member', JSON.stringify([ID, ''])],
      ['whitespace-member', JSON.stringify([ID, ' '])],
      ['leading-space', JSON.stringify([ID, ' other'])],
      ['trailing-space', JSON.stringify([ID, 'other '])],
      ['duplicate', JSON.stringify([ID, ID])],
      ['c0-control', JSON.stringify([ID, 'other' + String.fromCharCode(10)])],
      ['c1-control', JSON.stringify([ID, 'other' + String.fromCharCode(133)])],
      ['oversized', JSON.stringify([ID, 'x'.repeat(257)])],
      ['prefix', JSON.stringify([ID.slice(0, -1)])],
      ['suffix', JSON.stringify([ID + '-extra'])],
      ['case-mismatch', JSON.stringify([ID.toUpperCase()])],
      ['nonmember', JSON.stringify(['other-maintainer'])],
    ]
    for (const [label, config] of cases) {
      await t.test(label + ' denies without mutation or navigation', () => {
        const before = snapshot()
        const result = invoke(label, config)
        assert.deepEqual(snapshot(), before, 'DENY changed race_events: ' + label)
        assert.equal(result.returned, true)
        assert.equal(result.error, 'forbidden')
        assert.equal(result.redirected, false)
        assert.deepEqual(result.revalidations, [])
        assert.deepEqual(result.redirects, [])
      })
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
