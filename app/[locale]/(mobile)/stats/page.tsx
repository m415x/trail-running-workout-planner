import { ArrowRight, CalendarDays, ChartNoAxesColumnIncreasing, Gauge, Mountain, Route } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getCurrentAthleteStatsAction } from '@/app/actions/athlete-stats-actions'
import { getCurrentAthleteTrack1000mTestEventsAction } from '@/app/actions/field-performance-test-actions'
import { Link } from '@/i18n/routing'
import { AthleteTrack1000mForm } from '@/features/field-performance-test/components/AthleteTrack1000mForm'
import type { AthleteStatsDetails, AthleteStatsSummary } from '@/lib/athlete-stats/athlete-stats-projections'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'
import { buildAthleteStatsSummaryView } from '@/lib/athlete-stats/athlete-stats-summary-view'

function DomainLink({ href, children }: { href: '/stats/training' | '/stats/load' | '/stats/adherence' | '/stats/competition'; children: React.ReactNode }) {
  return <Link href={href} className='inline-flex items-center gap-1 text-sm font-semibold text-primary'>{children}<ArrowRight className='size-4' /></Link>
}

function AthleteTrack1000mPanel({ events }: { events: Array<{ id: string; scheduledAt: string }> }) {
  return <article className='rounded-2xl border bg-card p-5 shadow-sm md:col-span-2'><h2 className='font-heading text-lg font-bold'>Test 1000 m</h2><p className='mt-1 text-sm text-muted-foreground'>Registrá un test oficial programado o un intento autogestionado.</p><AthleteTrack1000mForm locale='es' events={events} /></article>
}

function isSummary(data: AthleteStatsSummary | AthleteStatsDetails): data is AthleteStatsSummary {
  return data.competition === null || !('primaryCompetition' in data.competition)
}

export default async function StatsPage() {
  const t = await getTranslations('stats')
  const period = athleteStatsSummaryPeriod()
  const [result, testEventsResult] = await Promise.all([
    getCurrentAthleteStatsAction({ ...period, view: 'summary' }),
    getCurrentAthleteTrack1000mTestEventsAction(),
  ])

  if (result.status !== 'success' || !isSummary(result.data)) return <section className='mx-auto w-full max-w-5xl px-4 py-8 sm:px-6'><h1 className='font-heading text-2xl font-bold'>{t('title')}</h1><p className='mt-4 rounded-2xl border bg-card p-5 text-sm text-muted-foreground'>{t('summary.error')}</p></section>

  const view = buildAthleteStatsSummaryView(result.data)
  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <header className='mb-6'><p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{t('summary.period')}</p><h1 className='mt-1 font-heading text-2xl font-bold sm:text-3xl'>{t('title')}</h1><p className='mt-1 text-sm text-muted-foreground'>{view.period.startDate} — {view.period.endDate}</p></header>
    <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
      <AthleteTrack1000mPanel events={testEventsResult.success ? testEventsResult.data : []} />
      <article className='rounded-2xl border bg-card p-5 shadow-sm md:col-span-2'><div className='mb-4 flex items-start justify-between gap-3'><div><Route className='mb-2 size-5' /><h2 className='font-heading text-lg font-bold'>{t('training')}</h2></div><DomainLink href={view.training.href}>{t('summary.viewDetail')}</DomainLink></div><div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>{view.training.metrics.map(item => <div key={item.key} className='rounded-xl bg-muted/50 p-3'><p className='text-xs text-muted-foreground'>{t(`trainingDetail.${item.key}`)}</p><p className='mt-1 text-lg font-bold'>{item.value === null ? t('unknownData') : item.key === 'sessions' ? `${item.value} ${t(item.value === 1 ? 'trainingDetail.session' : 'trainingDetail.sessionsUnit')}` : `${item.value} ${item.unit}`}</p></div>)}</div></article>
      <article className='rounded-2xl border bg-card p-5 shadow-sm'><Gauge className='mb-2 size-5' /><h2 className='font-heading text-lg font-bold'>{t('load')}</h2>{view.load.value !== null ? <p className='my-3 text-2xl font-bold'>{view.load.value} {view.load.unit}</p> : <p className='my-3 text-base font-semibold text-muted-foreground'>{t('insufficientData')}</p>}<DomainLink href={view.load.href}>{t('summary.explore')}</DomainLink></article>
      <article className='rounded-2xl border bg-card p-5 shadow-sm'><ChartNoAxesColumnIncreasing className='mb-2 size-5' /><h2 className='font-heading text-lg font-bold'>{t('adherence')}</h2>{view.adherence.value !== null ? <p className='my-3 text-2xl font-bold'>{view.adherence.value}{view.adherence.unit}</p> : <p className='my-3 text-base font-semibold text-muted-foreground'>{t('insufficientData')}</p>}<DomainLink href={view.adherence.href}>{t('summary.explore')}</DomainLink></article>
      <article className='rounded-2xl border bg-card p-5 shadow-sm md:col-span-2'><Mountain className='mb-2 size-5' /><h2 className='font-heading text-lg font-bold'>{t('summary.nextCompetition')}</h2>{view.competition.state === 'available' ? <div className='my-3'><p className='text-xl font-bold'>{view.competition.name}</p><p className='mt-1 flex items-center gap-1 text-sm text-muted-foreground'><CalendarDays className='size-4' />{view.competition.date}</p></div> : <p className='my-3 text-sm text-muted-foreground'>{t('competitionDetail.noPrimary')}</p>}<DomainLink href={view.competition.href}>{t('summary.viewCalendar')}</DomainLink></article>
    </div>
  </section>
}
