export type ElevationDensityLevel = 'runnable' | 'standard' | 'high' | 'extreme'

export interface ElevationDensityAssessment {
  metersPerKm: number
  level: ElevationDensityLevel
  warning: string | null
}

const STANDARD_DENSITY_METERS_PER_KM = 30
const HIGH_DENSITY_METERS_PER_KM = 50
const EXTREME_DENSITY_METERS_PER_KM = 200

/**
 * Evaluates the vertical density of a weekly target or race course.
 *
 * Distance is expressed in kilometers and elevation gain in positive meters.
 * High and extreme combinations produce advisory warnings rather than errors,
 * because steep trail events and deliberate mountain blocks can be valid coach
 * decisions. Structurally invalid numeric values are rejected.
 *
 * @throws {Error} When distance is not positive or elevation is not a
 * non-negative integer.
 */
export function assessElevationDensity(
  distanceKm: number,
  elevationGainM: number,
): ElevationDensityAssessment {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
    throw new Error('La distancia debe ser mayor que cero para calcular la densidad vertical.')
  }

  if (!Number.isInteger(elevationGainM) || elevationGainM < 0) {
    throw new Error('El desnivel debe ser un entero no negativo.')
  }

  const metersPerKm = Math.round((elevationGainM / distanceKm) * 10) / 10

  if (metersPerKm >= EXTREME_DENSITY_METERS_PER_KM) {
    return {
      metersPerKm,
      level: 'extreme',
      warning: `La densidad vertical es extrema (${metersPerKm.toLocaleString('es-AR')} m+/km). Verificá que distancia y desnivel sean correctos.`,
    }
  }

  if (metersPerKm >= HIGH_DENSITY_METERS_PER_KM) {
    return {
      metersPerKm,
      level: 'high',
      warning: `La densidad vertical es alta (${metersPerKm.toLocaleString('es-AR')} m+/km). Confirmá que responde a un objetivo de montaña deliberado.`,
    }
  }

  return {
    metersPerKm,
    level: metersPerKm < STANDARD_DENSITY_METERS_PER_KM ? 'runnable' : 'standard',
    warning: null,
  }
}
