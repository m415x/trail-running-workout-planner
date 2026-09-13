import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ITRA_ENDURANCE_POINTS_2026_09_13 } from '@/lib/race-catalog/race-classification-rules'
import { validateRaceCourseCoherence } from '@/lib/race-catalog/race-course-coherence'
import type { RaceCourseClassification } from '@/types/training/race-catalog.types'

function itraClassification(
  overrides: Partial<RaceCourseClassification> = {},
): RaceCourseClassification {
  return {
    systemId: 'itra.endurance_points',
    authority: 'ITRA',
    dimension: 'endurance_difficulty',
    versionRef: 'current-2026-09-13',
    code: '3',
    provenance: 'derived_from_source_rules',
    sourceUrl: 'https://itra.run/About/DiscoverTrailRunning',
    ...overrides,
  }
}

describe('race course coherence', () => {
  it('accepts an unusual but structurally valid profile without universal heuristics', () => {
    const result = validateRaceCourseCoherence({
      profile: { distanceKm: 5, elevationGainM: 2_000 },
      modality: { code: 'trail' },
      classifications: [],
    })

    assert.deepEqual(result, { valid: true, errors: [], warnings: [] })
  })

  it('treats primitive invalidity as a hard domain error', () => {
    const result = validateRaceCourseCoherence({
      profile: { distanceKm: 0, elevationGainM: -1 },
      modality: null,
      classifications: [],
    })

    assert.equal(result.valid, false)
    assert.deepEqual(result.errors.map(({ code }) => code), ['race_course_profile_invalid'])
  })

  it('accepts a derived classification that matches its exact versioned rule', () => {
    const result = validateRaceCourseCoherence({
      profile: { distanceKm: 50, elevationGainM: 3_000 },
      modality: { code: 'trail' },
      classifications: [itraClassification({ code: '3' })],
    }, [ITRA_ENDURANCE_POINTS_2026_09_13])

    assert.deepEqual(result, { valid: true, errors: [], warnings: [] })
  })

  it('rejects a contradictory code when it claims to be derived from that ruleset', () => {
    const result = validateRaceCourseCoherence({
      profile: { distanceKm: 50, elevationGainM: 3_000 },
      modality: { code: 'trail' },
      classifications: [itraClassification({ code: '1' })],
    }, [ITRA_ENDURANCE_POINTS_2026_09_13])

    assert.equal(result.valid, false)
    assert.deepEqual(result.errors.map(({ code }) => code), [
      'race_course_derived_classification_mismatch',
    ])
    assert.equal(result.errors[0]?.expectedCode, '3')
  })

  it('keeps a declared external mismatch as a warning instead of rewriting it', () => {
    const result = validateRaceCourseCoherence({
      profile: { distanceKm: 50, elevationGainM: 3_000 },
      modality: { code: 'trail' },
      classifications: [itraClassification({
        code: '2',
        provenance: 'declared_by_source',
      })],
    }, [ITRA_ENDURANCE_POINTS_2026_09_13])

    assert.equal(result.valid, true)
    assert.deepEqual(result.warnings.map(({ code }) => code), [
      'race_course_external_classification_profile_mismatch',
    ])
    assert.equal(result.warnings[0]?.expectedCode, '3')
  })

  it('reports an unverifiable classification when the source rule needs missing D+', () => {
    const result = validateRaceCourseCoherence({
      profile: { distanceKm: 50, elevationGainM: null },
      modality: { code: 'trail' },
      classifications: [itraClassification()],
    }, [ITRA_ENDURANCE_POINTS_2026_09_13])

    assert.equal(result.valid, true)
    assert.deepEqual(result.warnings.map(({ code }) => code), [
      'race_course_classification_cannot_be_verified',
    ])
  })

  it('does not validate an external taxonomy unless its exact versioned rule is registered', () => {
    const result = validateRaceCourseCoherence({
      profile: { distanceKm: 50, elevationGainM: 3_000 },
      modality: { code: 'trail' },
      classifications: [itraClassification({
        versionRef: 'historical-v1',
        code: 'M',
      })],
    }, [ITRA_ENDURANCE_POINTS_2026_09_13])

    assert.deepEqual(result, { valid: true, errors: [], warnings: [] })
  })
})
