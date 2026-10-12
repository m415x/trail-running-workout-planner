import { resolveSafeAuthReturnPath, type SupportedAuthLocale } from './safe-return-path'

export type LoginAudience = 'athlete' | 'coach' | 'selection_required' | 'deny'

export function resolveAudienceLoginDestination(input: {
  audience: LoginAudience
  locale: SupportedAuthLocale
  returnTo?: string | null
}): string | null {
  if (input.audience !== 'athlete' && input.audience !== 'coach') return null

  const home = `/${input.locale}`
  const dashboard = `${home}/dashboard`
  const fallback = input.audience === 'athlete' ? home : dashboard
  const safe = resolveSafeAuthReturnPath(input.returnTo, input.locale)

  if (input.audience === 'coach') {
    return safe === dashboard || safe.startsWith(`${dashboard}/`) ? safe : fallback
  }

  if (safe === dashboard || safe.startsWith(`${dashboard}/`)) return fallback
  return safe
}
