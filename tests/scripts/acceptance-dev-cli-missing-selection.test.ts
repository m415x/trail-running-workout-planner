import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const projectRoot = resolve(import.meta.dirname, '../..')
const launcher = resolve(projectRoot, 'scripts/acceptance-dev.ts')
const tsxCli = resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs')
const configName = '.acceptance-dev.local.json'

test('KAN-885/T3 a restart without saved selection rejects explicitly and never falls back to sqlite.db', () => {
  const ignoredConfigPath = resolve(projectRoot, configName)
  assert.equal(existsSync(ignoredConfigPath), false,
    'this contract must not depend on developer-specific saved selection')
  const developerDb = resolve(projectRoot, 'sqlite.db')
  const developerDbExisted = existsSync(developerDb)

  const result = spawnSync(process.execPath, [tsxCli, launcher], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 10_000,
  })
  assert.equal(result.error, undefined)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /saved (?:SQLite )?selection|selection config|configuration.*missing/i)
  assert.equal(existsSync(ignoredConfigPath), false, 'must not invent a selection')
  assert.equal(existsSync(developerDb), developerDbExisted,
    'must not fall back to developer sqlite.db')
})

test('KAN-885/T3 explicitly ignores only the local non-sensitive selection config', () => {
  const ignored = readFileSync(resolve(projectRoot, '.gitignore'), 'utf8')
  assert.match(ignored, /^\/\.acceptance-dev\.local\.json\s*$/m)
})
