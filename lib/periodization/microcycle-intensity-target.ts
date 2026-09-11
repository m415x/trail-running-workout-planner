import {
  getIntensityStrategyRule,
  getIntensityStrategyRuleForPlanningIntent,
} from '@/lib/periodization/intensity-strategy-matrix'
import { validateIntensityStrategyLimits } from '@/lib/periodization/intensity-strategy-limits'

import type {
  IntensitySessionDemand,
  IntensityStrategyDraft,
  MicrocycleIntensityTargetFieldSources,
  MicrocycleIntensityTargetDraft,
  MicrocycleType,
  PeriodType,
  PlanningIntent,
} from '@/types'

const GENERATED_FIELD_SOURCES: MicrocycleIntensityTargetFieldSources = {
  intenseSessionsTarget: 'generated',
  predominantZone: 'generated',
  pamPercentageTarget: 'generated',
  minimumRecoveryDaysBetweenIntenseSessions: 'generated',
}

const INTENSE_SESSION_COUNT_BY_DEMAND: Record<IntensitySessionDemand, number> = {
  none: 0,
  reduced: 1,
  standard: 2,
  high: 3,
}

export interface CalculateMicrocycleIntensityTargetParams {
  period: PeriodType
  microcycleType: MicrocycleType
  intensityStrategy: IntensityStrategyDraft
  /** Preferred H9 authority. Omit only for legacy callers. */
  planningIntent?: PlanningIntent
}

/**
 * Resolves the qualitative matrix rule into one generated weekly target.
 *
 * The requested number of intense sessions is capped by the coach's strategy.
 * Session availability and concrete dates are intentionally evaluated later.
 * PlanningIntent is authoritative when supplied; goalType remains only a
 * compatibility fallback for persisted strategies created before H9.
 */
export function calculateMicrocycleIntensityTarget({
  period,
  microcycleType,
  intensityStrategy,
  planningIntent,
}: CalculateMicrocycleIntensityTargetParams): MicrocycleIntensityTargetDraft {
  const limitsValidation = validateIntensityStrategyLimits(intensityStrategy.values)

  if (!limitsValidation.isValid) {
    throw new Error(limitsValidation.errors.join(' '))
  }

  const rule = planningIntent
    ? getIntensityStrategyRuleForPlanningIntent(period, microcycleType, planningIntent)
    : getIntensityStrategyRule(period, microcycleType, intensityStrategy.context.goalType)
  const requestedIntenseSessions = INTENSE_SESSION_COUNT_BY_DEMAND[rule.intenseSessionDemand]
  const intenseSessionsTarget = Math.min(
    requestedIntenseSessions,
    intensityStrategy.values.maximumIntenseSessionsPerWeek,
  )

  return {
    emphasis: rule.emphasis,
    intenseSessionsTarget,
    predominantZone: rule.predominantZone,
    pamPercentageTarget: intenseSessionsTarget > 0 ? rule.suggestedPamPercentage : null,
    minimumRecoveryDaysBetweenIntenseSessions:
      intensityStrategy.values.minimumRecoveryDaysBetweenIntenseSessions,
    fieldSources: { ...GENERATED_FIELD_SOURCES },
  }
}
