import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { calculateTaperVolumeReductionCurve } from '@/lib/periodization/taper-volume-reduction-curve'

import type {
  CompetitionPriority,
  NumericRange,
  PreCompetitionLoadContext,
  TaperDurationDecision,
} from '@/types'

const load: PreCompetitionLoadContext = {
  referenceWindowWeeks: 4,
  analyzedWeeks: 4,
  volume: {
    recentAverageKm: 50,
    achievedPeakVolumeKm: 60,
    trend: 'stable',
  },
  elevation: {
    recentAverageGainM: 1_200,
    achievedPeakElevationGainM: 1_500,
    trend: 'stable',
    knownWeeks: 4,
  },
}

function decision(
  priority: CompetitionPriority,
  durationDays: number,
  policyLimitsDays: NumericRange,
): TaperDurationDecision {
  return {
    priority,
    strategy: priority === 'A'
      ? 'full_taper'
      : priority === 'B'
        ? 'proportional_adjustment'
        : 'specific_stimulus',
    durationDays,
    policyLimitsDays,
    demandPositionRange: { min: 0, max: 1 },
    reachedLoadPosition: 0.5,
    requiresCoachReview: false,
    rationale: {
      demandBand: 'moderate',
      demandConfidence: 'medium',
      volumeTrend: 'stable',
      elevationTrend: 'stable',
      volumeSustainedLoadRatio: 0.83,
      elevationSustainedLoadRatio: 0.8,
      reasonCodes: ['priority_guardrail', 'course_demand', 'reached_load', 'elevation_load_available'],
    },
  }
}

describe('taper volume reduction curve', () => {
  it('uses the reached recent average rather than configured or peak volume', () => {
    const result = calculateTaperVolumeReductionCurve(
      decision('A', 4, { min: 4, max: 21 }),
      load,
    )

    assert.equal(result.referenceVolumeKm, 50)
    assert.equal(result.finalReductionPercentage, 30)
    assert.deepEqual(
      result.points.map((point) => point.targetWeeklyEquivalentVolumeKm),
      [46.25, 42.5, 38.75, 35],
    )
  })

  it('reduces volume monotonically toward the competition', () => {
    const result = calculateTaperVolumeReductionCurve(
      decision('A', 10, { min: 4, max: 21 }),
      load,
    )

    assert.equal(result.points.length, 10)
    assert.equal(result.points[0].daysBeforeCompetition, 10)
    assert.equal(result.points.at(-1)?.daysBeforeCompetition, 1)

    for (let index = 1; index < result.points.length; index += 1) {
      assert.ok(
        result.points[index].reductionPercentage >= result.points[index - 1].reductionPercentage,
      )
      assert.ok(
        result.points[index].targetWeeklyEquivalentVolumeKm
          <= result.points[index - 1].targetWeeklyEquivalentVolumeKm,
      )
    }
  })

  it('reaches the upper policy reduction for the longest A taper', () => {
    const result = calculateTaperVolumeReductionCurve(
      decision('A', 21, { min: 4, max: 21 }),
      load,
    )

    assert.equal(result.finalReductionPercentage, 60)
    assert.equal(result.points.at(-1)?.remainingVolumePercentage, 40)
    assert.equal(result.points.at(-1)?.targetWeeklyEquivalentVolumeKm, 20)
  })

  it('supports a zero-day B adjustment without fabricating a taper curve', () => {
    const result = calculateTaperVolumeReductionCurve(
      decision('B', 0, { min: 0, max: 7 }),
      load,
    )

    assert.equal(result.finalReductionPercentage, 0)
    assert.deepEqual(result.points, [])
  })

  it('keeps B and C reductions within their centralized priority guardrails', () => {
    const b = calculateTaperVolumeReductionCurve(
      decision('B', 7, { min: 0, max: 7 }),
      load,
    )
    const c = calculateTaperVolumeReductionCurve(
      decision('C', 3, { min: 0, max: 3 }),
      load,
    )

    assert.equal(b.finalReductionPercentage, 40)
    assert.equal(c.finalReductionPercentage, 20)
  })
})
