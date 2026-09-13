import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateRaceCourseClassifications } from '@/lib/race-catalog/race-course-classification'
import type { RaceCourseClassification } from '@/types/training/race-catalog.types'

function classification(
  overrides: Partial<RaceCourseClassification> = {},
): RaceCourseClassification {
  return {
    systemId: 'itra.endurance_points',
    authority: 'ITRA',
    dimension: 'endurance_difficulty',
    versionRef: 'current-2026-09-13',
    code: '3',
    label: '75-114 km-effort',
    provenance: 'derived_from_source_rules',
    sourceUrl: 'https://itra.run/About/DiscoverTrailRunning',
    assessedAt: '2026-09-13T12:00:00.000Z',
    ...overrides,
  }
}

describe('race course external classification', () => {
  it('allows no classification when none is known or applicable', () => {
    assert.deepEqual(validateRaceCourseClassifications([]), { valid: true })
  })

  it('allows multiple dimensions from the same authority/version', () => {
    const result = validateRaceCourseClassifications([
      classification(),
      classification({
        systemId: 'itra.distance_category',
        dimension: 'distance_category',
        code: '50K',
        label: '50K',
      }),
    ])

    assert.deepEqual(result, { valid: true })
  })

  it('allows ISF discipline and technical level as separate dimensions', () => {
    const result = validateRaceCourseClassifications([
      classification({
        systemId: 'isf.discipline',
        authority: 'International Skyrunning Federation',
        dimension: 'discipline',
        versionRef: 'sport-rules-approved-2025-12',
        code: 'SKYULTRA',
      }),
      classification({
        systemId: 'isf.technical_level',
        authority: 'International Skyrunning Federation',
        dimension: 'technical_level',
        versionRef: 'technical-guidelines-2026-09-13',
        code: '2',
      }),
    ])

    assert.deepEqual(result, { valid: true })
  })

  it('allows the same system/dimension to preserve a historical version separately', () => {
    const result = validateRaceCourseClassifications([
      classification({ versionRef: 'historical-v1', code: 'M' }),
      classification({ versionRef: 'current-2026-09-13', code: '3' }),
    ])

    assert.deepEqual(result, { valid: true })
  })

  it('rejects two codes occupying the same system/dimension/version slot', () => {
    const result = validateRaceCourseClassifications([
      classification({ code: '2' }),
      classification({ code: '3' }),
    ])

    assert.equal(result.valid, false)
    if (!result.valid) {
      assert.deepEqual(result.errors, ['race_course_classification_duplicate'])
    }
  })

  it('requires system, authority, version and source-specific code', () => {
    const result = validateRaceCourseClassifications([
      classification({
        systemId: ' ',
        authority: '',
        versionRef: ' ',
        code: '',
      }),
    ])

    assert.equal(result.valid, false)
    if (!result.valid) {
      assert.deepEqual(result.errors, [
        'race_course_classification_system_required',
        'race_course_classification_authority_required',
        'race_course_classification_version_required',
        'race_course_classification_code_required',
      ])
    }
  })
})
