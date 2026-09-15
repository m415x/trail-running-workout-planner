import { ArrowLeft, CalendarDays, Mountain } from 'lucide-react'

import { getCurrentAthleteStatsAction } from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'

function CompetitionCard({ competition, title }: { competition: { name: string; date: string; distanceKm: number; elevationGainM: number | null }; title?: string }) {
  return <article className='rounded-2xl border bg-card p-5'>{title && <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{title}</p>}<h2 className='font-heading text-lg font-bold'>{competition.name}</h2><p className='mt-2 flex items-center gap-1 text-sm text-muted-foreground'><CalendarDays className='size-4' />{competition.date}</p><div className='mt-3 flex flex-wrap gap-4 text-sm'><span>{competition.distanceKm} km</span><span>{competition.elevationGainM === null ? 'Desnivel sin datos' : `${competition.elevationGainM} m D+`}</span></div></article>
}

export default async function CompetitionStatsPage() {
  const period = athleteStatsSummaryPeriod()
  const result = await getCurrentAthleteStatsAction({ ...period, view: 'details' })
  if (result.status !== 'success' || !('primaryCompetition' in result.data.competition)) return <p className='mx-auto max-w-5xl p-6 text-sm text-muted-foreground'>No pudimos cargar el calendario competitivo.</p>

  const { competition } = result.data
  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <Link href='/stats' className='mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />Estadísticas</Link>
    <header className='mb-6'><Mountain className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold sm:text-3xl'>Competencias</h1><p className='mt-1 text-sm text-muted-foreground'>Contexto competitivo registrado</p></header>
    {competition.primaryCompetition ? <CompetitionCard competition={competition.primaryCompetition} title='Competencia principal' /> : <p className='rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>No hay una competencia principal planificada.</p>}
    {competition.intermediateCompetitions.length > 0 && <div className='mt-4'><h2 className='mb-3 font-heading text-lg font-bold'>Competencias intermedias</h2><div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{competition.intermediateCompetitions.map(item => <CompetitionCard key={`${item.name}-${item.date}`} competition={item} />)}</div></div>}
  </section>
}
