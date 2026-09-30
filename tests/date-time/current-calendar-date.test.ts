import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'

describe('getCurrentISODateInTimeZone', () => {
  it('requires the operational timezone to be supplied explicitly', () => {
    assert.throws(
      () =>
        getCurrentISODateInTimeZone(
          undefined as unknown as string,
          new Date('2026-10-01T02:30:00.000Z'),
        ),
      /timeZone is required/,
    )
  })

  it('resolves today from the supplied timezone instead of a hidden application default', () => {
    const now = new Date('2026-10-01T02:30:00.000Z')

    assert.equal(
      getCurrentISODateInTimeZone('America/Argentina/Buenos_Aires', now),
      '2026-09-30',
    )
    assert.equal(getCurrentISODateInTimeZone('UTC', now), '2026-10-01')
  })
})
