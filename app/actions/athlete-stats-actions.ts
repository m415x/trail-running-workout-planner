'use server'

import { getCurrentAthlete } from '@/app/actions/dashboard-actions'
import { loadAthleteRaceRegistrations } from '@/lib/athlete-stats/athlete-race-registration-source'
import { createAthleteStatsAction } from '@/lib/athlete-stats/athlete-stats-action'
import { createAthleteStatsProductionSources } from '@/lib/athlete-stats/athlete-stats-production-wiring'
import { loadAthleteStatsProjectionInput } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import type { AthleteStatsReadRequest } from '@/lib/athlete-stats/athlete-stats-read-service'

const productionSources = createAthleteStatsProductionSources()

const readStats = createAthleteStatsAction({
  getCurrentAthlete,
  loadProjectionInput: (subject, period) => (
    loadAthleteStatsProjectionInput(subject, period, productionSources)
  ),
})

/** Athlete-facing Stats boundary. Subject identity is always resolved server-side. */
export async function getCurrentAthleteStatsAction(request: AthleteStatsReadRequest) {
  return readStats(request)
}

/** Athlete-facing race registration/history boundary. Identity stays server-owned. */
export async function getCurrentAthleteRaceRegistrationsAction({
  today,
}: {
  today: string
}) {
  const currentAthlete = await getCurrentAthlete()
  if (!currentAthlete.success || !currentAthlete.data?.athleteProfile) {
    return { status: 'error' as const, code: 'current_athlete_unavailable' as const }
  }

  const athleteProfile = currentAthlete.data.athleteProfile
  const data = loadAthleteRaceRegistrations(
    {
      athleteId: athleteProfile.id,
      teamId: athleteProfile.teamId,
    },
    today,
  )

  return { status: 'success' as const, data }
}
