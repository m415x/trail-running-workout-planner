import {
  TRAINING_LOAD_RULE_CONFIG,
  type DailyTrainingLoad,
  type TrainingLoadTrendPoint,
} from '@/types'

export function deriveTrainingLoadTrend(
  days: readonly DailyTrainingLoad[],
): TrainingLoadTrendPoint[] {
  const shortAlpha = 1 - Math.exp(-1 / TRAINING_LOAD_RULE_CONFIG.shortTermTimeConstantDays)
  const longAlpha = 1 - Math.exp(-1 / TRAINING_LOAD_RULE_CONFIG.longTermTimeConstantDays)

  let shortTermLoadAu: number | null = null
  let longTermLoadAu: number | null = null
  let reliableStreakDays = 0

  return days.map((day) => {
    if (day.loadAu === null) {
      shortTermLoadAu = null
      longTermLoadAu = null
      reliableStreakDays = 0

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
      status: reliableStreakDays >= TRAINING_LOAD_RULE_CONFIG.minimumWarmupDays
        ? 'available'
        : 'warming_up',
    }
  })
}
