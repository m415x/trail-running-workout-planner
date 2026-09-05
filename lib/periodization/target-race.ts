import type { TargetRaceSnapshot, TrainingGoalType } from '@/types'

export interface TargetRaceFormValues {
  name?: string | null
  distanceKm?: string | number | null
  elevationGain?: string | number | null
}

/**
 * Validates and normalizes the optional race context of a group macrocycle.
 *
 * The returned object is a snapshot owned by the group plan, not a reference
 * to an athlete's individual goal. Distance is measured in kilometers and D+
 * in positive integer meters.
 *
 * @throws {Error} When a race goal lacks a name or valid distance, or when its
 * optional elevation gain is not a non-negative integer.
 */
export function resolveTargetRace(
  goalType: TrainingGoalType,
  values: TargetRaceFormValues = {},
): TargetRaceSnapshot | null {
  if (goalType !== 'race') return null

  const name = values.name?.trim() ?? ''
  const distanceKm = typeof values.distanceKm === 'number'
    ? values.distanceKm
    : Number(values.distanceKm)
  const hasElevation = values.elevationGain !== undefined
    && values.elevationGain !== null
    && values.elevationGain !== ''
  const elevationGain = hasElevation
    ? Number(values.elevationGain)
    : undefined

  if (!name) {
    throw new Error('Ingresá el nombre de la carrera objetivo.')
  }

  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error('La distancia de la carrera debe ser mayor que cero.')
  }

  if (
    elevationGain !== undefined
    && (!Number.isInteger(elevationGain) || elevationGain < 0)
  ) {
    throw new Error('El desnivel de la carrera debe ser un entero no negativo.')
  }

  return {
    name,
    distanceKm,
    ...(elevationGain === undefined ? {} : { elevationGain }),
  }
}
