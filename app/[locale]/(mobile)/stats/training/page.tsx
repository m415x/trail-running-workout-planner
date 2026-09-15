import { ArrowLeft, Route } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getCurrentAthleteStatsAction } from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import type { AthleteStatsDetails } from '@/lib/athlete-stats/athlete-stats-projections'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'

export default async function TrainingStatsPage() {
  const t = await getTranslations('stats')
  const period = athleteStatsSummaryPeriod()
  const result = await getCurrentAthleteStatsAction({ ...period, view: 'details' })
  if (result.status !== 'success' || !('series' in result.data.training)) return <p className='mx-auto max-w-5xl p-6 text-sm text-muted-foreground'>{t('trainingError')}</p>

  const { training } = result.data
  const comparisonText = (comparison: AthleteStatsDetails['training']['distance']['comparison']) => {
    if (comparison.state !== 'available') return t('trainingDetail.noComparison')
    const sign = comparison.absoluteDelta > 0 ? '+' : ''
    return t('trainingDetail.previousDelta', { delta: `${sign}${comparison.absoluteDelta}` })
  }
  const metrics = [
    [t('trainingDetail.distance'), training.distance, 'km'],
    [t('trainingDetail.duration'), training.duration, 'min'],
    [t('trainingDetail.elevation'), training.elevation, 'm'],
    [t('trainingDetail.sessions'), training.frequency, t('trainingDetail.sessionsUnit')],
  ] as const

  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <Link href='/stats' className='mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />{t('backToStats')}</Link>
    <header className='mb-6'><Route className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold sm:text-3xl'>{t('training')}</h1><p className='mt-1 text-sm text-muted-foreground'>{result.data.period.startDate} — {result.data.period.endDate}</p></header>
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>{metrics.map(([label, metric, unit]) => <article key={label} className='rounded-2xl border bg-card p-4'><p className='text-xs text-muted-foreground'>{label}</p><p className='mt-1 text-xl font-bold'>{metric.value === null ? t('noData') : `${metric.value} ${metric.value === 1 && unit === t('trainingDetail.sessionsUnit') ? t('trainingDetail.session') : unit}`}</p><p className='mt-2 text-xs text-muted-foreground'>{comparisonText(metric.comparison)}</p></article>)}</div>
    <article className='mt-4 rounded-2xl border bg-card p-5'><h2 className='font-heading text-lg font-bold'>{t('trainingDetail.activityRecorded')}</h2>{training.series.length === 0 ? <p className='mt-3 text-sm text-muted-foreground'>{t('trainingDetail.noActivity')}</p> : <div className='mt-4 space-y-3'>{training.series.map(point => <div key={point.date} className='grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-5'><strong>{point.date}</strong><span>{point.sessions} {point.sessions === 1 ? t('trainingDetail.session') : t('trainingDetail.sessionsUnit')}</span><span>{point.distanceKm === null ? `${t('trainingDetail.distance')} —` : `${point.distanceKm} km`}</span><span>{point.durationMin === null ? `${t('trainingDetail.duration')} —` : `${point.durationMin} min`}</span><span>{point.elevationGainM === null ? `${t('trainingDetail.elevation')} —` : `${point.elevationGainM} m`}</span></div>)}</div>}</article>
  </section>
}
