import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const launcher = resolve(root, 'scripts/acceptance-dev.ts')
const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs')

function invoke(databasePath: string) {
  return spawnSync(process.execPath, [tsxCli, launcher, '--db', databasePath], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  })
}

test('KAN-885/T3 rejects the developer SQLite before any Next.js launch', () => {
  const databasePath = resolve(root, 'sqlite.db')
  const existedBefore = existsSync(databasePath)
  const result = invoke(databasePath)
  assert.equal(result.error, undefined)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /developer SQLite database is forbidden/i)
  assert.equal(existsSync(databasePath), existedBefore, 'must not create developer SQLite')
})

test('KAN-885/T3 rejects absent disposable SQLite without creating it', () => {
  const databasePath = resolve(root, 'nonexistent-kan885-acceptance-fixture.db')
  assert.equal(existsSync(databasePath), false)
  const result = invoke(databasePath)
  assert.equal(result.error, undefined)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /ENOENT|no such file|not found|does not exist|missing/i)
  assert.equal(existsSync(databasePath), false, 'must not create missing SQLite')
})
