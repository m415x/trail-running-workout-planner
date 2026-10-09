import { getTranslations } from 'next-intl/server'

import { db } from '@/db'
import { getCurrentAthlete, getCurrentAthletePlanningWeek } from '@/app/actions/dashboard-actions'
import { getCurrentAthleteRealizedTrainingRangeAction } from '@/app/actions/realized-training-actions'
import { getCurrentAthleteTrack1000mPerformanceAction } from '@/app/actions/field-performance-test-actions'
import { HomeTabClient } from '@/app/[locale]/(mobile)/HomeTabClient'
import { AthletePageState } from '@/features/athlete-planning/components/AthletePageState'
import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'
import { resolveApplicationRegionalContext } from '@/lib/regionalization/application-regional-context'
import { createAthleteHomeEconomicSqliteReader } from '@/lib/memberships/athlete-home-economic-sqlite-reader'
import { createDrizzleBillingDatabase } from '@/lib/memberships/billing-drizzle-database'
import { createSqliteBillingPersistencePort } from '@/lib/memberships/billing-sqlite-persistence'
import type { AthleteHomeEconomicSummary } from '@/lib/memberships/athlete-home-economic-reader'

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
  const tPlan = await getTranslations({ locale, namespace: 'AthletePlan' })
  const regionalContext = resolveApplicationRegionalContext({
    language: locale === 'en' ? 'en' : 'es',
  })
  const today = getCurrentISODateInTimeZone(regionalContext.timeZone)
  const range = currentWeekRangeInTimeZone(regionalContext.timeZone)

  const [athleteRes, scheduleRes, realizedRes, performanceRes] = await Promise.all([
    getCurrentAthlete(),
    getCurrentAthletePlanningWeek(range.startDate),
    getCurrentAthleteRealizedTrainingRangeAction(range.startDate, range.endDate),
    getCurrentAthleteTrack1000mPerformanceAction(today),
  ])

  if (athleteRes.forbidden || realizedRes.status === 'denied' || (!scheduleRes.success && scheduleRes.error === 'Acceso no autorizado')) {
    return <AthletePageState message={tPlan('unauthorized')} />
  }

  if (!athleteRes.success || !scheduleRes.success || !realizedRes.success || !athleteRes.data || !scheduleRes.data) {
    return <AthletePageState message={t('errors.saveFailed')} />
  }

  // The economic disclosure is always based on the server-side civil cutoff
  // and the exact athlete/team scope already resolved for this Home request.
  const unknownEconomicState: AthleteHomeEconomicSummary = {
    available: false,
    blockedForPriorDebt: false,
    currentCharge: null,
  }

  const athleteProfile = athleteRes.data.athleteProfile
  const economicState = athleteProfile
    ? await createAthleteHomeEconomicSqliteReader({
        createDatabase: () => createSqliteBillingPersistencePort(createDrizzleBillingDatabase(db)),
      })({
        teamId: athleteProfile.teamId,
        athleteId: athleteProfile.id,
        cutoffDate: today,
      })
    : unknownEconomicState

  return (
    <HomeTabClient
      initialAthlete={athleteRes.data}
      initialSchedule={scheduleRes.data.sessions}
      initialRealizedTraining={realizedRes.data}
      locale={locale}
      runningReference={performanceRes.success ? performanceRes.data.reference : { status: 'unknown' }}
      economicState={economicState}
    />
  )
}
