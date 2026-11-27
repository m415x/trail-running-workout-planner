import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import * as target from '@/scripts/acceptance-dev-target'

type SaveSelection = (input: {
  projectRoot: string
  configPath: string
  databasePath: string
}) => void

const projectRoot = resolve(import.meta.dirname, '../..')

test('KAN-885/T3 atomically saves only a versioned, accredited SQLite path', () => {
  const candidate = (target as unknown as Record<string, unknown>)
    .saveAcceptanceDatabaseSelection
  assert.equal(typeof candidate, 'function', 'safe selection writer must exist')
  const save = candidate as SaveSelection
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const databasePath = join(workspace, 'acceptance.db')
    const configPath = join(workspace, 'selection.json')
    writeFileSync(databasePath, '')
    save({ projectRoot, configPath, databasePath })

    const saved = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>
    assert.deepEqual(saved, { version: 1, databasePath })
    assert.deepEqual(readdirSync(workspace).sort(), ['acceptance.db', 'selection.json'],
      'successful atomic write must not leave staging files')
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('KAN-885/T3 never overwrites an existing selection when new target is forbidden', () => {
  const save = (target as unknown as Record<string, unknown>)
    .saveAcceptanceDatabaseSelection as SaveSelection
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const configPath = join(workspace, 'selection.json')
    const previousConfig = JSON.stringify({ version: 1, databasePath: join(workspace, 'prior.db') })
    writeFileSync(configPath, previousConfig)

    assert.throws(
      () => save({ projectRoot, configPath, databasePath: resolve(projectRoot, 'sqlite.db') }),
      /developer SQLite database is forbidden/i,
    )
    assert.equal(readFileSync(configPath, 'utf8'), previousConfig)
    assert.deepEqual(readdirSync(workspace), ['selection.json'],
      'rejected target must not leave temporary files')
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
