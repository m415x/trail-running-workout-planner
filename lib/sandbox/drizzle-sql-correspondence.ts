import { createHash } from 'node:crypto'

type CanonicalSqlFile = {
  filename: string
  sql: string
}

type DrizzleMigration = {
  sql: string[]
  hash: string
  folderMillis: number
  bps: boolean
}

const migrationFilename = /^(\d{4})_[a-z0-9_]+\.sql$/
const breakpoint = '--> statement-breakpoint'

/**
 * Validate a one-to-one, ordered match between SQL inspected for collisions
 * and the exact migration statements/hashes consumed by Drizzle.
 *
 * Uses Drizzle's canonical statement splitting and SHA-256 over the complete
 * raw file. Caller must first establish that input files originate from the
 * approved journal and migration directory; this check is not provenance.
 */
export function verifyCanonicalDrizzleSqlCorrespondence(request: {
  canonicalSqlInventory: readonly CanonicalSqlFile[]
  migrations: readonly DrizzleMigration[]
}): { verified: true; count: number } {
  const { canonicalSqlInventory: files, migrations } = request

  if (
    !Array.isArray(files)
    || !Array.isArray(migrations)
    || files.length === 0
    || files.length !== migrations.length
  ) {
    throw new Error('Canonical Drizzle migration SQL correspondence count mismatch')
  }

  let previousMillis = Number.NEGATIVE_INFINITY

  for (const [index, file] of files.entries()) {
    const migration = migrations[index]
    const match = typeof file?.filename === 'string'
      ? migrationFilename.exec(file.filename)
      : null

    if (
      !match
      || Number(match[1]) !== index
      || typeof file.sql !== 'string'
      || file.sql.length === 0
      || !migration
      || !Array.isArray(migration.sql)
      || typeof migration.hash !== 'string'
      || !/^[a-f0-9]{64}$/.test(migration.hash)
      || typeof migration.folderMillis !== 'number'
      || !Number.isFinite(migration.folderMillis)
      || migration.folderMillis <= previousMillis
      || typeof migration.bps !== 'boolean'
    ) {
      throw new Error('Invalid canonical Drizzle migration order or SQL metadata')
    }

    const hash = createHash('sha256').update(file.sql).digest('hex')
    const expectedStatements = file.sql.split(breakpoint)
    if (
      migration.hash !== hash
      || migration.sql.length !== expectedStatements.length
      || migration.sql.some((statement: unknown, statementIndex: number) => (
        typeof statement !== 'string'
        || statement !== expectedStatements[statementIndex]
      ))
    ) {
      throw new Error('Canonical Drizzle migration SQL or SHA256 correspondence mismatch')
    }

    previousMillis = migration.folderMillis
  }

  return { verified: true, count: files.length }
}
