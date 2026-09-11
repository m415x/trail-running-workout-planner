import { getCompetitionAdjustmentPolicy } from '@/lib/periodization/competition-adjustment-policy'
import { assessCompetitionDemand } from '@/lib/periodization/competition-demand-assessment'

import type {
  CompetitionDemandAssessment,
  RecoveryDecision,
  RecoveryDecisionInput,
  RecoveryDemandAssessment,
  RecoveryDemandBand,
  RecoveryPhaseDecision,
} from '@/types'

const RECOVERY_BY_DEMAND: Record<RecoveryDemandBand, readonly RecoveryPhaseDecision[]> = {
  minimal: [
    { phase: 'acute_recovery', durationDays: 1, trainingLoadCeilingPercentage: 40, allowIntenseSessions: false },
    { phase: 'progressive_reentry', durationDays: 1, trainingLoadCeilingPercentage: 80, allowIntenseSessions: false },
  ],
  low: [
    { phase: 'acute_recovery', durationDays: 1, trainingLoadCeilingPercentage: 30, allowIntenseSessions: false },
    { phase: 'recovery', durationDays: 1, trainingLoadCeilingPercentage: 50, allowIntenseSessions: false },
    { phase: 'progressive_reentry', durationDays: 2, trainingLoadCeilingPercentage: 80, allowIntenseSessions: false },
  ],
  moderate: [
    { phase: 'acute_recovery', durationDays: 2, trainingLoadCeilingPercentage: 25, allowIntenseSessions: false },
    { phase: 'recovery', durationDays: 2, trainingLoadCeilingPercentage: 50, allowIntenseSessions: false },
    { phase: 'progressive_reentry', durationDays: 3, trainingLoadCeilingPercentage: 75, allowIntenseSessions: false },
  ],
  high: [
    { phase: 'acute_recovery', durationDays: 2, trainingLoadCeilingPercentage: 20, allowIntenseSessions: false },
    { phase: 'recovery', durationDays: 3, trainingLoadCeilingPercentage: 45, allowIntenseSessions: false },
    { phase: 'progressive_reentry', durationDays: 5, trainingLoadCeilingPercentage: 70, allowIntenseSessions: false },
  ],
  very_high: [
    { phase: 'acute_recovery', durationDays: 3, trainingLoadCeilingPercentage: 15, allowIntenseSessions: false },
    { phase: 'recovery', durationDays: 4, trainingLoadCeilingPercentage: 40, allowIntenseSessions: false },
    { phase: 'progressive_reentry', durationDays: 7, trainingLoadCeilingPercentage: 65, allowIntenseSessions: false },
  ],
  unknown: [
    { phase: 'acute_recovery', durationDays: 1, trainingLoadCeilingPercentage: 30, allowIntenseSessions: false },
    { phase: 'progressive_reentry', durationDays: 2, trainingLoadCeilingPercentage: 70, allowIntenseSessions: false },
  ],
}

function toRecoveryDemandBand(
  demand: CompetitionDemandAssessment,
  elevationLossM: number | null,
): RecoveryDemandBand {
  if (demand.band === 'unknown') return 'unknown'

  const baseline: Exclude<RecoveryDemandBand, 'unknown'> = (() => {
    switch (demand.band) {
      case 'very_low': return 'minimal'
      case 'low': return 'low'
      case 'moderate': return 'moderate'
      case 'high': return 'high'
      case 'very_high':
      case 'extreme': return 'very_high'
    }
  })()

  // V1 keeps D- deliberately conservative: only a clearly large known descent
  // raises recovery one band. Future GPS-derived eccentric-load models can
  // replace this threshold without changing the RecoveryDecision contract.
  if (elevationLossM === null || elevationLossM < 2_500) return baseline

  switch (baseline) {
    case 'minimal': return 'low'
    case 'low': return 'moderate'
    case 'moderate': return 'high'
    case 'high':
    case 'very_high': return 'very_high'
  }
}

function assessRecoveryDemand(
  competitionDemand: CompetitionDemandAssessment,
): RecoveryDemandAssessment {
  const elevationLossM = competitionDemand.profile.elevationLossM ?? null
  const downhillLoadKnown = elevationLossM !== null
  const technicalityKnown = competitionDemand.limitations.technicalityKnown

  return {
    band: toRecoveryDemandBand(competitionDemand, elevationLossM),
    confidence: competitionDemand.confidence,
    competitionDemandBand: competitionDemand.band,
    courseEffortKm: competitionDemand.courseEffortKm,
    elevationLossM,
    downhillLoadKnown,
    technicalityKnown,
    requiresCoachReview: competitionDemand.band === 'unknown',
  }
}

/**
 * Decides post-competition recovery independently from taper and race priority.
 *
 * Physiological demand selects acute recovery, recovery and progressive reentry.
 * Priority only supplies planning protection for those phases. V1 uses known D-
 * conservatively and keeps the contract open for GPS-derived eccentric load.
 */
export function decidePostCompetitionRecovery(
  input: RecoveryDecisionInput,
): RecoveryDecision {
  const competitionDemand = input.competitionDemand ?? assessCompetitionDemand(input.courseProfile)
  const demand = assessRecoveryDemand(competitionDemand)
  const policy = getCompetitionAdjustmentPolicy(input.priority)
  const phases = RECOVERY_BY_DEMAND[demand.band]
  const reasonCodes: RecoveryDecision['reasonCodes'][number][] = [
    demand.band === 'unknown' ? 'competition_demand_unknown' : 'competition_demand',
    demand.downhillLoadKnown ? 'downhill_load_available' : 'downhill_load_unknown',
    'priority_planning_protection',
  ]

  if (demand.technicalityKnown) reasonCodes.push('technicality_available')

  return {
    priority: input.priority,
    demand,
    planningProtection: policy.postCompetitionPlanningProtection,
    phases,
    totalRecoveryDays: phases.reduce((total, phase) => total + phase.durationDays, 0),
    requiresCoachReview: demand.requiresCoachReview,
    reasonCodes,
  }
}
