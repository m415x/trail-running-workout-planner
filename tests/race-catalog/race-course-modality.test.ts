import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validateRaceCourseModality } from '@/lib/race-catalog/race-course-modality'
import type { RaceCourseModality } from '@/types/training/race-catalog.types'

describe('race course modality', () => {
  it('accepts the native modalities including explicit vertical kilometer', () => {
    for (const code of ['road', 'trail', 'skyrunning', 'vertical_kilometer'] as const) {
      assert.deepEqual(validateRaceCourseModality({ code }), { valid: true })
    }
  })

  it('allows unknown modality while catalog data is incomplete', () => {
    assert.deepEqual(validateRaceCourseModality(null), { valid: true })
  })

  it('supports an explicit custom modality without changing the entity model', () => {
    assert.deepEqual(
      validateRaceCourseModality({ code: 'other', label: 'snow_running' }),
      { valid: true },
    )
  })

  it('requires a label for custom modality', () => {
    const result = validateRaceCourseModality({ code: 'other', label: '   ' })

    assert.equal(result.valid, false)
    if (!result.valid) {
      assert.deepEqual(result.errors, ['race_course_custom_modality_label_required'])
    }
  })

  it('does not accept an unknown native code through an untrusted boundary', () => {
    const invalid = { code: 'verticalish' } as RaceCourseModality
    const result = validateRaceCourseModality(invalid)

    assert.equal(result.valid, false)
    if (!result.valid) assert.deepEqual(result.errors, ['race_course_modality_invalid'])
  })
})
