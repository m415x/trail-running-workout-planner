import { closeSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
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

export interface AcceptanceDatabaseSelectionInput {
  projectRoot: string
  configPath: string
  explicitDatabasePath?: string
}

/**
 * Resolve a user-selected, worktree-local SQLite path without creating or
 * repairing config or SQLite. Explicit --db overrides a stale saved selection.
 * This accredits path only; physical schema, migrations, integrity and H1 are
 * mandatory separate preflight gates on every launcher execution.
 */
export function resolveAcceptanceDatabaseSelection(
  input: AcceptanceDatabaseSelectionInput,
): string {
  if (input.explicitDatabasePath !== undefined) {
    return assertAccreditedAcceptanceDatabasePath({
      databasePath: input.explicitDatabasePath,
      projectRoot: input.projectRoot,
    })
  }

  let raw: string
  try {
    raw = readFileSync(input.configPath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      throw new Error('KAN-885: saved SQLite selection config is missing')
    }
    throw new Error('KAN-885: saved SQLite selection config cannot be read')
  }

  // The file is only a local, non-sensitive locator; unexpected fields such as
  // subject, cookies and credentials are never accepted or persisted.
  if (raw.length > 4096) {
    throw new Error('KAN-885: invalid saved SQLite selection config')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('KAN-885: malformed saved SQLite selection config')
  }
  if (
    typeof parsed !== 'object'
    || parsed === null
    || Array.isArray(parsed)
    || Object.keys(parsed).length !== 2
    || !Object.hasOwn(parsed, 'version')
    || !Object.hasOwn(parsed, 'databasePath')
    || (parsed as { version?: unknown }).version !== 1
    || typeof (parsed as { databasePath?: unknown }).databasePath !== 'string'
  ) {
    throw new Error('KAN-885: invalid saved SQLite selection config')
  }

  try {
    return assertAccreditedAcceptanceDatabasePath({
      databasePath: (parsed as { databasePath: string }).databasePath,
      projectRoot: input.projectRoot,
    })
  } catch {
    throw new Error('KAN-885: saved SQLite selection is invalid or no longer accredited')
  }
}

export interface AcceptanceCliSelectionInput {
  args: readonly string[]
  projectRoot: string
  configPath: string
}

/**
 * Parses the narrow acceptance CLI selection syntax and resolves only an
 * explicitly selected or previously saved accredited path. No writes.
 */
export function resolveAcceptanceCliSelection(input: AcceptanceCliSelectionInput): string {
  const { args, projectRoot, configPath } = input

  if (args.length === 0) {
    return resolveAcceptanceDatabaseSelection({ projectRoot, configPath })
  }

  if (args.length === 2 && args[0] === '--db' && args[1]?.trim()) {
    return resolveAcceptanceDatabaseSelection({
      projectRoot,
      configPath,
      explicitDatabasePath: args[1],
    })
  }

  throw new Error('KAN-885: invalid acceptance launcher arguments')
}

export interface SaveAcceptanceDatabaseSelectionInput extends AcceptanceDatabasePathInput {
  configPath: string
}

/**
 * Writes a non-sensitive locator by atomic rename within its config directory.
 * Only path accreditation is performed here: call sites MUST pass full
 * SQLite/H1/H2 gates before using this writer in a runtime launcher.
 * Does not create, seed, upgrade or otherwise open the SQLite database.
 */
export function saveAcceptanceDatabaseSelection(input: SaveAcceptanceDatabaseSelectionInput): void {
  const databasePath = assertAccreditedAcceptanceDatabasePath(input)
  const stagingPath = input.configPath + '.' + randomUUID() + '.tmp'
  const json = JSON.stringify({ version: 1, databasePath })
  let descriptor: number | undefined

  try {
    descriptor = openSync(stagingPath, 'wx', 0o600)
    writeFileSync(descriptor, json, { encoding: 'utf8' })
    closeSync(descriptor)
    descriptor = undefined
    renameSync(stagingPath, input.configPath)
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor)
    }
    rmSync(stagingPath, { force: true })
  }
}
