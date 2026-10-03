import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve, win32 } from 'node:path'

type SqlSnapshot = {
  filename: string
  sql: string
}

const canonicalSqlName = /^(\d{4})_[a-z0-9_]+\.sql$/

/**
 * Re-read the complete canonical migration SQL snapshot after Drizzle has
 * loaded its metadata and before starting a database transaction.
 *
 * Reject any changed, missing, or unreadable file. This detects changes
 * observed at the time of recheck; it cannot eliminate concurrent filesystem
 * replacement after this call or independently establish Git provenance.
 */
export async function verifyCanonicalMigrationSqlSnapshotUnchanged(request: {
  migrationsFolder: string
  canonicalSqlInventory: readonly SqlSnapshot[]
  readText?: (path: string) => Promise<string>
}): Promise<void> {
  if (
    typeof request.migrationsFolder !== 'string'
    || !(isAbsolute(request.migrationsFolder) || win32.isAbsolute(request.migrationsFolder))
    || !Array.isArray(request.canonicalSqlInventory)
    || request.canonicalSqlInventory.length === 0
  ) {
    throw new Error('Canonical migration SQL snapshot invalid')
  }

  const readText = request.readText ?? (path => readFile(path, 'utf8'))

  for (const [index, file] of request.canonicalSqlInventory.entries()) {
    const match = typeof file?.filename === 'string'
      ? canonicalSqlName.exec(file.filename)
      : null
    if (
      !match
      || Number(match[1]) !== index
      || typeof file.sql !== 'string'
      || file.sql.length === 0
    ) {
      throw new Error('Canonical migration SQL snapshot inventory invalid')
    }

    let current: string
    try {
      current = await readText(resolve(request.migrationsFolder, file.filename))
    } catch {
      throw new Error('Canonical migration SQL snapshot could not be read')
    }

    if (current !== file.sql) {
      throw new Error('Canonical migration SQL snapshot changed after verification')
    }
  }
}
