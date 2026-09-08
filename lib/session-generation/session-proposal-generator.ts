import { assignSlotsToMicrocycle } from '@/lib/session-generation/microcycle-slot-assignment'
import { distributeWeeklyElevation } from '@/lib/session-generation/weekly-elevation-distribution'
import { distributeWeeklyIntensity } from '@/lib/session-generation/weekly-intensity-distribution'
import {
  resolveWeeklySessionCount,
  selectWeeklySlots,
} from '@/lib/session-generation/weekly-generation-rules'
import { distributeWeeklyVolume } from '@/lib/session-generation/weekly-volume-distribution'
import { selectWorkoutTemplate } from '@/lib/session-generation/workout-template-selection'
import { createWorkoutTemplateSnapshot } from '@/lib/workout-templates/workout-template-snapshot'
import type {
  AssignedMicrocycleSlot,
  SessionGenerationInput,
  SessionGenerationProposal,
  SessionGenerationResult,
  TrainingWeekday,
  WeeklyElevationAllocation,
  WeeklyVolumeAllocation,
} from '@/types/training/session-generation.types'
import type { WorkoutTemplate } from '@/types/training/workout-template.types'

const ROLE_TITLE = {
  base: 'Rodaje base',
  mountain: 'Entrenamiento de montaña',
  long: 'Fondo',
  quality: 'Sesión de calidad',
  recovery: 'Recuperación',
  competition: 'Competencia',
} as const

/**
 * Builds a detached weekly proposal from already-resolved planning inputs.
 * No database operation is performed and template load/intensity never takes
 * precedence over the group microcycle targets.
 */
export function generateWeeklySessionProposals(
  input: SessionGenerationInput,
): SessionGenerationResult {
  const { context } = input
  const includesRace = context.competition !== null
  if (context.microcycleType === 'race' && !includesRace) {
    throw new RangeError('Race microcycle requires a separate competition target')
  }
  if (context.competition && (
    context.competition.date < context.startDate || context.competition.date > context.endDate
  )) {
    throw new RangeError('Competition date must belong to the race microcycle')
  }
  const sessionCount = resolveWeeklySessionCount({
    frequency: context.frequency,
    microcycleType: context.microcycleType,
    targetVolumeKm: context.load.targetVolumeKm,
    maximumWeeklyVolumeKm: context.load.maximumWeeklyVolumeKm,
    includesRace,
  })
  const selectedSlots = selectWeeklySlots(context.pattern.slots, sessionCount, {
    microcycleType: context.microcycleType,
    includesRace,
    raceWeekday: context.competition ? weekdayFromIsoDate(context.competition.date) : undefined,
    weekStartDate: context.startDate,
    intenseSessionsTarget: context.intensity.intenseSessionsTarget,
    minimumRecoveryDays: context.intensity.minimumRecoveryDaysBetweenIntenseSessions,
  })
  const assignment = assignSlotsToMicrocycle(context, selectedSlots)
  const selectedTemplates = new Map<string, WorkoutTemplate | null>()
  const templateWarnings = new Map<string, string[]>()

  for (const { slot } of assignment.assignments) {
    const selection = selectWorkoutTemplate({
      templates: input.templates,
      teamId: context.teamId,
      period: context.period,
      microcycleType: context.microcycleType,
      slot,
    })
    selectedTemplates.set(slot.key, selection.selected)
    templateWarnings.set(slot.key, selection.warnings)
  }

  const trainingAssignments = assignment.assignments.filter(({ slot }) => slot.role !== 'competition')
  const fixedVolume = resolveFixedVolume(trainingAssignments, selectedTemplates)
  const fixedElevation = resolveFixedElevation(trainingAssignments, selectedTemplates)
  const volume = distributeWeeklyVolume(
    trainingAssignments.map(({ slot }) => slot),
    context.load.targetVolumeKm,
    fixedVolume,
  )
  const elevation = distributeWeeklyElevation(
    trainingAssignments.map(({ slot }) => slot),
    context.load.targetElevationGain,
    fixedElevation,
  )
  const intensity = distributeWeeklyIntensity(trainingAssignments, context.intensity)
  const volumeBySlot = new Map(volume.allocations.map((value) => [value.slotKey, value]))
  const elevationBySlot = new Map(elevation.allocations.map((value) => [value.slotKey, value]))
  const intensityBySlot = new Map(intensity.allocations.map((value) => [value.slotKey, value]))
  const proposals = assignment.assignments.map((assigned): SessionGenerationProposal => {
    const template = selectedTemplates.get(assigned.slot.key) ?? null
    const snapshot = template ? createWorkoutTemplateSnapshot(template) : null
    const allocatedVolume = volumeBySlot.get(assigned.slot.key)
    const allocatedElevation = elevationBySlot.get(assigned.slot.key)
    const allocatedIntensity = intensityBySlot.get(assigned.slot.key)
    const isCompetition = assigned.slot.role === 'competition'

    if (!isCompetition && (!allocatedVolume || !allocatedElevation || !allocatedIntensity)) {
      throw new Error(`Incomplete generated allocation for slot ${assigned.slot.key}`)
    }
    if (isCompetition && !context.competition) {
      throw new Error(`Competition slot ${assigned.slot.key} has no race target`)
    }

    return {
      generationKey: [
        context.groupTrainingPlanId,
        context.microcycleId,
        context.groupId,
        assigned.slot.key,
      ].join('::'),
      sharedEventKey: [
        context.teamId,
        assigned.date,
        assigned.slot.role,
        snapshot?.sourceTemplateId ?? snapshot?.session.type ?? assigned.slot.preferredWorkoutTypes[0],
      ].join('::'),
      slotKey: assigned.slot.key,
      role: assigned.slot.role,
      session: {
        date: assigned.date,
        title: snapshot?.session.title ?? ROLE_TITLE[assigned.slot.role],
        type: snapshot?.session.type ?? assigned.slot.preferredWorkoutTypes[0] ?? 'Base',
        sourceTemplateId: snapshot?.sourceTemplateId ?? null,
        locationKey: snapshot?.session.locationKey ?? null,
        trackPath: snapshot?.session.trackPath ?? null,
        structure: snapshot?.session.structure ? { ...snapshot.session.structure } : null,
        notes: snapshot?.session.notes ?? null,
      },
      prescription: {
        groupId: context.groupId,
        microcycleId: assigned.microcycleId,
        distanceKm: isCompetition
          ? context.competition?.distanceKm ?? null
          : allocatedVolume?.distanceKm ?? null,
        // Weekly duration still has no independent distribution rule. Copying
        // the weekly target into every session would multiply the planned load.
        durationMin: null,
        elevationGain: isCompetition
          ? context.competition?.elevationGain ?? null
          : allocatedElevation?.elevationGain ?? null,
        intensityMethod: isCompetition ? 'hr_zone' : allocatedIntensity?.intensityMethod ?? 'hr_zone',
        zone: isCompetition ? null : allocatedIntensity?.zone ?? null,
        pamPercentage: isCompetition ? null : allocatedIntensity?.pamPercentage ?? null,
        notes: snapshot?.prescription.notes ?? null,
      },
      warnings: templateWarnings.get(assigned.slot.key) ?? [],
    }
  })
  const warnings = uniqueWarnings([
    ...assignment.warnings,
    ...volume.warnings,
    ...elevation.warnings,
    ...intensity.warnings,
    ...proposals.flatMap((proposal) => proposal.warnings),
  ])

  return { proposals, warnings }
}

function resolveFixedVolume(
  assignments: AssignedMicrocycleSlot[],
  templates: Map<string, WorkoutTemplate | null>,
) {
  return assignments.flatMap(({ slot }): WeeklyVolumeAllocation[] => {
    const template = templates.get(slot.key)
    const distanceKm = template?.prescriptionDefaults.distanceKm
    return isFixedGeographicalTemplate(template) && distanceKm !== null && distanceKm !== undefined
      ? [{ slotKey: slot.key, flexibility: 'fixed', distanceKm }]
      : []
  })
}

function resolveFixedElevation(
  assignments: AssignedMicrocycleSlot[],
  templates: Map<string, WorkoutTemplate | null>,
) {
  return assignments.flatMap(({ slot }): WeeklyElevationAllocation[] => {
    const template = templates.get(slot.key)
    const elevationGain = template?.prescriptionDefaults.elevationGain
    return isFixedGeographicalTemplate(template) && elevationGain !== null && elevationGain !== undefined
      ? [{ slotKey: slot.key, flexibility: 'fixed', elevationGain }]
      : []
  })
}

function isFixedGeographicalTemplate(template: WorkoutTemplate | null | undefined) {
  return Boolean(
    template?.sessionDefaults.trackPath &&
    template.prescriptionDefaults.distanceKm !== null &&
    template.prescriptionDefaults.distanceKm !== undefined &&
    template.prescriptionDefaults.elevationGain !== null &&
    template.prescriptionDefaults.elevationGain !== undefined,
  )
}

function weekdayFromIsoDate(value: string): TrainingWeekday {
  const date = new Date(`${value}T00:00:00.000Z`)
  const weekdays: TrainingWeekday[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
  ]
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Invalid race microcycle end date: ${value}`)
  }
  return weekdays[date.getUTCDay()]
}

function uniqueWarnings(warnings: string[]) {
  return [...new Set(warnings)]
}
