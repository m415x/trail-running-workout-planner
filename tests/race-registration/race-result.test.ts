import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createRaceResult,
  raceResultForParticipation,
} from '@/lib/competitions/race-result'
import type { RaceResult } from '@/types/training/race-registration.types'

describe('factual race result', () => {
  it('preserves unknown actual distance and elapsed time as null', () => {
    assert.deepEqual(createRaceResult({ actualDistanceKm: null, elapsedTimeSeconds: null }), {
      actualDistanceKm: null,
      elapsedTimeSeconds: null,
    } satisfies RaceResult)
  })

  it('preserves known numeric zero instead of treating it as unknown', () => {
    assert.deepEqual(createRaceResult({ actualDistanceKm: 0, elapsedTimeSeconds: 0 }), {
      actualDistanceKm: 0,
      elapsedTimeSeconds: 0,
    })
  })

  it('does not backfill unknown actual evidence from nominal course metrics', () => {
    const result = createRaceResult({ actualDistanceKm: null, elapsedTimeSeconds: null })
    const nominalCourse = { nominalDistanceKm: 30, nominalElevationGainM: 1650 }

    assert.equal(result.actualDistanceKm, null)
    assert.equal(result.elapsedTimeSeconds, null)
    assert.equal('nominalDistanceKm' in result, false)
    assert.equal('nominalElevationGainM' in result, false)
    assert.equal(nominalCourse.nominalDistanceKm, 30)
  })

  it('allows finished and DNF participation with partial or unknown result metrics', () => {
    assert.deepEqual(
      raceResultForParticipation('finished', { actualDistanceKm: 30.4, elapsedTimeSeconds: null }),
      { actualDistanceKm: 30.4, elapsedTimeSeconds: null },
    )
    assert.deepEqual(
      raceResultForParticipation('dnf', { actualDistanceKm: null, elapsedTimeSeconds: 7200 }),
      { actualDistanceKm: null, elapsedTimeSeconds: 7200 },
    )
  })

  it('does not fabricate a race result for DNS or unknown participation', () => {
    assert.equal(raceResultForParticipation('dns', { actualDistanceKm: 0, elapsedTimeSeconds: 0 }), null)
    assert.equal(raceResultForParticipation('unknown', { actualDistanceKm: 30, elapsedTimeSeconds: 3600 }), null)
  })

  it('keeps competitive result evidence separate from realized training and interpretation', () => {
    const result = createRaceResult({ actualDistanceKm: 30, elapsedTimeSeconds: 10_800 })

    assert.equal('realizedTrainingId' in result, false)
    assert.equal('workoutLogId' in result, false)
    assert.equal('readiness' in result, false)
    assert.equal('pace' in result, false)
    assert.equal('performance' in result, false)
  })
})
