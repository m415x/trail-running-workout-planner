import { matchesGlob, resolve } from 'node:path'

/**
 * Isolated PostgreSQL acceptance lane for KAN-878 only.
 *
 * This validates an intended connection target; it does not prove that the
 * database is actually disposable or provisioned. Never use it to authorize
 * destructive operations on a database with an unknown lifecycle.
 */
export function assertSafeKan878PostgresTarget(
  env: Record<string, string | undefined>,
): void {
  const raw = env.KAN878_PG_URL
  if (!raw) {
    throw new Error('BLOCKED: KAN878_PG_URL required for KAN-878 PostgreSQL acceptance')
  }

  let target: URL
  try {
    target = new URL(raw)
  } catch {
    throw new Error('BLOCKED: invalid KAN878_PG_URL')
  }

  if (
    !['postgres:', 'postgresql:'].includes(target.protocol)
    || target.hostname !== '127.0.0.1'
    || target.port !== '55478'
    || target.pathname !== '/kan878_vertical_disposable'
    || target.search !== ''
    || target.hash !== ''
    || !target.username
    || !target.password
  ) {
    throw new Error('BLOCKED: unauthorized KAN-878 PostgreSQL acceptance target')
  }
}

/** Only these two checked-in files use the dedicated TEMP acceptance lane. */
const kan878AcceptanceFiles = [
  'tests/sessions/vertical-prescription-postgres-real-acceptance.test.ts',
  'tests/session-generation/kan-882-vertical-regeneration-postgres.test.ts',
] as const

const normalizedPath = (file: string) => resolve(file.replace(/\\+/g, '/')).replace(/\\+/g, '/')

export function isKan878AcceptanceFile(file: string): boolean {
  return kan878AcceptanceFiles.some(candidate => normalizedPath(candidate) === normalizedPath(file))
}

/** Quoted globs that could select real acceptance must be explicit paths.
 * Otherwise an unconfigured test could SKIP and the focused runner say GREEN. */
export function isKan878AcceptanceGlob(file: string): boolean {
  return /[*?\[{}]/.test(file) && kan878AcceptanceFiles.some(candidate =>
    matchesGlob(normalizedPath(candidate), normalizedPath(file)))
}
