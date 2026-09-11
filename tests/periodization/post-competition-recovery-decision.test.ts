import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decidePostCompetitionRecovery } from '@/lib/periodization/post-competition-recovery-decision'

import type { CompetitionPriority, CourseProfile } from '@/types'

function profile(overrides: Partial<CourseProfile> = {}): CourseProfile {
  return {
    distanceKm: 20,
    elevationGainM: 500,
    source: 'manual',
    ...overrides,
  }
}

describe('post-competition recovery decision', () => {
  it('derives the same physiological recovery from the same race regardless of priority', () => {
    const course = profile({ distanceKm: 50, elevationGainM: 2_500 })
    const priorities: CompetitionPriority[] = ['A', 'B', 'C']
    const decisions = priorities.map((priority) => decidePostCompetitionRecovery({
      priority,
      courseProfile: course,
    }))

    assert.deepEqual(decisions.map((decision) => decision.demand.band), ['high', 'high', 'high'])
    assert.deepEqual(decisions.map((decision) => decision.totalRecoveryDays), [10, 10, 10])
    assert.deepEqual(
      decisions.map((decision) => decision.planningProtection),
      ['protected', 'contextual', 'minimal_interference'],
    )
  })

  it('models acute recovery, recovery and progressive reentry for meaningful demand', () => {
    const decision = decidePostCompetitionRecovery({
      priority: 'A',
      courseProfile: profile({ distanceKm: 42, elevationGainM: 1_500 }),
    })

    assert.equal(decision.demand.band, 'moderate')
    assert.deepEqual(decision.phases.map((phase) => phase.phase), [
      'acute_recovery',
      'recovery',
      'progressive_reentry',
    ])
    assert.ok(decision.phases.every((phase) => phase.allowIntenseSessions === false))
    assert.equal(decision.totalRecoveryDays, 7)
  })

  it('keeps recovery short for a low-cost C stimulus while preserving minimal-interference planning', () => {
    const decision = decidePostCompetitionRecovery({
      priority: 'C',
      courseProfile: profile({ distanceKm: 12, elevationGainM: 200 }),
    })

    assert.equal(decision.demand.band, 'minimal')
    assert.equal(decision.totalRecoveryDays, 2)
    assert.equal(decision.planningProtection, 'minimal_interference')
  })

  it('uses known large D- as a conservative eccentric-load signal', () => {
    const withoutDescent = decidePostCompetitionRecovery({
      priority: 'B',
      courseProfile: profile({ distanceKm: 25, elevationGainM: 1_000 }),
    })
    const withDescent = decidePostCompetitionRecovery({
      priority: 'B',
      courseProfile: profile({
        distanceKm: 25,
        elevationGainM: 1_000,
        elevationLossM: 3_000,
      }),
    })

    assert.equal(withoutDescent.demand.band, 'low')
    assert.equal(withDescent.demand.band, 'moderate')
    assert.ok(withDescent.totalRecoveryDays > withoutDescent.totalRecoveryDays)
    assert.ok(withDescent.reasonCodes.includes('downhill_load_available'))
  })

  it('does not invent recovery demand when D+ is unknown', () => {
    const decision = decidePostCompetitionRecovery({
      priority: 'A',
      courseProfile: profile({ elevationGainM: null }),
    })

    assert.equal(decision.demand.band, 'unknown')
    assert.equal(decision.requiresCoachReview, true)
    assert.ok(decision.reasonCodes.includes('competition_demand_unknown'))
  })

  it('does not confuse a high-demand C race with a trivial training stimulus', () => {
    const decision = decidePostCompetitionRecovery({
      priority: 'C',
      courseProfile: profile({ distanceKm: 80, elevationGainM: 4_500 }),
    })

    assert.equal(decision.demand.band, 'very_high')
    assert.equal(decision.totalRecoveryDays, 14)
    assert.equal(decision.planningProtection, 'minimal_interference')
  })
})
