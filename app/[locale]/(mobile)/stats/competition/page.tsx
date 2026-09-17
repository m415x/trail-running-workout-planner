import { ArrowLeft, CalendarDays, Mountain } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import {
  getCurrentAthleteRaceRegistrationsAction,
  getCurrentAthleteStatsAction,
} from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import type { AthleteRaceRegistrationItem } from '@/lib/athlete-stats/athlete-race-registration-projection'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'

function CompetitionCard({ competition, title, elevationUnavailable }: { competition: { name: string; date: string; distanceKm: number; elevationGainM: number | null }; title?: string; elevationUnavailable: string }) {
  return <article className='rounded-2xl border bg-card p-5'>{title && <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{title}</p>}<h2 className='font-heading text-lg font-bold'>{competition.name}</h2><p className='mt-2 flex items-center gap-1 text-sm text-muted-foreground'><CalendarDays className='size-4' />{competition.date}</p><div className='mt-3 flex flex-wrap gap-4 text-sm'><span>{competition.distanceKm} km</span><span>{competition.elevationGainM === null ? elevationUnavailable : `${competition.elevationGainM} m D+`}</span></div></article>
}

function RaceRegistrationCard({ item }: { item: AthleteRaceRegistrationItem }) {
  return <article className='rounded-2xl border bg-card p-5'>
    <h3 className='font-heading text-lg font-bold'>{item.eventName}</h3>
    <p className='mt-1 text-sm text-muted-foreground'>{item.editionLabel} · {item.courseLabel}</p>
    <p className='mt-2 flex items-center gap-1 text-sm text-muted-foreground'><CalendarDays className='size-4' />{item.editionDate}</p>
    <div className='mt-3 flex flex-wrap gap-4 text-sm'>
      <span>{item.nominalDistanceKm === null ? '—' : `${item.nominalDistanceKm} km`}</span>
      <span>{item.nominalElevationGainM === null ? '—' : `${item.nominalElevationGainM} m D+`}</span>
    </div>
    <dl className='mt-4 grid gap-2 text-sm'>
      <div><dt className='inline text-muted-foreground'>Participación: </dt><dd className='inline'>{item.participationStatus}</dd></div>
      <div><dt className='inline text-muted-foreground'>Distancia real: </dt><dd className='inline'>{item.actualDistanceKm === null ? '—' : `${item.actualDistanceKm} km`}</dd></div>
      <div><dt className='inline text-muted-foreground'>Tiempo: </dt><dd className='inline'>{item.elapsedTimeSeconds === null ? '—' : `${item.elapsedTimeSeconds} s`}</dd></div>
    </dl>
  </article>
}

export default async function CompetitionStatsPage() {
  const t = await getTranslations('stats')
  const period = athleteStatsSummaryPeriod()
  const today = new Date().toISOString().slice(0, 10)
  const [result, raceRegistrations] = await Promise.all([
    getCurrentAthleteStatsAction({ ...period, view: 'details' }),
    getCurrentAthleteRaceRegistrationsAction({ today }),
  ])
  if (result.status !== 'success') return <p className='mx-auto max-w-5xl p-6 text-sm text-muted-foreground'>{t('competitionError')}</p>

  const competition = result.data.competition
  if (competition === null || !('primaryCompetition' in competition)) return <p className='mx-auto max-w-5xl p-6 text-sm text-muted-foreground'>{t('competitionError')}</p>
  const elevationUnavailable = t('competitionDetail.elevationUnavailable')

  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <Link href='/stats' className='mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />{t('backToStats')}</Link>
    <header className='mb-6'><Mountain className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold sm:text-3xl'>{t('competition')}</h1><p className='mt-1 text-sm text-muted-foreground'>{t('competitionDetail.context')}</p></header>
    {competition.primaryCompetition ? <CompetitionCard competition={competition.primaryCompetition} title={t('competitionDetail.primary')} elevationUnavailable={elevationUnavailable} /> : <p className='rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>{t('competitionDetail.noPrimary')}</p>}
    {competition.intermediateCompetitions.length > 0 && <div className='mt-4'><h2 className='mb-3 font-heading text-lg font-bold'>{t('competitionDetail.intermediate')}</h2><div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{competition.intermediateCompetitions.map(item => <CompetitionCard key={`${item.name}-${item.date}`} competition={item} elevationUnavailable={elevationUnavailable} />)}</div></div>}

    <div className='mt-8 space-y-6'>
      <section>
        <h2 className='mb-3 font-heading text-lg font-bold'>Próximas inscripciones</h2>
        {raceRegistrations.upcoming.length === 0
          ? <p className='rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>No hay inscripciones próximas.</p>
          : <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{raceRegistrations.upcoming.map(item => <RaceRegistrationCard key={item.registrationId} item={item} />)}</div>}
      </section>
      <section>
        <h2 className='mb-3 font-heading text-lg font-bold'>Historial de carreras</h2>
        {raceRegistrations.history.length === 0
          ? <p className='rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>No hay participaciones históricas registradas.</p>
          : <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{raceRegistrations.history.map(item => <RaceRegistrationCard key={item.registrationId} item={item} />)}</div>}
      </section>
    </div>
  </section>
}
