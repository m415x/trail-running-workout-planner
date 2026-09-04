import { GROUP_VOLUME_MATRIX } from '@/data/periodization-matrix'

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

  if (values.initialWeeklyVolumeKm <= 0) {
    issues.push(issue(
      'initialWeeklyVolumeKm',
      'error',
      'initial-volume-positive',
      'El volumen inicial debe ser mayor que 0 km por semana.',
    ))
  }

  if (values.maximumWeeklyVolumeKm <= 0) {
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

  if (!Number.isInteger(values.sessionsPerWeek)) {
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
    values.maximumWeeklyIncreasePercentage <= 0
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

  if (values.deloadPercentage <= 0 || values.deloadPercentage >= 100) {
    issues.push(issue(
      'deloadPercentage',
      'error',
      'deload-range',
      'La descarga debe ser mayor que 0% y menor que 100%.',
    ))
  }

  if (values.initialWeeklyElevationGain !== null && values.initialWeeklyElevationGain < 0) {
    issues.push(issue(
      'initialWeeklyElevationGain',
      'error',
      'initial-elevation-non-negative',
      'El desnivel inicial no puede ser negativo.',
    ))
  }

  if (values.maximumWeeklyElevationGain !== null && values.maximumWeeklyElevationGain < 0) {
    issues.push(issue(
      'maximumWeeklyElevationGain',
      'error',
      'maximum-elevation-non-negative',
      'El desnivel máximo no puede ser negativo.',
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
