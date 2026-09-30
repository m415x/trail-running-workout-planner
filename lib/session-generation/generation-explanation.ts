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
