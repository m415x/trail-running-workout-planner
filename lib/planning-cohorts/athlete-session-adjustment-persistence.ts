import type {
  AthleteAssignmentOverride,
  AthleteDoseOverrides,
} from './athlete-session-adjustment'

export type PersistedAthleteSessionAdjustment = {
  id: string
  teamId: string
  athleteId: string
  sourcePrescriptionId: string
}

export type PersistedAthleteSessionAdjustmentRevision = {
  id: string
  adjustmentId: string
  state: 'active' | 'withdrawn'
  payload: {
    dose: AthleteDoseOverrides | null
    assignment: AthleteAssignmentOverride
  }
  reason: string
  changedByUserId: string | null
  isCurrent: boolean
}

export type AthleteSessionAdjustmentPersistencePort = {
  athleteBelongsToTeam: (teamId: string, athleteId: string) => Promise<boolean>
  prescriptionBelongsToTeam: (teamId: string, prescriptionId: string) => Promise<boolean>
  getAdjustmentByIdentity: (
    athleteId: string,
    sourcePrescriptionId: string,
  ) => Promise<PersistedAthleteSessionAdjustment | null>
  listAdjustmentRevisions: (
    adjustmentId: string,
  ) => Promise<PersistedAthleteSessionAdjustmentRevision[]>
  insertAdjustmentWithRevision: (
    adjustment: PersistedAthleteSessionAdjustment,
    revision: PersistedAthleteSessionAdjustmentRevision,
  ) => Promise<void>
  replaceCurrentRevisionAtomically: (
    previous: PersistedAthleteSessionAdjustmentRevision,
    replacement: PersistedAthleteSessionAdjustmentRevision,
  ) => Promise<void>
}

export function createAthleteSessionAdjustmentPersistenceAdapter(
  port: AthleteSessionAdjustmentPersistencePort,
) {
  return {
    async getCurrentRevision(adjustmentId: string) {
      const revisions = await port.listAdjustmentRevisions(adjustmentId)
      const current = revisions.filter(candidate => candidate.isCurrent)

      if (current.length === 0) return null
      if (current.length > 1) {
        throw new Error('Adjustment must have exactly one current revision')
      }

      return current[0]!
    },

    async applyRevision(input: {
      adjustment: PersistedAthleteSessionAdjustment
      revision: PersistedAthleteSessionAdjustmentRevision
    }) {
      const { adjustment, revision } = input

      if (!(await port.athleteBelongsToTeam(adjustment.teamId, adjustment.athleteId))) {
        throw new Error('Athlete does not belong to requested team scope')
      }

      if (!(await port.prescriptionBelongsToTeam(
        adjustment.teamId,
        adjustment.sourcePrescriptionId,
      ))) {
        throw new Error('Source prescription does not belong to requested team scope')
      }

      if (revision.adjustmentId !== adjustment.id) {
        throw new Error('Revision must preserve logical adjustment identity')
      }

      if (!revision.isCurrent) {
        throw new Error('Replacement revision must be current')
      }

      const existing = await port.getAdjustmentByIdentity(
        adjustment.athleteId,
        adjustment.sourcePrescriptionId,
      )

      if (!existing) {
        await port.insertAdjustmentWithRevision(adjustment, revision)

        return {
          adjustment,
          currentRevision: revision,
        }
      }

      if (
        existing.id !== adjustment.id
        || existing.teamId !== adjustment.teamId
        || existing.athleteId !== adjustment.athleteId
        || existing.sourcePrescriptionId !== adjustment.sourcePrescriptionId
      ) {
        throw new Error('Adjustment identity mismatch')
      }

      const revisions = await port.listAdjustmentRevisions(existing.id)
      const current = revisions.filter(candidate => candidate.isCurrent)

      if (current.length !== 1) {
        throw new Error('Adjustment must have exactly one current revision')
      }

      const previous = current[0]!

      if (previous.adjustmentId !== adjustment.id) {
        throw new Error('Current revision belongs to another adjustment identity')
      }

      await port.replaceCurrentRevisionAtomically(previous, revision)

      return {
        adjustment: existing,
        currentRevision: revision,
      }
    },
  }
}
