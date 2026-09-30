import {
  resolveWeeklySessionCount,
  selectWeeklySlots,
} from '@/lib/session-generation/weekly-generation-rules'
import type { MicrocycleType } from '@/types/training/periodization.types'
import type {
  TrainingWeekday,
  WeeklySessionFrequency,
  WeeklyTrainingPattern,
} from '@/types/training/session-generation.types'

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
