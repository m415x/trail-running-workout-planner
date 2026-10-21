import {
  parseAthleteTypographyPreference,
  serializeAthleteTypographyPreferenceCookie,
} from './preference'

/**
 * Pure shared projection for the initial server render and the hydrated client.
 * Neither browser storage nor environment detection belongs in this module.
 */
export function resolveAthleteTypographyBootstrap(rawCookieValue: unknown) {
  const preference = parseAthleteTypographyPreference(rawCookieValue)
  return { preference, attributeValue: preference }
}

/**
 * Cookie assignment descriptor; browser-specific effects live in the client
 * shell, while validation and serialization remain shared with SSR.
 */
export function createAthleteTypographyBrowserUpdate(
  rawPreference: unknown,
  options: { secure: boolean },
) {
  const { preference, attributeValue } = resolveAthleteTypographyBootstrap(rawPreference)

  return {
    preference,
    attributeValue,
    cookie: serializeAthleteTypographyPreferenceCookie(preference, options),
  }
}
