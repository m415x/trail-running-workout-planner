import {
  resolveEffectiveAthleteAdjustment,
} from './athlete-adjustment-resolution'
import {
  resolveAthletePlannedSession,
  type EffectiveAudiencePrescription,
  type SharedSessionEvent,
} from './athlete-session-adjustment'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from './athlete-session-adjustment-persistence'

export function resolveAthletePlanningSession(input: {
  athleteId: string
  session: SharedSessionEvent
  prescription: EffectiveAudiencePrescription
  adjustment: PersistedAthleteSessionAdjustment | null
  revisions: PersistedAthleteSessionAdjustmentRevision[]
}) {
  const adjustmentResolution = resolveEffectiveAthleteAdjustment({
    athleteId: input.athleteId,
    effectivePrescriptionId: input.prescription.id,
    adjustment: input.adjustment,
    revisions: input.revisions,
  })

  if (adjustmentResolution.status === 'outside_authority') {
    return adjustmentResolution
  }

  if (adjustmentResolution.status === 'conflict') {
    return adjustmentResolution
  }

  const effectiveAdjustment = adjustmentResolution.status === 'resolved'
    ? {
        id: adjustmentResolution.adjustment.id,
        athleteId: adjustmentResolution.adjustment.athleteId,
        sourcePrescriptionId: adjustmentResolution.adjustment.sourcePrescriptionId,
        dose: adjustmentResolution.revision.payload.dose,
        assignment: adjustmentResolution.revision.payload.assignment,
      }
    : null

  return resolveAthletePlannedSession({
    athleteId: input.athleteId,
    session: input.session,
    prescription: input.prescription,
    adjustment: effectiveAdjustment,
  })
}
