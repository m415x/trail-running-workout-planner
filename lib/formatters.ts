export function formatGain(gain: number): string {
  return gain > 0 ? `+${gain}` : `${gain}`
}

export function formatPace(secondsPerKm: number): string {
  const totalSecondsRounded = Math.round(secondsPerKm)

  const minutes = Math.floor(totalSecondsRounded / 60)
  const remainingSeconds = totalSecondsRounded % 60

  const formattedSeconds = remainingSeconds.toString().padStart(2, '0')

  return `${minutes}:${formattedSeconds}`
}

export function paceToSpeed(secondsPerKm: number): string {
  if (secondsPerKm <= 0) return '0.00' // Evita la división por cero

  const speed = 3600 / secondsPerKm
  return speed.toFixed(2)
}

export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
