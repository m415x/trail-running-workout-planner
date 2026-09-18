import { ArrowLeft, CalendarDays, Mountain } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getCurrentAthleteRaceRegistrationsAction } from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import type { AthleteRaceRegistrationItem } from '@/lib/athlete-stats/athlete-race-registration-projection'

type Labels = {
  unknown: string
  participation: string
  statuses: Record<AthleteRaceRegistrationItem['participationStatus'], string>
}

function RegistrationCard({ item, labels }: { item: AthleteRaceRegistrationItem; labels: Labels }) {
  return <article className='rounded-2xl border bg-card p-5'>
    <h2 className='font-heading text-lg font-bold'>{item.eventName}</h2>
    <p className='mt-1 text-sm text-muted-foreground'>{item.editionLabel} · {item.courseLabel}</p>
    <p className='mt-2 flex items-center gap-1 text-sm text-muted-foreground'><CalendarDays className='size-4' />{item.editionDate}</p>
    <div className='mt-3 flex flex-wrap gap-4 text-sm'>
      <span>{item.nominalDistanceKm === null ? labels.unknown : `${item.nominalDistanceKm} km`}</span>
      <span>{item.nominalElevationGainM === null ? labels.unknown : `${item.nominalElevationGainM} m D+`}</span>
    </div>
    <p className='mt-3 text-sm'><span className='text-muted-foreground'>{labels.participation}: </span>{labels.statuses[item.participationStatus]}</p>
  </article>
}

export default async function PlanCompetitionPage() {
  const t = await getTranslations('stats')
  const today = new Date().toISOString().slice(0, 10)
  const result = await getCurrentAthleteRaceRegistrationsAction({ today })
  if (result.status !== 'success') return <p className='p-6 text-sm text-muted-foreground'>{t('competitionError')}</p>

  const labels: Labels = {
    unknown: t('competitionDetail.registrations.unknown'),
    participation: t('competitionDetail.registrations.participation'),
    statuses: {
      unknown: t('competitionDetail.registrations.participationStatuses.unknown'),
      started: t('competitionDetail.registrations.participationStatuses.started'),
      finished: t('competitionDetail.registrations.participationStatuses.finished'),
      dnf: t('competitionDetail.registrations.participationStatuses.dnf'),
      dns: t('competitionDetail.registrations.participationStatuses.dns'),
    },
  }

  return <section className='space-y-5 pb-2'>
    <Link href='/plan' className='inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />Plan</Link>
    <header><Mountain className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold'>{t('competition')}</h1><p className='mt-1 text-sm text-muted-foreground'>{t('competitionDetail.registrations.upcoming')}</p></header>
    {result.data.upcoming.length === 0
      ? <p className='rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>{t('competitionDetail.registrations.noUpcoming')}</p>
      : <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>{result.data.upcoming.map(item => <RegistrationCard key={item.registrationId} item={item} labels={labels} />)}</div>}
  </section>
}
