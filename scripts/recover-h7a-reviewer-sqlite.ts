import Database from 'better-sqlite3'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
if (args.length !== 2 || args[0] !== '--database') {
  throw new Error('Usage: tsx scripts/recover-h7a-reviewer-sqlite.ts --database <existing-copy.sqlite>')
}
const path = resolve(args[1])
if (!existsSync(path)) throw new Error('Recovery refuses to create a database')
const canonicalSql = readFileSync(resolve('drizzle/sqlite/0024_h7a_field_review_author.sql'), 'utf8').trim()
if (canonicalSql !== 'ALTER TABLE `field_performance_tests` ADD `reviewed_by_user_id` text REFERENCES users(id) ON DELETE restrict;') {
  throw new Error('H7A 0024 canonical SQL changed; refusing recovery')
}
const journal = JSON.parse(readFileSync(resolve('drizzle/sqlite/meta/_journal.json'), 'utf8')) as {
  entries: Array<{ tag: string; when: number }>
}
const snapshot = JSON.parse(readFileSync(resolve('drizzle/sqlite/meta/0025_snapshot.json'), 'utf8')) as {
  tables: Record<string, { columns: Record<string, { name: string; type: string }> }>
}
const expectedColumns = Object.keys(snapshot.tables.field_performance_tests.columns)
const sqlite = new Database(path, { fileMustExist: true })
sqlite.pragma('foreign_keys = ON')
function invariant(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error('KAN-757 fail-closed: ' + message)
}
try {
  const metadata = sqlite.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY rowid').all() as Array<{ hash: string; created_at: number }>
  invariant(metadata.length === journal.entries.length, 'migration metadata length is incompatible with HEAD')
  for (const [index, entry] of journal.entries.entries()) {
    const sql = readFileSync(resolve('drizzle/sqlite', entry.tag + '.sql'), 'utf8')
    const hash = createHash('sha256').update(sql).digest('hex')
    const normalizedHash = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex')
    invariant(metadata[index]?.created_at === entry.when && (metadata[index]?.hash === hash || (entry.tag === '0016_athlete_profile_identity' && metadata[index]?.hash === normalizedHash)), 'migration metadata drift at ' + entry.tag)
  }
  invariant(journal.entries[24]?.tag === '0024_h7a_field_review_author', 'canonical migration order differs')
  invariant(JSON.stringify(sqlite.pragma('integrity_check')) === JSON.stringify([{ integrity_check: 'ok' }]), 'integrity_check failed')
  invariant((sqlite.pragma('foreign_key_check') as unknown[]).length === 0, 'foreign_key_check failed')
  const columns = sqlite.pragma('table_info(field_performance_tests)') as Array<{ name: string; type: string }>
  const actual = columns.map(column => column.name)
  const expectedWithout = expectedColumns.filter(name => name !== 'reviewed_by_user_id')
  const reviewerExists = actual.includes('reviewed_by_user_id')
  invariant(JSON.stringify(actual) === JSON.stringify(reviewerExists ? expectedColumns : expectedWithout), 'field_performance_tests unexpected column drift')
  for (const column of columns) invariant(column.type.toLowerCase() === snapshot.tables.field_performance_tests.columns[column.name].type.toLowerCase(), 'unexpected column type ' + column.name)
  const fks = sqlite.pragma('foreign_key_list(field_performance_tests)') as Array<{ from: string; table: string; to: string; on_delete: string }>
  const reviewerFks = fks.filter(fk => fk.from === 'reviewed_by_user_id')
  const correctFk = reviewerFks.length === 1 && reviewerFks[0].table === 'users' && reviewerFks[0].to === 'id' && reviewerFks[0].on_delete.toUpperCase() === 'RESTRICT'
  invariant(!reviewerExists || correctFk, 'reviewer column is present with incorrect FK')
  invariant(reviewerExists || reviewerFks.length === 0, 'orphan reviewer FK')
  const count = (sqlite.prepare('SELECT COUNT(*) AS n FROM field_performance_tests').get() as { n: number }).n
  const ids = sqlite.prepare('SELECT id FROM field_performance_tests ORDER BY id').all()
  const migrations = JSON.stringify(metadata)
  if (!reviewerExists) {
    sqlite.transaction(() => {
      sqlite.exec(canonicalSql)
      const updatedFk = (sqlite.pragma('foreign_key_list(field_performance_tests)') as typeof fks).find(fk => fk.from === 'reviewed_by_user_id')
      invariant(updatedFk?.table === 'users' && updatedFk.to === 'id' && updatedFk.on_delete.toUpperCase() === 'RESTRICT', 'post-repair reviewer FK invalid')
      invariant((sqlite.pragma('foreign_key_check') as unknown[]).length === 0, 'post-repair foreign keys invalid')
      invariant(JSON.stringify(sqlite.pragma('integrity_check')) === JSON.stringify([{ integrity_check: 'ok' }]), 'post-repair integrity failed')
      invariant((sqlite.prepare('SELECT COUNT(*) AS n FROM field_performance_tests').get() as { n: number }).n === count, 'row count changed')
      invariant(JSON.stringify(sqlite.prepare('SELECT id FROM field_performance_tests ORDER BY id').all()) === JSON.stringify(ids), 'row identifiers changed')
      invariant(JSON.stringify(sqlite.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY rowid').all()) === migrations, 'migration metadata changed')
    })()
  }
  console.log(reviewerExists ? 'KAN-757 already canonical: no mutation' : 'KAN-757 repaired canonical 0024 delta: PASS')
} finally {
  sqlite.close()
}
