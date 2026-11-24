import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import * as preflight from '@/scripts/acceptance-dev-preflight'

type PreflightAndSave = (input: {
  databasePath: string
  projectRoot: string
  configPath: string
}) => string

const projectRoot = resolve(import.meta.dirname, '../..')

test('KAN-885/T3 never saves --db when physical SQLite preflight denies', () => {
  const candidate = (preflight as unknown as Record<string, unknown>)
    .preflightAndSaveAcceptanceSelection
  assert.equal(typeof candidate, 'function',
    'selection persistence must be composed AFTER full read-only preflight')
  const preflightAndSave = candidate as PreflightAndSave

  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const databasePath = join(workspace, 'incomplete.db')
    const configPath = join(workspace, 'selection.json')
    const db = new Database(databasePath)
    try {
      db.exec('CREATE TABLE unrelated (id TEXT PRIMARY KEY)')
    } finally {
      db.close()
    }
    const oldConfig = JSON.stringify({ version: 1, databasePath: join(workspace, 'previous.db') })
    writeFileSync(configPath, oldConfig)
    const originalDb = readFileSync(databasePath)

    assert.throws(
      () => preflightAndSave({ projectRoot, databasePath, configPath }),
      /physical SQLite schema missing table users/i,
      'invalid physical schema must deny before saving the explicit selection',
    )
    assert.equal(readFileSync(configPath, 'utf8'), oldConfig,
      'failed preflight must preserve the previous saved selection')
    assert.deepEqual(readFileSync(databasePath), originalDb,
      'failed preflight must not mutate SQLite')
    assert.deepEqual(readdirSync(workspace).sort(), ['incomplete.db', 'selection.json'],
      'denied preflight must not create a staging config')
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('KAN-885/T3 never creates a new selection file when preflight denies', () => {
  const preflightAndSave = (preflight as unknown as Record<string, unknown>)
    .preflightAndSaveAcceptanceSelection as PreflightAndSave
  const workspace = mkdtempSync(join(tmpdir(), 'trail-running-sqlite-base-seed-'))
  try {
    const databasePath = join(workspace, 'incomplete.db')
    const configPath = join(workspace, 'selection.json')
    const db = new Database(databasePath)
    try {
      db.exec('CREATE TABLE unrelated (id TEXT PRIMARY KEY)')
    } finally {
      db.close()
    }
    assert.throws(
      () => preflightAndSave({ projectRoot, databasePath, configPath }),
      /physical SQLite schema missing table users/i,
    )
    assert.deepEqual(readdirSync(workspace).sort(), ['incomplete.db'],
      'no config or staging file may be created on denied preflight')
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
