import type postgres from 'postgres'

type PgClient = ReturnType<typeof postgres>
export type AuthorizedBiometricTeamTimeZone =
  | { readonly status: 'resolved'; readonly timeZone: string }
  | { readonly status: 'denied' }

/**
 * Internal server-only Team region lookup. The Team id must originate from
 * resolved H2/H3 SELF authority, never from a client-supplied payload.
 * No fallback to host, UTC, weather service or a user/browser preference.
 */
export async function resolveAuthorizedBiometricTeamTimeZone(
  sql: PgClient,
  teamId: string,
): Promise<AuthorizedBiometricTeamTimeZone> {
  if (typeof teamId !== 'string' || !teamId.trim()) return { status: 'denied' }

  const rows = await sql<{ time_zone: string | null }[]>`
    SELECT time_zone FROM teams
    WHERE id = ${teamId} AND is_deleted = false
  `
  if (rows.length !== 1) return { status: 'denied' }
  const timeZone = rows[0]?.time_zone
  if (!timeZone || timeZone !== timeZone.trim()) return { status: 'denied' }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(0))
    return { status: 'resolved', timeZone }
  } catch {
    return { status: 'denied' }
  }
}
