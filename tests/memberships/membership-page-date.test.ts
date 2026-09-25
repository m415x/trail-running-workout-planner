import assert from 'node:assert/strict'
import test from 'node:test'

import { todayInArgentina } from '../../lib/memberships/membership-page-date'

test('resolves the membership page date in Argentina as YYYY-MM-DD', () => {
  assert.equal(
    todayInArgentina(new Date('2026-10-01T02:30:00.000Z')),
    '2026-09-30',
  )

  assert.equal(
    todayInArgentina(new Date('2026-10-01T03:30:00.000Z')),
    '2026-10-01',
  )
})
