import type { GeneratedMacrocycleDraft, TargetValueSource } from '@/types'

const TARGET_SOURCES = new Set<TargetValueSource>(['generated', 'manual'])

/**
 * Validates the complete generated planning graph before any database write.
 *
 * Persistence boundaries must not rely exclusively on TypeScript because form
 * data, stale clients or future integrations can provide malformed runtime
 * values. The function throws before a transaction begins, preventing partial
 * plans and ambiguous week identities.
 */
export function assertPersistablePlanning(planning: GeneratedMacrocycleDraft) {
  if (planning.mesocycles.length === 0) {
    throw new Error('La planificación debe contener al menos un mesociclo.')
  }

  const mesocycleNumbers = new Set<number>()
  const weekNumbers = new Set<number>()

  for (const mesocycle of planning.mesocycles) {
    if (!Number.isInteger(mesocycle.number) || mesocycle.number < 1) {
      throw new Error('Los números de mesociclo deben ser enteros mayores que cero.')
    }

    if (mesocycleNumbers.has(mesocycle.number)) {
      throw new Error(`El mesociclo ${mesocycle.number} está duplicado en la propuesta.`)
    }
    mesocycleNumbers.add(mesocycle.number)

    if (mesocycle.microcycles.length === 0) {
      throw new Error(`El mesociclo ${mesocycle.number} no contiene microciclos.`)
    }

    for (const microcycle of mesocycle.microcycles) {
      if (!Number.isInteger(microcycle.weekNumber) || microcycle.weekNumber < 1) {
        throw new Error('Los números de semana deben ser enteros mayores que cero.')
      }

      if (weekNumbers.has(microcycle.weekNumber)) {
        throw new Error(`La semana ${microcycle.weekNumber} está duplicada en la propuesta.`)
      }
      weekNumbers.add(microcycle.weekNumber)

      if (!Number.isFinite(microcycle.targetVolumeKm) || microcycle.targetVolumeKm < 0) {
        throw new Error(`El volumen de la semana ${microcycle.weekNumber} no es válido.`)
      }

      if (!TARGET_SOURCES.has(microcycle.targetVolumeSource)) {
        throw new Error(`El origen del volumen de la semana ${microcycle.weekNumber} no es válido.`)
      }

      if (
        microcycle.targetElevationGain !== null
        && (!Number.isInteger(microcycle.targetElevationGain) || microcycle.targetElevationGain < 0)
      ) {
        throw new Error(`El D+ de la semana ${microcycle.weekNumber} no es válido.`)
      }

      if (!TARGET_SOURCES.has(microcycle.targetElevationSource)) {
        throw new Error(`El origen del D+ de la semana ${microcycle.weekNumber} no es válido.`)
      }
    }
  }
}
