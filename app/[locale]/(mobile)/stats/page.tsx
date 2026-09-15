import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, Gauge, Mountain, Route } from 'lucide-react'

import { getCurrentAthleteStatsAction } from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import type { AthleteStatsDetails, AthleteStatsSummary } from '@/lib/athlete-stats/athlete-stats-projections'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'
import { buildAthleteStatsSummaryView } from '@/lib/athlete-stats/athlete-stats-summary-view'

const stateText = {
  unknown: 'Sin datos suficientes',
  insufficient_data: 'Datos insuficientes',
} as const

function DomainLink({ href, children }: { href: '/stats/training' | '/stats/load' | '/stats/adherence' | '/stats/competition'; children: React.ReactNode }) {
  return (
    <Link href={href} className='inline-flex items-center gap-1 text-sm font-semibold text-primary'>
      {children}<ArrowRight className='size-4' />
    </Link>
  )
}

function isSummary(data: AthleteStatsSummary | AthleteStatsDetails): data is AthleteStatsSummary {
  return data.competition === null || !('primaryCompetition' in data.competition)
}

export default async function StatsPage() {
  const period = athleteStatsSummaryPeriod()
  const result = await getCurrentAthleteStatsAction({ ...period, view: 'summary' })

  if (result.status !== 'success' || !isSummary(result.data)) {
    return (
      <section className='mx-auto w-full max-w-5xl px-4 py-8 sm:px-6'>
        <h1 className='font-heading text-2xl font-bold'>Estadísticas</h1>
        <p className='mt-4 rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>
          No pudimos cargar tus estadísticas en este momento.
        </p>
      </section>
    )
  }

  const view = buildAthleteStatsSummaryView(result.data)

  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
      <header className='mb-6'>
        <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>Últimos 28 días</p>
        <h1 className='mt-1 font-heading text-2xl font-bold sm:text-3xl'>Estadísticas</h1>
        <p className='mt-1 text-sm text-muted-foreground'>{view.period.startDate} — {view.period.endDate}</p>
      </header>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        <article className='rounded-2xl border bg-card p-5 shadow-sm md:col-span-2'>
          <div className='mb-4 flex items-start justify-between gap-3'>
            <div><Route className='mb-2 size-5' /><h2 className='font-heading text-lg font-bold'>Entrenamiento</h2></div>
            <DomainLink href={view.training.href}>Ver detalle</DomainLink>
          </div>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            {view.training.metrics.map(item => (
              <div key={item.label} className='rounded-xl bg-muted/50 p-3'>
                <p className='text-xs text-muted-foreground'>{item.label}</p>
                <p className='mt-1 text-lg font-bold'>{item.displayValue ?? stateText.unknown}</p>
              </div>
            ))}
          </div>
        </article>

        <article className='rounded-2xl border bg-card p-5 shadow-sm'>
          <Gauge className='mb-2 size-5' />
          <h2 className='font-heading text-lg font-bold'>Carga</h2>
          <p className='my-3 text-2xl font-bold'>{view.load.displayValue ?? stateText.insufficient_data}</p>
          <DomainLink href={view.load.href}>Profundizar</DomainLink>
        </article>

        <article className='rounded-2xl border bg-card p-5 shadow-sm'>
          <ChartNoAxesColumnIncreasing className='mb-2 size-5' />
          <h2 className='font-heading text-lg font-bold'>Adherencia</h2>
          <p className='my-3 text-2xl font-bold'>{view.adherence.displayValue ?? stateText.insufficient_data}</p>
          <DomainLink href={view.adherence.href}>Profundizar</DomainLink>
        </article>

        <article className='rounded-2xl border bg-card p-5 shadow-sm md:col-span-2'>
          <Mountain className='mb-2 size-5' />
          <h2 className='font-heading text-lg font-bold'>Próxima competencia</h2>
          {view.competition.state === 'available' ? (
            <div className='my-3'>
              <p className='text-xl font-bold'>{view.competition.name}</p>
              <p className='mt-1 flex items-center gap-1 text-sm text-muted-foreground'><CalendarDays className='size-4' />{view.competition.date}</p>
            </div>
          ) : <p className='my-3 text-sm text-muted-foreground'>No hay una competencia principal planificada.</p>}
          <DomainLink href={view.competition.href}>Ver calendario</DomainLink>
        </article>
      </div>
    </section>
  )
}
