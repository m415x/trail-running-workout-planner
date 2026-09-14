import type {
  DailyTrainingLoad,
  RealizedMetricName,
  RealizedTrainingRecord,
} from '@/types'

const PERFORMED_STATUSES = new Set<RealizedTrainingRecord['status']>(['completed', 'partial'])
const CONFIRMED_NON_EXPOSURE_STATUSES = new Set<RealizedTrainingRecord['status']>(['rest', 'missed'])

function knownMetric(
  record: RealizedTrainingRecord,
  name: RealizedMetricName,
): number | null {
  const metric = record.metrics[name]
  return metric.state === 'known' ? metric.value : null
}

function sumKnownMetric(
  records: readonly RealizedTrainingRecord[],
  name: 'distanceKm' | 'elevationGainM',
): number | null {
  const values = records
    .map(record => knownMetric(record, name))
    .filter((value): value is number => value !== null)

  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0)
}

export function deriveDailyTrainingLoad(
  date: string,
  records: readonly RealizedTrainingRecord[],
): DailyTrainingLoad {
  const sameDate = records.filter(record => record.date === date)
  const performed = sameDate.filter(record => PERFORMED_STATUSES.has(record.status))
  const sourceRecordIds = sameDate.map(record => record.id)

  if (performed.length === 0) {
    const confirmedRest = sameDate.length > 0
      && sameDate.every(record => CONFIRMED_NON_EXPOSURE_STATUSES.has(record.status))

    return {
      date,
      state: confirmedRest ? 'confirmed_rest' : 'no_evidence',
      loadAu: confirmedRest ? 0 : null,
      durationMin: confirmedRest ? 0 : null,
      rpe: null,
      external: {
        distanceM: null,
        elevationGainM: null,
        elevationLossM: null,
      },
      missingRequiredMetrics: [],
      sourceRecordIds,
    }
  }

  const missing = new Set<Extract<RealizedMetricName, 'durationMin' | 'rpe'>>()
  let totalDurationMin = 0
  let totalLoadAu = 0
  const rpeValues: number[] = []

  for (const record of performed) {
    const durationMin = knownMetric(record, 'durationMin')
    const rpe = knownMetric(record, 'rpe')

    if (durationMin === null) missing.add('durationMin')
    else totalDurationMin += durationMin

    if (rpe === null) missing.add('rpe')
    else rpeValues.push(rpe)

    if (durationMin !== null && rpe !== null) {
      totalLoadAu += durationMin * rpe
    }
  }

  const missingRequiredMetrics = (['durationMin', 'rpe'] as const)
    .filter(name => missing.has(name))

  const loadKnown = missingRequiredMetrics.length === 0

  return {
    date,
    state: loadKnown ? 'known_load' : 'unknown_load',
    loadAu: loadKnown ? totalLoadAu : null,
    durationMin: missing.has('durationMin') ? null : totalDurationMin,
    rpe: loadKnown && rpeValues.length === 1 ? rpeValues[0] : null,
    external: {
      distanceM: (() => {
        const distanceKm = sumKnownMetric(performed, 'distanceKm')
        return distanceKm === null ? null : distanceKm * 1000
      })(),
      elevationGainM: sumKnownMetric(performed, 'elevationGainM'),
      elevationLossM: null,
    },
    missingRequiredMetrics,
    sourceRecordIds,
  }
}
