import { validateRaceCourseClassifications } from '@/lib/race-catalog/race-course-classification'
import { validateRaceCourseModality } from '@/lib/race-catalog/race-course-modality'
import { validateRaceCourseOriginalProfile } from '@/lib/race-catalog/race-course-profile'
import type {
  RaceCourseClassification,
  RaceCourseClassificationDimension,
  RaceCourseModality,
  RaceCourseOriginalProfile,
} from '@/types/training/race-catalog.types'

export interface RaceCourseClassificationRule {
  readonly systemId: string
  readonly dimension: RaceCourseClassificationDimension
  readonly versionRef: string
  /** Returns the expected source code, or null when inputs are insufficient. */
  readonly resolveCode: (profile: RaceCourseOriginalProfile) => string | null
}

export interface RaceCourseCoherenceInput {
  readonly profile: RaceCourseOriginalProfile
  readonly modality: RaceCourseModality | null
  readonly classifications: readonly RaceCourseClassification[]
}

export type RaceCourseCoherenceErrorCode =
  | 'race_course_profile_invalid'
  | 'race_course_modality_invalid'
  | 'race_course_classification_invalid'
  | 'race_course_derived_classification_mismatch'

export type RaceCourseCoherenceWarningCode =
  | 'race_course_classification_cannot_be_verified'
  | 'race_course_external_classification_profile_mismatch'

export interface RaceCourseCoherenceIssue {
  readonly code: RaceCourseCoherenceErrorCode | RaceCourseCoherenceWarningCode
  readonly classification?: RaceCourseClassification
  readonly expectedCode?: string | null
}

export interface RaceCourseCoherenceResult {
  readonly valid: boolean
  readonly errors: readonly RaceCourseCoherenceIssue[]
  readonly warnings: readonly RaceCourseCoherenceIssue[]
}

function ruleKey(
  systemId: string,
  dimension: RaceCourseClassificationDimension,
  versionRef: string,
): string {
  return [systemId.trim().toLowerCase(), dimension, versionRef.trim().toLowerCase()].join('::')
}

/**
 * Validates cross-field coherence without inventing universal sports thresholds.
 *
 * External classification codes are checked only when the caller provides an
 * exact system/dimension/version rule. Unusual but otherwise valid course
 * profiles are not rejected merely because they look atypical.
 */
export function validateRaceCourseCoherence(
  input: RaceCourseCoherenceInput,
  classificationRules: readonly RaceCourseClassificationRule[] = [],
): RaceCourseCoherenceResult {
  const errors: RaceCourseCoherenceIssue[] = []
  const warnings: RaceCourseCoherenceIssue[] = []

  if (!validateRaceCourseOriginalProfile(input.profile).valid) {
    errors.push({ code: 'race_course_profile_invalid' })
  }

  if (!validateRaceCourseModality(input.modality).valid) {
    errors.push({ code: 'race_course_modality_invalid' })
  }

  if (!validateRaceCourseClassifications(input.classifications).valid) {
    errors.push({ code: 'race_course_classification_invalid' })
  }

  if (errors.length > 0) return { valid: false, errors, warnings }

  const rulesByKey = new Map(
    classificationRules.map((rule) => [
      ruleKey(rule.systemId, rule.dimension, rule.versionRef),
      rule,
    ]),
  )

  for (const classification of input.classifications) {
    const rule = rulesByKey.get(ruleKey(
      classification.systemId,
      classification.dimension,
      classification.versionRef,
    ))

    if (!rule) continue

    const expectedCode = rule.resolveCode(input.profile)
    if (expectedCode === null) {
      warnings.push({
        code: 'race_course_classification_cannot_be_verified',
        classification,
        expectedCode: null,
      })
      continue
    }

    if (expectedCode === classification.code) continue

    if (classification.provenance === 'derived_from_source_rules') {
      errors.push({
        code: 'race_course_derived_classification_mismatch',
        classification,
        expectedCode,
      })
    } else {
      warnings.push({
        code: 'race_course_external_classification_profile_mismatch',
        classification,
        expectedCode,
      })
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}
