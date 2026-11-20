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
