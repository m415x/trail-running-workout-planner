import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import { assertCanonicalAcceptanceMigrationHistory } from '@/scripts/acceptance-dev-migrations'

type JournalEntry = { idx: number; tag: string; when: number }
type AppliedRow = { hash: string; created_at: number }

const projectRoot = resolve(import.meta.dirname, '../..')
const journal = JSON.parse(
  readFileSync(resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'), 'utf8'),
) as { entries: JournalEntry[] }

function canonicalAppliedRows(): AppliedRow[] {
  return journal.entries.map(entry => ({
    hash: createHash('sha256')
      .update(readFileSync(resolve(projectRoot, 'drizzle/sqlite', entry.tag + '.sql'), 'utf8'))
      .digest('hex'),
    created_at: entry.when,
  }))
}

test('KAN-885/T2 accepts the complete canonical SQLite migration history from this checkout', () => {
  assert.ok(journal.entries.length > 0)
  assert.doesNotThrow(() => assertCanonicalAcceptanceMigrationHistory({
    projectRoot,
    appliedRows: canonicalAppliedRows(),
  }))
})

test('KAN-885/T2 rejects an un-applied HEAD migration without using a hard-coded last tag', () => {
  const appliedRows = canonicalAppliedRows()
  assert.ok(appliedRows.length > 0)
  appliedRows.pop()
  assert.throws(
    () => assertCanonicalAcceptanceMigrationHistory({ projectRoot, appliedRows }),
    /migration|journal|head|missing|incomplete|faltante|pendiente/i,
  )
})

test('KAN-885/T2 rejects a corrupted hash for the last canonical migration', () => {
  const appliedRows = canonicalAppliedRows()
  appliedRows[appliedRows.length - 1] = {
    ...appliedRows[appliedRows.length - 1],
    hash: '0'.repeat(64),
  }
  assert.throws(
    () => assertCanonicalAcceptanceMigrationHistory({ projectRoot, appliedRows }),
    /migration|hash|drift|canonical|mismatch|inconsisten/i,
  )
})

test('KAN-885/T2 accepts only the upgrader-authorized 0016 normalized-CRLF hash', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'kan885-migration-hash-'))
  try {
    const migrationDir = resolve(tempRoot, 'drizzle/sqlite')
    mkdirSync(resolve(migrationDir, 'meta'), { recursive: true })
    const entries = journal.entries.slice(0, 17)
    assert.equal(entries[16]?.tag, '0016_athlete_profile_identity')
    writeFileSync(resolve(migrationDir, 'meta/_journal.json'), JSON.stringify({ entries }))
    const rows = entries.map(entry => {
      const sql = entry.idx === 16 ? 'SELECT 1;\r\nSELECT 2;\r\n' : 'SELECT 1;\n'
      writeFileSync(resolve(migrationDir, entry.tag + '.sql'), sql)
      return {
        hash: createHash('sha256')
          .update(entry.idx === 16 ? sql.replace(/\r\n/g, '\n') : sql)
          .digest('hex'),
        created_at: entry.when,
      }
    })
    assert.doesNotThrow(() => assertCanonicalAcceptanceMigrationHistory({
      projectRoot: tempRoot, appliedRows: rows,
    }))
    const raw0016 = createHash('sha256')
      .update(readFileSync(resolve(migrationDir, entries[16].tag + '.sql')))
      .digest('hex')
    assert.doesNotThrow(() => assertCanonicalAcceptanceMigrationHistory({
      projectRoot: tempRoot,
      appliedRows: rows.map((row, index) => index === 16 ? { ...row, hash: raw0016 } : row),
    }))
    assert.throws(() => assertCanonicalAcceptanceMigrationHistory({
      projectRoot: tempRoot,
      appliedRows: rows.map((row, index) => index === 15
        ? { ...row, hash: createHash('sha256').update('SELECT 1;\r\n').digest('hex') }
        : row),
    }), /hash mismatch|unknown migration/i)
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})
