import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  absoluteInstant,
  calendarDate,
  localPlannedDateTime,
} from '@/lib/date-time/temporal-values'

describe('temporal value semantics', () => {
  it('keeps a civil calendar date separate from timezone and instant semantics', () => {
    assert.deepEqual(calendarDate('2026-09-30'), {
      kind: 'calendar_date',
      value: '2026-09-30',
    })
  })

  it('requires an explicit timezone for a local planned date-time', () => {
    assert.deepEqual(
      localPlannedDateTime({
        date: '2026-09-30',
        time: '18:40',
        timeZone: 'America/Argentina/Buenos_Aires',
      }),
      {
        kind: 'local_planned_date_time',
        date: '2026-09-30',
        time: '18:40',
        timeZone: 'America/Argentina/Buenos_Aires',
      },
    )
  })

  it('keeps an absolute instant as an absolute value without converting civil dates', () => {
    assert.deepEqual(absoluteInstant('2026-09-30T21:40:00Z'), {
      kind: 'absolute_instant',
      value: '2026-09-30T21:40:00Z',
    })
  })
})
