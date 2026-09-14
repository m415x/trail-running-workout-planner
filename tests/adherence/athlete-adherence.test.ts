import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_ADHERENCE_RULE,
  deriveAthleteAdherence,
} from '@/lib/adherence/athlete-adherence'
import type {
  AthletePlanRealComparison,
  PlanRealComparisonState,
  PlanRealMetricComparison,
  PlannedSessionComparison,
  TrainingComparisonMetricName,
  UnplannedRealizedComparison,
} from '@/types'

const window = {
  kind: 'week',
  startDate: '2026-09-07',
  endDate: '2026-09-13',
} as const

const metricNames: readonly TrainingComparisonMetricName[] = [
  'distanceKm',
  'durationMin',
  'elevationGainM',
  'intensity',
]

function metric(name: TrainingComparisonMetricName, state: 'matched' | 'deviation' | 'not_evaluated'): PlanRealMetricComparison {
  if (state === 'not_evaluated') {
    return {
      name,
      evaluation: {
        state: 'not_evaluated',
        planned: { state: 'unknown', reason: 'not_prescribed', unit: null },
        realized: { state: 'unknown', reason: 'not_observed', unit: null },
        absoluteDelta: null,
        relativeDeltaPercent: null,
        reason: 'not_observed',
      },
    }
  }

  return {
    name,
    evaluation: {
      state,
      planned: { state: 'known', value: 10, unit: 'km' },
      realized: { state: 'known', value: state === 'matched' ? 10 : 12, unit: 'km' },
      absoluteDelta: state === 'matched' ? 0 : 2,
      relativeDeltaPercent: state === 'matched' ? 0 : 20,
    },
  }
}

function planned(
  id: string,
  state: Exclude<PlanRealComparisonState, 'unplanned_realized'>,
  metricState: 'matched' | 'deviation' | 'not_evaluated' = 'matched',
): PlannedSessionComparison {
  return {
    kind: 'planned_session',
    state,
    teamId: 'team-1',
    athleteId: 'athlete-1',
    date: `2026-09-${id.padStart(2, '0')}`,
    sessionId: `session-${id}`,
    sessionTitle: `Session ${id}`,
    planning: {
      source: 'group',
      teamId: 'team-1',
      groupId: 'group-1',
      planId: 'plan-1',
      cohortId: null,
    },
    realized: state === 'unknown' ? null : {
      recordId: `record-${id}`,
      provenance: {
        source: 'manual',
        sourceActivityId: null,
        loggedAt: '2026-09-10T20:00:00.000Z',
        sessionLink: 'explicit',
      },
      quality: state === 'known_not_completed' ? 'explicit_missed' : 'usable',
      limitations: [],
    },
    metrics: metricNames.map(name => metric(name, metricState)),
    limitations: [],
  }
}

function free(): UnplannedRealizedComparison {
  return {
    kind: 'unplanned_realized',
    state: 'unplanned_realized',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    date: '2026-09-12',
    realized: {
      recordId: 'free-1',
      provenance: {
        source: 'manual',
        sourceActivityId: null,
        loggedAt: '2026-09-12T20:00:00.000Z',
        sessionLink: 'none',
      },
      quality: 'usable',
      limitations: [],
    },
    metrics: metricNames.map(name => metric(name, 'not_evaluated')),
    limitations: [],
  }
}

function comparison(
  items: AthletePlanRealComparison['items'],
  planningLimitations: AthletePlanRealComparison['planningLimitations'] = [],
): AthletePlanRealComparison {
  return {
    teamId: 'team-1',
    athleteId: 'athlete-1',
    window,
    items,
    planningLimitations,
  }
}

describe('athlete adherence', () => {
  it('derives high frequency adherence from confirmed outcomes only', () => {
    const result = deriveAthleteAdherence(comparison([
      planned('08', 'matched'),
      planned('09', 'deviation'),
      planned('10', 'known_not_completed', 'not_evaluated'),
    ]))

    assert.equal(result.frequency.state, 'available')
    assert.equal(result.frequency.adherencePercent, 200 / 3)
    assert.equal(result.coverage.coveragePercent, 100)
    assert.equal(result.frequency.counts.denominator, 3)
  })

  it('keeps unknown outside failure and lowers coverage instead', () => {
    const result = deriveAthleteAdherence(comparison([
      planned('08', 'matched'),
      planned('09', 'unknown', 'not_evaluated'),
      planned('10', 'unknown', 'not_evaluated'),
    ]))

    assert.equal(result.frequency.state, 'insufficient_data')
    assert.equal(result.frequency.adherencePercent, null)
    assert.equal(result.coverage.coveragePercent, 100 / 3)
    assert.equal(result.coverage.unknownSessions, 2)
    assert.ok(result.frequency.reasons.includes('insufficient_coverage'))
  })

  it('does not let free training inflate plan adherence', () => {
    const result = deriveAthleteAdherence(comparison([
      planned('08', 'known_not_completed', 'not_evaluated'),
      planned('09', 'known_not_completed', 'not_evaluated'),
      free(),
    ]))

    assert.equal(result.frequency.state, 'available')
    assert.equal(result.frequency.adherencePercent, 0)
    assert.equal(result.coverage.unplannedRealizedSessions, 1)
    assert.equal(result.frequency.counts.denominator, 2)
  })

  it('keeps metric dimensions independent', () => {
    const first = planned('08', 'matched', 'matched')
    const second = planned('09', 'deviation', 'deviation')
    const result = deriveAthleteAdherence(comparison([first, second]))
    const distance = result.dimensions.find(item => item.metric === 'distanceKm')

    assert.equal(distance?.state, 'available')
    assert.equal(distance?.adherencePercent, 50)
    assert.deepEqual(distance?.counts, {
      comparableSessions: 2,
      matchedSessions: 1,
      deviationSessions: 1,
      notEvaluatedSessions: 0,
    })
  })

  it('suppresses conclusions when planning resolution is limited', () => {
    const result = deriveAthleteAdherence(comparison([
      planned('08', 'matched'),
      planned('09', 'matched'),
    ], [{
      date: '2026-09-10',
      status: 'conflict',
      reason: 'overlapping-cohorts',
      conflictingIds: ['membership-a', 'membership-b'],
    }]))

    assert.equal(result.frequency.state, 'insufficient_data')
    assert.ok(result.frequency.reasons.includes('planning_resolution_limited'))
    assert.ok(result.dimensions.every(item => item.state === 'insufficient_data'))
  })

  it('uses an explicit versioned default rule', () => {
    const result = deriveAthleteAdherence(comparison([]))
    assert.deepEqual(result.rule, DEFAULT_ADHERENCE_RULE)
    assert.equal(result.frequency.state, 'insufficient_data')
    assert.ok(result.frequency.reasons.includes('no_eligible_planned_sessions'))
  })
})
