import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type Database from 'better-sqlite3'
import { auditH7aPhysicalSchema } from './h7a-physical-schema'

type MigrationRow = { hash: string; created_at: number }
type JournalEntry = { idx: number; tag: string; when: number }

export function inspectH7aMigrationGuard(db: Database.Database): string[] {
  const failures: string[] = []
  const journal = JSON.parse(readFileSync(resolve(import.meta.dirname, '../drizzle/sqlite/meta/_journal.json'), 'utf8')) as {
    entries: JournalEntry[]
  }
  const entries = journal.entries.filter(entry => /^002[0-5]_h7a_/.test(entry.tag))
  if (entries.length !== 6 || entries.some((entry, i) => entry.idx !== 20 + i)) {
    return ['H7A canonical 0020–0025 journal is incomplete']
  }
  const metadataTable = db.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = '__drizzle_migrations'",
  ).get()
  if (!metadataTable) return ['H7A migration metadata table is absent']
  const rows = db.prepare('SELECT hash, created_at FROM __drizzle_migrations').all() as MigrationRow[]
  const timestamps = new Set(entries.map(entry => entry.when))
  for (const entry of entries) {
    const applied = rows.filter(row => row.created_at === entry.when)
    if (applied.length > 1) {
      failures.push(`H7A ${entry.tag.slice(0, 4)} duplicate migration metadata`)
      continue
    }
    if (applied.length === 1) {
      const sql = readFileSync(resolve(import.meta.dirname, '../drizzle/sqlite', `${entry.tag}.sql`), 'utf8')
      const canonicalHash = createHash('sha256').update(sql).digest('hex')
      if (applied[0].hash !== canonicalHash) {
        failures.push(`H7A ${entry.tag.slice(0, 4)} canonical hash mismatch`)
      }
    }
  }
  const appliedH7a = rows.filter(row => timestamps.has(row.created_at))
  // Physical HEAD verification is meaningful only when the complete H7A history
  // is recorded. Pending states are classified separately in S3.
  if (appliedH7a.length === 6) failures.push(...auditH7aPhysicalSchema(db))
  return failures
}
