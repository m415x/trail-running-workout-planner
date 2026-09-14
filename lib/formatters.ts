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

/** Formats decimal minutes as a human-readable duration, rounding to seconds. */
export function formatDurationMinutes(minutes: number): string {
  const totalSeconds = Math.max(0, Math.round(minutes * 60))
  const hours = Math.floor(totalSeconds / 3600)
  const remainingMinutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${remainingMinutes}:${String(seconds).padStart(2, '0')}`
}

export function paceToSpeed(secondsPerKm: number): string {
  if (secondsPerKm <= 0) return '0.00' // Avoid division by zero.

  const speed = 3600 / secondsPerKm
  return speed.toFixed(2)
}

export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
