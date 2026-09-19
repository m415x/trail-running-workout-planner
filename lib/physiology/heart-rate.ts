import { IntensityZone } from '@/types'
import { HR_ZONES } from '@/lib/constants'

export interface AthleteHeartRateParams {
  maxHr?: number
  restHr?: number
}

function assertValidMaxHr(maxHr: number | undefined): asserts maxHr is number {
  if (maxHr === undefined || !Number.isFinite(maxHr) || maxHr <= 0) {
    throw new Error('Maximum heart rate is required')
  }
}

/**
 * Calculates a target heart rate with the Karvonen method.
 * Resting HR is required: this function never substitutes a population default.
 */
export function calculateKarvonenBpm(
  intensityPct: number,
  maxHr: number,
  restHr?: number,
): number {
  assertValidMaxHr(maxHr)
  if (
    restHr === undefined ||
    !Number.isFinite(restHr) ||
    restHr <= 0 ||
    restHr >= maxHr
  ) {
    throw new Error('Resting heart rate is required for Karvonen')
  }

  const heartRateReserve = maxHr - restHr
  return Math.round(restHr + heartRateReserve * intensityPct)
}

/**
 * Resolves a zone BPM range from explicit HR evidence.
 * When resting HR is unavailable, uses %HRmax rather than fabricating HRR/Karvonen.
 */
export function getZoneBpmRange(
  zone: IntensityZone,
  { maxHr, restHr }: AthleteHeartRateParams,
): { minBpm: number; maxBpm: number } {
  assertValidMaxHr(maxHr)

  const zoneInfo = HR_ZONES[zone] ?? HR_ZONES.Z1
  const [minPctStr, maxPctStr] = zoneInfo.pct.replace(/%/g, '').split('-')
  const minPct = Number(minPctStr) / 100
  const maxPct = Number(maxPctStr) / 100
  const hasValidRestHr =
    restHr !== undefined &&
    Number.isFinite(restHr) &&
    restHr > 0 &&
    restHr < maxHr

  return {
    minBpm: hasValidRestHr
      ? calculateKarvonenBpm(minPct, maxHr, restHr)
      : Math.round(maxHr * minPct),
    maxBpm: hasValidRestHr
      ? calculateKarvonenBpm(maxPct, maxHr, restHr)
      : Math.round(maxHr * maxPct),
  }
}
