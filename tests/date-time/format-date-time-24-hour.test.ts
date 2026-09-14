import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatDateTime24Hour } from '@/lib/date-time/format-date-time-24-hour'

describe('formatDateTime24Hour', () => {
  it('uses the Spanish 24-hour policy and Argentina time zone', () => {
    assert.equal(
      formatDateTime24Hour('2026-09-13T18:40:00-03:00', 'es'),
      '13/9/26 · 18:40 hs',
    )
  })

  it('keeps the 24-hour clock for the English locale', () => {
    assert.equal(
      formatDateTime24Hour('2026-09-13T18:40:00-03:00', 'en'),
      '9/13/26 · 18:40 h',
    )
  })

  it('renders midnight as 00:00 rather than 24:00', () => {
    assert.equal(formatDateTime24Hour('2026-09-13T03:00:00Z', 'es'), '13/9/26 · 00:00 hs')
  })

  it('preserves the empty-value placeholder', () => {
    assert.equal(formatDateTime24Hour(null, 'es'), '—')
  })
})
