import { isAbsolute, resolve, win32 } from 'node:path'
import { readMigrationFiles } from 'drizzle-orm/migrator'

/**
 * Load migration metadata using Drizzle ORM's installed canonical reader.
 *
 * This is a synchronous, filesystem-only adapter. It never initializes a
 * PostgreSQL client, starts a transaction or executes any migration SQL.
 * Path validation prevents callers from supplying another migration folder;
 * symlink/file-integrity hardening remains a separate preflight concern.
 */
export function loadCanonicalDrizzleMigrationMetadata(request: {
  repositoryRoot: string
  migrationsFolder: string
}) {
  const root = resolve(request.repositoryRoot)
  const folder = request.migrationsFolder

  if (
    typeof folder !== 'string'
    || !(isAbsolute(folder) || win32.isAbsolute(folder))
    || resolve(folder) !== resolve(root, 'drizzle', 'supabase')
  ) {
    throw new Error('Canonical sandbox Drizzle migration folder required')
  }

  try {
    return readMigrationFiles({ migrationsFolder: folder })
  } catch {
    // Filesystem errors may reveal private operator paths.
    throw new Error('Canonical sandbox Drizzle migration metadata could not be loaded')
  }
}
