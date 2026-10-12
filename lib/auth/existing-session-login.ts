import type { SupportedAuthLocale } from './safe-return-path'
import { resolveAudienceLoginDestination } from './audience-login-routing'

type Session = { status: string; userId?: string }
type Audience = { status: 'athlete' | 'coach'; teamId: string } | { status: 'selection_required' | 'deny' }

export function resolveExistingSessionLogin(input: {
  session: Session
  audience: Audience
  locale: SupportedAuthLocale
  returnTo?: string | null
}): { status: 'redirect'; location: string } | { status: 'show_login' | 'access_unavailable' } {
  if (input.session.status !== 'authenticated' || !input.session.userId) return { status: 'show_login' }
  const location = resolveAudienceLoginDestination({
    audience: input.audience.status,
    locale: input.locale,
    returnTo: input.returnTo,
  })
  return location ? { status: 'redirect', location } : { status: 'access_unavailable' }
}
