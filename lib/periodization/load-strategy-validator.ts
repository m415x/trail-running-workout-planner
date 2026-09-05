import { GROUP_VOLUME_MATRIX } from '@/data/periodization-matrix'
import { assessElevationDensity } from '@/lib/periodization/elevation-density-validator'

import type { LoadStrategyDraft, LoadStrategyField } from '@/types'

export type LoadStrategyValidationSeverity = 'error' | 'warning'

export interface LoadStrategyValidationIssue {
  field: LoadStrategyField
  severity: LoadStrategyValidationSeverity
  code: string
  message: string
}

export interface LoadStrategyValidationResult {
  isValid: boolean
  errors: LoadStrategyValidationIssue[]
  warnings: LoadStrategyValidationIssue[]
}

const MAX_SESSIONS_PER_WEEK = 7
const MAX_WEEKLY_INCREASE_PERCENTAGE = 20
const RECOMMENDED_WEEKLY_INCREASE_PERCENTAGE = 10

function isFiniteNumber(value: number) {
  return Number.isFinite(value)
}

function issue(
  field: LoadStrategyField,
  severity: LoadStrategyValidationSeverity,
  code: string,
  message: string,
): LoadStrategyValidationIssue {
  return { field, severity, code, message }
}

export function validateLoadStrategy(strategy: LoadStrategyDraft): LoadStrategyValidationResult {
  const { context, values } = strategy
  const issues: LoadStrategyValidationIssue[] = []
  const groupRange = GROUP_VOLUME_MATRIX[context.athleteGroup].range

  if (!isFiniteNumber(values.initialWeeklyVolumeKm) || values.initialWeeklyVolumeKm <= 0) {
    issues.push(issue(
      'initialWeeklyVolumeKm',
      'error',
      'initial-volume-positive',
      'El volumen inicial debe ser mayor que 0 km por semana.',
    ))
  }

  if (!isFiniteNumber(values.maximumWeeklyVolumeKm) || values.maximumWeeklyVolumeKm <= 0) {
    issues.push(issue(
      'maximumWeeklyVolumeKm',
      'error',
      'maximum-volume-positive',
      'El volumen máximo debe ser mayor que 0 km por semana.',
    ))
  }

  if (values.initialWeeklyVolumeKm > values.maximumWeeklyVolumeKm) {
    issues.push(issue(
      'initialWeeklyVolumeKm',
      'error',
      'initial-volume-above-maximum',
      'El volumen inicial no puede superar el volumen máximo.',
    ))
  }

  if (
    values.initialWeeklyVolumeKm < groupRange.min
    || values.initialWeeklyVolumeKm > groupRange.max
  ) {
    issues.push(issue(
      'initialWeeklyVolumeKm',
      'warning',
      'initial-volume-outside-group-range',
      `El volumen inicial está fuera del rango de referencia de ${groupRange.min}-${groupRange.max} km/semana para el grupo ${context.athleteGroup}.`,
    ))
  }

  if (
    values.maximumWeeklyVolumeKm < groupRange.min
    || values.maximumWeeklyVolumeKm > groupRange.max
  ) {
    issues.push(issue(
      'maximumWeeklyVolumeKm',
      'warning',
      'maximum-volume-outside-group-range',
      `El volumen máximo está fuera del rango de referencia de ${groupRange.min}-${groupRange.max} km/semana para el grupo ${context.athleteGroup}.`,
    ))
  }

  if (!isFiniteNumber(values.sessionsPerWeek) || !Number.isInteger(values.sessionsPerWeek)) {
    issues.push(issue(
      'sessionsPerWeek',
      'error',
      'sessions-integer',
      'La cantidad de sesiones por semana debe ser un número entero.',
    ))
  } else if (values.sessionsPerWeek < 1 || values.sessionsPerWeek > MAX_SESSIONS_PER_WEEK) {
    issues.push(issue(
      'sessionsPerWeek',
      'error',
      'sessions-range',
      `La cantidad de sesiones por semana debe estar entre 1 y ${MAX_SESSIONS_PER_WEEK}.`,
    ))
  }

  if (
    !isFiniteNumber(values.maximumWeeklyIncreasePercentage)
    || values.maximumWeeklyIncreasePercentage <= 0
    || values.maximumWeeklyIncreasePercentage > MAX_WEEKLY_INCREASE_PERCENTAGE
  ) {
    issues.push(issue(
      'maximumWeeklyIncreasePercentage',
      'error',
      'weekly-increase-range',
      `El incremento semanal máximo debe ser mayor que 0% y no superar ${MAX_WEEKLY_INCREASE_PERCENTAGE}%.`,
    ))
  } else if (values.maximumWeeklyIncreasePercentage > RECOMMENDED_WEEKLY_INCREASE_PERCENTAGE) {
    issues.push(issue(
      'maximumWeeklyIncreasePercentage',
      'warning',
      'weekly-increase-above-reference',
      `El incremento semanal supera la referencia conservadora de ${RECOMMENDED_WEEKLY_INCREASE_PERCENTAGE}%. El profesor puede mantenerlo si responde a una decisión planificada.`,
    ))
  }

  if (
    !isFiniteNumber(values.deloadPercentage)
    || values.deloadPercentage <= 0
    || values.deloadPercentage >= 100
  ) {
    issues.push(issue(
      'deloadPercentage',
      'error',
      'deload-range',
      'La descarga debe ser mayor que 0% y menor que 100%.',
    ))
  }

  if (
    values.initialWeeklyElevationGain !== null
    && (!isFiniteNumber(values.initialWeeklyElevationGain) || values.initialWeeklyElevationGain < 0)
  ) {
    issues.push(issue(
      'initialWeeklyElevationGain',
      'error',
      'initial-elevation-non-negative',
      'El desnivel inicial no puede ser negativo.',
    ))
  }

  if (
    values.initialWeeklyElevationGain !== null
    && Number.isInteger(values.initialWeeklyElevationGain)
    && values.initialWeeklyElevationGain >= 0
    && isFiniteNumber(values.initialWeeklyVolumeKm)
    && values.initialWeeklyVolumeKm > 0
  ) {
    const assessment = assessElevationDensity(
      values.initialWeeklyVolumeKm,
      values.initialWeeklyElevationGain,
    )

    if (assessment.warning) {
      issues.push(issue(
        'initialWeeklyElevationGain',
        'warning',
        `initial-elevation-density-${assessment.level}`,
        assessment.warning,
      ))
    }
  }

  if (
    values.maximumWeeklyElevationGain !== null
    && Number.isInteger(values.maximumWeeklyElevationGain)
    && values.maximumWeeklyElevationGain >= 0
    && isFiniteNumber(values.maximumWeeklyVolumeKm)
    && values.maximumWeeklyVolumeKm > 0
  ) {
    const assessment = assessElevationDensity(
      values.maximumWeeklyVolumeKm,
      values.maximumWeeklyElevationGain,
    )

    if (assessment.warning) {
      issues.push(issue(
        'maximumWeeklyElevationGain',
        'warning',
        `maximum-elevation-density-${assessment.level}`,
        assessment.warning,
      ))
    }
  }

  if (
    values.maximumWeeklyElevationGain !== null
    && (!isFiniteNumber(values.maximumWeeklyElevationGain) || values.maximumWeeklyElevationGain < 0)
  ) {
    issues.push(issue(
      'maximumWeeklyElevationGain',
      'error',
      'maximum-elevation-non-negative',
      'El desnivel máximo no puede ser negativo.',
    ))
  }

  if (
    (values.initialWeeklyElevationGain === null)
    !== (values.maximumWeeklyElevationGain === null)
  ) {
    issues.push(issue(
      values.initialWeeklyElevationGain === null
        ? 'initialWeeklyElevationGain'
        : 'maximumWeeklyElevationGain',
      'error',
      'incomplete-elevation-range',
      'El desnivel inicial y máximo deben informarse juntos o dejarse ambos vacíos.',
    ))
  }

  if (
    values.initialWeeklyElevationGain !== null
    && values.maximumWeeklyElevationGain !== null
    && values.initialWeeklyElevationGain > values.maximumWeeklyElevationGain
  ) {
    issues.push(issue(
      'initialWeeklyElevationGain',
      'error',
      'initial-elevation-above-maximum',
      'El desnivel inicial no puede superar el desnivel máximo.',
    ))
  }

  const errors = issues.filter((currentIssue) => currentIssue.severity === 'error')
  const warnings = issues.filter((currentIssue) => currentIssue.severity === 'warning')

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}
