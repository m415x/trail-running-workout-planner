import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildCompetitionImpactWindow,
  resolveCompetitionImpactWindows,
} from '@/lib/periodization/competition-impact-window'

import type {
  CompetitionPriority,
  RecoveryDecision,
} from '@/types'

function recovery(
  priority: CompetitionPriority,
  totalRecoveryDays: number,
): RecoveryDecision {
  return {
    priority,
    demand: {
      band: totalRecoveryDays >= 10 ? 'high' : 'low',
      confidence: 'medium',
      competitionDemandBand: totalRecoveryDays >= 10 ? 'high' : 'low',
      courseEffortKm: 40,
      elevationLossM: null,
      downhillLoadKnown: false,
      technicalityKnown: false,
      requiresCoachReview: false,
    },
    planningProtection: priority === 'A'
      ? 'protected'
      : priority === 'B'
        ? 'contextual'
        : 'minimal_interference',
    phases: totalRecoveryDays === 0
      ? []
      : [{
          phase: 'progressive_reentry',
          durationDays: totalRecoveryDays,
          trainingLoadCeilingPercentage: 70,
          allowIntenseSessions: false,
        }],
    totalRecoveryDays,
    requiresCoachReview: false,
    reasonCodes: ['competition_demand', 'downhill_load_unknown', 'priority_planning_protection'],
  }
}

function window(input: {
  id: string
  priority: CompetitionPriority
  date: string
  taperDays: number
  recoveryDays: number
}) {
  return buildCompetitionImpactWindow({
    competitionId: input.id,
    priority: input.priority,
    competitionDate: input.date,
    taperDurationDays: input.taperDays,
    recovery: recovery(input.priority, input.recoveryDays),
  })
}

describe('competition impact window', () => {
  it('builds explicit pre, race and post ranges', () => {
    const result = window({
      id: 'a',
      priority: 'A',
      date: '2026-11-15',
      taperDays: 10,
      recoveryDays: 7,
    })

    assert.deepEqual(result.pre, {
      startDate: '2026-11-05',
      endDate: '2026-11-14',
      durationDays: 10,
    })
    assert.deepEqual(result.race, {
      startDate: '2026-11-15',
      endDate: '2026-11-15',
      durationDays: 1,
    })
    assert.deepEqual(result.post, {
      startDate: '2026-11-16',
      endDate: '2026-11-22',
      durationDays: 7,
    })
    assert.equal(result.startDate, '2026-11-05')
    assert.equal(result.endDate, '2026-11-22')
  })

  it('supports zero-day B/C pre windows without fabricating taper days', () => {
    const result = window({
      id: 'c',
      priority: 'C',
      date: '2026-10-10',
      taperDays: 0,
      recoveryDays: 2,
    })

    assert.equal(result.pre, null)
    assert.equal(result.startDate, '2026-10-10')
    assert.equal(result.post?.endDate, '2026-10-12')
  })

  it('gives A precedence over an overlapping B pre/race adjustment', () => {
    const a = window({ id: 'a', priority: 'A', date: '2026-11-15', taperDays: 10, recoveryDays: 2 })
    const b = window({ id: 'b', priority: 'B', date: '2026-11-12', taperDays: 5, recoveryDays: 0 })

    const result = resolveCompetitionImpactWindows([b, a])
    const overlap = result.overlaps.find((item) => (
      item.firstCompetitionId === 'b' || item.secondCompetitionId === 'b'
    ))!

    assert.equal(overlap.resolution, 'higher_priority_precedence')
    assert.equal(overlap.dominantCompetitionId, 'a')
    assert.equal(overlap.requiresCoachReview, false)
  })

  it('preserves pending recovery when it overlaps a later lower-priority taper', () => {
    const a = window({ id: 'a', priority: 'A', date: '2026-11-01', taperDays: 7, recoveryDays: 10 })
    const c = window({ id: 'c', priority: 'C', date: '2026-11-14', taperDays: 3, recoveryDays: 2 })

    const result = resolveCompetitionImpactWindows([a, c])
    assert.equal(result.overlaps.length, 1)
    assert.equal(result.overlaps[0].resolution, 'recovery_preserved')
    assert.ok(result.overlaps[0].reasonCodes.includes('recovery_cannot_be_discarded'))
    assert.equal(result.requiresCoachReview, false)
  })

  it('requires coach review when a race occurs during unresolved recovery', () => {
    const first = window({ id: 'first', priority: 'B', date: '2026-10-01', taperDays: 3, recoveryDays: 10 })
    const second = window({ id: 'second', priority: 'B', date: '2026-10-07', taperDays: 2, recoveryDays: 4 })

    const result = resolveCompetitionImpactWindows([first, second])

    assert.equal(result.requiresCoachReview, true)
    assert.equal(result.overlaps[0].resolution, 'coach_review_required')
    assert.ok(result.overlaps[0].reasonCodes.includes('race_during_pending_recovery'))
  })

  it('requires coach review for incompatible same-priority pre/race overlaps', () => {
    const first = window({ id: 'b1', priority: 'B', date: '2026-10-20', taperDays: 7, recoveryDays: 0 })
    const second = window({ id: 'b2', priority: 'B', date: '2026-10-22', taperDays: 7, recoveryDays: 0 })

    const result = resolveCompetitionImpactWindows([first, second])

    assert.equal(result.requiresCoachReview, true)
    assert.equal(result.overlaps[0].resolution, 'coach_review_required')
    assert.ok(result.overlaps[0].reasonCodes.includes('same_priority_overlap'))
  })

  it('moves only the competitive impact window when the competition date changes', () => {
    const original = window({ id: 'race', priority: 'A', date: '2026-11-15', taperDays: 10, recoveryDays: 7 })
    const rescheduled = window({ id: 'race', priority: 'A', date: '2026-11-22', taperDays: 10, recoveryDays: 7 })

    assert.equal(original.pre?.startDate, '2026-11-05')
    assert.equal(rescheduled.pre?.startDate, '2026-11-12')
    assert.equal(rescheduled.race.startDate, '2026-11-22')
    assert.equal(rescheduled.post?.endDate, '2026-11-29')
    assert.equal(rescheduled.startDate > original.startDate, true)
  })

  it('rebuilds priority-specific protection when a B competition is promoted to A', () => {
    const asB = window({ id: 'race', priority: 'B', date: '2026-11-15', taperDays: 5, recoveryDays: 3 })
    const asA = window({ id: 'race', priority: 'A', date: '2026-11-15', taperDays: 10, recoveryDays: 7 })

    assert.equal(asB.priority, 'B')
    assert.equal(asA.priority, 'A')
    assert.equal(asA.pre?.durationDays, 10)
    assert.equal(asA.post?.durationDays, 7)
    assert.equal(asA.startDate < asB.startDate, true)
    assert.equal(asA.endDate > asB.endDate, true)
  })

  it('rejects invalid calendar dates and mismatched recovery priority', () => {
    assert.throws(
      () => buildCompetitionImpactWindow({
        competitionId: 'bad-date',
        priority: 'A',
        competitionDate: '2026-02-30',
        taperDurationDays: 5,
        recovery: recovery('A', 3),
      }),
      /valid calendar date/,
    )

    assert.throws(
      () => buildCompetitionImpactWindow({
        competitionId: 'bad-priority',
        priority: 'A',
        competitionDate: '2026-10-10',
        taperDurationDays: 5,
        recovery: recovery('B', 3),
      }),
      /priority must match/,
    )
  })
})
