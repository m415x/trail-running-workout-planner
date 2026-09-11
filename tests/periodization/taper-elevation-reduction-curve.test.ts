import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { calculateTaperElevationReductionCurve } from '@/lib/periodization/taper-elevation-reduction-curve'

import type {
  CompetitionDemandAssessment,
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

const decision: TaperDurationDecision = {
  priority: 'A',
  strategy: 'full_taper',
  durationDays: 10,
  policyLimitsDays: { min: 4, max: 21 },
  demandPositionRange: { min: 0, max: 1 },
  reachedLoadPosition: 0.5,
  requiresCoachReview: false,
  rationale: {
    demandBand: 'high',
    demandConfidence: 'medium',
    volumeTrend: 'stable',
    elevationTrend: 'stable',
    volumeSustainedLoadRatio: 0.83,
    elevationSustainedLoadRatio: 0.8,
    reasonCodes: ['priority_guardrail', 'course_demand', 'reached_load', 'elevation_load_available'],
  },
}

function demand(distanceKm: number, elevationGainM: number | null): CompetitionDemandAssessment {
  return {
    courseEffortKm: elevationGainM === null ? distanceKm : distanceKm + elevationGainM / 100,
    band: 'high',
    confidence: elevationGainM === null ? 'low' : 'medium',
    profile: {
      distanceKm,
      elevationGainM,
    },
    limitations: {
      elevationGainKnown: elevationGainM !== null,
      elevationLossKnown: false,
      altitudeProfileKnown: false,
      technicalityKnown: false,
    },
  }
}

describe('taper elevation reduction curve', () => {
  it('preserves more D+ specificity for a high-vertical course than a flat course', () => {
    const flat = calculateTaperElevationReductionCurve(decision, load, demand(40, 300), 50)
    const vertical = calculateTaperElevationReductionCurve(decision, load, demand(40, 2_400), 50)

    assert.equal(flat.specificity, 'flat_or_minimal')
    assert.equal(vertical.specificity, 'high_vertical')
    assert.ok(vertical.finalReductionPercentage! < flat.finalReductionPercentage!)
    assert.ok(
      vertical.points.at(-1)!.targetWeeklyEquivalentElevationGainM
        > flat.points.at(-1)!.targetWeeklyEquivalentElevationGainM,
    )
  })

  it('reduces D+ progressively without preserving the full reached vertical load', () => {
    const result = calculateTaperElevationReductionCurve(
      decision,
      load,
      demand(30, 1_200),
      50,
    )

    assert.equal(result.referenceElevationGainM, 1_200)
    assert.equal(result.specificity, 'meaningful_vertical')
    assert.equal(result.finalReductionPercentage, 50)
    assert.equal(result.points.length, 10)
    assert.equal(result.points.at(-1)?.targetWeeklyEquivalentElevationGainM, 600)

    for (let index = 1; index < result.points.length; index += 1) {
      assert.ok(
        result.points[index].targetWeeklyEquivalentElevationGainM
          <= result.points[index - 1].targetWeeklyEquivalentElevationGainM,
      )
    }
  })

  it('keeps a specificity floor for high-vertical courses', () => {
    const result = calculateTaperElevationReductionCurve(
      decision,
      load,
      demand(30, 2_100),
      90,
    )

    assert.equal(result.specificityFloorPercentage, 35)
    assert.equal(result.finalReductionPercentage, 65)
    assert.equal(result.points.at(-1)?.targetWeeklyEquivalentElevationGainM, 420)
  })

  it('requires coach review when course D+ is unknown instead of inventing specificity', () => {
    const result = calculateTaperElevationReductionCurve(
      decision,
      load,
      demand(42, null),
      50,
    )

    assert.equal(result.specificity, 'unknown')
    assert.equal(result.requiresCoachReview, true)
    assert.equal(result.courseVerticalDensityMPerKm, null)
    assert.equal(result.finalReductionPercentage, 50)
  })

  it('does not invent a D+ curve when reached elevation load is unknown', () => {
    const unknownLoad: PreCompetitionLoadContext = {
      ...load,
      elevation: {
        recentAverageGainM: null,
        achievedPeakElevationGainM: null,
        trend: null,
        knownWeeks: 0,
      },
    }

    const result = calculateTaperElevationReductionCurve(
      decision,
      unknownLoad,
      demand(40, 2_400),
      50,
    )

    assert.equal(result.referenceElevationGainM, null)
    assert.equal(result.requiresCoachReview, true)
    assert.deepEqual(result.points, [])
  })
})
