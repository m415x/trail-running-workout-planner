import { realpathSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path'

/**
 * KAN-885/T1: read-only destination accreditation, extracted from KAN-834/KAN-855.
 * This does not authorize seeding, migration, provisioning or authentication.
 */
export interface AcceptanceDatabasePathInput {
  databasePath: string
  projectRoot: string
}

function normalizeForPlatform(path: string): string {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function isWithinDirectory(path: string, parent: string): boolean {
  const normalizedPath = normalizeForPlatform(resolve(path))
  const normalizedParent = normalizeForPlatform(resolve(parent))
  return normalizedPath.startsWith(normalizedParent + sep)
}

/** Returns a canonical, accredited existing path; performs no writes. */
export function assertAccreditedAcceptanceDatabasePath(input: AcceptanceDatabasePathInput): string {
  if (!input.databasePath || !isAbsolute(input.databasePath)) {
    throw new Error('KAN-885: acceptance SQLite requires an explicit absolute path')
  }

  const projectRoot = realpathSync(input.projectRoot)
  const candidate = resolve(input.databasePath)
  const developerDatabase = resolve(projectRoot, 'sqlite.db')
  const canonical = (value: string) => normalizeForPlatform(resolve(value))

  // Reject direct/lexical aliases even if the target file does not exist yet.
  if (canonical(candidate) === canonical(developerDatabase)) {
    throw new Error('KAN-885: developer SQLite database is forbidden for acceptance')
  }

  const actual = realpathSync(candidate)
  if (!statSync(actual).isFile()) {
    throw new Error('KAN-885: acceptance SQLite destination must be an existing regular file')
  }

  // Reject symlink/junction aliases resolving to the developer DB.
  if (canonical(actual) === canonical(developerDatabase)) {
    throw new Error('KAN-885: developer SQLite database is forbidden for acceptance')
  }

  const parent = realpathSync(dirname(actual))
  const temporaryRoot = realpathSync(tmpdir())
  if (
    !isWithinDirectory(parent, temporaryRoot)
    || !basename(parent).startsWith('trail-running-sqlite-base-seed-')
  ) {
    throw new Error('KAN-885: SQLite destination is not an accredited disposable workspace')
  }

  return actual
}
