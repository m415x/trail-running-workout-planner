import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { selectEffectiveAthletePlanWeek } from '@/lib/athlete-planning/plan-week-detail'

type EffectiveSession = { id: string; date: string; title: string }

const sessions: EffectiveSession[] = [
  { id: 'normal', date: '2026-10-06', title: 'Easy run' },
  // A session originally prescribed in the previous week, now effectively on Oct 7.
  { id: 'moved-in', date: '2026-10-07', title: 'Rescheduled long run' },
  // A session originally prescribed in this week, now effectively on Oct 13.
  { id: 'moved-out', date: '2026-10-13', title: 'Rescheduled hills' },
]

describe('KAN-645/T3 — selected effective Athlete planning week', () => {
  it('includes a moved-in session once and excludes a moved-out session from the original week', () => {
    const result = selectEffectiveAthletePlanWeek({
      monday: '2026-10-05',
      effectiveSessions: sessions,
    })
    assert.equal(result.status, 'loaded')
    if (result.status !== 'loaded') return
    assert.deepEqual(result.sessions.map((session) => session.id), ['normal', 'moved-in'])
    assert.deepEqual(result.days.map((day) => day.date), [
      '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
      '2026-10-09', '2026-10-10', '2026-10-11',
    ])
    assert.deepEqual(result.days[2].sessions.map((session) => session.id), ['moved-in'])
  })

  it('counts the moved-out session once in its effective destination week', () => {
    const result = selectEffectiveAthletePlanWeek({
      monday: '2026-10-12',
      effectiveSessions: sessions,
    })
    assert.equal(result.status, 'loaded')
    if (result.status !== 'loaded') return
    assert.deepEqual(result.sessions.map((session) => session.id), ['moved-out'])
  })

  it('rejects conflicting effective duplicates rather than presenting a partial week', () => {
    assert.deepEqual(selectEffectiveAthletePlanWeek({
      monday: '2026-10-05',
      effectiveSessions: [
        { id: 'same', date: '2026-10-06', title: 'First' },
        { id: 'same', date: '2026-10-07', title: 'Conflicting adjustment' },
      ],
    }), { status: 'error' })
  })

  it('keeps a genuinely empty authorized week as seven explicit empty days', () => {
    const result = selectEffectiveAthletePlanWeek({
      monday: '2026-10-05',
      effectiveSessions: [],
    })
    assert.equal(result.status, 'loaded')
    if (result.status !== 'loaded') return
    assert.equal(result.days.length, 7)
    assert.ok(result.days.every((day) => day.sessions.length === 0))
  })
})
