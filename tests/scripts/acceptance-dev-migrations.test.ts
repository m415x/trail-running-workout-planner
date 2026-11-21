import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
