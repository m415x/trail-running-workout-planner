import { COACH_NAVIGATION_POLICY } from '@/lib/authorization/coach-navigation-policy'

/**
 * Presentation-only defense in depth. Never treats a client allowlist as
 * authorization to access the destination or mutate server-side resources.
 */
export function selectCoachSidebarDestinations(
  visibleDestinations: readonly string[],
): string[] {
  const allowed = new Set(visibleDestinations)

  return COACH_NAVIGATION_POLICY
    .filter(({ href, visibility }) => visibility.kind !== 'hidden' && allowed.has(href))
    .map(({ href }) => href)
}
