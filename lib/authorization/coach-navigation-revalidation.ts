/**
 * Events that invalidate the server-derived Coach navigation projection.
 * This is a refresh policy, never a substitute for H3 authorization.
 */
export type CoachNavigationRevalidationEvent =
  | 'active-team-changed'
  | 'session-changed'
  | 'membership-changed'
  | 'grant-changed'
  | 'grant-expired'
  | 'render'
  | 'route-changed'

const REFRESH_EVENTS = new Set<CoachNavigationRevalidationEvent>([
  'active-team-changed',
  'session-changed',
  'membership-changed',
  'grant-changed',
  'grant-expired',
])

export function createCoachNavigationRevalidationPolicy() {
  return {
    shouldRefresh(event: CoachNavigationRevalidationEvent): boolean {
      return REFRESH_EVENTS.has(event)
    },
  }
}
