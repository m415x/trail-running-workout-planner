import { ArrowLeft, Gauge } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

import { getCurrentAthleteStatsAction } from '@/app/actions/athlete-stats-actions'
import { Link } from '@/i18n/routing'
import { athleteStatsSummaryPeriod } from '@/lib/athlete-stats/athlete-stats-summary-period'

export default async function LoadStatsPage() {
  const t = await getTranslations('stats')
  const period = athleteStatsSummaryPeriod()
  const result = await getCurrentAthleteStatsAction({ ...period, view: 'details' })
  if (result.status !== 'success' || !('trend' in result.data.load)) return <p className='mx-auto max-w-5xl p-6 text-sm text-muted-foreground'>{t('loadError')}</p>

  const { load } = result.data
  const coverage = load.coverageRatio === null ? t('noData') : `${Math.round(load.coverageRatio * 100)}%`
  return <section className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8'>
    <Link href='/stats' className='mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary'><ArrowLeft className='size-4' />{t('backToStats')}</Link>
    <header className='mb-6'><Gauge className='mb-2 size-5' /><h1 className='font-heading text-2xl font-bold sm:text-3xl'>{t('load')}</h1><p className='mt-1 text-sm text-muted-foreground'>{result.data.period.startDate} — {result.data.period.endDate}</p></header>
    {load.state === 'available' ? <>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>{[[t('loadDetail.shortTerm'), load.shortTermLoadAu], [t('loadDetail.longTerm'), load.longTermLoadAu], [t('loadDetail.balance'), load.loadBalanceAu]].map(([label, value]) => <article key={label} className='rounded-2xl border bg-card p-4'><p className='text-xs text-muted-foreground'>{label}</p><p className='mt-1 text-xl font-bold'>{value === null ? t('noData') : `${value} AU`}</p></article>)}</div>
      <article className='mt-4 rounded-2xl border bg-card p-5'><h2 className='font-heading text-lg font-bold'>{t('loadDetail.recordedEvolution')}</h2><p className='mt-1 text-sm text-muted-foreground'>{t('coverage')}: {coverage}</p><div className='mt-4 space-y-2'>{load.trend.map(point => <div key={point.date} className='grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-5'><strong>{point.date}</strong><span>{t('loadDetail.daily')} {point.dailyLoadAu ?? '—'} AU</span><span>{t('loadDetail.short')} {point.shortTermLoadAu ?? '—'} AU</span><span>{t('loadDetail.long')} {point.longTermLoadAu ?? '—'} AU</span><span>{t('loadDetail.balance')} {point.loadBalanceAu ?? '—'} AU</span></div>)}</div></article>
    </> : <article className='rounded-2xl border bg-card p-5'><h2 className='text-base font-semibold text-muted-foreground'>{t('insufficientData')}</h2><p className='mt-2 text-sm text-muted-foreground'>{t('coverage')}: {coverage}</p></article>}
  </section>
}
