import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateRaceCourseOriginalProfile } from '@/lib/race-catalog/race-course-profile'

describe('race course original profile', () => {
  it('accepts known distance and D+ without deriving either value', () => {
    const result = validateRaceCourseOriginalProfile({
      distanceKm: 42.2,
      elevationGainM: 2_350,
    })

    assert.deepEqual(result, { valid: true })
  })

  it('preserves unknown distance and D+ as valid incomplete catalog data', () => {
    const result = validateRaceCourseOriginalProfile({
      distanceKm: null,
      elevationGainM: null,
    })

    assert.deepEqual(result, { valid: true })
  })

  it('accepts explicit zero D+ for a known flat course', () => {
    const result = validateRaceCourseOriginalProfile({
      distanceKm: 10,
      elevationGainM: 0,
    })

    assert.deepEqual(result, { valid: true })
  })

  it('rejects zero, negative or non-finite distance', () => {
    for (const distanceKm of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateRaceCourseOriginalProfile({ distanceKm, elevationGainM: null })
      assert.equal(result.valid, false)
      if (!result.valid) assert.deepEqual(result.errors, ['race_course_distance_invalid'])
    }
  })

  it('rejects negative or non-finite D+ without changing distance validity', () => {
    for (const elevationGainM of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateRaceCourseOriginalProfile({ distanceKm: 21, elevationGainM })
      assert.equal(result.valid, false)
      if (!result.valid) assert.deepEqual(result.errors, ['race_course_elevation_gain_invalid'])
    }
  })
})
