import {
  resolveWeeklySessionCount,
  selectWeeklySlots,
} from '@/lib/session-generation/weekly-generation-rules'
import { distributeWeeklyElevation } from '@/lib/session-generation/weekly-elevation-distribution'
import { distributeWeeklyIntensity } from '@/lib/session-generation/weekly-intensity-distribution'
import { distributeWeeklyVolume } from '@/lib/session-generation/weekly-volume-distribution'
import { selectWorkoutTemplate } from '@/lib/session-generation/workout-template-selection'
import type { MicrocycleType, PeriodType } from '@/types/training/periodization.types'
import type {
  DatedTrainingSlot,
  SessionGenerationCompetitionTarget,
  SessionGenerationIntensityTarget,
  TrainingWeekday,
  WeeklyElevationAllocation,
  WeeklySessionFrequency,
  WeeklyTrainingPattern,
  WeeklyTrainingSlot,
  WeeklyVolumeAllocation,
  SharedSessionGenerationResult,
  SessionGenerationOwnership,
} from '@/types/training/session-generation.types'
import type { SessionRegenerationPlan } from '@/lib/session-generation/session-regeneration'
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
    input.targetVolumeKm - fixedVolumeKm,
  )
  const remainingElevationGain = input.targetElevationGain === null
    ? null
    : input.targetElevationGain - fixedElevationGain

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


export interface ExplainIntensityAndRaceInput {
  trainingSlots: DatedTrainingSlot[]
  intensity: SessionGenerationIntensityTarget
  competition: SessionGenerationCompetitionTarget | null
  trainingTargetVolumeKm: number
  trainingTargetElevationGain: number | null
}

export interface IntensityAndRaceExplanation {
  intensity: GenerationExplanationStageEvidence
  race: GenerationExplanationStageEvidence
}

export function explainIntensityAndRace(
  input: ExplainIntensityAndRaceInput,
): IntensityAndRaceExplanation {
  const distribution = distributeWeeklyIntensity(
    input.trainingSlots,
    input.intensity,
  )

  const methods = new Set(
    distribution.allocations.map(({ intensityMethod }) => intensityMethod),
  )
  const effectiveMethod = methods.size === 1
    ? [...methods][0]
    : methods.has('reference_percentage')
      ? 'reference_percentage'
      : 'hr_zone'

  const intensityWarnings: GenerationExplanationWarning[] = []
  for (const warning of distribution.warnings) {
    if (
      input.intensity.defaultMethod === 'reference_percentage' &&
      input.intensity.referencePercentageTarget === null
    ) {
      intensityWarnings.push({
        code: 'reference_percentage_target_missing',
        facts: [{ code: 'source_warning', value: warning }],
      })
      continue
    }

    intensityWarnings.push({
      code: 'intense_sessions_not_fully_assigned',
      facts: [
        {
          code: 'intense_sessions_target',
          value: input.intensity.intenseSessionsTarget,
        },
        {
          code: 'assigned_intense_sessions',
          value: distribution.assignedIntenseSessions,
        },
        {
          code: 'minimum_recovery_days',
          value: input.intensity.minimumRecoveryDaysBetweenIntenseSessions,
        },
        { code: 'source_warning', value: warning },
      ],
    })
  }

  const slotFacts = distribution.allocations.map(
    (allocation): GenerationExplanationFact => ({
      code: 'slot_intensity',
      value: allocation.intensityMethod === 'reference_percentage'
        ? `${allocation.slotKey}::reference_percentage::${allocation.referencePercentage}`
        : `${allocation.slotKey}::hr_zone::${allocation.zone}`,
    }),
  )

  const raceInputs: GenerationExplanationFact[] = [
    {
      code: 'training_target_volume_km',
      value: input.trainingTargetVolumeKm,
    },
    {
      code: 'training_target_elevation_gain',
      value: input.trainingTargetElevationGain,
    },
  ]

  if (input.competition) {
    raceInputs.push(
      { code: 'race_name', value: input.competition.name },
      { code: 'race_date', value: input.competition.date },
      { code: 'race_distance_km', value: input.competition.distanceKm },
      { code: 'race_elevation_gain', value: input.competition.elevationGain },
    )
  }

  return {
    intensity: {
      stage: 'intensity',
      inputs: [
        {
          code: 'training_slot_keys',
          value: input.trainingSlots.map(({ slot }) => slot.key).join(','),
        },
        {
          code: 'default_method',
          value: input.intensity.defaultMethod,
        },
        {
          code: 'emphasis',
          value: input.intensity.emphasis,
        },
        {
          code: 'predominant_zone',
          value: input.intensity.predominantZone,
        },
        {
          code: 'reference_percentage_target',
          value: input.intensity.referencePercentageTarget,
        },
      ],
      constraints: [
        {
          code: 'intense_sessions_target',
          value: input.intensity.intenseSessionsTarget,
        },
        {
          code: 'minimum_recovery_days',
          value: input.intensity.minimumRecoveryDaysBetweenIntenseSessions,
        },
      ],
      decision: [
        {
          code: 'assigned_intense_sessions',
          value: distribution.assignedIntenseSessions,
        },
        {
          code: 'effective_method',
          value: effectiveMethod,
        },
        ...slotFacts,
      ],
      consequence: [],
      warnings: intensityWarnings,
    },
    race: {
      stage: 'intensity',
      inputs: raceInputs,
      constraints: [],
      decision: input.competition
        ? [
            { code: 'competition_present', value: true },
            { code: 'competition_date', value: input.competition.date },
          ]
        : [{ code: 'competition_present', value: false }],
      consequence: [{
        code: 'race_load_separate_from_training_budget',
        value: input.competition !== null,
      }],
      warnings: [],
    },
  }
}


export interface ExplainPlanningScopeAndCoordinationInput {
  planningScope: GenerationExplanationPlanningScope
  sharedGeneration: SharedSessionGenerationResult
  generationKey: string
}

export interface PlanningScopeAndCoordinationExplanation {
  planningScope: GenerationExplanationPlanningScope
  coordination: GenerationExplanationStageEvidence
}

export function explainPlanningScopeAndCoordination(
  input: ExplainPlanningScopeAndCoordinationInput,
): PlanningScopeAndCoordinationExplanation {
  const matches = input.sharedGeneration.events.flatMap((event) => (
    event.prescriptions
      .filter(({ generationKey }) => generationKey === input.generationKey)
      .map((prescription) => ({ event, prescription }))
  ))

  if (matches.length > 1) {
    throw new RangeError(
      `Generation explanation found duplicated generation key ${input.generationKey}`,
    )
  }

  const match = matches[0] ?? null
  const coexistingMicrocycleIds = match
    ? [...new Set(
        match.event.prescriptions.map(({ prescription }) => prescription.microcycleId),
      )].sort()
    : []

  const inputs: GenerationExplanationFact[] = [
    { code: 'current_generation_key', value: input.generationKey },
    { code: 'planning_scope_kind', value: input.planningScope.kind },
    {
      code: 'group_training_plan_id',
      value: input.planningScope.groupTrainingPlanId,
    },
    { code: 'group_id', value: input.planningScope.groupId },
    { code: 'microcycle_id', value: input.planningScope.microcycleId },
    {
      code: 'planning_cohort_id',
      value: input.planningScope.planningCohortId,
    },
  ]

  if (match) {
    inputs.push({ code: 'shared_event_key', value: match.event.sharedEventKey })
  }

  return {
    planningScope: input.planningScope,
    coordination: {
      stage: 'coordination_reconciliation',
      inputs,
      constraints: [],
      decision: [{
        code: 'current_scope_participates',
        value: match !== null,
      }],
      consequence: [
        {
          code: 'shared_prescription_count',
          value: match?.event.prescriptions.length ?? 0,
        },
        {
          code: 'coexisting_microcycle_ids',
          value: coexistingMicrocycleIds.join(','),
        },
        {
          code: 'coordination_source',
          value: 'shared_generation_result',
        },
      ],
      warnings: match
        ? []
        : [{
            code: 'current_generation_not_present_in_shared_result',
            facts: [{ code: 'generation_key', value: input.generationKey }],
          }],
    },
  }
}


export interface ExplainOwnershipAndRegenerationInput {
  reconciliation: SessionRegenerationPlan
  eventOwnership: SessionGenerationOwnership
  prescriptionOwnership: SessionGenerationOwnership
}

export interface OwnershipAndRegenerationExplanation {
  coordination: GenerationExplanationStageEvidence
}

export function explainOwnershipAndRegeneration(
  input: ExplainOwnershipAndRegenerationInput,
): OwnershipAndRegenerationExplanation {
  const eventAction = resolveRegenerationAction(
    input.reconciliation.events.map(({ action }) => action),
    input.reconciliation.protectedCollisions.some(({ kind }) => kind === 'event'),
  )
  const prescriptionAction = resolveRegenerationAction(
    input.reconciliation.prescriptions.map(({ action }) => action),
    input.reconciliation.protectedCollisions.some(({ kind }) => kind === 'prescription'),
  )

  const anyModified = (
    input.eventOwnership === 'generated_modified' ||
    input.prescriptionOwnership === 'generated_modified'
  )
  const anyManual = (
    input.eventOwnership === 'manual' ||
    input.prescriptionOwnership === 'manual'
  )
  const allGenerated = (
    input.eventOwnership === 'generated' &&
    input.prescriptionOwnership === 'generated'
  )

  const warnings: GenerationExplanationWarning[] = input.reconciliation.protectedCollisions.map(
    (collision) => ({
      code: 'protected_generation_collision',
      facts: [
        { code: 'kind', value: collision.kind },
        { code: 'existing_id', value: collision.existingId },
        { code: 'generation_key', value: collision.generationKey },
      ],
    }),
  )

  return {
    coordination: {
      stage: 'coordination_reconciliation',
      inputs: [
        { code: 'event_ownership', value: input.eventOwnership },
        { code: 'prescription_ownership', value: input.prescriptionOwnership },
        {
          code: 'generated_origin_retained',
          value: anyModified,
        },
      ],
      constraints: [],
      decision: [
        { code: 'event_regeneration_action', value: eventAction },
        { code: 'prescription_regeneration_action', value: prescriptionAction },
      ],
      consequence: [
        {
          code: 'generated_origin_retained',
          value: anyModified,
        },
        {
          code: 'current_state_coach_protected',
          value: anyModified || anyManual,
        },
        {
          code: 'generator_may_replace_current_state',
          value: allGenerated &&
            eventAction !== 'protected' &&
            prescriptionAction !== 'protected',
        },
      ],
      warnings,
    },
  }
}

function resolveRegenerationAction(
  actions: Array<'create' | 'replace'>,
  protectedCollision: boolean,
) {
  if (protectedCollision) return 'protected'
  if (actions.includes('replace')) return 'replace'
  if (actions.includes('create')) return 'create'
  return 'preserved'
}
