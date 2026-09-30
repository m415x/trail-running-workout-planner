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
