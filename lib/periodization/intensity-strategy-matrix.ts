import { resolveLegacyPlanningIntent } from '@/lib/periodization/planning-intent'

import type {
  IntensityStrategyRule,
  MicrocycleType,
  PeriodType,
  PlanningIntent,
  TrainingGoalType,
} from '@/types'

/** PAM percentages used as practical prescription steps by the coach. */
export const PAM_PERCENTAGE_STEPS = [50, 60, 70, 80, 90, 100, 110, 115, 120] as const

const PERIODS: readonly PeriodType[] = [
  'general_preparatory',
  'specific_preparatory',
  'competitive',
  'transition',
]

const MICROCYCLE_TYPES: readonly MicrocycleType[] = [
  'base',
  'development',
  'shock',
  'deload',
  'tapering',
  'race',
]

const PLANNING_INTENTS: readonly PlanningIntent[] = [
  'development',
  'base',
  'maintenance',
]

const DELOAD_RULE = rule('recovery', 'Z1', 'none', null)

/** The race is the week's stressor; this rule adds no extra intense session. */
const RACE_WEEK_RULE = rule('race_specific', 'Z1', 'none', null)

const BASE_RULES: Record<PeriodType, Record<MicrocycleType, IntensityStrategyRule>> = {
  general_preparatory: {
    base: rule('aerobic', 'Z2', 'none', null),
    development: rule('aerobic', 'Z2', 'reduced', 80),
    shock: rule('tempo', 'Z3', 'standard', 90),
    deload: DELOAD_RULE,
    tapering: rule('aerobic', 'Z2', 'reduced', 80),
    race: RACE_WEEK_RULE,
  },
  specific_preparatory: {
    base: rule('aerobic', 'Z2', 'reduced', 80),
    development: rule('tempo', 'Z3', 'standard', 90),
    shock: rule('threshold', 'Z4', 'high', 100),
    deload: DELOAD_RULE,
    tapering: rule('aerobic', 'Z2', 'reduced', 90),
    race: RACE_WEEK_RULE,
  },
  competitive: {
    base: rule('aerobic', 'Z2', 'reduced', 80),
    development: rule('tempo', 'Z3', 'standard', 90),
    shock: rule('vo2max', 'Z5', 'high', 100),
    deload: DELOAD_RULE,
    tapering: rule('aerobic', 'Z2', 'reduced', 90),
    race: RACE_WEEK_RULE,
  },
  transition: {
    base: rule('aerobic', 'Z2', 'none', null),
    development: rule('aerobic', 'Z2', 'reduced', 70),
    shock: rule('tempo', 'Z3', 'reduced', 80),
    deload: DELOAD_RULE,
    tapering: rule('recovery', 'Z1', 'none', null),
    race: RACE_WEEK_RULE,
  },
}

function rule(
  emphasis: IntensityStrategyRule['emphasis'],
  predominantZone: IntensityStrategyRule['predominantZone'],
  intenseSessionDemand: IntensityStrategyRule['intenseSessionDemand'],
  suggestedPamPercentage: IntensityStrategyRule['suggestedPamPercentage'],
): IntensityStrategyRule {
  return { emphasis, predominantZone, intenseSessionDemand, suggestedPamPercentage }
}

/**
 * Applies the group planning intent without coupling intensity to competitions.
 * Base and maintenance intents stay deliberately conservative.
 */
function adaptRuleToPlanningIntent(
  baseRule: IntensityStrategyRule,
  planningIntent: PlanningIntent,
): IntensityStrategyRule {
  if (planningIntent === 'development') {
    return { ...baseRule }
  }

  if (baseRule.predominantZone === 'Z4' || baseRule.predominantZone === 'Z5') {
    return rule('tempo', 'Z3', 'reduced', 80)
  }

  if (baseRule.intenseSessionDemand === 'high') {
    return {
      ...baseRule,
      intenseSessionDemand: 'reduced',
      suggestedPamPercentage: Math.min(baseRule.suggestedPamPercentage ?? 80, 80),
    }
  }

  return { ...baseRule }
}

type PlanningIntentIntensityMatrix = Record<
  PeriodType,
  Record<MicrocycleType, Record<PlanningIntent, IntensityStrategyRule>>
>

function buildIntensityStrategyMatrix(): PlanningIntentIntensityMatrix {
  return Object.fromEntries(
    PERIODS.map((period) => [
      period,
      Object.fromEntries(
        MICROCYCLE_TYPES.map((microcycleType) => [
          microcycleType,
          Object.fromEntries(
            PLANNING_INTENTS.map((planningIntent) => [
              planningIntent,
              adaptRuleToPlanningIntent(BASE_RULES[period][microcycleType], planningIntent),
            ]),
          ),
        ]),
      ),
    ]),
  ) as PlanningIntentIntensityMatrix
}

export const INTENSITY_STRATEGY_MATRIX = buildIntensityStrategyMatrix()

/** Returns a detached rule using the H9 planning authority. */
export function getIntensityStrategyRuleForPlanningIntent(
  period: PeriodType,
  microcycleType: MicrocycleType,
  planningIntent: PlanningIntent,
): IntensityStrategyRule {
  return { ...INTENSITY_STRATEGY_MATRIX[period][microcycleType][planningIntent] }
}

/**
 * Legacy compatibility wrapper. A persisted `race` value maps to development
 * and cannot select a separate intensity policy.
 */
export function getIntensityStrategyRule(
  period: PeriodType,
  microcycleType: MicrocycleType,
  goalType: TrainingGoalType,
): IntensityStrategyRule {
  return getIntensityStrategyRuleForPlanningIntent(
    period,
    microcycleType,
    resolveLegacyPlanningIntent(goalType),
  )
}
