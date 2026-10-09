import { getCurrentAthlete } from '@/app/actions/dashboard-actions'
import { getCurrentAthleteTrack1000mPerformanceAction } from '@/app/actions/field-performance-test-actions'
import { AthleteMembershipStatus } from '@/features/memberships/components/AthleteMembershipStatus'
import { ProfileTab } from '@/features/profile/ProfileTab'
import { db } from '@/db'
import { getCurrentISODateInTimeZone } from '@/lib/date-time/current-calendar-date'
import { APPLICATION_REGIONAL_FALLBACKS } from '@/lib/regionalization/application-regional-context'
import { createAthleteMembershipPageLoader } from '@/lib/memberships/athlete-membership-page-loader'
import { createDrizzleBillingDatabase } from '@/lib/memberships/billing-drizzle-database'
import { createSqliteBillingPersistencePort } from '@/lib/memberships/billing-sqlite-persistence'

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const athleteResult = await getCurrentAthlete()

  if (!athleteResult.success || !athleteResult.data?.athleteProfile) {
    return <ProfileTab />
  }

  const athleteProfile = athleteResult.data.athleteProfile
  const today = getCurrentISODateInTimeZone(APPLICATION_REGIONAL_FALLBACKS.timeZone)
  const performanceResult = await getCurrentAthleteTrack1000mPerformanceAction(today)
  const performance = performanceResult.success ? performanceResult.data : null
  const performanceStatus = performanceResult.success
    ? performanceResult.data.reference.status === 'unknown' ? 'unknown' as const : 'loaded' as const
    : performanceResult.error === 'not_authorized' ? 'denied' as const : 'error' as const
  const loadMembership = createAthleteMembershipPageLoader({
    createPort: (database: typeof db) =>
      createSqliteBillingPersistencePort(createDrizzleBillingDatabase(database)),
  })
  const membership = await loadMembership({
    db,
    locale: locale === 'en' ? 'en' : 'es',
    teamId: athleteProfile.teamId,
    athleteId: athleteProfile.id,
    onDate: today,
    cutoffDate: today,
  })

  return (
    <ProfileTab
      performance={performance}
      performanceStatus={performanceStatus}
      membershipStatus={
        <AthleteMembershipStatus
          locale={locale === 'en' ? 'en' : 'es'}
          debtExperience={membership.debtExperience}
        />
      }
    />
  )
}
