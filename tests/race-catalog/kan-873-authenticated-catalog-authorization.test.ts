import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

const actors = ['athlete', 'assistant', 'coach', 'admin', 'unlinked', 'invalid'] as const

test('KAN-873 global catalog rejects H2 actors without global authority', async t => {
  const root = process.cwd()
  const dir = mkdtempSync(join(tmpdir(), 'kan-873-actors-'))
  const target = join(dir, 'sqlite.db')
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: 'test',
    SQLITE_SCENARIO_MODE: '1',
    SQLITE_SEED_DISPOSABLE_ACK: '1',
    SQLITE_DATABASE_PATH: target,
    TSX_TSCONFIG_PATH: resolve(root, 'tsconfig.json'),
    EPT_IDENTITY_BACKEND: 'sqlite',
    RACE_CATALOG_GLOBAL_MAINTAINER_USER_IDS: '["kan873-other-maintainer"]',
  }

  function run(args: string[]) {
    const result = spawnSync(process.execPath, args, {
      cwd: root, env, encoding: 'utf8', windowsHide: true,
      timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
    })
    if (result.error) throw result.error
    assert.equal(result.status, 0, 'Fixture or actor seam failed: ' + result.stderr.slice(-2000))
    return result.stdout
  }

  function snapshot() {
    const sqlite = new Database(target, { readonly: true, fileMustExist: true })
    try {
      assert.equal(sqlite.pragma('integrity_check', { simple: true }), 'ok')
      assert.equal((sqlite.pragma('foreign_key_check') as unknown[]).length, 0)
      return sqlite.prepare('SELECT * FROM race_events ORDER BY id').all()
    } finally {
      sqlite.close()
    }
  }

  function seedActors() {
    const sqlite = new Database(target, { fileMustExist: true })
    try {
      sqlite.pragma('foreign_keys = ON')
      const now = '2026-01-01T00:00:00.000Z'
      const addUser = sqlite.prepare('INSERT INTO users(id,user_name,email,first_name,last_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
      const addLink = sqlite.prepare("INSERT INTO external_identity_links(id,user_id,provider,subject,created_at,updated_at) VALUES (?,?,'supabase',?,?,?)")
      const addMember = sqlite.prepare('INSERT INTO team_memberships(id,user_id,team_id,preset,effective_from,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)')
      sqlite.transaction(() => {
        sqlite.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)').run('kan873-team', 'Test Team', now, now)
        for (const preset of actors.slice(0, 4)) {
          const user = 'kan873-user-' + preset
          addUser.run(user, user, user + '@example.invalid', 'Test', preset, now, now)
          addLink.run('kan873-link-' + preset, user, 'kan873-subject-' + preset, now, now)
          addMember.run('kan873-member-' + preset, user, 'kan873-team', preset, now, now, now)
        }
        const other = 'kan873-other-maintainer'
        addUser.run(other, other, other + '@example.invalid', 'Test', 'Maintainer', now, now)
        addLink.run('kan873-other-link', other, 'kan873-other-subject', now, now)
        assert.equal((sqlite.pragma('foreign_key_check') as unknown[]).length, 0)
      })()
    } finally {
      sqlite.close()
    }
  }

  try {
    run(['--import', 'tsx', resolve(root, 'scripts/upgrade-sqlite.ts')])
    seedActors()
    assert.equal(snapshot().length, 0)
    for (const actor of actors) {
      await t.test('KAN-873 ' + actor + ' denies before durable mutation', () => {
        const before = snapshot()
        const output = run(['--import', 'tsx', resolve(root, 'tests/race-catalog/kan-873-actor-probe.ts'), actor])
        const after = snapshot()
        const marker = output.split(/\r?\n/).find(line => line.startsWith('KAN873_ACTOR_RESULT:'))
        assert.ok(marker, 'Action did not report an outcome')
        const result = JSON.parse(marker.slice('KAN873_ACTOR_RESULT:'.length)) as {
          invoked: boolean; actor: string; h2: string; providerCalls: number; returned: boolean; error: unknown
        }
        assert.equal(result.invoked, true)
        assert.equal(result.actor, actor)
        assert.equal(result.h2, actor === 'unlinked' || actor === 'invalid' ? 'forbidden' : 'authenticated')
        // On the vulnerable baseline the action does not consult the provider.
        // Test no-write first, so a genuine RED reports the durable mutation.
        assert.deepEqual(after, before, 'RED: ' + actor + ' changed persisted race_events without global authorization')
        assert.ok(result.providerCalls > 0, 'Writer must consult the test provider through H2')
        assert.equal(result.returned, true, 'An arbitrary exception is not an authorization denial')
        assert.equal(result.error, 'forbidden', 'Expected explicit authorization DENY')
      })
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
