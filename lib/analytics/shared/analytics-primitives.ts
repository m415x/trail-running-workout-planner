export interface AnalyticsWindow {
  readonly startDate: string
  readonly endDate: string
}

export interface ComparableAnalyticsWindows {
  readonly current: AnalyticsWindow
  readonly previous: AnalyticsWindow
}

export type AnalyticsEvidenceValue =
  | { readonly state: 'available'; readonly value: number }
  | { readonly state: 'unknown' }
  | { readonly state: 'insufficient_data' }

export type AnalyticsTrendDirection =
  | 'increasing'
  | 'stable'
  | 'decreasing'
  | 'unknown'

export type AnalyticsMetricComparison =
  | {
      readonly state: 'available'
      readonly currentValue: number
      readonly previousValue: number
      readonly absoluteDelta: number
      readonly relativeDeltaPercent: number | null
      readonly direction: Exclude<AnalyticsTrendDirection, 'unknown'>
    }
  | {
      readonly state: 'not_evaluable'
      readonly currentValue: number | null
      readonly previousValue: number | null
      readonly absoluteDelta: null
      readonly relativeDeltaPercent: null
      readonly direction: 'unknown'
      readonly reason:
        | 'current_unknown'
        | 'current_insufficient_data'
        | 'previous_unknown'
        | 'previous_insufficient_data'
    }

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseUtcDate(date: string): Date {
  if (!ISO_DATE_PATTERN.test(date)) {
    throw new Error('analytics-window-invalid-date')
  }

  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('analytics-window-invalid-date')
  }

  return parsed
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function buildComparableWindows(current: AnalyticsWindow): ComparableAnalyticsWindows {
  const start = parseUtcDate(current.startDate)
  const end = parseUtcDate(current.endDate)

  if (start.getTime() > end.getTime()) {
    throw new Error('analytics-window-reversed')
  }

  const dayMs = 24 * 60 * 60 * 1000
  const windowDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1
  const previousEnd = new Date(start.getTime() - dayMs)
  const previousStart = new Date(previousEnd.getTime() - (windowDays - 1) * dayMs)

  return {
    current: { ...current },
    previous: {
      startDate: formatUtcDate(previousStart),
      endDate: formatUtcDate(previousEnd),
    },
  }
}

export function compareAnalyticsMetric(
  current: AnalyticsEvidenceValue,
  previous: AnalyticsEvidenceValue,
): AnalyticsMetricComparison {
  if (current.state !== 'available') {
    return {
      state: 'not_evaluable',
      currentValue: null,
      previousValue: previous.state === 'available' ? previous.value : null,
      absoluteDelta: null,
      relativeDeltaPercent: null,
      direction: 'unknown',
      reason: current.state === 'unknown' ? 'current_unknown' : 'current_insufficient_data',
    }
  }

  if (previous.state !== 'available') {
    return {
      state: 'not_evaluable',
      currentValue: current.value,
      previousValue: null,
      absoluteDelta: null,
      relativeDeltaPercent: null,
      direction: 'unknown',
      reason: previous.state === 'unknown' ? 'previous_unknown' : 'previous_insufficient_data',
    }
  }

  if (!Number.isFinite(current.value) || !Number.isFinite(previous.value)) {
    throw new Error('analytics-metric-non-finite')
  }

  const absoluteDelta = current.value - previous.value

  return {
    state: 'available',
    currentValue: current.value,
    previousValue: previous.value,
    absoluteDelta,
    relativeDeltaPercent:
      previous.value === 0 ? null : (absoluteDelta / previous.value) * 100,
    direction:
      absoluteDelta > 0
        ? 'increasing'
        : absoluteDelta < 0
          ? 'decreasing'
          : 'stable',
  }
}
