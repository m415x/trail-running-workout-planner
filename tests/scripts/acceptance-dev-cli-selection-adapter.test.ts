import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import * as cliSelection from '@/scripts/acceptance-dev-cli-selection'

type CliSelectionInput = {
  args: readonly string[]
  projectRoot: string
  configPath: string
}

type ResolveCliSelection = (input: CliSelectionInput) => string

const projectRoot = resolve(import.meta.dirname, '../..')

test('KAN-885/T3 CLI selection reads a saved path without using developer sqlite.db', () => {
  const candidate = (cliSelection as unknown as Record<string, unknown>)
    .resolveAcceptanceCliSelection
  assert.equal(typeof candidate, 'function', 'CLI selection adapter must exist')
  const resolveSelection = candidate as ResolveCliSelection
  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const databasePath = join(directory, 'selected.db')
    const configPath = join(directory, 'selection.json')
    writeFileSync(databasePath, '')
    const config = JSON.stringify({ version: 1, databasePath })
    writeFileSync(configPath, config)
    assert.equal(resolveSelection({ args: [], projectRoot, configPath }), databasePath)
    assert.equal(readFileSync(configPath, 'utf8'), config)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('KAN-885/T3 CLI selection rejects stale saved config and explicit --db overrides it', () => {
  const resolveSelection = (cliSelection as unknown as Record<string, unknown>)
    .resolveAcceptanceCliSelection as ResolveCliSelection
  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const databasePath = join(directory, 'selected.db')
    const configPath = join(directory, 'selection.json')
    writeFileSync(databasePath, '')
    const config = JSON.stringify({ version: 1, databasePath: join(directory, 'missing.db') })
    writeFileSync(configPath, config)
    assert.throws(
      () => resolveSelection({ args: [], projectRoot, configPath }),
      /invalid|missing|accredit|selection/i,
    )
    assert.equal(resolveSelection({
      args: ['--db', databasePath], projectRoot, configPath,
    }), databasePath)
    assert.equal(readFileSync(configPath, 'utf8'), config,
      'explicit override must not mutate persisted config')
    assert.throws(
      () => resolveSelection({ args: ['--db', databasePath, '--unknown'], projectRoot, configPath }),
      /argument|usage|invalid/i,
      'ambiguous CLI argument combinations must fail closed',
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
