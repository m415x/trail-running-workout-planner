import type { AthleteStatsSummary } from '@/lib/athlete-stats/athlete-stats-projections'

type SummaryMetricKey = 'distance' | 'duration' | 'elevation' | 'sessions'

interface SummaryMetricView {
  readonly key: SummaryMetricKey
  readonly state: 'available' | 'unknown'
  readonly value: number | null
  readonly unit: string
}

export interface AthleteStatsSummaryView {
  readonly period: AthleteStatsSummary['period']
  readonly training: { readonly href: '/stats/training'; readonly metrics: readonly SummaryMetricView[] }
  readonly load: { readonly href: '/stats/load'; readonly state: 'available' | 'insufficient_data'; readonly value: number | null; readonly unit: 'AU' }
  readonly adherence: { readonly href: '/stats/adherence'; readonly state: 'available' | 'insufficient_data'; readonly value: number | null; readonly unit: '%' }
  readonly competition: { readonly href: '/stats/competition'; readonly state: 'available' | 'none'; readonly name: string | null; readonly date: string | null }
}

function metric(key: Exclude<SummaryMetricKey, 'sessions'>, source: AthleteStatsSummary['training']['distance']): SummaryMetricView {
  return { key, state: source.state, value: source.state === 'available' ? source.value : null, unit: source.unit }
}

export function buildAthleteStatsSummaryView(summary: AthleteStatsSummary): AthleteStatsSummaryView {
  return {
    period: summary.period,
    training: {
      href: '/stats/training',
      metrics: [
        metric('distance', summary.training.distance),
        metric('duration', summary.training.duration),
        metric('elevation', summary.training.elevation),
        { key: 'sessions', state: summary.training.frequency.state, value: summary.training.frequency.state === 'available' ? summary.training.frequency.value : null, unit: summary.training.frequency.unit },
      ],
    },
    load: {
      href: '/stats/load',
      state: summary.load.state,
      value: summary.load.state === 'available' ? summary.load.shortTermLoadAu : null,
      unit: 'AU',
    },
    adherence: {
      href: '/stats/adherence',
      state: summary.adherence.state,
      value: summary.adherence.state === 'available' ? summary.adherence.value : null,
      unit: '%',
    },
    competition: summary.competition
      ? { href: '/stats/competition', state: 'available', name: summary.competition.name, date: summary.competition.date }
      : { href: '/stats/competition', state: 'none', name: null, date: null },
  }
}
