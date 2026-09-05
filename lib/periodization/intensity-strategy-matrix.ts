import type {
  IntensityStrategyMatrix,
  IntensityStrategyRule,
  MicrocycleType,
  PeriodType,
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

const GOAL_TYPES: readonly TrainingGoalType[] = [
  'race',
  'performance',
  'base',
  'maintenance',
  'custom',
]

const BASE_RULES: Record<PeriodType, Record<MicrocycleType, IntensityStrategyRule>> = {
  general_preparatory: {
    base: rule('aerobic', 'Z2', 'none', null),
    development: rule('aerobic', 'Z2', 'reduced', 80),
    shock: rule('tempo', 'Z3', 'standard', 90),
    deload: rule('recovery', 'Z1', 'none', null),
    tapering: rule('aerobic', 'Z2', 'reduced', 80),
    race: rule('race_specific', 'Z4', 'standard', null),
  },
  specific_preparatory: {
    base: rule('aerobic', 'Z2', 'reduced', 80),
    development: rule('tempo', 'Z3', 'standard', 90),
    shock: rule('threshold', 'Z4', 'high', 100),
    deload: rule('recovery', 'Z1', 'none', null),
    tapering: rule('aerobic', 'Z2', 'reduced', 90),
    race: rule('race_specific', 'Z4', 'standard', null),
  },
  competitive: {
    base: rule('aerobic', 'Z2', 'reduced', 80),
    development: rule('tempo', 'Z3', 'standard', 90),
    shock: rule('vo2max', 'Z5', 'high', 100),
    deload: rule('recovery', 'Z1', 'none', null),
    tapering: rule('aerobic', 'Z2', 'reduced', 90),
    race: rule('race_specific', 'Z4', 'standard', null),
  },
  transition: {
    base: rule('aerobic', 'Z2', 'none', null),
    development: rule('aerobic', 'Z2', 'reduced', 70),
    shock: rule('tempo', 'Z3', 'reduced', 80),
    deload: rule('recovery', 'Z1', 'none', null),
    tapering: rule('recovery', 'Z1', 'none', null),
    race: rule('race_specific', 'Z3', 'reduced', null),
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
 * Applies the group objective without turning the matrix into session-level
 * prescriptions. Base and maintenance goals stay deliberately conservative.
 */
function adaptRuleToGoal(
  baseRule: IntensityStrategyRule,
  goalType: TrainingGoalType,
): IntensityStrategyRule {
  if (goalType !== 'base' && goalType !== 'maintenance') {
    return { ...baseRule }
  }

  if (baseRule.emphasis === 'race_specific') {
    return rule('aerobic', 'Z2', 'reduced', 80)
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

function buildIntensityStrategyMatrix(): IntensityStrategyMatrix {
  return Object.fromEntries(
    PERIODS.map((period) => [
      period,
      Object.fromEntries(
        MICROCYCLE_TYPES.map((microcycleType) => [
          microcycleType,
          Object.fromEntries(
            GOAL_TYPES.map((goalType) => [
              goalType,
              adaptRuleToGoal(BASE_RULES[period][microcycleType], goalType),
            ]),
          ),
        ]),
      ),
    ]),
  ) as IntensityStrategyMatrix
}

export const INTENSITY_STRATEGY_MATRIX = buildIntensityStrategyMatrix()

/** Returns a detached rule so callers cannot mutate the shared matrix. */
export function getIntensityStrategyRule(
  period: PeriodType,
  microcycleType: MicrocycleType,
  goalType: TrainingGoalType,
): IntensityStrategyRule {
  return { ...INTENSITY_STRATEGY_MATRIX[period][microcycleType][goalType] }
}
