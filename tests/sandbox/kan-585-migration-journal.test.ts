import assert from 'node:assert/strict'
import test from 'node:test'

import { inspectCoachSandboxMigrationJournal } from '../../lib/sandbox/migration-journal'

const journal = {
  version: '7',
  dialect: 'postgresql',
  entries: [
    { idx: 0, tag: '0000_first', version: '7' },
    { idx: 1, tag: '0001_second', version: '7' },
  ],
}
const sqlFiles = ['0000_first.sql', '0001_second.sql']

test('KAN-585 accepts only the existing contiguous Drizzle PostgreSQL migration journal', () => {
  assert.deepEqual(inspectCoachSandboxMigrationJournal(journal, sqlFiles), {
    orderedMigrationFiles: sqlFiles,
    migrationCount: 2,
  })
})

test('KAN-585 rejects missing SQL, extra SQL, duplicate journal entries and gaps', () => {
  for (const [candidate, files] of [
    [journal, ['0000_first.sql']],
    [journal, [...sqlFiles, '0002_unreviewed.sql']],
    [{ ...journal, entries: [journal.entries[0], journal.entries[0]] }, sqlFiles],
    [{ ...journal, entries: [{ idx: 0, tag: '0000_first', version: '7' }, { idx: 2, tag: '0001_second', version: '7' }] }, sqlFiles],
  ] as const) {
    assert.throws(() => inspectCoachSandboxMigrationJournal(candidate, files), /migration|journal|drift/i)
  }
})

test('KAN-585 rejects wrong dialect and invalid migration names before starting the local lifecycle', () => {
  assert.throws(() => inspectCoachSandboxMigrationJournal({ ...journal, dialect: 'sqlite' }, sqlFiles), /dialect|migration/i)
  assert.throws(() => inspectCoachSandboxMigrationJournal(journal, ['0000_first.sql', '../0001_second.sql']), /migration|path/i)
})
