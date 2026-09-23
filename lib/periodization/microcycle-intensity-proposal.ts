import { REFERENCE_PERCENTAGE_STEPS } from '@/lib/periodization/intensity-strategy-matrix'

import type {
  IntensityMethod,
  MicrocycleIntensityTargetDraft,
  ReferencePercentage,
  TrainingIntensity,
} from '@/types'

export interface ProposeMicrocycleIntensityParams {
  target: MicrocycleIntensityTargetDraft
  defaultMethod: IntensityMethod
}

/**
 * Rounds an internally calculated PAM value to the nearest practical step.
 * Ties resolve toward the lower percentage to avoid increasing load silently.
 */
export function getNearestReferencePercentageStep(
  referencePercentage: ReferencePercentage,
): (typeof REFERENCE_PERCENTAGE_STEPS)[number] {
  if (!Number.isFinite(referencePercentage) || referencePercentage <= 0) {
    throw new Error('El porcentaje PAM debe ser un número positivo y finito.')
  }

  return REFERENCE_PERCENTAGE_STEPS.reduce((nearest, candidate) => {
    const candidateDistance = Math.abs(candidate - referencePercentage)
    const nearestDistance = Math.abs(nearest - referencePercentage)

    return candidateDistance < nearestDistance ? candidate : nearest
  })
}

/**
 * Produces the method-specific weekly intensity recommendation.
 *
 * PAM is used only when it is the configured preference and the weekly rule
 * contains an intense stimulus with a PAM reference. Otherwise the safe and
 * executable fallback is the week's predominant heart-rate zone.
 */
export function proposeMicrocycleIntensity({
  target,
  defaultMethod,
}: ProposeMicrocycleIntensityParams): TrainingIntensity {
  if (
    defaultMethod === 'pam_percentage'
    && target.intenseSessionsTarget > 0
    && target.referencePercentageTarget !== null
  ) {
    return {
      method: 'pam_percentage',
      pamPercentage: getNearestReferencePercentageStep(target.referencePercentageTarget),
    }
  }

  return {
    method: 'hr_zone',
    zone: target.predominantZone,
  }
}
