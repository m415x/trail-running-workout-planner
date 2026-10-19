import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 SQLite migrator expects the full journal through current HEAD', () => {
  const journal = JSON.parse(readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8')) as {
    entries: Array<{ tag: string }>
  }
  assert.ok(journal.entries.some(entry => entry.tag === '0026_session_generation_review_snapshots'), 'canonical review snapshot migration remains in history')
  assert.ok(journal.entries.at(-1)?.tag.startsWith('0028_'), 'journal must retain KAN-646 Team regional head')
  const migratorTest = readFileSync('tests/athletes/kan-620-post-0016-orm-migrator.test.ts', 'utf8')
  assert.ok(
    migratorTest.includes('assert.equal(migrationCount, journal.entries.length)'),
    'canonical migration count must derive from journal rather than a stale literal',
  )
})
