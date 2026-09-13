import type { RaceCourseModality } from '@/types/training/race-catalog.types'

export type RaceCourseModalityValidationErrorCode =
  | 'race_course_modality_invalid'
  | 'race_course_custom_modality_label_required'

export type RaceCourseModalityValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly errors: readonly RaceCourseModalityValidationErrorCode[]
    }

const KNOWN_MODALITY_CODES = new Set([
  'road',
  'trail',
  'skyrunning',
  'vertical_kilometer',
  'other',
])

/** Validates modality structure only; profile coherence is a later policy. */
export function validateRaceCourseModality(
  modality: RaceCourseModality | null,
): RaceCourseModalityValidationResult {
  if (modality === null) return { valid: true }

  if (!KNOWN_MODALITY_CODES.has(modality.code)) {
    return { valid: false, errors: ['race_course_modality_invalid'] }
  }

  if (modality.code === 'other' && !modality.label.trim()) {
    return {
      valid: false,
      errors: ['race_course_custom_modality_label_required'],
    }
  }

  return { valid: true }
}
