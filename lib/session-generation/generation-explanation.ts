import {
  resolveWeeklySessionCount,
  selectWeeklySlots,
} from '@/lib/session-generation/weekly-generation-rules'
import { distributeWeeklyElevation } from '@/lib/session-generation/weekly-elevation-distribution'
import { distributeWeeklyVolume } from '@/lib/session-generation/weekly-volume-distribution'
import { selectWorkoutTemplate } from '@/lib/session-generation/workout-template-selection'
import type { MicrocycleType, PeriodType } from '@/types/training/periodization.types'
import type {
  TrainingWeekday,
  WeeklyElevationAllocation,
  WeeklySessionFrequency,
  WeeklyTrainingPattern,
  WeeklyTrainingSlot,
  WeeklyVolumeAllocation,
} from '@/types/training/session-generation.types'
import type { WorkoutTemplate } from '@/types/training/workout-template.types'

export const GENERATION_EXPLANATION_STAGE_ORDER = [
  'weekly_budget',
  'frequency',
  'slots',
  'stimulus_template',
  'fixed_load',
  'remaining_budget',
  'flexible_allocation',
  'intensity',
  'coordination_reconciliation',
] as const

export type GenerationExplanationStage =
  typeof GENERATION_EXPLANATION_STAGE_ORDER[number]

export type GenerationExplanationFactValue =
  | string
  | number
  | boolean
  | null

export interface GenerationExplanationFact {
  code: string
  value: GenerationExplanationFactValue
}

export interface GenerationExplanationWarning {
  code: string
  facts: GenerationExplanationFact[]
}

export type GenerationExplanationPlanningScope =
  | {
      kind: 'base'
      groupTrainingPlanId: string
      groupId: string
      planningCohortId: null
      microcycleId: string
    }
  | {
      kind: 'variant'
      groupTrainingPlanId: string
      groupId: string
      planningCohortId: string
      microcycleId: string
    }

export interface GenerationExplanationStageEvidence {
  stage: GenerationExplanationStage
  inputs: GenerationExplanationFact[]
  constraints: GenerationExplanationFact[]
  decision: GenerationExplanationFact[]
  consequence: GenerationExplanationFact[]
  warnings: GenerationExplanationWarning[]
}

export interface GenerationExplanation {
  planningScope: GenerationExplanationPlanningScope
  stages: GenerationExplanationStageEvidence[]
}


export function assertValidGenerationExplanation(
  explanation: GenerationExplanation,
): void {
  const actualStages = explanation.stages.map(({ stage }) => stage)

  if (
    actualStages.length !== GENERATION_EXPLANATION_STAGE_ORDER.length ||
    actualStages.some((stage, index) => (
      stage !== GENERATION_EXPLANATION_STAGE_ORDER[index]
    ))
  ) {
    throw new RangeError('Generation explanation must preserve the approved causal stage order')
  }

  const scope = explanation.planningScope
  if (
    !scope.groupTrainingPlanId.trim() ||
    !scope.groupId.trim() ||
    !scope.microcycleId.trim()
  ) {
    throw new RangeError('Generation explanation planning scope identifiers cannot be empty')
  }

  if (scope.kind === 'base' && scope.planningCohortId !== null) {
    throw new RangeError('Base planning scope cannot reference a planning subgroup')
  }

  if (scope.kind === 'variant' && !scope.planningCohortId.trim()) {
    throw new RangeError('Variant planning scope requires a planning subgroup')
  }
}


export interface ExplainFrequencyAndSlotsInput {
  frequency: WeeklySessionFrequency
  microcycleType: MicrocycleType
  targetVolumeKm: number
  maximumWeeklyVolumeKm: number
  includesRace: boolean
  raceWeekday?: TrainingWeekday
  pattern: WeeklyTrainingPattern
  startDate: string
  intenseSessionsTarget: number
  minimumRecoveryDays: number
}

export interface FrequencyAndSlotsExplanation {
  frequency: GenerationExplanationStageEvidence
  slots: GenerationExplanationStageEvidence
}

export function explainFrequencyAndSlots(
  input: ExplainFrequencyAndSlotsInput,
): FrequencyAndSlotsExplanation {
  const sessionCount = resolveWeeklySessionCount({
    frequency: input.frequency,
    microcycleType: input.microcycleType,
    targetVolumeKm: input.targetVolumeKm,
    maximumWeeklyVolumeKm: input.maximumWeeklyVolumeKm,
    includesRace: input.includesRace,
  })
  const slotSelectionContext = {
    microcycleType: input.microcycleType,
    includesRace: input.includesRace,
    raceWeekday: input.raceWeekday,
    weekStartDate: input.startDate,
    intenseSessionsTarget: input.intenseSessionsTarget,
    minimumRecoveryDays: input.minimumRecoveryDays,
  }
  const selectedSlots = selectWeeklySlots(
    input.pattern.slots,
    sessionCount,
    slotSelectionContext,
  )
  const unconstrainedSlots = selectWeeklySlots(
    input.pattern.slots,
    sessionCount,
    {
      microcycleType: input.microcycleType,
      includesRace: input.includesRace,
      raceWeekday: input.raceWeekday,
      weekStartDate: input.startDate,
      intenseSessionsTarget: 0,
      minimumRecoveryDays: 0,
    },
  )

  const habitualKeys = new Set(input.pattern.slots.map(({ key }) => key))
  const selectedKeys = new Set(selectedSlots.map(({ key }) => key))
  const selectedHabitualSlotKeys = selectedSlots
    .filter(({ key }) => habitualKeys.has(key))
    .map(({ key }) => key)
  const selectedFallbackSlotKeys = selectedSlots
    .filter((slot) => slot.role !== 'competition' && !habitualKeys.has(slot.key))
    .map(({ key }) => key)
  const omittedHabitualSlotKeys = input.pattern.slots
    .filter(({ key }) => !selectedKeys.has(key))
    .map(({ key }) => key)
  const usedFallbackWeekdays = selectedFallbackSlotKeys.length > 0
  const recoveryConstraintChangedSelection = (
    selectedSlots.map(({ key }) => key).join(',') !==
    unconstrainedSlots.map(({ key }) => key).join(',')
  )
  const raceReplacedHabitualSlot = Boolean(
    input.includesRace &&
    input.raceWeekday &&
    input.pattern.slots.some(({ weekday }) => weekday === input.raceWeekday) &&
    selectedSlots.some(({ weekday, role }) => (
      weekday === input.raceWeekday && role === 'competition'
    )),
  )

  const frequencyInputs: GenerationExplanationFact[] = input.frequency.mode === 'fixed'
    ? [
        { code: 'frequency_mode', value: 'fixed' },
        { code: 'fixed_sessions_per_week', value: input.frequency.sessionsPerWeek },
      ]
    : [
        { code: 'frequency_mode', value: 'auto' },
        { code: 'microcycle_type', value: input.microcycleType },
        { code: 'target_volume_km', value: input.targetVolumeKm },
        { code: 'maximum_weekly_volume_km', value: input.maximumWeeklyVolumeKm },
        {
          code: 'relative_load_ratio',
          value: roundExplanationNumber(
            input.maximumWeeklyVolumeKm > 0
              ? input.targetVolumeKm / input.maximumWeeklyVolumeKm
              : 0,
          ),
        },
        { code: 'includes_race', value: input.includesRace },
      ]

  const slotConstraints: GenerationExplanationFact[] = [
    { code: 'intense_sessions_target', value: input.intenseSessionsTarget },
    { code: 'minimum_recovery_days', value: input.minimumRecoveryDays },
  ]
  if (input.includesRace && input.raceWeekday) {
    slotConstraints.push({ code: 'race_weekday', value: input.raceWeekday })
  }

  return {
    frequency: {
      stage: 'frequency',
      inputs: frequencyInputs,
      constraints: [],
      decision: [{ code: 'selected_session_count', value: sessionCount }],
      consequence: [],
      warnings: [],
    },
    slots: {
      stage: 'slots',
      inputs: [{
        code: 'habitual_slot_keys',
        value: input.pattern.slots.map(({ key }) => key).join(','),
      }],
      constraints: slotConstraints,
      decision: [
        {
          code: 'selected_slot_keys',
          value: selectedSlots.map(({ key }) => key).join(','),
        },
        {
          code: 'selected_roles',
          value: selectedSlots.map(({ role }) => role).join(','),
        },
      ],
      consequence: [
        {
          code: 'used_fallback_weekdays',
          value: usedFallbackWeekdays,
        },
        {
          code: 'selected_habitual_slot_keys',
          value: selectedHabitualSlotKeys.join(','),
        },
        {
          code: 'selected_fallback_slot_keys',
          value: selectedFallbackSlotKeys.join(','),
        },
        {
          code: 'omitted_habitual_slot_keys',
          value: omittedHabitualSlotKeys.join(','),
        },
        {
          code: 'recovery_constraint_changed_selection',
          value: recoveryConstraintChangedSelection,
        },
        {
          code: 'unconstrained_slot_keys',
          value: unconstrainedSlots.map(({ key }) => key).join(','),
        },
        {
          code: 'race_replaced_habitual_slot',
          value: raceReplacedHabitualSlot,
        },
      ],
      warnings: [],
    },
  }
}

function roundExplanationNumber(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}


export interface ExplainTemplatesAndLoadInput {
  templates: WorkoutTemplate[]
  teamId: string
  period: PeriodType
  microcycleType: MicrocycleType
  slots: WeeklyTrainingSlot[]
  targetVolumeKm: number
  targetElevationGain: number | null
}

export interface TemplatesAndLoadExplanation {
  stimulusTemplate: GenerationExplanationStageEvidence
  fixedLoad: GenerationExplanationStageEvidence
  remainingBudget: GenerationExplanationStageEvidence
  flexibleAllocation: GenerationExplanationStageEvidence
}

export function explainTemplatesAndLoad(
  input: ExplainTemplatesAndLoadInput,
): TemplatesAndLoadExplanation {
  const selectedTemplates = new Map<string, WorkoutTemplate | null>()
  const templateFacts: GenerationExplanationFact[] = []
  const templateConsequences: GenerationExplanationFact[] = []
  const templateWarnings: GenerationExplanationWarning[] = []

  for (const slot of input.slots) {
    const selection = selectWorkoutTemplate({
      templates: input.templates,
      teamId: input.teamId,
      period: input.period,
      microcycleType: input.microcycleType,
      slot,
    })
    selectedTemplates.set(slot.key, selection.selected)

    if (selection.selected) {
      templateFacts.push({
        code: 'selected_template',
        value: `${slot.key}::${selection.selected.id}`,
      })
      templateConsequences.push({
        code: 'template_material_factors',
        value: `${slot.key}::role,period,microcycle`,
      })
    }

    for (const warning of selection.warnings) {
      templateWarnings.push({
        code: 'no_compatible_template',
        facts: [
          { code: 'slot_key', value: slot.key },
          { code: 'role', value: slot.role },
          { code: 'period', value: input.period },
          { code: 'microcycle_type', value: input.microcycleType },
          { code: 'source_warning', value: warning },
        ],
      })
    }
  }

  const fixedVolume = resolveExplanationFixedVolume(input.slots, selectedTemplates)
  const fixedElevation = resolveExplanationFixedElevation(input.slots, selectedTemplates)

  const volume = distributeWeeklyVolume(
    input.slots,
    input.targetVolumeKm,
    fixedVolume,
  )
  const elevation = distributeWeeklyElevation(
    input.slots,
    input.targetElevationGain,
    fixedElevation,
  )

  const fixedBySlot = new Map(
    input.slots.map((slot) => [
      slot.key,
      {
        volume: fixedVolume.find((allocation) => allocation.slotKey === slot.key),
        elevation: fixedElevation.find((allocation) => allocation.slotKey === slot.key),
      },
    ]),
  )

  const fixedLoadFacts: GenerationExplanationFact[] = []
  for (const slot of input.slots) {
    const fixed = fixedBySlot.get(slot.key)
    if (fixed?.volume && fixed.elevation) {
      fixedLoadFacts.push({
        code: 'fixed_slot_load',
        value: `${slot.key}::${fixed.volume.distanceKm}::${fixed.elevation.elevationGain}`,
      })
    }
  }

  const fixedVolumeKm = fixedVolume.reduce((sum, allocation) => sum + allocation.distanceKm, 0)
  const fixedElevationGain = fixedElevation.reduce((sum, allocation) => (
    sum + allocation.elevationGain
  ), 0)
  const remainingVolumeKm = roundExplanationNumber(
    Math.max(0, input.targetVolumeKm - fixedVolumeKm),
  )
  const remainingElevationGain = input.targetElevationGain === null
    ? null
    : Math.max(0, input.targetElevationGain - fixedElevationGain)

  const flexibleVolumeFacts = volume.allocations
    .filter(({ flexibility }) => flexibility === 'flexible')
    .map((allocation): GenerationExplanationFact => ({
      code: 'flexible_volume_allocation',
      value: `${allocation.slotKey}::${allocation.distanceKm}`,
    }))
  const flexibleElevationFacts = elevation.allocations
    .filter(({ flexibility }) => flexibility === 'flexible')
    .map((allocation): GenerationExplanationFact => ({
      code: 'flexible_elevation_allocation',
      value: `${allocation.slotKey}::${allocation.elevationGain}`,
    }))

  return {
    stimulusTemplate: {
      stage: 'stimulus_template',
      inputs: input.slots.map((slot) => ({
        code: 'slot_role',
        value: `${slot.key}::${slot.role}`,
      })),
      constraints: [
        { code: 'team_id', value: input.teamId },
        { code: 'period', value: input.period },
        { code: 'microcycle_type', value: input.microcycleType },
      ],
      decision: templateFacts,
      consequence: templateConsequences,
      warnings: templateWarnings,
    },
    fixedLoad: {
      stage: 'fixed_load',
      inputs: [],
      constraints: [],
      decision: fixedLoadFacts,
      consequence: [
        { code: 'fixed_volume_km', value: roundExplanationNumber(fixedVolumeKm) },
        { code: 'fixed_elevation_gain', value: fixedElevationGain },
      ],
      warnings: [],
    },
    remainingBudget: {
      stage: 'remaining_budget',
      inputs: [
        { code: 'target_volume_km', value: input.targetVolumeKm },
        { code: 'target_elevation_gain', value: input.targetElevationGain },
        { code: 'fixed_volume_km', value: roundExplanationNumber(fixedVolumeKm) },
        { code: 'fixed_elevation_gain', value: fixedElevationGain },
      ],
      constraints: [],
      decision: [
        { code: 'remaining_volume_km', value: remainingVolumeKm },
        { code: 'remaining_elevation_gain', value: remainingElevationGain },
      ],
      consequence: [],
      warnings: [
        ...volume.warnings.map((warning) => ({
          code: volume.isExceeded ? 'fixed_volume_exceeds_target' : 'volume_unassigned',
          facts: [{ code: 'source_warning', value: warning }],
        })),
        ...elevation.warnings.map((warning) => ({
          code: elevation.isExceeded ? 'fixed_elevation_exceeds_target' : 'elevation_unassigned',
          facts: [{ code: 'source_warning', value: warning }],
        })),
      ],
    },
    flexibleAllocation: {
      stage: 'flexible_allocation',
      inputs: [
        { code: 'remaining_volume_km', value: remainingVolumeKm },
        { code: 'remaining_elevation_gain', value: remainingElevationGain },
      ],
      constraints: [],
      decision: [
        ...flexibleVolumeFacts,
        ...flexibleElevationFacts,
      ],
      consequence: [
        { code: 'allocated_volume_km', value: volume.allocatedVolumeKm },
        { code: 'allocated_elevation_gain', value: elevation.allocatedElevationGain },
      ],
      warnings: [],
    },
  }
}

function resolveExplanationFixedVolume(
  slots: WeeklyTrainingSlot[],
  templates: Map<string, WorkoutTemplate | null>,
): WeeklyVolumeAllocation[] {
  return slots.flatMap((slot) => {
    const template = templates.get(slot.key)
    const distanceKm = template?.prescriptionDefaults.distanceKm
    return isExplanationFixedGeographicalTemplate(template) &&
      distanceKm !== null &&
      distanceKm !== undefined
      ? [{ slotKey: slot.key, flexibility: 'fixed' as const, distanceKm }]
      : []
  })
}

function resolveExplanationFixedElevation(
  slots: WeeklyTrainingSlot[],
  templates: Map<string, WorkoutTemplate | null>,
): WeeklyElevationAllocation[] {
  return slots.flatMap((slot) => {
    const template = templates.get(slot.key)
    const elevationGain = template?.prescriptionDefaults.elevationGain
    return isExplanationFixedGeographicalTemplate(template) &&
      elevationGain !== null &&
      elevationGain !== undefined
      ? [{ slotKey: slot.key, flexibility: 'fixed' as const, elevationGain }]
      : []
  })
}

function isExplanationFixedGeographicalTemplate(
  template: WorkoutTemplate | null | undefined,
) {
  return Boolean(
    template?.sessionDefaults.trackPath &&
    template.prescriptionDefaults.distanceKm !== null &&
    template.prescriptionDefaults.distanceKm !== undefined &&
    template.prescriptionDefaults.elevationGain !== null &&
    template.prescriptionDefaults.elevationGain !== undefined,
  )
}
