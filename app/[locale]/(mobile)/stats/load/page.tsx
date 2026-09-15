import { ArrowLeft, Gauge } from 'lucide-react'

import { getCurrentAthleteStatsAction } from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'

export default async function LoadStatsPage() {
  const period = athleteStatsSummaryPeriod()
  const result = await getCurrentAthleteStatsAction({ ...period, view: 'details' })
  if (result.status !== 'success' || !('trend' in result.data.load)) return <p className='mx-auto max-w-5xl p-6 text-sm text-muted-foreground'>No pudimos cargar el detalle de carga.</p>

  const { load } = result.data
  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <Link href='/stats' className='mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />Estadísticas</Link>
    <header className='mb-6'><Gauge className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold sm:text-3xl'>Carga</h1><p className='mt-1 text-sm text-muted-foreground'>{result.data.period.startDate} — {result.data.period.endDate}</p></header>
    {load.state === 'available' ? <>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>{[['Carga de corto plazo', load.shortTermLoadAu], ['Carga de largo plazo', load.longTermLoadAu], ['Balance de carga', load.loadBalanceAu]].map(([label, value]) => <article key={label} className='rounded-2xl border bg-card p-4'><p className='text-xs text-muted-foreground'>{label}</p><p className='mt-1 text-xl font-bold'>{value === null ? 'Sin datos' : `${value} AU`}</p></article>)}</div>
      <article className='mt-4 rounded-2xl border bg-card p-5'><h2 className='font-heading text-lg font-bold'>Evolución registrada</h2><p className='mt-1 text-sm text-muted-foreground'>Cobertura: {load.coverageRatio === null ? 'sin datos' : `${Math.round(load.coverageRatio * 100)}%`}</p><div className='mt-4 space-y-2'>{load.trend.map(point => <div key={point.date} className='grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-5'><strong>{point.date}</strong><span>Diaria {point.dailyLoadAu ?? '—'} AU</span><span>Corto {point.shortTermLoadAu ?? '—'} AU</span><span>Largo {point.longTermLoadAu ?? '—'} AU</span><span>Balance {point.loadBalanceAu ?? '—'} AU</span></div>)}</div></article>
    </> : <article className='rounded-2xl border bg-card p-5'><h2 className='text-base font-semibold text-muted-foreground'>Datos insuficientes</h2><p className='mt-2 text-sm text-muted-foreground'>Cobertura: {load.coverageRatio === null ? 'sin datos' : `${Math.round(load.coverageRatio * 100)}%`}</p></article>}
  </section>
}
