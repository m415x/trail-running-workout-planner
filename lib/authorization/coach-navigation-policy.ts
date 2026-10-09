import type { CapabilityKey } from './capability-catalog'

export type CoachNavigationVisibility =
  | { readonly kind: 'alwaysAuthenticated' }
  | { readonly kind: 'capability'; readonly key: CapabilityKey }
  | { readonly kind: 'hidden' }

export interface CoachNavigationDestination {
  readonly href: string
  readonly visibility: CoachNavigationVisibility
}

/**
 * Coach shell discoverability only. This is never an authorization boundary.
 * Protected resources and mutations must still use their server-side guards.
 */
export const COACH_NAVIGATION_POLICY = [
  { href: '/dashboard', visibility: { kind: 'alwaysAuthenticated' } },
  { href: '/dashboard/athletes', visibility: { kind: 'capability', key: 'athlete.admin.manage' } },
  { href: '/dashboard/groups', visibility: { kind: 'capability', key: 'sporting_group.admin.manage' } },
  { href: '/dashboard/cohorts', visibility: { kind: 'capability', key: 'planning.manage' } },
  { href: '/dashboard/planning', visibility: { kind: 'capability', key: 'planning.manage' } },
  { href: '/dashboard/membership', visibility: { kind: 'capability', key: 'economic_policy.manage' } },
  { href: '/dashboard/competitions', visibility: { kind: 'hidden' } },
  { href: '/dashboard/sessions', visibility: { kind: 'capability', key: 'planning.manage' } },
  { href: '/dashboard/templates', visibility: { kind: 'hidden' } },
] as const satisfies readonly CoachNavigationDestination[]

export function visibleCoachNavigationDestinations(
  policy: readonly CoachNavigationDestination[],
  capabilities: ReadonlySet<CapabilityKey>,
): string[] {
  return policy.flatMap(({ href, visibility }) => {
    if (visibility.kind === 'hidden') return []
    if (visibility.kind === 'alwaysAuthenticated') return [href]
    return capabilities.has(visibility.key) ? [href] : []
  })
}
