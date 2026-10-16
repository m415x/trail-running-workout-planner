/**
 * Browser-local Athlete typography preference contract.
 *
 * This module is deliberately independent of React, auth, databases and the
 * visual scale. SSR and client adapters must share these validation rules.
 */
export const ATHLETE_TYPOGRAPHY_COOKIE_NAME = 'ept_athlete_font_size'
export const ATHLETE_TYPOGRAPHY_MAX_AGE_SECONDS = 15_552_000

export const ATHLETE_TYPOGRAPHY_PRESETS = [
  'compact',
  'standard',
  'large',
  'extra-large',
] as const

export type AthleteTypographyPreference = (typeof ATHLETE_TYPOGRAPHY_PRESETS)[number]

const DEFAULT_PREFERENCE: AthleteTypographyPreference = 'standard'

export function parseAthleteTypographyPreference(value: unknown): AthleteTypographyPreference {
  if (typeof value !== 'string') return DEFAULT_PREFERENCE

  switch (value) {
    case 'compact':
    case 'standard':
    case 'large':
    case 'extra-large':
      return value
    default:
      return DEFAULT_PREFERENCE
  }
}

/**
 * The cookie is deliberately readable by client code so a future Settings
 * control can update it. The caller supplies HTTPS status explicitly.
 * No Domain attribute is set, keeping it host-only.
 */
export function serializeAthleteTypographyPreferenceCookie(
  value: unknown,
  options: { secure: boolean },
): string {
  const preference = parseAthleteTypographyPreference(value)
  const attributes = [
    `${ATHLETE_TYPOGRAPHY_COOKIE_NAME}=${preference}`,
    'Path=/',
    `Max-Age=${ATHLETE_TYPOGRAPHY_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ]

  if (options.secure) attributes.push('Secure')

  return attributes.join('; ')
}
