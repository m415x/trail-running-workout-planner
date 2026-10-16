import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  resolveAthleteTypographyBootstrap,
  createAthleteTypographyBrowserUpdate,
} from '@/lib/athlete-typography/bootstrap'
import { ATHLETE_TYPOGRAPHY_COOKIE_NAME } from '@/lib/athlete-typography/preference'

test('KAN-359/T3 server and client initial values agree for supported and untrusted cookies', () => {
  const cases: Array<[unknown, string]> = [
    ['compact', 'compact'],
    ['standard', 'standard'],
    ['large', 'large'],
    ['extra-large', 'extra-large'],
    [undefined, 'standard'],
    ['oversized', 'standard'],
    ['large; Path=/', 'standard'],
  ]
  for (const [raw, expected] of cases) {
    const initial = resolveAthleteTypographyBootstrap(raw)
    assert.equal(initial.preference, expected)
    assert.equal(initial.attributeValue, expected)
  }
})

test('KAN-359/T3 browser update validates values and delegates only cookie serialization', () => {
  const valid = createAthleteTypographyBrowserUpdate('large', { secure: true })
  assert.equal(valid.preference, 'large')
  assert.equal(valid.attributeValue, 'large')
  assert.match(valid.cookie, /^ept_athlete_font_size=large; Path=\/; Max-Age=15552000; SameSite=Lax; Secure$/)
  const invalid = createAthleteTypographyBrowserUpdate('large; Domain=evil.test', { secure: false })
  assert.equal(invalid.preference, 'standard')
  assert.equal(invalid.attributeValue, 'standard')
  assert.doesNotMatch(invalid.cookie, /Domain=|HttpOnly|Secure/)
})

test('KAN-359/T3 Athlete server layout reads the request cookie and supplies the same initial value to its shell', () => {
  const layout = readFileSync('app/[locale]/(mobile)/layout.tsx', 'utf8')
  assert.match(layout, /cookies\s*\(/)
  assert.match(layout, new RegExp(ATHLETE_TYPOGRAPHY_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '|ATHLETE_TYPOGRAPHY_COOKIE_NAME'))
  assert.match(layout, /resolveAthleteTypographyBootstrap/)
  assert.match(layout, /<MobileShell[^>]*initialTypographyPreference=/)
})

test('KAN-359/T3 client shell must initialize from SSR prop without deferred storage bootstrap', () => {
  const shell = readFileSync('components/layout/MobileShell.tsx', 'utf8')
  assert.match(shell, /initialTypographyPreference/)
  assert.match(shell, /data-athlete-typography/)
  assert.doesNotMatch(shell, /localStorage|sessionStorage/)
  assert.doesNotMatch(shell, /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*document\.cookie/s)
})
