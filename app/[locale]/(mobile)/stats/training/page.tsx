import { ArrowLeft, Route } from 'lucide-react'

import { getCurrentAthleteStatsAction } from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import type { AthleteStatsDetails } from '@/lib/athlete-stats/athlete-stats-projections'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'

function comparisonText(comparison: AthleteStatsDetails['training']['distance']['comparison']) {
  if (comparison.state !== 'available') return 'Sin comparación disponible'
  const sign = comparison.absoluteDelta > 0 ? '+' : ''
  return `${sign}${comparison.absoluteDelta} respecto del período anterior`
}

export default async function TrainingStatsPage() {
  const period = athleteStatsSummaryPeriod()
  const result = await getCurrentAthleteStatsAction({ ...period, view: 'details' })
  if (result.status !== 'success' || !('series' in result.data.training)) return <p className='mx-auto max-w-5xl p-6 text-sm text-muted-foreground'>No pudimos cargar el detalle de entrenamiento.</p>

  const { training } = result.data
  const metrics = [
    ['Distancia', training.distance, 'km'],
    ['Duración', training.duration, 'min'],
    ['Desnivel', training.elevation, 'm'],
    ['Sesiones', training.frequency, 'sesiones'],
  ] as const

  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <Link href='/stats' className='mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />Estadísticas</Link>
    <header className='mb-6'><Route className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold sm:text-3xl'>Entrenamiento</h1><p className='mt-1 text-sm text-muted-foreground'>{result.data.period.startDate} — {result.data.period.endDate}</p></header>
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>{metrics.map(([label, metric, unit]) => <article key={label} className='rounded-2xl border bg-card p-4'><p className='text-xs text-muted-foreground'>{label}</p><p className='mt-1 text-xl font-bold'>{metric.value === null ? 'Sin datos' : `${metric.value} ${metric.value === 1 && unit === 'sesiones' ? 'sesión' : unit}`}</p><p className='mt-2 text-xs text-muted-foreground'>{comparisonText(metric.comparison)}</p></article>)}</div>
    <article className='mt-4 rounded-2xl border bg-card p-5'><h2 className='font-heading text-lg font-bold'>Actividad registrada</h2>{training.series.length === 0 ? <p className='mt-3 text-sm text-muted-foreground'>No hay actividad realizada registrada en este período.</p> : <div className='mt-4 space-y-3'>{training.series.map(point => <div key={point.date} className='grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-5'><strong>{point.date}</strong><span>{point.sessions} {point.sessions === 1 ? 'sesión' : 'sesiones'}</span><span>{point.distanceKm === null ? 'Distancia —' : `${point.distanceKm} km`}</span><span>{point.durationMin === null ? 'Duración —' : `${point.durationMin} min`}</span><span>{point.elevationGainM === null ? 'Desnivel —' : `${point.elevationGainM} m`}</span></div>)}</div>}</article>
  </section>
}
