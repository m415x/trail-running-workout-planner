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

type RaceRegistrationLabels = {
  participation: string
  actualDistance: string
  elapsedTime: string
  unknown: string
  participationStatuses: Record<AthleteRaceRegistrationItem['participationStatus'], string>
}

function RaceRegistrationCard({ item, labels }: { item: AthleteRaceRegistrationItem; labels: RaceRegistrationLabels }) {
  return <article className='rounded-2xl border bg-card p-5'>
    <h3 className='font-heading text-lg font-bold'>{item.eventName}</h3>
    <p className='mt-1 text-sm text-muted-foreground'>{item.editionLabel} · {item.courseLabel}</p>
    <p className='mt-2 flex items-center gap-1 text-sm text-muted-foreground'><CalendarDays className='size-4' />{item.editionDate}</p>
    <div className='mt-3 flex flex-wrap gap-4 text-sm'>
      <span>{item.nominalDistanceKm === null ? labels.unknown : `${item.nominalDistanceKm} km`}</span>
      <span>{item.nominalElevationGainM === null ? labels.unknown : `${item.nominalElevationGainM} m D+`}</span>
    </div>
    <dl className='mt-4 grid gap-2 text-sm'>
      <div><dt className='inline text-muted-foreground'>{labels.participation}: </dt><dd className='inline'>{labels.participationStatuses[item.participationStatus]}</dd></div>
      <div><dt className='inline text-muted-foreground'>{labels.actualDistance}: </dt><dd className='inline'>{item.actualDistanceKm === null ? labels.unknown : `${item.actualDistanceKm} km`}</dd></div>
      <div><dt className='inline text-muted-foreground'>{labels.elapsedTime}: </dt><dd className='inline'>{item.elapsedTimeSeconds === null ? labels.unknown : `${item.elapsedTimeSeconds} s`}</dd></div>
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
  const registrationLabels: RaceRegistrationLabels = {
    participation: t('competitionDetail.registrations.participation'),
    actualDistance: t('competitionDetail.registrations.actualDistance'),
    elapsedTime: t('competitionDetail.registrations.elapsedTime'),
    unknown: t('competitionDetail.registrations.unknown'),
    participationStatuses: {
      unknown: t('competitionDetail.registrations.participationStatuses.unknown'),
      started: t('competitionDetail.registrations.participationStatuses.started'),
      finished: t('competitionDetail.registrations.participationStatuses.finished'),
      dnf: t('competitionDetail.registrations.participationStatuses.dnf'),
      dns: t('competitionDetail.registrations.participationStatuses.dns'),
    },
  }

  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <Link href='/stats' className='mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />{t('backToStats')}</Link>
    <header className='mb-6'><Mountain className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold sm:text-3xl'>{t('competition')}</h1><p className='mt-1 text-sm text-muted-foreground'>{t('competitionDetail.context')}</p></header>
    {competition.primaryCompetition ? <CompetitionCard competition={competition.primaryCompetition} title={t('competitionDetail.primary')} elevationUnavailable={elevationUnavailable} /> : <p className='rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>{t('competitionDetail.noPrimary')}</p>}
    {competition.intermediateCompetitions.length > 0 && <div className='mt-4'><h2 className='mb-3 font-heading text-lg font-bold'>{t('competitionDetail.intermediate')}</h2><div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{competition.intermediateCompetitions.map(item => <CompetitionCard key={`${item.name}-${item.date}`} competition={item} elevationUnavailable={elevationUnavailable} />)}</div></div>}

    <div className='mt-8 space-y-6'>
      <section>
        <h2 className='mb-3 font-heading text-lg font-bold'>{t('competitionDetail.registrations.upcoming')}</h2>
        {raceRegistrations.upcoming.length === 0
          ? <p className='rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>{t('competitionDetail.registrations.noUpcoming')}</p>
          : <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{raceRegistrations.upcoming.map(item => <RaceRegistrationCard key={item.registrationId} item={item} labels={registrationLabels} />)}</div>}
      </section>
      <section>
        <h2 className='mb-3 font-heading text-lg font-bold'>{t('competitionDetail.registrations.history')}</h2>
        {raceRegistrations.history.length === 0
          ? <p className='rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>{t('competitionDetail.registrations.noHistory')}</p>
          : <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{raceRegistrations.history.map(item => <RaceRegistrationCard key={item.registrationId} item={item} labels={registrationLabels} />)}</div>}
      </section>
    </div>
  </section>
}
