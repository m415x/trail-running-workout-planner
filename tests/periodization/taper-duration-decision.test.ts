import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assessCompetitionDemand } from '@/lib/periodization/competition-demand-assessment'
import { derivePreCompetitionLoadContext } from '@/lib/periodization/pre-competition-load-context'
import { determineTaperDuration } from '@/lib/periodization/taper-duration-decision'

const moderateDemand = assessCompetitionDemand({
  distanceKm: 30,
  elevationGainM: 2_000,
})

const lowerReachedLoad = derivePreCompetitionLoadContext([
  { volumeKm: 30, elevationGainM: 1_600 },
  { volumeKm: 25, elevationGainM: 1_300 },
  { volumeKm: 20, elevationGainM: 1_000 },
  { volumeKm: 15, elevationGainM: 700 },
])

const higherReachedLoad = derivePreCompetitionLoadContext([
  { volumeKm: 40, elevationGainM: 1_200 },
  { volumeKm: 45, elevationGainM: 1_500 },
  { volumeKm: 50, elevationGainM: 1_800 },
  { volumeKm: 55, elevationGainM: 2_100 },
])

describe('taper duration decision', () => {
  it('returns days, policy limits and structured rationale for priority A', () => {
    const result = determineTaperDuration('A', moderateDemand, higherReachedLoad)

    assert.equal(result.strategy, 'full_taper')
    assert.deepEqual(result.policyLimitsDays, { min: 4, max: 21 })
    assert.equal(Number.isInteger(result.durationDays), true)
    assert.equal(result.durationDays >= 4 && result.durationDays <= 21, true)
    assert.equal(result.rationale.demandBand, 'moderate')
    assert.equal(result.rationale.volumeTrend, 'rising')
    assert.equal(result.rationale.reasonCodes.includes('reached_load'), true)
  })

  it('places higher reached load later in the same demand-defined taper range', () => {
    const lower = determineTaperDuration('A', moderateDemand, lowerReachedLoad)
    const higher = determineTaperDuration('A', moderateDemand, higherReachedLoad)

    assert.equal(higher.reachedLoadPosition > lower.reachedLoadPosition, true)
    assert.equal(higher.durationDays > lower.durationDays, true)
    assert.deepEqual(higher.demandPositionRange, lower.demandPositionRange)
  })

  it('gives a more demanding course a longer A taper for equivalent reached load', () => {
    const shortDemand = assessCompetitionDemand({
      distanceKm: 10,
      elevationGainM: 0,
    })
    const extremeDemand = assessCompetitionDemand({
      distanceKm: 100,
      elevationGainM: 6_000,
    })

    const shortDecision = determineTaperDuration('A', shortDemand, higherReachedLoad)
    const extremeDecision = determineTaperDuration('A', extremeDemand, higherReachedLoad)

    assert.equal(shortDecision.durationDays < extremeDecision.durationDays, true)
    assert.equal(shortDecision.durationDays < 10, true)
    assert.equal(extremeDecision.durationDays >= 18, true)
  })

  it('keeps B and C within their narrower priority guardrails', () => {
    const b = determineTaperDuration('B', moderateDemand, higherReachedLoad)
    const c = determineTaperDuration('C', moderateDemand, higherReachedLoad)

    assert.equal(b.strategy, 'proportional_adjustment')
    assert.equal(b.durationDays >= 0 && b.durationDays <= 7, true)
    assert.equal(c.strategy, 'specific_stimulus')
    assert.equal(c.durationDays >= 0 && c.durationDays <= 3, true)
    assert.equal(c.durationDays <= b.durationDays, true)
  })

  it('flags unknown course demand for coach review instead of assuming flat terrain', () => {
    const unknownDemand = assessCompetitionDemand({
      distanceKm: 30,
      elevationGainM: null,
    })
    const result = determineTaperDuration('A', unknownDemand, higherReachedLoad)

    assert.equal(result.requiresCoachReview, true)
    assert.equal(result.rationale.demandBand, 'unknown')
    assert.equal(result.rationale.reasonCodes.includes('course_demand_unknown'), true)
    assert.equal(result.durationDays >= 4 && result.durationDays <= 21, true)
  })
})
