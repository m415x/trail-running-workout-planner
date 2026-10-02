import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadRepositoryCoachSandboxMigrationInventory } from '../../lib/sandbox/migration-inventory'

test('KAN-585 reads actual checked-in PostgreSQL Drizzle journal and SQL files', async () => {
  const result = await loadRepositoryCoachSandboxMigrationInventory(process.cwd())
  assert.ok(result.migrationCount >= 29)
  assert.equal(result.migrationCount, result.orderedMigrationFiles.length)
  assert.equal(result.orderedMigrationFiles[0], '0000_safe_bloodaxe.sql')
  assert.ok(result.orderedMigrationFiles.includes('0028_generation_explanation_provenance.sql'))
})

test('KAN-585 fails closed on an incomplete local checkout, without generating files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kan-585-readonly-'))
  try {
    await mkdir(join(root, 'drizzle', 'supabase', 'meta'), { recursive: true })
    const path = join(root, 'drizzle', 'supabase', 'meta', '_journal.json')
    await writeFile(path, JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: [{ idx: 0, version: '7', tag: '0000_missing' }],
    }))
    await assert.rejects(
      () => loadRepositoryCoachSandboxMigrationInventory(root),
      /migration|journal|drift/i,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
