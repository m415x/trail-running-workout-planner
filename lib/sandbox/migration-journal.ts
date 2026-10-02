type MigrationJournalEntry = {
  idx?: number
  tag?: string
  version?: string
}

type MigrationJournal = {
  version?: string
  dialect?: string
  entries?: readonly MigrationJournalEntry[]
}

const migrationFilePattern = /^\d{4}_[a-z0-9_]+\.sql$/
const migrationTagPattern = /^\d{4}_[a-z0-9_]+$/

/**
 * Inspect Drizzle's existing PostgreSQL journal against the SQL inventory.
 * No migrations are generated or executed; any drift fails closed.
 */
export function inspectCoachSandboxMigrationJournal(
  journal: MigrationJournal,
  sqlFiles: readonly string[],
): { orderedMigrationFiles: string[]; migrationCount: number } {
  if (
    journal?.dialect !== 'postgresql'
    || typeof journal.version !== 'string'
    || !/^\d+$/.test(journal.version)
    || !Array.isArray(journal.entries)
    || journal.entries.length === 0
  ) {
    throw new Error('Invalid PostgreSQL migration journal')
  }

  const expected: string[] = []
  const seen = new Set<string>()

  for (const [index, entry] of journal.entries.entries()) {
    if (
      entry.idx !== index
      || entry.version !== journal.version
      || typeof entry.tag !== 'string'
      || !migrationTagPattern.test(entry.tag)
      || !entry.tag.startsWith(String(index).padStart(4, '0') + '_')
      || seen.has(entry.tag)
    ) {
      throw new Error('Invalid or duplicate migration journal entry')
    }
    seen.add(entry.tag)
    expected.push(entry.tag + '.sql')
  }

  if (
    sqlFiles.length !== expected.length
    || sqlFiles.some((file) => !migrationFilePattern.test(file))
    || new Set(sqlFiles).size !== sqlFiles.length
    || expected.some((file) => !sqlFiles.includes(file))
  ) {
    throw new Error('PostgreSQL migration SQL inventory drift')
  }

  return { orderedMigrationFiles: expected, migrationCount: expected.length }
}
