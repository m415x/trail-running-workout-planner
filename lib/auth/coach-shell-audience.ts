import type { SupportedAuthLocale } from './safe-return-path'

export function resolveCoachShellAudience(
  audience: { status: 'athlete' | 'coach'; teamId: string } | { status: 'selection_required' | 'deny' },
  locale: SupportedAuthLocale,
): { status: 'allow' | 'deny' } | { status: 'redirect'; location: string } {
  if (audience.status === 'coach') return { status: 'allow' }
  if (audience.status === 'athlete') return { status: 'redirect', location: `/${locale}` }
  return { status: 'deny' }
}
