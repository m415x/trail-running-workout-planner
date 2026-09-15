import type {
  PlanRealMetricComparison,
  PlanRealMetricOperand,
  TrainingComparisonMetricName,
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
  metric: TrainingComparisonMetricName,
): metric is SystematicVolumeDimension {
  return metric === 'distanceKm' || metric === 'durationMin' || metric === 'elevationGainM'
}

export function evaluateSystematicVolumeDimension(
  comparison: PlanRealMetricComparison,
): SystematicVolumeDimensionEvaluation | null {
  if (!isSystematicVolumeDimension(comparison.name)) return null

  const dimension = comparison.name
  const plannedOperand = comparison.evaluation.planned
  const realizedOperand = comparison.evaluation.realized
  const planned = readKnownNumber(plannedOperand)
  const realized = readKnownNumber(realizedOperand)
  const insufficientReasons: SystematicVolumeInsufficientReason[] = []

  if (planned === null) insufficientReasons.push('missing_planned_value')
  if (realized === null) insufficientReasons.push('missing_realized_value')

  if (
    plannedOperand.unit !== null &&
    realizedOperand.unit !== null &&
    plannedOperand.unit !== realizedOperand.unit
  ) {
    insufficientReasons.push('incompatible_units')
  }

  const expectedUnit = DIMENSION_UNITS[dimension]
  if (
    (plannedOperand.unit !== null && plannedOperand.unit !== expectedUnit) ||
    (realizedOperand.unit !== null && realizedOperand.unit !== expectedUnit)
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
