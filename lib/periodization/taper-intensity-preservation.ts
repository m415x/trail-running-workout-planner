import { getCompetitionAdjustmentPolicy } from '@/lib/periodization/competition-adjustment-policy'

import type {
  TaperDurationDecision,
  TaperIntensityPreservationDecision,
  TaperIntensityReference,
} from '@/types'

function validateReference(reference: TaperIntensityReference) {
  if (!Number.isInteger(reference.intenseSessionsTarget) || reference.intenseSessionsTarget < 0) {
    throw new Error('Intense sessions target must be a non-negative integer.')
  }

  if (
    !Number.isInteger(reference.minimumRecoveryDaysBetweenIntenseSessions)
    || reference.minimumRecoveryDaysBetweenIntenseSessions < 0
  ) {
    throw new Error('Minimum recovery days must be a non-negative integer.')
  }

  if (
    reference.pamPercentageTarget !== null
    && (!Number.isFinite(reference.pamPercentageTarget) || reference.pamPercentageTarget <= 0)
  ) {
    throw new Error('PAM percentage target must be finite and positive when provided.')
  }
}

/**
 * Preserves the magnitude/semantics of existing intensity targets during taper
 * while limiting the number of quality exposures.
 *
 * H10 intentionally does not multiply HR zones or PAM percentages by volume or
 * D+ reduction factors. The later session-reconciliation layer is responsible
 * for shortening repetitions, duration, or total quality work. This function
 * only decides whether a brief quality stimulus remains available and reuses
 * the established intensity model unchanged.
 */
export function decideTaperIntensityPreservation(
  decision: TaperDurationDecision,
  reference: TaperIntensityReference,
): TaperIntensityPreservationDecision {
  validateReference(reference)

  const policy = getCompetitionAdjustmentPolicy(decision.priority)

  if (decision.durationDays === 0) {
    return {
      priority: decision.priority,
      durationDays: 0,
      preserveBriefIntensityStimuli: false,
      reference,
      proposed: reference,
      requiresCoachReview: decision.requiresCoachReview,
      reasonCodes: ['no_formal_taper'],
    }
  }

  const proposedIntenseSessionsTarget = policy.preserveBriefIntensityStimuli
    ? Math.min(reference.intenseSessionsTarget, 1)
    : 0

  const reasonCodes: TaperIntensityPreservationDecision['reasonCodes'][number][] = []

  if (policy.preserveBriefIntensityStimuli && proposedIntenseSessionsTarget > 0) {
    reasonCodes.push('brief_intensity_preserved')
  }

  if (proposedIntenseSessionsTarget < reference.intenseSessionsTarget) {
    reasonCodes.push('intense_session_count_reduced')
  }

  reasonCodes.push('existing_hr_zone_preserved')

  if (reference.pamPercentageTarget !== null) {
    reasonCodes.push('existing_pam_percentage_preserved')
  }

  return {
    priority: decision.priority,
    durationDays: decision.durationDays,
    preserveBriefIntensityStimuli:
      policy.preserveBriefIntensityStimuli && proposedIntenseSessionsTarget > 0,
    reference,
    proposed: {
      ...reference,
      intenseSessionsTarget: proposedIntenseSessionsTarget,
    },
    requiresCoachReview: decision.requiresCoachReview,
    reasonCodes,
  }
}
