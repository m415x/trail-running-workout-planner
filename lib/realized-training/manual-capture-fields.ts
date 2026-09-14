import type { RealizedTrainingCaptureMetric } from '@/types/training/realized-training-capture.types'

/** Convert device-local wall time to a UTC instant, rejecting normalized invalid dates/DST gaps. */
export function captureLocalInstant(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null
  const parsed = new Date(value)
  const parts = [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate(),
    parsed.getHours(), parsed.getMinutes(), parsed.getSeconds()]
  if (!parts.every((part, index) => part === Number(match[index + 1] ?? 0))) return null
  return parsed.toISOString()
}

/** Preserve seconds as fractional minutes; empty components do not imply known zero. */
export function captureDuration(hours: string, minutes: string, seconds: string): RealizedTrainingCaptureMetric {
  const fields = [hours, minutes, seconds].map(value => value.trim())
  if (fields.every(value => value === '')) return { state: 'unknown' }
  if (fields.some(value => value !== '' && !/^\d+$/.test(value)) || Number(seconds) > 59) {
    return { state: 'known', value: Number.NaN }
  }
  return { state: 'known', value: Number(hours) * 60 + Number(minutes) + Number(seconds) / 60 }
}
