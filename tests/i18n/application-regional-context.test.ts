import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  APPLICATION_REGIONAL_FALLBACKS,
  resolveApplicationRegionalContext,
} from '@/lib/regionalization/application-regional-context'

describe('application regional context', () => {
  it('uses explicit provisional presentation-locale defaults per supported language', () => {
    assert.equal(
      resolveApplicationRegionalContext({ language: 'es' }).presentationLocale,
      'es-AR',
    )
    assert.equal(
      resolveApplicationRegionalContext({ language: 'en' }).presentationLocale,
      'en-US',
    )
  })

  it('uses the provisional application timezone fallback independently of language', () => {
    assert.equal(
      resolveApplicationRegionalContext({ language: 'es' }).timeZone,
      'America/Argentina/Buenos_Aires',
    )
    assert.equal(
      resolveApplicationRegionalContext({ language: 'en' }).timeZone,
      'America/Argentina/Buenos_Aires',
    )
  })

  it('preserves explicit presentation locale and timezone overrides independently', () => {
    assert.deepEqual(
      resolveApplicationRegionalContext({
        language: 'es',
        presentationLocale: 'es-UY',
        timeZone: 'America/Montevideo',
      }),
      {
        language: 'es',
        presentationLocale: 'es-UY',
        timeZone: 'America/Montevideo',
      },
    )
  })

  it('does not make currency part of the regional context or fallbacks', () => {
    const context = resolveApplicationRegionalContext({ language: 'en' })

    assert.equal('currency' in context, false)
    assert.equal('currency' in APPLICATION_REGIONAL_FALLBACKS, false)
  })
})
