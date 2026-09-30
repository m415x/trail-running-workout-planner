import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatDateTime24Hour } from '@/lib/date-time/format-date-time-24-hour'

describe('formatDateTime24Hour', () => {
  it('formats an instant from explicit presentation locale and timezone', () => {
    assert.equal(
      formatDateTime24Hour(
        '2026-09-13T18:40:00-03:00',
        {
          language: 'es',
          presentationLocale: 'es-AR',
          timeZone: 'America/Argentina/Buenos_Aires',
        },
      ),
      '13/9/26 · 18:40 hs',
    )

    assert.equal(
      formatDateTime24Hour(
        '2026-09-13T18:40:00-03:00',
        {
          language: 'en',
          presentationLocale: 'en-US',
          timeZone: 'America/Argentina/Buenos_Aires',
        },
      ),
      '9/13/26 · 18:40 h',
    )
  })

  it('does not infer timezone from language or presentation locale', () => {
    assert.equal(
      formatDateTime24Hour(
        '2026-09-13T03:00:00Z',
        {
          language: 'en',
          presentationLocale: 'en-US',
          timeZone: 'UTC',
        },
      ),
      '9/13/26 · 03:00 h',
    )
  })

  it('preserves the empty-value placeholder', () => {
    assert.equal(
      formatDateTime24Hour(null, {
        language: 'es',
        presentationLocale: 'es-AR',
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
      '—',
    )
  })
})
