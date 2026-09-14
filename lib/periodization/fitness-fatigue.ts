import { CalculateDailyTssParams, DailyStressMetrics } from '@/types'

const CTL_TIME_CONSTANT = 42 // Días para forma física
const ATL_TIME_CONSTANT = 7 // Días para fatiga aguda

/**
 * @deprecated KAN-261 replaces this heuristic with the versioned
 * `session-RPE × duration` AU model in `lib/training-load`.
 * This function is retained temporarily only for legacy compatibility and must
 * not be used by new product code or presented as Training Stress Score (TSS).
 */
export function calculateDailyTss({ durationMin, rpe, elevationGainM = 0 }: CalculateDailyTssParams): number {
  const intensityFactor = 0.45 + (rpe / 10) * 0.7
  const elevationTssMultiplier = 1 + (elevationGainM / 1000) * 0.15

  const baseTss = (durationMin * intensityFactor ** 2 * 100) / 60
  return Math.round(baseTss * elevationTssMultiplier)
}

/**
 * @deprecated KAN-261 replaces CTL/ATL/TSB product semantics with neutral,
 * versioned short-/long-term estimated load in `lib/training-load`.
 * Retained temporarily for legacy compatibility only.
 */
export function computeNextDayStress(
  prevMetrics: Pick<DailyStressMetrics, 'ctl' | 'atl'>,
  todayTss: number,
): Pick<DailyStressMetrics, 'ctl' | 'atl' | 'tsb'> {
  const ctlDecay = 1 - Math.exp(-1 / CTL_TIME_CONSTANT)
  const atlDecay = 1 - Math.exp(-1 / ATL_TIME_CONSTANT)

  const newCtl = prevMetrics.ctl + (todayTss - prevMetrics.ctl) * ctlDecay
  const newAtl = prevMetrics.atl + (todayTss - prevMetrics.atl) * atlDecay
  const newTsb = newCtl - newAtl

  return {
    ctl: Number(newCtl.toFixed(1)),
    atl: Number(newAtl.toFixed(1)),
    tsb: Number(newTsb.toFixed(1)),
  }
}
