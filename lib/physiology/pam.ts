/**
 * Convierte segundos a formato de ritmo min:seg/km (ej: 215 -> "3:35/km")
 */
export function formatPaceFromSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const remainingSecs = Math.round(seconds % 60)
  return `${mins}:${remainingSecs.toString().padStart(2, '0')}/km`
}

/**
 * Calcula la velocidad PAM en km/h a partir del tiempo en los 1000m
 */
export function calculatePamSpeed(secondsFor1000m: number): number {
  if (secondsFor1000m <= 0) return 0
  const speed = 3600 / secondsFor1000m
  return Number(speed.toFixed(2))
}

/**
 * Calcula el ritmo objetivo para un porcentaje específico de PAM (ej: 110% PAM para pasadas)
 */
export function calculatePaceAtPamPercentage(
  pamSecondsFor1000m: number,
  percentage: number, // ej: 1.10 para 110%
): { paceSeconds: number; paceLabel: string } {
  // A mayor porcentaje PAM, menor tiempo por km (mayor velocidad)
  const targetSeconds = pamSecondsFor1000m / percentage
  return {
    paceSeconds: Math.round(targetSeconds),
    paceLabel: formatPaceFromSeconds(targetSeconds),
  }
}
