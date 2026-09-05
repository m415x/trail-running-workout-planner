import { PAM_PERCENTAGE_STEPS } from '@/lib/periodization/intensity-strategy-matrix'

import type {
  IntensityMethod,
  MicrocycleIntensityTargetDraft,
  PamPercentage,
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
export function getNearestPamPercentageStep(
  pamPercentage: PamPercentage,
): (typeof PAM_PERCENTAGE_STEPS)[number] {
  if (!Number.isFinite(pamPercentage) || pamPercentage <= 0) {
    throw new Error('El porcentaje PAM debe ser un número positivo y finito.')
  }

  return PAM_PERCENTAGE_STEPS.reduce((nearest, candidate) => {
    const candidateDistance = Math.abs(candidate - pamPercentage)
    const nearestDistance = Math.abs(nearest - pamPercentage)

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
    && target.pamPercentageTarget !== null
  ) {
    return {
      method: 'pam_percentage',
      pamPercentage: getNearestPamPercentageStep(target.pamPercentageTarget),
    }
  }

  return {
    method: 'hr_zone',
    zone: target.predominantZone,
  }
}
