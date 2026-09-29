import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from './athlete-session-adjustment-persistence'

export type EffectiveAthleteAdjustmentResolution =
  | {
      status: 'resolved'
      adjustment: PersistedAthleteSessionAdjustment
      revision: PersistedAthleteSessionAdjustmentRevision
    }
  | {
      status: 'none'
      reason: 'withdrawn' | 'no-current-revision'
    }
  | {
      status: 'outside_authority'
      reason: 'athlete-mismatch' | 'source-prescription-mismatch'
      adjustmentId: string
    }
  | {
      status: 'conflict'
      reason: 'multiple-current-revisions'
      adjustmentId: string
      revisionIds: string[]
    }

export function resolveEffectiveAthleteAdjustment(input: {
  athleteId: string
  effectivePrescriptionId: string
  adjustment: PersistedAthleteSessionAdjustment | null
  revisions: PersistedAthleteSessionAdjustmentRevision[]
}): EffectiveAthleteAdjustmentResolution {
  const { athleteId, effectivePrescriptionId, adjustment, revisions } = input

  if (!adjustment) {
    return {
      status: 'none',
      reason: 'no-current-revision',
    }
  }

  if (adjustment.athleteId !== athleteId) {
    return {
      status: 'outside_authority',
      reason: 'athlete-mismatch',
      adjustmentId: adjustment.id,
    }
  }

  if (adjustment.sourcePrescriptionId !== effectivePrescriptionId) {
    return {
      status: 'outside_authority',
      reason: 'source-prescription-mismatch',
      adjustmentId: adjustment.id,
    }
  }

  const current = revisions.filter(revision => (
    revision.adjustmentId === adjustment.id
    && revision.isCurrent
  ))

  if (current.length === 0) {
    return {
      status: 'none',
      reason: 'no-current-revision',
    }
  }

  if (current.length > 1) {
    return {
      status: 'conflict',
      reason: 'multiple-current-revisions',
      adjustmentId: adjustment.id,
      revisionIds: current.map(revision => revision.id),
    }
  }

  const revision = current[0]!

  if (revision.state === 'withdrawn') {
    return {
      status: 'none',
      reason: 'withdrawn',
    }
  }

  return {
    status: 'resolved',
    adjustment,
    revision,
  }
}
