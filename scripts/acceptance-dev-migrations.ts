import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type JournalEntry = { idx: number; tag: string; when: number }
type AppliedRow = { hash: string; created_at: number }

export interface AcceptanceMigrationHistoryInput {
  projectRoot: string
  appliedRows: readonly AppliedRow[]
}

/**
 * KAN-885/T2: verify an existing migration journal against the checked-out
 * canonical SQL files. Pure read-only: does not open or upgrade a database.
 */
export function assertCanonicalAcceptanceMigrationHistory(
  input: AcceptanceMigrationHistoryInput,
): void {
  const migrationsDirectory = resolve(input.projectRoot, 'drizzle/sqlite')
  const journal = JSON.parse(
    readFileSync(resolve(migrationsDirectory, 'meta/_journal.json'), 'utf8'),
  ) as { entries?: JournalEntry[] }

  const entries = journal.entries
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('KAN-885: canonical SQLite migration journal is empty or missing')
  }

  const expected = new Map<number, readonly string[]>()
  for (const [index, entry] of entries.entries()) {
    if (
      !entry
      || entry.idx !== index
      || typeof entry.tag !== 'string'
      || !/^\d{4}_[a-zA-Z0-9_-]+$/.test(entry.tag)
      || !Number.isSafeInteger(entry.when)
      || expected.has(entry.when)
    ) {
      throw new Error('KAN-885: inconsistent canonical SQLite migration journal')
    }

    const sql = readFileSync(resolve(migrationsDirectory, entry.tag + '.sql'), 'utf8')
    const rawHash = createHash('sha256').update(sql).digest('hex')
    // Match the existing upgrade-sqlite.ts 0016-only CRLF compatibility rule.
    // No other migration accepts normalized or alternative digests.
    const allowedHashes = entry.tag === '0016_athlete_profile_identity'
      ? [rawHash, createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')]
      : [rawHash]
    expected.set(entry.when, allowedHashes)
  }

  if (input.appliedRows.length !== expected.size) {
    throw new Error('KAN-885: SQLite migration history incomplete or unexpected')
  }

  const seen = new Set<number>()
  for (const row of input.appliedRows) {
    if (!Number.isSafeInteger(row.created_at) || seen.has(row.created_at)) {
      throw new Error('KAN-885: duplicate or invalid applied migration metadata')
    }
    seen.add(row.created_at)
    const allowedHashes = expected.get(row.created_at)
    if (!allowedHashes || !allowedHashes.includes(row.hash)) {
      throw new Error('KAN-885: applied migration hash mismatch or unknown migration')
    }
  }
}
