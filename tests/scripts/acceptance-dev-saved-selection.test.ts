import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'

import * as pathGuards from '@/scripts/acceptance-dev-target'

type ResolveInput = {
  projectRoot: string
  configPath: string
  explicitDatabasePath?: string
}
type ResolveSelection = (input: ResolveInput) => string

const projectRoot = resolve(import.meta.dirname, '../..')

test('KAN-885/T3 loads only an accredited, versioned saved SQLite path and never falls back', () => {
  const resolver = (pathGuards as unknown as Record<string, unknown>)
    .resolveAcceptanceDatabaseSelection
  assert.equal(typeof resolver, 'function', 'safe saved-selection resolver is required')
  const resolveSelection = resolver as ResolveSelection

  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const databasePath = join(directory, 'acceptance.db')
    const configPath = join(directory, 'selection.json')
    writeFileSync(databasePath, '')
    writeFileSync(configPath, JSON.stringify({ version: 1, databasePath }))
    assert.equal(resolveSelection({ projectRoot, configPath }), databasePath)

    writeFileSync(configPath, JSON.stringify({
      version: 1, databasePath: join(directory, 'missing.db'),
    }))
    assert.throws(
      () => resolveSelection({ projectRoot, configPath }),
      /missing|does not exist|ENOENT|invalid|accredit/i,
      'stale selection cannot fall back to developer DB or discover OS temp files',
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('KAN-885/T3 rejects malformed or sensitive local selection config without repairing it', () => {
  const resolveSelection = (pathGuards as unknown as Record<string, unknown>)
    .resolveAcceptanceDatabaseSelection as ResolveSelection
  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const configPath = join(directory, 'selection.json')
    writeFileSync(configPath, '{bad json')
    assert.throws(
      () => resolveSelection({ projectRoot, configPath }),
      /config|invalid|malformed|json/i,
    )
    const databasePath = join(directory, 'acceptance.db')
    writeFileSync(databasePath, '')
    writeFileSync(configPath, JSON.stringify({
      version: 1, databasePath, subject: 'secret-subject',
    }))
    assert.throws(
      () => resolveSelection({ projectRoot, configPath }),
      /config|invalid|unexpected|sensitive|subject/i,
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('KAN-885/T3 explicit --db takes precedence over stale saved selection without mutating config', () => {
  const resolveSelection = (pathGuards as unknown as Record<string, unknown>)
    .resolveAcceptanceDatabaseSelection as ResolveSelection
  const directory = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const databasePath = join(directory, 'explicit.db')
    const configPath = join(directory, 'selection.json')
    writeFileSync(databasePath, '')
    const staleConfig = JSON.stringify({
      version: 1, databasePath: join(directory, 'stale.db'),
    })
    writeFileSync(configPath, staleConfig)
    assert.equal(resolveSelection({ projectRoot, configPath, explicitDatabasePath: databasePath }), databasePath)
    assert.equal(readFileSync(configPath, 'utf8'), staleConfig)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
