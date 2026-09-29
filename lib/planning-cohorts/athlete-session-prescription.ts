import type { AthletePlanningResolution } from '@/lib/planning-cohorts/planning-resolution'

export interface AthleteSessionPrescriptionCandidate {
  id: string
  groupId: string
  microcycleId: string
  groupTrainingPlanId: string
}

export type AthleteSessionPrescriptionResolution =
  | {
      status: 'resolved'
      prescriptionId: string
      planId: string
      microcycleId: string
    }
  | {
      status: 'none'
      reason: 'planning-unresolved' | 'no-prescription-for-applicable-plan'
      planId: string | null
    }
  | {
      status: 'conflict'
      reason: 'multiple-prescriptions-for-applicable-plan'
      planId: string
      conflictingIds: string[]
    }

/**
 * Resolves the effective prescription for one Session after dated athlete
 * planning authority has already been selected.
 *
 * The selected plan is authoritative for the date. A cohort Variant therefore
 * never falls back to a Base prescription for an individual Session.
 */
export function resolveAthleteSessionPrescription(input: {
  planning: AthletePlanningResolution
  prescriptions: AthleteSessionPrescriptionCandidate[]
}): AthleteSessionPrescriptionResolution {
  if (input.planning.status !== 'resolved') {
    return {
      status: 'none',
      reason: 'planning-unresolved',
      planId: null,
    }
  }

  const matching = input.prescriptions.filter((prescription) => (
    prescription.groupId === input.planning.groupId
    && prescription.groupTrainingPlanId === input.planning.planId
  ))

  if (matching.length === 0) {
    return {
      status: 'none',
      reason: 'no-prescription-for-applicable-plan',
      planId: input.planning.planId,
    }
  }

  if (matching.length > 1) {
    return {
      status: 'conflict',
      reason: 'multiple-prescriptions-for-applicable-plan',
      planId: input.planning.planId,
      conflictingIds: matching.map(({ id }) => id),
    }
  }

  return {
    status: 'resolved',
    prescriptionId: matching[0].id,
    planId: input.planning.planId,
    microcycleId: matching[0].microcycleId,
  }
}
