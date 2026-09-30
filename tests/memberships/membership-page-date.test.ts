import assert from 'node:assert/strict'
import test from 'node:test'

import { membershipPageCalendarDate } from '../../lib/memberships/membership-page-date'

test('resolves the membership page calendar date from an explicit operational timezone', () => {
  assert.equal(
    membershipPageCalendarDate(
      'America/Argentina/Buenos_Aires',
      new Date('2026-10-01T02:30:00.000Z'),
    ),
    '2026-09-30',
  )

  assert.equal(
    membershipPageCalendarDate('UTC', new Date('2026-10-01T02:30:00.000Z')),
    '2026-10-01',
  )
})
