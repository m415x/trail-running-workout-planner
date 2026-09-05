import { WORKOUT_TYPES_CONFIG } from '@/lib/constants'

import type {
  IntensityZone,
  WorkoutTemplateDraft,
  WorkoutTemplatePrescriptionDefaults,
} from '@/types'

export type WorkoutTemplateDefaultField =
  | 'teamId'
  | 'title'
  | 'type'
  | 'structure'
  | 'distanceKm'
  | 'durationMin'
  | 'elevationGain'
  | 'intensity'

export interface WorkoutTemplateDefaultIssue {
  field: WorkoutTemplateDefaultField
  code: string
  message: string
}

export interface WorkoutTemplateDefaultsValidationResult {
  isValid: boolean
  errors: WorkoutTemplateDefaultIssue[]
}

const INTENSITY_ZONES = new Set<IntensityZone>(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
const STRUCTURE_FIELDS = [
  'preliminaryExercises',
  'warmup',
  'mainBlock',
  'cooldown',
] as const

function issue(
  field: WorkoutTemplateDefaultField,
  code: string,
  message: string,
): WorkoutTemplateDefaultIssue {
  return { field, code, message }
}

function validateOptionalVolume(
  defaults: WorkoutTemplatePrescriptionDefaults,
  errors: WorkoutTemplateDefaultIssue[],
) {
  const { distanceKm, durationMin, elevationGain } = defaults

  if (
    distanceKm !== undefined
    && distanceKm !== null
    && (!Number.isFinite(distanceKm) || distanceKm < 0)
  ) {
    errors.push(issue(
      'distanceKm',
      'distance-non-negative',
      'La distancia predeterminada debe ser un número no negativo en kilómetros.',
    ))
  }

  if (
    durationMin !== undefined
    && durationMin !== null
    && (!Number.isInteger(durationMin) || durationMin < 0)
  ) {
    errors.push(issue(
      'durationMin',
      'duration-non-negative-integer',
      'La duración predeterminada debe ser un entero no negativo en minutos.',
    ))
  }

  if (
    elevationGain !== undefined
    && elevationGain !== null
    && (!Number.isInteger(elevationGain) || elevationGain < 0)
  ) {
    errors.push(issue(
      'elevationGain',
      'elevation-non-negative-integer',
      'El desnivel predeterminado debe ser un entero no negativo en metros.',
    ))
  }
}

function validateOptionalIntensity(
  defaults: WorkoutTemplatePrescriptionDefaults,
  errors: WorkoutTemplateDefaultIssue[],
) {
  const { intensity } = defaults
  if (intensity === null) return

  if (intensity.method === 'hr_zone') {
    if (!INTENSITY_ZONES.has(intensity.zone)) {
      errors.push(issue(
        'intensity',
        'intensity-zone',
        'La intensidad por frecuencia cardíaca requiere una zona válida.',
      ))
    }
    return
  }

  if (
    intensity.method !== 'pam_percentage'
    || !Number.isFinite(intensity.pamPercentage)
    || intensity.pamPercentage <= 0
    || intensity.pamPercentage > 200
  ) {
    errors.push(issue(
      'intensity',
      'intensity-pam-range',
      'La intensidad PAM debe ser un porcentaje mayor que 0 y menor o igual a 200.',
    ))
  }
}

/**
 * Validates the reusable session and prescription defaults of a template.
 *
 * Templates may be instruction-only, so volume and intensity are optional.
 * Explicit zero values are accepted, while missing values remain null or
 * undefined. Distance uses kilometers, duration minutes and D+ positive meters.
 */
export function validateWorkoutTemplateDefaults(
  template: WorkoutTemplateDraft,
): WorkoutTemplateDefaultsValidationResult {
  const errors: WorkoutTemplateDefaultIssue[] = []
  const { sessionDefaults, prescriptionDefaults } = template

  if (!template.teamId.trim()) {
    errors.push(issue('teamId', 'team-required', 'La plantilla debe pertenecer a un equipo.'))
  }

  const title = sessionDefaults.title.trim()
  if (title.length < 2 || title.length > 120) {
    errors.push(issue(
      'title',
      'title-length',
      'El título debe tener entre 2 y 120 caracteres.',
    ))
  }

  if (!(sessionDefaults.type in WORKOUT_TYPES_CONFIG)) {
    errors.push(issue('type', 'type-invalid', 'Seleccioná un tipo de entrenamiento válido.'))
  }

  for (const field of STRUCTURE_FIELDS) {
    const value = sessionDefaults.structure?.[field]
    if (typeof value === 'string' && !value.trim()) {
      errors.push(issue(
        'structure',
        'structure-empty-block',
        'Los bloques vacíos deben guardarse como nulos.',
      ))
      break
    }
  }

  validateOptionalVolume(prescriptionDefaults, errors)
  validateOptionalIntensity(prescriptionDefaults, errors)

  return {
    isValid: errors.length === 0,
    errors,
  }
}
