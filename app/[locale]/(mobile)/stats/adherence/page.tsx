import { ArrowLeft, ChartNoAxesColumnIncreasing } from 'lucide-react'

import { getCurrentAthleteStatsAction } from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'

export default async function AdherenceStatsPage() {
  const period = athleteStatsSummaryPeriod()
  const result = await getCurrentAthleteStatsAction({ ...period, view: 'details' })
  if (result.status !== 'success' || !('eligiblePlannedSessions' in result.data.adherence)) return <p className='mx-auto max-w-5xl p-6 text-sm text-muted-foreground'>No pudimos cargar el detalle de adherencia.</p>

  const { adherence } = result.data
  const evidence = [
    ['Sesiones planificadas elegibles', adherence.eligiblePlannedSessions],
    ['Resultados confirmados', adherence.confirmedOutcomeSessions],
    ['Resultado desconocido', adherence.unknownSessions],
  ] as const

  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <Link href='/stats' className='mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />Estadísticas</Link>
    <header className='mb-6'><ChartNoAxesColumnIncreasing className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold sm:text-3xl'>Adherencia</h1><p className='mt-1 text-sm text-muted-foreground'>{result.data.period.startDate} — {result.data.period.endDate}</p></header>
    <article className='rounded-2xl border bg-card p-5'><p className='text-xs text-muted-foreground'>Adherencia confirmada</p><p className={adherence.value === null ? 'mt-1 text-base font-semibold text-muted-foreground' : 'mt-1 text-2xl font-bold'}>{adherence.value === null ? 'Datos insuficientes' : `${adherence.value}%`}</p><p className='mt-2 text-sm text-muted-foreground'>Cobertura: {adherence.coveragePercent === null ? 'sin datos' : `${adherence.coveragePercent}%`}</p></article>
    <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3'>{evidence.map(([label, value]) => <article key={label} className='rounded-2xl border bg-card p-4'><p className='text-xs text-muted-foreground'>{label}</p><p className='mt-1 text-xl font-bold'>{value}</p></article>)}</div>
    <p className='mt-4 rounded-2xl bg-muted/50 p-4 text-sm text-muted-foreground'>Las sesiones con resultado desconocido se muestran separadas y no se cuentan como sesiones no completadas.</p>
  </section>
}
