import {
  TRAINING_LOAD_RULE_CONFIG,
  type DailyTrainingLoad,
  type TrainingLoadRuleConfig,
  type TrainingLoadTrendPoint,
} from '@/types'

export function deriveTrainingLoadTrend(
  days: readonly DailyTrainingLoad[],
  rule: TrainingLoadRuleConfig = TRAINING_LOAD_RULE_CONFIG,
): TrainingLoadTrendPoint[] {
  const shortAlpha = 1 - Math.exp(-1 / rule.shortTermTimeConstantDays)
  const longAlpha = 1 - Math.exp(-1 / rule.longTermTimeConstantDays)

  let shortTermLoadAu: number | null = null
  let longTermLoadAu: number | null = null
  let reliableStreakDays = 0

  return days.map((day) => {
    if (day.loadAu === null) {
      if (rule.resetOnUnknownEvidence) {
        shortTermLoadAu = null
        longTermLoadAu = null
        reliableStreakDays = 0
      }

      return {
        date: day.date,
        dailyLoadAu: null,
        shortTermLoadAu: null,
        longTermLoadAu: null,
        loadBalanceAu: null,
        status: 'insufficient_data',
      }
    }

    reliableStreakDays += 1

    if (shortTermLoadAu === null || longTermLoadAu === null) {
      shortTermLoadAu = day.loadAu
      longTermLoadAu = day.loadAu
    } else {
      shortTermLoadAu = shortTermLoadAu + (day.loadAu - shortTermLoadAu) * shortAlpha
      longTermLoadAu = longTermLoadAu + (day.loadAu - longTermLoadAu) * longAlpha
    }

    return {
      date: day.date,
      dailyLoadAu: day.loadAu,
      shortTermLoadAu,
      longTermLoadAu,
      loadBalanceAu: longTermLoadAu - shortTermLoadAu,
      status: reliableStreakDays >= rule.minimumWarmupDays
        ? 'available'
        : 'warming_up',
    }
  })
}
