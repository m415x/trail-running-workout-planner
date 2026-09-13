import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  calculateKilometerEffortKm,
  deriveRaceCourseProfile,
} from '@/lib/race-catalog/race-course-derived-profile'

describe('race course derived profile', () => {
  it('derives m+/km and kilometer-effort without rounding', () => {
    const result = deriveRaceCourseProfile({
      distanceKm: 42.2,
      elevationGainM: 2_350,
    })

    assert.equal(result.elevationDensityMPerKm, 2_350 / 42.2)
    assert.equal(result.kilometerEffortKm, 65.7)
  })

  it('treats explicit zero D+ as a known flat course', () => {
    assert.deepEqual(
      deriveRaceCourseProfile({ distanceKm: 10, elevationGainM: 0 }),
      {
        elevationDensityMPerKm: 0,
        kilometerEffortKm: 10,
      },
    )
  })

  it('keeps both derived values unknown when distance is unknown', () => {
    assert.deepEqual(
      deriveRaceCourseProfile({ distanceKm: null, elevationGainM: 800 }),
      {
        elevationDensityMPerKm: null,
        kilometerEffortKm: null,
      },
    )
  })

  it('keeps both derived values unknown when D+ is unknown', () => {
    assert.deepEqual(
      deriveRaceCourseProfile({ distanceKm: 21, elevationGainM: null }),
      {
        elevationDensityMPerKm: null,
        kilometerEffortKm: null,
      },
    )
  })

  it('uses the same kilometer-effort primitive consumed by H10', () => {
    assert.equal(calculateKilometerEffortKm(50, 3_000), 80)
    assert.equal(calculateKilometerEffortKm(50, null), null)
  })
})
