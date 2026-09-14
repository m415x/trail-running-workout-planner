import type {
  ManualRealizedTrainingCaptureInput,
  RealizedTrainingCaptureField,
  RealizedTrainingCaptureMetric,
  RealizedTrainingCaptureValidationIssue,
  RealizedTrainingCaptureValidationResult,
} from '@/types/training/realized-training-capture.types'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Reject timezone-free and calendar-normalized timestamps at the durable boundary. */
export function isValidPerformedAt(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  if (!match || !isValidDateOnly(match[1])) return false
  return Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4]) < 60
    && (!match[6] || (Number(match[6]) < 24 && Number(match[7]) < 60))
    && Number.isFinite(Date.parse(value))
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function validateMetric(
  field: RealizedTrainingCaptureField,
  metric: RealizedTrainingCaptureMetric,
  issues: RealizedTrainingCaptureValidationIssue[],
  options: { readonly max?: number } = {},
) {
  if (metric.state === 'unknown') return

  if (!Number.isFinite(metric.value) || metric.value < 0) {
    issues.push({ field, code: 'invalid_number' })
    return
  }

  if (options.max !== undefined && metric.value > options.max) {
    issues.push({ field, code: 'out_of_range' })
  }
}

/**
 * Validates manual realized-training capture without normalizing unknown values
 * to numeric defaults. In particular, known zero remains valid and distinct
 * from an unknown metric.
 */
export function validateManualRealizedTrainingCapture(
  input: ManualRealizedTrainingCaptureInput,
): RealizedTrainingCaptureValidationResult {
  const issues: RealizedTrainingCaptureValidationIssue[] = []

  if (input.athleteId.trim().length === 0) {
    issues.push({ field: 'athleteId', code: 'required' })
  }

  if (!isValidDateOnly(input.date)) {
    issues.push({ field: 'date', code: 'invalid_date' })
  }

  if (!isValidPerformedAt(input.performedAt)) {
    issues.push({ field: 'performedAt', code: 'invalid_date' })
  }

  if (!['completed', 'partial', 'missed'].includes(input.status)) {
    issues.push({ field: 'status', code: 'required' })
  }

  validateMetric('distanceKm', input.metrics.distanceKm, issues)
  validateMetric('durationMin', input.metrics.durationMin, issues)
  validateMetric('elevationGainM', input.metrics.elevationGainM, issues)
  validateMetric('avgHrBpm', input.metrics.avgHrBpm, issues)
  validateMetric('rpe', input.metrics.rpe, issues, { max: 10 })

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, value: input }
}
