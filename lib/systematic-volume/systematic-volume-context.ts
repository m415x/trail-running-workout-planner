import type {
  CompetitionImpactWindow,
  CompetitionImpactWindowResolution,
  Microcycle,
  SystematicVolumeCompetitionPhase,
  SystematicVolumePlanningContext,
} from '@/types'

function overlaps(
  startDate: string,
  endDate: string,
  range: { readonly startDate: string; readonly endDate: string } | null,
) {
  return range !== null && startDate <= range.endDate && endDate >= range.startDate
}

function phasesForWindow(
  microcycle: Microcycle,
  window: CompetitionImpactWindow,
): readonly SystematicVolumeCompetitionPhase[] {
  const phases: SystematicVolumeCompetitionPhase[] = []
  if (overlaps(microcycle.startDate, microcycle.endDate, window.pre)) phases.push('pre')
  if (overlaps(microcycle.startDate, microcycle.endDate, window.race)) phases.push('race')
  if (overlaps(microcycle.startDate, microcycle.endDate, window.post)) phases.push('post')
  return phases
}

export function buildSystematicVolumePlanningContext(
  microcycle: Microcycle,
  competitionResolution?: CompetitionImpactWindowResolution | null,
): SystematicVolumePlanningContext {
  const windows = competitionResolution?.windows ?? []
  const overlapping = windows
    .map(window => ({ window, phases: phasesForWindow(microcycle, window) }))
    .filter(item => item.phases.length > 0)

  const competitionPhases = [...new Set(overlapping.flatMap(item => item.phases))]
  const competitionIds = [...new Set(overlapping.map(item => item.window.competitionId))]
  const requiresCoachReview = competitionResolution?.overlaps.some(overlap => (
    overlap.requiresCoachReview
    && overlap.overlapStartDate <= microcycle.endDate
    && overlap.overlapEndDate >= microcycle.startDate
  )) ?? false

  return {
    microcycleType: microcycle.type,
    loadFocus: microcycle.loadFocus ?? null,
    competitionPhases,
    competitionIds,
    requiresCoachReview,
  }
}
