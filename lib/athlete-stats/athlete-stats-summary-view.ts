import type { AthleteStatsSummary } from '@/lib/athlete-stats/athlete-stats-projections'

interface SummaryMetricView {
  readonly label: string
  readonly state: 'available' | 'unknown'
  readonly displayValue: string | null
}

export interface AthleteStatsSummaryView {
  readonly period: AthleteStatsSummary['period']
  readonly training: { readonly href: '/stats/training'; readonly metrics: readonly SummaryMetricView[] }
  readonly load: { readonly href: '/stats/load'; readonly state: 'available' | 'insufficient_data'; readonly displayValue: string | null }
  readonly adherence: { readonly href: '/stats/adherence'; readonly state: 'available' | 'insufficient_data'; readonly displayValue: string | null }
  readonly competition: { readonly href: '/stats/competition'; readonly state: 'available' | 'none'; readonly name: string | null; readonly date: string | null }
}

function metric(label: string, source: AthleteStatsSummary['training']['distance'] | AthleteStatsSummary['training']['frequency']): SummaryMetricView {
  return {
    label,
    state: source.state,
    displayValue: source.state === 'available' ? `${source.value} ${source.unit}` : null,
  }
}

export function buildAthleteStatsSummaryView(summary: AthleteStatsSummary): AthleteStatsSummaryView {
  return {
    period: summary.period,
    training: {
      href: '/stats/training',
      metrics: [
        metric('Distancia', summary.training.distance),
        metric('Duración', summary.training.duration),
        metric('Desnivel', summary.training.elevation),
        metric('Sesiones', summary.training.frequency),
      ],
    },
    load: {
      href: '/stats/load',
      state: summary.load.state,
      displayValue: summary.load.state === 'available' && summary.load.shortTermLoadAu !== null
        ? `${summary.load.shortTermLoadAu} AU`
        : null,
    },
    adherence: {
      href: '/stats/adherence',
      state: summary.adherence.state,
      displayValue: summary.adherence.state === 'available' && summary.adherence.value !== null
        ? `${summary.adherence.value}%`
        : null,
    },
    competition: summary.competition
      ? { href: '/stats/competition', state: 'available', name: summary.competition.name, date: summary.competition.date }
      : { href: '/stats/competition', state: 'none', name: null, date: null },
  }
}
