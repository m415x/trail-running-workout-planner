import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { resolveAcceptanceCliSelection } from '@/scripts/acceptance-dev-target'

const projectRoot = resolve(import.meta.dirname, '..', '..')
const configName = '.acceptance-dev.local.json'

test('KAN-885/T3 a restart without saved selection rejects explicitly and never falls back to sqlite.db', () => {
  // This scenario must stay isolated even after a real operator legitimately
  // saved .acceptance-dev.local.json in the current worktree.
  const dir = mkdtempSync(join(tmpdir(), 'kan-885-no-selection-'))
  const configPath = join(dir, configName)
  const developerDb = resolve(projectRoot, 'sqlite.db')
  const developerDbExisted = existsSync(developerDb)
  try {
    assert.throws(
      () => resolveAcceptanceCliSelection({ args: [], projectRoot, configPath }),
      /saved (?:SQLite )?selection|selection config|configuration.*missing/i,
    )
    assert.equal(existsSync(configPath), false, 'must not invent a selection')
    assert.equal(existsSync(developerDb), developerDbExisted,
      'must not fall back to developer sqlite.db')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('KAN-885/T3 explicitly ignores only the local non-sensitive selection config', () => {
  const ignored = readFileSync(resolve(projectRoot, '.gitignore'), 'utf8')
  assert.match(ignored, /^\/\.acceptance-dev\.local\.json\s*$/m)
})
