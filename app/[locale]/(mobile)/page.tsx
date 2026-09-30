import { getTranslations } from 'next-intl/server'

import { getCurrentAthlete, getCurrentAthletePlanningWeek } from '@/app/actions/dashboard-actions'
import { getCurrentAthleteRealizedTrainingRangeAction } from '@/app/actions/realized-training-actions'
import { HomeTabClient } from '@/app/[locale]/(mobile)/HomeTabClient'
import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'
import { resolveApplicationRegionalContext } from '@/lib/regionalization/application-regional-context'
import { getCurrentAthleteTrack1000mPerformanceAction } from '@/app/actions/field-performance-test-actions'

function currentWeekRangeInTimeZone(timeZone: string) {
  const today = new Date(`${getCurrentISODateInTimeZone(timeZone)}T00:00:00Z`)
  const offset = (today.getUTCDay() + 6) % 7
  const monday = new Date(today)
  monday.setUTCDate(today.getUTCDate() - offset)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const format = (date: Date) => date.toISOString().slice(0, 10)
  return { startDate: format(monday), endDate: format(sunday) }
}

export default async function MobileHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'RaceCatalog' })
  const regionalContext = resolveApplicationRegionalContext({
    language: locale === 'en' ? 'en' : 'es',
  })
  const range = currentWeekRangeInTimeZone(regionalContext.timeZone)

  const [athleteRes, scheduleRes, realizedRes, performanceRes] = await Promise.all([
    getCurrentAthlete(),
    getCurrentAthletePlanningWeek(range.startDate),
    getCurrentAthleteRealizedTrainingRangeAction(range.startDate, range.endDate),
    getCurrentAthleteTrack1000mPerformanceAction(
      getCurrentISODateInTimeZone(regionalContext.timeZone),
    ),
  ])

  if (!athleteRes.success || !scheduleRes.success || !realizedRes.success || !athleteRes.data || !scheduleRes.data) {
    return (
      <div className='flex h-screen items-center justify-center p-4 text-center text-red-500'>
        <p>{t('errors.saveFailed')}</p>
      </div>
    )
  }

  return (
    <HomeTabClient
      initialAthlete={athleteRes.data}
      initialSchedule={scheduleRes.data.sessions}
      initialRealizedTraining={realizedRes.data}
      locale={locale}
      runningReference={performanceRes.success ? performanceRes.data.reference : { status: 'unknown' }}
    />
  )
}
