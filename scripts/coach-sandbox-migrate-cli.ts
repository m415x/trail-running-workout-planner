import { isAbsolute, win32 } from 'node:path'

/**
 * Argument-only boundary for a future, explicitly authorized local replay.
 *
 * This module intentionally has no main() entrypoint, executable package
 * script, default migration callback, connection URL, or database imports.
 * "--apply" expresses CLI intent but is NOT proof of independent human
 * authorization; a separately approved operational procedure and all
 * fail-closed migration gates remain mandatory before any real DDL.
 */
export async function runCoachSandboxMigrationCli(request: {
  args: readonly string[]
  repositoryRoot: string
  applyMigration: (repositoryRoot: string) => Promise<void>
}): Promise<void> {
  if (
    !Array.isArray(request.args)
    || request.args.length !== 1
    || request.args[0] !== '--apply'
  ) {
    throw new Error('Explicit single --apply migration operation argument required')
  }

  if (
    typeof request.repositoryRoot !== 'string'
    || request.repositoryRoot.length === 0
    || !(isAbsolute(request.repositoryRoot) || win32.isAbsolute(request.repositoryRoot))
  ) {
    throw new Error('Absolute local migration repository root required')
  }

  // A caller-supplied callback is the only possible effect: this function
  // never creates a driver or silently supplies a migration implementation.
  if (typeof request.applyMigration !== 'function') {
    throw new Error('Explicit approved migration callback required')
  }

  await request.applyMigration(request.repositoryRoot)
}
