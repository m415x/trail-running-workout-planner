import type {
  AthleteAssignmentOverride,
  EffectiveAudiencePrescription,
} from './athlete-session-adjustment'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from './athlete-session-adjustment-persistence'

type AssignmentPersistence = {
  getCurrentRevision?: (
    adjustmentId: string,
  ) => Promise<PersistedAthleteSessionAdjustmentRevision | null>
  applyRevision(input: {
    adjustment: PersistedAthleteSessionAdjustment
    revision: PersistedAthleteSessionAdjustmentRevision
  }): Promise<{
    adjustment: PersistedAthleteSessionAdjustment
    currentRevision: PersistedAthleteSessionAdjustmentRevision
  }>
}

type AssignmentInput = Exclude<
  AthleteAssignmentOverride,
  { kind: 'inherit' }
>

export async function applyAthleteAssignmentAdjustment(input: {
  teamId: string
  athleteId: string
  sourcePrescription: EffectiveAudiencePrescription
  adjustmentId: string
  revisionId: string
  reason: string
  changedByUserId: string | null
  assignment: AssignmentInput
  persistence: AssignmentPersistence
}) {
  validateAssignment(input.assignment)

  const adjustment: PersistedAthleteSessionAdjustment = {
    id: input.adjustmentId,
    teamId: input.teamId,
    athleteId: input.athleteId,
    sourcePrescriptionId: input.sourcePrescription.id,
  }

  const currentRevision = input.persistence.getCurrentRevision
    ? await input.persistence.getCurrentRevision(input.adjustmentId)
    : null

  const revision: PersistedAthleteSessionAdjustmentRevision = {
    id: input.revisionId,
    adjustmentId: input.adjustmentId,
    state: 'active',
    payload: {
      dose: currentRevision?.payload.dose ?? null,
      assignment: input.assignment,
    },
    reason: input.reason,
    changedByUserId: input.changedByUserId,
    isCurrent: true,
  }

  return input.persistence.applyRevision({
    adjustment,
    revision,
  })
}

function validateAssignment(assignment: AssignmentInput) {
  if (assignment.kind === 'rescheduled' && assignment.date.trim().length === 0) {
    throw new Error('Rescheduled date is required')
  }

  if (assignment.kind === 'stimulus_override' && assignment.type.trim().length === 0) {
    throw new Error('Stimulus type is required')
  }
}
