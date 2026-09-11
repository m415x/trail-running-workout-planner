import { buildCompetitionImpactWindow } from '@/lib/periodization/competition-impact-window'

import type {
  CompetitionAdjustmentConflict,
  CompetitionAdjustmentProposal,
  CompetitionAdjustmentProposalInput,
  CompetitionMicrocycleAdjustmentPreview,
  CompetitionMicrocycleAdjustmentReasonCode,
  CompetitionMicrocycleImpactPhase,
  Microcycle,
  RecoveryPhaseDecision,
} from '@/types'

const DAY_MS = 86_400_000

function parseDate(value: string) {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid date: ${value}`)
  return timestamp
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function addDays(date: string, days: number) {
  return formatDate(parseDate(date) + (days * DAY_MS))
}

function rangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  return startA <= endB && startB <= endA
}

function minKnown(left: number | null, right: number | null) {
  if (left === null) return right
  if (right === null) return left
  return Math.min(left, right)
}

function taperTargetForMicrocycle(
  input: CompetitionAdjustmentProposalInput,
  microcycle: Microcycle,
) {
  const { source } = input
  const volumePoints = source.volumeCurve.points.filter((point) => {
    const date = addDays(source.competitionDate, -point.daysBeforeCompetition)
    return microcycle.startDate <= date && date <= microcycle.endDate
  })
  const elevationPoints = source.elevationCurve.points.filter((point) => {
    const date = addDays(source.competitionDate, -point.daysBeforeCompetition)
    return microcycle.startDate <= date && date <= microcycle.endDate
  })

  return {
    volumeKm: volumePoints.length > 0
      ? Math.min(...volumePoints.map((point) => point.targetWeeklyEquivalentVolumeKm))
      : null,
    elevationGainM: elevationPoints.length > 0
      ? Math.min(...elevationPoints.map((point) => point.targetWeeklyEquivalentElevationGainM))
      : null,
  }
}

function recoverySegments(input: CompetitionAdjustmentProposalInput) {
  let cursor = addDays(input.source.competitionDate, 1)

  return input.recovery.phases.map((phase) => {
    const startDate = cursor
    const endDate = addDays(startDate, phase.durationDays - 1)
    cursor = addDays(endDate, 1)
    return { phase, startDate, endDate }
  })
}

function recoveryTargetForMicrocycle(
  input: CompetitionAdjustmentProposalInput,
  microcycle: Microcycle,
): RecoveryPhaseDecision | null {
  const overlapping = recoverySegments(input).filter((segment) => rangesOverlap(
    microcycle.startDate,
    microcycle.endDate,
    segment.startDate,
    segment.endDate,
  ))

  if (overlapping.length === 0) return null

  return overlapping.reduce((strictest, segment) => (
    segment.phase.trainingLoadCeilingPercentage < strictest.trainingLoadCeilingPercentage
      ? segment.phase
      : strictest
  ), overlapping[0].phase)
}

function previewMicrocycle(
  input: CompetitionAdjustmentProposalInput,
  microcycle: Microcycle,
  window: CompetitionAdjustmentProposal['window'],
): CompetitionMicrocycleAdjustmentPreview | null {
  if (!rangesOverlap(microcycle.startDate, microcycle.endDate, window.startDate, window.endDate)) {
    return null
  }

  const phases: CompetitionMicrocycleImpactPhase[] = []
  const reasons: CompetitionMicrocycleAdjustmentReasonCode[] = []
  const currentVolumeKm = microcycle.targetVolumeKm ?? null
  const currentElevationGainM = microcycle.targetElevationGain ?? null
  let targetVolumeKm = currentVolumeKm
  let targetElevationGainM = currentElevationGainM
  let type = microcycle.type
  let allowIntenseSessions: boolean | null = null

  if (window.pre && rangesOverlap(
    microcycle.startDate,
    microcycle.endDate,
    window.pre.startDate,
    window.pre.endDate,
  )) {
    phases.push('pre')
    const taperTarget = taperTargetForMicrocycle(input, microcycle)
    if (taperTarget.volumeKm !== null) {
      targetVolumeKm = minKnown(targetVolumeKm, taperTarget.volumeKm)
      reasons.push('taper_volume_ceiling')
    }
    if (taperTarget.elevationGainM !== null) {
      targetElevationGainM = minKnown(targetElevationGainM, taperTarget.elevationGainM)
      reasons.push('taper_elevation_ceiling')
    }
    type = 'tapering'
  }

  if (rangesOverlap(
    microcycle.startDate,
    microcycle.endDate,
    window.race.startDate,
    window.race.endDate,
  )) {
    phases.push('race')
    targetVolumeKm = input.source.competitionWeek.training.volumeKm
    targetElevationGainM = input.source.competitionWeek.training.elevationGainM
    type = 'race'
    reasons.push('race_week_training_separated')
  }

  const recoveryTarget = recoveryTargetForMicrocycle(input, microcycle)
  if (recoveryTarget) {
    phases.push('post')
    const volumeReferenceKm = input.source.volumeCurve.referenceVolumeKm
    const elevationReferenceM = input.source.elevationCurve.referenceElevationGainM
    targetVolumeKm = minKnown(
      targetVolumeKm,
      volumeReferenceKm * (recoveryTarget.trainingLoadCeilingPercentage / 100),
    )
    if (elevationReferenceM !== null) {
      targetElevationGainM = minKnown(
        targetElevationGainM,
        elevationReferenceM * (recoveryTarget.trainingLoadCeilingPercentage / 100),
      )
    }
    allowIntenseSessions = recoveryTarget.allowIntenseSessions
    reasons.push('post_race_recovery_ceiling')
    if (!recoveryTarget.allowIntenseSessions) reasons.push('post_race_intensity_restricted')
  }

  return {
    microcycleId: microcycle.id,
    weekNumber: microcycle.weekNumber,
    current: {
      type: microcycle.type,
      targetVolumeKm: currentVolumeKm,
      targetElevationGainM: currentElevationGainM,
    },
    phases: [...new Set(phases)],
    proposed: {
      type,
      targetVolumeKm,
      targetElevationGainM,
      allowIntenseSessions,
    },
    reasonCodes: [...new Set(reasons)],
  }
}

function buildOverlapConflicts(input: CompetitionAdjustmentProposalInput): CompetitionAdjustmentConflict[] {
  return (input.overlaps ?? [])
    .filter((overlap) => (
      overlap.requiresCoachReview
      && (
        overlap.firstCompetitionId === input.source.competitionId
        || overlap.secondCompetitionId === input.source.competitionId
      )
    ))
    .map((overlap) => ({
      code: 'competition_window_overlap_requires_review' as const,
      relatedCompetitionIds: [overlap.firstCompetitionId, overlap.secondCompetitionId],
      messageKey: 'competitionAdjustment.conflicts.overlapRequiresReview' as const,
    }))
}

/**
 * Builds the inspectable H10 proposal before persistence or provenance checks.
 * KAN-220 adds manual/protected-state conflicts on top of this preview.
 */
export function buildCompetitionAdjustmentProposal(
  input: CompetitionAdjustmentProposalInput,
): CompetitionAdjustmentProposal {
  if (input.recovery.priority !== input.source.priority) {
    throw new Error('Recovery priority must match the source adjustment priority.')
  }

  const window = buildCompetitionImpactWindow({
    competitionId: input.source.competitionId,
    priority: input.source.priority,
    competitionDate: input.source.competitionDate,
    taperDurationDays: input.source.duration.durationDays,
    recovery: input.recovery,
  })
  const affectedMicrocycles = input.existingMicrocycles
    .map((microcycle) => previewMicrocycle(input, microcycle, window))
    .filter((preview): preview is CompetitionMicrocycleAdjustmentPreview => preview !== null)
  const conflicts = buildOverlapConflicts(input)

  return {
    competitionId: input.source.competitionId,
    competitionDate: input.source.competitionDate,
    priority: input.source.priority,
    window,
    source: input.source,
    recovery: input.recovery,
    affectedMicrocycles,
    conflicts,
    requiresCoachReview:
      input.source.requiresCoachReview
      || input.recovery.requiresCoachReview
      || conflicts.length > 0,
    rationale: {
      taperDurationDays: input.source.duration.durationDays,
      recoveryDurationDays: input.recovery.totalRecoveryDays,
      demandBand: input.source.demand.band,
      competitionWeekTraining: input.source.competitionWeek.training,
    },
  }
}
