import { CalculateDailyTssParams, DailyStressMetrics } from '@/types'

const CTL_TIME_CONSTANT = 42 // Días para forma física
const ATL_TIME_CONSTANT = 7 // Días para fatiga aguda

/**
 * Calcula el TSS diario estimado basado en Duración (min), RPE o FC media y factor de desnivel
 */
export function calculateDailyTss({ durationMin, rpe, elevationGainM = 0 }: CalculateDailyTssParams): number {
  // Factor de intensidad relativa derivado del RPE (1-10 -> 0.45 a 1.15)
  const intensityFactor = 0.45 + (rpe / 10) * 0.7

  // En trail running, cada 100m de D+ añade estrés metabólico equivalente a ~1km llano
  const elevationTssMultiplier = 1 + (elevationGainM / 1000) * 0.15

  const baseTss = (durationMin * intensityFactor ** 2 * 100) / 60
  return Math.round(baseTss * elevationTssMultiplier)
}

/**
 * Actualiza CTL, ATL y TSB día a día usando Exponential Moving Average (EMA)
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
