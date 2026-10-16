import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ATHLETE_TYPOGRAPHY_COOKIE_NAME,
  ATHLETE_TYPOGRAPHY_MAX_AGE_SECONDS,
  parseAthleteTypographyPreference,
  serializeAthleteTypographyPreferenceCookie,
} from '@/lib/athlete-typography/preference'

test('KAN-359/T1 validates the Athlete font-size preference by exact allowlist and fails to standard', () => {
  assert.equal(parseAthleteTypographyPreference('compact'), 'compact')
  assert.equal(parseAthleteTypographyPreference('standard'), 'standard')
  assert.equal(parseAthleteTypographyPreference('large'), 'large')
  assert.equal(parseAthleteTypographyPreference('extra-large'), 'extra-large')

  for (const untrusted of [undefined, null, '', 'LARGE', 'large ', '120%', '2', 'huge', '<script>']) {
    assert.equal(parseAthleteTypographyPreference(untrusted), 'standard')
  }
})

test('KAN-359/T1 serializes a browser-local functional cookie with explicit scope and expiry', () => {
  assert.equal(ATHLETE_TYPOGRAPHY_COOKIE_NAME, 'ept_athlete_font_size')
  assert.equal(ATHLETE_TYPOGRAPHY_MAX_AGE_SECONDS, 15_552_000)

  const http = serializeAthleteTypographyPreferenceCookie('large', { secure: false })
  assert.equal(
    http,
    'ept_athlete_font_size=large; Path=/; Max-Age=15552000; SameSite=Lax',
  )
  assert.doesNotMatch(http, /(?:^|; )(?:HttpOnly|Secure)(?:;|$)/)

  const https = serializeAthleteTypographyPreferenceCookie('extra-large', { secure: true })
  assert.equal(
    https,
    'ept_athlete_font_size=extra-large; Path=/; Max-Age=15552000; SameSite=Lax; Secure',
  )
})

test('KAN-359/T1 refuses injection and never persists unapproved preference values', () => {
  const invalid = serializeAthleteTypographyPreferenceCookie('large; Secure; Max-Age=0', { secure: true })
  assert.equal(
    invalid,
    'ept_athlete_font_size=standard; Path=/; Max-Age=15552000; SameSite=Lax; Secure',
  )
  assert.doesNotMatch(invalid, /HttpOnly|Domain=/)
})
