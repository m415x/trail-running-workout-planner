import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildCompetitionWeekLoad } from '@/lib/periodization/competition-week-load'

describe('competition week load', () => {
  it('keeps prescribed training separate from competition exposure', () => {
    const result = buildCompetitionWeekLoad(
      { volumeKm: 18, elevationGainM: 450 },
      {
        competitionId: 'race-a',
        name: 'Trail 30K',
        date: '2026-10-18',
        priority: 'A',
        distanceKm: 30,
        elevationGainM: 1_800,
      },
    )

    assert.deepEqual(result.training, {
      volumeKm: 18,
      elevationGainM: 450,
    })
    assert.deepEqual(result.competition, {
      competitionId: 'race-a',
      name: 'Trail 30K',
      date: '2026-10-18',
      priority: 'A',
      distanceKm: 30,
      elevationGainM: 1_800,
    })
    assert.deepEqual(result.totalExposure, {
      distanceKm: 48,
      elevationGainM: 2_250,
    })

    assert.equal(result.training.volumeKm, 18)
    assert.notEqual(result.training.volumeKm, result.totalExposure.distanceKm)
  })

  it('keeps total D+ unknown when race D+ is unknown instead of assuming flat terrain', () => {
    const result = buildCompetitionWeekLoad(
      { volumeKm: 12, elevationGainM: 300 },
      {
        competitionId: 'race-b',
        name: 'Road 10K',
        date: '2026-11-01',
        priority: 'B',
        distanceKm: 10,
        elevationGainM: null,
      },
    )

    assert.equal(result.training.elevationGainM, 300)
    assert.equal(result.competition.elevationGainM, null)
    assert.equal(result.totalExposure.distanceKm, 22)
    assert.equal(result.totalExposure.elevationGainM, null)
  })

  it('keeps total D+ unknown when training D+ is not available', () => {
    const result = buildCompetitionWeekLoad(
      { volumeKm: 8, elevationGainM: null },
      {
        competitionId: 'race-c',
        name: 'Vertical Race',
        date: '2026-11-15',
        priority: 'C',
        distanceKm: 12,
        elevationGainM: 1_000,
      },
    )

    assert.equal(result.totalExposure.distanceKm, 20)
    assert.equal(result.totalExposure.elevationGainM, null)
  })

  it('allows zero pre-race training without losing competition exposure', () => {
    const result = buildCompetitionWeekLoad(
      { volumeKm: 0, elevationGainM: 0 },
      {
        competitionId: 'race-a',
        name: 'Ultra',
        date: '2026-12-06',
        priority: 'A',
        distanceKm: 80,
        elevationGainM: 4_500,
      },
    )

    assert.equal(result.training.volumeKm, 0)
    assert.equal(result.competition.distanceKm, 80)
    assert.equal(result.totalExposure.distanceKm, 80)
    assert.equal(result.totalExposure.elevationGainM, 4_500)
  })

  it('rejects invalid or ambiguous load values', () => {
    assert.throws(
      () => buildCompetitionWeekLoad(
        { volumeKm: -1, elevationGainM: 100 },
        {
          competitionId: 'race-a',
          name: 'Race',
          date: '2026-10-18',
          priority: 'A',
          distanceKm: 20,
          elevationGainM: 500,
        },
      ),
      /training.volumeKm/,
    )

    assert.throws(
      () => buildCompetitionWeekLoad(
        { volumeKm: 10, elevationGainM: 100 },
        {
          competitionId: '',
          name: 'Race',
          date: '2026-10-18',
          priority: 'A',
          distanceKm: 20,
          elevationGainM: 500,
        },
      ),
      /competition.competitionId/,
    )
  })
})
