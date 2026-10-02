import { inspectCoachSandboxMigrationJournal } from './migration-journal'

const journalPath = 'drizzle/supabase/meta/_journal.json'
const migrationsDirectory = 'drizzle/supabase'

type ReadOnlyMigrationFilesystem = {
  readText: (path: string) => Promise<string>
  listNames: (path: string) => Promise<readonly string[]>
}

/**
 * Read the existing Drizzle PostgreSQL migration authority, without
 * generating migrations, executing SQL, or modifying the filesystem.
 * Injected readers make unexpected filesystem access observable in tests.
 */
export async function loadCoachSandboxMigrationInventory(
  filesystem: ReadOnlyMigrationFilesystem,
): Promise<{ orderedMigrationFiles: string[]; migrationCount: number }> {
  let rawJournal: string

  try {
    rawJournal = await filesystem.readText(journalPath)
  } catch {
    throw new Error('Canonical PostgreSQL migration journal could not be read')
  }

  let journal: Parameters<typeof inspectCoachSandboxMigrationJournal>[0]
  try {
    journal = JSON.parse(rawJournal) as typeof journal
  } catch {
    throw new Error('Canonical PostgreSQL migration journal is invalid')
  }

  let names: readonly string[]
  try {
    names = await filesystem.listNames(migrationsDirectory)
  } catch {
    throw new Error('Canonical PostgreSQL migration directory could not be read')
  }

  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) {
    throw new Error('Canonical PostgreSQL migration directory inventory is invalid')
  }

  const sqlFiles = names.filter((name) => name.endsWith('.sql'))
  return inspectCoachSandboxMigrationJournal(journal, sqlFiles)
}
