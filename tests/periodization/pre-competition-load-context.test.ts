import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  DEFAULT_PRE_COMPETITION_REFERENCE_WEEKS,
  derivePreCompetitionLoadContext,
  derivePreCompetitionLoadContextFromMicrocycles,
} from '@/lib/periodization/pre-competition-load-context'

describe('pre-competition load context', () => {
  it('uses the most recent four weeks by default', () => {
    const result = derivePreCompetitionLoadContext([
      { volumeKm: 30, elevationGainM: 800 },
      { volumeKm: 40, elevationGainM: 1_000 },
      { volumeKm: 45, elevationGainM: 1_200 },
      { volumeKm: 50, elevationGainM: 1_400 },
      { volumeKm: 55, elevationGainM: 1_600 },
    ])

    assert.equal(result.referenceWindowWeeks, DEFAULT_PRE_COMPETITION_REFERENCE_WEEKS)
    assert.equal(result.analyzedWeeks, 4)
    assert.deepEqual(result.volume, {
      recentAverageKm: 47.5,
      achievedPeakVolumeKm: 55,
      trend: 'rising',
    })
    assert.deepEqual(result.elevation, {
      recentAverageGainM: 1_300,
      achievedPeakElevationGainM: 1_600,
      trend: 'rising',
      knownWeeks: 4,
    })
  })

  it('keeps volume and elevation as separate dimensions', () => {
    const result = derivePreCompetitionLoadContext([
      { volumeKm: 60, elevationGainM: 2_400 },
      { volumeKm: 60, elevationGainM: 2_000 },
      { volumeKm: 60, elevationGainM: 1_600 },
      { volumeKm: 60, elevationGainM: 1_200 },
    ])

    assert.equal(result.volume.trend, 'stable')
    assert.equal(result.elevation.trend, 'falling')
    assert.equal(result.volume.achievedPeakVolumeKm, 60)
    assert.equal(result.elevation.achievedPeakElevationGainM, 2_400)
  })

  it('preserves unknown D+ instead of inventing elevation load', () => {
    const result = derivePreCompetitionLoadContext([
      { volumeKm: 35, elevationGainM: null },
      { volumeKm: 38, elevationGainM: null },
      { volumeKm: 40, elevationGainM: null },
    ])

    assert.equal(result.volume.recentAverageKm, 37.67)
    assert.equal(result.volume.trend, 'rising')
    assert.deepEqual(result.elevation, {
      recentAverageGainM: null,
      achievedPeakElevationGainM: null,
      trend: null,
      knownWeeks: 0,
    })
  })

  it('supports a configurable reference window', () => {
    const result = derivePreCompetitionLoadContext([
      { volumeKm: 30, elevationGainM: 500 },
      { volumeKm: 35, elevationGainM: 700 },
      { volumeKm: 40, elevationGainM: 900 },
      { volumeKm: 45, elevationGainM: 1_100 },
    ], 2)

    assert.equal(result.referenceWindowWeeks, 2)
    assert.equal(result.analyzedWeeks, 2)
    assert.equal(result.volume.recentAverageKm, 42.5)
    assert.equal(result.volume.achievedPeakVolumeKm, 45)
    assert.equal(result.elevation.recentAverageGainM, 1_000)
  })

  it('normalizes current microcycle fields at an explicit-unit adapter boundary', () => {
    const result = derivePreCompetitionLoadContextFromMicrocycles([
      { targetVolumeKm: 42, targetElevationGain: 1_100 },
      { targetVolumeKm: 46, targetElevationGain: 1_300 },
      { targetVolumeKm: 50, targetElevationGain: 1_500 },
      { targetVolumeKm: 54, targetElevationGain: 1_700 },
    ])

    assert.equal(result.volume.achievedPeakVolumeKm, 54)
    assert.equal(result.elevation.achievedPeakElevationGainM, 1_700)
    assert.equal(result.volume.trend, 'rising')
    assert.equal(result.elevation.trend, 'rising')
  })

  it('rejects missing persisted volume instead of silently treating it as zero', () => {
    assert.throws(
      () => derivePreCompetitionLoadContextFromMicrocycles([
        { targetVolumeKm: null, targetElevationGain: 500 },
      ]),
      /targetVolumeKm/,
    )
  })

  it('rejects invalid reference windows and negative load values', () => {
    assert.throws(
      () => derivePreCompetitionLoadContext([{ volumeKm: 30, elevationGainM: 500 }], 0),
      /referenceWindowWeeks/,
    )
    assert.throws(
      () => derivePreCompetitionLoadContext([{ volumeKm: -1, elevationGainM: 500 }]),
      /volumeKm/,
    )
    assert.throws(
      () => derivePreCompetitionLoadContext([{ volumeKm: 30, elevationGainM: -1 }]),
      /elevationGainM/,
    )
  })
})
