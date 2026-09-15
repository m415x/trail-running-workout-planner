import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildAthleteSystematicVolumeAssessment } from '@/lib/systematic-volume/systematic-volume-assessment'
import type {
  SystematicVolumeDimension,
  SystematicVolumeMicrocycleEvidence,
} from '@/types'

function evidence(
  id: string,
  dimension: SystematicVolumeDimension,
  delta: number | null,
  startDate: string,
): SystematicVolumeMicrocycleEvidence {
  const evaluable = delta !== null
  return {
    microcycleId: id,
    startDate,
    endDate: startDate,
    dimension,
    evaluable,
    magnitude: evaluable
      ? {
          planned: 100,
          realized: 100 + delta!,
          absoluteDelta: delta!,
          relativeDeltaPercent: delta!,
        }
      : null,
    coverage: {
      plannedSessions: 1,
      comparableSessions: evaluable ? 1 : 0,
      unknownSessions: evaluable ? 0 : 1,
      unplannedRealizedSessions: 0,
      coverageRatio: evaluable ? 1 : 0,
    },
    context: {
      microcycleType: 'base',
      loadFocus: null,
      competitionPhases: [],
      competitionIds: [],
      requiresCoachReview: false,
    },
    insufficientReasons: evaluable ? [] : ['insufficient_microcycle_coverage'],
    contributingPlannedSessionIds: ['session-1'],
    contributingRealizedSessionIds: evaluable ? ['realized-1'] : [],
    unplannedRealizedSessionIds: [],
  }
}

describe('systematic volume longitudinal assessment', () => {
  it('classifies two consecutive excess microcycles as systematic excess', () => {
    const assessment = buildAthleteSystematicVolumeAssessment('athlete-1', [
      evidence('mc-1', 'distanceKm', 10, '2026-09-01'),
      evidence('mc-2', 'distanceKm', 15, '2026-09-08'),
    ])

    assert.equal(assessment.signals.distanceKm.pattern, 'systematic_excess')
    assert.equal(assessment.signals.distanceKm.attention, 'review')
    assert.deepEqual(assessment.signals.distanceKm.contributingMicrocycleIds, ['mc-1', 'mc-2'])
  })

  it('keeps a single excess microcycle isolated', () => {
    const assessment = buildAthleteSystematicVolumeAssessment('athlete-1', [
      evidence('mc-1', 'distanceKm', 0, '2026-09-01'),
      evidence('mc-2', 'distanceKm', 20, '2026-09-08'),
    ])

    assert.equal(assessment.signals.distanceKm.pattern, 'isolated_excess')
    assert.equal(assessment.signals.distanceKm.attention, 'info')
  })

  it('does not bridge persistence across an unknown microcycle', () => {
    const assessment = buildAthleteSystematicVolumeAssessment('athlete-1', [
      evidence('mc-1', 'distanceKm', 20, '2026-09-01'),
      evidence('mc-2', 'distanceKm', null, '2026-09-08'),
      evidence('mc-3', 'distanceKm', 20, '2026-09-15'),
    ])

    assert.equal(assessment.signals.distanceKm.pattern, 'isolated_excess')
    assert.equal(assessment.signals.distanceKm.previousEvaluable, null)
  })

  it('keeps dimensions independent when their trends diverge', () => {
    const assessment = buildAthleteSystematicVolumeAssessment('athlete-1', [
      evidence('mc-1', 'distanceKm', 10, '2026-09-01'),
      evidence('mc-2', 'distanceKm', 15, '2026-09-08'),
      evidence('mc-1', 'durationMin', 0, '2026-09-01'),
      evidence('mc-2', 'durationMin', 0, '2026-09-08'),
      evidence('mc-1', 'elevationGainM', null, '2026-09-01'),
      evidence('mc-2', 'elevationGainM', null, '2026-09-08'),
    ])

    assert.equal(assessment.signals.distanceKm.pattern, 'systematic_excess')
    assert.equal(assessment.signals.durationMin.pattern, 'within_plan')
    assert.equal(assessment.signals.elevationGainM.pattern, 'insufficient_data')
    assert.equal(assessment.primaryDimension, 'distanceKm')
    assert.equal(assessment.attention, 'review')
  })
})
