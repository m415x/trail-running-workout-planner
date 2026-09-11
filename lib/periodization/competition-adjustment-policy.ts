import type {
  CompetitionPriority,
  CompetitionPriorityAdjustmentPolicy,
} from '@/types'

const PRIORITY_POLICIES: Record<CompetitionPriority, CompetitionPriorityAdjustmentPolicy> = {
  A: {
    priority: 'A',
    defaultStrategy: 'full_taper',
    taperDurationDays: { min: 4, max: 21 },
    volumeReductionPercentage: { min: 30, max: 60 },
    allowNoFormalTaper: false,
    allowCompetitionAsTrainingStimulus: false,
    preserveBriefIntensityStimuli: true,
    postCompetitionPlanningProtection: 'protected',
  },
  B: {
    priority: 'B',
    defaultStrategy: 'proportional_adjustment',
    taperDurationDays: { min: 0, max: 7 },
    volumeReductionPercentage: { min: 0, max: 40 },
    allowNoFormalTaper: true,
    allowCompetitionAsTrainingStimulus: false,
    preserveBriefIntensityStimuli: true,
    postCompetitionPlanningProtection: 'contextual',
  },
  C: {
    priority: 'C',
    defaultStrategy: 'specific_stimulus',
    taperDurationDays: { min: 0, max: 3 },
    volumeReductionPercentage: { min: 0, max: 20 },
    allowNoFormalTaper: true,
    allowCompetitionAsTrainingStimulus: true,
    preserveBriefIntensityStimuli: true,
    postCompetitionPlanningProtection: 'minimal_interference',
  },
}

/**
 * Returns the centralized priority guardrails used by H10 competitive adjustment.
 *
 * Priority controls planning treatment only. Final taper duration and reduction
 * magnitude are refined later from competition demand and reached load, while
 * physiological recovery is assessed independently.
 */
export function getCompetitionAdjustmentPolicy(
  priority: CompetitionPriority,
): CompetitionPriorityAdjustmentPolicy {
  return PRIORITY_POLICIES[priority]
}
