import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAudienceLoginDestination } from '@/lib/auth/audience-login-routing'

test('KAN-724/T2 routes Athlete to localized Home and staff presets to Dashboard', () => {
  for (const locale of ['es', 'en'] as const) {
    assert.equal(resolveAudienceLoginDestination({ audience: 'athlete', locale, returnTo: null }), `/${locale}`)
    assert.equal(resolveAudienceLoginDestination({ audience: 'coach', locale, returnTo: null }), `/${locale}/dashboard`)
  }
})

test('KAN-724/T2 preserves a safe deep link only for the effective audience', () => {
  assert.equal(resolveAudienceLoginDestination({ audience: 'athlete', locale: 'es', returnTo: '/es/stats' }), '/es/stats')
  assert.equal(resolveAudienceLoginDestination({ audience: 'coach', locale: 'en', returnTo: '/en/dashboard/planning' }), '/en/dashboard/planning')
  assert.equal(resolveAudienceLoginDestination({ audience: 'athlete', locale: 'es', returnTo: '/es/dashboard/athletes' }), '/es')
  assert.equal(resolveAudienceLoginDestination({ audience: 'coach', locale: 'en', returnTo: '/en/profile' }), '/en/dashboard')
})

test('KAN-724/T2 rejects unsafe and cross-locale return paths while retaining destination by audience', () => {
  for (const returnTo of ['https://outside.test', '//outside.test', '/en/dashboard', '/es/%2fadmin']) {
    assert.equal(resolveAudienceLoginDestination({ audience: 'athlete', locale: 'es', returnTo }), '/es')
  }
})

test('KAN-724/T2 keeps missing effective audience fail-closed rather than choosing Home or Dashboard', () => {
  for (const audience of ['selection_required', 'deny'] as const) {
    assert.equal(resolveAudienceLoginDestination({ audience, locale: 'es', returnTo: '/es/dashboard' }), null)
  }
})
