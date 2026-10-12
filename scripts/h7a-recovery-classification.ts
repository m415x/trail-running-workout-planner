import type Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { auditH7aPhysicalSchema } from './h7a-physical-schema'

export type H7aState =
  | { status: 'canonical'; reasons: string[] }
  | { status: 'pending'; reasons: string[] }
  | { status: 'registered_drift'; reasons: string[] }
  | { status: 'incompatible'; reasons: string[] }

/**
 * Conservative, non-mutating classifier. A pending suffix must be supported by
 * exact canonical pre-migration physical evidence, not merely absent metadata.
 * Until that evidence is specified, partial histories remain incompatible.
 */
export function classifyH7aSqliteState(db: Database.Database): H7aState {
  const journal = JSON.parse(readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8')) as {
    entries: Array<{ idx: number; tag: string; when: number }>
  }
  const entries = journal.entries.filter(e => /^002[0-5]_h7a_/.test(e.tag))
  if (entries.length !== 6 || entries.some((e, i) => e.idx !== 20 + i)) {
    return { status: 'incompatible', reasons: ['Canonical H7A migration journal is incomplete'] }
  }
  const hasMetadata = db.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='__drizzle_migrations'").get()
  if (!hasMetadata) return { status: 'incompatible', reasons: ['Migration metadata table absent'] }

  const rows = db.prepare('SELECT created_at, hash FROM __drizzle_migrations').all() as Array<{ created_at: number; hash: string }>
  const present: number[] = []
  const problems: string[] = []
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const applied = rows.filter(r => r.created_at === e.when)
    if (applied.length > 1) { problems.push(`002${i} duplicated migration record`); continue }
    if (applied.length === 0) continue
    present.push(i)
    const canonical = createHash('sha256').update(readFileSync(`drizzle/sqlite/${e.tag}.sql`)).digest('hex')
    if (applied[0].hash !== canonical) problems.push(`002${i} canonical migration hash mismatch`)
  }
  if (problems.length) return { status: 'incompatible', reasons: problems }
  if (present.some((value, i) => value !== i)) {
    return { status: 'incompatible', reasons: ['H7A recorded migrations do not form a contiguous prefix'] }
  }
  const physical = auditH7aPhysicalSchema(db)
  if (present.length === entries.length) {
    return physical.length
      ? { status: 'registered_drift', reasons: physical }
      : { status: 'canonical', reasons: [] }
  }
  return {
    status: 'incompatible',
    reasons: [
      `H7A partial history through ${present.length} migrations: pending suffix lacks certified physical preflight`,
      ...physical,
    ],
  }
}
