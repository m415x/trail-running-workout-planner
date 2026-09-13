import type {
  RaceCourseClassification,
  RaceCourseClassificationDimension,
} from '@/types/training/race-catalog.types'

export type RaceCourseClassificationValidationErrorCode =
  | 'race_course_classification_system_required'
  | 'race_course_classification_authority_required'
  | 'race_course_classification_version_required'
  | 'race_course_classification_code_required'
  | 'race_course_classification_dimension_invalid'
  | 'race_course_classification_duplicate'

export type RaceCourseClassificationValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly errors: readonly RaceCourseClassificationValidationErrorCode[]
    }

const DIMENSIONS = new Set<RaceCourseClassificationDimension>([
  'endurance_difficulty',
  'distance_category',
  'international_format',
  'discipline',
  'technical_level',
  'other',
])

function classificationSlotKey(classification: RaceCourseClassification): string {
  return [
    classification.systemId.trim().toLowerCase(),
    classification.dimension,
    classification.versionRef.trim().toLowerCase(),
  ].join('::')
}

/**
 * Validates external classifications without interpreting source-specific codes.
 *
 * One course may carry several systems/dimensions. Within one system,
 * dimension and version there is a single classification slot so contradictory
 * codes cannot be stored as simultaneous truth for the same ruleset.
 */
export function validateRaceCourseClassifications(
  classifications: readonly RaceCourseClassification[],
): RaceCourseClassificationValidationResult {
  const errors: RaceCourseClassificationValidationErrorCode[] = []
  const slots = new Set<string>()

  for (const classification of classifications) {
    if (!classification.systemId.trim()) {
      errors.push('race_course_classification_system_required')
    }
    if (!classification.authority.trim()) {
      errors.push('race_course_classification_authority_required')
    }
    if (!classification.versionRef.trim()) {
      errors.push('race_course_classification_version_required')
    }
    if (!classification.code.trim()) {
      errors.push('race_course_classification_code_required')
    }
    if (!DIMENSIONS.has(classification.dimension)) {
      errors.push('race_course_classification_dimension_invalid')
    }

    const slot = classificationSlotKey(classification)
    if (slots.has(slot)) {
      errors.push('race_course_classification_duplicate')
    } else {
      slots.add(slot)
    }
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors: [...new Set(errors)] }
}
