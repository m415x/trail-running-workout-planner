import type {
  PlanRealMetricComparison,
  PlanRealMetricName,
  PlanRealMetricOperand,
} from '@/types/training/plan-real-comparison.types'
import type {
  SystematicVolumeDimension,
  SystematicVolumeInsufficientReason,
  SystematicVolumeMagnitude,
} from '@/types/training/systematic-volume-excess.types'

const DIMENSION_UNITS: Readonly<Record<SystematicVolumeDimension, string>> = {
  distanceKm: 'km',
  durationMin: 'min',
  elevationGainM: 'm',
}

export interface SystematicVolumeDimensionEvaluation {
  readonly dimension: SystematicVolumeDimension
  readonly evaluable: boolean
  readonly magnitude: SystematicVolumeMagnitude | null
  readonly insufficientReasons: readonly SystematicVolumeInsufficientReason[]
}

function readKnownNumber(operand: PlanRealMetricOperand): number | null {
  return operand.state === 'known' && typeof operand.value === 'number' ? operand.value : null
}

export function isSystematicVolumeDimension(
  metric: PlanRealMetricName,
): metric is SystematicVolumeDimension {
  return metric === 'distanceKm' || metric === 'durationMin' || metric === 'elevationGainM'
}

export function evaluateSystematicVolumeDimension(
  comparison: PlanRealMetricComparison,
): SystematicVolumeDimensionEvaluation | null {
  if (!isSystematicVolumeDimension(comparison.name)) return null

  const dimension = comparison.name
  const planned = readKnownNumber(comparison.planned)
  const realized = readKnownNumber(comparison.realized)
  const insufficientReasons: SystematicVolumeInsufficientReason[] = []

  if (planned === null) insufficientReasons.push('missing_planned_value')
  if (realized === null) insufficientReasons.push('missing_realized_value')

  if (
    comparison.planned.unit !== null &&
    comparison.realized.unit !== null &&
    comparison.planned.unit !== comparison.realized.unit
  ) {
    insufficientReasons.push('incompatible_units')
  }

  const expectedUnit = DIMENSION_UNITS[dimension]
  if (
    (comparison.planned.unit !== null && comparison.planned.unit !== expectedUnit) ||
    (comparison.realized.unit !== null && comparison.realized.unit !== expectedUnit)
  ) {
    insufficientReasons.push('incompatible_units')
  }

  if (insufficientReasons.length > 0 || planned === null || realized === null) {
    return {
      dimension,
      evaluable: false,
      magnitude: null,
      insufficientReasons: [...new Set(insufficientReasons)],
    }
  }

  const absoluteDelta = realized - planned

  return {
    dimension,
    evaluable: true,
    magnitude: {
      planned,
      realized,
      absoluteDelta,
      relativeDeltaPercent: planned > 0 ? (absoluteDelta / planned) * 100 : null,
    },
    insufficientReasons: [],
  }
}
