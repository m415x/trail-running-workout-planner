import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { assessCompetitionDemand } from '@/lib/periodization/competition-demand-assessment'

describe('competition demand assessment', () => {
  it('calculates course effort from distance and positive elevation gain', () => {
    const result = assessCompetitionDemand({
      distanceKm: 30,
      elevationGainM: 2_000,
    })

    assert.equal(result.courseEffortKm, 50)
    assert.equal(result.band, 'moderate')
    assert.equal(result.confidence, 'medium')
    assert.equal(result.limitations.elevationGainKnown, true)
  })

  it('uses stable demand bands without mapping them to taper duration', () => {
    assert.equal(assessCompetitionDemand({ distanceKm: 10, elevationGainM: 0 }).band, 'very_low')
    assert.equal(assessCompetitionDemand({ distanceKm: 25, elevationGainM: 0 }).band, 'low')
    assert.equal(assessCompetitionDemand({ distanceKm: 45, elevationGainM: 0 }).band, 'moderate')
    assert.equal(assessCompetitionDemand({ distanceKm: 75, elevationGainM: 0 }).band, 'high')
    assert.equal(assessCompetitionDemand({ distanceKm: 115, elevationGainM: 0 }).band, 'very_high')
    assert.equal(assessCompetitionDemand({ distanceKm: 155, elevationGainM: 0 }).band, 'extreme')
  })

  it('does not invent D+ when elevation gain is unknown', () => {
    const result = assessCompetitionDemand({
      distanceKm: 30,
      elevationGainM: null,
    })

    assert.equal(result.courseEffortKm, null)
    assert.equal(result.band, 'unknown')
    assert.equal(result.confidence, 'low')
    assert.equal(result.limitations.elevationGainKnown, false)
  })

  it('raises confidence when future course-profile signals are available', () => {
    const result = assessCompetitionDemand({
      distanceKm: 42,
      elevationGainM: 2_400,
      elevationLossM: 2_400,
      minAltitudeM: 620,
      maxAltitudeM: 2_180,
      technicality: 'high',
      source: 'gpx',
    })

    assert.equal(result.courseEffortKm, 66)
    assert.equal(result.band, 'moderate')
    assert.equal(result.confidence, 'high')
    assert.deepEqual(result.limitations, {
      elevationGainKnown: true,
      elevationLossKnown: true,
      altitudeProfileKnown: true,
      technicalityKnown: true,
    })
  })

  it('rejects invalid course values', () => {
    assert.throws(
      () => assessCompetitionDemand({ distanceKm: 0, elevationGainM: 100 }),
      /distanceKm/,
    )
    assert.throws(
      () => assessCompetitionDemand({ distanceKm: 10, elevationGainM: -1 }),
      /elevationGainM/,
    )
  })
})
